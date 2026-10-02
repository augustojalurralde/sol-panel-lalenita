// app/locales/page.tsx — COMPARATIVO DE LOCALES (solo locales: la fábrica va aparte)
import Link from "next/link";
import { obtenerVentas, sumarDias } from "@/lib/ventas";
import { comparativoPorTurno, ayer, fechaCorta, FUERA_DE_TURNO } from "@/lib/detalle";
import { semaforoVentas } from "@/lib/config";
import { comparativoLocales } from "@/lib/calculos";
import { pesos, numero, porcentaje, variacion } from "@/lib/formato";
import { Encabezado, Fuente, Tarjeta, colorTexto, colorFondo } from "@/components/UI";
import { IconoPersona, IconoBaja, IconoSube, IconoEstable } from "@/components/Iconos";

function TendenciaCelda({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-slate-400">—</span>;
  const Icono = pct > 0 ? IconoSube : pct < 0 ? IconoBaja : IconoEstable;
  return (
    <span className="flex items-center gap-1.5 text-slate-700">
      <Icono className="h-4 w-4" />{porcentaje(pct)}
    </span>
  );
}

const th = "px-3 py-3 text-xs font-semibold text-slate-700 align-bottom";

/** Variación vs mismo día de la semana anterior, con el color del semáforo de ventas */
function VarTurno({ actual, anterior }: { actual: number; anterior: number }) {
  if (!anterior) return <span className="text-slate-400">—</span>;
  const v = variacion(actual, anterior);
  return <span className={`text-xs font-medium ${colorTexto(semaforoVentas(v))}`}>{porcentaje(v)}</span>;
}

async function PorTurno({ fecha }: { fecha: string }) {
  const c = await comparativoPorTurno(fecha);
  const dias = [0, 1, 2, 3, 4, 5, 6].map((n) => sumarDias(ayer(), -n));
  return (
    <Tarjeta
      className="mt-6"
      titulo={`Por turno · ${fechaCorta(c.fecha)} vs ${fechaCorta(c.anterior)}`}
      derecha={
        <span className="flex flex-wrap gap-1.5">
          {dias.map((d) => (
            <Link key={d} href={`/locales?fecha=${d}`} scroll={false}
              className={`rounded-md px-2 py-1 text-xs ${d === c.fecha ? "bg-blue-600 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
              {d === ayer() ? "Ayer" : fechaCorta(d)}
            </Link>
          ))}
        </span>
      }
    >
      {!c.hayDatos ? (
        <p className="py-6 text-center text-sm text-slate-500">Todavía no hay tickets cargados para ese día.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-slate-200">
              <tr>
                <th className={`${th} text-left`} rowSpan={2}>Local</th>
                {c.turnos.map((t) => <th key={t} className={`${th} border-l border-slate-100 text-center`} colSpan={3}>{t}</th>)}
                <th className={`${th} border-l border-slate-100 text-right`} rowSpan={2}>Total día</th>
              </tr>
              <tr>
                {c.turnos.map((t) => [
                  <th key={t + "v"} className={`${th} border-l border-slate-100 pt-0 text-right font-normal text-slate-500`}>Venta</th>,
                  <th key={t + "x"} className={`${th} pt-0 text-right font-normal text-slate-500`}>vs sem. ant.</th>,
                  <th key={t + "t"} className={`${th} pt-0 text-right font-normal text-slate-500`}>Tickets · prom.</th>,
                ])}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {c.filas.map((f) => (
                <tr key={f.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-3 py-2.5 font-semibold">
                    <Link href={`/locales/${f.id}?desde=${c.fecha}&hasta=${c.fecha}`} className="text-slate-900 hover:text-blue-600 hover:underline">{f.nombre}</Link>
                  </td>
                  {c.turnos.map((t) => {
                    const x = f.porTurno[t];
                    const fuera = t === FUERA_DE_TURNO;
                    return [
                      <td key={t + "v"} className={`whitespace-nowrap border-l border-slate-100 px-3 py-2.5 text-right ${fuera ? "text-slate-500" : "text-slate-900"}`}>{x.tickets ? pesos.format(x.venta) : <span className="text-slate-300">—</span>}</td>,
                      <td key={t + "x"} className="px-3 py-2.5 text-right"><VarTurno actual={x.venta} anterior={x.ventaAnt} /></td>,
                      <td key={t + "t"} className="whitespace-nowrap px-3 py-2.5 text-right text-xs text-slate-600">{x.tickets ? `${numero.format(x.tickets)} · ${pesos.format(x.venta / x.tickets)}` : ""}</td>,
                    ];
                  })}
                  <td className="whitespace-nowrap border-l border-slate-100 px-3 py-2.5 text-right font-semibold text-slate-900">
                    {Object.values(f.porTurno).some((x) => x.tickets) ? (
                      <>{pesos.format(f.venta)} <span className="ml-1"><VarTurno actual={f.venta} anterior={f.ventaAnt} /></span></>
                    ) : <span className="text-xs font-normal text-slate-400">Sin datos</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-slate-500">
        Turno según la hora de entrada de cada ticket (Mediodía 10:30 a 15:30 · Noche 19:30 a 06:00; la madrugada cuenta en la noche del día anterior). Solo locales: la fábrica se ve en Estado de la Fábrica. Tocá un local para ver su detalle.
      </p>
    </Tarjeta>
  );
}

export default async function ComparativoLocales({ searchParams }: { searchParams: Promise<{ fecha?: string }> }) {
  const sp = await searchParams;
  const fecha = sp.fecha && /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha) && sp.fecha <= ayer() ? sp.fecha : ayer();
  const r = await obtenerVentas();
  const todas = comparativoLocales(r).filter((f) => f.tipo === "local");
  const filas = todas.filter((f) => f.grupo !== "Molinos y Tocka");
  const aparte = todas.filter((f) => f.grupo === "Molinos y Tocka");

  return (
    <>
      <Encabezado titulo="Comparativo de Locales" pregunta="¿Qué local necesita atención y por qué?" extra={<Fuente real={r.real} />} />

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="border-b border-slate-200">
            <tr>
              <th className={`${th} text-center`}>Prioridad</th>
              <th className={`${th} text-left`}>Local</th>
              <th className={`${th} text-right`}>Venta Ayer</th>
              <th className={`${th} text-right`}>Venta Mes</th>
              <th className={`${th} text-center`}>Variación<span className="block font-normal text-slate-500">vs mismo día sem. ant.</span></th>
              <th className={`${th} text-right`}>Ticket Promedio</th>
              <th className={`${th} text-center`}>Área Principal</th>
              <th className={`${th} text-left`}>Tendencia<span className="block font-normal text-slate-500">7 días vs 7 anteriores</span></th>
              <th className={`${th} text-left`}>Responsable</th>
              <th className={`${th} text-left`}>Última Novedad</th>
              <th className={`${th} text-left`}>Recomendación</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filas.map((f, i) => (
              <tr key={f.id} className="hover:bg-slate-50">
                <td className="px-3 py-3.5 text-center">
                  <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${f.semaforo === "amarillo" || f.semaforo === "gris" ? "text-slate-900" : "text-white"} ${colorFondo(f.semaforo)}`}>
                    {i + 1}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-3.5 font-semibold">
                  {f.fuente === "maxirest" || f.fuente === "hiopos" ? (
                    <Link href={`/locales/${f.id}`} className="text-slate-900 hover:text-blue-600 hover:underline">{f.nombre}</Link>
                  ) : (
                    <span className="text-slate-900">{f.nombre} <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">planilla</span></span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-3.5 text-right text-slate-900">
                  {f.ventaAyer === null ? <span className="text-xs text-slate-400">Sin datos</span> : pesos.format(f.ventaAyer)}
                </td>
                <td className="whitespace-nowrap px-3 py-3.5 text-right text-slate-700">{pesos.format(f.ventaMes)}</td>
                <td className={`px-3 py-3.5 text-center font-medium ${colorTexto(f.semaforo)}`}>{f.variacion === null ? "—" : porcentaje(f.variacion)}</td>
                <td className="whitespace-nowrap px-3 py-3.5 text-right text-slate-700">{f.ticketPromedio === null ? "—" : pesos.format(f.ticketPromedio)}</td>
                <td className="px-3 py-3.5 text-center text-slate-700">{f.area}</td>
                <td className="px-3 py-3.5 text-xs font-medium"><TendenciaCelda pct={f.tendencia} /></td>
                <td className="px-3 py-3.5 text-slate-700">
                  <span className="flex items-center gap-2"><IconoPersona className="h-4 w-4 text-slate-500" />{f.responsable}</span>
                </td>
                <td className="max-w-[180px] px-3 py-3.5 text-xs text-slate-400">
                  {f.ventaAyer === null && f.ultimoDia ? `Último dato: ${f.ultimoDia.slice(8, 10)}/${f.ultimoDia.slice(5, 7)}` : f.ultimoDia ? "Sin novedades" : f.fuente === "planilla" ? "Todavía no hay ventas cargadas" : f.fuente === "hiopos" ? "Todavía no hay ventas en HIOPOS" : "Nunca informó ventas a Maxirest online"}
                </td>
                <td className="max-w-[200px] px-3 py-3.5 text-xs text-slate-700">{f.recomendacion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-400 lg:hidden">Deslizá la tabla hacia los costados para ver todas las columnas.</p>
      <p className="mt-2 text-xs text-slate-500">
        Semáforo de ventas: verde hasta −5% · amarillo entre −5% y −10% · rojo peor que −10% · gris sin datos para comparar.
        {r.sinFuente.length > 0 && ` Todavía sin conexión: ${r.sinFuente.join(", ")}.`}
        {" "}La fábrica no se compara con los locales: se ve en Estado de la Fábrica. Tocá un local para ver su detalle (turnos, cobros, artículos y tickets).
      </p>

      {aparte.length > 0 && (
        <Tarjeta className="mt-6" titulo="Molinos y Tocka" derecha={<span className="text-xs text-slate-500">aparte · no se suman a La Leñita · desde la planilla</span>}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-slate-200">
                <tr>
                  <th className={`${th} text-left`}>Local</th>
                  <th className={`${th} text-right`}>Venta Ayer</th>
                  <th className={`${th} text-center`}>Variación<span className="block font-normal text-slate-500">vs mismo día sem. ant.</span></th>
                  <th className={`${th} text-right`}>Venta Mes</th>
                  <th className={`${th} text-left`}>Tendencia<span className="block font-normal text-slate-500">7 días vs 7 anteriores</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {aparte.map((f) => (
                  <tr key={f.id}>
                    <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-900">{f.nombre}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right text-slate-900">{f.ventaAyer === null ? <span className="text-xs text-slate-400">Sin venta cargada</span> : pesos.format(f.ventaAyer)}</td>
                    <td className={`px-3 py-3 text-center font-medium ${colorTexto(f.semaforo)}`}>{f.variacion === null ? "—" : porcentaje(f.variacion)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right text-slate-700">{pesos.format(f.ventaMes)}</td>
                    <td className="px-3 py-3 text-xs font-medium"><TendenciaCelda pct={f.tendencia} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      )}

      <PorTurno fecha={fecha} />
    </>
  );
}
