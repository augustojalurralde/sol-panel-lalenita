// lib/pedidosWeb.ts — PEDIDOS DE LA TIENDA ONLINE
// Circuito: entra el pedido en Tiendanube → se guarda en el SOL → aviso al grupo de Telegram de la fábrica
// con botones → la fábrica lo va pasando de estado → al estar "Listo" el bot arma el WhatsApp para el cliente.
// Las reglas (plazos y sectores) están en lib/config.ts → reglasPedidosWeb.

import { reglasPedidosWeb as R } from "./config";
import { db } from "./supabase";
import { enviar, editar, grupoFabrica, html, type Teclado } from "./telegram";
import { leerPedido, type PedidoTN } from "./tiendanube";

export type Estado = "pendiente" | "confirmado" | "en_produccion" | "listo" | "entregado" | "cancelado";

export const ESTADOS: Record<Estado, { texto: string; icono: string }> = {
  pendiente: { texto: "Pendiente de confirmar", icono: "🟡" },
  confirmado: { texto: "Confirmado", icono: "🟢" },
  en_produccion: { texto: "En producción", icono: "🔵" },
  listo: { texto: "Listo para retirar", icono: "✅" },
  entregado: { texto: "Entregado", icono: "📦" },
  cancelado: { texto: "Cancelado", icono: "❌" },
};

export const ABIERTOS: Estado[] = ["pendiente", "confirmado", "en_produccion", "listo"];

export interface Item { nombre: string; cantidad: number; precio: number; sector: string }

export interface PedidoWeb {
  id: number;
  numero: number | null;
  cliente: string;
  telefono: string;
  email: string;
  items: Item[];
  total: number;
  pago: "pagado" | "pendiente";
  medio_pago: string;
  retiro: string;
  nota: string;
  estado: Estado;
  fecha_compromiso: string | null;
  telegram_mensaje_id: number | null;
  creado_en: string;
}

// ─── Reglas ─────────────────────────────────────────────────────────────────

const normal = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function sectorDe(nombre: string) {
  const n = normal(nombre);
  return R.sectores.find((s) => s.palabras.some((p) => n.includes(p)))?.sector ?? "Otros";
}

const HORAS_AR = 3; // Tucumán: UTC-3 todo el año

/** Para cuándo tiene que estar listo un pedido que entró en "creado" */
export function fechaCompromiso(creado: Date) {
  const local = new Date(creado.getTime() - HORAS_AR * 3600_000); // reloj de Argentina (leído con getUTC…)
  let dias = local.getUTCHours() < R.horaCorte ? 1 : 2;
  const d = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
  while (dias > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (!R.diasSinEntrega.includes(d.getUTCDay())) dias--;
  }
  d.setUTCHours(R.horaListo + HORAS_AR); // hora de Argentina → UTC
  return d;
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** "martes 21/10 a las 15 h" */
export function textoFecha(iso: string | null) {
  if (!iso) return "sin fecha";
  const l = new Date(new Date(iso).getTime() - HORAS_AR * 3600_000);
  const dd = String(l.getUTCDate()).padStart(2, "0"), mm = String(l.getUTCMonth() + 1).padStart(2, "0");
  const min = l.getUTCMinutes() ? `:${String(l.getUTCMinutes()).padStart(2, "0")}` : "";
  return `${DIAS[l.getUTCDay()]} ${dd}/${mm} a las ${l.getUTCHours()}${min} h`;
}

/** Fecha AAAA-MM-DD de Argentina */
export function diaAR(fecha: Date | string) {
  return new Date(new Date(fecha).getTime() - HORAS_AR * 3600_000).toISOString().slice(0, 10);
}

const pesos = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");

// ─── WhatsApp para el cliente ───────────────────────────────────────────────

/** Número en formato internacional argentino (549 + característica + número) */
export function telefonoWhatsApp(tel: string) {
  let d = tel.replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("549")) return d;
  if (d.startsWith("54")) return "549" + d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  // Un número argentino tiene 10 dígitos (característica + número). Si tiene 12, trae el "15" del celular
  // después de la característica (381 15 xxxxxxx): se lo sacamos.
  if (d.length === 12) {
    for (const largo of [2, 3, 4]) {
      if (d.slice(largo, largo + 2) === "15") { d = d.slice(0, largo) + d.slice(largo + 2); break; }
    }
  }
  return "549" + d;
}

export function mensajeListo(p: PedidoWeb) {
  const nombre = p.cliente.split(" ")[0];
  return (
    `¡Hola ${nombre}! Te escribimos de La Leñita 🔥\n` +
    `Tu pedido #${p.numero ?? p.id} ya está listo.\n` +
    `Podés retirarlo el ${textoFecha(p.fecha_compromiso)} en ${p.retiro}.\n` +
    (p.pago === "pagado" ? `El pago ya está acreditado. ` : `Total a abonar: ${pesos(p.total)}. `) +
    `¡Gracias por tu compra!`
  );
}

export function linkWhatsApp(p: PedidoWeb) {
  const tel = telefonoWhatsApp(p.telefono);
  return tel ? `https://wa.me/${tel}?text=${encodeURIComponent(mensajeListo(p))}` : null;
}

// ─── Mensaje del grupo ──────────────────────────────────────────────────────

export function textoPedido(p: PedidoWeb) {
  const e = ESTADOS[p.estado];
  const porSector = new Map<string, Item[]>();
  for (const it of p.items) porSector.set(it.sector, [...(porSector.get(it.sector) ?? []), it]);
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
    p.nota ? `\n📝 ${html(p.nota)}` : null,
  ].filter((x) => x !== null).join("\n");
}

export function botones(p: PedidoWeb): Teclado {
  const b = (text: string, accion: string) => ({ text, callback_data: `p:${p.id}:${accion}` });
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

async function buscar(id: number) {
  const [p] = await db.leer<PedidoWeb>("pedidos_web", `select=*&id=eq.${id}`);
  return p ?? null;
}

/** Guarda un pedido nuevo (o lo actualiza) y avisa al grupo la primera vez */
export async function registrarPedido(tn: PedidoTN) {
  const d = leerPedido(tn);
  const existente = await buscar(tn.id);
  const items: Item[] = d.items.map((i) => ({ ...i, sector: sectorDe(i.nombre) }));

  if (existente) {
    // Ya lo teníamos: solo puede cambiar el pago o cancelarse
    if (d.cancelado && existente.estado !== "cancelado") return cambiarEstado(tn.id, "cancelado", "Tiendanube");
    if (d.pagado && existente.pago !== "pagado") {
      await db.actualizar("pedidos_web", `id=eq.${tn.id}`, { pago: "pagado", medio_pago: d.medio_pago, actualizado_en: ahora() });
      if (existente.estado === "pendiente") return cambiarEstado(tn.id, "confirmado", "Pago acreditado");
      return refrescarMensaje(tn.id);
    }
    return existente;
  }

  const nuevo: PedidoWeb = {
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

  const grupo = await grupoFabrica();
  if (grupo) {
    const msg = await enviar(grupo, textoPedido(nuevo), botones(nuevo));
    await db.actualizar("pedidos_web", `id=eq.${nuevo.id}`, { telegram_mensaje_id: msg });
    nuevo.telegram_mensaje_id = msg;
  }
  return nuevo;
}

async function refrescarMensaje(id: number) {
  const p = await buscar(id);
  const grupo = await grupoFabrica();
  if (p && grupo && p.telegram_mensaje_id) await editar(grupo, p.telegram_mensaje_id, textoPedido(p), botones(p));
  return p;
}

/** Cambia el estado, deja registro y actualiza el mensaje del grupo */
export async function cambiarEstado(id: number, estado: Estado, quien: string) {
  await db.actualizar("pedidos_web", `id=eq.${id}`, { estado, actualizado_en: ahora() });
  await db.insertar("pedidos_web_eventos", [{ pedido_id: id, estado, quien }]);
  return refrescarMensaje(id);
}

// ─── Consultas para el bot y el panel ───────────────────────────────────────

export async function pedidosAbiertos() {
  return db.leer<PedidoWeb>("pedidos_web", `select=*&estado=in.(${ABIERTOS.join(",")})&order=fecha_compromiso.asc`);
}

export async function pedidosRecientes(dias = 30) {
  const desde = new Date(Date.now() - dias * 86400_000).toISOString();
  return db.leer<PedidoWeb>("pedidos_web", `select=*&creado_en=gte.${desde}&order=fecha_compromiso.desc`);
}

/** Qué hay que producir para un día (pedidos confirmados o en producción que vencen ese día) */
export function produccionDelDia(pedidos: PedidoWeb[], dia: string) {
  const porSector = new Map<string, Map<string, number>>();
  for (const p of pedidos) {
    if (!["confirmado", "en_produccion", "pendiente"].includes(p.estado) || diaAR(p.fecha_compromiso ?? p.creado_en) !== dia) continue;
    for (const it of p.items) {
      const s = porSector.get(it.sector) ?? new Map<string, number>();
      s.set(it.nombre, (s.get(it.nombre) ?? 0) + it.cantidad);
      porSector.set(it.sector, s);
    }
  }
  return porSector;
}
