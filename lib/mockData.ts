// lib/mockData.ts
// Datos de PRUEBA (inventados). Más adelante vendrán de Supabase.
// Los nombres de unidades y responsables son los reales (ver docs/SOL-especificacion.md).

import type { Semaforo } from "./config";

/* ───────────── Unidades y ventas ───────────── */

export interface VentasUnidad {
  id: number;
  nombre: string;
  ventaHoy: number;          // en curso (tiempo real)
  ventaAyer: number;         // día cerrado
  ventaMismoDiaSemAnt: number;
  ventaMes: number;          // acumulado del mes
  comprobantesAyer: number;  // para ticket promedio
}

const unidades: VentasUnidad[] = [
  { id: 1, nombre: "Barrio Norte", ventaHoy: 8500, ventaAyer: 9100, ventaMismoDiaSemAnt: 8700, ventaMes: 245000, comprobantesAyer: 70 },
  { id: 2, nombre: "Barrio Sur", ventaHoy: 7200, ventaAyer: 6400, ventaMismoDiaSemAnt: 7800, ventaMes: 198000, comprobantesAyer: 58 },
  { id: 3, nombre: "Yerba Buena", ventaHoy: 6800, ventaAyer: 6900, ventaMismoDiaSemAnt: 7400, ventaMes: 187000, comprobantesAyer: 55 },
  { id: 4, nombre: "Recoleta", ventaHoy: 9500, ventaAyer: 10200, ventaMismoDiaSemAnt: 9100, ventaMes: 276000, comprobantesAyer: 78 },
  { id: 5, nombre: "Palermo / La Rural", ventaHoy: 7000, ventaAyer: 7300, ventaMismoDiaSemAnt: 7200, ventaMes: 201000, comprobantesAyer: 60 },
  { id: 6, nombre: "Feria Buenos Aires", ventaHoy: 6000, ventaAyer: 5200, ventaMismoDiaSemAnt: 5500, ventaMes: 142000, comprobantesAyer: 49 },
  { id: 7, nombre: "Fábrica Central", ventaHoy: 12000, ventaAyer: 14500, ventaMismoDiaSemAnt: 14100, ventaMes: 390000, comprobantesAyer: 21 },
];

const suma = (f: (u: VentasUnidad) => number) => unidades.reduce((s, u) => s + f(u), 0);

export const mockVentas = {
  unidades,
  totalHoy: suma((u) => u.ventaHoy),
  totalAyer: suma((u) => u.ventaAyer),
  totalMismoDiaSemAnt: suma((u) => u.ventaMismoDiaSemAnt),
  totalMes: suma((u) => u.ventaMes),
  comprobantesAyer: suma((u) => u.comprobantesAyer),
};

/* ───────────── Estado de actualización de datos ───────────── */

export type EstadoDato = "OK" | "Pendiente" | "Atrasado";

export const mockEstadoDatos: { fuente: string; ultimoDato: string; estado: EstadoDato; responsable: string; escalamiento: string }[] = [
  { fuente: "Ventas", ultimoDato: "Hoy 08:10", estado: "OK", responsable: "Romina", escalamiento: "Augusto" },
  { fuente: "Producción", ultimoDato: "Hoy 07:40", estado: "OK", responsable: "Iván", escalamiento: "Pablo" },
  { fuente: "Stock materia prima", ultimoDato: "Ayer 18:00", estado: "Pendiente", responsable: "Iván", escalamiento: "Pablo" },
  { fuente: "Tesorería", ultimoDato: "Hace 2 días", estado: "Atrasado", responsable: "Flor", escalamiento: "Augusto" },
  { fuente: "Check-in", ultimoDato: "Hoy 07:15", estado: "OK", responsable: "Iván", escalamiento: "Pablo" },
];

/* ───────────── Comparativo de Locales ───────────── */

export type Tendencia = "empeorando" | "estable" | "mejorando";

export interface DetalleLocal {
  nombre: string;          // debe coincidir con mockVentas
  prioridad: number;       // por ahora se ordena a mano (el motor de prioridad viene después)
  area: string;
  tendencia: Tendencia;
  responsable: string;
  novedad: { texto: string; fecha: string; cargadoPor: string } | null;
  recomendacion: string;
}

export const mockDetalleLocales: DetalleLocal[] = [
  { nombre: "Barrio Sur", prioridad: 1, area: "Ventas", tendencia: "empeorando", responsable: "Romina", novedad: { texto: "Faltó un empleado en el turno noche", fecha: "Ayer", cargadoPor: "Romina" }, recomendacion: "Revisar ticket promedio" },
  { nombre: "Yerba Buena", prioridad: 3, area: "Ventas", tendencia: "estable", responsable: "Romina", novedad: { texto: "Lluvia fuerte toda la tarde", fecha: "Ayer", cargadoPor: "Romina" }, recomendacion: "Revisar canal delivery" },
  { nombre: "Palermo / La Rural", prioridad: 5, area: "Ventas", tendencia: "estable", responsable: "Romina", novedad: null, recomendacion: "Sin acción necesaria" },
  { nombre: "Fábrica Central", prioridad: 2, area: "Stock", tendencia: "empeorando", responsable: "Iván", novedad: { texto: "Horno 2 con rendimiento bajo", fecha: "Hoy", cargadoPor: "Iván" }, recomendacion: "Comprar Queso Muzza, cobertura crítica" },
  { nombre: "Barrio Norte", prioridad: 6, area: "Ventas", tendencia: "mejorando", responsable: "Romina", novedad: null, recomendacion: "Sin acción necesaria" },
  { nombre: "Recoleta", prioridad: 7, area: "Ventas", tendencia: "mejorando", responsable: "Romina", novedad: { texto: "Buen rendimiento en delivery", fecha: "Ayer", cargadoPor: "Romina" }, recomendacion: "Sin acción necesaria" },
  { nombre: "Feria Buenos Aires", prioridad: 4, area: "Ventas", tendencia: "estable", responsable: "Romina", novedad: null, recomendacion: "Revisar ticket promedio" },
];

/* ───────────── Estado de la Fábrica ───────────── */

export interface InsumoCritico {
  insumo: string;
  stockActual: number;
  unidad: string;
  consumoDiario: number;
  compraRealizada: boolean;
  fechaIngreso: string | null;
  responsable: string;
}

export const mockFabrica = {
  unidad: "Fábrica Central",
  estadoGeneral: {
    nivel: "amarillo" as Semaforo,
    titulo: "Atención: cumplimiento del plan por debajo del 80% y queso muzza con cobertura crítica.",
    detalle: "Revisar avance de producción del día y compra de queso.",
  },
  produccion: {
    planificadaKg: 14000,
    realizadaKg: 10920,
    pendienteFabricar: 28,
    listoDespachar: 18,
    despachado: 32,
    responsablePlan: "Pablo",
    responsableRegistro: "Iván",
  },
  insumos: [
    { insumo: "Queso Muzza", stockActual: 180, unidad: "kg", consumoDiario: 150, compraRealizada: false, fechaIngreso: null, responsable: "Flor" },
    { insumo: "Harina 000", stockActual: 900, unidad: "kg", consumoDiario: 500, compraRealizada: true, fechaIngreso: "Mañana", responsable: "Flor" },
    { insumo: "Levadura", stockActual: 25, unidad: "kg", consumoDiario: 8, compraRealizada: false, fechaIngreso: null, responsable: "Flor" },
    { insumo: "Nalga", stockActual: 95, unidad: "kg", consumoDiario: 30, compraRealizada: false, fechaIngreso: null, responsable: "Flor" },
    { insumo: "Aceite Girasol", stockActual: 200, unidad: "l", consumoDiario: 40, compraRealizada: false, fechaIngreso: null, responsable: "Flor" },
  ] as InsumoCritico[],
  personal: [
    { sector: "Producción", esperada: 18, real: 16 },
    { sector: "Mantenimiento", esperada: 2, real: 2 },
    { sector: "Calidad", esperada: 1, real: 1 },
    { sector: "Logística", esperada: 4, real: 3 },
  ],
  ausentes: [
    { nombre: "Operario Línea 2", puesto: "Producción", clave: true },
    { nombre: "Ayudante de horno", puesto: "Producción", clave: false },
    { nombre: "Chofer", puesto: "Logística", clave: false },
  ],
  checkIn: {
    realizado: true,
    por: "Iván",
    hora: "07:15",
    items: [
      { tema: "Personal", ok: false, nota: "Faltan 3 personas (1 clave)" },
      { tema: "Maquinaria", ok: false, nota: "Horno 2 con rendimiento bajo" },
      { tema: "Materia prima", ok: false, nota: "Queso muzza crítico" },
      { tema: "Producción", ok: true, nota: "Plan cargado por Pablo" },
      { tema: "Problemas relevantes", ok: true, nota: "Sin otros problemas" },
    ],
  },
  compras: { pendientes: 12, monto: 8450000, criticasAsociadas: ["Harina 000"], responsable: "Flor" },
  actualizado: "08:30",
};

/* ───────────── Tesorería ───────────── */

export const mockTesoreria = {
  cuentas: [
    { cuenta: "Caja Administración", monto: 1850000 },
    { cuenta: "Caja Fábrica", monto: 420000 },
    { cuenta: "BBVA", monto: 6300000 },
    { cuenta: "Macro", monto: 3900000 },
    { cuenta: "Mercado Pago", monto: 2750000 },
  ],
  // venceEnDias: 0 = hoy, 1 = mañana, negativo = ya venció
  pagos: [
    { proveedor: "Lácteos del Norte", concepto: "Queso muzza", monto: 2400000, venceEnDias: 0, responsable: "Flor" },
    { proveedor: "AFIP", concepto: "Cargas sociales", monto: 3100000, venceEnDias: 1, responsable: "Flor" },
    { proveedor: "Molinos Harineros", concepto: "Harina 000", monto: 1800000, venceEnDias: 4, responsable: "Flor" },
    { proveedor: "Edenor", concepto: "Energía Fábrica", monto: 950000, venceEnDias: 6, responsable: "Flor" },
    { proveedor: "Alquiler Recoleta", concepto: "Alquiler", monto: 2200000, venceEnDias: 12, responsable: "Flor" },
    { proveedor: "Frigorífico Sur", concepto: "Carnes", monto: 1650000, venceEnDias: 15, responsable: "Flor" },
  ],
  cobros: [
    { cliente: "Distribuidora Andina", monto: 1300000, venceEnDias: -3, responsable: "Flor" },
    { cliente: "Supermercado El Sol", monto: 2100000, venceEnDias: 2, responsable: "Flor" },
    { cliente: "Catering Norte", monto: 750000, venceEnDias: 5, responsable: "Flor" },
    { cliente: "Club Social Tucumán", monto: 980000, venceEnDias: 14, responsable: "Flor" },
  ],
  gastoNetoDiarioPromedio: 780000, // (pagos − cobros) de los últimos 14 días ÷ 14
  cuentasCorrientes: { nosDeben: 5130000, debemos: 12100000 },
  actualizado: "Hace 2 días",
};
