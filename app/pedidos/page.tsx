// app/pedidos/page.tsx — PEDIDOS WEB (tienda online Tiendanube)
// Pedidos abiertos con su estado, qué producir por sector para hoy y mañana, y los últimos cerrados.
// Los estados se cambian desde el grupo de Telegram de la fábrica (botones de cada pedido).
import {
  pedidosRecientes, produccionDelDia, diaAR, textoFecha, ESTADOS, ABIERTOS, type PedidoWeb,
} from "@/lib/pedidosWeb";
import { Encabezado, Tarjeta } from "@/components/UI";

export const dynamic = "force-dynamic";

const pesos = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");
const th = "py-2 pr-3 text-left text-xs font-semibold text-slate-600";
const td = "py-2 pr-3 align-top";

function TablaPedidos({ pedidos }: { pedidos: PedidoWeb[] }) {
  if (!pedidos.length) return <p className="text-sm text-slate-500">No hay pedidos.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-slate-200">
          <th className={th}>Pedido</th><th className={th}>Estado</th><th className={th}>Cliente</th>
          <th className={th}>Listo para</th><th className={th}>Retira en</th><th className={th}>Productos</th>
          <th className={`${th} text-right`}>Total</th>
        </tr></thead>
        <tbody>
          {pedidos.map((p) => (
            <tr key={p.id} className="border-b border-slate-100">
              <td className={`${td} font-semibold`}>#{p.numero ?? p.id}</td>
              <td className={td}>{ESTADOS[p.estado].icono} {ESTADOS[p.estado].texto}</td>
              <td className={td}>{p.cliente}<div className="text-xs text-slate-500">{p.telefono}</div></td>
              <td className={td}>{textoFecha(p.fecha_compromiso)}</td>
              <td className={td}>{p.retiro}</td>
              <td className={`${td} text-xs text-slate-600`}>{p.items.map((i) => `${i.cantidad} × ${i.nombre}`).join(" · ")}</td>
              <td className={`${td} text-right`}>{pesos(p.total)}<div className="text-xs text-slate-500">{p.pago === "pagado" ? "Pagado" : "A cobrar"}</div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Produccion({ titulo, porSector }: { titulo: string; porSector: Map<string, Map<string, number>> }) {
  return (
    <Tarjeta titulo={titulo}>
      {!porSector.size ? <p className="text-sm text-slate-500">Nada para producir.</p> : (
        <div className="grid gap-4 sm:grid-cols-2">
          {[...porSector.entries()].map(([sector, prods]) => (
            <div key={sector}>
              <p className="text-sm font-semibold text-slate-900">{sector}</p>
              <ul className="mt-1 text-sm text-slate-700">
                {[...prods.entries()].map(([n, c]) => <li key={n}>{c} × {n}</li>)}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Tarjeta>
  );
}

export default async function PaginaPedidos() {
  let pedidos: PedidoWeb[] = [];
  let error = "";
  try { pedidos = await pedidosRecientes(30); } catch (e) { error = String(e instanceof Error ? e.message : e); }

  const abiertos = pedidos.filter((p) => ABIERTOS.includes(p.estado)).sort((a, b) => (a.fecha_compromiso ?? "").localeCompare(b.fecha_compromiso ?? ""));
  const cerrados = pedidos.filter((p) => !ABIERTOS.includes(p.estado)).slice(0, 30);
  const hoy = diaAR(new Date()), manana = diaAR(new Date(Date.now() + 86400_000));
  const kpis = [
    { t: "Pedidos abiertos", v: abiertos.length },
    { t: "Pendientes de confirmar", v: abiertos.filter((p) => p.estado === "pendiente").length },
    { t: "Listos sin retirar", v: abiertos.filter((p) => p.estado === "listo").length },
    { t: "Vendido últimos 30 días", v: pesos(pedidos.filter((p) => p.estado !== "cancelado").reduce((s, p) => s + p.total, 0)) },
  ];

  return (
    <div>
      <Encabezado titulo="Pedidos Web" pregunta="¿Qué pidieron por la tienda online, para cuándo y en qué estado está cada pedido?" />
      {error ? (
        <Tarjeta titulo="Todavía no está conectado">
          <p className="text-sm text-slate-600">Falta crear las tablas de pedidos en la base (migración 005) o conectar la tienda.</p>
          <p className="mt-2 text-xs text-slate-400">{error}</p>
        </Tarjeta>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {kpis.map((k) => (
              <Tarjeta key={k.t} className="text-center">
                <p className="text-sm font-semibold text-slate-900">{k.t}</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{k.v}</p>
              </Tarjeta>
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Produccion titulo="Para producir · hoy" porSector={produccionDelDia(abiertos, hoy)} />
            <Produccion titulo="Para producir · mañana" porSector={produccionDelDia(abiertos, manana)} />
          </div>
          <Tarjeta titulo="Pedidos abiertos"><TablaPedidos pedidos={abiertos} /></Tarjeta>
          <Tarjeta titulo="Últimos entregados o cancelados"><TablaPedidos pedidos={cerrados} /></Tarjeta>
        </div>
      )}
    </div>
  );
}
