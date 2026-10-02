/**
 * SOL · Envío de ventas de la PLANILLA ROMINA al panel
 * ─────────────────────────────────────────────────────
 * Se pega UNA vez en la planilla: Extensiones → Apps Script.
 * Lee las pestañas MOLINO NORTE, MOLINO SUR y TOCKA VENTAS y manda
 * la venta de cada día (por turno y forma de cobro) al panel SOL.
 * No cambia nada de la planilla. (Las ferias NO van por acá: se leen de sus propios sistemas.)
 *
 * Funciones para usar desde el menú de arriba (elegirla y tocar "Ejecutar"):
 *   instalar          → la primera vez: carga el historial y deja el envío automático
 *   enviarVentasSOL   → manda los últimos 60 días (es lo que corre solo cada 2 horas)
 *   enviarHistorial   → manda desde el 1/10/2025 (para cargar todo de nuevo)
 */

const SOL = {
  URL: 'https://sol-panel-lalenita.vercel.app/api/sync/planilla',
  CLAVE: 'PEGAR_ACA_LA_CLAVE',          // la misma que PLANILLA_SECRET en Vercel
  DIAS: 60,                             // días hacia atrás en cada envío automático
  HISTORIAL_DESDE: '2025-10-01',
};

/* Pestañas con bloques MAÑANA / NOCHE (encabezados en la fila 3: FECHA, VENTAS TT, PROV, GASTOS, MP/TC, EFECTIVO, DIF) */
const MOLINOS = [
  { pestana: 'MOLINO NORTE', unidad: 'Molino Norte' },
  { pestana: 'MOLINO SUR', unidad: 'Molino Sur' },
];

/* Tocka: solo noche. Columna A = fecha. Encabezados en las filas 2-3. */
const TOCKA = { pestana: 'TOCKA VENTAS', unidad: 'Tocka' };

/* Ferias: una fila por día y lugar */
const FERIAS = {
  pestana: 'FERIAS',
  encabezados: ['FECHA', 'LUGAR', 'VENTA TT', 'MERCADO PAGO', 'BANCO', 'EFECTIVO', 'OBSERVACIONES'],
  lugares: ['Palermo / La Rural', 'Hipódromo de Palermo'],
};

/* ───────────── Lo que se ejecuta ───────────── */

function instalar() {
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'enviarVentasSOL'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('enviarVentasSOL').timeBased().everyHours(2).create();
  enviarHistorial();
}

function enviarVentasSOL() {
  const hasta = hoy_();
  enviar_(sumarDias_(hasta, -SOL.DIAS), hasta);
}

function enviarHistorial() {
  enviar_(SOL.HISTORIAL_DESDE, hoy_());
}

/* ───────────── Envío ───────────── */

function enviar_(desde, hasta) {
  const ss = SpreadsheetApp.getActive();
  const zona = ss.getSpreadsheetTimeZone();
  var filas = [];
  const avisos = [];

  MOLINOS.forEach(function (m) {
    try { filas = filas.concat(leerMolino_(ss, m, zona, desde, hasta)); }
    catch (e) { avisos.push(m.pestana + ': ' + e.message); }
  });
  try { filas = filas.concat(leerTocka_(ss, zona, desde, hasta)); }
  catch (e) { avisos.push(TOCKA.pestana + ': ' + e.message); }
  try { filas = filas.concat(leerFerias_(ss, zona, desde, hasta)); }
  catch (e) { avisos.push(FERIAS.pestana + ': ' + e.message); }

  const resp = UrlFetchApp.fetch(SOL.URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + SOL.CLAVE },
    payload: JSON.stringify({ desde: desde, hasta: hasta, filas: filas }),
    muteHttpExceptions: true,
  });
  const texto = resp.getContentText();
  console.log('Envío ' + desde + ' a ' + hasta + ': ' + filas.length + ' filas → ' + resp.getResponseCode() + ' ' + texto);
  if (avisos.length) console.warn('Avisos: ' + avisos.join(' | '));
  if (resp.getResponseCode() !== 200) throw new Error('El panel respondió ' + resp.getResponseCode() + ': ' + texto);
  if (avisos.length) throw new Error('Se envió, pero con avisos: ' + avisos.join(' | '));
}

/* ───────────── Lectura de cada pestaña ───────────── */

function leerMolino_(ss, m, zona, desde, hasta) {
  const hoja = ss.getSheetByName(m.pestana);
  if (!hoja) throw new Error('no existe la pestaña');
  const datos = hoja.getDataRange().getValues();
  const etiquetas = datos[1] || [];   // fila 2: MAÑANA / NOCHE / (total)
  const titulos = datos[2] || [];     // fila 3: FECHA, VENTAS TT, ...
  const bloques = [];
  titulos.forEach(function (t, c) {
    if (norm_(t) !== 'FECHA') return;
    const et = norm_(etiquetas[c]);
    const turno = et.indexOf('MANANA') >= 0 || et.indexOf('MEDIODIA') >= 0 ? 'Mediodía' : et.indexOf('NOCHE') >= 0 ? 'Noche' : null;
    if (!turno) return; // el bloque de total no se manda (sería contar dos veces)
    const col = {};
    for (var k = c + 1; k < titulos.length && norm_(titulos[k]) !== 'FECHA'; k++) col[norm_(titulos[k])] = k;
    ['VENTAS TT', 'MP/TC', 'EFECTIVO'].forEach(function (n) {
      if (col[n] === undefined) throw new Error('no encuentro la columna "' + n + '" del turno ' + turno);
    });
    bloques.push({ turno: turno, fecha: c, col: col });
  });
  if (!bloques.length) throw new Error('no encuentro los bloques MAÑANA y NOCHE en la fila 2-3');

  const filas = [];
  for (var r = 3; r < datos.length; r++) {
    bloques.forEach(function (b) {
      const fecha = fecha_(datos[r][b.fecha], zona);
      if (!fecha || fecha < desde || fecha > hasta) return;
      const v = function (n) { return b.col[n] === undefined ? 0 : num_(datos[r][b.col[n]]); };
      filas.push({
        unidad: m.unidad, fecha: fecha, turno: b.turno,
        venta: v('VENTAS TT'), mp: v('MP/TC'), efectivo: v('EFECTIVO'),
        proveedores: v('PROV'), gastos: v('GASTOS'), dif: v('DIF'),
      });
    });
  }
  return filas;
}

function leerTocka_(ss, zona, desde, hasta) {
  const hoja = ss.getSheetByName(TOCKA.pestana);
  if (!hoja) throw new Error('no existe la pestaña');
  const datos = hoja.getDataRange().getValues();
  const col = {};
  for (var c = 1; c < (datos[2] || []).length; c++) {
    const t = norm_(datos[2][c]) || norm_(datos[1][c]); // títulos en fila 3, o en la 2 si la celda está combinada
    if (t && col[t] === undefined) col[t] = c;
  }
  ['VTA NOCHE', 'TR', 'QR', 'PED YA ONLINE', 'EFECT'].forEach(function (n) {
    if (col[n] === undefined) throw new Error('no encuentro la columna "' + n + '"');
  });
  const filas = [];
  for (var r = 3; r < datos.length; r++) {
    const fecha = fecha_(datos[r][0], zona);
    if (!fecha || fecha < desde || fecha > hasta) continue;
    const v = function (n) { return col[n] === undefined ? 0 : num_(datos[r][col[n]]); };
    filas.push({
      unidad: TOCKA.unidad, fecha: fecha, turno: 'Noche',
      venta: v('VTA NOCHE'), transferencia: v('TR'), mp: v('QR'), pedidos_ya: v('PED YA ONLINE'),
      efectivo: v('EFECT'), proveedores: v('PROVEED'), gastos: v('PERS') + v('MANT/DESC PYA'), dif: v('DIF'),
    });
  }
  return filas;
}

function leerFerias_(ss, zona, desde, hasta) {
  const hoja = ss.getSheetByName(FERIAS.pestana);
  if (!hoja) return [];
  const datos = hoja.getDataRange().getValues();
  const filas = [];
  for (var r = 1; r < datos.length; r++) {
    const fecha = fecha_(datos[r][0], zona);
    const lugar = String(datos[r][1] || '').trim();
    if (!fecha || !lugar || fecha < desde || fecha > hasta) continue;
    filas.push({
      unidad: lugar, fecha: fecha, turno: 'Día',
      venta: num_(datos[r][2]), mp: num_(datos[r][3]), banco: num_(datos[r][4]), efectivo: num_(datos[r][5]),
    });
  }
  return filas;
}

function crearPestanaFerias_() {
  const ss = SpreadsheetApp.getActive();
  if (ss.getSheetByName(FERIAS.pestana)) return;
  const hoja = ss.insertSheet(FERIAS.pestana);
  hoja.getRange(1, 1, 1, FERIAS.encabezados.length).setValues([FERIAS.encabezados]).setFontWeight('bold').setBackground('#f4cccc');
  hoja.setFrozenRows(1);
  hoja.getRange('A2:A1000').setNumberFormat('d-mmm-yyyy');
  hoja.getRange('C2:F1000').setNumberFormat('#,##0');
  hoja.getRange('B2:B1000').setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(FERIAS.lugares, true).setAllowInvalid(false).build());
  hoja.setColumnWidths(1, 7, 140);
}

/* ───────────── Ayudas ───────────── */

function norm_(x) {
  return String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
}

function num_(x) {
  if (typeof x === 'number') return x;
  const s = String(x || '').replace(/[$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return isFinite(n) ? n : 0;
}

const MESES_ = { ENE: 1, FEB: 2, MAR: 3, ABR: 4, MAY: 5, JUN: 6, JUL: 7, AGO: 8, SEP: 9, SET: 9, OCT: 10, NOV: 11, DIC: 12 };

/** Una celda de fecha → 'aaaa-mm-dd'. Acepta fechas reales o textos como "9-sep" (año: el más reciente que no sea futuro). */
function fecha_(x, zona) {
  if (x instanceof Date && !isNaN(x)) return Utilities.formatDate(x, zona, 'yyyy-MM-dd');
  const m = norm_(x).match(/^(\d{1,2})[-\/ ]([A-Z]{3})/);
  if (!m || !MESES_[m[2]]) return null;
  const h = hoy_();
  var anio = Number(h.slice(0, 4));
  var f = anio + '-' + pad_(MESES_[m[2]]) + '-' + pad_(Number(m[1]));
  if (f > sumarDias_(h, 1)) f = (anio - 1) + f.slice(4);
  return f;
}

function hoy_() {
  return Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd');
}

function sumarDias_(f, n) {
  const d = new Date(f + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function pad_(n) { return (n < 10 ? '0' : '') + n; }
