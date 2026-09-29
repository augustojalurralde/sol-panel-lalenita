// lib/mockData.ts
// Ventas de PRUEBA (números inventados). Más adelante se reemplazan por los datos reales.

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
