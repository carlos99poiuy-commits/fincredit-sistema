# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Start the server (runs on port 3000)
node server.js

# Test the evaluation API manually
curl -X POST http://localhost:3000/api/evaluar \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Juan López","telefono":"5512345678","direccion":"Calle 1, CDMX","rfc":"LOCA800101ABC","tipo_producto":"prestamo_personal","ingreso_mensual":30000}'
```

No test runner or linter is configured.

## Project Structure

```
ejercicioClaude1/
├── server.js           # Express server, all API routes and credit scoring logic
├── database.js         # JSON file persistence layer (read/write creditos.json)
├── creditos.json       # Data store — solicitudes + creditos arrays
├── package.json
├── package-lock.json
├── .gitignore
├── CLAUDE.md
└── public/             # Static files served directly by Express
    ├── index.html      # Solicitud wizard (4-step form)
    ├── app.js          # Wizard logic, state management, dynamic rendering
    ├── style.css       # Styles for index.html / app.js only
    └── admin.html      # Admin panel (self-contained, CSS+JS inline)
```

## Architecture

**Stack:** Express backend + vanilla JS frontend + JSON file persistence. No build step required — the server serves static files from `public/` directly.

**Dependencies:** `express` (HTTP server), `uuid` (folio/ID generation). No ORM or query builder.

**Key constraint:** `better-sqlite3` cannot be used on this machine (Node.js v25, no Visual Studio Build Tools). The persistence layer uses a plain JSON file (`creditos.json`) instead, read/written synchronously on every request via `database.js`. The file is auto-created on first write if it doesn't exist.

### Request lifecycle

1. Browser submits form data → `POST /api/evaluar` (stateless, returns score + offer)
2. User accepts → `POST /api/solicitud` (persists both a `solicitud` and a `credito` record to `creditos.json`)
3. Admin panel calls `GET /api/admin/solicitudes` and `GET /api/admin/stats` to read all records

### Credit scoring logic (all in `server.js`)

- `generarScore()` — base 550, adds up to 150 based on income brackets, +50 for valid RFC, ±50 random noise, clamped 400–850
- `calcularOferta()` — maps score ranges to (multiplier × monthly income) for loan amount; interest rates range 18%–55% annual (personal loan) and 28%–65% (credit card); personal loan payment uses standard amortization formula, credit card uses 3% minimum payment
- `scoreClasificacion()` — maps score to label: Excelente ≥750, Bueno ≥680, Regular ≥600, Bajo ≥500, Muy Bajo <500
- Folio format: `CRED-YYYYMM-NNNNN` / credit folio: `CR-CRED-YYYYMM-NNNNN`

### Data shape (`creditos.json`)

```json
{
  "solicitudes": [{ "id", "nombre", "telefono", "direccion", "rfc", "tipo_producto",
                    "ingreso_mensual", "ingreso_anual", "ocupacion", "score_credito",
                    "monto_ofrecido", "tasa_interes", "plazo_meses", "pago_mensual",
                    "estado", "fecha_solicitud", "fecha_aprobacion", "folio" }],
  "creditos":    [{ "id", "solicitud_id", "folio_credito", "monto_aprobado",
                    "tasa_interes", "plazo_meses", "pago_mensual",
                    "fecha_inicio", "fecha_vencimiento", "estado" }]
}
```

`getAllSolicitudes()` joins both arrays in memory before returning to the admin API, sorted descending by `fecha_solicitud`.

### Frontend (`public/`)

- `index.html` + `app.js` — 4-step wizard (datos personales → financiero → evaluación → resultado). Global `state` object tracks current step, selected product, and last evaluation response. Steps 3 and 4 render their content dynamically via `renderEvaluacion()` and `renderResultado()`.
- `admin.html` — standalone page with all CSS and JS inline; no external stylesheet dependency. Auto-refreshes data every 30 seconds.
- `style.css` — stylesheet used **only** by `index.html`/`app.js` (the solicitud wizard). `admin.html` has its own self-contained `<style>` block.

### Design system

Both pages share the same dark visual language even though the CSS lives in separate places:

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#070b12` | Page background |
| `--surface` / `--surface-up` | `#0c1220` / `#111926` | Cards, hover states |
| `--amber` | `#e8b84b` | Primary accent, active states |
| `--green` | `#0ee8a0` | Success, approved states |
| `--red` | `#ff3d5a` | Errors, danger actions |
| `--blue` | `#4d9eff` | Credit card product, info states |
| Fonts | Syne (display) + JetBrains Mono (body) | Loaded from Google Fonts |

Score color thresholds used in `app.js`: green ≥750, blue ≥680, amber ≥600, red <600.

### API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/evaluar` | Simulate credit evaluation (stateless) |
| `POST` | `/api/solicitud` | Accept offer and persist credit |
| `GET`  | `/api/admin/solicitudes` | All records (joined) |
| `GET`  | `/api/admin/stats` | Aggregate counts and totals |

---

## Subagentes y Skills — Reglas de Delegación

Este proyecto cuenta con subagentes especializados y skills. Aplica estas reglas en cada request para delegar correctamente.

---

### Subagentes del proyecto (`.claude/agents/`)

#### `frontend-ui-specialist` — Especialista en UI/UX
**Modelo:** Opus | **Memoria:** persistente por proyecto

**Delegar SIEMPRE cuando:**
- Se modifica cualquier archivo en `public/` (`index.html`, `app.js`, `style.css`, `admin.html`, `react-app/`)
- Se agregan nuevos componentes, pasos al wizard, o páginas al panel admin
- El usuario reporta problemas visuales, de layout o de responsividad
- Se implementan cambios de diseño, temas (dark/light), tipografía o colores
- Se quiere verificar accesibilidad (WCAG), contraste de colores o navegación por teclado
- Se agrega o modifica código React en `public/react-app/`

**NO delegar cuando:**
- El cambio es solo backend (`server.js`, `database.js`)
- Es una pregunta explicativa sin cambios de código

**Invocación:** `Task tool` con `subagent_type: frontend-ui-specialist`

---

#### `web-security-auditor` — Auditor de Seguridad
**Modelo:** Opus | **Memoria:** persistente por proyecto

**Delegar SIEMPRE cuando:**
- Se escribe o modifica un endpoint de API (`server.js`)
- Se agrega lógica que procesa `req.body` o parámetros de usuario
- Se modifica `database.js` o la capa de persistencia
- Se agregan dependencias npm nuevas (`package.json`)
- El usuario pide revisión de seguridad explícita
- Se detecta uso de `innerHTML`, `eval()`, o concatenación de strings en queries

**Delegar PROACTIVAMENTE después de:**
- Crear nuevas rutas `POST`/`GET` en `server.js`
- Cualquier cambio en las funciones `generarScore()`, `calcularOferta()` o validación de RFC
- Cambios en `GET /api/admin/*` (endpoints de administración sin auth)

**NO delegar cuando:**
- El cambio es solo CSS/HTML estático sin lógica
- Es una consulta o explicación sin modificación de código

**Invocación:** `Task tool` con `subagent_type: web-security-auditor`

---

### Skills disponibles — Cuándo invocar cada uno

#### Skills de desarrollo y calidad

| Skill | Invocar cuando... | Comando |
|-------|-------------------|---------|
| `best-practices` | El usuario da una instrucción vaga o antes de implementar una tarea compleja; para mejorar el prompt antes de ejecutar | `/best-practices` |
| `code-review` | Se completa un PR o bloque de código y se quiere revisión de calidad | `/code-review` |
| `code-refactoring` | El usuario pide limpiar, simplificar o mejorar código existente sin cambiar comportamiento | `/code-refactoring` |
| `javascript-typescript` | Tareas de JS moderno (ES2024+), patrones async/await, Node.js avanzado | `/javascript-typescript` |
| `backend-development` | Diseño de APIs REST, esquemas de BD, arquitectura de microservicios | `/backend-development` |
| `database-design` | Migración desde JSON a PostgreSQL/SQLite, optimización de queries | `/database-design` |
| `security-reviewer` | Auditoría de seguridad completa del proyecto (alternativa al subagente) | `/security-reviewer` |
| `vercel-react-best-practices` | Optimización de React, patrones Next.js, performance en componentes | `/vercel-react-best-practices` |

#### Skills de frontend y diseño

| Skill | Invocar cuando... | Comando |
|-------|-------------------|---------|
| `frontend-design` | Crear nuevas páginas, componentes o interfaces desde cero con alta calidad visual | `/frontend-design` |
| `fincredit-frontend-style` | Asegurar consistencia visual con el design system del proyecto al agregar nuevas pantallas | `/fincredit-frontend-style` |
| `brand-guidelines` | Aplicar colores y tipografía de marca consistentemente | `/brand-guidelines` |
| `figma` / `figma-implement-design` | El usuario provee un URL o nodo de Figma para implementar diseño | `/figma` |

#### Skills de documentación y contenido

| Skill | Invocar cuando... | Comando |
|-------|-------------------|---------|
| `code-documentation` | Documentar APIs, generar README, escribir JSDoc | `/code-documentation` |
| `changelog-generator` | Generar notas de versión desde historial de commits | `/changelog-generator` |
| `content-research-writer` | Escribir artículos, documentación técnica, tutoriales o reportes | `/content-research-writer` |
| `doc-coauthoring` | Redactar specs técnicas, propuestas o documentos estructurados | `/doc-coauthoring` |

#### Skills de DevOps y productividad

| Skill | Invocar cuando... | Comando |
|-------|-------------------|---------|
| `gh-fix-ci` | Depurar o corregir checks fallidos en GitHub Actions | `/gh-fix-ci` |
| `find-skills` | El usuario pregunta si existe un skill para una tarea específica | `/find-skills` |
| `ask-questions-if-underspecified` | La instrucción del usuario es ambigua y se necesita clarificar antes de implementar | `/ask-questions-if-underspecified` |

---

### Reglas de delegación paralela

Cuando una tarea involucra **múltiples dominios simultáneamente**, lanzar subagentes en paralelo:

```
Nueva ruta API + cambio de frontend
→ Lanzar web-security-auditor + frontend-ui-specialist en paralelo
```

```
Nuevo componente React + revisión de calidad
→ Lanzar frontend-ui-specialist (review) en paralelo con la implementación
```

### Regla de prioridad

1. **Subagentes del proyecto** (`frontend-ui-specialist`, `web-security-auditor`) — mayor prioridad, tienen contexto específico del proyecto y memoria persistente.
2. **Skills de desarrollo** (`best-practices`, `code-review`, `security-reviewer`) — usar cuando los subagentes no cubren el dominio exacto.
3. **Skills generales** — usar para tareas fuera del ciclo de desarrollo principal.
