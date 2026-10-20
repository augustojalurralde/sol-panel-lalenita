// lib/pedidosya.ts — SECCIÓN PEDIDOSYA
// Lee de la base lo que cargó la tarea semanal y arma: cuentas de la semana, comparación por local,
// cuadre contra Maxirest y la lista de cosas para reclamarle a PedidosYa.
import { db } from "@/lib/supabase";
import { reglasPedidosYa as R, type Semaforo } from "@/lib/config";
import { normal, type Liquidacion } from "@/lib/pedidosyaLeer";

export type LiquidacionFila = Omit<Liquidacion, "detalle"> & { detalle: Record<string, number>; fuente: string | null };
export interface VentaLocal { desde: string; local: string; pedidos: number | null; bruto: number | null; desc_local: number | null; neta: number | null; comision: number | null; plus: number | null; efectivo_pct: number | null; fuente: string | null }
export interface OperacionLocal { desde: string; local: string; minutos_no_disponible: number | null; cancelaciones_evitables_pct: number | null; espera_evitable_pct: number | null; preparacion_min: number | null; reclamos_pct: number | null; listos_pct: number | null }
export interface DiaLocal { fecha: string; local: string; pedidos: number; cancelados: number; bruto: number; neta: number | null; fuente: string | null }
export interface PedidoProblema { nro: string; local: string; fecha: string; hora: string | null; estado: string; entrega: string | null; problema: string | null; con_cargo: boolean; monto: number }
export interface Cargo { nro: string; tipo: string; local: string | null; fecha: string | null; motivo: string | null; monto_pedido: number | null; monto: number | null; semana: string | null }
export interface Informe { desde: string; resumen: string | null; bueno: string[]; malo: string[]; por_local: { local: string; texto: string }[]; novedades: string[]; preguntas: string[]; acciones: string[]; reclamar: { concepto: string; monto?: number; detalle?: string }[]; creado_en: string }
export interface LocalPeya { nombre_peya: string; unidad: string | null; sociedad: string; comision_pct: number | null; activo: boolean }

const n = (x: unknown) => (x === null || x === undefined || x === "" ? null : Number(x));
const numerico = <T extends object>(f: T): T => {
  const r: Record<string, unknown> = { ...(f as Record<string, unknown>) };
  for (const [k, v] of Object.entries(r)) if (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v) && !["desde", "hasta", "fecha", "semana", "nro", "cuenta", "fecha_pago"].includes(k)) r[k] = Number(v);
  return r as T;
};

export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(fecha + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
export const textoSemana = (desde: string) => {
  const f = (x: string) => `${x.slice(8, 10)}/${x.slice(5, 7)}`;
  return `${f(desde)} al ${f(sumarDias(desde, 6))}`;
};

/** Semanas con liquidación cargada, de la más nueva a la más vieja */
export async function semanasCargadas(): Promise<string[]> {
  // Semanas con liquidación o con ventas por local (la liquidación llega una semana después)
  const [a, b] = await Promise.all([
    db.leer<{ desde: string }>("peya_liquidaciones", "select=desde&order=desde.desc&limit=200"),
    db.leer<{ desde: string }>("peya_ventas_local", "select=desde&order=desde.desc&limit=2000"),
  ]);
  return [...new Set([...a, ...b].map((f) => f.desde))].sort().reverse();
}

export interface DatosSemana {
  desde: string; hasta: string;
  locales: LocalPeya[];
  liq: LiquidacionFila | null; liqAnt: LiquidacionFila | null; historial: LiquidacionFila[];
  ventas: VentaLocal[]; ventasAnt: VentaLocal[]; ventasAnio: VentaLocal[];
  operacion: OperacionLocal[]; operacionAnt: OperacionLocal[];
  dias: DiaLocal[]; problemas: PedidoProblema[]; cargos: Cargo[]; informe: Informe | null;
  maxirest: { unidad: string; peya: number; maxirest: number | null; formas: string[] }[];
  semanasFaltantes: string[];
}

export async function datosSemana(desde: string): Promise<DatosSemana> {
  const hasta = sumarDias(desde, 6);
  const ant = sumarDias(desde, -7);
  const anio = sumarDias(desde, -364); // mismo lunes del año anterior
  const leer = <T extends object>(tabla: string, q: string) => db.leer<T>(tabla, q).then((x) => x.map(numerico));
  const [locales, liqs, ventas, ventasAnt, ventasAnio, operacion, operacionAnt, dias, problemas, cargos, informes, todas] = await Promise.all([
    leer<LocalPeya>("peya_locales", "select=*"),
    leer<LiquidacionFila>("peya_liquidaciones", `select=*&desde=gte.${sumarDias(desde, -56)}&desde=lte.${desde}&order=desde.desc`),
    leer<VentaLocal>("peya_ventas_local", `select=*&desde=eq.${desde}`),
    leer<VentaLocal>("peya_ventas_local", `select=*&desde=eq.${ant}`),
    leer<VentaLocal>("peya_ventas_local", `select=*&desde=eq.${anio}`),
    leer<OperacionLocal>("peya_operacion_local", `select=*&desde=eq.${desde}`),
    leer<OperacionLocal>("peya_operacion_local", `select=*&desde=eq.${ant}`),
    leer<DiaLocal>("peya_dia_local", `select=*&fecha=gte.${desde}&fecha=lte.${hasta}&order=fecha`),
    leer<PedidoProblema>("peya_pedidos", `select=*&fecha=gte.${desde}&fecha=lte.${hasta}&order=fecha,hora`),
    leer<Cargo>("peya_cargos", `select=*&semana=eq.${desde}&order=fecha`),
    leer<Informe>("peya_informes", `select=*&desde=eq.${desde}`),
    db.leer<{ desde: string }>("peya_liquidaciones", `select=desde&order=desde.asc`),
  ]);
  const liq = liqs.find((l) => l.desde === desde) ?? null;
  const liqAnt = liqs.find((l) => l.desde === ant) ?? null;
  const historial = liqs;

  // Semanas sin liquidación entre la primera cargada y esta
  const semanasFaltantes: string[] = [];
  if (todas.length) {
    const hay = new Set(todas.map((t) => t.desde));
    for (let s = todas[0].desde; s < desde; s = sumarDias(s, 7)) if (!hay.has(s)) semanasFaltantes.push(s);
  }

  let maxirest: DatosSemana["maxirest"] = [];
  try { maxirest = await cuadreMaxirest(locales, dias, desde, hasta); } catch { maxirest = []; }

  return {
    desde, hasta, locales, liq, liqAnt, historial, ventas, ventasAnt, ventasAnio, operacion, operacionAnt,
    dias, problemas, cargos, informe: informes[0] ?? null, maxirest, semanasFaltantes,
  };
}

/** PedidosYa por unidad del SOL (suma de los locales de PedidosYa) contra lo cobrado como PedidosYa en Maxirest / planilla */
async function cuadreMaxirest(locales: LocalPeya[], dias: DiaLocal[], desde: string, hasta: string) {
  const unidadDe = new Map(locales.map((l) => [l.nombre_peya, l.unidad]));
  const peyaPorUnidad = new Map<string, number>();
  for (const d of dias) {
    const u = unidadDe.get(d.local);
    if (!u) continue;
    peyaPorUnidad.set(u, (peyaPorUnidad.get(u) ?? 0) + Number(d.bruto));
  }
  if (!peyaPorUnidad.size) return [];
  const unidades = await db.leer<{ id: number; nombre: string; fuente?: string | null }>("unidades", "select=id,nombre,fuente");
  const porNombre = new Map(unidades.map((u) => [u.nombre, u]));
  const ids = [...peyaPorUnidad.keys()].map((u) => porNombre.get(u)?.id).filter((x): x is number => !!x);
  const [cobros, planilla] = await Promise.all([
    db.leerTodo<{ unidad_id: number; forma: string; total: number }>("ventas_cobros", `select=unidad_id,forma,total&unidad_id=in.(${ids.join(",") || 0})&fecha=gte.${desde}&fecha=lte.${hasta}`),
    db.leerTodo<{ unidad_id: number; pedidos_ya: number }>("ventas_planilla", `select=unidad_id,pedidos_ya&unidad_id=in.(${ids.join(",") || 0})&fecha=gte.${desde}&fecha=lte.${hasta}`).catch(() => []),
  ]);
  const esPeya = (forma: string) => R.formasMaxirest.some((f) => normal(forma).includes(normal(f)));
  return [...peyaPorUnidad.entries()].map(([unidad, peya]) => {
    const u = porNombre.get(unidad);
    if (!u) return { unidad, peya, maxirest: null, formas: [] };
    const propios = cobros.filter((c) => c.unidad_id === u.id && esPeya(c.forma));
    const dePlanilla = planilla.filter((p) => p.unidad_id === u.id).reduce((s, p) => s + Number(p.pedidos_ya), 0);
    const total = propios.reduce((s, c) => s + Number(c.total), 0) + dePlanilla;
    const hayDatos = propios.length > 0 || dePlanilla > 0;
    return { unidad, peya, maxirest: hayDatos ? total : null, formas: [...new Set(propios.map((c) => c.forma))] };
  });
}

// ─── CUENTAS DE LA SEMANA ───────────────────────────────────────────────────
/** De cada $100 de venta: a dónde va la plata */
export function deCada100(l: LiquidacionFila) {
  const v = Number(l.ventas) || 0;
  if (!v) return [];
  const p = (x: number | null) => ((Number(x) || 0) / v) * 100;
  const costo = (Number(l.servicio) || 0) + (Number(l.cargos_operativos) || 0) + (Number(l.publicidad) || 0) + (Number(l.reintegros) || 0);
  return [
    { concepto: "Comisión de PedidosYa", pct: p(l.servicio), costo: true },
    { concepto: "Publicidad (Gold VIP + Keywords)", pct: p(l.publicidad), costo: true },
    { concepto: "Cargos (Plus, reclamos, POS, rechazos)", pct: p(l.cargos_operativos), costo: true },
    { concepto: "Reintegros que nos devolvieron", pct: p(l.reintegros), costo: true },
    { concepto: "Costo real de PedidosYa", pct: (costo / v) * 100, costo: true, total: true },
    { concepto: "Impuestos (IVA y percepciones: se recuperan)", pct: p(l.impuestos), costo: false },
    { concepto: "Cuota del préstamo de PedidosYa", pct: p(l.credito), costo: false },
    { concepto: "Pedidos en efectivo (ya cobrados en el local)", pct: -p(l.ventas_fuera), costo: false },
    { concepto: "Llega al banco", pct: p(l.total), costo: false, total: true },
  ];
}

export function semaforoCuadre(difPct: number): Semaforo {
  const a = Math.abs(difPct);
  if (a >= R.cuadre.rojoDesde) return "rojo";
  if (a >= R.cuadre.amarilloDesde) return "amarillo";
  return "verde";
}

// ─── PARA RECLAMAR ──────────────────────────────────────────────────────────
export interface ItemReclamo { concepto: string; monto: number | null; detalle: string; tipo: "reclamar" | "revisar" | "preguntar" }

/** Lo que el panel detecta solo con las reglas del contrato. La tarea semanal agrega lo que encuentra ella. */
export function paraReclamar(d: DatosSemana): ItemReclamo[] {
  const items: ItemReclamo[] = [];
  const l = d.liq;
  if (l) {
    // 1) Publicidad por encima del tope
    const pub = -(Number(l.publicidad) || 0);
    const ventas = Number(l.ventas) || 0;
    if (ventas && pub / ventas * 100 > R.publicidadTopePct) {
      const exceso = pub - ventas * R.publicidadTopePct / 100;
      items.push({ tipo: "reclamar", concepto: `Publicidad por encima del ${R.publicidadTopePct}%`, monto: exceso,
        detalle: `Se cobró ${(pub / ventas * 100).toFixed(2)}% de la venta neta. Base del 4% (bruta o neta) sin definir: pedir el acuerdo firmado.` });
    }
    // 2) Reclamos cobrados sin detalle por pedido
    const cobrados = -(Number(l.cargo_reclamos) || 0);
    const reclamosDetalle = d.cargos.filter((c) => c.tipo === "reclamo");
    const conDetalle = -reclamosDetalle.reduce((s, c) => s + (Number(c.monto) || 0), 0);
    const enPortal = d.problemas.filter((p) => p.con_cargo);
    if (cobrados > 1 && !reclamosDetalle.length && enPortal.length) {
      items.push({ tipo: "revisar", concepto: `Reclamos con cargo: ${enPortal.length} pedidos`, monto: cobrados,
        detalle: `La liquidación descuenta ${Math.round(cobrados).toLocaleString("es-AR")} por reclamos. Revisar cada pedido (lista abajo): si el producto salió bien, se reclama.` });
    } else if (cobrados - conDetalle > 1) {
      items.push({ tipo: "preguntar", concepto: "Reclamos cobrados sin detalle de pedido", monto: cobrados - conDetalle,
        detalle: `La liquidación descuenta ${Math.round(cobrados).toLocaleString("es-AR")} por reclamos y solo hay detalle de ${Math.round(conDetalle).toLocaleString("es-AR")}. Pedir el listado de pedidos.` });
    }
    // 3) Cuenta distinta a la del contrato
    if (l.cuenta && R.cuentaContrato && l.cuenta !== R.cuentaContrato) {
      items.push({ tipo: "preguntar", concepto: "Cuenta de pago distinta a la del contrato", monto: Number(l.total) || null,
        detalle: `La liquidación dice cuenta terminada en ${l.cuenta}; el contrato dice ${R.cuentaContrato}. Confirmar dónde se acredita.` });
    }
  }
  // 4) Reclamos de clientes que devolvieron casi todo el pedido
  for (const c of d.cargos.filter((c) => c.tipo === "reclamo" && c.monto_pedido && c.monto)) {
    const pct = (-(c.monto as number) / (c.monto_pedido as number)) * 100;
    if (pct >= R.reclamoAltoPct) items.push({ tipo: "revisar", concepto: `Reclamo del ${pct.toFixed(0)}% del pedido`, monto: -(c.monto as number),
      detalle: `Pedido ${c.nro} · ${c.local ?? ""} · ${c.motivo ?? ""}. Si fue un producto faltante, no corresponde devolver todo.` });
  }
  // 5) Rechazos por "cerrado" / "no atiende"
  for (const c of d.cargos.filter((c) => c.tipo === "rechazo" && R.rechazosARevisar.some((m) => normal(c.motivo ?? "").includes(m)))) {
    items.push({ tipo: "revisar", concepto: `Rechazo por "${c.motivo}"`, monto: -(Number(c.monto) || 0),
      detalle: `Pedido ${c.nro} · ${c.local ?? ""} · ${c.fecha ?? ""}. Si el local estaba abierto, se reclama el cargo.` });
  }
  // 6) Semanas sin liquidación
  if (d.semanasFaltantes.length) {
    items.push({ tipo: "preguntar", concepto: "Semanas sin liquidación cargada", monto: null,
      detalle: d.semanasFaltantes.map(textoSemana).join(" · ") + ". Verificar en el banco si se cobraron." });
  }
  // 7) Diferencias contra Maxirest
  for (const m of d.maxirest) {
    if (m.maxirest === null || !m.peya) continue;
    const dif = m.peya - m.maxirest;
    if (Math.abs(dif / m.peya * 100) >= R.cuadre.rojoDesde) {
      items.push({ tipo: "revisar", concepto: `No cuadra ${m.unidad} con Maxirest`, monto: dif,
        detalle: `PedidosYa ${Math.round(m.peya).toLocaleString("es-AR")} vs Maxirest ${Math.round(m.maxirest).toLocaleString("es-AR")}. Puede ser por descuentos o pedidos sin cargar.` });
    }
  }
  return items;
}

/** Suma de una columna en una lista (null si no hay datos) */
export function suma<T>(lista: T[], campo: keyof T): number | null {
  const v = lista.map((x) => n(x[campo])).filter((x): x is number => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) : null;
}
