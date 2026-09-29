// app/locales/page.tsx — COMPARATIVO DE LOCALES
import { comparativoLocales } from "@/lib/calculos";
import type { Tendencia } from "@/lib/mockData";
import { pesos, porcentaje } from "@/lib/formato";
import { Encabezado, AvisoDatosPrueba, colorTexto, colorFondo } from "@/components/UI";
import { IconoPersona, IconoBaja, IconoEstable, IconoSube } from "@/components/Iconos";
import { semaforoVentas } from "@/lib/config";

function TendenciaCelda({ t }: { t: Tendencia }) {
  if (t === "empeorando")
    return <span className="flex items-center gap-1.5 text-red-600"><IconoBaja className="h-4 w-4" />Empeorando</span>;
  if (t === "estable")
    return <span className="flex items-center gap-1.5 text-slate-600"><IconoEstable className="h-4 w-4" />Estable</span>;
  return <span className="flex items-center gap-1.5 text-green-600"><IconoSube className="h-4 w-4" />Mejorando</span>;
}

const th = "px-3 py-3 text-xs font-semibold text-slate-700 align-bottom";

export default function ComparativoLocales() {
  const filas = comparativoLocales();

  return (
    <>
      <Encabezado titulo="Comparativo de Locales" pregunta="¿Qué local necesita atención y por qué?" />

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[1150px] text-sm">
          <thead className="border-b border-slate-200">
            <tr>
              <th className={`${th} text-center`}>Prioridad</th>
              <th className={`${th} text-left`}>Local</th>
              <th className={`${th} text-right`}>Venta Ayer</th>
              <th className={`${th} text-right`}>Venta Mes</th>
              <th className={`${th} text-center`}>Variación<span className="block font-normal text-slate-500">vs mismo día sem. ant.</span></th>
              <th className={`${th} text-right`}>Ticket Promedio</th>
              <th className={`${th} text-center`}>Área Principal</th>
              <th className={`${th} text-left`}>Tendencia</th>
              <th className={`${th} text-left`}>Responsable</th>
              <th className={`${th} text-left`}>Última Novedad</th>
              <th className={`${th} text-left`}>Recomendación</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filas.map((f, i) => (
              <tr key={f.nombre} className="hover:bg-slate-50">
                <td className="px-3 py-3.5 text-center">
                  <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${f.semaforo === "amarillo" ? "text-slate-900" : "text-white"} ${colorFondo(f.semaforo)}`}>
                    {i + 1}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-3.5 font-semibold text-slate-900">{f.nombre}</td>
                <td className="whitespace-nowrap px-3 py-3.5 text-right text-slate-900">{pesos.format(f.ventaAyer)}</td>
                <td className="whitespace-nowrap px-3 py-3.5 text-right text-slate-700">{pesos.format(f.ventaMes)}</td>
                <td className={`px-3 py-3.5 text-center font-medium ${colorTexto(semaforoVentas(f.variacion))}`}>{porcentaje(f.variacion)}</td>
                <td className="whitespace-nowrap px-3 py-3.5 text-right text-slate-700">{pesos.format(f.ticketPromedio)}</td>
                <td className="px-3 py-3.5 text-center text-slate-700">{f.area}</td>
                <td className="px-3 py-3.5 text-xs font-medium"><TendenciaCelda t={f.tendencia} /></td>
                <td className="px-3 py-3.5 text-slate-700">
                  <span className="flex items-center gap-2"><IconoPersona className="h-4 w-4 text-slate-500" />{f.responsable}</span>
                </td>
                <td className="max-w-[200px] px-3 py-3.5 text-xs text-slate-700">
                  {f.novedad ? (
                    <>
                      {f.novedad.texto}
                      <span className="block text-slate-400">{f.novedad.fecha} · {f.novedad.cargadoPor}</span>
                    </>
                  ) : (
                    <span className="text-slate-400">Sin novedades</span>
                  )}
                </td>
                <td className="max-w-[200px] px-3 py-3.5 text-xs text-slate-700">{f.recomendacion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-400 lg:hidden">Deslizá la tabla hacia los costados para ver todas las columnas.</p>
      <p className="mt-2 text-xs text-slate-500">
        Semáforo de ventas: verde hasta −5% · amarillo entre −5% y −10% · rojo peor que −10%. La prioridad por fórmula (severidad, plazo, impacto) se activa con datos reales.
      </p>

      <AvisoDatosPrueba />
    </>
  );
}
