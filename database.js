/**
 * Capa de persistencia usando un archivo JSON local.
 * No requiere compilación nativa — funciona en cualquier entorno Node.js.
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'creditos.json');

// Estructura inicial de la "base de datos"
const INITIAL = { solicitudes: [], creditos: [] };

// ── Leer BD ─────────────────────────────────────
function readDB() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      fs.writeFileSync(DB_PATH, JSON.stringify(INITIAL, null, 2), 'utf8');
      return JSON.parse(JSON.stringify(INITIAL));
    }
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    return JSON.parse(JSON.stringify(INITIAL));
  }
}

// ── Escribir BD ──────────────────────────────────
function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// ── API pública ──────────────────────────────────
module.exports = {
  insertSolicitud(row) {
    const db = readDB();
    db.solicitudes.push(row);
    writeDB(db);
  },

  insertCredito(row) {
    const db = readDB();
    db.creditos.push(row);
    writeDB(db);
  },

  getAllSolicitudes() {
    const db = readDB();
    // Enriquecer con datos del crédito correspondiente
    return db.solicitudes
      .map(s => {
        const c = db.creditos.find(c => c.solicitud_id === s.id) || {};
        return { ...s, folio_credito: c.folio_credito, fecha_vencimiento: c.fecha_vencimiento };
      })
      .sort((a, b) => new Date(b.fecha_solicitud) - new Date(a.fecha_solicitud));
  },

  getStats() {
    const db = readDB();
    const solicitudes = db.solicitudes;
    const aprobados = solicitudes.filter(s => s.estado === 'aprobado');
    const monto_total = aprobados.reduce((sum, s) => sum + s.monto_ofrecido, 0);

    const por_tipo = ['prestamo_personal', 'tarjeta_credito'].map(tipo => ({
      tipo_producto: tipo,
      cantidad: solicitudes.filter(s => s.tipo_producto === tipo).length
    }));

    return {
      total_solicitudes: solicitudes.length,
      aprobados: aprobados.length,
      monto_total,
      por_tipo
    };
  }
};
