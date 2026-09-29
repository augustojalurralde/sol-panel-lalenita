// app/page.tsx — INICIO / CENTRO DE DIRECCIÓN
import Link from "next/link";
import { mockVentas, mockEstadoDatos } from "@/lib/mockData";
import { semaforoVentas } from "@/lib/config";
import { pesos, porcentaje, variacion } from "@/lib/formato";
import { alertas, resumenEjecutivo, tesoreriaCalculada } from "@/lib/calculos";
import { Encabezado, Tarjeta, Punto, Pastilla, SinDefinir, AvisoDatosPrueba, colorTexto } from "@/components/UI";
import { IconoFlechaDerecha, IconoAlerta, IconoCheck } from "@/components/Iconos";

const colorEstadoDato = { OK: "verde", Pendiente: "amarillo", Atrasado: "rojo" } as const;

export default function Inicio() {
  const v = mockVentas;
  const varAyer = variacion(v.totalAyer, v.totalMismoDiaSemAnt);
  const semAyer = semaforoVentas(varAyer);
  const ticket = v.totalAyer / v.comprobantesAyer;
  const { disponible } = tesoreriaCalculada();
  const listaAlertas = alertas();
  const resumen = resumenEjecutivo();
  const estable = listaAlertas.length === 0;

  const unidades = [...v.unidades]
    .map((u) => ({ ...u, var: variacion(u.ventaAyer, u.ventaMismoDiaSemAnt) }))
    .sort((a, b) => b.ventaAyer - a.ventaAyer);
  const maximo = Math.max(...unidades.map((u) => u.ventaAyer));

  return (
    <>
      <Encabezado titulo="Inicio" pregunta="¿Cómo está la empresa hoy y qué necesita mi atención?" />

      {/* 1. Estado de los datos */}
      <Tarjeta titulo="Estado de los datos" className="mb-4">
        <div className="flex flex-wrap gap-2">
          {mockEstadoDatos.map((d) => (
            <div key={d.fuente} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs">
              <Punto color={colorEstadoDato[d.estado]} className="h-2.5 w-2.5" />
              <span className="font-medium text-slate-900">{d.fuente}</span>
              <span className="text-slate-500">{d.ultimoDato}</span>
              {d.estado !== "OK" && (
                <span className={colorTexto(colorEstadoDato[d.estado])}>
                  · {d.estado} ({d.responsable} → {d.escalamiento})
                </span>
              )}
            </div>
          ))}
        </div>
      </Tarjeta>

      {/* 2. Resumen ejecutivo */}
      <section className={`mb-4 flex items-start gap-4 rounded-xl border p-5 ${estable ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50"}`}>
        <div className={estable ? "text-green-600" : "text-yellow-600"}>
          {estable ? <IconoCheck className="h-7 w-7" /> : <IconoAlerta className="h-7 w-7" />}
        </div>
        <div>
          <p className="text-xs text-slate-500">Resumen ejecutivo</p>
          <p className="font-semibold text-slate-900">{resumen}</p>
        </div>
      </section>

      {/* 3. Números principales */}
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tarjeta className="text-center">
          <p className="text-sm font-semibold text-slate-900">Venta de Ayer</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">{pesos.format(v.totalAyer)}</p>
          <p className={`mt-1 text-sm font-medium ${colorTexto(semAyer)}`}>{porcentaje(varAyer)}</p>
          <p className="text-xs text-slate-500">vs. mismo día sem. ant.</p>
        </Tarjeta>
        <Tarjeta className="text-center">
          <p className="text-sm font-semibold text-slate-900">Venta de Hoy</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">{pesos.format(v.totalHoy)}</p>
          <p className="mt-1 text-xs text-slate-500">En curso</p>
          <SinDefinir texto="Comparación sin definir" />
        </Tarjeta>
        <Tarjeta className="text-center">
          <p className="text-sm font-semibold text-slate-900">Venta del Mes</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">{pesos.format(v.totalMes)}</p>
          <p className="mt-1 text-xs text-slate-500">Ticket promedio ayer: {pesos.format(ticket)}</p>
          <SinDefinir texto="Presupuesto sin definir" />
        </Tarjeta>
        <Link href="/tesoreria" className="block">
          <Tarjeta className="h-full text-center hover:border-blue-300">
            <p className="text-sm font-semibold text-slate-900">Disponible Total</p>
            <p className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">{pesos.format(disponible)}</p>
            <p className="mt-1 text-xs text-slate-500">Cajas + bancos + Mercado Pago</p>
            <p className="text-xs text-blue-600">Ver tesorería →</p>
          </Tarjeta>
        </Link>
      </div>

      {/* 4. Ventas por unidad + Alertas */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Tarjeta titulo="Venta de ayer por unidad" derecha={<span className="text-xs text-slate-500">vs. mismo día sem. ant.</span>} className="lg:col-span-3">
          <ul className="space-y-4">
            {unidades.map((u) => {
              const s = semaforoVentas(u.var);
              return (
                <li key={u.id}>
                  <div className="mb-1 flex items-baseline justify-between gap-4 text-sm">
                    <span className="flex items-center gap-2 font-medium text-slate-900"><Punto color={s} className="h-2.5 w-2.5" />{u.nombre}</span>
                    <span className="flex items-baseline gap-3">
                      <span className="text-slate-900">{pesos.format(u.ventaAyer)}</span>
                      <span className={`w-14 text-right text-xs font-medium ${colorTexto(s)}`}>{porcentaje(u.var)}</span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-blue-600" style={{ width: `${(u.ventaAyer / maximo) * 100}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
          <Link href="/locales" className="mt-4 flex items-center justify-center gap-1 rounded-lg border border-blue-200 bg-blue-50 py-2 text-xs font-medium text-blue-700 hover:bg-blue-100">
            Ver comparativo de locales <IconoFlechaDerecha className="h-3.5 w-3.5" />
          </Link>
        </Tarjeta>

        <Tarjeta titulo="Alertas que requieren acción" className="lg:col-span-2">
          {listaAlertas.length === 0 ? (
            <p className="text-sm text-slate-500">No hay alertas.</p>
          ) : (
            <ul className="space-y-3">
              {listaAlertas.map((a) => (
                <li key={a.texto}>
                  <Link href={a.href} className="flex items-start gap-3 rounded-lg p-1 hover:bg-slate-50">
                    <Punto color={a.color} className="mt-1 h-2.5 w-2.5" />
                    <span className="flex-1 text-sm text-slate-800">{a.texto}</span>
                    <Pastilla color="gris">{a.responsable}</Pastilla>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>

      <AvisoDatosPrueba />
    </>
  );
}
