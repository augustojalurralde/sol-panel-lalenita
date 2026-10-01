// app/api/sync/planilla/route.ts
// RECIBE las ventas de la PLANILLA ROMINA (Google Sheets): Molino Norte, Molino Sur, Tocka y las ferias.
// Las manda un script de Google que está dentro de la planilla (ver docs/apps-script-planilla.gs),
// todas las mañanas. Guarda el detalle por turno en ventas_planilla y el total del día en ventas_diarias,
// así Inicio y el Comparativo las muestran igual que las de Maxirest.
//
// Cuerpo esperado (JSON):
//   { "desde": "2026-09-01", "hasta": "2026-09-30",
//     "filas": [ { "unidad": "Molino Norte", "fecha": "2026-09-09", "turno": "Mediodía",
//                  "venta": 69400, "efectivo": 0, "mp": 30400, "transferencia": 0, "pedidos_ya": 0,
//                  "banco": 0, "proveedores": 39000, "gastos": 0, "dif": 0 } ] }
// Se reemplaza todo el rango desde–hasta de las unidades que vienen en el envío.

import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Unidad { id: number; nombre: string; fuente: string | null }
const CAMPOS = ["venta", "efectivo", "mp", "transferencia", "pedidos_ya", "banco", "proveedores", "gastos", "dif"] as const;
const esFecha = (f: unknown) => typeof f === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f);
const num = (x: unknown) => { const n = Number(x); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; };
const normal = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

export async function POST(req: Request) {
  const clave = process.env.PLANILLA_SECRET;
  if (!clave || req.headers.get("authorization") !== `Bearer ${clave}`) {
    return Response.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  let cuerpo: { desde?: unknown; hasta?: unknown; filas?: unknown };
  try { cuerpo = await req.json(); } catch { return Response.json({ ok: false, error: "El envío no es JSON" }, { status: 400 }); }
  const { desde, hasta } = cuerpo;
  if (!esFecha(desde) || !esFecha(hasta) || !Array.isArray(cuerpo.filas)) {
    return Response.json({ ok: false, error: "Faltan desde, hasta o filas" }, { status: 400 });
  }

  try {
    const unidades = await db.leer<Unidad>("unidades", "select=id,nombre,fuente&fuente=eq.planilla");
    const porNombre = new Map(unidades.map((u) => [normal(u.nombre), u]));
    const desconocidas = new Set<string>();
    const ahora = new Date().toISOString();

    // Filas válidas: unidad conocida, fecha dentro del rango y venta cargada (un día vacío = cerrado o sin cargar)
    const filas = new Map<string, Record<string, unknown>>();
    for (const f of cuerpo.filas as Record<string, unknown>[]) {
      const u = porNombre.get(normal(String(f.unidad ?? "")));
      if (!u) { desconocidas.add(String(f.unidad)); continue; }
      if (!esFecha(f.fecha) || (f.fecha as string) < (desde as string) || (f.fecha as string) > (hasta as string)) continue;
      const turno = String(f.turno ?? "Día").trim() || "Día";
      const fila: Record<string, unknown> = { unidad_id: u.id, fecha: f.fecha, turno, actualizado_en: ahora };
      for (const c of CAMPOS) fila[c] = num(f[c]);
      if (!(fila.venta as number)) continue;
      filas.set(`${u.id}|${f.fecha}|${turno}`, fila); // si se repite, queda la última
    }

    // Unidades que vinieron en el envío (aunque todos sus días estén vacíos): se reemplaza su rango
    const ids = [...new Set((cuerpo.filas as Record<string, unknown>[])
      .map((f) => porNombre.get(normal(String(f.unidad ?? "")))?.id).filter((x): x is number => !!x))];
    if (!ids.length) return Response.json({ ok: false, error: "Ninguna unidad del envío existe en el SOL", desconocidas: [...desconocidas] }, { status: 400 });

    const lista = [...filas.values()];
    const totales = new Map<string, { unidad_id: number; fecha: string; total: number }>();
    for (const f of lista) {
      const k = `${f.unidad_id}|${f.fecha}`;
      const t = totales.get(k) ?? { unidad_id: f.unidad_id as number, fecha: f.fecha as string, total: 0 };
      t.total += f.venta as number;
      totales.set(k, t);
    }

    const filtro = `unidad_id=in.(${ids.join(",")})&fecha=gte.${desde}&fecha=lte.${hasta}`;
    await db.borrar("ventas_planilla", filtro);
    await db.borrar("ventas_diarias", `${filtro}&fuente=eq.Planilla`);
    for (let i = 0; i < lista.length; i += 1000) await db.insertar("ventas_planilla", lista.slice(i, i + 1000));
    const diarias = [...totales.values()].map((t) => ({
      unidad_id: t.unidad_id, fecha: t.fecha, salon: 0, mostrador: 0, delivery: 0,
      total: Math.round(t.total * 100) / 100, cantidad_ventas: 0, cubiertos: 0, fuente: "Planilla", actualizado_en: ahora,
    }));
    if (diarias.length) await db.guardar("ventas_diarias", diarias, "unidad_id,fecha");

    const resumen = `${desde} a ${hasta}: ${diarias.length} días con venta, ${lista.length} turnos`;
    await db.insertar("registro_cargas", [{ fuente: "Planilla", estado: "OK", fecha_dato: hasta, mensaje: resumen }]);
    return Response.json({ ok: true, resumen, desconocidas: [...desconocidas] });
  } catch (e) {
    const mensaje = (e as Error).message;
    try { await db.insertar("registro_cargas", [{ fuente: "Planilla", estado: "ERROR", mensaje }]); } catch {}
    return Response.json({ ok: false, error: mensaje }, { status: 500 });
  }
}
