"use client";

import { useSyncExternalStore } from "react";

/**
 * Conmutador del panel Premium.
 *
 * Apolo base entrega el panel operativo: siete indicadores y la actividad del
 * día. Premium añade la capa de dirección —ventanas comparables, umbrales,
 * centro de alertas, obras críticas—, y se enseña como lo que es: una opción
 * sobre esta misma versión, no un producto distinto.
 *
 * Vive en localStorage y no en el estado de React porque la elección tiene que
 * sobrevivir a una recarga en mitad de una presentación.
 *
 * Se usa `useSyncExternalStore` y no `useState` + efecto por la misma razón que
 * en el resto del proyecto: leer localStorage durante el render desajusta la
 * hidratación, y escribir el estado dentro de un efecto provoca un segundo
 * render visible.
 */
const CLAVE = "apolo:premium";

let activo = false;
let leido = false;
const oyentes = new Set<() => void>();

function leer(): boolean {
  if (leido) return activo;
  leido = true;
  try {
    activo = window.localStorage.getItem(CLAVE) === "1";
  } catch {
    // Modo privado o almacenamiento bloqueado: el demo sigue, sin recordar.
    activo = false;
  }
  return activo;
}

function avisar() {
  for (const o of oyentes) o();
}

export function setPremium(valor: boolean): void {
  activo = valor;
  leido = true;
  try {
    if (valor) window.localStorage.setItem(CLAVE, "1");
    else window.localStorage.removeItem(CLAVE);
  } catch {
    // Sin persistencia, pero la sesión actual funciona igual.
  }
  avisar();
}

function suscribir(cb: () => void): () => void {
  oyentes.add(cb);
  return () => {
    oyentes.delete(cb);
  };
}

/** En el servidor siempre falso: el panel base es lo que se prerenderiza. */
export function usePremium(): boolean {
  return useSyncExternalStore(suscribir, leer, () => false);
}
