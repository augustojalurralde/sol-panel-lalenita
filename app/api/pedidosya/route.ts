// app/api/pedidosya/route.ts — CARGA Y LECTURA DE DATOS DE PEDIDOSYA
// Lo usa la tarea semanal desde el navegador de Augusto, con el panel abierto (pide la misma clave del panel).
//
//   GET  /api/pedidosya?semana=2026-10-05   → todos los datos de esa semana + lo detectado para reclamar
//   GET  /api/pedidosya?semanas=1           → lista de semanas cargadas
//   POST /api/pedidosya  con uno de estos cuerpos (JSON):
//     { "tipo": "liquidacion", "texto": "<texto de la página Detalle de liquidación>" }
//     { "tipo": "liquidaciones", "filas": [ { desde, hasta, ventas, ... } ] }            (histórico ya leído)
//     { "tipo": "ventas", "desde": "2026-10-05", "texto": "<Reportes > Ventas, vista Listas>" }
//     { "tipo": "operaciones", "desde": "2026-10-05", "texto": "<Reportes > Operaciones>" }
//     { "tipo": "pedidos", "fecha": "2026-10-05", "pedidos": [ { nro, tags, hora, local, monto, extra } ] }
//     { "tipo": "ventas_local", "filas": [ ... ] } · { "tipo": "dias", "filas": [ ... ] } · { "tipo": "cargos", "filas": [ ... ] }
//     { "tipo": "estado_de_cuenta", "desde": "2026-10-05", "ventas_local": [...], "dias": [...], "cargos": [...] }
//         (lo arma docs/pedidosya-lector-estado-de-cuenta.js leyendo el Excel del estado de cuenta en el navegador)
//     { "tipo": "informe", "informe": { desde, resumen, bueno, malo, por_local, novedades, preguntas, acciones, reclamar } }

import { db } from "@/lib/supabase";
import {
  leerLiquidacion, leerReporteVentas, leerReporteOperaciones, resumirPedidosDia, lunesDe, type PedidoPortal,
} from "@/lib/pedidosyaLeer";
import { datosSemana, paraReclamar, semanasCargadas } from "@/lib/pedidosya";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const esFecha = (f: unknown): f is string => typeof f === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f);
const ahora = () => new Date().toISOString();
// La tarea semanal manda los datos desde la pestaña del portal de PedidosYa (como texto, para que el
// navegador no haga una consulta previa). Solo ese sitio puede mandar cargas, y siempre con la clave del panel.
const PORTAL = "https://portal-app.pedidosya.com";
function respuestas(origen: string | null) {
  const headers: Record<string, string> = origen === PORTAL
    ? { "Access-Control-Allow-Origin": PORTAL, "Access-Control-Allow-Credentials": "true", Vary: "Origin" } : {};
  return {
    ok: (datos: object) => Response.json({ ok: true, ...datos }, { headers }),
    mal: (error: string, status = 400) => Response.json({ ok: false, error }, { status, headers }),
  };
}

async function enTandas(tabla: string, filas: object[], conflicto: string) {
  for (let i = 0; i < filas.length; i += 500) await db.guardar(tabla, filas.slice(i, i + 500), conflicto);
}

const CAMPOS_LIQ = ["desde", "hasta", "fecha_pago", "cuenta", "ventas", "ventas_app", "ventas_fuera", "servicio", "cargos_operativos", "cargo_pos", "cargo_plus", "cargo_reclamos", "cargo_cancelaciones", "publicidad", "gold_vip", "keywords", "reintegros", "reintegro_desc_peya", "reintegro_desc_comercial", "reintegro_retiro", "reintegro_cancelaciones", "ajustes", "impuestos", "iva_comisiones", "percepcion_iva", "percepcion_caba", "retencion_caba", "ingresos", "subtotal", "credito", "total", "detalle"];
const elegir = (o: Record<string, unknown>, campos: string[]) => Object.fromEntries(campos.filter((c) => c in o).map((c) => [c, o[c]]));

export async function GET(req: Request) {
  const { ok, mal } = respuestas(null); // las lecturas solo desde el propio panel
  const u = new URL(req.url);
  try {
    if (u.searchParams.get("semanas")) return ok({ semanas: await semanasCargadas() });
    const semana = u.searchParams.get("semana");
    if (!esFecha(semana)) return mal("Falta ?semana=aaaa-mm-dd (lunes)");
    const d = await datosSemana(lunesDe(semana));
    return ok({ ...d, paraReclamar: paraReclamar(d) });
  } catch (e) {
    return mal(String(e instanceof Error ? e.message : e), 500);
  }
}

export async function POST(req: Request) {
  const { ok, mal } = respuestas(req.headers.get("origin"));
  let c: Record<string, unknown>;
  try { c = JSON.parse(await req.text()); } catch { return mal("El envío no es JSON"); }
  try {
    switch (c.tipo) {
      case "liquidacion": {
        if (typeof c.texto !== "string") return mal("Falta el texto de la liquidación");
        const l = leerLiquidacion(c.texto);
        if (l.total === null || l.ventas === null) return mal("No pude leer Ventas o Total en la liquidación");
        await db.guardar("peya_liquidaciones", [{ ...l, fuente: "portal", actualizado_en: ahora() }], "desde");
        return ok({ guardado: "liquidacion", desde: l.desde, ventas: l.ventas, total: l.total, cuenta: l.cuenta });
      }
      case "liquidaciones": {
        const filas = (c.filas as Record<string, unknown>[] | undefined) ?? [];
        if (!filas.length || !filas.every((f) => esFecha(f.desde) && esFecha(f.hasta))) return mal("Faltan filas con desde y hasta");
        await enTandas("peya_liquidaciones", filas.map((f) => ({ ...elegir(f, CAMPOS_LIQ), detalle: f.detalle ?? {}, fuente: f.fuente ?? "archivo", actualizado_en: ahora() })), "desde");
        return ok({ guardado: "liquidaciones", cantidad: filas.length });
      }
      case "ventas": {
        if (!esFecha(c.desde) || typeof c.texto !== "string") return mal("Faltan desde (lunes) y texto del reporte de Ventas");
        const desde = lunesDe(c.desde);
        const leidas = leerReporteVentas(c.texto).filter((v) => v.ventas !== null);
        // Si ya hay datos de la factura (más completos) para ese local y semana, no se pisan
        const conFactura = new Set((await db.leer<{ local: string }>("peya_ventas_local", `select=local&desde=eq.${desde}&fuente=eq.factura`)).map((x) => x.local));
        const filas = leidas.filter((v) => !conFactura.has(v.local)).map((v) => ({
          desde, local: v.local, pedidos: v.pedidos, bruto: v.ventas, fuente: "reporte", actualizado_en: ahora(),
        }));
        if (filas.length) await db.guardar("peya_ventas_local", filas, "desde,local");
        return ok({ guardado: "ventas", desde, locales: leidas.map((v) => v.local) });
      }
      case "operaciones": {
        if (!esFecha(c.desde) || typeof c.texto !== "string") return mal("Faltan desde (lunes) y texto del reporte de Operaciones");
        const desde = lunesDe(c.desde);
        const filas = leerReporteOperaciones(c.texto).map((o) => ({ desde, ...o, actualizado_en: ahora() }));
        if (filas.length) await db.guardar("peya_operacion_local", filas, "desde,local");
        return ok({ guardado: "operaciones", desde, locales: filas.map((f) => f.local) });
      }
      case "pedidos": {
        if (!esFecha(c.fecha) || !Array.isArray(c.pedidos)) return mal("Faltan fecha y pedidos");
        const { dias, problemas } = resumirPedidosDia(c.fecha, c.pedidos as PedidoPortal[]);
        // Se reemplaza el día completo de los locales que vinieron (fuente portal)
        const filas = dias.map((d) => ({ ...d, neta: null, fuente: "portal", actualizado_en: ahora() }));
        if (filas.length) await db.guardar("peya_dia_local", filas, "fecha,local");
        if (problemas.length) await db.guardar("peya_pedidos", problemas.map((p) => ({ ...p, actualizado_en: ahora() })), "nro");
        return ok({ guardado: "pedidos", fecha: c.fecha, pedidos: (c.pedidos as unknown[]).length, locales: dias.length, problemas: problemas.length });
      }
      case "estado_de_cuenta": {
        // Lo que devuelve docs/pedidosya-lector-estado-de-cuenta.js: { desde, ventas_local, dias, cargos }
        if (!esFecha(c.desde)) return mal("Falta desde (lunes)");
        const desde = lunesDe(c.desde);
        const ventas = ((c.ventas_local as Record<string, unknown>[] | undefined) ?? []).map((v) => ({ ...v, desde, fuente: "factura", actualizado_en: ahora() }));
        const dias = ((c.dias as Record<string, unknown>[] | undefined) ?? []).filter((d) => esFecha(d.fecha)).map((d) => ({ ...d, fuente: "factura", actualizado_en: ahora() }));
        const cargos = ((c.cargos as Record<string, unknown>[] | undefined) ?? []).filter((x) => x.nro && x.tipo).map((x) => ({ ...x, semana: desde, actualizado_en: ahora() }));
        if (!ventas.length) return mal("El estado de cuenta no trae pedidos");
        await enTandas("peya_ventas_local", ventas, "desde,local");
        if (dias.length) await enTandas("peya_dia_local", dias, "fecha,local");
        if (cargos.length) await enTandas("peya_cargos", cargos, "nro,tipo");
        return ok({ guardado: "estado_de_cuenta", desde, locales: ventas.length, dias: dias.length, cargos: cargos.length });
      }
      case "ventas_local":
      case "dias":
      case "cargos": {
        const filas = (c.filas as Record<string, unknown>[] | undefined) ?? [];
        if (!filas.length) return mal("No vinieron filas");
        const tipo = c.tipo as "ventas_local" | "dias" | "cargos";
        const tabla = { ventas_local: "peya_ventas_local", dias: "peya_dia_local", cargos: "peya_cargos" }[tipo];
        const clave = { ventas_local: "desde,local", dias: "fecha,local", cargos: "nro,tipo" }[tipo];
        await enTandas(tabla, filas.map((f) => ({ ...f, actualizado_en: ahora() })), clave);
        return ok({ guardado: c.tipo, cantidad: filas.length });
      }
      case "informe": {
        const i = c.informe as Record<string, unknown> | undefined;
        if (!i || !esFecha(i.desde)) return mal("Falta informe.desde (lunes)");
        const lista = (x: unknown) => (Array.isArray(x) ? x : []);
        await db.guardar("peya_informes", [{
          desde: lunesDe(i.desde), resumen: typeof i.resumen === "string" ? i.resumen : null,
          bueno: lista(i.bueno), malo: lista(i.malo), por_local: lista(i.por_local), novedades: lista(i.novedades),
          preguntas: lista(i.preguntas), acciones: lista(i.acciones), reclamar: lista(i.reclamar), creado_en: ahora(),
        }], "desde");
        return ok({ guardado: "informe", desde: lunesDe(i.desde) });
      }
      default:
        return mal("tipo desconocido");
    }
  } catch (e) {
    return mal(String(e instanceof Error ? e.message : e), 500);
  }
}
