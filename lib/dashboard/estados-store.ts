"use client";

import { useSyncExternalStore } from "react";

import type { EstadosFinancieros } from "@/lib/dashboard/finanzas";

/**
 * Estados financieros declarados.
 *
 * Viven aparte del estado operativo (`lib/db/almacen`) a propósito: no son un
 * dato que Apolo mida, son una declaración de un tercero. Guardarlos en el
 * mismo sitio invitaría a tratarlos igual, y el panel se apoya justo en la
 * distinción contraria.
 *
 * Mismo patrón que el resto del proyecto: `useSyncExternalStore` sobre
 * localStorage. Leer localStorage durante el render desajusta la hidratación.
 */
const CLAVE = "apolo:finanzas";

export interface EstadosGuardados {
  estados: EstadosFinancieros;
  /**
   * Cortes mensuales anteriores, del más antiguo al más reciente.
   *
   * Es lo que hace posible que CADA indicador tenga gráfica: sin serie solo hay
   * un punto, y un punto no es una tendencia. El último elemento coincide con
   * `estados`.
   */
  historial: EstadosFinancieros[];
  /** Nombre del archivo del que salieron, para poder rastrear la cifra. */
  archivo: string;
  importadoEn: string;
  /** Marca explícita: estas cifras son de demostración, no del cliente. */
  demo: boolean;
}

const VACIO: EstadosGuardados = {
  estados: {},
  historial: [],
  archivo: "",
  importadoEn: "",
  demo: false,
};

let actual: EstadosGuardados = VACIO;
let leido = false;
const oyentes = new Set<() => void>();

function leer(): EstadosGuardados {
  if (leido) return actual;
  leido = true;
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    const leidoCrudo = crudo ? (JSON.parse(crudo) as Partial<EstadosGuardados>) : null;
    // Un guardado de una versión anterior no traía `historial`: se rellena en
    // vez de dejar que las gráficas reciban `undefined`.
    actual = leidoCrudo
      ? {
          ...VACIO,
          ...leidoCrudo,
          estados: leidoCrudo.estados ?? {},
          historial: leidoCrudo.historial ?? (leidoCrudo.estados ? [leidoCrudo.estados] : []),
        }
      : VACIO;
  } catch {
    // Un JSON corrupto no puede tumbar el panel: se empieza en blanco.
    actual = VACIO;
  }
  return actual;
}

export function guardarEstados(
  estados: EstadosFinancieros,
  archivo: string,
  historial: EstadosFinancieros[] = [],
  demo = false,
): void {
  actual = {
    estados,
    // Un archivo suelto no trae historia: se guarda como único corte para que
    // las gráficas muestren un punto en vez de romperse.
    historial: historial.length > 0 ? historial : [estados],
    archivo,
    importadoEn: new Date().toISOString(),
    demo,
  };
  leido = true;
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(actual));
  } catch {
    // Sin persistencia, pero la sesión actual funciona igual.
  }
  for (const o of oyentes) o();
}

export function limpiarEstados(): void {
  actual = VACIO;
  leido = true;
  try {
    window.localStorage.removeItem(CLAVE);
  } catch {
    /* vacío a propósito */
  }
  for (const o of oyentes) o();
}

function suscribir(cb: () => void): () => void {
  oyentes.add(cb);
  return () => {
    oyentes.delete(cb);
  };
}

export function useEstadosFinancieros(): EstadosGuardados {
  return useSyncExternalStore(suscribir, leer, () => VACIO);
}
