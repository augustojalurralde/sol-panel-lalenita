// app/pedidosya/page.tsx — PEDIDOSYA
// Qué pasó en PedidosYa en la semana: cuánto se vendió por local, cuánto llegó al banco, a dónde se fue la plata,
// rechazos y reclamos, el cuadre contra Maxirest y lo que hay que reclamarle a PedidosYa.
// Los datos los carga la tarea semanal de los lunes (lee el portal de PedidosYa) y escribe el informe.
import Link from "next/link";
import {
  datosSemana, semanasCargadas, paraReclamar, deCada100, semaforoCuadre, textoSemana, sumarDias, suma,
  type DatosSemana, type VentaLocal, type ItemReclamo,
} from "@/lib/pedidosya";
import { reglasPedidosYa as R } from "@/lib/config";
import { Encabezado, Tarjeta, Pastilla, Punto } from "@/components/UI";

export const dynamic = "force-dynamic";

const $ = (x: number | null | undefined) => (x === null || x === undefined || Number.isNaN(x) ? "—" : "$" + Math.round(x).toLocaleString("es-AR"));
const num = (x: number | null | undefined) => (x === null || x === undefined ? "—" : Math.round(x).toLocaleString("es-AR"));
const pct = (x: number | null | undefined, dec = 1) => (x === null || x === undefined || !Number.isFinite(x) ? "—" : `${x.toLocaleString("es-AR", { maximumFractionDigits: dec, minimumFractionDigits: dec })}%`);
const varPct = (a: number | null | undefined, b: number | null | undefined) => (a === null || a === undefined || !b ? null : ((a - b) / b) * 100);
const th = "py-2 pr-3 text-left text-xs font-semibold text-slate-600";
const thR = `${th} text-right`;
const td = "py-2 pr-3 align-top";
const tdR = `${td} text-right whitespace-nowrap`;

function Var({ v }: { v: number | null }) {
  if (v === null) return <span className="text-xs text-slate-400">—</span>;
  const color = v > 0.5 ? "text-emerald-600" : v < -0.5 ? "text-red-600" : "text-slate-500";
  return <span className={`text-xs font-medium ${color}`}>{v > 0 ? "+" : ""}{v.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%</span>;
}

const corto = (local: string) => local.replace(/^La Leñita /, "");

function SelectorSemana({ semanas, actual }: { semanas: string[]; actual: string }) {
  const i = semanas.indexOf(actual);
  const anterior = semanas[i + 1], siguiente = i > 0 ? semanas[i - 1] : undefined;
  const boton = "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50";
  return (
    <div className="flex items-center gap-2">
      {anterior ? <Link className={boton} href={`/pedidosya?semana=${anterior}`}>← Anterior</Link> : <span className={`${boton} opacity-40`}>← Anterior</span>}
      <form action="/pedidosya" className="flex items-center gap-2">
        <select name="semana" defaultValue={actual} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
          {semanas.map((s) => <option key={s} value={s}>Semana del {textoSemana(s)}/{s.slice(0, 4)}</option>)}
        </select>
        <button className={boton}>Ver</button>
      </form>
      {siguiente ? <Link className={boton} href={`/pedidosya?semana=${siguiente}`}>Siguiente →</Link> : <span className={`${boton} opacity-40`}>Siguiente →</span>}
    </div>
  );
}

function Lista({ items }: { items: string[] }) {
  if (!items.length) return <p className="text-sm text-slate-400">—</p>;
  return <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">{items.map((t, i) => <li key={i}>{t}</li>)}</ul>;
}

function InformeSemanal({ d }: { d: DatosSemana }) {
  const i = d.informe;
  if (!i) {
    return (
      <Tarjeta titulo="Informe de la semana">
        <p className="text-sm text-slate-500">Todavía no está el informe de esta semana. Lo escribe la tarea de los lunes, después de cargar la liquidación.</p>
      </Tarjeta>
    );
  }
  return (
    <Tarjeta titulo="Informe de la semana" derecha={<span className="text-xs text-slate-400">Escrito el {new Date(i.creado_en).toLocaleDateString("es-AR")}</span>}>
      {i.resumen && <p className="mb-4 text-sm leading-relaxed text-slate-800">{i.resumen}</p>}
      <div className="grid gap-5 lg:grid-cols-2">
        <div><p className="mb-1.5 text-sm font-semibold text-emerald-700">Lo bueno</p><Lista items={i.bueno} /></div>
        <div><p className="mb-1.5 text-sm font-semibold text-red-700">Lo malo</p><Lista items={i.malo} /></div>
      </div>
      {i.por_local.length > 0 && (
        <div className="mt-5">
          <p className="mb-1.5 text-sm font-semibold text-slate-900">Por qué subió o bajó cada local</p>
          <ul className="space-y-1.5 text-sm text-slate-700">{i.por_local.map((p, k) => <li key={k}><span className="font-medium text-slate-900">{corto(p.local)}:</span> {p.texto}</li>)}</ul>
        </div>
      )}
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div><p className="mb-1.5 text-sm font-semibold text-slate-900">Qué hacer para mejorar</p><Lista items={i.acciones} /></div>
        <div><p className="mb-1.5 text-sm font-semibold text-slate-900">Para preguntarle a Agustina</p><Lista items={i.preguntas} /></div>
        <div><p className="mb-1.5 text-sm font-semibold text-slate-900">Novedades</p><Lista items={i.novedades} /></div>
      </div>
    </Tarjeta>
  );
}

function TablaVentas({ d }: { d: DatosSemana }) {
  const ant = new Map(d.ventasAnt.map((v) => [v.local, v]));
  const anio = new Map(d.ventasAnio.map((v) => [v.local, v]));
  const filas = [...d.ventas].sort((a, b) => (Number(b.bruto) || 0) - (Number(a.bruto) || 0));
  if (!filas.length) return <p className="text-sm text-slate-500">No hay ventas por local cargadas para esta semana.</p>;
  const ticket = (v?: VentaLocal) => (v && v.pedidos ? (Number(v.bruto) || 0) / v.pedidos : null);
  const tot = { pedidos: suma(filas, "pedidos"), bruto: suma(filas, "bruto"), pedidosAnt: suma(d.ventasAnt, "pedidos"), brutoAnt: suma(d.ventasAnt, "bruto"), brutoAnio: suma(d.ventasAnio, "bruto") };
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-slate-200">
          <th className={th}>Local</th><th className={thR}>Pedidos</th><th className={thR}>vs sem. ant.</th>
          <th className={thR}>Venta bruta</th><th className={thR}>vs sem. ant.</th><th className={thR}>vs año ant.</th>
          <th className={thR}>Ticket</th><th className={thR}>Desc. del local</th>
        </tr></thead>
        <tbody>
          {filas.map((v) => {
            const a = ant.get(v.local);
            return (
              <tr key={v.local} className="border-b border-slate-100">
                <td className={`${td} font-medium`}>{corto(v.local)}{v.fuente === "reporte" && <span className="ml-1 text-xs text-slate-400">(reporte)</span>}</td>
                <td className={tdR}>{num(v.pedidos)}</td><td className={tdR}><Var v={varPct(v.pedidos, a?.pedidos)} /></td>
                <td className={tdR}>{$(v.bruto)}</td><td className={tdR}><Var v={varPct(v.bruto, a?.bruto)} /></td>
                <td className={tdR}><Var v={varPct(v.bruto, anio.get(v.local)?.bruto)} /></td>
                <td className={tdR}>{$(ticket(v))}</td>
                <td className={tdR}>{v.desc_local !== null && v.bruto ? pct((Number(v.desc_local) / Number(v.bruto)) * 100) : "—"}</td>
              </tr>
            );
          })}
          <tr className="font-semibold">
            <td className={td}>Total</td><td className={tdR}>{num(tot.pedidos)}</td><td className={tdR}><Var v={varPct(tot.pedidos, tot.pedidosAnt)} /></td>
            <td className={tdR}>{$(tot.bruto)}</td><td className={tdR}><Var v={varPct(tot.bruto, tot.brutoAnt)} /></td><td className={tdR}><Var v={varPct(tot.bruto, tot.brutoAnio)} /></td>
            <td className={tdR}>{tot.pedidos && tot.bruto ? $(tot.bruto / tot.pedidos) : "—"}</td><td className={tdR} />
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-xs text-slate-400">Venta bruta = valor de los productos, antes de descuentos. &quot;(reporte)&quot; = dato del portal sin detalle de descuentos.</p>
    </div>
  );
}

function TablaOperacion({ d }: { d: DatosSemana }) {
  if (!d.operacion.length) return <p className="text-sm text-slate-500">No hay datos de operación para esta semana.</p>;
  const ant = new Map(d.operacionAnt.map((o) => [o.local, o]));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-slate-200">
          <th className={th}>Local</th><th className={thR}>Sin conexión</th><th className={thR}>Espera evitable</th>
          <th className={thR}>Preparación</th><th className={thR}>Con reclamo</th><th className={thR}>Marcados listos</th><th className={thR}>Cancel. evitables</th>
        </tr></thead>
        <tbody>
          {d.operacion.map((o) => {
            const a = ant.get(o.local);
            const h = (Number(o.minutos_no_disponible) || 0) / 60;
            return (
              <tr key={o.local} className="border-b border-slate-100">
                <td className={`${td} font-medium`}>{corto(o.local)}</td>
                <td className={tdR}><span className="inline-flex items-center gap-1.5"><Punto color={h >= R.horasNoDisponibleRojo ? "rojo" : "verde"} className="h-2.5 w-2.5" />{o.minutos_no_disponible === null ? "—" : `${Math.floor(h)} h ${Math.round((Number(o.minutos_no_disponible) || 0) % 60)} min`}</span>
                  {a && <div className="text-xs text-slate-400">ant: {Math.round((Number(a.minutos_no_disponible) || 0) / 60 * 10) / 10} h</div>}</td>
                <td className={tdR}>{pct(o.espera_evitable_pct, 0)}</td>
                <td className={tdR}>{o.preparacion_min === null ? "—" : `${o.preparacion_min} min`}</td>
                <td className={tdR}>{pct(o.reclamos_pct)}</td>
                <td className={tdR}>{pct(o.listos_pct, 0)}</td>
                <td className={tdR}>{pct(o.cancelaciones_evitables_pct)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Liquidacion({ d }: { d: DatosSemana }) {
  const l = d.liq, a = d.liqAnt;
  if (!l) return <p className="text-sm text-slate-500">No hay liquidación cargada para esta semana.</p>;
  const filas: [string, number | null, number | null, boolean?][] = [
    ["Venta neta", l.ventas, a?.ventas ?? null, true],
    ["Comisión", l.servicio, a?.servicio ?? null],
    ["Publicidad", l.publicidad, a?.publicidad ?? null],
    ["   Gold VIP", l.gold_vip, a?.gold_vip ?? null],
    ["   Keywords", l.keywords, a?.keywords ?? null],
    ["Cargos operativos", l.cargos_operativos, a?.cargos_operativos ?? null],
    ["   Pedidos con Plus", l.cargo_plus, a?.cargo_plus ?? null],
    ["   Reclamos de clientes", l.cargo_reclamos, a?.cargo_reclamos ?? null],
    ["   Rechazos / cancelaciones", l.cargo_cancelaciones, a?.cargo_cancelaciones ?? null],
    ["   Uso del POS", l.cargo_pos, a?.cargo_pos ?? null],
    ["Reintegros", l.reintegros, a?.reintegros ?? null],
    ["Ajustes", l.ajustes, a?.ajustes ?? null],
    ["Impuestos", l.impuestos, a?.impuestos ?? null],
    ["   IVA (comisión y publicidad)", l.iva_comisiones, a?.iva_comisiones ?? null],
    ["   Percepción IVA", l.percepcion_iva, a?.percepcion_iva ?? null],
    ["   Percepción / retención CABA", (Number(l.percepcion_caba) || 0) + (Number(l.retencion_caba) || 0), a ? (Number(a.percepcion_caba) || 0) + (Number(a.retencion_caba) || 0) : null],
    ["Pedidos en efectivo (ya cobrados)", l.ventas_fuera !== null ? -l.ventas_fuera : null, a && a.ventas_fuera !== null ? -a.ventas_fuera : null],
    ["Cuota préstamo PedidosYa", l.credito, a?.credito ?? null],
    ["Llega al banco", l.total, a?.total ?? null, true],
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-slate-200"><th className={th}>Concepto</th><th className={thR}>Esta semana</th><th className={thR}>Anterior</th></tr></thead>
          <tbody>
            {filas.map(([c, v, va, fuerte]) => (
              <tr key={c} className={`border-b border-slate-100 ${fuerte ? "font-semibold" : ""}`}>
                <td className={`${td} whitespace-pre ${c.startsWith("   ") ? "text-slate-500" : ""}`}>{c}</td><td className={tdR}>{$(v)}</td><td className={`${tdR} text-slate-500`}>{$(va)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-slate-500">
          Pago: {l.fecha_pago ? new Date(l.fecha_pago + "T12:00:00").toLocaleDateString("es-AR") : "—"} · cuenta terminada en {l.cuenta ?? "—"}
          {l.cuenta && l.cuenta !== R.cuentaContrato && <span className="ml-1 text-red-600">(el contrato dice {R.cuentaContrato})</span>}
        </p>
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-900">De cada $100 vendidos</p>
        <table className="w-full text-sm">
          <tbody>
            {deCada100(l).map((f) => (
              <tr key={f.concepto} className={`border-b border-slate-100 ${f.total ? "font-semibold" : ""}`}>
                <td className={td}>{f.concepto}</td>
                <td className={`${tdR} ${f.costo && !f.total ? "text-red-600" : ""}`}>{f.pct.toLocaleString("es-AR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {l.ventas ? (
          <p className="mt-3 text-xs text-slate-500">
            Publicidad: {pct((-(Number(l.publicidad) || 0) / Number(l.ventas)) * 100, 2)} de la venta neta (tope acordado {R.publicidadTopePct}%{R.publicidadBase ? ` sobre venta ${R.publicidadBase}` : ", base sin definir"}).
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Historial({ d }: { d: DatosSemana }) {
  const filas = [...d.historial].sort((a, b) => b.desde.localeCompare(a.desde));
  if (filas.length < 2) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-slate-200">
          <th className={th}>Semana</th><th className={thR}>Venta neta</th><th className={thR}>Comisión</th><th className={thR}>Publicidad</th><th className={thR}>Reclamos</th><th className={thR}>Llega al banco</th><th className={thR}>% que llega</th>
        </tr></thead>
        <tbody>
          {filas.map((l) => {
            const v = Number(l.ventas) || 0;
            return (
              <tr key={l.desde} className={`border-b border-slate-100 ${l.desde === d.desde ? "bg-blue-50" : ""}`}>
                <td className={td}><Link className="text-blue-700 hover:underline" href={`/pedidosya?semana=${l.desde}`}>{textoSemana(l.desde)}</Link></td>
                <td className={tdR}>{$(l.ventas)}</td>
                <td className={tdR}>{v ? pct(-(Number(l.servicio) || 0) / v * 100) : "—"}</td>
                <td className={tdR}>{v ? pct(-(Number(l.publicidad) || 0) / v * 100, 2) : "—"}</td>
                <td className={tdR}>{$(l.cargo_reclamos)}</td>
                <td className={tdR}>{$(l.total)}</td>
                <td className={tdR}>{v ? pct((Number(l.total) || 0) / v * 100) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Cuadre({ d }: { d: DatosSemana }) {
  if (!d.maxirest.length) return <p className="text-sm text-slate-500">Todavía no hay pedidos por día cargados para cuadrar con Maxirest.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-slate-200">
          <th className={th}>Unidad del SOL</th><th className={thR}>PedidosYa (bruto)</th><th className={thR}>Cobrado como PedidosYa en Maxirest</th><th className={thR}>Diferencia</th><th className={th}>Forma en Maxirest</th>
        </tr></thead>
        <tbody>
          {d.maxirest.map((m) => {
            const dif = m.maxirest === null ? null : m.peya - m.maxirest;
            const difPct = dif === null || !m.peya ? null : (dif / m.peya) * 100;
            return (
              <tr key={m.unidad} className="border-b border-slate-100">
                <td className={`${td} font-medium`}>{m.unidad}</td>
                <td className={tdR}>{$(m.peya)}</td>
                <td className={tdR}>{m.maxirest === null ? <span className="text-xs italic text-slate-400">Sin dato</span> : $(m.maxirest)}</td>
                <td className={tdR}>{difPct === null ? "—" : <Pastilla color={semaforoCuadre(difPct)}>{$(dif)} ({pct(difPct)})</Pastilla>}</td>
                <td className={`${td} text-xs text-slate-500`}>{m.formas.join(", ") || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-slate-400">
        Recoleta suma La Leñita Empanadas Tucumanas y San Guchero. Falta validar si Maxirest registra el precio antes o después del descuento del local; hasta entonces, una diferencia parecida al descuento es normal.
      </p>
    </div>
  );
}

function ParaReclamar({ auto, informe }: { auto: ItemReclamo[]; informe: DatosSemana["informe"] }) {
  const extra = (informe?.reclamar ?? []).map((r) => ({ tipo: "reclamar" as const, concepto: r.concepto, monto: r.monto ?? null, detalle: r.detalle ?? "" }));
  const todos = [...auto, ...extra];
  if (!todos.length) return <p className="text-sm text-slate-500">Nada para reclamar esta semana.</p>;
  const color = { reclamar: "rojo", revisar: "amarillo", preguntar: "gris" } as const;
  const texto = { reclamar: "Reclamar", revisar: "Revisar", preguntar: "Preguntar" };
  const total = todos.filter((t) => t.tipo === "reclamar" && t.monto && t.monto > 0).reduce((s, t) => s + (t.monto as number), 0);
  return (
    <div>
      <ul className="divide-y divide-slate-100">
        {todos.map((t, i) => (
          <li key={i} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-2">
              <Pastilla color={color[t.tipo]}>{texto[t.tipo]}</Pastilla>
              <div><p className="text-sm font-medium text-slate-900">{t.concepto}</p><p className="text-xs text-slate-500">{t.detalle}</p></div>
            </div>
            <p className="text-sm font-semibold text-slate-900 sm:text-right">{t.monto === null ? "" : $(t.monto)}</p>
          </li>
        ))}
      </ul>
      {total > 0 && <p className="mt-2 text-right text-sm font-semibold text-red-700">Para reclamar: {$(total)}</p>}
    </div>
  );
}

function RechazosReclamos({ d }: { d: DatosSemana }) {
  const cargos = d.cargos;
  const problemas = d.problemas;
  if (!cargos.length && !problemas.length) return <p className="text-sm text-slate-500">Sin rechazos ni reclamos cargados esta semana.</p>;
  const nombreTipo: Record<string, string> = { reclamo: "Reclamo", rechazo: "Rechazo", reintegro: "Reintegro" };
  const porMotivo = new Map<string, { n: number; monto: number }>();
  for (const c of cargos) {
    const k = `${nombreTipo[c.tipo] ?? c.tipo} · ${c.motivo ?? "sin motivo"}`;
    const r = porMotivo.get(k) ?? { n: 0, monto: 0 };
    r.n++; r.monto += Number(c.monto) || 0; porMotivo.set(k, r);
  }
  for (const p of problemas) {
    const k = p.problema ? `Reclamo en el portal · ${p.problema.toLowerCase()}` : `Pedido ${p.estado.toLowerCase()}`;
    if (cargos.some((c) => c.nro === p.nro)) continue;
    const r = porMotivo.get(k) ?? { n: 0, monto: 0 };
    r.n++; porMotivo.set(k, r);
  }
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-900">Resumen por motivo</p>
        <table className="w-full text-sm"><tbody>
          {[...porMotivo.entries()].sort((a, b) => b[1].n - a[1].n).map(([k, r]) => (
            <tr key={k} className="border-b border-slate-100"><td className={td}>{k}</td><td className={tdR}>{r.n}</td><td className={tdR}>{r.monto ? $(r.monto) : ""}</td></tr>
          ))}
        </tbody></table>
      </div>
      <div className="max-h-96 overflow-auto">
        <p className="mb-2 text-sm font-semibold text-slate-900">Pedidos</p>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-slate-200"><th className={th}>Pedido</th><th className={th}>Local</th><th className={th}>Qué pasó</th><th className={thR}>Monto</th></tr></thead>
          <tbody>
            {problemas.map((p) => (
              <tr key={p.nro} className="border-b border-slate-100">
                <td className={`${td} text-xs`}>{p.nro}<div className="text-slate-400">{p.fecha.slice(8, 10)}/{p.fecha.slice(5, 7)} {p.hora ?? ""}</div></td>
                <td className={`${td} text-xs`}>{corto(p.local)}</td>
                <td className={`${td} text-xs`}>{p.problema ?? p.estado}{p.con_cargo && <span className="ml-1 text-red-600">· con cargo</span>}</td>
                <td className={tdR}>{$(p.monto)}</td>
              </tr>
            ))}
            {cargos.filter((c) => !problemas.some((p) => p.nro === c.nro)).map((c) => (
              <tr key={c.nro + c.tipo} className="border-b border-slate-100">
                <td className={`${td} text-xs`}>{c.nro}<div className="text-slate-400">{c.fecha ?? ""}</div></td>
                <td className={`${td} text-xs`}>{corto(c.local ?? "")}</td>
                <td className={`${td} text-xs`}>{nombreTipo[c.tipo] ?? c.tipo}: {c.motivo}</td>
                <td className={tdR}>{$(c.monto)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function PaginaPedidosYa({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const sp = await searchParams;
  let semanas: string[] = [];
  let d: DatosSemana | null = null;
  let error = "";
  try {
    semanas = await semanasCargadas();
    const pedida = sp.semana && /^\d{4}-\d{2}-\d{2}$/.test(sp.semana) ? sp.semana : semanas[0];
    if (pedida) d = await datosSemana(pedida);
  } catch (e) { error = String(e instanceof Error ? e.message : e); }

  const encabezado = (
    <Encabezado
      titulo="PedidosYa"
      pregunta="¿Cuánto vendimos por PedidosYa, cuánto llegó al banco, qué pasó en cada local y qué hay que reclamar?"
      fecha={d ? <SelectorSemana semanas={semanas} actual={d.desde} /> : undefined}
    />
  );

  if (error || !d) {
    return (
      <div>
        {encabezado}
        <Tarjeta titulo="Todavía no hay datos">
          <p className="text-sm text-slate-600">
            {error ? "Falta crear las tablas de PedidosYa en la base (migración 006)." : "La base está lista pero todavía no se cargó ninguna liquidación. La carga la tarea semanal de los lunes."}
          </p>
          {error && <p className="mt-2 text-xs text-slate-400">{error}</p>}
        </Tarjeta>
      </div>
    );
  }

  const reclamos = paraReclamar(d);
  const l = d.liq;
  const costoReal = l && l.ventas ? -((Number(l.servicio) || 0) + (Number(l.cargos_operativos) || 0) + (Number(l.publicidad) || 0) + (Number(l.reintegros) || 0)) / Number(l.ventas) * 100 : null;
  const aReclamar = reclamos.filter((r) => r.tipo === "reclamar" && r.monto && r.monto > 0).reduce((s, r) => s + (r.monto as number), 0);
  const kpis = [
    { t: "Venta neta", v: $(l?.ventas), extra: <Var v={varPct(l?.ventas, d.liqAnt?.ventas)} /> },
    { t: "Llega al banco", v: $(l?.total), extra: <Var v={varPct(l?.total, d.liqAnt?.total)} /> },
    { t: "Costo real de PedidosYa", v: pct(costoReal), extra: <span className="text-xs text-slate-500">comisión + publicidad + cargos</span> },
    { t: "Para reclamar o revisar", v: String(reclamos.length), extra: <span className="text-xs text-slate-500">{aReclamar ? `${$(aReclamar)} a reclamar` : "sin montos a reclamar"}</span> },
  ];

  return (
    <div>
      {encabezado}
      <p className="-mt-3 mb-5 text-sm text-slate-500">Semana del lunes {textoSemana(d.desde)} · liquidación {l ? "cargada" : "pendiente"}</p>
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {kpis.map((k) => (
            <Tarjeta key={k.t} className="text-center">
              <p className="text-sm font-semibold text-slate-900">{k.t}</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{k.v}</p>
              <div className="mt-1">{k.extra}</div>
            </Tarjeta>
          ))}
        </div>
        <InformeSemanal d={d} />
        <Tarjeta titulo="Para reclamarle a PedidosYa"><ParaReclamar auto={reclamos} informe={d.informe} /></Tarjeta>
        <Tarjeta titulo="Ventas por local"><TablaVentas d={d} /></Tarjeta>
        <Tarjeta titulo="Operación por local (conexión, demoras, reclamos)"><TablaOperacion d={d} /></Tarjeta>
        <Tarjeta titulo="Liquidación: a dónde se fue la plata"><Liquidacion d={d} /></Tarjeta>
        <Tarjeta titulo="Rechazos, cancelaciones y reclamos"><RechazosReclamos d={d} /></Tarjeta>
        <Tarjeta titulo="Cuadre con Maxirest (semana)"><Cuadre d={d} /></Tarjeta>
        <Tarjeta titulo="Últimas semanas"><Historial d={d} /></Tarjeta>
      </div>
      <p className="mt-6 text-xs text-slate-400">Datos del portal de PedidosYa, cargados por la tarea semanal. Semana anterior: {textoSemana(sumarDias(d.desde, -7))}.</p>
    </div>
  );
}
