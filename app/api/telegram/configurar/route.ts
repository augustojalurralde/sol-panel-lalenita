// app/api/telegram/configurar/route.ts — CONECTAR EL BOT DE TELEGRAM CON EL SOL (una sola vez)
// Después de cargar TELEGRAM_BOT_TOKEN en Vercel, se abre esta dirección en el navegador:
// https://sol-panel-lalenita.vercel.app/api/telegram/configurar
// Le dice a Telegram que mande todo lo que pasa en el bot a /api/telegram.

import { configurarWebhook, grupoFabrica, secretoTelegram } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const origen = new URL(req.url).origin;
  try {
    await configurarWebhook(`${origen}/api/telegram`, secretoTelegram());
    const grupo = grupoFabrica();
    return Response.json({
      ok: true,
      mensaje: grupo
        ? `Bot conectado. Responde en el grupo ${grupo}.`
        : "Bot conectado. Falta el grupo: escribí /id en el grupo de la fábrica y cargá ese número en Vercel como TELEGRAM_CHAT_ID.",
    });
  } catch (e) {
    return Response.json({ ok: false, error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
