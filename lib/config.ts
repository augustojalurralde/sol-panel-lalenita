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

// ─── PEDIDOS DE LA TIENDA ONLINE (Tiendanube) ─────────────────────────────────
// Para cuándo tiene que estar listo un pedido y qué sector produce cada producto.
export const reglasPedidosWeb = {
  // Pedido que entra antes de esta hora → listo el siguiente día hábil; después → a los 2 días hábiles
  horaCorte: 12,
  // Hora a la que el pedido está listo para retirar
  horaListo: 15,
  // Días que NO se entrega (0 = domingo, 6 = sábado)
  diasSinEntrega: [0],
  // Sector de la fábrica según palabras del nombre del producto (el primero que coincide)
  sectores: [
    { sector: "Empanadas", palabras: ["empanada", "canastita", "sfija"] },
    { sector: "Pastas", palabras: ["sorrentino"] },
    { sector: "Tartas", palabras: ["tarta"] },
    { sector: "Pizzas", palabras: ["pizza"] },
    { sector: "Wraps", palabras: ["burrito", "wrap"] },
    { sector: "Milanesas", palabras: ["milanesa", "suprema", "hamburguesa"] },
  ],
};

// ─── PEDIDOSYA ───────────────────────────────────────────────────────────────
// Reglas para la sección PedidosYa: qué se marca para reclamar y cómo se cuadra con Maxirest.
export const reglasPedidosYa = {
  // Tope de publicidad acordado con PedidosYa (% de la venta). La base (bruta o neta) está SIN DEFINIR:
  // falta el acuerdo firmado. Mientras tanto se muestra sobre la venta neta de la liquidación.
  publicidadTopePct: 4,
  publicidadBase: null as null | "bruta" | "neta",
  // Reclamo de cliente que devolvió este % del pedido o más → revisar si correspondía devolver todo
  reclamoAltoPct: 90,
  // Diferencia PedidosYa vs Maxirest (por local y semana) a partir de la cual se marca en rojo / amarillo (%)
  cuadre: { amarilloDesde: 1, rojoDesde: 3 },
  // Cuenta del contrato (últimos 4 números). Si una liquidación dice otra cuenta, se avisa.
  cuentaContrato: "4181",
  // Motivos de rechazo que hay que revisar (puede que el local estuviera abierto)
  rechazosARevisar: ["restaurante cerrado", "no atiende"],
  // Cómo se llama el cobro de PedidosYa en Maxirest (se compara sin mayúsculas; alcanza con que contenga el texto)
  formasMaxirest: ["peya", "pedidos ya", "pedidosya"],
  // Horas no disponible por semana a partir de las cuales el local se marca en rojo
  horasNoDisponibleRojo: 4,
};
