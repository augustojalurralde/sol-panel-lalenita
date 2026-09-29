"use client";
// components/Sidebar.tsx — Menú lateral (en celular se muestra arriba)

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Logo, IconoInicio, IconoLocales, IconoFabrica,
  IconoTesoreria, IconoResultados, IconoObjetivos,
} from "./Iconos";

const secciones = [
  { href: "/", texto: "Inicio", Icono: IconoInicio },
  { href: "/locales", texto: "Comparativo de Locales", Icono: IconoLocales },
  { href: "/fabrica", texto: "Estado de la Fábrica", Icono: IconoFabrica },
  { href: "/tesoreria", texto: "Tesorería", Icono: IconoTesoreria },
  { href: "/resultados", texto: "Estado de Resultados", Icono: IconoResultados },
  { href: "/objetivos", texto: "Objetivos y Dirección", Icono: IconoObjetivos },
];

function Marca() {
  return (
    <div className="flex items-center gap-2.5">
      <Logo />
      <div className="leading-tight">
        <p className="text-lg font-bold tracking-wide text-white">LA LEÑITA</p>
        <p className="text-[10px] tracking-widest text-slate-400">SISTEMA OPERATIVO</p>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const ruta = usePathname();
  const activa = (href: string) => (href === "/" ? ruta === "/" : ruta.startsWith(href));

  return (
    <>
      {/* Computadora: barra lateral fija */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-[#0f1b2d] px-4 py-6 sticky top-0 h-screen">
        <div className="px-2 mb-10"><Marca /></div>
        <nav className="flex flex-col gap-1.5">
          {secciones.map(({ href, texto, Icono }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                activa(href) ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icono />
              {texto}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Celular: barra arriba con menú deslizable */}
      <header className="lg:hidden bg-[#0f1b2d] px-4 pt-4 pb-3 sticky top-0 z-20">
        <Marca />
        <nav className="mt-3 -mx-4 px-4 flex gap-2 overflow-x-auto">
          {secciones.map(({ href, texto, Icono }) => (
            <Link
              key={href}
              href={href}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs ${
                activa(href) ? "bg-blue-600 text-white" : "bg-white/5 text-slate-300"
              }`}
            >
              <Icono className="h-4 w-4" />
              {texto}
            </Link>
          ))}
        </nav>
      </header>
    </>
  );
}
