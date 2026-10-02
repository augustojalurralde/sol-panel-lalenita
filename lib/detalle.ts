// lib/detalle.ts — Detalle de ventas (tickets, formas de cobro, artículos) para las pantallas.
// Reglas (plan aprobado):
//  · Turnos (definidos por Augusto, 02/10/2026) — no existe "fuera de turno":
//      - Locales con Maxirest (Barrio Norte, Barrio Sur, Yerba Buena, Recoleta): Mediodía o Noche,
//        tal como lo marca Maxirest en cada venta (1 = Mediodía, 2 = Noche).
//      - La Rural de Palermo (HIOPOS): un solo turno, "Día completo".
//      - Fábrica: un solo turno, "Turno único".
//      - (Molinos: Mañana y Tarde · Tocka: solo Noche — vienen de la planilla.)
//  · La madrugada ya viene anotada en el día anterior.
//  · La fábrica va aparte y nunca se compara con los locales.
import { db } from "./supabase";
import { hoyAR, sumarDias } from "./ventas";

export type TipoUnidad = "local" | "fabrica";

export interface UnidadDetalle { id: number; nombre: string; tipo: TipoUnidad; fuente?: string | null }
export interface Equivalencia { tipo_unidad: TipoUnidad; codigo: number; empanadas: number }

export interface Ticket {
  unidad_id: number; fecha: string; comprobante: string; turno_maxirest: number | null;
  hora_entrada: string | null; hora_salida: string | null; concepto: string | null;
  descuento: number; total: number; formas_pago: string | null; pago_dividido: boolean;
}
export interface Cobro { unidad_id: number; fecha: string; turno: number; forma: string; cantidad: number; total: number }
export interface ArticuloFila { unidad_id: number; fecha: string; turno: number; codigo: number; nombre: string; rubro: string; unidades: number; venta: number }

/** Turno de Maxirest → nombre en el panel (Maxirest al 1 lo llama "Mañana") */
export const TURNO_MAXIREST: Record<number, string> = { 1: "Mediodía", 2: "Noche" };


/** Nombres lindos para los conceptos de Maxirest */
const NOMBRE_CONCEPTO: Record<string, string> = { "mayorist": "Mayorista", "mayorista": "Mayorista", "de fabrica": "De fábrica", "v. menor": "V. menor" };
export const nombreConcepto = (c: string | null) => NOMBRE_CONCEPTO[(c ?? "").trim().toLowerCase()] ?? (c?.trim() || "Sin concepto");
/** Orden fijo de los tres conceptos de la fábrica */
export const VENTAS_A_LOCALES_PROPIOS = "Ventas a locales propios";
export const CONCEPTOS_FABRICA = ["Mayorista", VENTAS_A_LOCALES_PROPIOS, "De fábrica", "V. menor"];

/** Si la tabla clientes_locales_propios no se puede leer, se usan estos (los mismos que carga la migración) */
const LOCALES_PROPIOS_POR_DEFECTO = ["BN", "BS", "YB"];
const normalizar = (x: string) => x.trim().toUpperCase().replace(/\s+/g, " ");

/**
 * Clientes de la fábrica que son LOCALES PROPIOS (tabla clientes_locales_propios, editable en Supabase).
 * En Maxirest aparecen como "forma de pago" del ticket (ej: "Bn", "Yb", "Bs").
 */
export async function obtenerLocalesPropios(): Promise<Set<string>> {
  let lista = LOCALES_PROPIOS_POR_DEFECTO;
  if (hayBase()) {
    try {
      const filas = await db.leer<{ forma_pago: string }>("clientes_locales_propios", "select=forma_pago&es_local_propio=eq.true");
      lista = filas.map((f) => f.forma_pago);
    } catch {}
  }
  return new Set(lista.map(normalizar));
}

/**
 * Concepto de un ticket de la FÁBRICA: si el cliente es un local propio, va a "Ventas a locales propios"
 * (no se suma a Mayorista ni a ningún otro concepto); si no, el concepto de Maxirest.
 */
export function conceptoFabrica(t: Pick<Ticket, "concepto" | "formas_pago">, propios: Set<string>): string {
  const formas = (t.formas_pago ?? "").split(" + ").map(normalizar);
  return formas.some((f) => propios.has(f)) ? VENTAS_A_LOCALES_PROPIOS : nombreConcepto(t.concepto);
}

export const DIA_COMPLETO = "Día completo";
export const TURNO_UNICO = "Turno único";

/** Cómo se reparten los turnos en cada unidad */
export interface ReglaTurnos {
  nombres: string[];        // turnos que se muestran, en orden
  unico: boolean;           // true = un solo turno (todo va junto)
  nota: string;             // aclaración para la pantalla
  deTicket: (t: Pick<Ticket, "turno_maxirest" | "hora_entrada">) => string;
}

/** Turno de Maxirest de un ticket (si viniera vacío, se deduce por la hora: desde las 17 h es Noche) */
function turnoMaxirest(t: Pick<Ticket, "turno_maxirest" | "hora_entrada">): string {
  if (t.turno_maxirest === 1) return TURNO_MAXIREST[1];
  if (t.turno_maxirest === 2) return TURNO_MAXIREST[2];
  const h = (t.hora_entrada ?? "").slice(0, 5);
  return h && (h >= "17:00" || h < "06:00") ? TURNO_MAXIREST[2] : TURNO_MAXIREST[1];
}

export function reglaTurnos(u: Pick<UnidadDetalle, "tipo" | "fuente">): ReglaTurnos {
  const unico = (nombre: string, nota: string): ReglaTurnos => ({ nombres: [nombre], unico: true, nota, deTicket: () => nombre });
  if (u.tipo === "fabrica") return unico(TURNO_UNICO, "La fábrica trabaja en un solo turno: todas las ventas del día van juntas.");
  if (u.fuente === "hiopos") return unico(DIA_COMPLETO, "En la feria hay un solo turno (el día completo, de la mañana a la noche): todas las ventas del día van juntas.");
  return {
    nombres: [TURNO_MAXIREST[1], TURNO_MAXIREST[2]], unico: false,
    nota: "El turno es el que marca Maxirest en cada venta: Mediodía o Noche (Maxirest al Mediodía lo llama \"Mañana\").",
    deTicket: turnoMaxirest,
  };
}

/** Si la unidad tiene un solo turno, junta las formas de cobro y los artículos en ese turno */
export function aplicarRegla<D extends { cobros: Cobro[]; articulos: ArticuloFila[] }>(d: D, regla: ReglaTurnos): D {
  if (!regla.unico) return d;
  return { ...d, cobros: d.cobros.map((c) => ({ ...c, turno: 1 })), articulos: d.articulos.map((a) => ({ ...a, turno: 1 })) };
}

/** La unidad es fábrica si así lo dice la columna "tipo" (o, si la columna todavía no existe, si es la Central 29979) */
export function tipoDeUnidad(u: { tipo?: string | null; maxirest_codigo?: string | null }): TipoUnidad {
  if (u.tipo === "fabrica" || u.tipo === "local") return u.tipo;
  return u.maxirest_codigo === "29979" ? "fabrica" : "local";
}

export const hayBase = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

export async function obtenerUnidades(): Promise<UnidadDetalle[]> {
  if (!hayBase()) return PRUEBA_UNIDADES;
  const filas = await db.leer<{ id: number; nombre: string; tipo?: string; maxirest_codigo: string | null; fuente?: string | null }>(
    "unidades", "select=*&activa=eq.true&or=(maxirest_codigo.not.is.null,fuente.eq.hiopos)&order=id",
  );
  return filas.map((u) => ({ id: u.id, nombre: u.nombre, tipo: tipoDeUnidad(u), fuente: u.fuente ?? (u.maxirest_codigo ? "maxirest" : null) }));
}

export async function obtenerEquivalencias(tipo: TipoUnidad): Promise<Map<number, number>> {
  let lista: Equivalencia[] = hayBase() ? [] : PRUEBA_EQUIVALENCIAS;
  if (hayBase()) {
    try { lista = await db.leer<Equivalencia>("equivalencias_empanadas", `select=tipo_unidad,codigo,empanadas&tipo_unidad=eq.${tipo}`); } catch {}
  }
  return new Map(lista.filter((e) => e.tipo_unidad === tipo).map((e) => [Number(e.codigo), Number(e.empanadas)]));
}

/** Solo los tickets (para el comparativo por turno) */
export async function obtenerTickets(ids: number[], desde: string, hasta: string): Promise<Ticket[]> {
  if (!hayBase()) return detalleDePrueba(ids, desde, hasta).tickets;
  const lista = await db.leerTodo<Ticket>("ventas_tickets",
    `select=unidad_id,fecha,comprobante,turno_maxirest,hora_entrada,hora_salida,concepto,descuento,total,formas_pago,pago_dividido&unidad_id=in.(${ids.join(",") || 0})&fecha=gte.${desde}&fecha=lte.${hasta}&order=fecha,hora_entrada,comprobante`);
  return lista.map((t) => ({ ...t, total: Number(t.total), descuento: Number(t.descuento) }));
}

export interface FilaComparativoTurno {
  id: number; nombre: string;
  porTurno: Record<string, { venta: number; tickets: number; ventaAnt: number; ticketsAnt: number }>;
  venta: number; ventaAnt: number;
}

/** Comparativo por turno: cada LOCAL (nunca la fábrica), un día contra el mismo día de la semana anterior */
export async function comparativoPorTurno(fecha: string) {
  const locales = (await obtenerUnidades()).filter((u) => u.tipo === "local");
  const anterior = sumarDias(fecha, -7);
  const ids = locales.map((u) => u.id);
  const [hoy, ant] = await Promise.all([obtenerTickets(ids, fecha, fecha), obtenerTickets(ids, anterior, anterior)]);
  const reglas = new Map(locales.map((u) => [u.id, reglaTurnos(u)]));
  // Columnas: Mediodía y Noche siempre; "Día completo" (ferias) solo si alguna feria vendió
  const nombres = [TURNO_MAXIREST[1], TURNO_MAXIREST[2]];
  const conTickets = new Set([...hoy, ...ant].map((t) => t.unidad_id));
  for (const u of locales) for (const n of reglas.get(u.id)!.nombres) if (!nombres.includes(n) && conTickets.has(u.id)) nombres.push(n);
  const filas: FilaComparativoTurno[] = locales.map((u) => {
    const regla = reglas.get(u.id)!;
    const porTurno: FilaComparativoTurno["porTurno"] = {};
    for (const n of nombres) porTurno[n] = { venta: 0, tickets: 0, ventaAnt: 0, ticketsAnt: 0 };
    for (const t of hoy) if (t.unidad_id === u.id) { const x = porTurno[regla.deTicket(t)]; if (x) { x.venta += t.total; x.tickets++; } }
    for (const t of ant) if (t.unidad_id === u.id) { const x = porTurno[regla.deTicket(t)]; if (x) { x.ventaAnt += t.total; x.ticketsAnt++; } }
    const vals = Object.values(porTurno);
    return { id: u.id, nombre: u.nombre, porTurno, venta: vals.reduce((s, x) => s + x.venta, 0), ventaAnt: vals.reduce((s, x) => s + x.ventaAnt, 0) };
  });
  return { fecha, anterior, turnos: nombres, filas: filas.sort((a, b) => b.venta - a.venta), hayDatos: hoy.length > 0 };
}

/** Todo el detalle de unas unidades en un rango de fechas */
export async function obtenerDetalle(ids: number[], desde: string, hasta: string) {
  if (!hayBase()) return detalleDePrueba(ids, desde, hasta);
  const f = `unidad_id=in.(${ids.join(",") || 0})&fecha=gte.${desde}&fecha=lte.${hasta}`;
  const [tickets, cobros, articulos] = await Promise.all([
    obtenerTickets(ids, desde, hasta),
    db.leerTodo<Cobro>("ventas_cobros", `select=unidad_id,fecha,turno,forma,cantidad,total&${f}&order=fecha,turno,forma`),
    db.leerTodo<ArticuloFila>("ventas_articulos", `select=unidad_id,fecha,turno,codigo,nombre,rubro,unidades,venta&${f}&order=fecha,turno,codigo`),
  ]);
  const num = <T extends object>(xs: T[], campos: (keyof T)[]) => xs.map((x) => { const y = { ...x }; for (const c of campos) (y[c] as unknown) = Number(x[c]); return y; });
  return {
    tickets,
    cobros: num(cobros, ["total", "cantidad"]),
    articulos: num(articulos, ["unidades", "venta", "codigo"]),
  };
}

/* ───────────── Fechas ───────────── */

export function ayer(): string { return sumarDias(hoyAR(), -1); }
const valida = (f?: string) => (f && /^\d{4}-\d{2}-\d{2}$/.test(f) ? f : null);

/** Lee "desde" y "hasta" de la dirección; por defecto, ayer. Máximo 62 días. */
export function leerRango(sp: { desde?: string; hasta?: string }) {
  const a = ayer();
  let hasta = valida(sp.hasta) ?? valida(sp.desde) ?? a;
  let desde = valida(sp.desde) ?? hasta;
  if (desde > hasta) [desde, hasta] = [hasta, desde];
  if (hasta > a) hasta = a;
  if (desde > hasta) desde = hasta;
  if (sumarDias(desde, 61) < hasta) desde = sumarDias(hasta, -61);
  return { desde, hasta };
}

export function atajos() {
  const a = ayer();
  return [
    { texto: "Ayer", desde: a, hasta: a },
    { texto: "Últimos 7 días", desde: sumarDias(a, -6), hasta: a },
    { texto: "Mes en curso", desde: a.slice(0, 8) + "01", hasta: a },
  ];
}

export const fechaCorta = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;
export const textoRango = (d: string, h: string) => (d === h ? fechaCorta(d) : `${fechaCorta(d)} al ${fechaCorta(h)}`);

/* ───────────── Cálculos ───────────── */

export interface FilaTurno { turno: string; tickets: number; venta: number; descuentos: number; porConcepto: Record<string, { tickets: number; venta: number }> }

/** Resumen de tickets por turno (según la regla de turnos de la unidad), con el detalle por concepto */
export function resumenPorTurno(tickets: Ticket[], regla: ReglaTurnos, concepto: (t: Ticket) => string = (t) => nombreConcepto(t.concepto)): FilaTurno[] {
  const filas = new Map<string, FilaTurno>();
  const fila = (t: string) => { let f = filas.get(t); if (!f) { f = { turno: t, tickets: 0, venta: 0, descuentos: 0, porConcepto: {} }; filas.set(t, f); } return f; };
  regla.nombres.forEach((n) => fila(n));
  for (const t of tickets) {
    const f = fila(regla.deTicket(t));
    const c = concepto(t);
    f.tickets++; f.venta += t.total; f.descuentos += t.descuento;
    const pc = (f.porConcepto[c] ??= { tickets: 0, venta: 0 });
    pc.tickets++; pc.venta += t.total;
  }
  return [...filas.values()];
}

export interface FilaCobro { forma: string; porTurno: Record<number, number>; cantidad: number; total: number }

/** Formas de cobro (turno de Maxirest), de mayor a menor */
export function cobrosResumen(cobros: Cobro[]): { filas: FilaCobro[]; turnos: number[]; total: number } {
  const m = new Map<string, FilaCobro>();
  const turnos = new Set<number>();
  for (const c of cobros) {
    const k = c.forma.trim().toUpperCase();
    let f = m.get(k);
    if (!f) { f = { forma: c.forma.trim(), porTurno: {}, cantidad: 0, total: 0 }; m.set(k, f); }
    f.porTurno[c.turno] = (f.porTurno[c.turno] ?? 0) + c.total;
    f.cantidad += c.cantidad; f.total += c.total;
    turnos.add(c.turno);
  }
  const filas = [...m.values()].sort((a, b) => b.total - a.total);
  return { filas, turnos: [...turnos].sort(), total: filas.reduce((s, f) => s + f.total, 0) };
}

export interface FilaArticulo { codigo: number; nombre: string; rubro: string; porTurno: Record<number, number>; unidades: number; venta: number; empanadas: number }
export interface GrupoRubro { rubro: string; filas: FilaArticulo[]; porTurno: Record<number, number>; unidades: number; venta: number; empanadas: number }

const lindo = (t: string) => { const s = t.trim(); return s === s.toUpperCase() ? s.charAt(0) + s.slice(1).toLowerCase() : s; };

/** Artículos agrupados por rubro (turno de Maxirest). Si se pasan equivalencias, calcula empanadas. */
export function articulosPorRubro(filas: ArticuloFila[], equivalencias?: Map<number, number>) {
  const porArt = new Map<string, FilaArticulo>();
  const turnos = new Set<number>();
  for (const a of filas) {
    const k = `${a.codigo}|${a.nombre.trim().toUpperCase()}`;
    let f = porArt.get(k);
    if (!f) { f = { codigo: a.codigo, nombre: a.nombre.trim(), rubro: lindo(a.rubro), porTurno: {}, unidades: 0, venta: 0, empanadas: 0 }; porArt.set(k, f); }
    f.porTurno[a.turno] = (f.porTurno[a.turno] ?? 0) + a.unidades;
    f.unidades += a.unidades; f.venta += a.venta;
    f.empanadas += a.unidades * (equivalencias?.get(a.codigo) ?? 0);
    turnos.add(a.turno);
  }
  const grupos = new Map<string, GrupoRubro>();
  for (const f of porArt.values()) {
    const k = f.rubro.toUpperCase();
    let g = grupos.get(k);
    if (!g) { g = { rubro: f.rubro, filas: [], porTurno: {}, unidades: 0, venta: 0, empanadas: 0 }; grupos.set(k, g); }
    g.filas.push(f);
    for (const [t, u] of Object.entries(f.porTurno)) g.porTurno[Number(t)] = (g.porTurno[Number(t)] ?? 0) + u;
    g.unidades += f.unidades; g.venta += f.venta; g.empanadas += f.empanadas;
  }
  const lista = [...grupos.values()].sort((a, b) => b.venta - a.venta);
  lista.forEach((g) => g.filas.sort((a, b) => b.venta - a.venta || b.unidades - a.unidades));
  return { grupos: lista, turnos: [...turnos].sort(), empanadas: lista.reduce((s, g) => s + g.empanadas, 0) };
}

/* ───────────── Datos de prueba (cuando no hay conexión a Supabase) ───────────── */

const PRUEBA_UNIDADES: UnidadDetalle[] = [
  { id: 1, nombre: "Barrio Norte", tipo: "local" },
  { id: 2, nombre: "Barrio Sur", tipo: "local" },
  { id: 3, nombre: "Yerba Buena", tipo: "local" },
  { id: 4, nombre: "Recoleta", tipo: "local" },
  { id: 5, nombre: "Fábrica Central", tipo: "fabrica" },
];
const PRUEBA_EQUIVALENCIAS: Equivalencia[] = [
  { tipo_unidad: "fabrica", codigo: 10, empanadas: 42 }, { tipo_unidad: "fabrica", codigo: 16, empanadas: 36 },
  { tipo_unidad: "fabrica", codigo: 45, empanadas: 120 }, { tipo_unidad: "fabrica", codigo: 1, empanadas: 12 },
];

function detalleDePrueba(ids: number[], desde: string, hasta: string) {
  const tickets: Ticket[] = [];
  const cobros: Cobro[] = [];
  const articulos: ArticuloFila[] = [];
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) {
    for (const id of ids) {
      const fab = id === 5;
      const horas = fab ? ["07:10", "08:30", "11:40", "12:15", "13:05"] : ["11:20", "12:35", "13:10", "14:05", "20:40", "21:15", "22:30", "23:50", "00:20", "17:10"];
      const conceptos = fab ? ["Mayorist", "De fabrica", "Mayorist", "V. menor", "De fabrica"] : ["Mostrador", "Pedidos ya", "Delivery"];
      horas.forEach((h, i) => tickets.push({
        unidad_id: id, fecha: f, comprobante: `B-${id}-${f}-${i}`, turno_maxirest: !fab && h >= "17" || h < "06" ? 2 : 1,
        hora_entrada: h, hora_salida: h, concepto: conceptos[i % conceptos.length], descuento: i % 3 ? 0 : 1500,
        total: (fab ? 90000 : 18000) + i * 1700 * id, formas_pago: i % 4 ? "Efectivo" : "Efectivo + Qr mp", pago_dividido: i % 4 === 0,
      }));
      for (const t of fab ? [1] : [1, 2]) {
        cobros.push({ unidad_id: id, fecha: f, turno: t, forma: "EFECTIVO", cantidad: 4, total: 60000 + id * 1000 });
        cobros.push({ unidad_id: id, fecha: f, turno: t, forma: fab ? "TRANSFE" : "PEYA ONLINE", cantidad: 3, total: 50000 + t * 3000 });
      }
      const arts: [number, string, string, number][] = fab
        ? [[10, "T Carne Suave", "Empanadas", 9], [16, "T Sfijas", "Empanadas", 3], [45, "Caja CS *120", "Empanadas", 1], [1, "DOC CS", "Empanadas", 14], [1410, "Wrap de Carne", "Otros Prod", 30]]
        : [[10, "Emp Carne Suave", "Empanadas", 40], [16, "Sfijas", "Empanadas", 18], [12, "Emp Pollo", "Empanadas", 15], [1272, "Wrap de Pollo", "Wraps", 4], [527, "Pepsi 354cc", "Bebidas S/A", 5]];
      for (const t of fab ? [1] : [1, 2]) for (const [codigo, nombre, rubro, u] of arts) {
        const q = Math.round(u * (t === 1 ? 1 : 0.8));
        articulos.push({ unidad_id: id, fecha: f, turno: t, codigo, nombre, rubro, unidades: q, venta: q * (fab ? 6000 : 2000) });
      }
    }
  }
  return { tickets, cobros, articulos };
}
