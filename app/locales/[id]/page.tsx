// app/locales/[id]/page.tsx — DETALLE DE UN LOCAL
// Se entra tocando el nombre del local en "Comparativo de Locales" (no es un ítem nuevo del menú).
// Muestra, para una fecha o un rango: resumen por turno, formas de cobro, artículos y tickets.
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  obtenerUnidades, obtenerTurnos, obtenerDetalle, leerRango, textoRango, hayBase,
  resumenPorTurno, cobrosResumen, articulosPorRubro,
} from "@/lib/detalle";
import { Encabezado, Fuente } from "@/components/UI";
import { SelectorRango, NotaTurnos, TablaTurnos, TablaCobros, TablaArticulos, TablaTickets } from "@/components/Detalle";

export default async function DetalleLocal({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const unidades = await obtenerUnidades();
  const unidad = unidades.find((u) => String(u.id) === id);
  if (!unidad) return redirect("/locales");
  if (unidad.tipo === "fabrica") return redirect("/fabrica"); // la fábrica se ve aparte

  const { desde, hasta } = leerRango(sp);
  const [turnos, d] = await Promise.all([obtenerTurnos("local"), obtenerDetalle([unidad.id], desde, hasta)]);
  const porTurno = resumenPorTurno(d.tickets, turnos);
  const cobros = cobrosResumen(d.cobros);
  const arts = articulosPorRubro(d.articulos);
  const locales = unidades.filter((u) => u.tipo === "local");
  const base = `/locales/${unidad.id}`;
  const rangoUrl = `?desde=${desde}&hasta=${hasta}`;

  return (
    <>
      <Link href="/locales" className="mb-3 inline-block text-xs text-blue-600 hover:underline">← Comparativo de Locales</Link>
      <Encabezado titulo={unidad.nombre} pregunta={`Detalle de ventas · ${textoRango(desde, hasta)}`} extra={<Fuente real={hayBase()} />} />

      <div className="mb-4 flex flex-wrap gap-2">
        {locales.map((u) => (
          <Link key={u.id} href={`/locales/${u.id}${rangoUrl}`} scroll={false}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm ${u.id === unidad.id ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
            {u.nombre}
          </Link>
        ))}
      </div>

      <SelectorRango base={base} desde={desde} hasta={hasta} />

      {!d.tickets.length && !d.articulos.length ? (
        <p className="rounded-xl border border-slate-200 bg-white py-12 text-center text-slate-500">
          No hay ventas cargadas para {textoRango(desde, hasta)}.
          <span className="mt-1 block text-xs text-slate-400">Puede que el local no haya cerrado en su sistema (Maxirest o HIOPOS), que la feria haya estado cerrada o que todavía no se haya cargado ese período.</span>
        </p>
      ) : (
        <>
          <NotaTurnos turnos={turnos} />
          <div className="grid gap-4 2xl:grid-cols-5">
            <div className="2xl:col-span-3"><TablaTurnos filas={porTurno} /></div>
            <div className="2xl:col-span-2"><TablaCobros {...cobros} /></div>
          </div>
          <div className="mt-4"><TablaArticulos grupos={arts.grupos} turnos={arts.turnos} /></div>
          <div className="mt-4"><TablaTickets tickets={d.tickets} turnos={turnos} /></div>
        </>
      )}
    </>
  );
}
