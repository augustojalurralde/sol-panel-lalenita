// app/api/tiendanube/instalar/route.ts — CONECTAR LA TIENDA CON EL SOL (se hace una sola vez)
// 1) Augusto entra a https://sol-panel-lalenita.vercel.app/api/tiendanube/instalar
// 2) Lo manda a Tiendanube para aceptar los permisos de la app
// 3) Tiendanube vuelve a esta misma dirección con un "code": el panel lo cambia por la clave
//    de acceso, la guarda en la base y le pide a Tiendanube que avise cada pedido nuevo.

import { completarInstalacion, registrarAvisos, urlInstalacion } from "@/lib/tiendanube";

export const dynamic = "force-dynamic";

const pagina = (titulo: string, texto: string) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
     <body style="font-family:system-ui;max-width:520px;margin:60px auto;padding:0 16px;color:#0f1b2d">
     <h2>${titulo}</h2><p style="line-height:1.5">${texto}</p></body>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );

export async function GET(req: Request) {
  const url = new URL(req.url);
  const codigo = url.searchParams.get("code");
  try {
    if (!codigo) return Response.redirect(urlInstalacion(), 302);
    const acceso = await completarInstalacion(codigo);
    const avisos = await registrarAvisos(`${url.origin}/api/tiendanube/aviso`);
    return pagina(
      "✅ Tienda conectada con el SOL",
      `Tienda ${acceso.store_id} conectada. Avisos activos: ${avisos.join(", ")}.<br>
       Desde ahora cada pedido nuevo llega al grupo de Telegram de la fábrica. Ya podés cerrar esta página.`,
    );
  } catch (e) {
    return pagina("❌ No se pudo conectar", `Detalle: ${String(e instanceof Error ? e.message : e)}`);
  }
}
