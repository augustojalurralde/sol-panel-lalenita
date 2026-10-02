// app/api/sync/hiopos/route.ts
// TAREA AUTOMÁTICA: trae las ventas de las ferias que usan HIOPOS (hoy: La Rural de Palermo) y las guarda
// igual que las de Maxirest:
//   · total del día (ventas_diarias) → Inicio y Comparativo
//   · tickets con sus formas de pago (ventas_tickets) → detalle y comparativo por turno
//   · formas de cobro y artículos por día y turno (ventas_cobros, ventas_articulos)
// Turno: los comprobantes antes de las 16 h cuentan como turno 1 (Mediodía) y desde las 16 h como turno 2 (Noche).
// La llama GitHub Actions junto con Maxirest (ver .github/workflows/sync-maxirest.yml).
// Sin parámetros: últimos 3 días. Historial: /api/sync/hiopos?desde=2026-03-01&hasta=2026-09-30 (hasta 13 meses por vez)

import { iniciarSesionHiopos, cerrarSesionHiopos, pagosPorTicket, articulos } from "@/lib/hiopos";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Unidad { id: number; nombre: string; hiopos_tienda: number }

const fechaAR = (diasAtras: number) => new Date(Date.now() - 3 * 3600_000 - diasAtras * 86400_000).toISOString().slice(0, 10);
const esFecha = (f: string | null): f is string => !!f && /^\d{4}-\d{2}-\d{2}$/.test(f);
const plata = (n: number) => Math.round(n * 100) / 100;
const turnoDeHora = (hora: number) => (hora < 16 ? 1 : 2);

async function insertarEnTandas(tabla: string, filas: object[]) {
  for (let i = 0; i < filas.length; i += 1000) await db.insertar(tabla, filas.slice(i, i + 1000));
}

async function sincronizarUnidad(u: Unidad, token: string, desde: string, hasta: string): Promise<string> {
  const ahora = new Date().toISOString();

  // 1) Primero se baja TODO de HIOPOS (si algo falla, no se borra nada de lo guardado)
  const [pagos, lineas] = await Promise.all([pagosPorTicket(token, u.hiopos_tienda, desde, hasta), articulos(token, u.hiopos_tienda, desde, hasta)]);

  // Tickets: un renglón por comprobante; si se pagó con varios medios, se cuenta UNA vez
  const tickets = new Map<string, { fecha: string; comprobante: string; hora: string; total: number; medios: string[] }>();
  for (const p of pagos) {
    const k = `${p.fecha}|${p.comprobante}`;
    const t = tickets.get(k) ?? { fecha: p.fecha, comprobante: p.comprobante, hora: p.hora, total: 0, medios: [] };
    t.total += p.importe;
    if (!t.medios.includes(p.medio)) t.medios.push(p.medio);
    tickets.set(k, t);
  }
  const filasTickets = [...tickets.values()].map((t) => ({
    unidad_id: u.id, fecha: t.fecha, comprobante: t.comprobante, turno_maxirest: turnoDeHora(Number(t.hora.slice(0, 2)) || 0),
    hora_entrada: t.hora || null, hora_salida: null, concepto: t.total < 0 ? "Devolución" : "Mostrador", mozo: null, mesa: null,
    cubiertos: 0, descuento: 0, total: plata(t.total), formas_pago: t.medios.join(" + "), pago_dividido: t.medios.length > 1, actualizado_en: ahora,
  }));

  // Formas de cobro por día, turno y medio
  const cobros = new Map<string, { fecha: string; turno: number; forma: string; cantidad: number; total: number }>();
  for (const p of pagos) {
    const turno = turnoDeHora(Number(p.hora.slice(0, 2)) || 0);
    const k = `${p.fecha}|${turno}|${p.medio}`;
    const c = cobros.get(k) ?? { fecha: p.fecha, turno, forma: p.medio, cantidad: 0, total: 0 };
    c.cantidad += p.importe < 0 ? -1 : 1;
    c.total += p.importe;
    cobros.set(k, c);
  }
  const filasCobros = [...cobros.values()].filter((c) => c.cantidad || c.total).map((c) => ({ unidad_id: u.id, ...c, codigo_tipo: null, total: plata(c.total), actualizado_en: ahora }));

  // Artículos por día, turno y código
  const arts = new Map<string, { fecha: string; turno: number; codigo: number; nombre: string; rubro: string; unidades: number; venta: number }>();
  for (const a of lineas) {
    const turno = turnoDeHora(a.hora);
    const k = `${a.fecha}|${turno}|${a.codigo}`;
    const x = arts.get(k) ?? { fecha: a.fecha, turno, codigo: a.codigo, nombre: a.nombre, rubro: a.familia, unidades: 0, venta: 0 };
    x.unidades += a.unidades;
    x.venta += a.venta;
    arts.set(k, x);
  }
  const filasArticulos = [...arts.values()].filter((a) => a.unidades || a.venta)
    .map((a) => ({ unidad_id: u.id, ...a, venta: plata(a.venta), actualizado_en: ahora }));

  // Total del día (para Inicio y el Comparativo). Las devoluciones restan un ticket.
  const dias = new Map<string, { total: number; tickets: number }>();
  for (const t of tickets.values()) {
    const d = dias.get(t.fecha) ?? { total: 0, tickets: 0 };
    d.total += t.total;
    d.tickets += t.total < 0 ? -1 : t.total > 0 ? 1 : 0;
    dias.set(t.fecha, d);
  }
  const filasDiarias = [...dias.entries()].filter(([, d]) => d.total !== 0).map(([fecha, d]) => ({
    unidad_id: u.id, fecha, salon: 0, mostrador: plata(d.total), delivery: 0, total: plata(d.total),
    cantidad_ventas: Math.max(d.tickets, 0), cubiertos: 0, fuente: "HIOPOS", actualizado_en: ahora,
  }));

  // 2) Se reemplaza el rango completo (así queda igual que HIOPOS, aunque se haya corregido algo)
  const filtro = `unidad_id=eq.${u.id}&fecha=gte.${desde}&fecha=lte.${hasta}`;
  await Promise.all([
    db.borrar("ventas_tickets", filtro), db.borrar("ventas_cobros", filtro), db.borrar("ventas_articulos", filtro), db.borrar("ventas_diarias", filtro),
  ]);
  await Promise.all([
    insertarEnTandas("ventas_tickets", filasTickets),
    insertarEnTandas("ventas_cobros", filasCobros),
    insertarEnTandas("ventas_articulos", filasArticulos),
    insertarEnTandas("ventas_diarias", filasDiarias),
  ]);

  const venta = filasDiarias.reduce((s, d) => s + d.total, 0);
  return filasDiarias.length
    ? `${filasDiarias.length} días con venta · $ ${Math.round(venta).toLocaleString("es-AR")} · ${filasTickets.length} tickets`
    : "sin ventas en ese período (feria cerrada)";
}

export async function GET(req: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  const params = new URL(req.url).searchParams;
  const desde = esFecha(params.get("desde")) ? params.get("desde")! : fechaAR(3);
  const hasta = esFecha(params.get("hasta")) ? params.get("hasta")! : fechaAR(0);
  if (desde > hasta) return Response.json({ ok: false, error: "desde es posterior a hasta" }, { status: 400 });
  if ((Date.parse(hasta) - Date.parse(desde)) / 86400_000 > 400) return Response.json({ ok: false, error: "Máximo 13 meses por vez" }, { status: 400 });

  const unidades = await db.leer<Unidad>("unidades", "select=id,nombre,hiopos_tienda&activa=eq.true&fuente=eq.hiopos&hiopos_tienda=not.is.null&order=id");
  if (params.get("listar")) return Response.json(unidades.map((u) => ({ id: u.id, nombre: u.nombre })));
  if (!unidades.length) return Response.json({ ok: true, resultado: "No hay unidades con fuente HIOPOS" });

  const usuario = process.env.HIOPOS_USER;
  const password = process.env.HIOPOS_PASSWORD;
  let token: string | null = null;
  const resultado: Record<string, string> = {};
  try {
    if (!usuario || !password) throw new Error("Faltan HIOPOS_USER o HIOPOS_PASSWORD en Vercel");
    try { token = await iniciarSesionHiopos(usuario, password); }
    catch { await new Promise((r) => setTimeout(r, 3000)); token = await iniciarSesionHiopos(usuario, password); }

    for (const u of unidades) {
      try {
        resultado[u.nombre] = await sincronizarUnidad(u, token, desde, hasta);
        await db.insertar("registro_cargas", [{
          fuente: "HIOPOS", unidad_id: u.id, fecha_dato: hasta, estado: "OK", mensaje: `${desde} a ${hasta}: ${resultado[u.nombre]}`,
        }]);
      } catch (e) {
        resultado[u.nombre] = `ERROR: ${(e as Error).message}`;
        await db.insertar("registro_cargas", [{ fuente: "HIOPOS", unidad_id: u.id, estado: "ERROR", mensaje: (e as Error).message }]);
      }
    }
    const huboError = Object.values(resultado).some((r) => r.startsWith("ERROR"));
    return Response.json({ ok: !huboError, desde, hasta, resultado }, { status: huboError ? 502 : 200 });
  } catch (e) {
    const mensaje = (e as Error).message;
    try { await db.insertar("registro_cargas", [{ fuente: "HIOPOS", estado: "ERROR", mensaje }]); } catch {}
    return Response.json({ ok: false, error: mensaje }, { status: 500 });
  } finally {
    if (token) await cerrarSesionHiopos(token);
  }
}
