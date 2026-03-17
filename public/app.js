// ────────────────────────────────────────────────
// Estado global
// ────────────────────────────────────────────────
const state = {
  paso: 1,
  productoSeleccionado: '',
  evaluacion: null
};

// ────────────────────────────────────────────────
// Utilidades
// ────────────────────────────────────────────────
function fmt(num) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(num);
}

function fmtPct(num) {
  return (num * 100).toFixed(1) + '%';
}

function fmtFecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
}

function showSpinner(msg = 'Procesando...') {
  document.getElementById('spinnerMsg').textContent = msg;
  document.getElementById('spinner').classList.add('show');
}

function hideSpinner() {
  document.getElementById('spinner').classList.remove('show');
}

function mostrarError(id, msg) {
  const el = document.getElementById('err-' + id);
  if (el) {
    if (msg) el.textContent = msg;
    el.classList.add('show');
  }
}

function limpiarError(id) {
  const el = document.getElementById('err-' + id);
  if (el) el.classList.remove('show');
}

function setStep(n) {
  state.paso = n;
  document.querySelectorAll('.card').forEach((c, i) => {
    c.classList.toggle('active', i + 1 === n);
  });
  document.querySelectorAll('.step').forEach((s, i) => {
    s.classList.remove('active', 'done');
    if (i + 1 < n) s.classList.add('done');
    if (i + 1 === n) s.classList.add('active');
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ────────────────────────────────────────────────
// Selección de producto
// ────────────────────────────────────────────────
function selectProduct(tipo) {
  state.productoSeleccionado = tipo;
  document.getElementById('prod-prestamo').classList.toggle('selected', tipo === 'prestamo_personal');
  document.getElementById('prod-tarjeta').classList.toggle('selected', tipo === 'tarjeta_credito');
  document.getElementById('prod-hipotecario').classList.toggle('selected', tipo === 'hipotecario');
  limpiarError('producto');
}

// ────────────────────────────────────────────────
// Autocompletar ingreso anual
// ────────────────────────────────────────────────
document.getElementById('ingreso_mensual').addEventListener('input', function () {
  const val = parseFloat(this.value);
  if (!isNaN(val) && val > 0) {
    document.getElementById('ingreso_anual').value = (val * 12).toFixed(0);
  }
});

// RFC a mayúsculas
document.getElementById('rfc').addEventListener('input', function () {
  this.value = this.value.toUpperCase();
});

// ────────────────────────────────────────────────
// Validaciones
// ────────────────────────────────────────────────
function validarRFC(rfc) {
  return /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i.test(rfc.trim());
}

function validarPaso1() {
  let ok = true;
  const nombre = document.getElementById('nombre').value.trim();
  const tel = document.getElementById('telefono').value.trim();
  const dir = document.getElementById('direccion').value.trim();
  const rfc = document.getElementById('rfc').value.trim();

  if (!nombre || nombre.length < 3) { mostrarError('nombre'); ok = false; } else limpiarError('nombre');
  if (!/^\d{10}$/.test(tel)) { mostrarError('telefono'); ok = false; } else limpiarError('telefono');
  if (!dir || dir.length < 5) { mostrarError('direccion'); ok = false; } else limpiarError('direccion');
  if (!validarRFC(rfc)) { mostrarError('rfc', 'RFC con formato inválido (ej: PELJ800101ABC)'); ok = false; } else limpiarError('rfc');
  if (!state.productoSeleccionado) { mostrarError('producto', 'Selecciona un tipo de producto'); ok = false; } else limpiarError('producto');

  return ok;
}

function validarPaso2() {
  let ok = true;
  const ocupacion = document.getElementById('ocupacion').value;
  const ingreso = parseFloat(document.getElementById('ingreso_mensual').value);

  if (!ocupacion) { mostrarError('ocupacion'); ok = false; } else limpiarError('ocupacion');
  if (!ingreso || ingreso < 1000) { mostrarError('ingreso', 'Ingresa un monto válido (mínimo $1,000)'); ok = false; } else limpiarError('ingreso');

  return ok;
}

// ────────────────────────────────────────────────
// Navegación entre pasos
// ────────────────────────────────────────────────
function irPaso1() { setStep(1); }

function irPaso2() {
  if (validarPaso1()) {
    const grupoInfonavit = document.getElementById('grupo-infonavit');
    const esHipotecario = state.productoSeleccionado === 'hipotecario';
    if (grupoInfonavit) {
      grupoInfonavit.style.display = esHipotecario ? '' : 'none';
    }
    if (!esHipotecario) {
      const infonavitInput = document.getElementById('monto-infonavit');
      if (infonavitInput) infonavitInput.value = '';
    }
    setStep(2);
  }
}

async function irPaso3() {
  if (!validarPaso2()) return;

  const datos = recopilarDatos();
  showSpinner('Analizando tu perfil crediticio...');

  try {
    const res = await fetch('/api/evaluar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    const eval_ = await res.json();

    if (!res.ok) throw new Error(eval_.error || 'Error en la evaluación');

    state.evaluacion = { ...datos, ...eval_ };
    renderEvaluacion(eval_, datos.tipo_producto);
    setStep(3);
  } catch (err) {
    alert('Error al evaluar: ' + err.message);
  } finally {
    hideSpinner();
  }
}

// ────────────────────────────────────────────────
// Recopilar datos del formulario
// ────────────────────────────────────────────────
function recopilarDatos() {
  return {
    nombre: document.getElementById('nombre').value.trim(),
    telefono: document.getElementById('telefono').value.trim(),
    direccion: document.getElementById('direccion').value.trim(),
    rfc: document.getElementById('rfc').value.trim().toUpperCase(),
    tipo_producto: state.productoSeleccionado,
    ocupacion: document.getElementById('ocupacion').value,
    ingreso_mensual: parseFloat(document.getElementById('ingreso_mensual').value),
    ingreso_anual: parseFloat(document.getElementById('ingreso_anual').value) ||
                   parseFloat(document.getElementById('ingreso_mensual').value) * 12,
    monto_infonavit: Number(document.getElementById('monto-infonavit')?.value) || 0
  };
}

// ────────────────────────────────────────────────
// Renderizar evaluación
// ────────────────────────────────────────────────
function renderEvaluacion(ev, tipo) {
  const scoreColor = ev.score >= 750 ? '#0ee8a0' : ev.score >= 680 ? '#4d9eff' : ev.score >= 600 ? '#e8b84b' : '#ff3d5a';
  const esTarjeta = tipo === 'tarjeta_credito';
  const esHipotecario = tipo === 'hipotecario';

  let labelMonto, labelPlazo, labelPago;
  if (esHipotecario) {
    labelMonto = 'Monto Hipotecario Ofrecido';
    labelPlazo = 'Plazo del crédito';
    labelPago = 'Pago mensual estimado';
  } else if (esTarjeta) {
    labelMonto = 'Límite de Crédito Ofrecido';
    labelPlazo = 'Plazo de referencia';
    labelPago = 'Pago mínimo mensual (3%)';
  } else {
    labelMonto = 'Monto de Préstamo Ofrecido';
    labelPlazo = 'Plazo del préstamo';
    labelPago = 'Pago mensual estimado';
  }

  const html = `
    <div class="score-display">
      <div class="score-number" style="color:${scoreColor}">${ev.score}</div>
      <div class="score-label">Score de Crédito</div>
      <span class="score-badge" style="color:${scoreColor};background:${scoreColor}18;border-color:${scoreColor}44">${ev.clasificacion}</span>
    </div>

    <div class="eval-grid">
      <div class="eval-item highlight">
        <div class="eval-val">${fmt(ev.monto_ofrecido)}</div>
        <div class="eval-key">${labelMonto}</div>
      </div>

      <div class="eval-item">
        <div class="eval-val">${fmtPct(ev.tasa_interes)}</div>
        <div class="eval-key">Tasa de interés anual</div>
      </div>

      <div class="eval-item">
        <div class="eval-val">${ev.plazo_meses} meses</div>
        <div class="eval-key">${labelPlazo}</div>
      </div>

      <div class="eval-item">
        <div class="eval-val">${fmt(ev.pago_mensual)}</div>
        <div class="eval-key">${labelPago}</div>
      </div>

      <div class="eval-item">
        <div class="eval-val">${ev.rfc_valido ? '✅ Válido' : '⚠️ No estándar'}</div>
        <div class="eval-key">Validación de RFC</div>
      </div>
    </div>

    <div class="alert alert-info">
      📌 <span>Esta es una simulación de evaluación. Los montos y tasas reales pueden variar. Al aceptar, tu crédito quedará registrado en el sistema.</span>
    </div>

    <div class="btn-row">
      <button class="btn btn-secondary" onclick="irPaso2()">← Regresar</button>
      <button class="btn btn-danger" onclick="rechazarCredito()">✗ Rechazar oferta</button>
      <button class="btn btn-success" onclick="aceptarCredito()">✓ Aceptar y generar crédito</button>
    </div>
  `;

  document.getElementById('eval-body').innerHTML = html;
}

// ────────────────────────────────────────────────
// Aceptar / Rechazar
// ────────────────────────────────────────────────
function rechazarCredito() {
  if (confirm('¿Estás seguro de que deseas rechazar la oferta? Tendrás que iniciar una nueva solicitud.')) {
    location.reload();
  }
}

async function aceptarCredito() {
  const payload = { ...state.evaluacion };
  showSpinner('Generando tu crédito...');

  try {
    const res = await fetch('/api/solicitud', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Error al generar crédito');

    renderResultado(data);
    setStep(4);
  } catch (err) {
    alert('Error al procesar: ' + err.message);
  } finally {
    hideSpinner();
  }
}

// ────────────────────────────────────────────────
// Renderizar resultado final
// ────────────────────────────────────────────────
function renderResultado(data) {
  const esTarjeta = data.tipo_producto === 'tarjeta_credito';
  const esHipotecario = data.tipo_producto === 'hipotecario';

  let tipoLabel, montoLabel, pagoLabel, descripcion;
  if (esHipotecario) {
    tipoLabel = '🏠 Crédito Hipotecario';
    montoLabel = 'Monto aprobado';
    pagoLabel = 'Pago mensual';
    descripcion = 'crédito hipotecario';
  } else if (esTarjeta) {
    tipoLabel = '💎 Tarjeta de Crédito';
    montoLabel = 'Límite aprobado';
    pagoLabel = 'Pago mínimo mensual';
    descripcion = 'tarjeta de crédito';
  } else {
    tipoLabel = '💳 Préstamo Personal';
    montoLabel = 'Monto aprobado';
    pagoLabel = 'Pago mensual';
    descripcion = 'préstamo personal';
  }

  const html = `
    <div class="result-hero">
      <span class="result-icon">🎉</span>
      <h2>¡Felicidades, ${data.nombre.split(' ')[0]}!</h2>
      <p>Tu ${descripcion} ha sido autorizado exitosamente.</p>
    </div>

    <div class="result-folio">
      <div class="folio-num">${data.folio}</div>
      <small>Número de Folio de Solicitud</small>
    </div>

    <ul class="detail-list">
      <li><span class="key">Tipo de producto</span><span class="val">${tipoLabel}</span></li>
      <li><span class="key">${montoLabel}</span><span class="val" style="color:var(--success);font-size:1.1rem">${fmt(data.monto_aprobado)}</span></li>
      <li><span class="key">Tasa de interés anual</span><span class="val">${fmtPct(data.tasa_interes)}</span></li>
      <li><span class="key">Plazo</span><span class="val">${data.plazo_meses} meses</span></li>
      <li><span class="key">${pagoLabel}</span><span class="val">${fmt(data.pago_mensual)}</span></li>
      <li><span class="key">Fecha de inicio</span><span class="val">${fmtFecha(data.fecha_aprobacion)}</span></li>
      <li><span class="key">Fecha de vencimiento</span><span class="val">${fmtFecha(data.fecha_vencimiento)}</span></li>
      <li><span class="key">Folio del crédito</span><span class="val">${data.folio_credito}</span></li>
    </ul>

    <div class="alert alert-success" style="margin-top:20px">
      ✅ <span>Tu crédito ha sido registrado. Guarda tu folio <strong>${data.folio}</strong> para cualquier consulta.</span>
    </div>

    <div class="btn-row">
      <button class="btn btn-secondary" onclick="location.href='/admin'">Ver Panel Admin</button>
      <button class="btn btn-primary" onclick="location.reload()">+ Nueva Solicitud</button>
    </div>
  `;

  document.getElementById('result-body').innerHTML = html;
}
