// app/api/tiendanube/aviso/route.ts — TIENDANUBE AVISA ACÁ CADA VEZ QUE PASA ALGO CON UN PEDIDO
// Eventos: pedido creado, pedido pagado, pedido cancelado.
// Se comprueba la firma (que de verdad venga de Tiendanube), se trae el pedido completo
// y se registra en el SOL (eso además avisa al grupo de Telegram).

import { avisoAutentico, pedido } from "@/lib/tiendanube";
import { registrarPedido } from "@/lib/pedidosWeb";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  const cuerpo = await req.text();
  if (!avisoAutentico(cuerpo, req.headers.get("x-linkedstore-hmac-sha256"))) {
    return Response.json({ ok: false, error: "Firma inválida" }, { status: 401 });
  }

  let aviso: { event?: string; id?: number | string };
  try { aviso = JSON.parse(cuerpo); } catch { return Response.json({ ok: false, error: "No es JSON" }, { status: 400 }); }
  if (!aviso.id || !String(aviso.event ?? "").startsWith("order/")) return Response.json({ ok: true, ignorado: true });

  try {
    const p = await registrarPedido(await pedido(aviso.id));
    return Response.json({ ok: true, pedido: p?.numero ?? aviso.id, estado: p?.estado });
  } catch (e) {
    const mensaje = String(e instanceof Error ? e.message : e);
    await db.insertar("registro_cargas", [{ fuente: "Tiendanube", estado: "error", mensaje: `${aviso.event} ${aviso.id}: ${mensaje}` }]).catch(() => {});
    // Respondemos error para que Tiendanube vuelva a intentar más tarde
    return Response.json({ ok: false, error: mensaje }, { status: 500 });
  }
}
