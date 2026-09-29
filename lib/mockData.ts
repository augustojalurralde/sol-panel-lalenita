// lib/mockData.ts
// Datos de PRUEBA (inventados). Más adelante se reemplazan por los datos reales.

/* ───────────── Ventas del día (pantalla Inicio) ───────────── */

export interface VentasLocal {
  id: number;
  nombre: string;
  ventaHoy: number;
  ventaAyer: number;
}

export interface DatosVentas {
  totalHoy: number;
  totalAyer: number;
  locales: VentasLocal[];
}

const locales: VentasLocal[] = [
  { id: 1, nombre: "Barrio Norte", ventaHoy: 8500, ventaAyer: 7200 },
  { id: 2, nombre: "Barrio Sur", ventaHoy: 7200, ventaAyer: 6800 },
  { id: 3, nombre: "Yerba Buena", ventaHoy: 6800, ventaAyer: 6500 },
  { id: 4, nombre: "Recoleta", ventaHoy: 9500, ventaAyer: 8200 },
  { id: 5, nombre: "Palermo", ventaHoy: 7000, ventaAyer: 6500 },
  { id: 6, nombre: "Feria", ventaHoy: 6000, ventaAyer: 4800 },
];

// Los totales se calculan solos sumando los locales.
export const mockDatosVentas: DatosVentas = {
  totalHoy: locales.reduce((suma, l) => suma + l.ventaHoy, 0),
  totalAyer: locales.reduce((suma, l) => suma + l.ventaAyer, 0),
  locales,
};

/* ───────────── Comparativo de Locales ───────────── */

export type Semaforo = "rojo" | "naranja" | "amarillo" | "verde";
export type EstadoStock = "Crítico" | "Bajo" | "Alerta" | "OK";
export type Tendencia = "empeorando" | "estable" | "mejorando";

export interface FilaComparativo {
  prioridad: number;
  local: string;
  area: string;
  semaforo: Semaforo;
  ventaVsSemAnt: number; // % contra el mismo día de la semana anterior
  ticketVsSemAnt: number;
  cantidadTicketsVsSemAnt: number;
  stock: EstadoStock;
  responsable: string;
  novedad: string;
  tendencia: Tendencia;
  recomendacion: string;
}

export const mockComparativo: FilaComparativo[] = [
  { prioridad: 1, local: "Barrio Sur", area: "Ventas", semaforo: "rojo", ventaVsSemAnt: -18, ticketVsSemAnt: -12, cantidadTicketsVsSemAnt: -7, stock: "Crítico", responsable: "Florencia", novedad: "Faltó un empleado en el turno noche", tendencia: "empeorando", recomendacion: "Revisar ticket promedio y personal" },
  { prioridad: 2, local: "Palermo", area: "Ventas", semaforo: "naranja", ventaVsSemAnt: -10, ticketVsSemAnt: -10, cantidadTicketsVsSemAnt: -1, stock: "Bajo", responsable: "Florencia", novedad: "Problema con PedidosYa", tendencia: "empeorando", recomendacion: "Revisar canal PedidosYa y promociones" },
  { prioridad: 3, local: "Yerba Buena", area: "Ventas", semaforo: "naranja", ventaVsSemAnt: -6, ticketVsSemAnt: -2, cantidadTicketsVsSemAnt: -4, stock: "Alerta", responsable: "Florencia", novedad: "Lluvia fuerte toda la tarde", tendencia: "estable", recomendacion: "Monitorear clima y tráfico" },
  { prioridad: 4, local: "Feria", area: "Ventas", semaforo: "amarillo", ventaVsSemAnt: 2, ticketVsSemAnt: 1, cantidadTicketsVsSemAnt: 1, stock: "Alerta", responsable: "Pablo", novedad: "Horno 2 con rendimiento bajo", tendencia: "empeorando", recomendacion: "Revisar producción y mantenimiento" },
  { prioridad: 5, local: "Barrio Norte", area: "Ventas", semaforo: "verde", ventaVsSemAnt: 5, ticketVsSemAnt: 5, cantidadTicketsVsSemAnt: 0, stock: "OK", responsable: "Florencia", novedad: "Sin novedades", tendencia: "mejorando", recomendacion: "Mantener estrategia comercial" },
  { prioridad: 6, local: "Recoleta", area: "Ventas", semaforo: "verde", ventaVsSemAnt: 12, ticketVsSemAnt: 6, cantidadTicketsVsSemAnt: 6, stock: "OK", responsable: "Florencia", novedad: "Buen rendimiento en delivery", tendencia: "mejorando", recomendacion: "Potenciar canal delivery" },
];

/* ───────────── Estado de la Fábrica ───────────── */

export interface InsumoCritico {
  insumo: string;
  diasCobertura: number;
  compraRealizada: boolean;
  responsable: string;
}

export interface SectorPersonal {
  sector: string;
  esperada: number;
  real: number;
}

export const mockFabrica = {
  unidad: "Fábrica Central",
  estadoGeneral: {
    nivel: "atencion" as "ok" | "atencion" | "critico",
    titulo: "Atención: riesgo de atraso en despachos por demora en producción y stock crítico de materia prima.",
    detalle: "Revisar cumplimiento del plan y materias primas críticas.",
  },
  produccionAyerKg: 12450,
  produccionAyerVsSemAnt: -5,
  planHoyKg: 14000,
  realizadoHoyKg: 10920,
  pedidosPendientes: 28,
  pedidosListos: 18,
  pedidosDespachados: 32,
  insumos: [
    { insumo: "Queso Muzza", diasCobertura: 1.2, compraRealizada: true, responsable: "Romina" },
    { insumo: "Harina 000", diasCobertura: 1.8, compraRealizada: false, responsable: "Romina" },
    { insumo: "Sal", diasCobertura: 2.1, compraRealizada: true, responsable: "Romina" },
    { insumo: "Levadura", diasCobertura: 2.5, compraRealizada: false, responsable: "Romina" },
    { insumo: "Aceite Girasol", diasCobertura: 4.0, compraRealizada: true, responsable: "Romina" },
  ] as InsumoCritico[],
  personal: [
    { sector: "Producción", esperada: 48, real: 41 },
    { sector: "Mantenimiento", esperada: 6, real: 5 },
    { sector: "Calidad", esperada: 3, real: 3 },
    { sector: "Logística", esperada: 12, real: 10 },
  ] as SectorPersonal[],
  ausenciasClave: ["Jefe de Producción", "Encargado de Cocina", "Operario Línea 2"],
  checkIn: { realizado: true, por: "Pablo", hora: "07:15", novedades: 2 },
  compras: { ordenes: 12, montoPendiente: 8450000 },
  alertas: [
    "Queso Muzza en nivel crítico (1,2 días de cobertura)",
    "Cumplimiento del plan de producción por debajo del 80%",
    "Faltan 3 personas clave en producción",
  ],
  actualizado: "08:30",
};
