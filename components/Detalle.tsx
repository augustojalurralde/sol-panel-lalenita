// components/Detalle.tsx — Piezas del detalle de ventas (se usan en Locales y en Fábrica)
import Link from "next/link";
import type { ReactNode } from "react";
import {
  atajos, fechaCorta, nombreConcepto, turnoPorHora, TURNO_MAXIREST,
  type FilaTurno, type FilaCobro, type GrupoRubro, type Ticket, type TurnoConfig,
} from "@/lib/detalle";
import { pesos, numero } from "@/lib/formato";
import { Tarjeta } from "./UI";

const th = "px-3 py-2.5 text-xs font-semibold text-slate-700 align-bottom";
const td = "whitespace-nowrap px-3 py-2 text-right";
const nombreTurnoMx = (t: number) => TURNO_MAXIREST[t] ?? `Turno ${t}`;

/** Elegir fecha o rango: atajos + dos casilleros de fecha (funciona sin JavaScript) */
export function SelectorRango({ base, desde, hasta, extra }: { base: string; desde: string; hasta: string; extra?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="flex flex-wrap gap-2">
        {atajos().map((a) => {
          const activo = a.desde === desde && a.hasta === hasta;
          return (
            <Link key={a.texto} href={`${base}?desde=${a.desde}&hasta=${a.hasta}`} scroll={false}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm ${activo ? "bg-blue-600 text-white" : "border border-slate-200 text-slate-700 hover:bg-slate-50"}`}>
              {a.texto}
            </Link>
          );
        })}
      </div>
      <form key={`${desde}-${hasta}`} action={base} className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
        <label className="flex items-center gap-1.5">Desde
          <input type="date" name="desde" defaultValue={desde} className="rounded-lg border border-slate-200 px-2 py-1.5 text-slate-800" />
        </label>
        <label className="flex items-center gap-1.5">Hasta
          <input type="date" name="hasta" defaultValue={hasta} className="rounded-lg border border-slate-200 px-2 py-1.5 text-slate-800" />
        </label>
        <button className="rounded-lg bg-slate-900 px-3 py-1.5 text-white hover:bg-slate-700">Ver</button>
      </form>
      {extra}
    </div>
  );
}

/** Aclaración sobre de dónde sale el turno en cada cuadro */
export function NotaTurnos({ turnos }: { turnos: TurnoConfig[] }) {
  const texto = turnos.map((t) => `${t.nombre} ${t.desde.slice(0, 5)} a ${t.hasta.slice(0, 5)}`).join(" · ");
  return (
    <p className="mb-4 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-900">
      <b>Cómo se arman los turnos:</b> el resumen y los tickets usan la <b>hora de entrada</b> de cada ticket ({texto}; lo demás es &quot;Fuera de turno&quot;).
      Las formas de cobro y los artículos usan el <b>turno de Maxirest</b> (&quot;Mañana&quot; se muestra como Mediodía). Por eso pueden diferir un poco.
    </p>
  );
}

/** Resumen por turno (tickets por hora de entrada), con el detalle por concepto */
export function TablaTurnos({ filas }: { filas: FilaTurno[] }) {
  const total = filas.reduce((s, f) => s + f.venta, 0);
  const tickets = filas.reduce((s, f) => s + f.tickets, 0);
  const conceptos = [...new Set(filas.flatMap((f) => Object.keys(f.porConcepto)))].sort();
  return (
    <Tarjeta titulo="Resumen por turno" derecha={<span className="text-xs text-slate-500">por hora de entrada</span>}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="border-b border-slate-200">
            <tr>
              <th className={`${th} text-left`}>Turno</th>
              <th className={`${th} text-right`}>Venta</th>
              <th className={`${th} text-right`}>%</th>
              <th className={`${th} text-right`}>Tickets</th>
              <th className={`${th} text-right`}>Ticket prom.</th>
              {conceptos.map((c) => <th key={c} className={`${th} text-right`}>{c}<span className="block font-normal text-slate-500">venta</span></th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filas.map((f) => (
              <tr key={f.turno} className={f.turno === "Fuera de turno" ? "text-slate-500" : ""}>
                <td className="px-3 py-2 font-medium text-slate-900">{f.turno}</td>
                <td className={`${td} font-semibold text-slate-900`}>{pesos.format(f.venta)}</td>
                <td className={`${td} text-slate-500`}>{total ? Math.round((f.venta / total) * 100) : 0}%</td>
                <td className={td}>{numero.format(f.tickets)}</td>
                <td className={td}>{f.tickets ? pesos.format(f.venta / f.tickets) : "—"}</td>
                {conceptos.map((c) => <td key={c} className={`${td} text-slate-600`}>{f.porConcepto[c] ? pesos.format(f.porConcepto[c].venta) : "—"}</td>)}
              </tr>
            ))}
            <tr className="border-t-2 border-slate-200 font-semibold text-slate-900">
              <td className="px-3 py-2">Total</td>
              <td className={td}>{pesos.format(total)}</td>
              <td className={td}></td>
              <td className={td}>{numero.format(tickets)}</td>
              <td className={td}>{tickets ? pesos.format(total / tickets) : "—"}</td>
              {conceptos.map((c) => <td key={c} className={td}>{pesos.format(filas.reduce((s, f) => s + (f.porConcepto[c]?.venta ?? 0), 0))}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
    </Tarjeta>
  );
}

/** Formas de cobro (turno de Maxirest) */
export function TablaCobros({ filas, turnos, total }: { filas: FilaCobro[]; turnos: number[]; total: number }) {
  return (
    <Tarjeta titulo="Formas de cobro" derecha={<span className="text-xs text-slate-500">turno de Maxirest</span>}>
      {!filas.length ? <p className="py-4 text-center text-sm text-slate-500">Sin datos.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead className="border-b border-slate-200">
              <tr>
                <th className={`${th} text-left`}>Forma</th>
                {turnos.length > 1 && turnos.map((t) => <th key={t} className={`${th} text-right`}>{nombreTurnoMx(t)}</th>)}
                <th className={`${th} text-right`}>Total</th>
                <th className={`${th} text-right`}>%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filas.map((f) => (
                <tr key={f.forma}>
                  <td className="px-3 py-2 text-slate-900">{f.forma}</td>
                  {turnos.length > 1 && turnos.map((t) => <td key={t} className={`${td} text-slate-600`}>{f.porTurno[t] ? pesos.format(f.porTurno[t]) : "—"}</td>)}
                  <td className={`${td} font-semibold text-slate-900`}>{pesos.format(f.total)}</td>
                  <td className={`${td} text-slate-500`}>{total ? Math.round((f.total / total) * 100) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Tarjeta>
  );
}

/** Artículos por rubro (turno de Maxirest). Con "conEmpanadas" agrega la columna de empanadas equivalentes. */
export function TablaArticulos({ grupos, turnos, conEmpanadas = false }: { grupos: GrupoRubro[]; turnos: number[]; conEmpanadas?: boolean }) {
  const verTurnos = turnos.length > 1 ? turnos : [];
  return (
    <Tarjeta titulo="Artículos vendidos" derecha={<span className="text-xs text-slate-500">turno de Maxirest</span>}>
      {!grupos.length ? <p className="py-4 text-center text-sm text-slate-500">Sin datos.</p> : (
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="sticky top-0 border-b border-slate-200 bg-white">
              <tr>
                <th className={`${th} text-left`}>Artículo</th>
                {verTurnos.map((t) => <th key={t} className={`${th} text-right`}>{nombreTurnoMx(t)}<span className="block font-normal text-slate-500">unid.</span></th>)}
                <th className={`${th} text-right`}>Total<span className="block font-normal text-slate-500">unid.</span></th>
                {conEmpanadas && <th className={`${th} text-right`}>Empanadas<span className="block font-normal text-slate-500">equivalentes</span></th>}
                <th className={`${th} text-right`}>Venta</th>
              </tr>
            </thead>
            {grupos.map((g) => (
              <tbody key={g.rubro} className="border-b border-slate-200 last:border-0">
                <tr className="bg-slate-50">
                  <td className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-600">{g.rubro}</td>
                  {verTurnos.map((t) => <td key={t} className={`${td} text-slate-600`}>{numero.format(g.porTurno[t] ?? 0)}</td>)}
                  <td className={`${td} font-semibold text-slate-900`}>{numero.format(g.unidades)}</td>
                  {conEmpanadas && <td className={`${td} font-semibold text-slate-900`}>{g.empanadas ? numero.format(g.empanadas) : "—"}</td>}
                  <td className={`${td} font-semibold text-slate-900`}>{pesos.format(g.venta)}</td>
                </tr>
                {g.filas.map((f) => (
                  <tr key={`${f.codigo}-${f.nombre}`} className="border-t border-slate-100">
                    <td className="px-3 py-2 pl-6 text-slate-800">{f.nombre} <span className="text-xs text-slate-400">#{f.codigo}</span></td>
                    {verTurnos.map((t) => <td key={t} className={`${td} text-slate-600`}>{f.porTurno[t] ? numero.format(f.porTurno[t]) : <span className="text-slate-300">0</span>}</td>)}
                    <td className={`${td} text-slate-900`}>{numero.format(f.unidades)}</td>
                    {conEmpanadas && <td className={`${td} text-slate-700`}>{f.empanadas ? numero.format(f.empanadas) : <span className="text-slate-300">—</span>}</td>}
                    <td className={`${td} text-slate-700`}>{pesos.format(f.venta)}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </Tarjeta>
  );
}

/** Lista de tickets (los más recientes primero) */
export function TablaTickets({ tickets, turnos, limite = 300, concepto = (t) => nombreConcepto(t.concepto) }: {
  tickets: Ticket[]; turnos: TurnoConfig[]; limite?: number; concepto?: (t: Ticket) => string;
}) {
  const lista = [...tickets].sort((a, b) => (b.fecha + (b.hora_entrada ?? "")).localeCompare(a.fecha + (a.hora_entrada ?? ""))).slice(0, limite);
  return (
    <Tarjeta titulo="Tickets" derecha={<span className="text-xs text-slate-500">{tickets.length > limite ? `los ${limite} más recientes de ${numero.format(tickets.length)}` : `${numero.format(tickets.length)} tickets`}</span>}>
      {!lista.length ? <p className="py-4 text-center text-sm text-slate-500">Sin datos.</p> : (
        <div className="max-h-[520px] overflow-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="sticky top-0 border-b border-slate-200 bg-white">
              <tr>
                <th className={`${th} text-left`}>Fecha</th>
                <th className={`${th} text-left`}>Entrada</th>
                <th className={`${th} text-left`}>Salida</th>
                <th className={`${th} text-left`}>Turno</th>
                <th className={`${th} text-left`}>Concepto</th>
                <th className={`${th} text-left`}>Forma de pago</th>
                <th className={`${th} text-right`}>Descuento</th>
                <th className={`${th} text-right`}>Total</th>
                <th className={`${th} text-left`}>Comprobante</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lista.map((t) => (
                <tr key={`${t.unidad_id}-${t.fecha}-${t.comprobante}`} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-3 py-1.5 text-slate-600">{fechaCorta(t.fecha)}</td>
                  <td className="px-3 py-1.5 text-slate-900">{t.hora_entrada?.slice(0, 5) ?? "—"}</td>
                  <td className="px-3 py-1.5 text-slate-500">{t.hora_salida?.slice(0, 5) ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-slate-600">{turnoPorHora(t.hora_entrada, turnos)}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-slate-600">{concepto(t)}</td>
                  <td className="px-3 py-1.5 text-slate-600">
                    {t.formas_pago ?? "—"}
                    {t.pago_dividido && <span className="ml-1.5 rounded bg-slate-100 px-1 py-0.5 text-[10px] text-slate-500">dividido</span>}
                  </td>
                  <td className={`${td} py-1.5 text-slate-500`}>{t.descuento ? pesos.format(t.descuento) : "—"}</td>
                  <td className={`${td} py-1.5 font-medium text-slate-900`}>{pesos.format(t.total)}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-xs text-slate-400">{t.comprobante}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Tarjeta>
  );
}
