"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { usePremium } from "@/lib/dashboard/premium";
import { useState, type ReactNode } from "react";

import { usePreferencias } from "@/lib/preferencias";
import type { ClaveTexto } from "@/lib/i18n/textos";
import { Icono, MarcaApolo, type NombreIcono } from "@/components/ui/icono";
import { ControlesDemo } from "./controles-demo";

interface Enlace {
  href: string;
  icono: NombreIcono;
  clave: ClaveTexto;
  /** Sub-ruta de la entrada anterior: se sangra y baja un peso. */
  sub?: boolean;
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
      { href: "/logistica", icono: "despacho", clave: "nav.logistica" },
    ],
  },
  {
    clave: "nav.seccionAlmacen",
    enlaces: [
      { href: "/inventario", icono: "inventario", clave: "nav.inventario" },
      { href: "/herramientas", icono: "herramientas", clave: "nav.herramientas" },
      { href: "/estimaciones", icono: "estimaciones", clave: "nav.estimaciones" },
      { href: "/compras", icono: "compras", clave: "nav.compras" },
      // Sub-ruta de Compras: Procura lleva cómo se decidió a quién comprarle;
      // Compras lleva las órdenes ya emitidas y su recepción.
      { href: "/compras/procura", icono: "compras", clave: "nav.procura", sub: true },
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

/**
 * Qué entrada del menú se marca como activa.
 *
 * GANA LA COINCIDENCIA MÁS LARGA. Un `startsWith` a secas encendía a la vez
 * `/compras` y `/compras/procura` al entrar en la sub-ruta: dos entradas
 * resaltadas no dicen dónde estás, dicen que el menú está roto.
 */
function esActivo(ruta: string, href: string): boolean {
  if (href === "/") return ruta === "/";
  if (ruta !== href && !ruta.startsWith(href + "/")) return false;

  // Si otra entrada casa con un prefijo más largo, esta no es la activa.
  const candidatos = SECCIONES.flatMap((s) => s.enlaces.map((e) => e.href)).filter(
    (h) => h !== "/" && (ruta === h || ruta.startsWith(h + "/")),
  );
  return href.length === Math.max(...candidatos.map((h) => h.length));
}

export function AppShell({ children }: { children: ReactNode }) {
  const { t, tema, idioma, alternarTema, alternarIdioma } = usePreferencias();
  const ruta = usePathname();
  const premium = usePremium();
  const [menuAbierto, setMenuAbierto] = useState(false);

  /**
   * El panel de navegación es oscuro en los dos temas y "flota" separado del
   * borde. Es el rasgo que le da silueta propia al producto: el chasis no
   * cambia de color, solo el lienzo de trabajo.
   */
  const panelNavegacion = (
    /*
      CUATRO BLOQUES APILADOS, NO UNA COLUMNA ÚNICA.
      Medida en la referencia, la lateral no es un panel continuo: es una pila
      de cajas separadas —marca suelta, tarjeta de saludo, caja de navegación y
      tarjeta de acento al pie—, cada una con su propio radio y su propio
      fondo. La versión anterior era un solo bloque con una regla dentro, que
      es la convención clásica y justo lo que la referencia evita.

      Y va al revés que el contenido: aquí los bloques son MÁS CLAROS que la
      columna (#0f1018 sobre #0a0a18 en la referencia), mientras que en el área
      de trabajo las tarjetas son más oscuras que el lienzo.
    */
    <div className="flex h-full flex-col gap-2.5 overflow-hidden">
      {/* 1 · La marca va suelta sobre el lienzo, sin caja que la encierre. */}
      <div className="flex shrink-0 items-center gap-2.5 px-1.5 pt-1">
        <MarcaApolo tam={34} />
        {/*
          `text-texto`, NO `text-white`. Al sacar la marca de su caja quedó
          apoyada en el lienzo, y el lienzo sí cambia con el tema: en claro,
          blanco sobre blanco la dejaba ilegible. Los bloques de abajo pueden
          seguir en blanco porque llevan su propio fondo oscuro en los dos
          temas; este no.
        */}
        <p className="text-lg leading-none tracking-[-0.02em] text-texto">
          {t("app.nombre")}
        </p>

        {/*
          Salida a la landing.

          VA EN LA FILA DE LA MARCA Y NO EN EL LOGO. Hacer que el logo lleve a la
          web pública es la convención de un sitio, no de una aplicación: aquí
          quien lo pulsa espera el panel, y mandarlo fuera es perder el sitio sin
          haberlo pedido. Un control aparte declara a dónde va.

          Los tonos son los del tema —`borde`, `texto-3`— y no blancos: esta fila
          se apoya en el lienzo, que sí cambia con el tema. Es el mismo fallo que
          dejó el rótulo "Apolo" ilegible en claro cuando iba en `text-white`.

          32px de dibujo con el área táctil extendida a 44 por `before`: agrandar
          la caja rompería la proporción de la fila, y un objetivo de 32 incumple
          el mínimo.
        */}
        {/*
          PÍLDORA, y la flecha APUNTA A LA IZQUIERDA: se sale del producto hacia
          atrás, hacia donde se entró. Una flecha a la derecha diría "avanzar",
          que es lo contrario de lo que hace.

          Es `.pildora--fantasma` de la identidad compartida, la misma que usa la
          landing para "Entrar a la aplicación". El viaje de ida y el de vuelta
          se ven como el mismo control, que es lo que son.

          El icono se refleja con `scale-x-[-1]` en vez de dibujar un segundo
          trazo: es exactamente la misma flecha, y dos archivos para una simetría
          se desincronizan a la primera.
        */}
        <Link
          href="/presentacion"
          aria-label={t("nav.verPresentacion")}
          title={t("nav.verPresentacion")}
          className="pildora pildora--fantasma ml-auto shrink-0 !px-3.5"
        >
          <span aria-hidden="true" className="inline-flex scale-x-[-1]">
            <Icono nombre="flecha" tam={15} />
          </span>
        </Link>
      </div>

      {/* 2 · Tarjeta de saludo: rótulo diminuto en versalitas y debajo una línea
             grande. Es la anatomía exacta de "MONDAY, MARCH 24 / Welcome back,
             George!", con el contenido que Apolo sí tiene. */}
      <div className="caja-interna shrink-0 rounded-panel px-4 py-3.5">
        <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-nav-texto/80">
          {t("app.lema")}
        </p>
        {/* `text-texto`, no `text-white`: esta tarjeta ya no tiene fondo oscuro
            fijo, sigue al tema como el resto del vidrio. */}
        <p className="mt-1.5 text-[15px] leading-snug text-texto">
          {t("app.saludo")}
        </p>
      </div>

      <nav
        className="caja-nav flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto rounded-panel px-3 py-4"
        aria-label={t("app.nombre")}
      >
        {SECCIONES.map((seccion) => (
          <div key={seccion.clave}>
            {/* /70 y no /60: a 60 el rótulo daba 3,83:1 sobre el chasis, por
                debajo del 4,5:1 que exige un texto de 10px. A 70 sube a 4,87:1
                y sigue leyéndose como lo que es, un rótulo secundario. */}
            <p className="px-3 pb-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-nav-texto/80">
              {t(seccion.clave)}
            </p>
            <ul className="flex flex-col gap-1">
              {seccion.enlaces.map((enlace) => {
                const activo = esActivo(ruta, enlace.href);
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
                        // Las sub-rutas se sangran y bajan un peso: se leen
                        // como lo que son, una parte de su padre.
                        enlace.sub ? "ml-4 text-[13px] font-semibold" : "",
                        activo
                          ? "bg-nav-activo text-nav-texto-activo"
                          : "text-nav-texto hover:bg-superficie-hover hover:text-texto",
                      ].join(" ")}
                    >
                      <Icono nombre={enlace.icono} tam={enlace.sub ? 15 : 18} />
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

      {/*
        4 · La tarjeta azul del pie.

        NO LLEVA ACCIÓN, y esa es la diferencia con la referencia: allí es un
        botón que vende el plan de pago. Aquí sería inventar función, así que
        ocupa el mismo sitio con el estado que Apolo ya conoce —qué plan está
        activo—, en modo lectura.
      */}
      {/*
        DICE EL PLAN QUE HAY, no uno fijo.

        La primera version rotulaba "Plan Premium activo" como texto constante, y
        con Premium apagado la barra afirmaba lo contrario de lo que decia el
        modulo dos centimetros a la derecha. Un adorno que miente sobre el estado
        del producto es peor que no tener adorno.

        Sin fondo de acento cuando esta apagado: el bloque indigo es el unico
        solido de la pantalla y solo se gana cuando hay algo activo que anunciar.
      */}
      <div
        className={`shrink-0 rounded-panel px-4 py-3 ${
          premium ? "caja-acento" : "caja-interna"
        }`}
      >
        <p
          className={`text-[13px] font-bold leading-tight ${
            premium ? "text-white" : "text-nav-texto"
          }`}
        >
          {premium ? t("app.planTitulo") : t("app.planTituloBase")}
        </p>
        <p
          className={`mt-0.5 text-[11px] leading-snug ${
            premium ? "text-white/70" : "text-nav-texto/80"
          }`}
        >
          {premium ? t("app.planPie") : t("app.planPieBase")}
        </p>
      </div>
    </div>
  );

  // SIN FONDO PROPIO, y esto no es un descuido. El resplandor y la retícula
  // viven en `body::before` con `z-index: -1`, que pinta por encima del fondo
  // del `body` pero por DEBAJO del contenido en flujo. Un `bg-fondo` opaco aquí
  // es contenido en flujo: tapaba el halo entero, y el síntoma era un fondo
  // negro liso sin ninguna pista de por qué.
  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-3 left-3 z-30 hidden w-60 lg:block">
        {panelNavegacion}
      </aside>

      {/*
        El cajón entra deslizando desde el borde IZQUIERDO, que es de donde
        viene: el botón que lo abre está a la izquierda de la cabecera y el
        panel vive ahí en escritorio. Aparecer sin recorrido rompe esa relación
        y obliga a reconstruirla mentalmente cada vez.

        Se monta siempre y se oculta con `translateX`, en lugar de montarse y
        desmontarse: un elemento que se desmonta no puede animar su salida.
        `pointer-events` y `aria-hidden` lo sacan del alcance del ratón y del
        lector de pantalla mientras está cerrado.

        `translateX(-105%)` y no `-100%`: el panel lleva sombra, y al 100%
        justo la sombra sigue asomando por el borde.
      */}
      <div
        className={`fixed inset-0 z-40 lg:hidden ${
          menuAbierto ? "" : "pointer-events-none"
        }`}
        aria-hidden={!menuAbierto}
      >
        <button
          type="button"
          tabIndex={menuAbierto ? 0 : -1}
          aria-label={t("acc.cerrarMenu")}
          onClick={() => setMenuAbierto(false)}
          className={`absolute inset-0 bg-black/60 transition-opacity duration-[220ms] ease-[cubic-bezier(0.32,0.72,0,1)] ${
            menuAbierto ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          className={`absolute inset-y-3 left-3 w-64 max-w-[80vw] transition-transform duration-[280ms] ease-[cubic-bezier(0.32,0.72,0,1)] ${
            menuAbierto ? "translate-x-0" : "-translate-x-[105%]"
          }`}
        >
          {panelNavegacion}
        </div>
      </div>

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
