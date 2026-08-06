"use client";

import { useSyncExternalStore } from "react";

import type { Presupuesto } from "@/lib/datos/obra-premium";

/**
 * Presupuesto de material importado.
 *
 * Vive aparte del estado operativo por la misma razón que los estados
 * financieros: no es algo que Apolo mida, es una declaración de la oficina
 * técnica. Guardarlo en el mismo sitio invitaría a tratarlo igual, y el panel
 * se apoya justo en distinguir lo medido de lo declarado.
 */
const CLAVE = "apolo:presupuesto";

const VACIO: Presupuesto = { lineas: [], importadoEn: "", archivo: "" };

let actual: Presupuesto = VACIO;
let leido = false;
const oyentes = new Set<() => void>();

function leer(): Presupuesto {
  if (leido) return actual;
  leido = true;
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    const p = crudo ? (JSON.parse(crudo) as Partial<Presupuesto>) : null;
    actual = p?.lineas ? { ...VACIO, ...p, lineas: p.lineas } : VACIO;
  } catch {
    // Un JSON corrupto no puede tumbar la ficha de obra.
    actual = VACIO;
  }
  return actual;
}

export function guardarPresupuesto(p: Presupuesto): void {
  actual = p;
  leido = true;
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(p));
  } catch {
    /* sin persistencia, la sesión sigue */
  }
  for (const o of oyentes) o();
}

export function limpiarPresupuesto(): void {
  guardarPresupuesto(VACIO);
}

function suscribir(cb: () => void): () => void {
  oyentes.add(cb);
  return () => {
    oyentes.delete(cb);
  };
}

/** `null` cuando no hay ninguno cargado, para distinguirlo de uno vacío. */
export function usePresupuesto(): Presupuesto | null {
  const p = useSyncExternalStore(suscribir, leer, () => VACIO);
  return p.lineas.length > 0 ? p : null;
}
