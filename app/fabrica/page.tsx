// app/fabrica/page.tsx — ESTADO DE LA FÁBRICA
import type { ReactNode } from "react";
import { mockFabrica, type Semaforo } from "@/lib/mockData";
import { numero, pesos, porcentaje, colorVariacion } from "@/lib/formato";
import { Encabezado, Tarjeta, Punto, AvisoDatosPrueba } from "@/components/UI";
import { IconoAlerta, IconoCheck, IconoPersona, IconoActualizar, IconoBaja } from "@/components/Iconos";

function colorCobertura(dias: number): Semaforo {
  if (dias < 2) return "rojo";
  if (dias < 3) return "naranja";
  return "amarillo";
}

function Kpi({ titulo, valor, unidad, pie, color = "text-slate-900", children }: {
  titulo: string; valor: string; unidad?: string; pie?: string; color?: string; children?: ReactNode;
}) {
  return (
    <Tarjeta className="text-center">
      <p className="text-sm font-semibold text-slate-900">{titulo}</p>
      <p className={`mt-2 text-3xl font-bold ${color}`}>
        {valor}{unidad && <span className="ml-1 text-lg">{unidad}</span>}
      </p>
      {children}
      {pie && <p className="mt-1 text-xs text-slate-500">{pie}</p>}
    </Tarjeta>
  );
}

export default function EstadoFabrica() {
  const f = mockFabrica;
  const cumplimiento = Math.round((f.realizadoHoyKg / f.planHoyKg) * 100);
  const totalEsperada = f.personal.reduce((s, p) => s + p.esperada, 0);
  const totalReal = f.personal.reduce((s, p) => s + p.real, 0);

  return (
    <>
      <Encabezado
        titulo="Estado de la Fábrica"
        pregunta="¿La fábrica está preparada para abastecer correctamente a toda la empresa?"
        extra={
          <div className="flex items-center gap-2 text-sm text-slate-600">
            Planta / Unidad
            <span className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-800">{f.unidad}</span>
          </div>
        }
      />

      {/* Estado general */}
      <Tarjeta className="mb-4">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-500">
            <IconoAlerta className="h-8 w-8" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Estado General</p>
            <p className="font-semibold text-slate-900">{f.estadoGeneral.titulo}</p>
            <p className="text-sm text-slate-500">{f.estadoGeneral.detalle}</p>
          </div>
        </div>
      </Tarjeta>

      {/* Números principales */}
      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Kpi titulo="Producción Ayer" valor={numero.format(f.produccionAyerKg)} unidad="kg" pie="vs mismo día sem. ant.">
          <p className={`mt-1 flex items-center justify-center gap-1 text-sm font-medium ${colorVariacion(f.produccionAyerVsSemAnt)}`}>
            {porcentaje(f.produccionAyerVsSemAnt)} {f.produccionAyerVsSemAnt < 0 && <IconoBaja className="h-4 w-4" />}
          </p>
        </Kpi>
        <Kpi titulo="Producción Hoy (Plan)" valor={numero.format(f.planHoyKg)} unidad="kg" pie="Plan del día" />
        <Kpi titulo="Cumplimiento del Plan" valor={`${cumplimiento}%`} color={cumplimiento < 80 ? "text-orange-500" : "text-green-600"} pie={`${numero.format(f.realizadoHoyKg)} kg realizados`}>
          <div className="mx-auto mt-2 h-2 w-full max-w-[180px] rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-orange-500" style={{ width: `${Math.min(cumplimiento, 100)}%` }} />
          </div>
        </Kpi>
        <Kpi titulo="Pedidos Pendientes de Fabricar" valor={String(f.pedidosPendientes)} color="text-red-600" pie="Órdenes de producción" />
        <Kpi titulo="Pedidos Listos para Despachar" valor={String(f.pedidosListos)} color="text-orange-500" pie="Órdenes listas" />
        <Kpi titulo="Pedidos Despachados Hoy" valor={String(f.pedidosDespachados)} color="text-green-600" pie="Órdenes despachadas" />
      </div>

      {/* Detalle */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Tarjeta titulo="Stock Crítico de Materia Prima" className="xl:col-span-1 md:col-span-2 xl:min-w-0">
          <table className="w-full text-xs">
            <thead className="text-slate-600">
              <tr>
                <th className="py-1.5 text-left font-semibold">Insumo</th>
                <th className="py-1.5 text-center font-semibold">Días de cobertura</th>
                <th className="py-1.5 text-center font-semibold">Estado</th>
                <th className="py-1.5 text-center font-semibold">Compra</th>
              </tr>
            </thead>
            <tbody className="text-slate-700">
              {f.insumos.map((i) => (
                <tr key={i.insumo} className="border-t border-slate-100">
                  <td className="py-2">{i.insumo}</td>
                  <td className="py-2 text-center">{i.diasCobertura.toLocaleString("es-AR")}</td>
                  <td className="py-2 text-center"><Punto color={colorCobertura(i.diasCobertura)} className="h-3 w-3" /></td>
                  <td className="py-2 text-center">{i.compraRealizada ? "Sí" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-slate-500">Responsable: {f.insumos[0]?.responsable}</p>
        </Tarjeta>

        <Tarjeta titulo="Personal" className="xl:col-span-1">
          <table className="w-full text-xs">
            <thead className="text-slate-600">
              <tr>
                <th className="py-1.5 text-left font-semibold">Sector</th>
                <th className="py-1.5 text-center font-semibold">Esperada</th>
                <th className="py-1.5 text-center font-semibold">Real</th>
                <th className="py-1.5 text-center font-semibold">Dif.</th>
              </tr>
            </thead>
            <tbody className="text-slate-700">
              {f.personal.map((p) => (
                <tr key={p.sector} className="border-t border-slate-100">
                  <td className="py-2">{p.sector}</td>
                  <td className="py-2 text-center">{p.esperada}</td>
                  <td className="py-2 text-center">{p.real}</td>
                  <td className={`py-2 text-center font-medium ${colorVariacion(p.real - p.esperada)}`}>{p.real - p.esperada}</td>
                </tr>
              ))}
              <tr className="border-t border-slate-200 font-semibold text-slate-900">
                <td className="py-2">Total</td>
                <td className="py-2 text-center">{totalEsperada}</td>
                <td className="py-2 text-center">{totalReal}</td>
                <td className={`py-2 text-center ${colorVariacion(totalReal - totalEsperada)}`}>{totalReal - totalEsperada}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-xs font-semibold text-slate-900">Ausencias clave hoy</p>
          <ul className="mt-1.5 space-y-1.5">
            {f.ausenciasClave.map((a) => (
              <li key={a} className="flex items-center gap-2 text-xs text-slate-700">
                <IconoPersona className="h-3.5 w-3.5 text-red-600" />{a}
              </li>
            ))}
          </ul>
        </Tarjeta>

        <Tarjeta titulo="Check-in Diario">
          {f.checkIn.realizado ? (
            <div className="inline-flex items-center gap-2 rounded-full bg-green-50 px-4 py-2 font-medium text-green-700">
              <IconoCheck className="h-5 w-5" /> Realizado
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-full bg-red-50 px-4 py-2 font-medium text-red-700">Pendiente</div>
          )}
          <p className="mt-4 text-xs text-slate-600">Realizado por: <span className="font-semibold text-slate-900">{f.checkIn.por}</span></p>
          <p className="mt-1 text-xs text-slate-600">Hora: <span className="font-semibold text-slate-900">{f.checkIn.hora}</span></p>
          <p className="mt-4 rounded-lg border border-blue-200 bg-blue-50 py-2 text-center text-xs font-medium text-blue-700">
            {f.checkIn.novedades} novedades
          </p>
        </Tarjeta>

        <Tarjeta titulo="Compras Pendientes" className="text-center">
          <p className="text-3xl font-bold text-slate-900">{f.compras.ordenes}</p>
          <p className="text-xs text-slate-500">Órdenes de compra</p>
          <p className="mt-4 text-2xl font-bold text-slate-900">{pesos.format(f.compras.montoPendiente)}</p>
          <p className="text-xs text-slate-500">Monto pendiente</p>
        </Tarjeta>

        <Tarjeta titulo="Alertas Críticas">
          <ul className="space-y-3">
            {f.alertas.map((a) => (
              <li key={a} className="flex items-start gap-2.5 text-xs text-slate-700">
                <Punto color="rojo" className="mt-0.5 h-2.5 w-2.5 shrink-0" />{a}
              </li>
            ))}
          </ul>
        </Tarjeta>
      </div>

      <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
        <IconoActualizar className="h-4 w-4" /> Datos actualizados hoy a las {f.actualizado} hs
      </p>
      <AvisoDatosPrueba />
    </>
  );
}
