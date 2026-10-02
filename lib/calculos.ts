// lib/calculos.ts — Cálculos compartidos entre pantallas (nada de esto se escribe a mano)
import { mockFabrica, mockTesoreria, mockEstadoDatos, type EstadoDato } from "./mockData";
import { semaforoVentas, semaforoStock, semaforoPago, semaforoCobro, type Semaforo } from "./config";
import { variacion, pesos, decimal } from "./formato";
import type { ResumenVentas } from "./ventas";

const gravedad: Record<Semaforo, number> = { rojo: 0, amarillo: 1, gris: 2, verde: 3 };
export const peor = (...s: Semaforo[]) => s.reduce((a, b) => (gravedad[b] < gravedad[a] ? b : a), "verde" as Semaforo);

/* ───────── Ventas / Comparativo de locales ───────── */

export function comparativoLocales(r: ResumenVentas) {
  return r.unidades
    .map((u) => {
      const tieneAyer = u.ventaAyer !== null;
      const varPct = tieneAyer && u.ventaMismoDiaSemAnt ? variacion(u.ventaAyer!, u.ventaMismoDiaSemAnt) : null;
      const ticket = tieneAyer && u.comprobantesAyer ? u.ventaAyer! / u.comprobantesAyer : null;
      const ticketSemAnt = u.ventaMismoDiaSemAnt && u.comprobantesSemAnt ? u.ventaMismoDiaSemAnt / u.comprobantesSemAnt : null;
      // El semáforo (y las alertas) se basan en la SEMANA EN CURSO contra los mismos días de la semana pasada:
      // un solo día salta mucho (lluvia, feriado, cierre tarde); la semana es más estable.
      const varSemana = u.semanaAnt > 0 && u.semana > 0 ? variacion(u.semana, u.semanaAnt) : null;
      const varMes = u.mesAnt > 0 ? variacion(u.ventaMes, u.mesAnt) : null;
      const semaforo: Semaforo = varSemana === null ? "gris" : semaforoVentas(varSemana);
      const tendencia = u.previos7 > 0 ? variacion(u.ultimos7, u.previos7) : null;

      let recomendacion = "Sin acción necesaria";
      if (!tieneAyer) recomendacion = u.fuente === "planilla" ? "Sin venta cargada en la planilla (¿día cerrado?)" : u.fuente === "hiopos" ? "Sin venta ayer en HIOPOS (¿feria cerrada?)" : "Verificar cierre y sincronización de Maxirest";
      else if (varSemana === null) recomendacion = "Sin comparación (no hay datos de la semana anterior)";
      else if (semaforo !== "verde") {
        if (ticket !== null && ticketSemAnt !== null && ticket < ticketSemAnt) recomendacion = "Revisar ticket promedio";
        else recomendacion = "Revisar cantidad de tickets";
      }

      return {
        id: u.id,
        nombre: u.nombre,
        tipo: u.tipo,
        grupo: u.grupo,
        fuente: u.fuente,
        ventaAyer: u.ventaAyer,
        ventaMes: u.ventaMes,
        variacion: varPct,
        semana: u.semana,
        varSemana,
        varMes,
        ticketPromedio: ticket,
        area: "Ventas",
        tendencia,
        responsable: "Romina",
        ultimoDia: u.ultimoDia,
        recomendacion,
        semaforo,
      };
    })
    .sort((a, b) => gravedad[a.semaforo] - gravedad[b.semaforo] || (a.varSemana ?? 0) - (b.varSemana ?? 0));
}

/* ───────── Fábrica (datos de prueba) ───────── */

export function insumosCalculados() {
  return mockFabrica.insumos.map((i) => {
    const dias = i.stockActual / i.consumoDiario;
    const estado = semaforoStock(dias);
    const enCamino = estado !== "verde" && i.compraRealizada;
    return { ...i, dias, estado, enCamino, estadoMostrado: (enCamino ? "gris" : estado) as Semaforo };
  });
}

/* ───────── Tesorería (datos de prueba) ───────── */

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

/* ───────── Estado de los datos ───────── */

export function estadoDatos(r: ResumenVentas) {
  const fechaCorta = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;
  let ventas: { fuente: string; ultimoDato: string; estado: EstadoDato; responsable: string; escalamiento: string; prueba: boolean };
  if (!r.real) {
    ventas = { ...mockEstadoDatos[0], prueba: true };
  } else {
    const mx = r.unidades.filter((u) => u.fuente === "maxirest");
    const faltan = mx.filter((u) => u.ventaAyer === null).map((u) => u.nombre);
    const hora = r.ultimaCarga
      ? new Date(r.ultimaCarga).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" })
      : "nunca";
    ventas = {
      fuente: "Ventas (Maxirest)",
      ultimoDato: `Carga ${hora} · ayer ${fechaCorta(r.ayer)}: ${mx.length - faltan.length} de ${mx.length} (locales y fábrica)`,
      estado: !r.ultimaCargaOk ? "Atrasado" : faltan.length ? "Pendiente" : "OK",
      responsable: "Romina",
      escalamiento: "Augusto",
      prueba: false,
    };
  }
  return [ventas, ...mockEstadoDatos.slice(1).map((d) => ({ ...d, prueba: true }))];
}

/* ───────── Alertas para Inicio: solo lo que requiere acción ───────── */

export interface Alerta { texto: string; responsable: string; href: string; color: Semaforo; prueba: boolean }

export function alertas(r: ResumenVentas): Alerta[] {
  const lista: Alerta[] = [];
  for (const l of comparativoLocales(r)) {
    if (l.ventaAyer === null && l.fuente === "maxirest")
      lista.push({ texto: `${l.nombre}: sin datos de ventas de ayer (falta cierre o sincronización)`, responsable: l.responsable, href: "/locales", color: "gris", prueba: !r.real });
    else if (l.semaforo === "rojo")
      lista.push({ texto: `${l.nombre}: semana (${r.semanaTexto}) ${decimal(l.varSemana!)}% vs. los mismos días de la semana pasada`, responsable: l.responsable, href: "/locales", color: "rojo", prueba: !r.real });
  }
  for (const i of insumosCalculados()) {
    if (i.estadoMostrado === "rojo")
      lista.push({ texto: `Comprar ${i.insumo}: ${decimal(i.dias)} días de cobertura`, responsable: i.responsable, href: "/fabrica", color: "rojo", prueba: true });
  }
  const t = tesoreriaCalculada();
  for (const p of t.pagos.filter((p) => p.estado === "rojo"))
    lista.push({ texto: `Cubrir pago a ${p.proveedor} (${pesos.format(p.monto)}), vence ${p.venceEnDias === 0 ? "hoy" : "mañana"}`, responsable: p.responsable, href: "/tesoreria", color: "rojo", prueba: true });
  for (const c of t.cobros.filter((c) => c.estado === "rojo"))
    lista.push({ texto: `Cobro vencido: ${c.cliente} (${pesos.format(c.monto)})`, responsable: c.responsable, href: "/tesoreria", color: "rojo", prueba: true });
  for (const a of mockFabrica.ausentes.filter((a) => a.clave))
    lista.push({ texto: `Falta persona clave en fábrica: ${a.nombre}`, responsable: "Pablo", href: "/fabrica", color: "amarillo", prueba: true });
  return lista;
}

/* Resumen ejecutivo en una frase (solo con datos reales; no inventa causas) */
export function resumenEjecutivo(r: ResumenVentas): string {
  const filas = comparativoLocales(r);
  const caidas = filas.filter((l) => l.semaforo === "rojo").map((l) => l.nombre);
  const sinDatos = filas.filter((l) => l.ventaAyer === null && l.fuente === "maxirest").map((l) => l.nombre);

  const partes: string[] = [];
  if (caidas.length) partes.push(`revisar ${unir(caidas)} por caída de ventas`);
  if (sinDatos.length) partes.push(`verificar el cierre de ${unir(sinDatos)} (no llegaron las ventas de ayer)`);

  const prefijo = r.real ? "" : "(Datos de prueba) ";
  if (!partes.length) return `${prefijo}Las ventas de ayer están dentro de lo normal en todos los locales.`;
  return `${prefijo}Requiere atención: ${unir(partes)}.`;
}

function unir(xs: string[]) {
  return xs.length > 1 ? `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}` : xs[0];
}
