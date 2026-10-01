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
  fuente: "maxirest" | "planilla";
  ventaAyer: number | null;          // null = no llegaron datos de ayer
  ventaMismoDiaSemAnt: number | null;
  ventaMes: number;
  comprobantesAyer: number | null;
  comprobantesSemAnt: number | null;
  ultimoDia: string | null;          // último día con datos (AAAA-MM-DD)
  ultimos7: number;                  // venta de los últimos 7 días
  previos7: number;                  // los 7 días anteriores
}

export interface ResumenVentas {
  real: boolean;
  ayer: string;                      // AAAA-MM-DD
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
  const desde = [inicioMes, sumarDias(ayer, -13)].sort()[0];

  const [unidades, filas, cargas] = await Promise.all([
    db.leer<Unidad>("unidades", "select=*&activa=eq.true&order=id"),
    db.leer<Fila>("ventas_diarias", `select=unidad_id,fecha,total,cantidad_ventas&fecha=gte.${desde}&fecha=lte.${ayer}`),
    db.leer<{ creado_en: string; estado: string }>("registro_cargas", "select=creado_en,estado&fuente=eq.Maxirest&order=creado_en.desc&limit=1"),
  ]);

  // Con fuente = Maxirest o planilla de Google (Molinos, Tocka, ferias)
  const fuenteDe = (u: Unidad) => (u.fuente === "planilla" ? "planilla" : u.maxirest_codigo ? "maxirest" : null);
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
      fuente: fuenteDe(u) as "maxirest" | "planilla",
      ventaAyer: fAyer ? Number(fAyer.total) : null,
      ventaMismoDiaSemAnt: fSem ? Number(fSem.total) : null,
      ventaMes: suma(inicioMes, ayer),
      comprobantesAyer: fAyer ? fAyer.cantidad_ventas : null,
      comprobantesSemAnt: fSem ? fSem.cantidad_ventas : null,
      ultimoDia: ultimos[i][0]?.fecha ?? null,
      ultimos7: suma(sumarDias(ayer, -6), ayer),
      previos7: suma(sumarDias(ayer, -13), sumarDias(ayer, -7)),
    };
  });

  return {
    real: true,
    ayer,
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
    })),
    sinFuente: [],
    ultimaCarga: null,
    ultimaCargaOk: true,
  };
}
