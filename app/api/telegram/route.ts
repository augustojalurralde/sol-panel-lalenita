// app/api/telegram/route.ts — TODO LO QUE PASA EN EL BOT DE TELEGRAM LLEGA ACÁ
// • Botones de los pedidos (Confirmar, En producción, Listo, Entregado, Cancelar)
// • Comandos: /pedidos  /produccion [hoy|mañana]  /stock pollo 40  /agotado pizza ternera  /ayuda  /id
// Solo se obedece al grupo de la fábrica (TELEGRAM_CHAT_ID). /id responde en cualquier chat,
// así se puede averiguar el número del grupo la primera vez.

import { enviar, grupoFabrica, html, responderBoton, secretoTelegram } from "@/lib/telegram";
import { cambiarEstado, diaAR, ESTADOS, pedidosAbiertos, produccionDelDia, textoFecha, type Estado } from "@/lib/pedidosWeb";
import { buscarProductos, ponerStock } from "@/lib/tiendanube";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Update {
  message?: { chat: { id: number; type: string }; from?: { first_name?: string }; text?: string };
  callback_query?: { id: string; data?: string; from: { first_name?: string }; message?: { chat: { id: number } } };
}

const AYUDA = [
  "<b>Bot de pedidos La Leñita</b>",
  "",
  "Cada pedido de la tienda online llega acá con botones para ir cambiando su estado:",
  "🟡 Pendiente → 🟢 Confirmado → 🔵 En producción → ✅ Listo → 📦 Entregado",
  "Con ✅ Listo aparece el botón para avisarle al cliente por WhatsApp.",
  "",
  "<b>Comandos</b>",
  "/pedidos — pedidos abiertos",
  "/produccion — qué producir para mañana (o /produccion hoy)",
  "/stock pollo 40 — pone 40 unidades de stock",
  "/stock pollo libre — vuelve a stock sin límite",
  "/agotado pizza ternera — marca sin stock (no se puede comprar)",
].join("\n");

const pesos = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");

async function comando(chatId: number, texto: string) {
  const [primero, ...resto] = texto.trim().split(/\s+/);
  const cmd = primero.toLowerCase().replace(/@.*$/, "");
  const args = resto.join(" ").trim();

  if (cmd === "/id") return enviar(chatId, `El número de este chat es: <code>${chatId}</code>`);

  const grupo = grupoFabrica();
  if (!grupo || String(chatId) !== grupo) return; // otros chats: no se obedece

  switch (cmd) {
    case "/start":
    case "/ayuda":
      return enviar(chatId, AYUDA);

    case "/pedidos": {
      const ps = await pedidosAbiertos();
      if (!ps.length) return enviar(chatId, "No hay pedidos abiertos 🙌");
      const lineas = ps.map((p) =>
        `${ESTADOS[p.estado].icono} <b>#${p.numero ?? p.id}</b> ${html(p.cliente)} · ${textoFecha(p.fecha_compromiso)} · ${html(p.retiro)} · ${pesos(p.total)}`);
      return enviar(chatId, `<b>Pedidos abiertos (${ps.length})</b>\n\n${lineas.join("\n")}`);
    }

    case "/produccion":
    case "/producción": {
      const hoy = diaAR(new Date());
      const manana = diaAR(new Date(Date.now() + 86400_000));
      const dia = /^hoy$/i.test(args) ? hoy : /^\d{4}-\d{2}-\d{2}$/.test(args) ? args : manana;
      const porSector = produccionDelDia(await pedidosAbiertos(), dia);
      if (!porSector.size) return enviar(chatId, `No hay pedidos web para el ${dia.split("-").reverse().join("/")}.`);
      const bloques = [...porSector.entries()].map(([s, prods]) =>
        `<b>${html(s)}</b>\n` + [...prods.entries()].map(([n, c]) => `  • ${c} × ${html(n)}`).join("\n"));
      return enviar(chatId, `<b>Producción pedidos web · ${dia.split("-").reverse().join("/")}</b>\n(incluye pendientes de confirmar)\n\n${bloques.join("\n\n")}`);
    }

    case "/stock":
    case "/agotado": {
      let busqueda = args, stock: number | null = 0;
      if (cmd === "/stock") {
        const m = args.match(/^(.*\S)\s+(\d+|libre|sin\s*l[ií]mite)$/i);
        if (!m) return enviar(chatId, "Escribilo así: <code>/stock pollo 40</code> o <code>/stock pollo libre</code>");
        busqueda = m[1];
        stock = /^\d+$/.test(m[2]) ? Number(m[2]) : null;
      }
      if (!busqueda) return enviar(chatId, "Decime qué producto. Ej: <code>/agotado pizza ternera</code>");
      const encontrados = await buscarProductos(busqueda);
      if (!encontrados.length) return enviar(chatId, `No encontré ningún producto con "${html(busqueda)}".`);
      if (encontrados.length > 1) {
        return enviar(chatId, `Hay ${encontrados.length} productos con "${html(busqueda)}". Sé más específico:\n` +
          encontrados.slice(0, 12).map((p) => `• ${html(p.nombre)}`).join("\n"));
      }
      const [p] = encontrados;
      await ponerStock(p.id, p.variantes, stock);
      const estado = stock === null ? "stock sin límite" : stock === 0 ? "AGOTADO (no se puede comprar)" : `${stock} unidades`;
      return enviar(chatId, `✔ <b>${html(p.nombre)}</b>: ${estado}`);
    }
  }
}

export async function POST(req: Request) {
  if (req.headers.get("x-telegram-bot-api-secret-token") !== secretoTelegram()) {
    return Response.json({ ok: false }, { status: 401 });
  }
  const u = (await req.json()) as Update;

  try {
    if (u.callback_query) {
      const q = u.callback_query;
      const [tipo, id, accion] = (q.data ?? "").split(":");
      if (tipo !== "p" || String(q.message?.chat.id) !== grupoFabrica()) {
        await responderBoton(q.id, "Este botón no es válido acá");
      } else if (!(accion in ESTADOS)) {
        await responderBoton(q.id, "Acción desconocida");
      } else {
        await cambiarEstado(Number(id), accion as Estado, q.from.first_name ?? "Fábrica");
        await responderBoton(q.id, `${ESTADOS[accion as Estado].icono} ${ESTADOS[accion as Estado].texto}`);
      }
    } else if (u.message?.text?.startsWith("/")) {
      await comando(u.message.chat.id, u.message.text);
    }
  } catch (e) {
    const chat = u.callback_query?.message?.chat.id ?? u.message?.chat.id;
    if (chat) await enviar(chat, `⚠️ No se pudo hacer: ${html(e instanceof Error ? e.message : e)}`).catch(() => {});
  }
  // Siempre 200: si no, Telegram reintenta el mismo mensaje muchas veces
  return Response.json({ ok: true });
}
