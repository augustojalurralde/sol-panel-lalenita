// app/locales/page.tsx — COMPARATIVO DE LOCALES
import { mockComparativo, type EstadoStock, type Tendencia, type Semaforo } from "@/lib/mockData";
import { porcentaje, colorVariacion } from "@/lib/formato";
import { Encabezado, Punto, AvisoDatosPrueba } from "@/components/UI";
import { IconoPersona, IconoBaja, IconoEstable, IconoSube } from "@/components/Iconos";

const colorPrioridad: Record<Semaforo, string> = {
  rojo: "bg-red-600",
  naranja: "bg-orange-500",
  amarillo: "bg-yellow-400",
  verde: "bg-green-600",
};

const colorStock: Record<EstadoStock, string> = {
  Crítico: "text-red-600",
  Bajo: "text-orange-500",
  Alerta: "text-orange-500",
  OK: "text-green-600",
};

function TendenciaCelda({ t }: { t: Tendencia }) {
  if (t === "empeorando")
    return <span className="flex items-center gap-1.5 text-red-600"><IconoBaja className="h-4 w-4" />Empeorando</span>;
  if (t === "estable")
    return <span className="flex items-center gap-1.5 text-amber-500"><IconoEstable className="h-4 w-4" />Estable</span>;
  return <span className="flex items-center gap-1.5 text-green-600"><IconoSube className="h-4 w-4" />Mejorando</span>;
}

function Encab({ titulo, sub }: { titulo: string; sub?: string }) {
  return (
    <th className="px-3 py-3 text-center text-xs font-semibold text-slate-700 align-bottom">
      {titulo}
      {sub && <span className="block font-normal text-slate-500">{sub}</span>}
    </th>
  );
}

export default function ComparativoLocales() {
  const filas = [...mockComparativo].sort((a, b) => a.prioridad - b.prioridad);

  return (
    <>
      <Encabezado titulo="Comparativo de Locales" pregunta="¿Qué local necesita atención y por qué?" />

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="border-b border-slate-200">
            <tr>
              <Encab titulo="Prioridad" />
              <th className="px-3 py-3 text-left text-xs font-semibold text-slate-700 align-bottom">Local</th>
              <Encab titulo="Área Principal" />
              <Encab titulo="Semáforo" />
              <Encab titulo="Venta Ayer" sub="vs mismo día sem. ant." />
              <Encab titulo="Ticket Promedio" sub="vs mismo día sem. ant." />
              <Encab titulo="Cantidad de Tickets" sub="vs mismo día sem. ant." />
              <Encab titulo="Stock Crítico" />
              <th className="px-3 py-3 text-left text-xs font-semibold text-slate-700 align-bottom">Responsable</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-slate-700 align-bottom">Última Novedad</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-slate-700 align-bottom">Tendencia</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-slate-700 align-bottom">Recomendación</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filas.map((f) => (
              <tr key={f.local} className="hover:bg-slate-50">
                <td className="px-3 py-3.5 text-center">
                  <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white ${colorPrioridad[f.semaforo]}`}>
                    {f.prioridad}
                  </span>
                </td>
                <td className="px-3 py-3.5 font-semibold text-slate-900">{f.local}</td>
                <td className="px-3 py-3.5 text-center text-slate-700">{f.area}</td>
                <td className="px-3 py-3.5 text-center"><Punto color={f.semaforo} /></td>
                <td className={`px-3 py-3.5 text-center font-medium ${colorVariacion(f.ventaVsSemAnt)}`}>{porcentaje(f.ventaVsSemAnt)}</td>
                <td className={`px-3 py-3.5 text-center font-medium ${colorVariacion(f.ticketVsSemAnt)}`}>{porcentaje(f.ticketVsSemAnt)}</td>
                <td className={`px-3 py-3.5 text-center font-medium ${colorVariacion(f.cantidadTicketsVsSemAnt)}`}>{porcentaje(f.cantidadTicketsVsSemAnt)}</td>
                <td className={`px-3 py-3.5 text-center font-medium ${colorStock[f.stock]}`}>{f.stock}</td>
                <td className="px-3 py-3.5 text-slate-700">
                  <span className="flex items-center gap-2"><IconoPersona className="h-4 w-4 text-slate-500" />{f.responsable}</span>
                </td>
                <td className="max-w-[180px] px-3 py-3.5 text-xs text-slate-700">{f.novedad}</td>
                <td className="px-3 py-3.5 text-xs font-medium"><TendenciaCelda t={f.tendencia} /></td>
                <td className="max-w-[200px] px-3 py-3.5 text-xs text-slate-700">{f.recomendacion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-400 lg:hidden">Deslizá la tabla hacia los costados para ver todas las columnas.</p>

      <AvisoDatosPrueba />
    </>
  );
}
