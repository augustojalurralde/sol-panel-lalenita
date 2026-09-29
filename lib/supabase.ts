// lib/supabase.ts — Conexión a la base de datos del SOL (solo en el servidor)
// Usa SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (variables secretas; nunca van al navegador).

function credenciales() {
  const url = process.env.SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  return { url, clave };
}

async function rest<T>(ruta: string, init: RequestInit = {}): Promise<T> {
  const { url, clave } = credenciales();
  const r = await fetch(`${url}/rest/v1/${ruta}`, {
    ...init,
    cache: "no-store",
    headers: {
      apikey: clave,
      // Las claves viejas (eyJ...) también van como Authorization; las nuevas (sb_secret_...) solo como apikey
      ...(clave.startsWith("eyJ") ? { Authorization: `Bearer ${clave}` } : {}),
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  const texto = await r.text();
  return (texto ? JSON.parse(texto) : null) as T;
}

export const db = {
  leer: <T>(tabla: string, consulta = "select=*") => rest<T[]>(`${tabla}?${consulta}`),
  /** Inserta o actualiza (si ya existe la misma clave) */
  guardar: (tabla: string, filas: object[], conflicto: string) =>
    rest<null>(`${tabla}?on_conflict=${conflicto}`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(filas),
    }),
  insertar: (tabla: string, filas: object[]) =>
    rest<null>(tabla, { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(filas) }),
};
