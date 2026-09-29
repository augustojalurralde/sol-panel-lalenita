// app/tesoreria/page.tsx — TESORERÍA
import { mockTesoreria } from "@/lib/mockData";
import { tesoreriaCalculada } from "@/lib/calculos";
import { textoPago, textoCobro } from "@/lib/config";
import { pesos, numero, fechaEnDias, textoDias } from "@/lib/formato";
import { Encabezado, Tarjeta, Pastilla, Punto, SinDefinir, AvisoDatosPrueba } from "@/components/UI";
import { IconoActualizar, IconoAlerta } from "@/components/Iconos";

const th = "py-2 text-xs font-semibold text-slate-600";

export default function Tesoreria() {
  const t = tesoreriaCalculada();
  const m = mockTesoreria;

  return (
    <>
      <Encabezado titulo="Tesorería" pregunta="¿Tenemos dinero suficiente y qué obligaciones requieren atención inmediata?" />

      {m.actualizado !== "Hoy" && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
          <IconoAlerta className="h-5 w-5 shrink-0" />
          Datos de tesorería desactualizados (último dato: {m.actualizado.toLowerCase()}). Responsable: Flor.
        </div>
      )}

      {/* Números principales */}
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tarjeta className="text-center">
          <p className="text-sm font-semibold text-slate-900">Disponible Total</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">{pesos.format(t.disponible)}</p>
          <p className="mt-1 text-xs text-slate-500">Cajas + bancos + Mercado Pago</p>
        </Tarjeta>
        <Tarjeta className="text-center">
          <p className="text-sm font-semibold text-slate-900">Saldo Proyectado 7 días</p>
          <p className={`mt-2 text-2xl font-bold sm:text-3xl ${t.saldoProyectado < 0 ? "text-red-600" : "text-slate-900"}`}>{pesos.format(t.saldoProyectado)}</p>
          <p className="mt-1 text-xs text-slate-500">Disponible + cobros − pagos</p>
        </Tarjeta>
        <Tarjeta className="text-center">
          <p className="text-sm font-semibold text-slate-900">Días de Cobertura</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">{t.diasCobertura === null ? "—" : numero.format(Math.floor(t.diasCobertura))}</p>
          <p className="mt-1 text-xs text-slate-500">Gasto neto diario: {pesos.format(m.gastoNetoDiarioPromedio)}</p>
          <SinDefinir texto="Umbrales a confirmar" />
        </Tarjeta>
        <Tarjeta className="text-center">
          <p className="text-sm font-semibold text-slate-900">Cuentas Corrientes</p>
          <p className="mt-2 text-sm text-slate-600">Nos deben</p>
          <p className="text-lg font-bold text-green-700">{pesos.format(m.cuentasCorrientes.nosDeben)}</p>
          <p className="mt-1 text-sm text-slate-600">Debemos</p>
          <p className="text-lg font-bold text-red-600">{pesos.format(m.cuentasCorrientes.debemos)}</p>
        </Tarjeta>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        {/* Desglose */}
        <Tarjeta titulo="Disponible por cuenta">
          <table className="w-full text-sm">
            <tbody>
              {m.cuentas.map((c) => (
                <tr key={c.cuenta} className="border-t border-slate-100 first:border-t-0">
                  <td className="py-2.5 text-slate-700">{c.cuenta}</td>
                  <td className="py-2.5 text-right text-slate-900">{pesos.format(c.monto)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-200 font-bold text-slate-900">
                <td className="py-2.5">Disponible Total</td>
                <td className="py-2.5 text-right">{pesos.format(t.disponible)}</td>
              </tr>
            </tbody>
          </table>
        </Tarjeta>

        {/* Flujo proyectado: se muestra la cuenta */}
        <Tarjeta titulo="Flujo neto proyectado (próximos 7 días)">
          <table className="w-full text-sm">
            <tbody>
              <tr><td className="py-2.5 text-slate-700">Disponible actual</td><td className="py-2.5 text-right text-slate-900">{pesos.format(t.disponible)}</td></tr>
              <tr className="border-t border-slate-100"><td className="py-2.5 text-slate-700">+ Cobros próximos 7 días</td><td className="py-2.5 text-right text-green-700">{pesos.format(t.cobros7)}</td></tr>
              <tr className="border-t border-slate-100"><td className="py-2.5 text-slate-700">− Pagos próximos 7 días</td><td className="py-2.5 text-right text-red-600">{pesos.format(t.pagos7)}</td></tr>
              <tr className="border-t-2 border-slate-200 font-bold text-slate-900"><td className="py-2.5">= Saldo proyectado</td><td className="py-2.5 text-right">{pesos.format(t.saldoProyectado)}</td></tr>
            </tbody>
          </table>
          <p className="mt-3 text-xs text-slate-500">Los cobros ya vencidos no se cuentan hasta que se cobren.</p>
        </Tarjeta>
      </div>

      {/* Pagos */}
      <Tarjeta titulo="Pagos" derecha={<span className="text-xs text-slate-500">Urgente: hoy o mañana · Próximo: 2 a 7 días · Programado: más de 7</span>} className="mb-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr>
                <th className={`${th} text-left`}>Proveedor</th>
                <th className={`${th} text-left`}>Concepto</th>
                <th className={`${th} text-right`}>Monto</th>
                <th className={`${th} text-center`}>Vencimiento</th>
                <th className={`${th} text-left`}>Días restantes</th>
                <th className={`${th} text-left`}>Estado</th>
                <th className={`${th} text-left`}>Responsable</th>
              </tr>
            </thead>
            <tbody className="text-slate-700">
              {t.pagos.map((p) => (
                <tr key={p.proveedor + p.concepto} className="border-t border-slate-100">
                  <td className="py-2.5 font-medium text-slate-900">{p.proveedor}</td>
                  <td className="py-2.5">{p.concepto}</td>
                  <td className="py-2.5 text-right text-slate-900">{pesos.format(p.monto)}</td>
                  <td className="py-2.5 text-center">{fechaEnDias(p.venceEnDias)}</td>
                  <td className="py-2.5">{textoDias(p.venceEnDias)}</td>
                  <td className="py-2.5"><Pastilla color={p.estado}><Punto color={p.estado} className="h-2 w-2" />{textoPago[p.estado]}</Pastilla></td>
                  <td className="py-2.5">{p.responsable}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Tarjeta>

      {/* Cobros */}
      <Tarjeta titulo="Cobros" derecha={<span className="text-xs text-slate-500">Vencido · Próximo: hoy a 7 días · Futuro: más de 7</span>}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr>
                <th className={`${th} text-left`}>Cliente</th>
                <th className={`${th} text-right`}>Monto</th>
                <th className={`${th} text-center`}>Vencimiento</th>
                <th className={`${th} text-left`}>Días</th>
                <th className={`${th} text-left`}>Estado</th>
                <th className={`${th} text-left`}>Responsable</th>
              </tr>
            </thead>
            <tbody className="text-slate-700">
              {t.cobros.map((c) => (
                <tr key={c.cliente} className="border-t border-slate-100">
                  <td className="py-2.5 font-medium text-slate-900">{c.cliente}</td>
                  <td className="py-2.5 text-right text-slate-900">{pesos.format(c.monto)}</td>
                  <td className="py-2.5 text-center">{fechaEnDias(c.venceEnDias)}</td>
                  <td className="py-2.5">{textoDias(c.venceEnDias)}</td>
                  <td className="py-2.5"><Pastilla color={c.estado}><Punto color={c.estado} className="h-2 w-2" />{textoCobro[c.estado]}</Pastilla></td>
                  <td className="py-2.5">{c.responsable}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Tarjeta>

      <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
        <IconoActualizar className="h-4 w-4" /> Último dato de tesorería: {m.actualizado.toLowerCase()} · Responsable: Flor
      </p>
      <AvisoDatosPrueba />
    </>
  );
}
