// app/api/sync/detalle/route.ts
// TAREA AUTOMÁTICA: trae de Mi Maxirest el DETALLE de las ventas y lo guarda en el SOL:
//   · tickets (uno por comprobante, con hora de entrada, concepto y formas de pago)
//   · formas de cobro por día y turno de Maxirest
//   · artículos vendidos por día y turno de Maxirest
// La llama GitHub Actions todas las mañanas (ver .github/workflows/sync-maxirest.yml).
// Sin parámetros: últimos 3 días de todas las unidades (si alguien cerró tarde, se completa solo).
// Historial: /api/sync/detalle?desde=2025-10-01&hasta=2025-10-31&unidad=1  (un mes y una unidad por vez)
// Lista de unidades: /api/sync/detalle?listar=1

import {
  iniciarSesion, entrarALocal, ticketsPorRango, cobrosPorTurno, articulosPorTurno, TURNOS_MAXIREST,
  type ArticuloMaxirest,
} from "@/lib/maxirest";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Unidad { id: number; nombre: string; maxirest_codigo: string | null }

function fechaAR(diasAtras: number): string {
  return new Date(Date.now() - 3 * 3600_000 - diasAtras * 86400_000).toISOString().slice(0, 10);
}

function diasEntre(desde: string, hasta: string): string[] {
  const dias: string[] = [];
  const d = new Date(desde + "T12:00:00Z");
  const fin = new Date(hasta + "T12:00:00Z");
  while (d <= fin) {
    dias.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dias;
}

/** Si Maxirest repite un código en el mismo turno, se suman (para no guardar dos filas con la misma clave) */
function agrupar(lista: ArticuloMaxirest[]): ArticuloMaxirest[] {
  const m = new Map<number, ArticuloMaxirest>();
  for (const a of lista) {
    const ya = m.get(a.codigo);
    if (ya) { ya.unidades += a.unidades; ya.venta += a.venta; } else m.set(a.codigo, { ...a });
  }
  return [...m.values()];
}

/** Hace las tareas de a "n" por vez (para no saturar a Maxirest) */
async function deA<T, R>(n: number, items: T[], f: (x: T) => Promise<R>): Promise<R[]> {
  const res: R[] = [];
  for (let i = 0; i < items.length; i += n) res.push(...(await Promise.all(items.slice(i, i + n).map(f))));
  return res;
}

async function insertarEnTandas(tabla: string, filas: object[]) {
  for (let i = 0; i < filas.length; i += 1000) await db.insertar(tabla, filas.slice(i, i + 1000));
}

const plata = (n: number) => Math.round(n * 100) / 100;

/** Trae todo el detalle de UNA unidad para un rango y reemplaza lo guardado en ese rango */
async function sincronizarUnidad(u: Unidad, tokenUsuario: string, desde: string, hasta: string): Promise<string> {
  const tokenLocal = await entrarALocal(tokenUsuario, u.maxirest_codigo!);
  const ahora = new Date().toISOString();

  // 1) Primero se baja TODO de Maxirest (si algo falla, no se borra nada de lo guardado)
  const tickets = await ticketsPorRango(tokenLocal, desde, hasta);
  const porDia = await deA(4, diasEntre(desde, hasta), async (fecha) => {
    const [cobros, articulos] = await Promise.all([
      Promise.all(TURNOS_MAXIREST.map((t) => cobrosPorTurno(tokenLocal, fecha, t))),
      Promise.all(TURNOS_MAXIREST.map((t) => articulosPorTurno(tokenLocal, fecha, t))),
    ]);
    return { fecha, cobros, articulos };
  });

  const filasTickets = tickets.map((t) => ({
    unidad_id: u.id, fecha: t.fecha, comprobante: t.comprobante, turno_maxirest: t.turnoMaxirest,
    hora_entrada: t.horaEntrada, hora_salida: t.horaSalida, concepto: t.concepto, mozo: t.mozo, mesa: t.mesa,
    cubiertos: t.cubiertos, descuento: plata(t.descuento), total: plata(t.total), formas_pago: t.formasPago,
    pago_dividido: t.pagoDividido, actualizado_en: ahora,
  }));
  const filasCobros = porDia.flatMap((d) =>
    d.cobros.flatMap((lista, i) => {
      const porForma = new Map<string, { forma: string; codigo_tipo: string; cantidad: number; total: number }>();
      for (const c of lista) {
        const ya = porForma.get(c.forma);
        if (ya) { ya.cantidad += c.cantidad; ya.total += c.total; }
        else porForma.set(c.forma, { forma: c.forma, codigo_tipo: c.codigoTipo, cantidad: c.cantidad, total: c.total });
      }
      return [...porForma.values()].map((c) => ({ unidad_id: u.id, fecha: d.fecha, turno: TURNOS_MAXIREST[i], ...c, total: plata(c.total), actualizado_en: ahora }));
    }),
  );
  const filasArticulos = porDia.flatMap((d) =>
    d.articulos.flatMap((lista, i) =>
      agrupar(lista).map((a) => ({
        unidad_id: u.id, fecha: d.fecha, turno: TURNOS_MAXIREST[i], codigo: a.codigo, nombre: a.nombre,
        rubro: a.rubro, unidades: a.unidades, venta: plata(a.venta), actualizado_en: ahora,
      })),
    ),
  );

  // 2) Se reemplaza el rango completo (así queda igual que Maxirest, aunque haya corregido algo)
  const filtro = `unidad_id=eq.${u.id}&fecha=gte.${desde}&fecha=lte.${hasta}`;
  await Promise.all([db.borrar("ventas_tickets", filtro), db.borrar("ventas_cobros", filtro), db.borrar("ventas_articulos", filtro)]);
  await Promise.all([
    insertarEnTandas("ventas_tickets", filasTickets),
    insertarEnTandas("ventas_cobros", filasCobros),
    insertarEnTandas("ventas_articulos", filasArticulos),
  ]);

  const dias = new Set(filasTickets.map((t) => t.fecha)).size;
  return dias ? `${dias} días · ${filasTickets.length} tickets · ${filasArticulos.length} renglones de artículos` : "sin datos en Maxirest";
}

export async function GET(req: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const params = new URL(req.url).searchParams;
  let unidades = await db.leer<Unidad>("unidades", "select=id,nombre,maxirest_codigo&activa=eq.true&maxirest_codigo=not.is.null&order=id");
  if (params.get("listar")) return Response.json(unidades.map((u) => ({ id: u.id, nombre: u.nombre })));

  const desde = params.get("desde") ?? fechaAR(3);
  const hasta = params.get("hasta") ?? fechaAR(1);
  if (diasEntre(desde, hasta).length > 31) return Response.json({ ok: false, error: "Máximo un mes por vez" }, { status: 400 });
  const soloUnidad = params.get("unidad");
  if (soloUnidad) unidades = unidades.filter((u) => String(u.id) === soloUnidad);

  const resultado: Record<string, string> = {};
  try {
    const email = process.env.MAXIREST_EMAIL;
    const password = process.env.MAXIREST_PASSWORD;
    if (!email || !password) throw new Error("Faltan MAXIREST_EMAIL o MAXIREST_PASSWORD");
    const tokenUsuario = await iniciarSesion(email, password);

    await Promise.all(
      unidades.map(async (u) => {
        try {
          resultado[u.nombre] = await sincronizarUnidad(u, tokenUsuario, desde, hasta);
          const ok = !resultado[u.nombre].startsWith("sin datos");
          await db.insertar("registro_cargas", [{
            fuente: "Maxirest detalle", unidad_id: u.id, fecha_dato: ok ? hasta : null,
            estado: ok ? "OK" : "SIN_DATOS", mensaje: `${desde} a ${hasta}: ${resultado[u.nombre]}`,
          }]);
        } catch (e) {
          resultado[u.nombre] = `ERROR: ${(e as Error).message}`;
          await db.insertar("registro_cargas", [{ fuente: "Maxirest detalle", unidad_id: u.id, estado: "ERROR", mensaje: (e as Error).message }]);
        }
      }),
    );
    const huboError = Object.values(resultado).some((r) => r.startsWith("ERROR"));
    return Response.json({ ok: !huboError, desde, hasta, resultado }, { status: huboError ? 502 : 200 });
  } catch (e) {
    const mensaje = (e as Error).message;
    try { await db.insertar("registro_cargas", [{ fuente: "Maxirest detalle", estado: "ERROR", mensaje }]); } catch {}
    return Response.json({ ok: false, error: mensaje }, { status: 500 });
  }
}
