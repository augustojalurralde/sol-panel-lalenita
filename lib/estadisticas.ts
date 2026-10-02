// lib/estadisticas.ts — Estadísticas de ventas (todo calculado con los datos reales guardados en el SOL)
// Se usa en /locales/estadisticas. Períodos fijos para que sea simple:
//   · Evolución: últimos 12 meses (el mes en curso, parcial).
//   · Día de la semana y hora: últimas 8 semanas.
//   · Canales, formas de cobro y artículos: últimos 30 días (artículos contra los 30 anteriores).
import { db } from "./supabase";
import { hoyAR, sumarDias } from "./ventas";
import { hayBase, nombreConcepto, conceptoFabrica, obtenerLocalesPropios, CONCEPTOS_FABRICA } from "./detalle";

export const GRUPO_APARTE = "Molinos y Tocka";

/** Colores fijos por orden (validados para daltonismo); cada local conserva siempre su color */
export const COLORES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
export const GRIS_OTROS = "#a3a29c";

interface Unidad { id: number; nombre: string; grupo: string | null; tipo: string | null; fuente: string | null; maxirest_codigo: string | null; activa: boolean }
interface Diaria { unidad_id: number; fecha: string; total: number; cantidad_ventas: number }
interface TicketE { unidad_id: number; fecha: string; hora_entrada: string | null; concepto: string | null; total: number; formas_pago?: string | null }
interface CobroE { unidad_id: number; forma: string; total: number }
interface ArticuloE { unidad_id: number; fecha: string; nombre: string; unidades: number; venta: number }

export interface Serie { nombre: string; color: string; valores: number[] }
export interface Apilado { categorias: string[]; series: Serie[] }
export interface Calor { filas: { nombre: string; valores: (number | null)[] }[]; columnas: string[] }
export interface Reparto { filas: { nombre: string; partes: { nombre: string; valor: number }[]; total: number }[]; categorias: { nombre: string; color: string }[] }
export interface TopArticulo { nombre: string; venta: number; unidades: number; ventaAnt: number }

export interface Estadisticas {
  real: boolean;
  ayer: string;
  kpi: {
    mes: string; cerrado: boolean; ventaMes: number; ventaMesAnt: number; proyeccion: number; diasMes: number; diasTranscurridos: number;
    tickets: number; ticketsAnt: number; ticketProm: number; ticketPromAnt: number;
    mejorDia: { fecha: string; venta: number } | null;
  };
  mensualLocales: Apilado;
  diaSemana: Calor;
  hora: Calor;
  canales: Reparto;
  cobros: Reparto;
  top: TopArticulo[];
  mensualFabrica: Apilado;
  mensualAparte: Apilado;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const diaSemana = (f: string) => (new Date(f + "T12:00:00Z").getUTCDay() + 6) % 7; // 0 = lunes
const diasDelMes = (mes: string) => { const [a, m] = mes.split("-").map(Number); return new Date(Date.UTC(a, m, 0)).getUTCDate(); };
const mesAnterior = (mes: string) => { const [a, m] = mes.split("-").map(Number); return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, "0")}`; };
const etiquetaMes = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1]} ${mes.slice(2, 4)}`;
const limpiar = (s: string) => s.trim().replace(/\s+/g, " ").toUpperCase();

/** Hora del ticket → franja (las de madrugada se ordenan después de la noche) */
const ORDEN_HORAS = [...Array.from({ length: 18 }, (_, i) => i + 6), 0, 1, 2, 3, 4, 5];

/** Reparte por categoría: las más grandes (en el total) con nombre propio, el resto en "Otros" */
function reparto(porUnidad: Map<string, Map<string, number>>, maxCategorias: number, colores: Record<string, string> = {}): Reparto {
  const totales = new Map<string, number>();
  for (const m of porUnidad.values()) for (const [c, v] of m) totales.set(c, (totales.get(c) ?? 0) + v);
  const principales = [...totales.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, maxCategorias).map(([c]) => c);
  const hayOtros = [...totales.keys()].some((c) => !principales.includes(c) && (totales.get(c) ?? 0) > 0);
  const categorias = [...principales.map((c, i) => ({ nombre: c, color: colores[c] ?? COLORES[i] })), ...(hayOtros ? [{ nombre: "Otros", color: GRIS_OTROS }] : [])];
  const filas = [...porUnidad.entries()].map(([nombre, m]) => {
    const partes = categorias.map((c) => ({ nombre: c.nombre, valor: c.nombre === "Otros" ? [...m].filter(([k]) => !principales.includes(k)).reduce((s, [, v]) => s + v, 0) : m.get(c.nombre) ?? 0 }));
    return { nombre, partes, total: partes.reduce((s, p) => s + p.valor, 0) };
  }).filter((f) => f.total > 0);
  return { filas, categorias };
}

export async function obtenerEstadisticas(): Promise<Estadisticas | null> {
  if (!hayBase()) return null;
  const ayer = sumarDias(hoyAR(), -1);
  const mesActual = ayer.slice(0, 7);
  const meses: string[] = [mesActual];
  while (meses.length < 12) meses.unshift(mesAnterior(meses[0]));
  const desde12 = meses[0] + "-01";
  const desde56 = sumarDias(ayer, -55);
  const desde30 = sumarDias(ayer, -29);
  const desde60 = sumarDias(ayer, -59);

  const unidades = (await db.leer<Unidad>("unidades", "select=id,nombre,grupo,tipo,fuente,maxirest_codigo,activa&activa=eq.true&order=id"))
    .filter((u) => u.fuente || u.maxirest_codigo);
  const esFabrica = (u: Unidad) => u.tipo === "fabrica";
  const locales = unidades.filter((u) => !esFabrica(u) && u.grupo !== GRUPO_APARTE);
  const aparte = unidades.filter((u) => u.grupo === GRUPO_APARTE);
  const fabrica = unidades.find(esFabrica);
  const conTickets = locales.filter((u) => u.fuente === "maxirest" || u.fuente === "hiopos" || u.maxirest_codigo);
  const ids = (us: Unidad[]) => us.map((u) => u.id).join(",") || "0";

  const [diarias, tickets, ticketsFab, cobros, articulos, propios] = await Promise.all([
    db.leerTodo<Diaria>("ventas_diarias", `select=unidad_id,fecha,total,cantidad_ventas&fecha=gte.${desde12}&fecha=lte.${ayer}&order=fecha`),
    db.leerTodo<TicketE>("ventas_tickets", `select=unidad_id,fecha,hora_entrada,concepto,total&unidad_id=in.(${ids(conTickets)})&fecha=gte.${desde56}&fecha=lte.${ayer}&order=fecha`),
    fabrica ? db.leerTodo<TicketE>("ventas_tickets", `select=unidad_id,fecha,concepto,formas_pago,total&unidad_id=eq.${fabrica.id}&fecha=gte.${desde12}&fecha=lte.${ayer}&order=fecha`) : Promise.resolve([]),
    db.leerTodo<CobroE>("ventas_cobros", `select=unidad_id,forma,total&unidad_id=in.(${ids(conTickets)})&fecha=gte.${desde30}&fecha=lte.${ayer}&order=fecha`),
    db.leerTodo<ArticuloE>("ventas_articulos", `select=unidad_id,fecha,nombre,unidades,venta&unidad_id=in.(${ids(conTickets)})&fecha=gte.${desde60}&fecha=lte.${ayer}&order=fecha`),
    obtenerLocalesPropios(),
  ]);
  const D = diarias.map((d) => ({ ...d, total: Number(d.total), cantidad_ventas: Number(d.cantidad_ventas) }));
  const colorDe = new Map([...locales.map((u, i) => [u.id, COLORES[i % COLORES.length]] as const), ...aparte.map((u, i) => [u.id, COLORES[i % COLORES.length]] as const)]);
  const nombreDe = new Map(unidades.map((u) => [u.id, u.nombre]));
  const idsLocales = new Set(locales.map((u) => u.id));

  // ── KPIs del mes (locales de La Leñita) ──
  const delMes = (mes: string, hastaDia: number) => D.filter((d) => idsLocales.has(d.unidad_id) && d.fecha.startsWith(mes) && Number(d.fecha.slice(8)) <= hastaDia);
  // En los primeros días del mes se muestra el mes anterior completo (con 1 o 2 días no se puede comparar nada)
  const mesKpi = Number(ayer.slice(8)) <= 3 ? mesAnterior(mesActual) : mesActual;
  const diaHoy = mesKpi === mesActual ? Number(ayer.slice(8)) : diasDelMes(mesKpi);
  const actual = delMes(mesKpi, diaHoy);
  const anterior = delMes(mesAnterior(mesKpi), diaHoy);
  const suma = (xs: Diaria[], c: "total" | "cantidad_ventas") => xs.reduce((s, x) => s + x[c], 0);
  const conTk = (xs: Diaria[]) => xs.filter((x) => x.cantidad_ventas > 0);
  const ventaMes = suma(actual, "total");
  const porDia = new Map<string, number>();
  for (const d of actual) porDia.set(d.fecha, (porDia.get(d.fecha) ?? 0) + d.total);
  const mejor = [...porDia.entries()].sort((a, b) => b[1] - a[1])[0];
  const tk = suma(conTk(actual), "cantidad_ventas"), tkAnt = suma(conTk(anterior), "cantidad_ventas");
  const kpi = {
    ventaMes, ventaMesAnt: suma(anterior, "total"),
    mes: mesKpi, cerrado: mesKpi !== mesActual,
    diasMes: diasDelMes(mesKpi), diasTranscurridos: diaHoy,
    proyeccion: diaHoy ? (ventaMes / diaHoy) * diasDelMes(mesKpi) : 0,
    tickets: tk, ticketsAnt: tkAnt,
    ticketProm: tk ? suma(conTk(actual), "total") / tk : 0,
    ticketPromAnt: tkAnt ? suma(conTk(anterior), "total") / tkAnt : 0,
    mejorDia: mejor ? { fecha: mejor[0], venta: mejor[1] } : null,
  };

  // ── Evolución mensual ──
  const mensual = (us: Unidad[]): Apilado => ({
    categorias: meses.map((m, i) => etiquetaMes(m) + (i === meses.length - 1 ? "*" : "")),
    series: us.map((u, i) => ({
      nombre: u.nombre, color: colorDe.get(u.id) ?? COLORES[i % COLORES.length],
      valores: meses.map((m) => D.filter((d) => d.unidad_id === u.id && d.fecha.startsWith(m)).reduce((s, d) => s + d.total, 0)),
    })).filter((s) => s.valores.some((v) => v > 0)),
  });
  const mensualLocales = mensual(locales);
  const mensualAparte = mensual(aparte);

  // ── Día de la semana (promedio de los días con venta, últimas 8 semanas) ──
  const diaSemanaCalor: Calor = {
    columnas: DIAS_SEMANA,
    filas: locales.map((u) => {
      const propias = D.filter((d) => d.unidad_id === u.id && d.fecha >= desde56 && d.total > 0);
      return {
        nombre: u.nombre,
        valores: DIAS_SEMANA.map((_, i) => { const xs = propias.filter((d) => diaSemana(d.fecha) === i); return xs.length ? xs.reduce((s, d) => s + d.total, 0) / xs.length : null; }),
      };
    }).filter((f) => f.valores.some((v) => v)),
  };

  // ── Hora del día (% de la venta de cada local, últimas 8 semanas) ──
  const T = tickets.map((t) => ({ ...t, total: Number(t.total) }));
  const porHora = new Map<number, Map<number, number>>();
  for (const t of T) {
    if (!t.hora_entrada) continue;
    const h = Number(t.hora_entrada.slice(0, 2));
    const m = porHora.get(t.unidad_id) ?? new Map<number, number>();
    m.set(h, (m.get(h) ?? 0) + t.total);
    porHora.set(t.unidad_id, m);
  }
  const horasUsadas = ORDEN_HORAS.filter((h) => [...porHora.values()].some((m) => (m.get(h) ?? 0) > 0));
  const horaCalor: Calor = {
    columnas: horasUsadas.map((h) => String(h).padStart(2, "0")),
    filas: conTickets.filter((u) => porHora.has(u.id)).map((u) => {
      const m = porHora.get(u.id)!;
      const total = [...m.values()].reduce((s, v) => s + v, 0);
      return { nombre: u.nombre, valores: horasUsadas.map((h) => (total && m.get(h) ? (m.get(h)! / total) * 100 : null)) };
    }),
  };

  // ── Canales (últimos 30 días, según el concepto del ticket) ──
  const canalesMap = new Map<string, Map<string, number>>();
  for (const t of T) {
    if (t.fecha < desde30) continue;
    const n = nombreDe.get(t.unidad_id)!;
    const m = canalesMap.get(n) ?? new Map<string, number>();
    const c = nombreConcepto(t.concepto);
    m.set(c, (m.get(c) ?? 0) + t.total);
    canalesMap.set(n, m);
  }
  // ── Formas de cobro (últimos 30 días) ──
  const cobrosMap = new Map<string, Map<string, number>>();
  for (const c of cobros) {
    const n = nombreDe.get(c.unidad_id)!;
    const m = cobrosMap.get(n) ?? new Map<string, number>();
    const f = limpiar(c.forma);
    m.set(f, (m.get(f) ?? 0) + Number(c.total));
    cobrosMap.set(n, m);
  }

  // ── Artículos más vendidos (últimos 30 días vs los 30 anteriores, todos los locales juntos) ──
  const arts = new Map<string, TopArticulo>();
  for (const a of articulos) {
    const k = limpiar(a.nombre);
    const x = arts.get(k) ?? { nombre: a.nombre.trim(), venta: 0, unidades: 0, ventaAnt: 0 };
    if (a.fecha >= desde30) { x.venta += Number(a.venta); x.unidades += Number(a.unidades); } else x.ventaAnt += Number(a.venta);
    arts.set(k, x);
  }
  const top = [...arts.values()].filter((a) => a.venta > 0).sort((a, b) => b.venta - a.venta).slice(0, 15);

  // ── Fábrica por concepto, mes a mes ──
  const mensualFabrica: Apilado = {
    categorias: meses.map((m, i) => etiquetaMes(m) + (i === meses.length - 1 ? "*" : "")),
    series: CONCEPTOS_FABRICA.map((c, i) => ({
      nombre: c, color: COLORES[i],
      valores: meses.map((m) => ticketsFab.filter((t) => t.fecha.startsWith(m) && conceptoFabrica({ concepto: t.concepto, formas_pago: t.formas_pago ?? null }, propios) === c).reduce((s, t) => s + Number(t.total), 0)),
    })).filter((s) => s.valores.some((v) => v > 0)),
  };

  return {
    real: true, ayer, kpi, mensualLocales, diaSemana: diaSemanaCalor, hora: horaCalor,
    canales: reparto(canalesMap, 4), cobros: reparto(cobrosMap, 5), top, mensualFabrica, mensualAparte,
  };
}
