// app/page.tsx — INICIO: resumen de ventas del día
import Link from "next/link";
import { mockDatosVentas, mockComparativo, mockFabrica } from "@/lib/mockData";
import { pesos, porcentaje, variacion, colorVariacion } from "@/lib/formato";
import { Encabezado, Tarjeta, Punto, AvisoDatosPrueba } from "@/components/UI";
import { IconoFlechaDerecha } from "@/components/Iconos";

export default function Inicio() {
  const { totalHoy, totalAyer, locales } = mockDatosVentas;
  const cambio = variacion(totalHoy, totalAyer);
  const ordenados = [...locales].sort((a, b) => b.ventaHoy - a.ventaHoy);
  const maximo = Math.max(...locales.map((l) => l.ventaHoy));
  const atencion = mockComparativo.filter((f) => f.semaforo === "rojo" || f.semaforo === "naranja");

  return (
    <>
      <Encabezado titulo="Inicio" pregunta="¿Cómo viene la empresa hoy?" />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Tarjeta className="text-center">
          <p className="text-sm font-semibold text-slate-900">Venta de Hoy</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{pesos.format(totalHoy)}</p>
          <p className="mt-1 text-xs text-slate-500">Todos los locales</p>
        </Tarjeta>
        <Tarjeta className="text-center">
          <p className="text-sm font-semibold text-slate-900">Venta de Ayer</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{pesos.format(totalAyer)}</p>
          <p className="mt-1 text-xs text-slate-500">Todos los locales</p>
        </Tarjeta>
        <Tarjeta className="text-center">
          <p className="text-sm font-semibold text-slate-900">Hoy vs. Ayer</p>
          <p className={`mt-2 text-3xl font-bold ${colorVariacion(cambio)}`}>{porcentaje(cambio)}</p>
          <p className="mt-1 text-xs text-slate-500">{pesos.format(totalHoy - totalAyer)} de diferencia</p>
        </Tarjeta>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Tarjeta titulo="Ventas por Local" className="lg:col-span-2">
          <ul className="space-y-4">
            {ordenados.map((local) => {
              const v = variacion(local.ventaHoy, local.ventaAyer);
              return (
                <li key={local.id}>
                  <div className="mb-1 flex items-baseline justify-between gap-4 text-sm">
                    <span className="font-medium text-slate-900">{local.nombre}</span>
                    <span className="flex items-baseline gap-3">
                      <span className="text-slate-900">{pesos.format(local.ventaHoy)}</span>
                      <span className={`w-14 text-right text-xs font-medium ${colorVariacion(v)}`}>{porcentaje(v)}</span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-orange-500" style={{ width: `${(local.ventaHoy / maximo) * 100}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Tarjeta>

        <div className="flex flex-col gap-4">
          <Tarjeta titulo="Locales que necesitan atención">
            <ul className="space-y-3">
              {atencion.map((f) => (
                <li key={f.local} className="flex items-start gap-3 text-sm">
                  <Punto color={f.semaforo} className="mt-1 h-3 w-3 shrink-0" />
                  <div>
                    <p className="font-medium text-slate-900">{f.local}</p>
                    <p className="text-xs text-slate-500">{f.novedad}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Link href="/locales" className="mt-4 flex items-center justify-center gap-1 rounded-lg border border-blue-200 bg-blue-50 py-2 text-xs font-medium text-blue-700 hover:bg-blue-100">
              Ver comparativo <IconoFlechaDerecha className="h-3.5 w-3.5" />
            </Link>
          </Tarjeta>

          <Tarjeta titulo="Alertas de Fábrica">
            <ul className="space-y-2.5">
              {mockFabrica.alertas.map((a) => (
                <li key={a} className="flex items-start gap-2.5 text-xs text-slate-700">
                  <Punto color="rojo" className="mt-1 h-2.5 w-2.5 shrink-0" />
                  {a}
                </li>
              ))}
            </ul>
            <Link href="/fabrica" className="mt-4 flex items-center justify-center gap-1 rounded-lg border border-blue-200 bg-blue-50 py-2 text-xs font-medium text-blue-700 hover:bg-blue-100">
              Ver fábrica <IconoFlechaDerecha className="h-3.5 w-3.5" />
            </Link>
          </Tarjeta>
        </div>
      </div>

      <AvisoDatosPrueba />
    </>
  );
}
