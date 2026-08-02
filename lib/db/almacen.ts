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
import type { Chofer, Despacho, Vehiculo } from "@/lib/dominio/entrega";
import type { PerfilImportacion } from "@/lib/dominio/importacion";
import type { OrdenCompra, Proveedor } from "@/lib/dominio/compras";

export const CLAVE_ESTADO = "apolo:estado";
const EVENTO = "apolo:datos";
/** Sube al cambiar la forma de los datos guardados: descarta lo viejo. */
const VERSION = 4;

/**
 * Un archivo cargado. Guarda las huellas de sus filas para la idempotencia y
 * los asientos que generó para poder revertirlo.
 */
export interface ArchivoImportado {
  id: string;
  nombre: string;
  perfilId: string;
  perfilNombre: string;
  fecha: string;
  filasImportadas: number;
  filasOmitidas: number;
  asientoIds: string[];
  claves: string[];
  /** Revertido: sus filas dejan de contar para la detección de duplicados. */
  revertido: boolean;
}

export interface EstadoApolo {
  articulos: Articulo[];
  almacenes: Almacen[];
  ubicaciones: Ubicacion[];
  obras: Obra[];
  solicitudes: Solicitud[];
  choferes: Chofer[];
  vehiculos: Vehiculo[];
  despachos: Despacho[];
  perfiles: PerfilImportacion[];
  archivos: ArchivoImportado[];
  proveedores: Proveedor[];
  ordenes: OrdenCompra[];
  inventario: EstadoInventario;
}

export const ESTADO_APOLO_VACIO: EstadoApolo = {
  articulos: [],
  almacenes: [],
  ubicaciones: [],
  obras: [],
  solicitudes: [],
  choferes: [],
  vehiculos: [],
  despachos: [],
  perfiles: [],
  archivos: [],
  proveedores: [],
  ordenes: [],
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
  choferes: Chofer[];
  vehiculos: Vehiculo[];
  despachos: Despacho[];
  perfiles: PerfilImportacion[];
  archivos: ArchivoImportado[];
  proveedores: Proveedor[];
  ordenes: OrdenCompra[];
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
    choferes: estado.choferes,
    vehiculos: estado.vehiculos,
    despachos: estado.despachos,
    perfiles: estado.perfiles,
    archivos: estado.archivos,
    proveedores: estado.proveedores,
    ordenes: estado.ordenes,
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
      choferes: p.choferes ?? [],
      vehiculos: p.vehiculos ?? [],
      despachos: p.despachos ?? [],
      perfiles: p.perfiles ?? [],
      archivos: p.archivos ?? [],
      proveedores: p.proveedores ?? [],
      ordenes: p.ordenes ?? [],
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
