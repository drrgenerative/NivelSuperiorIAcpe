/**
 * Backend del formulario de seguimiento · Formación de formadores en IA
 * (CPE · Fundación Shaia · TPA).
 *
 * Se pega en Extensiones > Apps Script de la hoja de cálculo de respuestas.
 * Pasos completos de instalación en README.md.
 *
 * Contraseña del panel: Configuración del proyecto > Propiedades de la
 * secuencia de comandos > ADMIN_PASSWORD.
 */

const HOJA = 'Respuestas';

// El orden solo importa al crear la hoja; después se lee por nombre de columna.
const COLUMNAS = [
  'fecha', 'nombre', 'correo', 'departamento', 'transferencia',
  'contenidos_cpe', 'contenido_cpe_otro', 'practicas_avanzadas',
  'personas_basico', 'personas_intermedio', 'personas_avanzado',
  'trabajo_estudiantes', 'trabajo_estudiantes_otro', 'estudiantes_alcanzados',
  'barreras', 'apoyo'
];
const REQUERIDOS = [
  'nombre', 'correo', 'departamento', 'transferencia', 'contenidos_cpe',
  'practicas_avanzadas', 'personas_basico', 'personas_intermedio',
  'personas_avanzado', 'trabajo_estudiantes', 'estudiantes_alcanzados',
  'barreras', 'apoyo'
];
const NUMERICOS = [
  'transferencia', 'personas_basico', 'personas_intermedio',
  'personas_avanzado', 'estudiantes_alcanzados'
];
const LARGO_MAXIMO = 1000;

// Bloqueo del panel tras intentos fallidos de contraseña.
const MAX_FALLOS = 10;
const VENTANA_FALLOS_SEG = 15 * 60;

function doGet() {
  return responder_({ ok: true, servicio: 'seguimiento-cpe' });
}

function doPost(e) {
  try {
    const p = (e && e.parameter) || {};
    if (p.accion === 'respuestas') return responder_(listar_(p));
    if (p.tipo === 'seguimiento') return responder_(guardar_(p));
    return responder_({ ok: false, error: 'accion_invalida' });
  } catch (err) {
    console.error(err);
    return responder_({ ok: false, error: 'servidor' });
  }
}

/** Ejecutar una vez desde el editor: crea la hoja y pide los permisos. */
function configurarHoja() {
  hoja_();
  const clave = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  console.log(clave
    ? 'Hoja lista. La contraseña del panel está configurada.'
    : 'Hoja lista. FALTA crear la propiedad ADMIN_PASSWORD en Configuración del proyecto.');
}

function guardar_(p) {
  if (p.sitio_web) return { ok: true }; // campo trampa: solo lo llenan bots

  const fila = {};
  COLUMNAS.forEach(function (c) {
    fila[c] = String(p[c] || '').trim().slice(0, LARGO_MAXIMO);
  });
  fila.correo = fila.correo.toLowerCase();

  const incompleto = REQUERIDOS.some(function (c) { return fila[c] === ''; });
  const numeroInvalido = NUMERICOS.some(function (c) { return !/^\d+$/.test(fila[c]); });
  const correoInvalido = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fila.correo);
  if (incompleto || numeroInvalido || correoInvalido) return { ok: false, error: 'invalido' };

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const hoja = hoja_();
    const cabecera = cabecera_(hoja);
    const colCorreo = cabecera.indexOf('correo') + 1;
    const ultima = hoja.getLastRow();
    if (colCorreo > 0 && ultima > 1) {
      const correos = hoja.getRange(2, colCorreo, ultima - 1, 1).getValues();
      const repetido = correos.some(function (r) {
        return String(r[0]).trim().toLowerCase() === fila.correo;
      });
      if (repetido) return { ok: false, error: 'duplicado' };
    }

    fila.fecha = new Date();
    hoja.appendRow(cabecera.map(function (c) {
      if (c === 'fecha') return fila.fecha;
      if (NUMERICOS.indexOf(c) >= 0) return Number(fila[c]);
      return textoSeguro_(fila[c] || '');
    }));
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function listar_(p) {
  const cache = CacheService.getScriptCache();
  const fallos = Number(cache.get('fallos') || 0);
  if (fallos >= MAX_FALLOS) return { ok: false, error: 'bloqueado' };

  const clave = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  if (!clave) return { ok: false, error: 'sin_clave' };
  if (String(p.clave || '') !== clave) {
    cache.put('fallos', String(fallos + 1), VENTANA_FALLOS_SEG);
    Utilities.sleep(700);
    return { ok: false, error: 'clave' };
  }

  const datos = hoja_().getDataRange().getValues();
  const cabecera = datos.shift().map(String);
  const filas = datos
    .filter(function (r) { return r.some(function (v) { return v !== ''; }); })
    .map(function (r) {
      const o = {};
      cabecera.forEach(function (c, i) {
        o[c] = r[i] instanceof Date ? r[i].toISOString() : r[i];
      });
      return o;
    });
  return { ok: true, filas: filas };
}

function hoja_() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = libro.getSheetByName(HOJA);
  if (!hoja) {
    hoja = libro.insertSheet(HOJA);
    hoja.getRange(1, 1, 1, COLUMNAS.length).setValues([COLUMNAS])
      .setFontWeight('bold').setBackground('#0C3545').setFontColor('#FFFFFF');
    hoja.setFrozenRows(1);
    hoja.getRange('A:A').setNumberFormat('yyyy-mm-dd hh:mm');
  }
  return hoja;
}

function cabecera_(hoja) {
  return hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0].map(String);
}

// Evita que un texto que empiece por =, +, - o @ se interprete como fórmula.
function textoSeguro_(v) {
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function responder_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
