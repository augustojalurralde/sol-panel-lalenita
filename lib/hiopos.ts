// lib/hiopos.ts — Lee las ventas de las ferias que usan HIOPOS / ICG Analytics (solo en el servidor)
// Hoy: La Rural de Palermo (establecimiento "LA LEÑITA" dentro de la cuenta de la feria).
// Usa el mismo acceso que la página argentina01.hiopos.com/icgfront/analytics.
// Usuario y contraseña vienen de variables secretas (HIOPOS_USER / HIOPOS_PASSWORD).
//
// IMPORTANTE: la cuenta de la feria ve las ventas de TODOS los puestos. Por eso cada consulta
// va SIEMPRE filtrada por nuestro establecimiento (si no, viene la venta de otros puestos).

import crypto from "node:crypto";

const SERVIDOR = "https://argentina01.hiopos.com/ErpCloud";
const CLIENTE = "51630"; // cuenta de HIOPOS de la feria (La Rural)
const FUENTES = "34,36,37,42,71,79,95,96,97,99,114,123,133,135,137,159,177,182,196,212,243,250,251,252,253,255,259,12031,14010,15032,16007,17016";

/* Datos de HIOPOS que se usan (números internos de su sistema de informes) */
const ORIGEN = { lineas: 250, mediosDePago: 253 };
const CAMPO = {
  fecha: 1664,          // fecha del comprobante
  hora: 1665,           // hora del comprobante (hh:mm:ss)
  horaEntera: 1077,     // hora (0-23), para los artículos
  comprobante: 3140,    // "F002501 / 9615" (las "Y" son devoluciones/anulaciones)
  medioPago: 124,       // EFECTIVO, CRÉDITO, DÉBITO, PAGO QR…
  codigoArticulo: 109,
  articulo: 2,
  familia: 1465,
  establecimiento: 1060,
};
const MEDIDA = { importePago: 1386, unidades: 1352, venta: 1353 };

/** HIOPOS pide los datos de acceso cifrados con una clave fija de su página (no es un secreto nuestro) */
function cifrar(texto: string): string {
  const k = Buffer.from("B1B2B3B4B5B6B7B8", "utf8");
  const c = crypto.createCipheriv("aes-128-cbc", k, k);
  const b64 = Buffer.concat([c.update(texto, "utf8"), c.final()]).toString("base64");
  return b64.replaceAll("+", "-666666-").replaceAll("/", "-999999-");
}

function hoyAR(): string {
  return new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
}

/** Inicia sesión y devuelve el token de la sesión */
export async function iniciarSesionHiopos(usuario: string, password: string): Promise<string> {
  const p = new URLSearchParams({
    user: cifrar(usuario), password: cifrar(password), customerId: CLIENTE, languageIsoCode: "es", specType: "2",
    ipWS: cifrar(""), portWS: cifrar(""), dbName: cifrar(""), workDate: `'${hoyAR().replaceAll("-", "/")}'`,
    datasourceList: FUENTES, marginCost: "false", isDocs: "false", isCloudDocs: "false", isAnalytics: "true",
    budget: "true", freeFields: "false", encrypted: "true",
  });
  const r = await fetch(`${SERVIDOR}/session/login?${p}`, { headers: { "Content-Type": "application/json" }, cache: "no-store" });
  const token = r.headers.get("x-auth-token");
  if (!r.ok || !token) {
    let msg = "";
    try { msg = ((await r.json()) as { message?: string }).message ?? ""; } catch {}
    throw new Error(`HIOPOS no dejó entrar (${r.status}${msg ? ": " + msg.trim() : ""}). ¿Usuario o contraseña incorrectos?`);
  }
  await prepararSesion(token);
  return token;
}

/** Después de entrar, la página de HIOPOS carga la configuración y el "diccionario" de informes.
 *  Sin esto, las consultas responden error 500, así que se hace lo mismo (si algo falla, se sigue igual). */
async function prepararSesion(token: string) {
  const h = { "Content-Type": "application/json", Accept: "application/json", "x-auth-token": token };
  const pedir = (ruta: string, cuerpo?: unknown) =>
    fetch(`${SERVIDOR}${ruta}`, { method: cuerpo === undefined ? "GET" : "POST", headers: h, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo), cache: "no-store" })
      .then((r) => r.arrayBuffer()).catch(() => null);
  await pedir("/report/isIcgUser/");
  await pedir("/report/checkRestorePoint");
  await pedir("/report/setSessionRegionalConfiguration", { decimalSeparator: ",", thousandSeparator: "." });
  await pedir("/report/getUser?mobileMode=false");
  await pedir("/entityLoader/company");
  for (const entidad of ["Dashboard", "DataSource", "Dimension", "Attribute", "Metric", "Filter"]) {
    await pedir(`/report/list/${entidad}`, { entity: entidad, specTypeId: 2 });
  }
  await pedir("/report/getSessionConstants", null);
}

/** Cierra la sesión (para no dejar sesiones abiertas en HIOPOS) */
export async function cerrarSesionHiopos(token: string) {
  try { await fetch(`${SERVIDOR}/session/logout`, { headers: { "x-auth-token": token }, cache: "no-store" }); } catch {}
}

type Celda = string | number | null;

/** Una consulta al motor de informes de HIOPOS. Devuelve las filas sin el número de renglón. */
async function consultar(token: string, tienda: number, origen: number, atributos: number[], medidas: number[], desde: string, hasta: string): Promise<Celda[][]> {
  let pos = 1;
  const columnas = [
    ...atributos.map((id) => ({ "@type": "BlockColumn", sourceType: "Attribute", attributeId: id, position: pos, internalId: pos++, shown: true, columnType: 1, specTypeId: 2 })),
    ...medidas.map((id) => ({ "@type": "BlockColumn", sourceType: "Metric", metricId: id, position: pos, internalId: pos++, shown: true, columnType: 1, type: "BigDecimal", totalType: "SUM", specTypeId: 2 })),
  ];
  const filtroTienda = {
    filterType: 2,
    filterBlocks: [{ logicOperator: 1, negation: false, filterGroups: [{ logicOperator: 1, negation: false, filterRows: [{
      "@type": "FilterRow", logicOperator: 2, negation: false, position: 0,
      filterConditions: [{
        attributeId: CAMPO.establecimiento, logicOperator: "EQUAL", arithmeticOperator: "EQUAL", type: "Integer", value: tienda,
        attribute: { "@type": "Attribute", id: CAMPO.establecimiento, dimensionId: 21, types: ["Integer"],
          attributeSources: [{ "@type": "AttributeSource", attributeId: CAMPO.establecimiento, viewId: 51, specTypeId: 2, fields: { "Shop.ShopId": "Integer" } }] },
      }],
    }] }] }],
  };
  const filas: Celda[][] = [];
  const PAGINA = 5000;
  for (let offset = 0; ; offset += PAGINA) {
    const cuerpo = {
      id: 1, offset, limit: PAGINA, totals: false, rest: false, ignoreDates: false, useDistinct: false,
      datasources: [{ id: origen }], columns: columnas,
      filters: [{ filterType: 1, dateValue: desde.replaceAll("-", "/"), dateValue2: hasta.replaceAll("-", "/"), filterBlocks: [] }, filtroTienda],
    };
    const r = await fetch(`${SERVIDOR}/report/query`, {
      method: "POST", cache: "no-store",
      headers: { "Content-Type": "application/json", Accept: "application/json", "x-auth-token": token },
      body: JSON.stringify(cuerpo),
    });
    const j = (await r.json().catch(() => ({}))) as { rows?: Celda[][]; message?: string };
    if (!r.ok || !Array.isArray(j.rows)) throw new Error(`HIOPOS respondió ${r.status}${j.message ? ": " + j.message.trim() : ""}`);
    // Sin datos, HIOPOS devuelve una sola fila vacía
    const pagina = j.rows.filter((x) => x[1] !== null).map((x) => x.slice(1));
    filas.push(...pagina);
    if (j.rows.length < PAGINA) return filas;
  }
}

export interface PagoTicketHiopos { fecha: string; hora: string; comprobante: string; medio: string; importe: number }
export interface ArticuloHiopos { fecha: string; hora: number; codigo: number; nombre: string; familia: string; unidades: number; venta: number }

/** Cada pago de cada comprobante (un comprobante pagado con dos medios trae dos renglones) */
export async function pagosPorTicket(token: string, tienda: number, desde: string, hasta: string): Promise<PagoTicketHiopos[]> {
  const filas = await consultar(token, tienda, ORIGEN.mediosDePago, [CAMPO.fecha, CAMPO.hora, CAMPO.comprobante, CAMPO.medioPago], [MEDIDA.importePago], desde, hasta);
  return filas.map(([fecha, hora, comprobante, medio, importe]) => ({
    fecha: String(fecha), hora: String(hora ?? ""), comprobante: String(comprobante), medio: String(medio || "Sin medio"), importe: Number(importe) || 0,
  }));
}

/** Artículos vendidos por día y hora */
export async function articulos(token: string, tienda: number, desde: string, hasta: string): Promise<ArticuloHiopos[]> {
  const filas = await consultar(token, tienda, ORIGEN.lineas, [CAMPO.fecha, CAMPO.horaEntera, CAMPO.codigoArticulo, CAMPO.articulo, CAMPO.familia], [MEDIDA.unidades, MEDIDA.venta], desde, hasta);
  return filas.map(([fecha, hora, codigo, nombre, familia, unidades, venta]) => ({
    fecha: String(fecha), hora: Number(hora) || 0, codigo: Number(codigo) || 0, nombre: String(nombre || "Sin nombre"),
    familia: String(familia || "Sin Rubro"), unidades: Number(unidades) || 0, venta: Number(venta) || 0,
  }));
}
