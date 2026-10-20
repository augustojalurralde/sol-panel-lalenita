// lib/config.ts — REGLAS DE LOS SEMÁFOROS (todas en un solo lugar)
// Para cambiar un umbral, se cambia solo acá. Lo que dice null está "Sin definir".
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
    liquidezDias: null,
    rentabilidadPct: null,
    // Dirección estratégica: días sin actualizar para ponerse en rojo
    direccionDiasSinActualizar: 7,
};
export function semaforoVentas(variacionPct) {
    if (variacionPct < reglas.ventas.rojoDesde)
        return "rojo";
    if (variacionPct < reglas.ventas.amarilloDesde)
        return "amarillo";
    return "verde";
}
export function semaforoStock(diasCobertura) {
    if (diasCobertura < reglas.stock.rojoMenosDe)
        return "rojo";
    if (diasCobertura <= reglas.stock.verdeMasDe)
        return "amarillo";
    return "verde";
}
export function semaforoPago(diasRestantes) {
    if (diasRestantes <= reglas.pagos.rojoHastaDias)
        return "rojo";
    if (diasRestantes <= reglas.pagos.amarilloHastaDias)
        return "amarillo";
    return "verde";
}
export function semaforoCobro(diasRestantes) {
    if (diasRestantes < 0)
        return "rojo";
    if (diasRestantes <= reglas.cobros.amarilloHastaDias)
        return "amarillo";
    return "verde";
}
export const textoPago = { rojo: "Urgente", amarillo: "Próximo", verde: "Programado", gris: "Sin definir" };
export const textoCobro = { rojo: "Vencido", amarillo: "Próximo", verde: "Futuro", gris: "Sin definir" };
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
