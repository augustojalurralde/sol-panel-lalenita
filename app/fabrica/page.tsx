// app/fabrica/page.tsx — ESTADO DE LA FÁBRICA
// Arriba: VENTAS REALES de la fábrica (Maxirest, Central 29979), separadas en
// Mayorista / Ventas a locales propios / De fábrica / V. menor.
// "Ventas a locales propios" = tickets cuyo cliente está en la tabla clientes_locales_propios (no se suman a Mayorista).
// La fábrica nunca se compara con los locales.
// Abajo: operación de la fábrica (todavía datos de prueba).
import type { ReactNode } from "react";
import {
  obtenerUnidades, reglaTurnos, aplicarRegla, obtenerDetalle, obtenerEquivalencias, leerRango, textoRango, hayBase,
  resumenPorTurno, cobrosResumen, articulosPorRubro, conceptoFabrica, obtenerLocalesPropios, CONCEPTOS_FABRICA,
  type Ticket,
} from "@/lib/detalle";
import { SelectorRango, NotaTurnos, TablaTurnos, TablaCobros, TablaArticulos, TablaTickets } from "@/components/Detalle";
import { mockFabrica } from "@/lib/mockData";
import { insumosCalculados } from "@/lib/calculos";
import { numero, pesos, decimal, colorVariacion } from "@/lib/formato";
import { Encabezado, Tarjeta, Punto, Pastilla, AvisoDatosPrueba, Fuente } from "@/components/UI";
import { IconoAlerta, IconoCheck, IconoPersona, IconoActualizar } from "@/components/Iconos";

function Kpi({ titulo, valor, pie, color = "text-slate-900", children }: {
  titulo: string; valor: string; pie?: string; color?: string; children?: ReactNode;
}) {
  return (
    <Tarjeta className="text-center">
      <p className="text-sm font-semibold text-slate-900">{titulo}</p>
      <p className={`mt-2 text-3xl font-bold ${color}`}>{valor}</p>
      {children}
      {pie && <p className="mt-1 text-xs text-slate-500">{pie}</p>}
    </Tarjeta>
  );
}

/** Ventas reales de la fábrica para una fecha o rango */
async function VentasFabrica({ desde, hasta }: { desde: string; hasta: string }) {
  const fabrica = (await obtenerUnidades()).find((u) => u.tipo === "fabrica");
  if (!fabrica) return null;
  const regla = reglaTurnos(fabrica);
  const [equivalencias, propios, detalle] = await Promise.all([
    obtenerEquivalencias("fabrica"), obtenerLocalesPropios(), obtenerDetalle([fabrica.id], desde, hasta),
  ]);
  const d = aplicarRegla(detalle, regla);
  const concepto = (t: Ticket) => conceptoFabrica(t, propios);
  const total = d.tickets.reduce((s, t) => s + t.total, 0);
  const porConcepto = new Map<string, { tickets: number; venta: number }>(CONCEPTOS_FABRICA.map((c) => [c, { tickets: 0, venta: 0 }]));
  for (const t of d.tickets) {
    const c = concepto(t);
    const x = porConcepto.get(c) ?? { tickets: 0, venta: 0 };
    x.tickets++; x.venta += t.total;
    porConcepto.set(c, x);
  }
  const arts = articulosPorRubro(d.articulos, equivalencias);

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-900">Ventas de la fábrica · {textoRango(desde, hasta)}</h2>
        <Fuente real={hayBase()} />
      </div>
      <SelectorRango base="/fabrica" desde={desde} hasta={hasta} />
      {!d.tickets.length ? (
        <p className="rounded-xl border border-slate-200 bg-white py-10 text-center text-slate-500">No hay ventas de la fábrica cargadas para {textoRango(desde, hasta)}.</p>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-6">
            {[...porConcepto.entries()].map(([c, x]) => (
              <Tarjeta key={c} className="text-center">
                <p className="text-sm font-semibold text-slate-900">{c}</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{pesos.format(x.venta)}</p>
                <p className="mt-1 text-xs text-slate-500">{numero.format(x.tickets)} tickets{x.tickets ? ` · prom. ${pesos.format(x.venta / x.tickets)}` : ""}</p>
                <p className="text-xs text-slate-400">{total ? Math.round((x.venta / total) * 100) : 0}% de la venta</p>
              </Tarjeta>
            ))}
            <Tarjeta className="text-center">
              <p className="text-sm font-semibold text-slate-900">Total fábrica</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{pesos.format(total)}</p>
              <p className="mt-1 text-xs text-slate-500">{numero.format(d.tickets.length)} tickets</p>
            </Tarjeta>
            <Tarjeta className="text-center">
              <p className="text-sm font-semibold text-slate-900">Empanadas vendidas</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{numero.format(arts.empanadas)}</p>
              <p className="mt-1 text-xs text-slate-500">equivalentes (tablas, cajas, docenas…)</p>
            </Tarjeta>
          </div>
          <p className="mb-2 text-xs text-slate-500">
            &quot;Ventas a locales propios&quot; = ventas cuyo cliente en Maxirest es un local propio ({[...propios].join(", ") || "ninguno cargado"}). No se suman a Mayorista. La lista se edita en Supabase, tabla clientes_locales_propios.
          </p>
          <NotaTurnos regla={regla} />
          <div className="grid gap-4 2xl:grid-cols-5">
            <div className="2xl:col-span-3"><TablaTurnos filas={resumenPorTurno(d.tickets, regla, concepto)} /></div>
            <div className="2xl:col-span-2"><TablaCobros {...cobrosResumen(d.cobros)} /></div>
          </div>
          <div className="mt-4"><TablaArticulos grupos={arts.grupos} turnos={arts.turnos} conEmpanadas /></div>
          <p className="mt-2 text-xs text-slate-500">
            Empanadas equivalentes según la tabla de equivalencias (editable en Supabase): tabla Tucumán 42, tabla sfijas 36, caja *120, caja 90 g 175, caja 80 g 160, docena 12, paquete x6, suelta 1. Pizzas, wraps y tartas no cuentan.
          </p>
          <div className="mt-4"><TablaTickets tickets={d.tickets} regla={regla} concepto={concepto} /></div>
        </>
      )}
    </section>
  );
}

export default async function EstadoFabrica({ searchParams }: { searchParams: Promise<{ desde?: string; hasta?: string }> }) {
  const { desde, hasta } = leerRango(await searchParams);
  const f = mockFabrica;
  const p = f.produccion;
  const cumplimiento = Math.round((p.realizadaKg / p.planificadaKg) * 100);
  const insumos = insumosCalculados().sort((a, b) => a.dias - b.dias);
  const totalEsperada = f.personal.reduce((s, x) => s + x.esperada, 0);
  const totalReal = f.personal.reduce((s, x) => s + x.real, 0);

  return (
    <>
      <Encabezado
        titulo="Estado de la Fábrica"
        pregunta="¿La fábrica está preparada para abastecer correctamente a toda la empresa hoy?"
        extra={
          <div className="flex items-center gap-2 text-sm text-slate-600">
            Planta / Unidad
            <span className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-800">{f.unidad}</span>
          </div>
        }
      />

      <VentasFabrica desde={desde} hasta={hasta} />

      <h2 className="mb-3 text-lg font-bold text-slate-900">Operación de la fábrica <span className="text-sm font-normal text-slate-400">(datos de prueba)</span></h2>

      {/* Estado general */}
      <Tarjeta className="mb-4">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-yellow-100 text-yellow-600">
            <IconoAlerta className="h-8 w-8" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Estado General</p>
            <p className="font-semibold text-slate-900">{f.estadoGeneral.titulo}</p>
            <p className="text-sm text-slate-500">{f.estadoGeneral.detalle}</p>
          </div>
        </div>
      </Tarjeta>

      {/* Producción */}
      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Kpi titulo="Producción Planificada" valor={`${numero.format(p.planificadaKg)} kg`} pie={`Plan de ${p.responsablePlan}`} />
        <Kpi titulo="Producción Realizada" valor={`${numero.format(p.realizadaKg)} kg`} pie={`Registra ${p.responsableRegistro}`} />
        <Kpi titulo="Cumplimiento del Plan" valor={`${cumplimiento}%`} color={cumplimiento < 100 ? "text-yellow-600" : "text-green-600"} pie="Objetivo: 100%">
          <div className="mx-auto mt-2 h-2 w-full max-w-[180px] rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-blue-600" style={{ width: `${Math.min(cumplimiento, 100)}%` }} />
          </div>
        </Kpi>
        <Kpi titulo="Pendiente de Fabricar" valor={String(p.pendienteFabricar)} pie="Órdenes" />
        <Kpi titulo="Listo para Despachar" valor={String(p.listoDespachar)} pie="Órdenes" />
        <Kpi titulo="Despachado Hoy" valor={String(p.despachado)} pie="Órdenes" />
      </div>

      {/* Stock crítico */}
      <Tarjeta titulo="Stock de Materia Prima" derecha={<span className="text-xs text-slate-500">Verde &gt; 4 días · Amarillo 2 a 4 · Rojo &lt; 2</span>} className="mb-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-xs text-slate-600">
              <tr>
                <th className="py-2 text-left font-semibold">Materia prima</th>
                <th className="py-2 text-right font-semibold">Stock actual</th>
                <th className="py-2 text-right font-semibold">Consumo diario</th>
                <th className="py-2 text-center font-semibold">Días de cobertura</th>
                <th className="py-2 text-center font-semibold">Estado</th>
                <th className="py-2 text-center font-semibold">Compra realizada</th>
                <th className="py-2 text-left font-semibold">Ingreso previsto</th>
                <th className="py-2 text-left font-semibold">Responsable</th>
              </tr>
            </thead>
            <tbody className="text-slate-700">
              {insumos.map((i) => (
                <tr key={i.insumo} className="border-t border-slate-100">
                  <td className="py-2.5 font-medium text-slate-900">{i.insumo}</td>
                  <td className="py-2.5 text-right">{numero.format(i.stockActual)} {i.unidad}</td>
                  <td className="py-2.5 text-right">{numero.format(i.consumoDiario)} {i.unidad}</td>
                  <td className="py-2.5 text-center">{decimal(i.dias)}</td>
                  <td className="py-2.5 text-center">
                    {i.enCamino ? <Pastilla color="gris">En camino</Pastilla> : <Punto color={i.estado} className="h-3 w-3" />}
                  </td>
                  <td className="py-2.5 text-center">{i.compraRealizada ? "Sí" : "No"}</td>
                  <td className="py-2.5">{i.fechaIngreso ?? "—"}</td>
                  <td className="py-2.5">{i.responsable}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Tarjeta>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/* Personal */}
        <Tarjeta titulo="Personal">
          <table className="w-full text-xs">
            <thead className="text-slate-600">
              <tr>
                <th className="py-1.5 text-left font-semibold">Sector</th>
                <th className="py-1.5 text-center font-semibold">Esperada</th>
                <th className="py-1.5 text-center font-semibold">Presentes</th>
                <th className="py-1.5 text-center font-semibold">Dif.</th>
              </tr>
            </thead>
            <tbody className="text-slate-700">
              {f.personal.map((x) => (
                <tr key={x.sector} className="border-t border-slate-100">
                  <td className="py-2">{x.sector}</td>
                  <td className="py-2 text-center">{x.esperada}</td>
                  <td className="py-2 text-center">{x.real}</td>
                  <td className={`py-2 text-center font-medium ${colorVariacion(x.real - x.esperada)}`}>{x.real - x.esperada}</td>
                </tr>
              ))}
              <tr className="border-t border-slate-200 font-semibold text-slate-900">
                <td className="py-2">Total</td>
                <td className="py-2 text-center">{totalEsperada}</td>
                <td className="py-2 text-center">{totalReal}</td>
                <td className={`py-2 text-center ${colorVariacion(totalReal - totalEsperada)}`}>{totalReal - totalEsperada}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-4 text-xs font-semibold text-slate-900">Ausentes hoy</p>
          <ul className="mt-2 space-y-2">
            {f.ausentes.map((a) => (
              <li key={a.nombre} className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs ${a.clave ? "bg-red-50" : ""}`}>
                <span className="flex items-center gap-2 text-slate-800">
                  <IconoPersona className={`h-3.5 w-3.5 ${a.clave ? "text-red-600" : "text-slate-400"}`} />
                  {a.nombre} <span className="text-slate-500">· {a.puesto}</span>
                </span>
                {a.clave && <Pastilla color="rojo">Clave</Pastilla>}
              </li>
            ))}
          </ul>
        </Tarjeta>

        {/* Check-in */}
        <Tarjeta
          titulo="Check-in Diario"
          derecha={f.checkIn.realizado ? <Pastilla color="verde"><IconoCheck className="h-3.5 w-3.5" />Realizado</Pastilla> : <Pastilla color="rojo">Pendiente</Pastilla>}
        >
          <p className="text-xs text-slate-600">
            Por <span className="font-semibold text-slate-900">{f.checkIn.por}</span> a las <span className="font-semibold text-slate-900">{f.checkIn.hora}</span> hs
          </p>
          <ul className="mt-3 space-y-2.5">
            {f.checkIn.items.map((it) => (
              <li key={it.tema} className="flex items-start gap-2.5 text-xs">
                <Punto color={it.ok ? "verde" : "amarillo"} className="mt-1 h-2.5 w-2.5" />
                <span>
                  <span className="font-medium text-slate-900">{it.tema}:</span> <span className="text-slate-600">{it.nota}</span>
                </span>
              </li>
            ))}
          </ul>
        </Tarjeta>

        {/* Compras */}
        <Tarjeta titulo="Compras Pendientes">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div>
              <p className="text-3xl font-bold text-slate-900">{f.compras.pendientes}</p>
              <p className="text-xs text-slate-500">Órdenes</p>
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900">{pesos.format(f.compras.monto)}</p>
              <p className="text-xs text-slate-500">Monto pendiente</p>
            </div>
          </div>
          <p className="mt-4 text-xs font-semibold text-slate-900">Materias primas críticas en estas compras</p>
          <p className="mt-1 text-xs text-slate-700">{f.compras.criticasAsociadas.join(", ") || "Ninguna"}</p>
          <p className="mt-3 text-xs text-slate-500">Compra: {f.compras.responsable} · Registra ingreso: Iván</p>
        </Tarjeta>
      </div>

      <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
        <IconoActualizar className="h-4 w-4" /> Datos actualizados hoy a las {f.actualizado} hs
      </p>
      <AvisoDatosPrueba />
    </>
  );
}
