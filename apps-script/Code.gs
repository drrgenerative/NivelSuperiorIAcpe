/**
 * Backend del formulario de seguimiento · Formación de formadores en IA
 * (CPE · Fundación Shaia · TPA).
 *
 * Se pega en Extensiones > Apps Script de la hoja de cálculo de respuestas.
 * Pasos completos de instalación en README.md.
 *
 * Contraseña del panel: Configuración del proyecto > Propiedades de la
 * secuencia de comandos > ADMIN_PASSWORD.
 *
 * Las columnas las define el formulario (assets/js/preguntas.js): en cada envío
 * llega la lista `_orden` y aquí se agregan a la hoja las que aún no existan.
 * Por eso cambiar preguntas NO requiere modificar este archivo.
 */

const HOJA = 'Respuestas';
const FIJAS = ['fecha', 'nombre', 'cedula'];
const MAX_COLUMNAS = 200;
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

  const nombre = String(p.nombre || '').trim().slice(0, 120);
  const cedula = String(p.cedula || '').replace(/\D/g, '');
  if (!nombre || !/^\d{5,12}$/.test(cedula)) return { ok: false, error: 'invalido' };

  const orden = String(p._orden || '').split(',')
    .map(function (c) { return c.trim(); })
    .filter(function (c) { return /^[a-z0-9_]{1,64}$/.test(c); })
    .slice(0, MAX_COLUMNAS);

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const hoja = hoja_();
    let cabecera = cabecera_(hoja);

    // Columnas que aún no existen (incluidas las fijas, por si la hoja es de una versión anterior).
    const nuevas = FIJAS.concat(orden).filter(function (c, i, todas) {
      return todas.indexOf(c) === i && cabecera.indexOf(c) < 0;
    });
    if (nuevas.length && cabecera.length + nuevas.length <= MAX_COLUMNAS) {
      hoja.getRange(1, cabecera.length + 1, 1, nuevas.length).setValues([nuevas]);
      estiloCabecera_(hoja);
      cabecera = cabecera.concat(nuevas);
    }

    const colCedula = cabecera.indexOf('cedula') + 1;
    const ultima = hoja.getLastRow();
    if (colCedula > 0 && ultima > 1) {
      const cedulas = hoja.getRange(2, colCedula, ultima - 1, 1).getValues();
      if (cedulas.some(function (r) { return String(r[0]).replace(/\D/g, '') === cedula; })) {
        return { ok: false, error: 'duplicado' };
      }
    }

    hoja.appendRow(cabecera.map(function (c) {
      if (c === 'fecha') return new Date();
      if (c === 'nombre') return textoSeguro_(nombre);
      if (c === 'cedula') return cedula;
      if (orden.indexOf(c) < 0) return '';
      const v = String(p[c] || '').trim().slice(0, LARGO_MAXIMO);
      return /^\d{1,9}$/.test(v) ? Number(v) : textoSeguro_(v);
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
    hoja.getRange(1, 1, 1, FIJAS.length).setValues([FIJAS]);
    estiloCabecera_(hoja);
    hoja.setFrozenRows(1);
    hoja.getRange('A:A').setNumberFormat('yyyy-mm-dd hh:mm');
    hoja.getRange('C:C').setNumberFormat('@'); // cédula como texto
  }
  return hoja;
}

function estiloCabecera_(hoja) {
  hoja.getRange(1, 1, 1, hoja.getLastColumn())
    .setFontWeight('bold').setBackground('#0C3545').setFontColor('#FFFFFF');
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
