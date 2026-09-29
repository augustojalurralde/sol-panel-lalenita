// app/page.tsx — Pantalla principal: Dirección (ventas del día)
import { mockDatosVentas } from "@/lib/mockData";

const pesos = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

function variacion(hoy: number, ayer: number) {
  if (ayer === 0) return 0;
  return ((hoy - ayer) / ayer) * 100;
}

function Variacion({ hoy, ayer }: { hoy: number; ayer: number }) {
  const v = variacion(hoy, ayer);
  const sube = v >= 0;
  return (
    <span className={sube ? "text-emerald-600 font-medium" : "text-red-600 font-medium"}>
      {sube ? "▲" : "▼"} {Math.abs(v).toFixed(1)}%
    </span>
  );
}

export default function Direccion() {
  const { totalHoy, totalAyer, locales } = mockDatosVentas;
  const ordenados = [...locales].sort((a, b) => b.ventaHoy - a.ventaHoy);
  const maximo = Math.max(...locales.map((l) => l.ventaHoy));

  const fecha = new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Argentina/Buenos_Aires",
  });

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-8">
      <header className="mb-8">
        <p className="text-sm text-zinc-500 capitalize">{fecha}</p>
        <h1 className="text-2xl font-semibold text-zinc-900">La Leñita · Dirección</h1>
        <p className="mt-1 text-xs text-amber-700">Datos de prueba — todavía no son las ventas reales</p>
      </header>

      <section className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-500">Venta de hoy</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">{pesos.format(totalHoy)}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-500">Venta de ayer</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">{pesos.format(totalAyer)}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-500">Hoy vs. ayer</p>
          <p className="mt-2 text-3xl">
            <Variacion hoy={totalHoy} ayer={totalAyer} />
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">Ventas por local</h2>
        <ul className="space-y-4">
          {ordenados.map((local) => (
            <li key={local.id}>
              <div className="mb-1 flex items-baseline justify-between gap-4 text-sm">
                <span className="font-medium text-zinc-900">{local.nombre}</span>
                <span className="flex items-baseline gap-3">
                  <span className="text-zinc-900">{pesos.format(local.ventaHoy)}</span>
                  <Variacion hoy={local.ventaHoy} ayer={local.ventaAyer} />
                </span>
              </div>
              <div className="h-2 rounded-full bg-zinc-100">
                <div
                  className="h-2 rounded-full bg-orange-600"
                  style={{ width: `${(local.ventaHoy / maximo) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
