// proxy.ts — CONTRASEÑA DEL PANEL
// Pide usuario y contraseña antes de mostrar cualquier pantalla.
// La contraseña se configura en Vercel con la variable PANEL_PASSWORD (el usuario puede ser cualquiera).
// Si PANEL_PASSWORD no está cargada (por ejemplo en tu compu), el panel se abre sin clave.
import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const clave = process.env.PANEL_PASSWORD;
  if (!clave) return NextResponse.next();

  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    try {
      const texto = atob(auth.slice(6)); // "usuario:contraseña"
      const pass = texto.slice(texto.indexOf(":") + 1);
      if (pass === clave) return NextResponse.next();
    } catch {}
  }
  return new NextResponse("Acceso restringido — Panel SOL La Leñita", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="SOL La Lenita", charset="UTF-8"' },
  });
}

export const config = {
  // No pide clave a la tarea automática (tiene su propia clave) ni a los archivos internos
  matcher: ["/((?!api/sync|_next/static|_next/image|favicon.ico).*)"],
};
