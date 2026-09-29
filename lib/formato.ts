// lib/formato.ts — Funciones para mostrar números y fechas en formato argentino

export const pesos = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export const numero = new Intl.NumberFormat("es-AR");

export function porcentaje(valor: number): string {
  const signo = valor > 0 ? "+" : "";
  return `${signo}${valor.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
}

export function variacion(actual: number, anterior: number): number {
  if (anterior === 0) return 0;
  return ((actual - anterior) / anterior) * 100;
}

export function fechaDeHoy(): string {
  const texto = new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function colorVariacion(valor: number): string {
  if (valor > 0) return "text-emerald-600";
  if (valor < 0) return "text-red-600";
  return "text-slate-700";
}

// Fecha de hoy + N días, en formato 05/10
export function fechaEnDias(dias: number): string {
  const d = new Date(Date.now() + dias * 86400000);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", timeZone: "America/Argentina/Buenos_Aires" });
}

export function textoDias(dias: number): string {
  if (dias < -1) return `Vencido hace ${-dias} días`;
  if (dias === -1) return "Venció ayer";
  if (dias === 0) return "Hoy";
  if (dias === 1) return "Mañana";
  return `En ${dias} días`;
}

export function decimal(n: number, dec = 1): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
