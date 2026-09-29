// components/Iconos.tsx — Íconos simples dibujados en SVG (sin librerías extra)
import type { ReactNode } from "react";

function Base({ children, className = "h-5 w-5" }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

type P = { className?: string };

export const IconoInicio = (p: P) => (<Base {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M10 21v-6h4v6" /></Base>);
export const IconoLocales = (p: P) => (<Base {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></Base>);
export const IconoFabrica = (p: P) => (<Base {...p}><path d="M3 21V10l6 4V10l6 4V5h6v16H3Z" /><path d="M7 17h2M12 17h2M17 17h1" /></Base>);
export const IconoTesoreria = (p: P) => (<Base {...p}><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M15 8.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .9-3 2.2 0 3 6 1.6 6 4.6 0 1.3-1.3 2.2-3 2.2-1.4 0-2.6-.6-3.1-1.6M12 5.5v13" /></Base>);
export const IconoResultados = (p: P) => (<Base {...p}><rect x="3" y="3" width="18" height="18" rx="3" /><path d="m7 15 3.5-3.5 3 3L18 9" /></Base>);
export const IconoObjetivos = (p: P) => (<Base {...p}><rect x="4" y="3" width="16" height="18" rx="2.5" /><path d="m8.5 12 2.5 2.5 4.5-5" /></Base>);
export const IconoCalendario = (p: P) => (<Base {...p}><rect x="3" y="4.5" width="18" height="16.5" rx="2.5" /><path d="M3 9.5h18M8 3v3M16 3v3" /></Base>);
export const IconoAlerta = (p: P) => (<Base {...p}><path d="M10.3 3.9 1.8 18.5A2 2 0 0 0 3.5 21.5h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4.5M12 17.5h.01" /></Base>);
export const IconoPersona = (p: P) => (<Base {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" /></Base>);
export const IconoCheck = (p: P) => (<Base {...p}><circle cx="12" cy="12" r="9" /><path d="m8 12 2.8 2.8L16.5 9" /></Base>);
export const IconoActualizar = (p: P) => (<Base {...p}><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></Base>);
export const IconoFlechaDerecha = (p: P) => (<Base {...p}><path d="m9 6 6 6-6 6" /></Base>);
export const IconoBaja = (p: P) => (<Base {...p}><path d="M12 4v16M6 14l6 6 6-6" /></Base>);
export const IconoEstable = (p: P) => (<Base {...p}><path d="M4 12h16M14 6l6 6-6 6" /></Base>);
export const IconoSube = (p: P) => (<Base {...p}><path d="M6 18 18 6M9 6h9v9" /></Base>);

// Logo: una llama simple (dibujo propio)
export function Logo({ className = "h-9 w-9" }: P) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path d="M16 2c1 5 7 8 7 16a7 7 0 0 1-14 0c0-4 2-6 3-8 .5 3 2 4 3 4-1-4 0-9 1-12Z" fill="#f97316" />
      <path d="M16 15c.6 2.5 3.5 4 3.5 7.5a3.5 3.5 0 0 1-7 0c0-2 1-3 1.6-4 .3 1.2 1 1.8 1.4 1.8-.3-2 0-3.8.5-5.3Z" fill="#facc15" />
    </svg>
  );
}
