// lib/telegram.ts — Conexión con el bot de Telegram de la fábrica (solo en el servidor)
// Usa TELEGRAM_BOT_TOKEN (la clave que da @BotFather) y TELEGRAM_CHAT_ID (el grupo de la fábrica).
// Ambas se cargan en Vercel → Settings → Environment Variables. Nunca van en el código.

import { createHash } from "crypto";

export interface Boton { text: string; callback_data?: string; url?: string }
export type Teclado = Boton[][];

function token() {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("Falta TELEGRAM_BOT_TOKEN");
  return t;
}

/** Grupo de la fábrica donde llegan los pedidos (null si todavía no se cargó) */
export function grupoFabrica(): string | null {
  return process.env.TELEGRAM_CHAT_ID?.trim() || null;
}

async function llamar<T = unknown>(metodo: string, datos: object): Promise<T> {
  const r = await fetch(`https://api.telegram.org/bot${token()}/${metodo}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
    cache: "no-store",
  });
  const j = (await r.json()) as { ok: boolean; result: T; description?: string };
  if (!j.ok) throw new Error(`Telegram ${metodo}: ${j.description ?? r.status}`);
  return j.result;
}

/** Escapa texto para el modo HTML de Telegram */
export const html = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function enviar(chatId: string | number, texto: string, teclado?: Teclado) {
  const r = await llamar<{ message_id: number }>("sendMessage", {
    chat_id: chatId,
    text: texto,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(teclado ? { reply_markup: { inline_keyboard: teclado } } : {}),
  });
  return r.message_id;
}

export async function editar(chatId: string | number, mensajeId: number, texto: string, teclado?: Teclado) {
  try {
    await llamar("editMessageText", {
      chat_id: chatId,
      message_id: mensajeId,
      text: texto,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: { inline_keyboard: teclado ?? [] },
    });
  } catch (e) {
    // Si el texto no cambió, Telegram da error: no es un problema
    if (!String(e).includes("message is not modified")) throw e;
  }
}

/** Respuesta corta que aparece arriba en el celular de quien tocó el botón */
export async function responderBoton(callbackId: string, texto: string) {
  await llamar("answerCallbackQuery", { callback_query_id: callbackId, text: texto });
}

/** Le dice a Telegram adónde mandar los mensajes del bot (se hace una sola vez al instalar) */
export async function configurarWebhook(url: string, secreto: string) {
  await llamar("setWebhook", {
    url,
    secret_token: secreto,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  await llamar("setMyCommands", {
    commands: [
      { command: "pedidos", description: "Pedidos abiertos" },
      { command: "produccion", description: "Qué producir (hoy o mañana)" },
      { command: "stock", description: "Cargar stock: /stock pollo 40" },
      { command: "agotado", description: "Marcar sin stock: /agotado pizza ternera" },
      { command: "ayuda", description: "Cómo usar el bot" },
      { command: "id", description: "Número de este grupo" },
    ],
  });
}

/** Clave que Telegram manda en cada aviso al panel (se calcula del token: no hay que cargar otra variable) */
export function secretoTelegram() {
  return createHash("sha256").update(token()).digest("hex").slice(0, 40);
}
