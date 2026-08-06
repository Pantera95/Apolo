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
  /** Nombre del archivo del que salieron, para poder rastrear la cifra. */
  archivo: string;
  importadoEn: string;
}

const VACIO: EstadosGuardados = { estados: {}, archivo: "", importadoEn: "" };

let actual: EstadosGuardados = VACIO;
let leido = false;
const oyentes = new Set<() => void>();

function leer(): EstadosGuardados {
  if (leido) return actual;
  leido = true;
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    actual = crudo ? (JSON.parse(crudo) as EstadosGuardados) : VACIO;
  } catch {
    // Un JSON corrupto no puede tumbar el panel: se empieza en blanco.
    actual = VACIO;
  }
  return actual;
}

export function guardarEstados(estados: EstadosFinancieros, archivo: string): void {
  actual = { estados, archivo, importadoEn: new Date().toISOString() };
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
