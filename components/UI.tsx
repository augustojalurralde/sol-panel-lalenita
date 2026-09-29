// components/UI.tsx — Piezas visuales que se repiten en todas las pantallas
import type { ReactNode } from "react";
import { fechaDeHoy } from "@/lib/formato";
import { IconoCalendario } from "./Iconos";
import type { Semaforo } from "@/lib/mockData";

export function Encabezado({ titulo, pregunta, extra }: { titulo: string; pregunta: string; extra?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{titulo}</h1>
        <p className="mt-0.5 text-sm text-slate-500">{pregunta}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {extra}
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700">
          {fechaDeHoy()}
          <IconoCalendario className="h-4 w-4 text-slate-500" />
        </div>
      </div>
    </div>
  );
}

export function Tarjeta({ titulo, children, className = "" }: { titulo?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-5 ${className}`}>
      {titulo && <h2 className="mb-3 text-sm font-semibold text-slate-900">{titulo}</h2>}
      {children}
    </section>
  );
}

const coloresSemaforo: Record<Semaforo, string> = {
  rojo: "bg-red-600",
  naranja: "bg-orange-500",
  amarillo: "bg-yellow-400",
  verde: "bg-green-600",
};

export function Punto({ color, className = "h-3.5 w-3.5" }: { color: Semaforo; className?: string }) {
  return <span className={`inline-block rounded-full ${coloresSemaforo[color]} ${className}`} />;
}

export function AvisoDatosPrueba() {
  return (
    <p className="mt-8 text-xs text-slate-400">
      Datos de prueba — todavía no son los datos reales de la empresa.
    </p>
  );
}

export function Proximamente({ titulo, pregunta }: { titulo: string; pregunta: string }) {
  return (
    <>
      <Encabezado titulo={titulo} pregunta={pregunta} />
      <Tarjeta>
        <p className="py-10 text-center text-slate-500">Esta sección se está construyendo. Próximamente.</p>
      </Tarjeta>
    </>
  );
}
