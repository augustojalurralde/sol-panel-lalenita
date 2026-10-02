// app/page.tsx — INICIO / CENTRO DE DIRECCIÓN
import Link from "next/link";
import { obtenerVentas, totales } from "@/lib/ventas";
import { semaforoVentas } from "@/lib/config";
import { pesos, porcentaje, variacion } from "@/lib/formato";
import { alertas, resumenEjecutivo, tesoreriaCalculada, estadoDatos } from "@/lib/calculos";
import { Encabezado, Tarjeta, Punto, Pastilla, Fuente, SinDefinir, colorTexto } from "@/components/UI";
import { IconoFlechaDerecha, IconoAlerta, IconoCheck } from "@/components/Iconos";

const GRUPO_APARTE = "Molinos y Tocka";

const colorEstadoDato = { OK: "verde", Pendiente: "amarillo", Atrasado: "rojo" } as const;

export default async function Inicio() {
  const r = await obtenerVentas();
  // Venta al público = solo locales. La fábrica va aparte, arriba (nunca se suma ni se compara con los locales).
  const rLocales = { ...r, unidades: r.unidades.filter((u) => u.tipo === "local" && u.grupo !== GRUPO_APARTE) };
  // Molinos y Tocka: se muestran en su propio recuadro, sin sumarse a La Leñita
  const aparte = r.unidades.filter((u) => u.tipo === "local" && u.grupo === GRUPO_APARTE);
  const fabrica = r.unidades.find((u) => u.tipo === "fabrica") ?? null;
  const varFabrica = fabrica && fabrica.ventaAyer !== null && fabrica.ventaMismoDiaSemAnt ? variacion(fabrica.ventaAyer, fabrica.ventaMismoDiaSemAnt) : null;
  const t = totales(rLocales);
  const varAyer = t.semAntComparable > 0 ? variacion(t.ayerComparable, t.semAntComparable) : null;
  const semAyer = varAyer === null ? "gris" : semaforoVentas(varAyer);
  const ticket = t.comprobantesAyer > 0 ? t.ventaConTickets / t.comprobantesAyer : null;
  const { disponible } = tesoreriaCalculada();
  const listaAlertas = alertas(r);
  const resumen = resumenEjecutivo(r);
  const estable = !listaAlertas.some((a) => !a.prueba);
  const fechaAyer = new Date(r.ayer + "T12:00:00Z").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

  const unidades = rLocales.unidades
    .map((u) => ({ ...u, var: u.ventaAyer !== null && u.ventaMismoDiaSemAnt ? variacion(u.ventaAyer, u.ventaMismoDiaSemAnt) : null }))
    .sort((a, b) => (b.ventaAyer ?? -1) - (a.ventaAyer ?? -1));
  const maximo = Math.max(1, ...unidades.map((u) => u.ventaAyer ?? 0));

  return (
    <>
      <Encabezado titulo="Inicio" pregunta="¿Cómo está la empresa hoy y qué necesita mi atención?" />

      {/* 1. Estado de los datos */}
      <Tarjeta titulo="Estado de los datos" className="mb-4">
        <div className="flex flex-wrap gap-2">
          {estadoDatos(r).map((d) => (
            <div key={d.fuente} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs">
              <Punto color={colorEstadoDato[d.estado]} className="h-2.5 w-2.5" />
              <span className="font-medium text-slate-900">{d.fuente}</span>
              <span className="text-slate-500">{d.ultimoDato}</span>
              {d.estado !== "OK" && (
                <span className={colorTexto(colorEstadoDato[d.estado])}>· {d.estado} ({d.responsable} → {d.escalamiento})</span>
              )}
              {d.prueba && <Fuente real={false} />}
            </div>
          ))}
        </div>
      </Tarjeta>

      {/* 2. Resumen ejecutivo */}
      <section className={`mb-4 flex items-start gap-4 rounded-xl border p-5 ${estable ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50"}`}>
        <div className={estable ? "text-green-600" : "text-yellow-600"}>
          {estable ? <IconoCheck className="h-7 w-7" /> : <IconoAlerta className="h-7 w-7" />}
        </div>
        <div>
          <p className="text-xs text-slate-500">Resumen ejecutivo · ventas</p>
          <p className="font-semibold text-slate-900">{resumen}</p>
        </div>
      </section>

      {/* 3. Fábrica (aparte: venta mayorista y a locales propios, no es venta al público) */}
      {fabrica && (
        <Link href="/fabrica" className="mb-4 block">
          <section className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 hover:border-blue-300 sm:grid-cols-2">
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-900">Fábrica · venta de ayer</p>
              <p className="text-xs text-slate-500 first-letter:uppercase">{fechaAyer}</p>
              {fabrica.ventaAyer === null ? (
                <p className="mt-2 text-sm text-slate-400">Sin datos{fabrica.ultimoDia ? ` (último: ${fabrica.ultimoDia.slice(8, 10)}/${fabrica.ultimoDia.slice(5, 7)})` : ""}</p>
              ) : (
                <>
                  <p className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">{pesos.format(fabrica.ventaAyer)}</p>
                  {varFabrica !== null && (
                    <p className="mt-1 text-sm font-medium text-slate-600">{porcentaje(varFabrica)} <span className="text-xs font-normal text-slate-500">vs. mismo día sem. ant.</span></p>
                  )}
                </>
              )}
            </div>
            <div className="text-center sm:border-l sm:border-slate-200">
              <p className="text-sm font-semibold text-slate-900">Fábrica · venta del mes</p>
              <p className="text-xs text-slate-500">hasta ayer</p>
              <p className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">{pesos.format(fabrica.ventaMes)}</p>
              <p className="mt-1 text-xs text-blue-600">Ver detalle de la fábrica →</p>
            </div>
          </section>
        </Link>
      )}

      {/* 4. Números principales: solo locales (venta al público) */}
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tarjeta className="text-center">
          <p className="text-sm font-semibold text-slate-900">Venta de Ayer · locales</p>
          <p className="text-xs text-slate-500 first-letter:uppercase">{fechaAyer}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">{pesos.format(t.totalAyer)}</p>
          {varAyer !== null ? (
            <p className={`mt-1 text-sm font-medium ${colorTexto(semAyer)}`}>{porcentaje(varAyer)} <span className="text-xs font-normal text-slate-500">vs. mismo día sem. ant.</span></p>
          ) : (
            <SinDefinir texto="Sin comparación" />
          )}
          <p className="mt-1 text-xs text-slate-500">{t.unidadesConDatos} de {t.unidadesTotal} locales informaron</p>
          <p className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-600">
            Semana ({r.semanaTexto}): <b className="text-slate-900">{pesos.format(t.semana)}</b>
            {t.semanaAnt > 0 && <span className={`ml-1 font-medium ${colorTexto(semaforoVentas(variacion(t.semana, t.semanaAnt)))}`}>{porcentaje(Math.round(variacion(t.semana, t.semanaAnt) * 10) / 10)}</span>}
            <span className="block text-slate-500">vs. los mismos días de la semana pasada</span>
          </p>
          <div className="mt-1"><Fuente real={r.real} /></div>
        </Tarjeta>
        <Tarjeta className="text-center">
          <p className="text-sm font-semibold text-slate-900">Venta del Mes · locales</p>
          <p className="text-xs text-slate-500">hasta ayer</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">{pesos.format(t.totalMes)}</p>
          {t.mesAnt > 0 && (
            <p className={`mt-1 text-sm font-medium ${colorTexto(semaforoVentas(variacion(t.totalMes, t.mesAnt)))}`}>{porcentaje(Math.round(variacion(t.totalMes, t.mesAnt) * 10) / 10)} <span className="text-xs font-normal text-slate-500">vs. mes ant. al mismo día</span></p>
          )}
          <SinDefinir texto="Presupuesto sin definir" />
          <div className="mt-1"><Fuente real={r.real} /></div>
        </Tarjeta>
        <Tarjeta className="text-center">
          <p className="text-sm font-semibold text-slate-900">Ticket Promedio</p>
          <p className="text-xs text-slate-500">ayer, locales con Maxirest</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">{ticket === null ? "—" : pesos.format(ticket)}</p>
          <p className="mt-1 text-xs text-slate-500">{t.comprobantesAyer} tickets</p>
          <div className="mt-1"><Fuente real={r.real} /></div>
        </Tarjeta>
        <Link href="/tesoreria" className="block">
          <Tarjeta className="h-full text-center hover:border-blue-300">
            <p className="text-sm font-semibold text-slate-900">Disponible Total</p>
            <p className="text-xs text-slate-500">cajas + bancos + MP</p>
            <p className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">{pesos.format(disponible)}</p>
            <p className="text-xs text-blue-600">Ver tesorería →</p>
            <div className="mt-1"><Fuente real={false} /></div>
          </Tarjeta>
        </Link>
      </div>

      {/* 5. Molinos y Tocka (aparte, no se suman a La Leñita) */}
      {aparte.length > 0 && (
        <section className="mb-4 rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">{GRUPO_APARTE} <span className="font-normal text-slate-500">· aparte, no se suma a La Leñita</span></h2>
            <Fuente real={r.real} texto="Real · Planilla" />
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            {aparte.map((u) => {
              const v = u.ventaAyer !== null && u.ventaMismoDiaSemAnt ? variacion(u.ventaAyer, u.ventaMismoDiaSemAnt) : null;
              return (
                <div key={u.id} className="rounded-lg bg-slate-50 p-3">
                  <p className="text-sm font-medium text-slate-900">{u.nombre}</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{u.ventaAyer === null ? <span className="text-sm font-normal text-slate-400">Sin venta cargada</span> : pesos.format(u.ventaAyer)}</p>
                  {v !== null && <p className={`text-xs font-medium ${colorTexto(semaforoVentas(v))}`}>{porcentaje(v)} <span className="font-normal text-slate-500">vs. sem. ant.</span></p>}
                  <p className="mt-1 text-xs text-slate-500">Mes: {pesos.format(u.ventaMes)}</p>
                </div>
              );
            })}
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-sm font-semibold text-slate-900">Total del grupo</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{pesos.format(aparte.reduce((s, u) => s + (u.ventaAyer ?? 0), 0))}</p>
              <p className="text-xs text-slate-500">ayer</p>
              <p className="mt-1 text-xs text-slate-500">Mes: {pesos.format(aparte.reduce((s, u) => s + u.ventaMes, 0))}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-400">Se cargan desde la PLANILLA ROMINA (Google). Un día sin venta cargada puede ser día cerrado o que todavía no se completó.</p>
        </section>
      )}

      {/* 6. Ventas por local + Alertas */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Tarjeta titulo="Venta de ayer por local" derecha={<Fuente real={r.real} />} className="lg:col-span-3">
          <ul className="space-y-4">
            {unidades.map((u) => {
              const s = u.var === null ? "gris" : semaforoVentas(u.var);
              return (
                <li key={u.id}>
                  <div className="mb-1 flex items-baseline justify-between gap-4 text-sm">
                    <span className="flex items-center gap-2 font-medium text-slate-900"><Punto color={s} className="h-2.5 w-2.5" />{u.nombre}</span>
                    {u.ventaAyer === null ? (
                      <span className="text-xs text-slate-400">Sin datos{u.ultimoDia ? ` (último: ${u.ultimoDia.slice(8, 10)}/${u.ultimoDia.slice(5, 7)})` : ""}</span>
                    ) : (
                      <span className="flex items-baseline gap-3">
                        <span className="text-slate-900">{pesos.format(u.ventaAyer)}</span>
                        <span className={`w-14 text-right text-xs font-medium ${colorTexto(s)}`}>{u.var === null ? "—" : porcentaje(u.var)}</span>
                      </span>
                    )}
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-blue-600" style={{ width: `${((u.ventaAyer ?? 0) / maximo) * 100}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
          {r.sinFuente.length > 0 && (
            <p className="mt-4 text-xs text-slate-400">Todavía sin conexión: {r.sinFuente.join(", ")}.</p>
          )}
          <Link href="/locales" className="mt-4 flex items-center justify-center gap-1 rounded-lg border border-blue-200 bg-blue-50 py-2 text-xs font-medium text-blue-700 hover:bg-blue-100">
            Ver comparativo de locales <IconoFlechaDerecha className="h-3.5 w-3.5" />
          </Link>
          <Link href="/locales/estadisticas" className="mt-2 flex items-center justify-center gap-1 rounded-lg border border-slate-200 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
            Ver estadísticas de ventas <IconoFlechaDerecha className="h-3.5 w-3.5" />
          </Link>
        </Tarjeta>

        <Tarjeta titulo="Alertas que requieren acción" className="lg:col-span-2">
          {listaAlertas.length === 0 ? (
            <p className="text-sm text-slate-500">No hay alertas.</p>
          ) : (
            <ul className="space-y-3">
              {listaAlertas.map((a) => (
                <li key={a.texto}>
                  <Link href={a.href} className={`flex items-start gap-3 rounded-lg p-1 hover:bg-slate-50 ${a.prueba ? "opacity-60" : ""}`}>
                    <Punto color={a.color} className="mt-1 h-2.5 w-2.5" />
                    <span className="flex-1 text-sm text-slate-800">{a.texto}</span>
                    <span className="flex flex-col items-end gap-1">
                      <Pastilla color="gris">{a.responsable}</Pastilla>
                      {a.prueba && <Fuente real={false} />}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>

      <p className="mt-8 text-xs text-slate-400">
        {r.real ? "Ventas de locales y de la fábrica: datos reales de Maxirest. La venta de los locales es solo venta al público; la fábrica va aparte. Tesorería, producción y stock: todavía datos de prueba." : "Datos de prueba — todavía no son los datos reales de la empresa."}
      </p>
    </>
  );
}
