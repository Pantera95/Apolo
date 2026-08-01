"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { usePreferencias } from "@/lib/preferencias";
import type { ClaveTexto } from "@/lib/i18n/textos";
import { Icono, MarcaApolo, type NombreIcono } from "@/components/ui/icono";
import { ControlesDemo } from "./controles-demo";

interface Enlace {
  href: string;
  icono: NombreIcono;
  clave: ClaveTexto;
}

interface Seccion {
  clave: ClaveTexto;
  enlaces: Enlace[];
}

/**
 * La navegación sigue el orden en que esta empresa piensa, no el de un sistema
 * de ecommerce: primero la obra (que es el centro del dominio), después el
 * almacén que la surte, y al final los datos.
 */
const SECCIONES: Seccion[] = [
  {
    clave: "nav.seccionOperacion",
    enlaces: [
      { href: "/", icono: "panel", clave: "nav.panel" },
      { href: "/obras", icono: "obras", clave: "nav.obras" },
      { href: "/solicitudes", icono: "solicitudes", clave: "nav.solicitudes" },
      { href: "/despacho", icono: "despacho", clave: "nav.despacho" },
    ],
  },
  {
    clave: "nav.seccionAlmacen",
    enlaces: [
      { href: "/inventario", icono: "inventario", clave: "nav.inventario" },
      { href: "/herramientas", icono: "herramientas", clave: "nav.herramientas" },
      { href: "/compras", icono: "compras", clave: "nav.compras" },
    ],
  },
  {
    clave: "nav.seccionDatos",
    enlaces: [
      { href: "/importacion", icono: "importacion", clave: "nav.importacion" },
      { href: "/reportes", icono: "reportes", clave: "nav.reportes" },
    ],
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { t, tema, idioma, alternarTema, alternarIdioma } = usePreferencias();
  const ruta = usePathname();
  const [menuAbierto, setMenuAbierto] = useState(false);

  /**
   * El panel de navegación es oscuro en los dos temas y "flota" separado del
   * borde. Es el rasgo que le da silueta propia al producto: el chasis no
   * cambia de color, solo el lienzo de trabajo.
   */
  const panelNavegacion = (
    <div className="flex h-full flex-col overflow-hidden rounded-tarjeta bg-nav-fondo">
      <div className="flex items-center gap-3 px-5 pb-4 pt-6">
        <MarcaApolo tam={32} />
        <div className="min-w-0">
          <p className="text-lg font-extrabold leading-none tracking-tight text-white">
            {t("app.nombre")}
          </p>
          <p className="mt-1.5 text-[10px] font-bold uppercase leading-tight tracking-[0.1em] text-nav-texto">
            {t("app.lema")}
          </p>
        </div>
      </div>

      <nav
        className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 pb-5"
        aria-label={t("app.nombre")}
      >
        {SECCIONES.map((seccion) => (
          <div key={seccion.clave}>
            <p className="px-3 pb-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-nav-texto/60">
              {t(seccion.clave)}
            </p>
            <ul className="flex flex-col gap-1">
              {seccion.enlaces.map((enlace) => {
                const activo =
                  enlace.href === "/" ? ruta === "/" : ruta.startsWith(enlace.href);
                return (
                  <li key={enlace.href}>
                    <Link
                      href={enlace.href}
                      aria-current={activo ? "page" : undefined}
                      // El cajón se cierra aquí, en el evento, y no reaccionando
                      // al cambio de ruta: si no, tapa la pantalla a la que
                      // acabas de llegar.
                      onClick={() => setMenuAbierto(false)}
                      className={[
                        "flex min-h-11 items-center gap-3 rounded-pildora px-3.5 text-sm font-bold transition-colors",
                        activo
                          ? "bg-nav-activo text-nav-texto-activo"
                          : "text-nav-texto hover:bg-white/5 hover:text-white",
                      ].join(" ")}
                    >
                      <Icono nombre={enlace.icono} tam={18} />
                      {t(enlace.clave)}
                      {/* El estado activo no se comunica solo con color. */}
                      {activo && (
                        <span
                          aria-hidden="true"
                          className="ml-auto h-2 w-2 rounded-full bg-nav-acento"
                        />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );

  return (
    <div className="min-h-dvh bg-fondo">
      <aside className="fixed inset-y-3 left-3 z-30 hidden w-60 lg:block">
        {panelNavegacion}
      </aside>

      {menuAbierto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label={t("acc.cerrarMenu")}
            onClick={() => setMenuAbierto(false)}
            className="absolute inset-0 bg-black/60"
          />
          <div className="absolute inset-y-3 left-3 w-64 max-w-[80vw]">
            {panelNavegacion}
          </div>
        </div>
      )}

      <div className="lg:pl-[16.5rem]">
        <header className="sticky top-0 z-20 flex min-h-16 items-center gap-3 bg-fondo/85 px-4 backdrop-blur-md sm:px-6">
          <button
            type="button"
            onClick={() => setMenuAbierto(true)}
            aria-label={t("acc.abrirMenu")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pildora bg-superficie text-texto-2 lg:hidden"
          >
            <Icono nombre="menu" tam={22} />
          </button>

          <div className="shrink-0 lg:hidden">
            <MarcaApolo tam={26} />
          </div>

          {/* Vive en el chasis, no en el panel: durante la presentación hay que
              poder cargar o vaciar los datos desde cualquier pantalla.
              Es lo ÚNICO que cede ancho; los controles fijos de la derecha no. */}
          <div className="ml-auto min-w-0">
            <ControlesDemo />
          </div>

          {/* Agrupados en una píldora, pero cada botón conserva sus 44px reales
              de área táctil: ni el grupo ni el flex pueden comerse el objetivo
              del dedo, de ahí el shrink-0. */}
          <div className="flex shrink-0 items-center overflow-hidden rounded-pildora border-2 border-borde bg-superficie">
            <button
              type="button"
              onClick={alternarIdioma}
              aria-label={t("acc.idioma")}
              className="flex h-11 shrink-0 items-center gap-1.5 px-4 text-xs font-extrabold uppercase text-texto-2 hover:bg-superficie-2 hover:text-texto"
            >
              <Icono nombre="idioma" tam={16} />
              {idioma}
            </button>
            <span aria-hidden="true" className="h-6 w-px shrink-0 bg-borde" />
            <button
              type="button"
              onClick={alternarTema}
              aria-label={tema === "claro" ? t("acc.temaOscuro") : t("acc.temaClaro")}
              className="flex h-11 w-12 shrink-0 items-center justify-center text-texto-2 hover:bg-superficie-2 hover:text-texto"
            >
              <Icono nombre={tema === "claro" ? "luna" : "sol"} tam={17} />
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[80rem] px-4 pb-10 pt-2 sm:px-6 lg:pr-8">
          {children}
        </main>
      </div>
    </div>
  );
}
