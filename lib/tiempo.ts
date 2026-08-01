"use client";

import { useSyncExternalStore } from "react";

/**
 * Reloj estable para la vista.
 *
 * Leer `Date.now()` durante el render es impuro: el servidor renderiza en un
 * instante y el cliente hidrata en otro, así que cualquier "hace N días"
 * calculado ahí produce un desajuste de hidratación.
 *
 * Este hook fija el instante UNA vez por carga y lo devuelve siempre igual, y
 * en el servidor devuelve 0 para que la vista sepa que todavía no puede contar
 * días. La llamada impura vive fuera del componente.
 */
let momento: number | null = null;

function enCliente(): number {
  momento ??= Date.now();
  return momento;
}

const enServidor = () => 0;
const sinSuscripcion = () => () => {};

/** Milisegundos del momento de carga, o 0 mientras no haya hidratado. */
export function useAhora(): number {
  return useSyncExternalStore(sinSuscripcion, enCliente, enServidor);
}

const DIA_MS = 86_400_000;

/** Días transcurridos desde una fecha ISO. Devuelve null si aún no hay reloj. */
export function diasDesde(iso: string, ahora: number): number | null {
  if (ahora === 0) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((ahora - t) / DIA_MS));
}
