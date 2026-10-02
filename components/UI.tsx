// components/UI.tsx — Piezas visuales que se repiten en todas las pantallas
import type { ReactNode } from "react";
import { fechaDeHoy } from "@/lib/formato";
import { IconoCalendario } from "./Iconos";
import type { Semaforo } from "@/lib/config";

export function Encabezado({ titulo, pregunta, extra, fecha }: { titulo: string; pregunta: string; extra?: ReactNode; fecha?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{titulo}</h1>
        <p className="mt-0.5 text-sm text-slate-500">{pregunta}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {extra}
        {fecha ?? (
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700">
            {fechaDeHoy()}
            <IconoCalendario className="h-4 w-4 text-slate-500" />
          </div>
        )}
      </div>
    </div>
  );
}

export function Tarjeta({ titulo, children, className = "", derecha }: { titulo?: string; children: ReactNode; className?: string; derecha?: ReactNode }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-5 ${className}`}>
      {(titulo || derecha) && (
        <div className="mb-3 flex items-baseline justify-between gap-3">
          {titulo && <h2 className="text-sm font-semibold text-slate-900">{titulo}</h2>}
          {derecha}
        </div>
      )}
      {children}
    </section>
  );
}

const fondo: Record<Semaforo, string> = {
  verde: "bg-green-600",
  amarillo: "bg-yellow-400",
  rojo: "bg-red-600",
  gris: "bg-slate-300",
};

const texto: Record<Semaforo, string> = {
  verde: "text-green-700",
  amarillo: "text-yellow-700",
  rojo: "text-red-600",
  gris: "text-slate-500",
};

const pastilla: Record<Semaforo, string> = {
  verde: "bg-green-50 text-green-700",
  amarillo: "bg-yellow-50 text-yellow-800",
  rojo: "bg-red-50 text-red-700",
  gris: "bg-slate-100 text-slate-600",
};

export const colorTexto = (s: Semaforo) => texto[s];
export const colorFondo = (s: Semaforo) => fondo[s];

export function Punto({ color, className = "h-3.5 w-3.5" }: { color: Semaforo; className?: string }) {
  return <span className={`inline-block shrink-0 rounded-full ${fondo[color]} ${className}`} />;
}

export function Pastilla({ color, children }: { color: Semaforo; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${pastilla[color]}`}>{children}</span>;
}

export function SinDefinir({ texto = "Sin definir" }: { texto?: string }) {
  return <span className="text-xs italic text-slate-400">{texto}</span>;
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

/** Etiqueta chiquita que dice de dónde sale el dato */
export function Fuente({ real, texto }: { real: boolean; texto?: string }) {
  return real ? (
    <span className="whitespace-nowrap rounded bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700">{texto ?? "Real · Maxirest"}</span>
  ) : (
    <span className="whitespace-nowrap rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">Prueba</span>
  );
}
