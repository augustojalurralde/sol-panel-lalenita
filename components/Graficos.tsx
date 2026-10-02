// components/Graficos.tsx — Gráficos simples hechos a mano (sin librerías), se dibujan en el servidor.
// Reglas de diseño: colores fijos por local (aptos para daltonismo), líneas finas, grilla suave,
// leyenda siempre visible y el detalle al pasar el mouse.
import type { Apilado, Calor, Reparto, TopArticulo } from "@/lib/estadisticas";
import { pesos, numero, porcentaje, variacion } from "@/lib/formato";

/** $ en formato corto: $ 12,3 M · $ 850 mil · $ 900 */
export function corto(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e6) return `$ ${(n / 1e6).toLocaleString("es-AR", { maximumFractionDigits: a >= 1e8 ? 0 : 1 })} M`;
  if (a >= 1e3) return `$ ${Math.round(n / 1e3).toLocaleString("es-AR")} mil`;
  return `$ ${Math.round(n).toLocaleString("es-AR")}`;
}

/** Tope "redondo" para el eje */
function topeLindo(max: number): number {
  if (max <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(max)));
  for (const m of [1, 2, 4, 6, 8, 10]) if (m * p >= max) return m * p;
  return 10 * p;
}

/** Colores sobre los que conviene texto oscuro */
const CLAROS = new Set(["#1baf7a", "#eda100", "#e87ba4", "#a3a29c"]);

export function Leyenda({ items }: { items: { nombre: string; color: string }[] }) {
  return (
    <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
      {items.map((i) => (
        <span key={i.nombre} className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />{i.nombre}
        </span>
      ))}
    </div>
  );
}

/** Barras apiladas por mes. Al pasar el mouse por una barra muestra el detalle. */
export function BarrasApiladas({ datos, alto = 260 }: { datos: Apilado; alto?: number }) {
  const { categorias } = datos;
  // Orden de la pila: abajo el que menos vendió en el período, arriba el que más (la leyenda y el cartelito siguen el mismo orden)
  const total = (s: { valores: number[] }) => s.valores.reduce((x, v) => x + v, 0);
  const series = [...datos.series].sort((a, b) => total(a) - total(b));
  if (!series.length) return <p className="py-8 text-center text-sm text-slate-500">Sin datos todavía.</p>;
  const W = 820, H = alto, L = 62, R = 10, T = 26, B = 26;
  const totales = categorias.map((_, i) => series.reduce((s, x) => s + x.valores[i], 0));
  const tope = topeLindo(Math.max(...totales));
  const y = (v: number) => T + (H - T - B) * (1 - v / tope);
  const banda = (W - L - R) / categorias.length;
  const ancho = Math.min(40, banda * 0.62);
  const mejor = totales.indexOf(Math.max(...totales));
  const marcas = [0, 0.25, 0.5, 0.75, 1].map((f) => tope * f);
  const altoTip = 22 + 16 * (series.length + 1);

  return (
    <>
      {series.length > 1 && <Leyenda items={[...series].reverse()} />}
      <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[620px]" role="img" aria-label="Gráfico de barras por mes">
        {marcas.map((m) => (
          <g key={m}>
            <line x1={L} x2={W - R} y1={y(m)} y2={y(m)} stroke={m ? "#e8e7e3" : "#c9c8c2"} strokeWidth={1} />
            <text x={L - 8} y={y(m) + 4} textAnchor="end" fontSize={11} fill="#6b6a65">{m ? corto(m) : "0"}</text>
          </g>
        ))}
        {categorias.map((c, i) => {
          const cx = L + banda * i + banda / 2;
          const x0 = cx - ancho / 2;
          let base = 0;
          const visibles = series.filter((s) => s.valores[i] > 0);
          const ultima = visibles[visibles.length - 1];
          return (
            <g key={c}>
              {visibles.map((s, k) => {
                const y0 = y(base), y1 = y(base + s.valores[i]);
                base += s.valores[i];
                const h = Math.max(y0 - y1 - (k === 0 ? 0 : 2), 0); // 2px de separación entre tramos
                if (s !== ultima) return <rect key={s.nombre} x={x0} y={y1} width={ancho} height={h} fill={s.color} />;
                const r = Math.min(4, h / 2); // punta redondeada solo arriba
                return (
                  <path key={s.nombre} fill={s.color}
                    d={`M${x0},${y1 + h} V${y1 + r} Q${x0},${y1} ${x0 + r},${y1} H${x0 + ancho - r} Q${x0 + ancho},${y1} ${x0 + ancho},${y1 + r} V${y1 + h} Z`} />
                );
              })}
              <text x={cx} y={H - 8} textAnchor="middle" fontSize={11} fill="#6b6a65">{c}</text>
              {(i === mejor || i === categorias.length - 1) && totales[i] > 0 && (
                <text x={cx} y={y(totales[i]) - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill="#2f2e2b">{corto(totales[i])}</text>
              )}
            </g>
          );
        })}
        {/* segunda pasada: zona para el mouse + cartelito (arriba de todas las barras) */}
        {categorias.map((c, i) => {
          const cx = L + banda * i + banda / 2;
          return (
            <g key={c + "-tip"}>
              
              <g className="group">
                <rect x={L + banda * i} y={T} width={banda} height={H - T - B} className="fill-transparent group-hover:fill-slate-900/5" />
                <g className="pointer-events-none opacity-0 group-hover:opacity-100">
                  {(() => {
                    const wTip = 190;
                    // al costado de la barra (a la derecha; si no entra, a la izquierda)
                    const xt = cx + ancho / 2 + 8 + wTip <= W - R ? cx + ancho / 2 + 8 : cx - ancho / 2 - 8 - wTip;
                    const yt = T;
                    return (
                      <>
                        <rect x={xt} y={yt} width={wTip} height={altoTip} rx={6} fill="#ffffff" stroke="#d6d5cf" />
                        <text x={xt + 10} y={yt + 18} fontSize={12} fontWeight={600} fill="#2f2e2b">{c.replace("*", " (en curso)")} · {corto(totales[i])}</text>
                        {[...series].reverse().map((s, k) => (
                          <g key={s.nombre}>
                            <rect x={xt + 10} y={yt + 28 + k * 16} width={8} height={8} rx={2} fill={s.color} />
                            <text x={xt + 24} y={yt + 36 + k * 16} fontSize={11} fill="#52514e">{s.nombre}</text>
                            <text x={xt + wTip - 10} y={yt + 36 + k * 16} fontSize={11} textAnchor="end" fill="#2f2e2b">{corto(s.valores[i])}</text>
                          </g>
                        ))}
                      </>
                    );
                  })()}
                </g>
              </g>
            </g>
          );
        })}
      </svg>
      </div>
    </>
  );
}

const RAMPA = ["#e6f0fd", "#cde2fb", "#b7d3f6", "#9ec5f4", "#86b6ef", "#6da7ec", "#5598e7", "#3987e5", "#2a78d6", "#1c5cab"];

/** Mapa de calor: cada fila se compara consigo misma (más oscuro = más alto dentro de esa fila) */
export function MapaCalor({ datos, formato, ancho1 = "w-36" }: { datos: Calor; formato: (n: number) => string; ancho1?: string }) {
  if (!datos.filas.length) return <p className="py-8 text-center text-sm text-slate-500">Sin datos todavía.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-[2px] text-xs">
        <thead>
          <tr>
            <th className={`${ancho1}`} />
            {datos.columnas.map((c) => <th key={c} className="px-1 pb-1 text-center font-medium text-slate-500">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {datos.filas.map((f) => {
            const max = Math.max(...f.valores.map((v) => v ?? 0));
            return (
              <tr key={f.nombre}>
                <td className="whitespace-nowrap pr-2 text-sm font-medium text-slate-800">{f.nombre}</td>
                {f.valores.map((v, i) => {
                  if (v === null || !max) return <td key={i} className="rounded bg-slate-50 px-1 py-2 text-center text-slate-300">—</td>;
                  const paso = Math.min(RAMPA.length - 1, Math.floor((v / max) * (RAMPA.length - 1) + 0.0001));
                  return (
                    <td key={i} title={`${f.nombre} · ${datos.columnas[i]}: ${formato(v)}`}
                      className={`whitespace-nowrap rounded px-1 py-2 text-center ${paso >= 6 ? "text-white" : "text-slate-800"} ${v === max ? "font-bold" : ""}`}
                      style={{ background: RAMPA[paso] }}>
                      {formato(v)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Barras al 100%: cómo se reparte el total de cada local */
export function BarrasReparto({ datos }: { datos: Reparto }) {
  if (!datos.filas.length) return <p className="py-8 text-center text-sm text-slate-500">Sin datos todavía.</p>;
  return (
    <>
      <Leyenda items={datos.categorias} />
      <div className="mt-3 space-y-3">
        {datos.filas.map((f) => (
          <div key={f.nombre} className="grid grid-cols-[8.5rem_1fr] items-center gap-3">
            <div className="truncate text-sm font-medium text-slate-800" title={f.nombre}>{f.nombre}</div>
            <div className="flex h-7 gap-[2px] overflow-hidden rounded">
              {f.partes.filter((p) => p.valor > 0).map((p) => {
                const pct = (p.valor / f.total) * 100;
                const color = datos.categorias.find((c) => c.nombre === p.nombre)!.color;
                return (
                  <div key={p.nombre} title={`${f.nombre} · ${p.nombre}: ${pesos.format(p.valor)} (${Math.round(pct)}%)`}
                    className={`flex items-center justify-center text-[11px] font-semibold ${CLAROS.has(color) ? "text-slate-900" : "text-white"}`}
                    style={{ width: `${pct}%`, background: color }}>
                    {pct >= 9 ? `${Math.round(pct)}%` : ""}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/** Ranking de artículos: barra + venta + unidades + variación contra los 30 días anteriores */
export function RankingArticulos({ lista }: { lista: TopArticulo[] }) {
  if (!lista.length) return <p className="py-8 text-center text-sm text-slate-500">Sin datos todavía.</p>;
  const max = Math.max(...lista.map((a) => a.venta));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="border-b border-slate-200 text-xs text-slate-500">
          <tr>
            <th className="py-2 pr-2 text-left font-medium">#</th>
            <th className="py-2 pr-3 text-left font-medium">Artículo</th>
            <th className="w-[38%] py-2 font-medium" />
            <th className="py-2 pl-3 text-right font-medium">Venta</th>
            <th className="py-2 pl-3 text-right font-medium">Unidades</th>
            <th className="py-2 pl-3 text-right font-medium">vs 30 días ant.</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {lista.map((a, i) => {
            const v = a.ventaAnt ? variacion(a.venta, a.ventaAnt) : null;
            return (
              <tr key={a.nombre}>
                <td className="py-1.5 pr-2 text-xs text-slate-400">{i + 1}</td>
                <td className="max-w-[14rem] truncate py-1.5 pr-3 text-slate-800" title={a.nombre}>{a.nombre}</td>
                <td className="py-1.5"><div className="h-3 rounded-r" style={{ width: `${(a.venta / max) * 100}%`, background: "#2a78d6" }} /></td>
                <td className="whitespace-nowrap py-1.5 pl-3 text-right font-medium text-slate-900">{corto(a.venta)}</td>
                <td className="whitespace-nowrap py-1.5 pl-3 text-right text-slate-600">{numero.format(Math.round(a.unidades))}</td>
                <td className={`whitespace-nowrap py-1.5 pl-3 text-right text-xs font-medium ${v === null ? "text-slate-400" : v >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {v === null ? "nuevo" : porcentaje(Math.round(v))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
