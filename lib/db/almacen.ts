"use client";

/**
 * Capa de datos de Apolo.
 *
 * Patrón store: localStorage + CustomEvent + hook. La firma pública
 * (`getEstado` / `setEstado` / `useEstado`) es la que van a usar todas las
 * pantallas, así que cuando entre Supabase cambia el CUERPO de estas funciones
 * y no una sola línea de UI.
 *
 * *** Esto es persistencia de demostración, no una base de datos. ***
 * Los datos viven en el navegador de quien mira la presentación. Dos pestañas
 * comparten estado; dos computadoras no.
 */

import { useSyncExternalStore } from "react";

import type {
  Almacen,
  Articulo,
  Asiento,
  Obra,
  Saldo,
  Ubicacion,
} from "@/lib/dominio/tipos";
import type { EstadoInventario } from "@/lib/dominio/inventario";
import { ESTADO_VACIO } from "@/lib/dominio/inventario";
import type { Solicitud } from "@/lib/dominio/despacho";

export const CLAVE_ESTADO = "apolo:estado";
const EVENTO = "apolo:datos";
/** Sube al cambiar la forma de los datos guardados: descarta lo viejo. */
const VERSION = 1;

export interface EstadoApolo {
  articulos: Articulo[];
  almacenes: Almacen[];
  ubicaciones: Ubicacion[];
  obras: Obra[];
  solicitudes: Solicitud[];
  inventario: EstadoInventario;
}

export const ESTADO_APOLO_VACIO: EstadoApolo = {
  articulos: [],
  almacenes: [],
  ubicaciones: [],
  obras: [],
  solicitudes: [],
  inventario: ESTADO_VACIO,
};

/**
 * Forma serializada. El `Map` de saldos no sobrevive a JSON, así que se guarda
 * como objeto plano y se reconstruye al leer.
 */
interface Persistido {
  version: number;
  articulos: Articulo[];
  almacenes: Almacen[];
  ubicaciones: Ubicacion[];
  obras: Obra[];
  solicitudes: Solicitud[];
  asientos: Asiento[];
  saldos: Record<string, Saldo>;
}

function serializar(estado: EstadoApolo): string {
  const persistido: Persistido = {
    version: VERSION,
    articulos: estado.articulos,
    almacenes: estado.almacenes,
    ubicaciones: estado.ubicaciones,
    obras: estado.obras,
    solicitudes: estado.solicitudes,
    asientos: [...estado.inventario.asientos],
    saldos: Object.fromEntries(estado.inventario.saldos),
  };
  return JSON.stringify(persistido);
}

function deserializar(crudo: string): EstadoApolo | null {
  try {
    const p = JSON.parse(crudo) as Persistido;
    if (p.version !== VERSION) return null;
    return {
      articulos: p.articulos ?? [],
      almacenes: p.almacenes ?? [],
      ubicaciones: p.ubicaciones ?? [],
      obras: p.obras ?? [],
      solicitudes: p.solicitudes ?? [],
      inventario: {
        saldos: new Map(Object.entries(p.saldos ?? {})),
        asientos: p.asientos ?? [],
      },
    };
  } catch {
    // Dato corrupto: se ignora y se arranca vacío. Nunca se rompe la pantalla
    // por un JSON malo en el navegador de quien presenta.
    return null;
  }
}

// ---------------------------------------------------------------------------
// Caché
//
// useSyncExternalStore exige que dos lecturas seguidas sin cambios devuelvan
// la MISMA referencia, o React entra en un bucle de render. Por eso se cachea
// el objeto deserializado hasta que el texto guardado cambie.
// ---------------------------------------------------------------------------

let crudoEnCache: string | null = null;
let estadoEnCache: EstadoApolo = ESTADO_APOLO_VACIO;

export function getEstado(): EstadoApolo {
  let crudo: string | null = null;
  try {
    crudo = localStorage.getItem(CLAVE_ESTADO);
  } catch {
    return ESTADO_APOLO_VACIO;
  }

  if (crudo === crudoEnCache) return estadoEnCache;

  crudoEnCache = crudo;
  estadoEnCache = (crudo && deserializar(crudo)) || ESTADO_APOLO_VACIO;
  return estadoEnCache;
}

export function setEstado(estado: EstadoApolo): void {
  const crudo = serializar(estado);
  try {
    localStorage.setItem(CLAVE_ESTADO, crudo);
  } catch {
    // Sin espacio o en navegación privada: se sigue en memoria.
  }
  crudoEnCache = crudo;
  estadoEnCache = estado;
  window.dispatchEvent(new CustomEvent(EVENTO));
}

export function reiniciarACero(): void {
  setEstado(ESTADO_APOLO_VACIO);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

function suscribir(alCambiar: () => void): () => void {
  window.addEventListener("storage", alCambiar);
  window.addEventListener(EVENTO, alCambiar);
  return () => {
    window.removeEventListener("storage", alCambiar);
    window.removeEventListener(EVENTO, alCambiar);
  };
}

const enServidor = () => ESTADO_APOLO_VACIO;

export function useEstado(): EstadoApolo {
  return useSyncExternalStore(suscribir, getEstado, enServidor);
}

/** Falso hasta que el cliente hidrata: evita pintar cifras antes de tiempo. */
export function useListo(): boolean {
  return useSyncExternalStore(
    suscribir,
    () => true,
    () => false,
  );
}
