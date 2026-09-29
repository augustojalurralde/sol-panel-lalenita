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
