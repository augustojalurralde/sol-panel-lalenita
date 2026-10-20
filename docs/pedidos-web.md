# Pedidos Web (Tiendanube → SOL → Telegram)

## Cómo funciona
1. Un cliente compra en lalenitacongelados.mitiendanube.com.
2. Tiendanube avisa al SOL (`/api/tiendanube/aviso`). El pedido se guarda en `pedidos_web`.
3. El bot manda el pedido al grupo de Telegram de la fábrica, separado por sector, con fecha de entrega y botones:
   🟡 Pendiente → 🟢 Confirmado → 🔵 En producción → ✅ Listo → 📦 Entregado (o ❌ Cancelado).
   - Pagado online → entra directo como **Confirmado**.
   - "A convenir" → queda **Pendiente** hasta que alguien toca Confirmar.
4. Con ✅ Listo aparece **"Avisar al cliente"**: abre WhatsApp con el mensaje ya escrito (día, hora y local de retiro).
5. En el panel: menú **Pedidos Web** (abiertos, qué producir hoy y mañana por sector, últimos cerrados).

## Reglas (se cambian en `lib/config.ts` → `reglasPedidosWeb`)
- Pedido antes de las 12 h → listo el siguiente día hábil a las 15 h. Después de las 12 h → a los 2 días hábiles.
- Domingo no se entrega.
- Sector por nombre de producto: Empanadas (empanadas, canastitas, sfijas), Pastas, Tartas, Pizzas, Wraps, Milanesas.

## Comandos del bot (solo en el grupo de la fábrica)
- `/pedidos` — pedidos abiertos
- `/produccion` — qué producir mañana (`/produccion hoy` para hoy)
- `/stock pollo 40` — pone 40 de stock · `/stock pollo libre` — sin límite
- `/agotado pizza ternera` — sin stock (no se puede comprar)
- `/id` — número del grupo (para cargarlo en Vercel)

## Instalación (una sola vez)
1. Supabase → SQL Editor → pegar `supabase/migracion-005-pedidos-web.sql` → Run.
2. Vercel → Settings → Environment Variables:
   - `TELEGRAM_BOT_TOKEN` (de @BotFather)
   - `TELEGRAM_CHAT_ID` (opcional: si no está, el bot se vincula solo al primer grupo donde lo agregan)
   - `TIENDANUBE_APP_ID` y `TIENDANUBE_CLIENT_SECRET` (de la app creada en el Portal de Socios de Tiendanube)
3. Abrir `https://sol-panel-lalenita.vercel.app/api/telegram/configurar`
4. Abrir `https://sol-panel-lalenita.vercel.app/api/tiendanube/instalar` y aceptar los permisos.
   El panel guarda solo la clave de la tienda (tabla `integraciones`) y activa los avisos de pedidos.

## Pendiente (próximas etapas)
- Mensaje al cliente 100% automático (API de WhatsApp Business).
- Comando `/promo` para crear promociones desde Telegram.
