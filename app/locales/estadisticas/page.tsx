// app/locales/estadisticas/page.tsx — ESTADÍSTICAS DE VENTAS
// Se entra desde el botón "Estadísticas" del Comparativo de Locales y desde Inicio (no es un ítem nuevo del menú).
// Todo sale de los datos reales (Maxirest, HIOPOS y planilla). Períodos fijos, sin opciones para elegir.
import Link from "next/link";
import type { ReactNode } from "react";
import { obtenerEstadisticas } from "@/lib/estadisticas";
import { pesos, numero, porcentaje, variacion, colorVariacion } from "@/lib/formato";
import { Encabezado, Fuente, Tarjeta } from "@/components/UI";
import { BarrasApiladas, MapaCalor, BarrasReparto, RankingArticulos, corto } from "@/components/Graficos";

export const dynamic = "force-dynamic";

const fechaLarga = (f: string) =>
  new Date(f + "T12:00:00Z").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

function Dato({ titulo, valor, actual, anterior, pie }: { titulo: string; valor: string; actual?: number; anterior?: number; pie?: string }) {
  const v = actual !== undefined && anterior ? variacion(actual, anterior) : null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium text-slate-500">{titulo}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{valor}</p>
      {v !== null && <p className={`mt-0.5 text-xs font-medium ${colorVariacion(v)}`}>{porcentaje(Math.round(v * 10) / 10)} vs mes anterior</p>}
      {pie && <p className="mt-0.5 text-xs text-slate-500">{pie}</p>}
    </div>
  );
}

const Nota = ({ children }: { children: ReactNode }) => <p className="mt-3 text-xs text-slate-500">{children}</p>;

export default async function Estadisticas() {
  const e = await obtenerEstadisticas();
  const volver = <Link href="/locales" className="mb-3 inline-block text-xs text-blue-600 hover:underline">← Comparativo de Locales</Link>;
  if (!e) {
    return (
      <>
        {volver}
        <Encabezado titulo="Estadísticas de ventas" pregunta="¿Cómo vienen las ventas y dónde están las oportunidades?" extra={<Fuente real={false} />} />
        <p className="rounded-xl border border-slate-200 bg-white py-12 text-center text-slate-500">Las estadísticas se arman con los datos reales: todavía no hay conexión con la base.</p>
      </>
    );
  }
  const k = e.kpi;
  const mesTexto = new Date(k.mes + "-15T12:00:00Z").toLocaleDateString("es-AR", { month: "long", timeZone: "UTC" });

  return (
    <>
      {volver}
      <Encabezado titulo="Estadísticas de ventas" pregunta="¿Cómo vienen las ventas y dónde están las oportunidades?" extra={<Fuente real />} />

      {/* 1. El mes en una mirada (locales de La Leñita, sin fábrica ni Molinos/Tocka) */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Dato titulo={k.cerrado ? `Venta de ${mesTexto} (mes cerrado)` : `Venta de ${mesTexto} (al día ${k.diasTranscurridos})`} valor={corto(k.ventaMes)} actual={k.ventaMes} anterior={k.ventaMesAnt} />
        {k.cerrado
          ? <Dato titulo="Promedio por día" valor={corto(k.ventaMes / k.diasMes)} pie={`${k.diasMes} días`} />
          : <Dato titulo="Si sigue a este ritmo, cierra el mes en" valor={corto(k.proyeccion)} pie={`${k.diasTranscurridos} de ${k.diasMes} días`} />}
        <Dato titulo="Ticket promedio" valor={pesos.format(k.ticketProm)} actual={k.ticketProm} anterior={k.ticketPromAnt} />
        <Dato titulo="Tickets" valor={numero.format(k.tickets)} actual={k.tickets} anterior={k.ticketsAnt} />
        <Dato titulo="Mejor día del mes" valor={k.mejorDia ? corto(k.mejorDia.venta) : "—"} pie={k.mejorDia ? fechaLarga(k.mejorDia.fecha) : undefined} />
      </div>

      {/* 2. Evolución */}
      <Tarjeta titulo="Venta mensual de los locales">
        <BarrasApiladas datos={e.mensualLocales} />
        <Nota>Últimos 12 meses. * = mes en curso (todavía no terminó). Pasá el mouse por cada mes para ver el detalle por local.</Nota>
      </Tarjeta>

      {/* 3. Cuándo se vende */}
      <div className="mt-6 grid gap-6 2xl:grid-cols-2 [&>*]:min-w-0">
        <Tarjeta titulo="Venta promedio por día de la semana">
          <MapaCalor datos={e.diaSemana} formato={corto} />
          <Nota>Últimas 8 semanas, promedio de los días que el local abrió. Más oscuro = mejor día de ese local.</Nota>
        </Tarjeta>
        <Tarjeta titulo="¿A qué hora se vende?">
          <MapaCalor datos={e.hora} formato={(n) => `${Math.round(n)}%`} ancho1="w-32" />
          <Nota>Últimas 8 semanas: qué parte de la venta de cada local entra en cada hora. Más oscuro = hora más fuerte de ese local.</Nota>
        </Tarjeta>
      </div>

      {/* 4. Cómo se vende y cómo se cobra */}
      <div className="mt-6 grid gap-6 xl:grid-cols-2 [&>*]:min-w-0">
        <Tarjeta titulo="Canales de venta">
          <BarrasReparto datos={e.canales} />
          <Nota>Últimos 30 días, según el tipo de cada ticket (mostrador, delivery, Pedidos Ya…).</Nota>
        </Tarjeta>
        <Tarjeta titulo="Formas de cobro">
          <BarrasReparto datos={e.cobros} />
          <Nota>Últimos 30 días. Las formas menos usadas se juntan en &quot;Otros&quot;.</Nota>
        </Tarjeta>
      </div>

      {/* 5. Qué se vende */}
      <Tarjeta titulo="Los 15 artículos que más venden" className="mt-6">
        <RankingArticulos lista={e.top} />
        <Nota>Últimos 30 días, todos los locales juntos, comparado con los 30 días anteriores.</Nota>
      </Tarjeta>

      {/* 6. Fábrica y Molinos/Tocka, siempre aparte */}
      <div className="mt-6 grid gap-6 2xl:grid-cols-2 [&>*]:min-w-0">
        <Tarjeta titulo="Fábrica: venta mensual por concepto">
          <BarrasApiladas datos={e.mensualFabrica} />
          <Nota>Últimos 12 meses. &quot;Ventas a locales propios&quot; son las ventas a nuestros locales (no se suman a Mayorista).</Nota>
        </Tarjeta>
        <Tarjeta titulo="Molinos y Tocka: venta mensual">
          <BarrasApiladas datos={e.mensualAparte} />
          <Nota>Últimos 12 meses, según la planilla. Van aparte: no se suman a La Leñita.</Nota>
        </Tarjeta>
      </div>
    </>
  );
}
