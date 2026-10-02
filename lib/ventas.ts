// lib/ventas.ts — Ventas para las pantallas.
// Si hay conexión con Supabase, usa las ventas REALES de Maxirest.
// Si no (por ejemplo en tu compu sin llaves), usa los datos de prueba.
import { db } from "./supabase";
import { mockVentas } from "./mockData";

export interface VentasUnidad {
  id: number;
  nombre: string;
  tipo: "local" | "fabrica";        // la fábrica va aparte (nunca se compara con locales)
  grupo: string;                     // "La Leñita" o "Molinos y Tocka" (este va aparte, no se suma)
  fuente: "maxirest" | "planilla" | "hiopos";
  ventaAyer: number | null;          // null = no llegaron datos de ayer
  ventaMismoDiaSemAnt: number | null;
  ventaMes: number;
  comprobantesAyer: number | null;
  comprobantesSemAnt: number | null;
  ultimoDia: string | null;          // último día con datos (AAAA-MM-DD)
  ultimos7: number;                  // venta de los últimos 7 días
  previos7: number;                  // los 7 días anteriores
  semana: number;                    // semana en curso: del lunes hasta ayer
  semanaAnt: number;                 // los MISMOS días de la semana pasada (pera con pera)
  mesAnt: number;                    // mes anterior, del 1 hasta el mismo día
}

export interface ResumenVentas {
  real: boolean;
  ayer: string;                      // AAAA-MM-DD
  semanaTexto: string;               // "lun a jue": qué días de la semana se comparan
  unidades: VentasUnidad[];
  sinFuente: string[];               // unidades que todavía no tienen conexión
  ultimaCarga: string | null;        // fecha/hora de la última carga automática
  ultimaCargaOk: boolean;
}

/* Fechas en hora de Argentina */
export function hoyAR(): string {
  return new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
}
export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(fecha + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

const DIAS_CORTOS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

/**
 * Períodos para comparar PERA CON PERA (los mismos días):
 *  · semana en curso (lunes → ayer) contra los mismos días de la semana pasada
 *  · mes en curso (1 → ayer) contra el mes anterior del 1 al mismo día (si el mes anterior es más corto, hasta su último día)
 */
export function periodosComparables(ayer: string) {
  const dia = (new Date(ayer + "T12:00:00Z").getUTCDay() + 6) % 7; // 0 = lunes
  const lunes = sumarDias(ayer, -dia);
  const [a, m, d] = ayer.split("-").map(Number);
  const pa = m === 1 ? a - 1 : a, pm = m === 1 ? 12 : m - 1;
  const ultimo = new Date(Date.UTC(pa, pm, 0)).getUTCDate();
  const mm = String(pm).padStart(2, "0");
  return {
    lunes,
    semanaTexto: dia === 0 ? "lun" : `${DIAS_CORTOS[0]} a ${DIAS_CORTOS[dia]}`,
    inicioMesAnt: `${pa}-${mm}-01`,
    finMesAnt: `${pa}-${mm}-${String(Math.min(d, ultimo)).padStart(2, "0")}`,
  };
}

export function totales(r: ResumenVentas) {
  const conAyer = r.unidades.filter((u) => u.ventaAyer !== null);
  const conAmbos = conAyer.filter((u) => u.ventaMismoDiaSemAnt !== null);
  return {
    totalAyer: conAyer.reduce((s, u) => s + (u.ventaAyer ?? 0), 0),
    comprobantesAyer: conAyer.reduce((s, u) => s + (u.comprobantesAyer ?? 0), 0),
    // venta solo de las unidades que informan tickets (las de planilla no), para el ticket promedio
    ventaConTickets: conAyer.filter((u) => (u.comprobantesAyer ?? 0) > 0).reduce((s, u) => s + (u.ventaAyer ?? 0), 0),
    // la comparación solo usa unidades que tienen los dos días (para no comparar peras con manzanas)
    ayerComparable: conAmbos.reduce((s, u) => s + (u.ventaAyer ?? 0), 0),
    semAntComparable: conAmbos.reduce((s, u) => s + (u.ventaMismoDiaSemAnt ?? 0), 0),
    totalMes: r.unidades.reduce((s, u) => s + u.ventaMes, 0),
    // pera con pera: semana en curso vs los mismos días de la semana pasada; mes al día vs mes anterior al mismo día
    semana: r.unidades.reduce((s, u) => s + u.semana, 0),
    semanaAnt: r.unidades.reduce((s, u) => s + u.semanaAnt, 0),
    mesAnt: r.unidades.reduce((s, u) => s + u.mesAnt, 0),
    unidadesConDatos: conAyer.length,
    unidadesTotal: r.unidades.length,
  };
}

interface Unidad { id: number; nombre: string; maxirest_codigo: string | null; tipo?: string | null; grupo?: string | null; fuente?: string | null }
interface Fila { unidad_id: number; fecha: string; total: number; cantidad_ventas: number }

export async function obtenerVentas(): Promise<ResumenVentas> {
  const ayer = sumarDias(hoyAR(), -1);
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return ventasDePrueba(ayer);

  const semAnt = sumarDias(ayer, -7);
  const inicioMes = ayer.slice(0, 8) + "01";
  const p = periodosComparables(ayer);
  const desde = [p.inicioMesAnt, sumarDias(ayer, -13)].sort()[0];

  const [unidades, filas, cargas] = await Promise.all([
    db.leer<Unidad>("unidades", "select=*&activa=eq.true&order=id"),
    db.leer<Fila>("ventas_diarias", `select=unidad_id,fecha,total,cantidad_ventas&fecha=gte.${desde}&fecha=lte.${ayer}`),
    db.leer<{ creado_en: string; estado: string }>("registro_cargas", "select=creado_en,estado&fuente=eq.Maxirest&order=creado_en.desc&limit=1"),
  ]);

  // Con fuente = Maxirest, HIOPOS (La Rural) o planilla de Google (Molinos, Tocka, Hipódromo)
  const fuenteDe = (u: Unidad) => (u.fuente === "planilla" ? "planilla" : u.fuente === "hiopos" ? "hiopos" : u.maxirest_codigo ? "maxirest" : null);
  const conFuente = unidades.filter((u) => fuenteDe(u));
  const ultimos = await Promise.all(
    conFuente.map((u) => db.leer<{ fecha: string }>("ventas_diarias", `select=fecha&unidad_id=eq.${u.id}&order=fecha.desc&limit=1`)),
  );

  const lista: VentasUnidad[] = conFuente.map((u, i) => {
    const propias = filas.filter((f) => f.unidad_id === u.id);
    const dia = (fecha: string) => propias.find((f) => f.fecha === fecha);
    const suma = (d1: string, d2: string) => propias.filter((f) => f.fecha >= d1 && f.fecha <= d2).reduce((s, f) => s + Number(f.total), 0);
    const fAyer = dia(ayer);
    const fSem = dia(semAnt);
    return {
      id: u.id,
      nombre: u.nombre,
      tipo: u.tipo === "fabrica" || (!u.tipo && u.maxirest_codigo === "29979") ? "fabrica" : "local",
      grupo: u.grupo || "La Leñita",
      fuente: fuenteDe(u) as "maxirest" | "planilla" | "hiopos",
      ventaAyer: fAyer ? Number(fAyer.total) : null,
      ventaMismoDiaSemAnt: fSem ? Number(fSem.total) : null,
      ventaMes: suma(inicioMes, ayer),
      comprobantesAyer: fAyer ? fAyer.cantidad_ventas : null,
      comprobantesSemAnt: fSem ? fSem.cantidad_ventas : null,
      ultimoDia: ultimos[i][0]?.fecha ?? null,
      ultimos7: suma(sumarDias(ayer, -6), ayer),
      previos7: suma(sumarDias(ayer, -13), sumarDias(ayer, -7)),
      semana: suma(p.lunes, ayer),
      semanaAnt: suma(sumarDias(p.lunes, -7), sumarDias(ayer, -7)),
      mesAnt: suma(p.inicioMesAnt, p.finMesAnt),
    };
  });

  return {
    real: true,
    ayer,
    semanaTexto: p.semanaTexto,
    unidades: lista,
    sinFuente: unidades.filter((u) => !fuenteDe(u)).map((u) => u.nombre),
    ultimaCarga: cargas[0]?.creado_en ?? null,
    ultimaCargaOk: cargas[0]?.estado !== "ERROR",
  };
}

function ventasDePrueba(ayer: string): ResumenVentas {
  return {
    real: false,
    ayer,
    semanaTexto: periodosComparables(ayer).semanaTexto,
    unidades: mockVentas.unidades.map((u) => ({
      id: u.id,
      nombre: u.nombre,
      tipo: /f[aá]brica/i.test(u.nombre) ? "fabrica" as const : "local" as const,
      grupo: "La Leñita",
      fuente: "maxirest" as const,
      ventaAyer: u.ventaAyer,
      ventaMismoDiaSemAnt: u.ventaMismoDiaSemAnt,
      ventaMes: u.ventaMes,
      comprobantesAyer: u.comprobantesAyer,
      comprobantesSemAnt: Math.round(u.comprobantesAyer * 1.05),
      ultimoDia: ayer,
      ultimos7: u.ventaAyer * 7,
      previos7: u.ventaMismoDiaSemAnt * 7,
      semana: u.ventaAyer * 4,
      semanaAnt: u.ventaMismoDiaSemAnt * 4,
      mesAnt: u.ventaMes * 0.95,
    })),
    sinFuente: [],
    ultimaCarga: null,
    ultimaCargaOk: true,
  };
}
