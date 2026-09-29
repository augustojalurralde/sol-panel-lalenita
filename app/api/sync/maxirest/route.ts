// app/api/sync/maxirest/route.ts
// TAREA AUTOMÁTICA: trae las ventas de Mi Maxirest y las guarda en el SOL.
// La llama GitHub Actions todas las mañanas (ver .github/workflows/sync-maxirest.yml).
// Por defecto revisa los últimos 3 días, así si un local cerró tarde se completa solo.
// Para cargar historia: /api/sync/maxirest?desde=2025-10-01&hasta=2026-09-28

import { iniciarSesion, entrarALocal, ventasPorDia } from "@/lib/maxirest";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Unidad { id: number; nombre: string; maxirest_codigo: string | null; activa: boolean }

function fechaAR(diasAtras: number): string {
  const ahora = new Date(Date.now() - 3 * 3600_000 - diasAtras * 86400_000); // hora Argentina
  return ahora.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  // Solo quien tenga la clave secreta puede ejecutar la tarea
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const params = new URL(req.url).searchParams;
  const desde = params.get("desde") ?? fechaAR(3);
  const hasta = params.get("hasta") ?? fechaAR(1);
  const resultado: Record<string, string> = {};

  try {
    const email = process.env.MAXIREST_EMAIL;
    const password = process.env.MAXIREST_PASSWORD;
    if (!email || !password) throw new Error("Faltan MAXIREST_EMAIL o MAXIREST_PASSWORD");

    const unidades = await db.leer<Unidad>("unidades", "select=*&activa=eq.true&maxirest_codigo=not.is.null");
    const tokenUsuario = await iniciarSesion(email, password);

    for (const u of unidades) {
      try {
        const tokenLocal = await entrarALocal(tokenUsuario, u.maxirest_codigo!);
        const dias = await ventasPorDia(tokenLocal, desde, hasta);
        if (dias.length) {
          await db.guardar(
            "ventas_diarias",
            dias.map((d) => ({
              unidad_id: u.id,
              fecha: d.fecha,
              salon: d.salon,
              mostrador: d.mostrador,
              delivery: d.delivery,
              total: d.total,
              cantidad_ventas: d.cantidadVentas,
              cubiertos: d.cubiertos,
              fuente: "Maxirest",
              actualizado_en: new Date().toISOString(),
            })),
            "unidad_id,fecha",
          );
        }
        const ultimo = dias.at(-1)?.fecha ?? null;
        const estado = dias.length ? "OK" : "SIN_DATOS";
        resultado[u.nombre] = dias.length ? `${dias.length} días (último ${ultimo})` : "sin datos en Maxirest";
        await db.insertar("registro_cargas", [{ fuente: "Maxirest", unidad_id: u.id, fecha_dato: ultimo, estado, mensaje: `${desde} a ${hasta}: ${resultado[u.nombre]}` }]);
      } catch (e) {
        resultado[u.nombre] = `ERROR: ${(e as Error).message}`;
        await db.insertar("registro_cargas", [{ fuente: "Maxirest", unidad_id: u.id, estado: "ERROR", mensaje: (e as Error).message }]);
      }
    }
    return Response.json({ ok: true, desde, hasta, resultado });
  } catch (e) {
    const mensaje = (e as Error).message;
    try { await db.insertar("registro_cargas", [{ fuente: "Maxirest", estado: "ERROR", mensaje }]); } catch {}
    return Response.json({ ok: false, error: mensaje }, { status: 500 });
  }
}
