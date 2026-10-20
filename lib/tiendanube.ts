// lib/tiendanube.ts — Conexión con la tienda online (lalenitacongelados.mitiendanube.com)
// Variables en Vercel: TIENDANUBE_APP_ID y TIENDANUBE_CLIENT_SECRET (los da Tiendanube al crear la app).
// La clave de acceso a la tienda NO se copia a mano: el panel la guarda solo en la tabla
// "integraciones" cuando se instala la app (ver app/api/tiendanube/instalar).

import { createHmac, timingSafeEqual } from "crypto";
import { db } from "./supabase";

const USER_AGENT = "SOL La Lenita (fabrica.lenita@gmail.com)";

interface Acceso { access_token: string; store_id: string }

function secretoApp() {
  const s = process.env.TIENDANUBE_CLIENT_SECRET;
  if (!s) throw new Error("Falta TIENDANUBE_CLIENT_SECRET");
  return s;
}

export function urlInstalacion() {
  const id = process.env.TIENDANUBE_APP_ID;
  if (!id) throw new Error("Falta TIENDANUBE_APP_ID");
  return `https://www.tiendanube.com/apps/${id}/authorize`;
}

/** Cambia el código que manda Tiendanube al instalar por la clave de acceso, y la guarda */
export async function completarInstalacion(codigo: string) {
  const r = await fetch("https://www.tiendanube.com/apps/authorize/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.TIENDANUBE_APP_ID,
      client_secret: secretoApp(),
      grant_type: "authorization_code",
      code: codigo,
    }),
    cache: "no-store",
  });
  const j = (await r.json()) as { access_token?: string; user_id?: number | string; error_description?: string };
  if (!j.access_token || !j.user_id) throw new Error(j.error_description ?? `Tiendanube respondió ${r.status}`);
  const acceso: Acceso = { access_token: j.access_token, store_id: String(j.user_id) };
  await db.guardar("integraciones", [{ nombre: "tiendanube", datos: acceso, actualizado_en: new Date().toISOString() }], "nombre");
  return acceso;
}

async function acceso(): Promise<Acceso> {
  const [fila] = await db.leer<{ datos: Acceso }>("integraciones", "select=datos&nombre=eq.tiendanube");
  if (!fila?.datos?.access_token) throw new Error("La tienda todavía no está conectada (falta instalar la app)");
  return fila.datos;
}

export async function api<T = unknown>(ruta: string, init: { method?: string; body?: object } = {}): Promise<T> {
  const { access_token, store_id } = await acceso();
  const r = await fetch(`https://api.tiendanube.com/v1/${store_id}${ruta}`, {
    method: init.method ?? "GET",
    headers: { Authentication: `bearer ${access_token}`, "User-Agent": USER_AGENT, "Content-Type": "application/json" },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`Tiendanube ${r.status}: ${texto.slice(0, 300)}`);
  return (texto ? JSON.parse(texto) : null) as T;
}

/** Comprueba que un aviso (webhook) viene de verdad de Tiendanube */
export function avisoAutentico(cuerpo: string, firma: string | null) {
  if (!firma) return false;
  const esperada = createHmac("sha256", secretoApp()).update(cuerpo, "utf8").digest("hex");
  const a = Buffer.from(esperada), b = Buffer.from(firma.trim().toLowerCase());
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Pide a Tiendanube que avise al panel cada vez que pasa algo con un pedido */
export async function registrarAvisos(urlAviso: string) {
  const existentes = await api<{ id: number; event: string; url: string }[]>("/webhooks");
  const eventos = ["order/created", "order/paid", "order/cancelled"];
  const hechos: string[] = [];
  for (const ev of eventos) {
    if (existentes.some((w) => w.event === ev && w.url === urlAviso)) { hechos.push(`${ev} (ya estaba)`); continue; }
    await api("/webhooks", { method: "POST", body: { event: ev, url: urlAviso } });
    hechos.push(ev);
  }
  return hechos;
}

// ─── Pedidos ────────────────────────────────────────────────────────────────

export interface PedidoTN {
  id: number;
  number?: number;
  status?: string;
  payment_status?: string;
  gateway_name?: string;
  payment_details?: { method?: string };
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  customer?: { name?: string; phone?: string; email?: string };
  products?: { name?: string | Record<string, string>; quantity?: number | string; price?: number | string }[];
  total?: number | string;
  note?: string;
  owner_note?: string;
  shipping_option?: string | Record<string, string>;
  shipping_pickup_type?: string;
  shipping_store_branch_name?: string;
  shipping_pickup_details?: { name?: string; address?: { address?: string; number?: string } };
  created_at?: string;
}

export const pedido = (id: number | string) => api<PedidoTN>(`/orders/${id}`);

const texto = (x: unknown) => (typeof x === "string" ? x : x && typeof x === "object" ? Object.values(x as Record<string, string>)[0] ?? "" : "");

/** Datos del pedido en el formato del SOL */
export function leerPedido(p: PedidoTN) {
  const retiro =
    p.shipping_pickup_details?.name || p.shipping_store_branch_name || texto(p.shipping_option) || "Sin indicar";
  return {
    numero: p.number ?? null,
    cliente: p.contact_name || p.customer?.name || "Sin nombre",
    telefono: p.contact_phone || p.customer?.phone || "",
    email: p.contact_email || p.customer?.email || "",
    items: (p.products ?? []).map((x) => ({
      nombre: texto(x.name).trim(),
      cantidad: Number(x.quantity) || 0,
      precio: Number(x.price) || 0,
    })),
    total: Number(p.total) || 0,
    pagado: p.payment_status === "paid",
    cancelado: p.status === "cancelled" || p.payment_status === "voided",
    medio_pago: p.payment_details?.method || p.gateway_name || "",
    retiro,
    nota: p.note || "",
    creado_en: p.created_at ? new Date(p.created_at).toISOString() : new Date().toISOString(),
  };
}

// ─── Stock ──────────────────────────────────────────────────────────────────

interface ProductoTN { id: number; name: Record<string, string> | string; variants: { id: number; stock: number | null }[] }

const normal = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Busca productos cuyo nombre contenga TODAS las palabras (ej: "pizza ternera") */
export async function buscarProductos(busqueda: string) {
  const palabras = normal(busqueda).split(/\s+/).filter(Boolean);
  const todos: ProductoTN[] = [];
  for (let pagina = 1; pagina <= 5; pagina++) {
    const lote = await api<ProductoTN[]>(`/products?per_page=100&page=${pagina}&fields=id,name,variants`);
    todos.push(...lote);
    if (lote.length < 100) break;
  }
  return todos
    .map((p) => ({ id: p.id, nombre: texto(p.name), variantes: p.variants }))
    .filter((p) => palabras.every((w) => normal(p.nombre).includes(w)));
}

/** Pone el stock de un producto (todas sus variantes). null = sin límite */
export async function ponerStock(productoId: number, variantes: { id: number }[], stock: number | null) {
  for (const v of variantes) {
    await api(`/products/${productoId}/variants/${v.id}`, { method: "PUT", body: { stock } });
  }
}
