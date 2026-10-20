// docs/pedidosya-lector-estado-de-cuenta.js
// LECTOR DEL ESTADO DE CUENTA SEMANAL DE PEDIDOSYA (se ejecuta en la pestaña del portal, Finanzas)
//
// El botón "Descargar estado de cuenta" de cada semana arma un .zip (PDF + Excel con todos los pedidos,
// reclamos y reintegros de los 6 locales). Este lector:
//   1) intercepta ese archivo cuando se aprieta el botón (no lo guarda en la compu),
//   2) lo abre dentro del navegador,
//   3) devuelve los datos ya resumidos para cargar en el SOL.
//
// Uso (desde la tarea semanal):
//   a) Pegar PASO 1 en la pestaña de Finanzas.
//   b) Apretar el botón "Descargar estado de cuenta" de la semana.
//   c) Pegar PASO 2: devuelve { desde, ventas_local, dias, cargos, controles } y lo deja en window.__peyaResultado.
//   d) Mandarlo al SOL: enviar({ tipo: "estado_de_cuenta", ...window.__peyaResultado }) (ver docs/pedidosya-tarea-semanal.md).

// ── PASO 1: preparar la captura ──────────────────────────────────────────────
window.__peya = null;
if (!window.__peyaHook) {
  window.__peyaHook = true;
  const original = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (/estado-de-cuenta/i.test(this.download || "") && /^data:|^blob:/.test(this.href)) {
      window.__peya = { href: this.href, nombre: this.download };
      return; // no se guarda en la compu
    }
    return original.call(this);
  };
}
"listo: apretá Descargar estado de cuenta";

// ── PASO 2: abrir el archivo y resumir ───────────────────────────────────────
// Sirve para los dos formatos de PedidosYa: el nuevo (un Excel con las hojas "Lista de Pedidos",
// "Cargos por reclamos" y "Reintegros") y el viejo (hasta mayo 2026: un Excel por cosa dentro del zip).
window.__peyaResultado = await (async () => {
  if (!window.__peya) return { error: "Todavía no se apretó el botón de descarga" };
  const { href, nombre } = window.__peya;
  const bytes = new Uint8Array(await (await fetch(href)).arrayBuffer());
  async function unzip(b) {
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    let e = b.length - 22; while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
    const total = v.getUint16(e + 10, true); let p = v.getUint32(e + 16, true); const salida = {};
    for (let i = 0; i < total; i++) {
      const metodo = v.getUint16(p + 10, true), comp = v.getUint32(p + 20, true);
      const ln = v.getUint16(p + 28, true), ex = v.getUint16(p + 30, true), co = v.getUint16(p + 32, true), local = v.getUint32(p + 42, true);
      const nom = new TextDecoder().decode(b.subarray(p + 46, p + 46 + ln));
      const ini = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
      const datos = b.subarray(ini, ini + comp);
      salida[nom] = metodo === 0 ? datos : new Uint8Array(await new Response(new Blob([datos]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
      p += 46 + ln + ex + co;
    }
    return salida;
  }
  async function hojasDe(bytesXls) {
    const x = await unzip(bytesXls);
    const xml = (n) => new DOMParser().parseFromString(new TextDecoder().decode(x[n]), "application/xml");
    const comp = x["xl/sharedStrings.xml"] ? [...xml("xl/sharedStrings.xml").getElementsByTagName("si")].map((si) => [...si.getElementsByTagName("t")].map((t) => t.textContent).join("")) : [];
    const rels = {}; for (const r of xml("xl/_rels/workbook.xml.rels").getElementsByTagName("Relationship")) rels[r.getAttribute("Id")] = r.getAttribute("Target");
    const hojas = {};
    for (const s of xml("xl/workbook.xml").getElementsByTagName("sheet")) {
      const id = s.getAttribute("r:id") || s.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
      const filas = [];
      for (const row of xml("xl/" + rels[id].replace(/^\/?xl\//, "")).getElementsByTagName("row")) {
        const fila = [];
        for (const c of row.getElementsByTagName("c")) {
          const col = c.getAttribute("r").replace(/\d+/g, "").split("").reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1;
          const t = c.getAttribute("t"), vv = c.getElementsByTagName("v")[0]?.textContent;
          fila[col] = t === "s" ? comp[+vv] : t === "inlineStr" ? c.getElementsByTagName("t")[0]?.textContent : vv;
        }
        filas.push(fila);
      }
      const [enc, ...resto] = filas;
      hojas[s.getAttribute("name")] = enc ? resto.filter((f) => f.some((c) => c !== undefined && c !== "")).map((f) => Object.fromEntries(enc.map((h, i) => [String(h ?? "").trim(), f[i]]))) : [];
    }
    return hojas;
  }
  const externo = await unzip(bytes);
  let pedidos = [], reclamos = [], cancelaciones = [], reintegros = [];
  const nombres = Object.keys(externo).filter((n) => /\.xlsx?$/i.test(n));
  if (!nombres.length) return { error: "sin Excel", archivos: Object.keys(externo) };
  for (const n of nombres) {
    const h = await hojasDe(externo[n]);
    const primera = Object.values(h)[0] || [];
    if (/cargos-por-reclamos/i.test(n)) reclamos.push(...primera);
    else if (/cargos-por-cancelaciones/i.test(n)) cancelaciones.push(...primera);
    else if (/reintegros/i.test(n)) reintegros.push(...primera);
    else {
      pedidos.push(...(h["Lista de Pedidos"] || primera));
      reclamos.push(...(h["Cargos por reclamos"] || []));
      cancelaciones.push(...(h["Cargos por cancelaciones"] || []));
      reintegros.push(...(h["Reintegros"] || []));
    }
  }
  const num = (s) => { if (s === undefined || s === null || s === "") return 0; const n = Number(String(s).replace(",", ".")); return Number.isFinite(n) ? n : 0; };
  const iso = (s) => { s = String(s); if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) { const [d, m, a] = s.split("/"); return `${a}-${m}-${d}`; } if (/^\d+(\.\d+)?$/.test(s)) return new Date(Math.round((+s - 25569) * 864e5)).toISOString().slice(0, 10); return s.slice(0, 10); };
  const r2 = (n) => Math.round(n * 100) / 100;
  const campo = (o, ...ns) => { for (const k of Object.keys(o)) if (ns.some((n) => k.toLowerCase().startsWith(n.toLowerCase()))) return o[k]; };
  const m = (nombre || "").match(/^(\d{4})(\d{2})(\d{2})_/); const desde = `${m[1]}-${m[2]}-${m[3]}`;
  pedidos = pedidos.filter((p) => campo(p, "Sucursal"));
  const semana = new Map(), dia = new Map();
  for (const p of pedidos) {
    const local = campo(p, "Sucursal"), fecha = iso(campo(p, "Fecha de pedido"));
    const bruto = num(campo(p, "Monto bruto")), desc = num(campo(p, "Descuento otorgado por el local"));
    const neta = num(campo(p, "Monto de Venta Neta", "Monto neto de la Venta")), comision = num(campo(p, "Servicio Ventas PedidoYa ($)"));
    const plus = num(campo(p, "Cargo por Pedidos con Plus")), efectivo = campo(p, "Cobrado por") === "Tu Local";
    const s = semana.get(local) || { desde, local, pedidos: 0, bruto: 0, desc_local: 0, neta: 0, comision: 0, plus: 0, efectivos: 0 };
    s.pedidos++; s.bruto += bruto; s.desc_local += desc; s.neta += neta; s.comision += comision; s.plus += plus; s.efectivos += efectivo ? 1 : 0; semana.set(local, s);
    const k = fecha + "|" + local, d = dia.get(k) || { fecha, local, pedidos: 0, cancelados: 0, bruto: 0, neta: 0, fuente: "factura" };
    d.pedidos++; d.bruto += bruto; d.neta += neta; dia.set(k, d);
  }
  const cargos = [];
  const nro = (c) => String(campo(c, "Número de pedido", "Numero de pedido") ?? "");
  for (const c of reclamos) { const tt = String(campo(c, "Tipo de Cargo") || ""); cargos.push({ nro: nro(c), tipo: /cancel|rechaz/i.test(tt) ? "rechazo" : "reclamo", local: campo(c, "Sucursal"), fecha: iso(campo(c, "Fecha del pedido", "Fecha de pedido")), motivo: campo(c, "Motivo") || null, monto_pedido: num(campo(c, "Monto del Pedido")), monto: num(campo(c, "Cargos por reclamos de los usuarios", "Monto final")), semana: desde }); }
  for (const c of cancelaciones) cargos.push({ nro: nro(c), tipo: "rechazo", local: campo(c, "Sucursal"), fecha: iso(campo(c, "Fecha del pedido", "Fecha de pedido")), motivo: campo(c, "Motivo") || null, monto_pedido: num(campo(c, "Monto del Pedido")), monto: num(campo(c, "Monto final")), semana: desde });
  for (const c of reintegros) cargos.push({ nro: nro(c), tipo: "reintegro", local: campo(c, "Sucursal"), fecha: iso(campo(c, "Fecha del pedido", "Fecha de pedido")), motivo: String(campo(c, "Tipo de Reintegro") || "") + (campo(c, "Estado del pedido") ? ` (${campo(c, "Estado del pedido")})` : ""), monto_pedido: num(campo(c, "Monto del Pedido")), monto: num(campo(c, "Monto neto a reintegrar")), semana: desde });
  const ventas_local = [...semana.values()].map(({ efectivos, ...s }) => ({ ...s, bruto: r2(s.bruto), desc_local: r2(s.desc_local), neta: r2(s.neta), comision: r2(s.comision), plus: r2(s.plus), efectivo_pct: r2((efectivos / s.pedidos) * 100), fuente: "factura" }));
  const dias = [...dia.values()].map((d) => ({ ...d, bruto: r2(d.bruto), neta: r2(d.neta) }));
  return { desde, archivos: nombres, controles: { pedidos: pedidos.length, neta: r2(ventas_local.reduce((a, s) => a + s.neta, 0)), comision: r2(ventas_local.reduce((a, s) => a + s.comision, 0)) }, ventas_local, dias, cargos: cargos.filter((c) => c.nro) };
})();
window.__peyaResultado.controles;

// ── PASO 3: liquidación de la semana (texto de "Ver detalle", leído en un iframe) ─
// const domingo = "2026-10-11";
// const f = document.createElement("iframe"); f.style = "position:fixed;left:-4000px;width:1300px;height:1000px";
// f.src = `/finance-py/contracts/84486/account-statuses/${btoa(`WEEKLY#AR#BP#84486|${domingo}#ID#0|BDH`)}?showCreditTab=0`;
// document.body.appendChild(f);  → esperar unos segundos hasta que f.contentDocument.body.innerText tenga "Total liquidado"
// enviar({ tipo: "liquidacion", texto: f.contentDocument.body.innerText }); f.remove();
// (La página no tiene <main>: usar body.innerText.)
