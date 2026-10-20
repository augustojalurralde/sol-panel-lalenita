// lib/pedidosyaLeer.ts — LECTORES DEL PORTAL DE PEDIDOSYA
// Convierten el texto que se copia de cada pantalla del portal (o de los PDF de liquidación)
// en números ordenados. No usan la base de datos: se pueden probar solos.

/** "$ -4.087.626,54" · "22.022,6" · "ARS 1.234,56" · "52min" no → número (o null si no es un número) */
export function numeroAR(texto: string): number | null {
  const limpio = texto.replace(/[  ]/g, " ").replace(/ARS|\$/g, "").trim();
  if (!/^-?[\d.]+(,\d+)?$/.test(limpio)) return null;
  return Number(limpio.replace(/\./g, "").replace(",", "."));
}

/** "05/10/2026" → "2026-10-05" */
export function fechaISO(ddmmaaaa: string): string {
  const [d, m, a] = ddmmaaaa.split("/");
  return `${a}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

export const normal = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

const lineas = (texto: string) =>
  texto.replace(/[  ]/g, " ").split("\n").map((l) => l.trim()).filter(Boolean);

// ─── LIQUIDACIÓN SEMANAL ─────────────────────────────────────────────────────
export interface Liquidacion {
  desde: string; hasta: string; fecha_pago: string | null; cuenta: string | null;
  ventas: number | null; ventas_app: number | null; ventas_fuera: number | null;
  servicio: number | null;
  cargos_operativos: number | null; cargo_pos: number | null; cargo_plus: number | null;
  cargo_reclamos: number | null; cargo_cancelaciones: number | null;
  publicidad: number | null; gold_vip: number | null; keywords: number | null;
  reintegros: number | null; reintegro_desc_peya: number | null; reintegro_desc_comercial: number | null;
  reintegro_retiro: number | null; reintegro_cancelaciones: number | null;
  ajustes: number | null;
  impuestos: number | null; iva_comisiones: number | null; percepcion_iva: number | null;
  percepcion_caba: number | null; retencion_caba: number | null;
  ingresos: number | null; subtotal: number | null; credito: number | null; total: number | null;
  detalle: Record<string, number>;
}

// Cada campo con los nombres con que aparece (en el portal o en el PDF). Se compara sin acentos ni mayúsculas.
const CAMPOS_LIQUIDACION: [keyof Liquidacion, (n: string) => boolean][] = [
  ["ventas", (n) => n === "ventas" || n === "ventas netas"],
  ["ventas_app", (n) => n.startsWith("ventas con pago en la aplicacion") || n.startsWith("ventas netas con pago en la aplicacion")],
  ["ventas_fuera", (n) => n === "ventas con pago por fuera de la aplicacion" || n === "ventas netas con pago por fuera de la aplicacion"],
  ["servicio", (n) => n.startsWith("servicio por ventas en pedidosya")],
  ["cargos_operativos", (n) => n === "cargos operativos"],
  ["cargo_pos", (n) => n.startsWith("cargos por uso del pos")],
  ["cargo_plus", (n) => n.startsWith("cargos por pedidos con plus")],
  ["cargo_reclamos", (n) => n.startsWith("cargos por reclamos de")],
  ["cargo_cancelaciones", (n) => n.startsWith("cargos por cancelar o rechazar")],
  ["publicidad", (n) => n === "publicidad dentro de la aplicacion"],
  ["gold_vip", (n) => n.startsWith("campana gold vip")],
  ["keywords", (n) => n.startsWith("campana keywords")],
  ["reintegros", (n) => n === "reintegros"],
  ["reintegro_desc_peya", (n) => n.startsWith("descuento neto otorgado peya")],
  ["reintegro_desc_comercial", (n) => n.startsWith("descuento comercial neto otorgado por pedidosya")],
  ["reintegro_retiro", (n) => n.startsWith("descuentos comerciales retiro")],
  ["reintegro_cancelaciones", (n) => n.startsWith("reintegro por pedidos que cancelaron")],
  ["ajustes", (n) => n === "ajustes de liquidacion"],
  ["impuestos", (n) => n === "impuestos" || n === "impuestos y retenciones"],
  ["iva_comisiones", (n) => n.startsWith("impuesto en comisiones")],
  ["percepcion_iva", (n) => n.startsWith("percepcion iva") || n.startsWith("percepcion de iva")],
  ["percepcion_caba", (n) => n.startsWith("percepciones caba")],
  ["retencion_caba", (n) => n.startsWith("retenciones fiscales")],
  ["ingresos", (n) => n.startsWith("ingresos por ventas en pedidosya")],
  ["subtotal", (n) => n === "subtotal"],
  ["credito", (n) => n === "total credito pedidosya"],
  ["total", (n) => n.startsWith("total liquidado")],
];

/** Lee el "Detalle de liquidación" del portal (o el texto del PDF del estado de cuenta). */
export function leerLiquidacion(texto: string): Liquidacion {
  const ls = lineas(texto);
  const pares: [string, number][] = [];
  for (let i = 0; i < ls.length; i++) {
    // PDF: "Campaña gold vip      ARS -950.516,19" (todo en una línea)
    const enLinea = ls[i].match(/^(.*?\D)\s+(?:ARS|\$)\s*(-?[\d.]+,\d{2})$/);
    if (enLinea && !/^\$/.test(ls[i])) { pares.push([enLinea[1].trim(), numeroAR(enLinea[2])!]); continue; }
    // Portal: el nombre en una línea y "$ -950.516,19" en la siguiente
    const sig = ls[i + 1];
    if (sig && /^\$\s*-?[\d.]+(,\d+)?$/.test(sig) && !/^\$/.test(ls[i])) {
      pares.push([ls[i], numeroAR(sig)!]);
      i++;
    }
  }
  const detalle: Record<string, number> = {};
  for (const [nombre, valor] of pares) detalle[nombre] = valor;

  const periodo = texto.match(/Per[ií]odo(?: liquidado)?:?\s*(?:del\s*)?(\d{2}\/\d{2}\/\d{4})\s*al\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (!periodo) throw new Error("No encontré el período de la liquidación (Período: dd/mm/aaaa al dd/mm/aaaa)");
  const pago = texto.match(/(?:El d[ií]a|d[ií]a)\s*(\d{2}[./]\d{2}[./]\d{4})\s*procesa/i);
  const cuenta = texto.match(/terminada\s+en\s+(\d{4})/i);

  const liq = {
    desde: fechaISO(periodo[1]), hasta: fechaISO(periodo[2]),
    fecha_pago: pago ? fechaISO(pago[1].replace(/\./g, "/")) : null,
    cuenta: cuenta ? cuenta[1] : null,
    detalle,
  } as Liquidacion;
  for (const [campo] of CAMPOS_LIQUIDACION) (liq as unknown as Record<string, unknown>)[campo] = null;
  // Recorre en orden: si un nombre aparece dos veces (resumen y detalle) queda el último, que es igual
  for (const [nombre, valor] of pares) {
    const n = normal(nombre);
    const campo = CAMPOS_LIQUIDACION.find(([, es]) => es(n));
    if (campo) (liq as unknown as Record<string, unknown>)[campo[0]] = valor;
  }
  // "Total" a secas (resumen del portal) si no vino "Total liquidado del…"
  if (liq.total === null) {
    const t = pares.find(([n]) => normal(n) === "total");
    if (t) liq.total = t[1];
  }
  return liq;
}

// ─── REPORTES DEL PORTAL (Ventas y Operaciones) ─────────────────────────────
const esFlecha = (l: string) => /^(arrow_upward|arrow_downward|trending_flat|trending_up|trending_down)$/.test(l);
const esLocal = (l: string) => /^(La Leñita|San Guchero|Tocka)/i.test(l);

/** Separa el reporte en bloques: { local, valores } (sin dirección, flechas ni variaciones) */
function bloquesPorLocal(texto: string): { local: string; valores: string[] }[] {
  const ls = lineas(texto);
  const fin = ls.findIndex((l) => /^Filas por p[aá]gina/i.test(l));
  const util = fin >= 0 ? ls.slice(0, fin) : ls;
  const bloques: { local: string; valores: string[] }[] = [];
  for (let i = 0; i < util.length; i++) {
    const l = util[i];
    if (esLocal(l)) {
      bloques.push({ local: l, valores: [] });
      // La línea siguiente es la dirección
      if (util[i + 1] && !esFlecha(util[i + 1]) && /,/.test(util[i + 1])) i++;
      continue;
    }
    const b = bloques[bloques.length - 1];
    if (!b) continue;
    if (esFlecha(l)) { i++; continue; } // la flecha y el % de variación que le sigue
    b.valores.push(l);
  }
  return bloques;
}

export interface VentaReporte { local: string; ventas: number | null; pedidos: number | null; ticket: number | null }

/** Reportes > Ventas (vista Listas): ventas totales, pedidos y ticket promedio por local */
export function leerReporteVentas(texto: string): VentaReporte[] {
  return bloquesPorLocal(texto).map(({ local, valores }) => ({
    local,
    ventas: valores[0] ? numeroAR(valores[0]) : null,
    pedidos: valores[1] ? numeroAR(valores[1]) : null,
    ticket: valores[2] ? numeroAR(valores[2]) : null,
  }));
}

/** "1h 59min" · "52min" · "0min" · "2h" → minutos */
export function minutos(texto: string): number | null {
  const t = texto.replace(/\s+/g, "");
  const m = t.match(/^(?:(\d+)h)?(?:(\d+)min)?$/);
  if (!m || (!m[1] && !m[2])) return null;
  return Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0);
}
const pct = (texto: string | undefined) => (texto ? numeroAR(texto.replace("%", "").trim()) : null);

export interface OperacionReporte {
  local: string; minutos_no_disponible: number | null; cancelaciones_evitables_pct: number | null;
  espera_evitable_pct: number | null; preparacion_min: number | null; reclamos_pct: number | null; listos_pct: number | null;
}

/** Reportes > Operaciones: hora no disponible, cancelaciones y espera evitables, preparación, reclamos, listos */
export function leerReporteOperaciones(texto: string): OperacionReporte[] {
  return bloquesPorLocal(texto).map(({ local, valores: v }) => ({
    local,
    minutos_no_disponible: v[0] ? minutos(v[0]) : null,
    cancelaciones_evitables_pct: pct(v[1]),
    espera_evitable_pct: pct(v[2]),
    preparacion_min: v[3] ? minutos(v[3]) : null,
    reclamos_pct: pct(v[4]),
    listos_pct: pct(v[5]),
  }));
}

// ─── PEDIDOS (Pedidos > lista del día) ───────────────────────────────────────
export interface PedidoPortal {
  nro: string; tags: string[]; hora?: string; local: string; monto: number; extra: string[];
}

/** Resume los pedidos de un día por local, y separa los que tuvieron problemas */
export function resumirPedidosDia(fecha: string, pedidos: PedidoPortal[]) {
  const porLocal = new Map<string, { pedidos: number; cancelados: number; bruto: number }>();
  const problemas: {
    nro: string; local: string; fecha: string; hora: string | null; estado: string; entrega: string | null;
    problema: string | null; con_cargo: boolean; monto: number;
  }[] = [];
  for (const p of pedidos) {
    const tags = p.tags.map((t) => t.toUpperCase());
    const estado = tags.find((t) => /REALIZAD|CANCELAD|RECHAZAD|ENTREGAD/.test(t)) ?? "SIN ESTADO";
    const cancelado = /CANCELAD|RECHAZAD/.test(estado);
    const r = porLocal.get(p.local) ?? { pedidos: 0, cancelados: 0, bruto: 0 };
    if (cancelado) r.cancelados++;
    else { r.pedidos++; r.bruto += p.monto; }
    porLocal.set(p.local, r);
    const extra = p.extra.map((e) => e.toUpperCase());
    const problema = extra.filter((e) => e !== "CARGO").join(" · ") || null;
    const con_cargo = extra.includes("CARGO");
    if (cancelado || problema || con_cargo) {
      problemas.push({
        nro: p.nro, local: p.local, fecha, hora: p.hora ?? null, estado,
        entrega: tags.some((t) => t.includes("RETIRO")) ? "Retiro en el local" : null,
        problema, con_cargo, monto: p.monto,
      });
    }
  }
  return {
    dias: [...porLocal.entries()].map(([local, r]) => ({ fecha, local, ...r, bruto: Math.round(r.bruto * 100) / 100 })),
    problemas,
  };
}

/** Lunes de la semana de una fecha "aaaa-mm-dd" */
export function lunesDe(fecha: string): string {
  const d = new Date(fecha + "T12:00:00Z");
  const dia = d.getUTCDay(); // 0 domingo
  d.setUTCDate(d.getUTCDate() - ((dia + 6) % 7));
  return d.toISOString().slice(0, 10);
}
