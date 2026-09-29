// lib/calculos.ts — Cálculos compartidos entre pantallas (nada de esto se escribe a mano)
import { mockVentas, mockDetalleLocales, mockFabrica, mockTesoreria, mockEstadoDatos } from "./mockData";
import { semaforoVentas, semaforoStock, semaforoPago, semaforoCobro, type Semaforo } from "./config";
import { variacion, pesos } from "./formato";

const gravedad: Record<Semaforo, number> = { rojo: 0, amarillo: 1, gris: 2, verde: 3 };
export const peor = (...s: Semaforo[]) => s.reduce((a, b) => (gravedad[b] < gravedad[a] ? b : a), "verde" as Semaforo);

/* Insumos: días de cobertura y estado ("en camino" si ya se compró) */
export function insumosCalculados() {
  return mockFabrica.insumos.map((i) => {
    const dias = i.stockActual / i.consumoDiario;
    const estado = semaforoStock(dias);
    const enCamino = estado !== "verde" && i.compraRealizada;
    return { ...i, dias, estado, enCamino, estadoMostrado: (enCamino ? "gris" : estado) as Semaforo };
  });
}

/* Comparativo de locales */
export function comparativoLocales() {
  const insumosRojos = insumosCalculados().filter((i) => i.estadoMostrado === "rojo");
  return mockDetalleLocales
    .map((d) => {
      const v = mockVentas.unidades.find((u) => u.nombre === d.nombre)!;
      const varPct = variacion(v.ventaAyer, v.ventaMismoDiaSemAnt);
      const semVentas = semaforoVentas(varPct);
      const semStock: Semaforo = d.area === "Stock" && insumosRojos.length > 0 ? "rojo" : "verde";
      return {
        ...d,
        ventaAyer: v.ventaAyer,
        ventaMes: v.ventaMes,
        variacion: varPct,
        ticketPromedio: v.ventaAyer / v.comprobantesAyer,
        semaforo: peor(semVentas, semStock),
      };
    })
    .sort((a, b) => gravedad[a.semaforo] - gravedad[b.semaforo] || a.prioridad - b.prioridad);
}

/* Tesorería */
export function tesoreriaCalculada() {
  const t = mockTesoreria;
  const disponible = t.cuentas.reduce((s, c) => s + c.monto, 0);
  const pagos = [...t.pagos].sort((a, b) => a.venceEnDias - b.venceEnDias).map((p) => ({ ...p, estado: semaforoPago(p.venceEnDias) }));
  const cobros = [...t.cobros].sort((a, b) => a.venceEnDias - b.venceEnDias).map((c) => ({ ...c, estado: semaforoCobro(c.venceEnDias) }));
  const pagos7 = pagos.filter((p) => p.venceEnDias >= 0 && p.venceEnDias <= 7).reduce((s, p) => s + p.monto, 0);
  const cobros7 = cobros.filter((c) => c.venceEnDias >= 0 && c.venceEnDias <= 7).reduce((s, c) => s + c.monto, 0);
  return {
    disponible,
    pagos,
    cobros,
    pagos7,
    cobros7,
    saldoProyectado: disponible + cobros7 - pagos7,
    diasCobertura: t.gastoNetoDiarioPromedio > 0 ? disponible / t.gastoNetoDiarioPromedio : null,
  };
}

/* Alertas para Inicio: solo lo que requiere acción */
export interface Alerta { texto: string; responsable: string; href: string; color: Semaforo }

export function alertas(): Alerta[] {
  const lista: Alerta[] = [];
  for (const l of comparativoLocales()) {
    if (l.semaforo === "rojo" && l.area === "Ventas")
      lista.push({ texto: `${l.nombre}: venta de ayer ${l.variacion.toFixed(1).replace(".", ",")}% vs. semana anterior`, responsable: l.responsable, href: "/locales", color: "rojo" });
  }
  for (const i of insumosCalculados()) {
    if (i.estadoMostrado === "rojo")
      lista.push({ texto: `Comprar ${i.insumo}: ${i.dias.toFixed(1).replace(".", ",")} días de cobertura`, responsable: i.responsable, href: "/fabrica", color: "rojo" });
  }
  const t = tesoreriaCalculada();
  for (const p of t.pagos.filter((p) => p.estado === "rojo"))
    lista.push({ texto: `Cubrir pago a ${p.proveedor} (${pesos.format(p.monto)}), vence ${p.venceEnDias === 0 ? "hoy" : "mañana"}`, responsable: p.responsable, href: "/tesoreria", color: "rojo" });
  for (const c of t.cobros.filter((c) => c.estado === "rojo"))
    lista.push({ texto: `Cobro vencido: ${c.cliente} (${pesos.format(c.monto)})`, responsable: c.responsable, href: "/tesoreria", color: "rojo" });
  for (const a of mockFabrica.ausentes.filter((a) => a.clave))
    lista.push({ texto: `Falta persona clave en fábrica: ${a.nombre}`, responsable: "Pablo", href: "/fabrica", color: "amarillo" });
  return lista;
}

export function datosAtrasados() {
  return mockEstadoDatos.filter((d) => d.estado !== "OK");
}

/* Resumen ejecutivo en una frase (no inventa causas) */
export function resumenEjecutivo(): string {
  const locales = comparativoLocales().filter((l) => l.semaforo === "rojo" && l.area === "Ventas").map((l) => l.nombre);
  const insumos = insumosCalculados().filter((i) => i.estadoMostrado === "rojo").map((i) => i.insumo.toLowerCase());
  const pagosUrg = tesoreriaCalculada().pagos.filter((p) => p.estado === "rojo").length;
  const atrasados = mockEstadoDatos.filter((d) => d.estado === "Atrasado").map((d) => d.fuente.toLowerCase());

  const partes: string[] = [];
  if (locales.length) partes.push(`revisar ${locales.join(" y ")} por caída de ventas`);
  if (insumos.length) partes.push(`comprar ${insumos.join(" y ")} por cobertura crítica`);
  if (pagosUrg) partes.push(`cubrir ${pagosUrg} ${pagosUrg === 1 ? "pago urgente" : "pagos urgentes"}`);
  if (atrasados.length) partes.push(`pedir actualización de ${atrasados.join(" y ")}`);

  if (!partes.length) return "La operación general está estable. No hay temas que requieran acción hoy.";
  const texto = partes.length > 1 ? `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}` : partes[0];
  return `Requiere atención hoy: ${texto}.`;
}
