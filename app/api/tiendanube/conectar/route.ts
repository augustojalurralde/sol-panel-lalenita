// app/api/tiendanube/conectar/route.ts — CONECTAR LA TIENDA CON EL SOL (una sola vez)
// Después de cargar TIENDANUBE_ACCESS_TOKEN en Vercel (token de la "Aplicación a medida"),
// se abre https://sol-panel-lalenita.vercel.app/api/tiendanube/conectar
// Comprueba que el token funciona, activa los avisos de pedidos y trae los pedidos abiertos que ya había.

import { api, registrarAvisos, type PedidoTN } from "@/lib/tiendanube";
import { registrarPedido } from "@/lib/pedidosWeb";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const origen = new URL(req.url).origin;
  try {
    const tienda = await api<{ name?: Record<string, string> | string }>("/store");
    const nombre = typeof tienda.name === "string" ? tienda.name : Object.values(tienda.name ?? {})[0];
    const avisos = await registrarAvisos(`${origen}/api/tiendanube/aviso`);

    // Pedidos abiertos de los últimos 7 días que todavía no estaban en el SOL
    const desde = new Date(Date.now() - 7 * 86400_000).toISOString();
    const abiertos = await api<PedidoTN[]>(`/orders?status=open&created_at_min=${desde}&per_page=50`);
    let cargados = 0;
    for (const p of abiertos) { await registrarPedido(p); cargados++; }

    return Response.json({
      ok: true,
      mensaje: `Tienda "${nombre}" conectada. Avisos activos: ${avisos.join(", ")}. Pedidos abiertos revisados: ${cargados}.`,
    });
  } catch (e) {
    return Response.json({ ok: false, error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
