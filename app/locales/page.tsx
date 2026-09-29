// app/locales/page.tsx — COMPARATIVO DE LOCALES
import { obtenerVentas } from "@/lib/ventas";
import { comparativoLocales } from "@/lib/calculos";
import { pesos, porcentaje } from "@/lib/formato";
import { Encabezado, Fuente, colorTexto, colorFondo } from "@/components/UI";
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

export default async function ComparativoLocales() {
  const r = await obtenerVentas();
  const filas = comparativoLocales(r);

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
                <td className="whitespace-nowrap px-3 py-3.5 font-semibold text-slate-900">{f.nombre}</td>
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
                  {f.ventaAyer === null && f.ultimoDia ? `Último dato: ${f.ultimoDia.slice(8, 10)}/${f.ultimoDia.slice(5, 7)}` : f.ultimoDia ? "Sin novedades" : "Nunca informó ventas a Maxirest online"}
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
        {" "}La carga manual de novedades llega en una próxima etapa.
      </p>
    </>
  );
}
