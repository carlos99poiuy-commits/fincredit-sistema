const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Utilidades de evaluación ────────────────────────────────────────────────

function validarRFC(rfc) {
  return /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i.test(rfc.trim());
}

function generarScore(ingreso, rfc_valido) {
  let score = 550;

  if (ingreso >= 100000) score += 150;
  else if (ingreso >= 50000) score += 120;
  else if (ingreso >= 30000) score += 90;
  else if (ingreso >= 15000) score += 60;
  else if (ingreso >= 8000) score += 30;
  else score += 10;

  if (rfc_valido) score += 50;

  // Variación aleatoria realista (±50)
  score += Math.floor(Math.random() * 100) - 50;

  return Math.max(400, Math.min(850, score));
}

function calcularOferta(score, ingreso_mensual, tipo_producto) {
  let multiplicador, tasa_base, plazo;

  if (tipo_producto === 'prestamo_personal') {
    plazo = 60;
    if      (score >= 750) { multiplicador = 8;   tasa_base = 0.18; }
    else if (score >= 680) { multiplicador = 6;   tasa_base = 0.24; }
    else if (score >= 600) { multiplicador = 4;   tasa_base = 0.32; }
    else if (score >= 500) { multiplicador = 2.5; tasa_base = 0.42; }
    else                   { multiplicador = 1.5; tasa_base = 0.55; }
  } else {
    plazo = 12;
    if      (score >= 750) { multiplicador = 4;   tasa_base = 0.28; }
    else if (score >= 680) { multiplicador = 3;   tasa_base = 0.36; }
    else if (score >= 600) { multiplicador = 2;   tasa_base = 0.45; }
    else if (score >= 500) { multiplicador = 1.2; tasa_base = 0.55; }
    else                   { multiplicador = 0.8; tasa_base = 0.65; }
  }

  const monto = Math.round(ingreso_mensual * multiplicador * 100) / 100;
  const tasa_mensual = tasa_base / 12;

  let pago_mensual;
  if (tipo_producto === 'prestamo_personal') {
    pago_mensual = Math.round(
      (monto * tasa_mensual) / (1 - Math.pow(1 + tasa_mensual, -plazo)) * 100
    ) / 100;
  } else {
    pago_mensual = Math.round(monto * 0.03 * 100) / 100; // 3% pago mínimo
  }

  return { monto, tasa: tasa_base, plazo, pago_mensual };
}

function generarFolio() {
  const d = new Date();
  const anio = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const aleatorio = Math.floor(Math.random() * 90000) + 10000;
  return `CRED-${anio}${mes}-${aleatorio}`;
}

function scoreClasificacion(score) {
  if (score >= 750) return 'Excelente';
  if (score >= 680) return 'Bueno';
  if (score >= 600) return 'Regular';
  if (score >= 500) return 'Bajo';
  return 'Muy Bajo';
}

// ─── Rutas API ───────────────────────────────────────────────────────────────

// Evaluar crédito (simulación, sin persistir)
app.post('/api/evaluar', (req, res) => {
  try {
    const { nombre, telefono, direccion, rfc, tipo_producto, ingreso_mensual } = req.body;

    if (!nombre || !telefono || !direccion || !rfc || !tipo_producto || !ingreso_mensual) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }

    const rfc_valido  = validarRFC(rfc);
    const score       = generarScore(parseFloat(ingreso_mensual), rfc_valido);
    const oferta      = calcularOferta(score, parseFloat(ingreso_mensual), tipo_producto);

    res.json({
      score,
      rfc_valido,
      monto_ofrecido: oferta.monto,
      tasa_interes:   oferta.tasa,
      plazo_meses:    oferta.plazo,
      pago_mensual:   oferta.pago_mensual,
      clasificacion:  scoreClasificacion(score)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Guardar solicitud y generar crédito
app.post('/api/solicitud', (req, res) => {
  try {
    const {
      nombre, telefono, direccion, rfc, tipo_producto,
      ingreso_mensual, ingreso_anual, ocupacion,
      score_credito, monto_ofrecido, tasa_interes, plazo_meses, pago_mensual
    } = req.body;

    const solicitudId = uuidv4();
    const creditoId   = uuidv4();
    const folio        = generarFolio();
    const folio_credito = `CR-${folio}`;
    const ahora        = new Date().toISOString();

    const fechaVenc = new Date();
    fechaVenc.setMonth(fechaVenc.getMonth() + parseInt(plazo_meses));

    const solicitud = {
      id: solicitudId,
      nombre, telefono, direccion, rfc, tipo_producto,
      ingreso_mensual:  parseFloat(ingreso_mensual),
      ingreso_anual:    parseFloat(ingreso_anual || ingreso_mensual * 12),
      ocupacion,
      score_credito:    parseInt(score_credito),
      monto_ofrecido:   parseFloat(monto_ofrecido),
      tasa_interes:     parseFloat(tasa_interes),
      plazo_meses:      parseInt(plazo_meses),
      pago_mensual:     parseFloat(pago_mensual),
      estado:           'aprobado',
      fecha_solicitud:  ahora,
      fecha_aprobacion: ahora,
      folio
    };

    const credito = {
      id:               creditoId,
      solicitud_id:     solicitudId,
      folio_credito,
      monto_aprobado:   parseFloat(monto_ofrecido),
      tasa_interes:     parseFloat(tasa_interes),
      plazo_meses:      parseInt(plazo_meses),
      pago_mensual:     parseFloat(pago_mensual),
      fecha_inicio:     ahora,
      fecha_vencimiento: fechaVenc.toISOString(),
      estado:           'activo'
    };

    db.insertSolicitud(solicitud);
    db.insertCredito(credito);

    res.json({
      success:          true,
      solicitud_id:     solicitudId,
      credito_id:       creditoId,
      folio,
      folio_credito,
      nombre,
      tipo_producto,
      monto_aprobado:   parseFloat(monto_ofrecido),
      tasa_interes:     parseFloat(tasa_interes),
      plazo_meses:      parseInt(plazo_meses),
      pago_mensual:     parseFloat(pago_mensual),
      fecha_aprobacion: ahora,
      fecha_vencimiento: fechaVenc.toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener todas las solicitudes (admin)
app.get('/api/admin/solicitudes', (req, res) => {
  try {
    res.json(db.getAllSolicitudes());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Estadísticas admin
app.get('/api/admin/stats', (req, res) => {
  try {
    res.json(db.getStats());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, () => {
  console.log(`\n✅ Sistema de Crédito en http://localhost:${PORT}`);
  console.log(`📊 Panel Admin en    http://localhost:${PORT}/admin\n`);
});
