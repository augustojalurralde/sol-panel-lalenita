// lib/pedidosWeb.ts — PEDIDOS DE LA TIENDA ONLINE
// Circuito: entra el pedido en Tiendanube → se guarda en el SOL → aviso al grupo de Telegram de la fábrica
// con botones → la fábrica lo va pasando de estado → al estar "Listo" el bot arma el WhatsApp para el cliente.
// Las reglas (plazos y sectores) están en lib/config.ts → reglasPedidosWeb.
import { reglasPedidosWeb as R } from "./config";
import { db } from "./supabase";
import { enviar, editar, grupoFabrica, html } from "./telegram";
import { leerPedido } from "./tiendanube";
export const ESTADOS = {
    pendiente: { texto: "Pendiente de confirmar", icono: "🟡" },
    confirmado: { texto: "Confirmado", icono: "🟢" },
    en_produccion: { texto: "En producción", icono: "🔵" },
    listo: { texto: "Listo para retirar", icono: "✅" },
    entregado: { texto: "Entregado", icono: "📦" },
    cancelado: { texto: "Cancelado", icono: "❌" },
};
export const ABIERTOS = ["pendiente", "confirmado", "en_produccion", "listo"];
// ─── Reglas ─────────────────────────────────────────────────────────────────
const normal = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export function sectorDe(nombre) {
    const n = normal(nombre);
    return R.sectores.find((s) => s.palabras.some((p) => n.includes(p)))?.sector ?? "Otros";
}
const HORAS_AR = 3; // Tucumán: UTC-3 todo el año
/** Para cuándo tiene que estar listo un pedido que entró en "creado" */
export function fechaCompromiso(creado) {
    const local = new Date(creado.getTime() - HORAS_AR * 3600000); // reloj de Argentina (leído con getUTC…)
    let dias = local.getUTCHours() < R.horaCorte ? 1 : 2;
    const d = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
    while (dias > 0) {
        d.setUTCDate(d.getUTCDate() + 1);
        if (!R.diasSinEntrega.includes(d.getUTCDay()))
            dias--;
    }
    d.setUTCHours(R.horaListo + HORAS_AR); // hora de Argentina → UTC
    return d;
}
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
/** "martes 21/10 a las 15 h" */
export function textoFecha(iso) {
    if (!iso)
        return "sin fecha";
    const l = new Date(new Date(iso).getTime() - HORAS_AR * 3600000);
    const dd = String(l.getUTCDate()).padStart(2, "0"), mm = String(l.getUTCMonth() + 1).padStart(2, "0");
    const min = l.getUTCMinutes() ? `:${String(l.getUTCMinutes()).padStart(2, "0")}` : "";
    return `${DIAS[l.getUTCDay()]} ${dd}/${mm} a las ${l.getUTCHours()}${min} h`;
}
/** Fecha AAAA-MM-DD de Argentina */
export function diaAR(fecha) {
    return new Date(new Date(fecha).getTime() - HORAS_AR * 3600000).toISOString().slice(0, 10);
}
const pesos = (n) => "$" + Math.round(n).toLocaleString("es-AR");
// ─── WhatsApp para el cliente ───────────────────────────────────────────────
/** Número en formato internacional argentino (549 + característica + número) */
export function telefonoWhatsApp(tel) {
    let d = tel.replace(/\D/g, "");
    if (!d)
        return null;
    if (d.startsWith("549"))
        return d;
    if (d.startsWith("54"))
        return "549" + d.slice(2);
    if (d.startsWith("0"))
        d = d.slice(1);
    d = d.replace(/^(\d{2,4})15/, "$1"); // saca el "15" de los celulares viejos (381 15 xxxxxx)
    return "549" + d;
}
export function mensajeListo(p) {
    const nombre = p.cliente.split(" ")[0];
    return (`¡Hola ${nombre}! Te escribimos de La Leñita 🔥\n` +
        `Tu pedido #${p.numero ?? p.id} ya está listo.\n` +
        `Podés retirarlo el ${textoFecha(p.fecha_compromiso)} en ${p.retiro}.\n` +
        (p.pago === "pagado" ? `El pago ya está acreditado. ` : `Total a abonar: ${pesos(p.total)}. `) +
        `¡Gracias por tu compra!`);
}
export function linkWhatsApp(p) {
    const tel = telefonoWhatsApp(p.telefono);
    return tel ? `https://wa.me/${tel}?text=${encodeURIComponent(mensajeListo(p))}` : null;
}
// ─── Mensaje del grupo ──────────────────────────────────────────────────────
export function textoPedido(p) {
    const e = ESTADOS[p.estado];
    const porSector = new Map();
    for (const it of p.items)
        porSector.set(it.sector, [...(porSector.get(it.sector) ?? []), it]);
    const lineas = [...porSector.entries()]
        .map(([s, its]) => `<b>${html(s)}</b>\n` + its.map((i) => `  • ${i.cantidad} × ${html(i.nombre)}`).join("\n"))
        .join("\n");
    return [
        `🛒 <b>Pedido web #${p.numero ?? p.id}</b>`,
        `${e.icono} <b>${e.texto}</b>`,
        ``,
        `👤 ${html(p.cliente)}${p.telefono ? ` · ${html(p.telefono)}` : ""}`,
        `📍 Retira en: <b>${html(p.retiro)}</b>`,
        `⏰ Listo para: <b>${textoFecha(p.fecha_compromiso)}</b>`,
        `💰 ${pesos(p.total)} · ${p.pago === "pagado" ? "PAGADO ✔" : "pago pendiente (a convenir)"}${p.medio_pago ? ` · ${html(p.medio_pago)}` : ""}`,
        ``,
        lineas,
        p.nota ? `\n📝 ${html(p.nota)}` : "",
    ].filter((x) => x !== "").join("\n");
}
export function botones(p) {
    const b = (text, accion) => ({ text, callback_data: `p:${p.id}:${accion}` });
    switch (p.estado) {
        case "pendiente": return [[b("✔ Confirmar", "confirmado"), b("❌ Cancelar", "cancelado")]];
        case "confirmado": return [[b("🔵 En producción", "en_produccion"), b("✅ Listo", "listo")], [b("❌ Cancelar", "cancelado")]];
        case "en_produccion": return [[b("✅ Listo para retirar", "listo")]];
        case "listo": {
            const wa = linkWhatsApp(p);
            return [[...(wa ? [{ text: "💬 Avisar al cliente", url: wa }] : []), b("📦 Entregado", "entregado")]];
        }
        default: return [];
    }
}
// ─── Altas y cambios ────────────────────────────────────────────────────────
const ahora = () => new Date().toISOString();
async function buscar(id) {
    const [p] = await db.leer("pedidos_web", `select=*&id=eq.${id}`);
    return p ?? null;
}
/** Guarda un pedido nuevo (o lo actualiza) y avisa al grupo la primera vez */
export async function registrarPedido(tn) {
    const d = leerPedido(tn);
    const existente = await buscar(tn.id);
    const items = d.items.map((i) => ({ ...i, sector: sectorDe(i.nombre) }));
    if (existente) {
        // Ya lo teníamos: solo puede cambiar el pago o cancelarse
        if (d.cancelado && existente.estado !== "cancelado")
            return cambiarEstado(tn.id, "cancelado", "Tiendanube");
        if (d.pagado && existente.pago !== "pagado") {
            await db.actualizar("pedidos_web", `id=eq.${tn.id}`, { pago: "pagado", medio_pago: d.medio_pago, actualizado_en: ahora() });
            if (existente.estado === "pendiente")
                return cambiarEstado(tn.id, "confirmado", "Pago acreditado");
            return refrescarMensaje(tn.id);
        }
        return existente;
    }
    const nuevo = {
        id: tn.id,
        numero: d.numero,
        cliente: d.cliente,
        telefono: d.telefono,
        email: d.email,
        items,
        total: d.total,
        pago: d.pagado ? "pagado" : "pendiente",
        medio_pago: d.medio_pago,
        retiro: d.retiro,
        nota: d.nota,
        estado: d.cancelado ? "cancelado" : d.pagado ? "confirmado" : "pendiente",
        fecha_compromiso: fechaCompromiso(new Date(d.creado_en)).toISOString(),
        telegram_mensaje_id: null,
        creado_en: d.creado_en,
    };
    await db.guardar("pedidos_web", [{ ...nuevo, actualizado_en: ahora() }], "id");
    await db.insertar("pedidos_web_eventos", [{ pedido_id: nuevo.id, estado: nuevo.estado, quien: "Tiendanube" }]);
    const grupo = grupoFabrica();
    if (grupo) {
        const msg = await enviar(grupo, textoPedido(nuevo), botones(nuevo));
        await db.actualizar("pedidos_web", `id=eq.${nuevo.id}`, { telegram_mensaje_id: msg });
        nuevo.telegram_mensaje_id = msg;
    }
    return nuevo;
}
async function refrescarMensaje(id) {
    const p = await buscar(id);
    const grupo = grupoFabrica();
    if (p && grupo && p.telegram_mensaje_id)
        await editar(grupo, p.telegram_mensaje_id, textoPedido(p), botones(p));
    return p;
}
/** Cambia el estado, deja registro y actualiza el mensaje del grupo */
export async function cambiarEstado(id, estado, quien) {
    await db.actualizar("pedidos_web", `id=eq.${id}`, { estado, actualizado_en: ahora() });
    await db.insertar("pedidos_web_eventos", [{ pedido_id: id, estado, quien }]);
    return refrescarMensaje(id);
}
// ─── Consultas para el bot y el panel ───────────────────────────────────────
export async function pedidosAbiertos() {
    return db.leer("pedidos_web", `select=*&estado=in.(${ABIERTOS.join(",")})&order=fecha_compromiso.asc`);
}
export async function pedidosRecientes(dias = 30) {
    const desde = new Date(Date.now() - dias * 86400000).toISOString();
    return db.leer("pedidos_web", `select=*&creado_en=gte.${desde}&order=fecha_compromiso.desc`);
}
/** Qué hay que producir para un día (pedidos confirmados o en producción que vencen ese día) */
export function produccionDelDia(pedidos, dia) {
    const porSector = new Map();
    for (const p of pedidos) {
        if (!["confirmado", "en_produccion", "pendiente"].includes(p.estado) || diaAR(p.fecha_compromiso ?? p.creado_en) !== dia)
            continue;
        for (const it of p.items) {
            const s = porSector.get(it.sector) ?? new Map();
            s.set(it.nombre, (s.get(it.nombre) ?? 0) + it.cantidad);
            porSector.set(it.sector, s);
        }
    }
    return porSector;
}
