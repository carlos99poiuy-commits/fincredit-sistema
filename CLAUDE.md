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

## Architecture

**Stack:** Express backend + vanilla JS frontend + JSON file persistence. No build step required — the server serves static files from `public/` directly.

**Key constraint:** `better-sqlite3` cannot be used on this machine (Node.js v25, no Visual Studio Build Tools). The persistence layer uses a plain JSON file (`creditos.json`) instead, read/written synchronously on every request via `database.js`.

### Request lifecycle

1. Browser submits form data → `POST /api/evaluar` (no persistence, returns score + offer)
2. User accepts → `POST /api/solicitud` (persists both a `solicitud` and a `credito` record to `creditos.json`)
3. Admin panel calls `GET /api/admin/solicitudes` and `GET /api/admin/stats` to read all records

### Credit scoring logic (all in `server.js`)

- `generarScore()` — base 550, adds up to 150 based on income brackets, +50 for valid RFC, ±50 random noise, clamped 400–850
- `calcularOferta()` — maps score ranges to (multiplier × monthly income) for loan amount; interest rates range 18%–55% annual; personal loan payment uses standard amortization formula, credit card uses 3% minimum payment
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

`getAllSolicitudes()` joins both arrays in memory before returning to the admin API.

### Frontend (`public/`)

- `index.html` + `app.js` — 4-step wizard (datos personales → financiero → evaluación → resultado). Global `state` object tracks current step, selected product, and last evaluation response.
- `admin.html` — standalone page with inline `<script>`, auto-refreshes stats every 30 seconds.
- `style.css` — single stylesheet shared by both pages, uses CSS custom properties for theming.

### API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/evaluar` | Simulate credit evaluation (stateless) |
| `POST` | `/api/solicitud` | Accept offer and persist credit |
| `GET`  | `/api/admin/solicitudes` | All records (joined) |
| `GET`  | `/api/admin/stats` | Aggregate counts and totals |
