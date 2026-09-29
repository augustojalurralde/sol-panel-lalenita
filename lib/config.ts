// lib/config.ts — REGLAS DE LOS SEMÁFOROS (todas en un solo lugar)
// Para cambiar un umbral, se cambia solo acá. Lo que dice null está "Sin definir".

export type Semaforo = "verde" | "amarillo" | "rojo" | "gris";

export const reglas = {
  // Venta vs mismo día de la semana anterior (en %)
  ventas: { amarilloDesde: -5, rojoDesde: -10 },
  // Stock de materia prima (días de cobertura)
  stock: { verdeMasDe: 4, rojoMenosDe: 2 },
  // Pagos: días que faltan para el vencimiento
  pagos: { rojoHastaDias: 1, amarilloHastaDias: 7 },
  // Cobros: días que faltan (negativo = vencido)
  cobros: { amarilloHastaDias: 7 },
  // Todavía sin definir (no inventar)
  liquidezDias: null as null | { verdeMasDe: number; rojoMenosDe: number },
  rentabilidadPct: null as null | { verdeDesde: number; rojoDebajoDe: number },
  // Dirección estratégica: días sin actualizar para ponerse en rojo
  direccionDiasSinActualizar: 7,
};

export function semaforoVentas(variacionPct: number): Semaforo {
  if (variacionPct < reglas.ventas.rojoDesde) return "rojo";
  if (variacionPct < reglas.ventas.amarilloDesde) return "amarillo";
  return "verde";
}

export function semaforoStock(diasCobertura: number): Semaforo {
  if (diasCobertura < reglas.stock.rojoMenosDe) return "rojo";
  if (diasCobertura <= reglas.stock.verdeMasDe) return "amarillo";
  return "verde";
}

export function semaforoPago(diasRestantes: number): Semaforo {
  if (diasRestantes <= reglas.pagos.rojoHastaDias) return "rojo";
  if (diasRestantes <= reglas.pagos.amarilloHastaDias) return "amarillo";
  return "verde";
}

export function semaforoCobro(diasRestantes: number): Semaforo {
  if (diasRestantes < 0) return "rojo";
  if (diasRestantes <= reglas.cobros.amarilloHastaDias) return "amarillo";
  return "verde";
}

export const textoPago: Record<Semaforo, string> = { rojo: "Urgente", amarillo: "Próximo", verde: "Programado", gris: "Sin definir" };
export const textoCobro: Record<Semaforo, string> = { rojo: "Vencido", amarillo: "Próximo", verde: "Futuro", gris: "Sin definir" };
