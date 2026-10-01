// lib/maxirest.ts — Lee las ventas desde Mi Maxirest (solo en el servidor)
// Usa el mismo acceso que la página cloud.maxirest.com.
// Usuario y contraseña vienen de variables secretas (MAXIREST_EMAIL / MAXIREST_PASSWORD).

const API = "https://cloud-api.maxirest.com/v1/maxirestonline";
const INFORMES = "https://api-informes-legacy.backend.prod.maxirest.com/v1/maxirestonline";

export interface VentaDiaMaxirest {
  fecha: string; // AAAA-MM-DD
  salon: number;
  mostrador: number;
  delivery: number;
  total: number;
  cantidadVentas: number;
  cubiertos: number;
}

async function pedir<T>(url: string, init: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, cache: "no-store" });
  if (!r.ok) throw new Error(`Maxirest respondió ${r.status} en ${url.split("?")[0].split("/").slice(-3).join("/")}`);
  return r.json() as Promise<T>;
}

/** Inicia sesión con el usuario de Maxirest y devuelve el token del usuario */
export async function iniciarSesion(email: string, password: string): Promise<string> {
  const r = await pedir<{ token?: string }>(`${API}/clientes/v1/usuarios/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mail: email, password }),
  });
  if (!r.token) throw new Error("Maxirest no devolvió sesión (¿usuario o contraseña incorrectos?)");
  return r.token;
}

/** Entra a un local (cliente) y devuelve su token */
export async function entrarALocal(tokenUsuario: string, codigo: string): Promise<string> {
  const r = await pedir<{ token?: string }>(`${API}/clientes/v1/usuarios/login/cuentas/${codigo}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenUsuario}`, "Content-Type": "application/json" },
    body: "{}",
  });
  if (!r.token) throw new Error(`No se pudo entrar al local ${codigo}`);
  return r.token;
}

/** Medianoche de Argentina (UTC-3) en milisegundos, como lo pide Maxirest */
function medianocheAR(fecha: string): number {
  const [a, m, d] = fecha.split("-").map(Number);
  return Date.UTC(a, m - 1, d, 3);
}

/** Ventas por día de un local entre dos fechas (inclusive) */
export async function ventasPorDia(tokenLocal: string, desde: string, hasta: string): Promise<VentaDiaMaxirest[]> {
  const url = `${INFORMES}/maxirestinformes/v1/ventas/resumen/diario/concepto?from=${medianocheAR(desde)}&to=${medianocheAR(hasta)}&fechaComp=false`;
  const filas = await pedir<Record<string, unknown>[]>(url, { headers: { Authorization: `Bearer ${tokenLocal}` } });
  if (!Array.isArray(filas)) return [];
  return filas.map((x) => {
    const [d, m, a] = String(x.fecha).split("-");
    return {
      fecha: `${a}-${m}-${d}`,
      salon: Number(x.totalSalon) || 0,
      mostrador: Number(x.totalMostrador) || 0,
      delivery: Number(x.totalDomicilio) || 0,
      total: Number(x.totalVentas) || 0,
      cantidadVentas: Number(x.cantidadVentas) || 0,
      cubiertos: Number(x.cantidadCubiertos) || 0,
    };
  });
}

/* ───────────── Detalle de ventas: tickets, formas de cobro y artículos ───────────── */

/** Turnos de Maxirest: 1 = "Mañana" (en el panel: Mediodía), 2 = "Noche". La fábrica usa solo el 1. */
export const TURNOS_MAXIREST = [1, 2] as const;

/** Pide un informe y devuelve la lista (vacía si Maxirest responde "sin datos") */
async function informe(tokenLocal: string, ruta: string): Promise<Record<string, unknown>[]> {
  const r = await fetch(`${INFORMES}/maxirestinformes/v1/${ruta}`, { headers: { Authorization: `Bearer ${tokenLocal}` }, cache: "no-store" });
  if (r.status === 204) return [];
  if (!r.ok) throw new Error(`Maxirest respondió ${r.status} en ${ruta.split("?")[0]}`);
  const texto = await r.text();
  const datos = texto ? JSON.parse(texto) : [];
  return Array.isArray(datos) ? datos : [];
}

const rango = (desde: string, hasta: string) => `from=${medianocheAR(desde)}&to=${medianocheAR(hasta)}&fechaComp=false`;
const fechaISO = (f: unknown) => { const [d, m, a] = String(f).split("-"); return `${a}-${m}-${d}`; };
const hora = (h: unknown) => (/^\d{1,2}:\d{2}/.test(String(h ?? "")) ? String(h).slice(0, 5) : null);

export interface TicketMaxirest {
  fecha: string;
  comprobante: string;
  turnoMaxirest: number | null;
  horaEntrada: string | null;
  horaSalida: string | null;
  concepto: string;
  mozo: number | null;
  mesa: string;
  cubiertos: number;
  descuento: number;
  total: number;
  formasPago: string;
  pagoDividido: boolean;
}

/**
 * Tickets de un rango de días. Maxirest repite el ticket una vez por cada forma de pago
 * (con el total repetido): acá queda UNO por comprobante, con el total contado una sola vez.
 */
export async function ticketsPorRango(tokenLocal: string, desde: string, hasta: string): Promise<TicketMaxirest[]> {
  const filas = await informe(tokenLocal, `ventas/totales/detalles?${rango(desde, hasta)}`);
  const porComprobante = new Map<string, Record<string, unknown>[]>();
  for (const x of filas) {
    const fecha = fechaISO(x.fecha);
    const comp = String(x.Comprobante ?? "").trim() || `s/n ${x["Hora Entrada"]} mesa ${x.Mesa} $${x.total}`;
    const k = `${fecha}|${comp}`;
    const lista = porComprobante.get(k);
    if (lista) lista.push(x); else porComprobante.set(k, [x]);
  }
  return [...porComprobante.entries()].map(([k, lineas]) => {
    const x = lineas[0];
    const formas = [...new Set(lineas.map((l) => String(l["Forma Pago"] ?? "").trim()).filter(Boolean))];
    return {
      fecha: k.split("|")[0],
      comprobante: k.slice(k.indexOf("|") + 1),
      turnoMaxirest: Number(x.turno) || null,
      horaEntrada: hora(x["Hora Entrada"]),
      horaSalida: hora(x["Hora Salida"]),
      concepto: String(x["Nombre Concepto"] ?? "").trim() || "Sin concepto",
      mozo: x["Codigo Mozo"] == null ? null : Number(x["Codigo Mozo"]),
      mesa: String(x.Mesa ?? ""),
      cubiertos: Number(x.Cubiertos) || 0,
      descuento: Number(x.descuento) || 0,
      total: Number(x.total) || 0,
      formasPago: formas.join(" + ") || "Sin dato",
      pagoDividido: lineas.length > 1,
    };
  });
}

export interface CobroMaxirest { forma: string; codigoTipo: string; cantidad: number; total: number }

/** Formas de cobro de UN día y UN turno de Maxirest */
export async function cobrosPorTurno(tokenLocal: string, fecha: string, turno: number): Promise<CobroMaxirest[]> {
  const filas = await informe(tokenLocal, `ventas/totales/formadecobro?${rango(fecha, fecha)}&turno=${turno}`);
  return filas.map((x) => ({
    forma: String(x.nombre ?? "").trim() || "Sin nombre",
    codigoTipo: String(x.codigoTipo ?? ""),
    cantidad: Number(x.cantidad) || 0,
    total: Number(x.total) || 0,
  }));
}

export interface ArticuloMaxirest { codigo: number; nombre: string; rubro: string; unidades: number; venta: number }

/** Artículos vendidos en UN día y UN turno de Maxirest (lista completa, no solo el ranking) */
export async function articulosPorTurno(tokenLocal: string, fecha: string, turno: number): Promise<ArticuloMaxirest[]> {
  const filas = await informe(tokenLocal, `ventas/totales/articulos?${rango(fecha, fecha)}&turno=${turno}`);
  return filas.map((x) => ({
    codigo: Number(x.codigo) || 0,
    nombre: String(x.nombre ?? "").trim() || "Sin nombre",
    rubro: String(x.rubro ?? "").trim() || "Sin Rubro",
    unidades: Number(x.unidades) || 0,
    venta: Number(x.venta) || 0,
  }));
}
