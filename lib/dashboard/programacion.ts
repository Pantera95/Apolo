"use client";

import { useSyncExternalStore } from "react";

import type { IdPlantilla } from "@/lib/dashboard/plantillas";

/**
 * Informes programados.
 *
 * LÍMITE HONESTO Y DELIBERADO: hoy la programación se evalúa EN EL CLIENTE, así
 * que solo dispara con la aplicación abierta. No es una decisión de diseño, es
 * la consecuencia de que los datos del demo viven en localStorage: un cron del
 * servidor no tendría nada que leer.
 *
 * Con Supabase esto pasa a una Vercel Cron que llama a una Edge Function, lee
 * las vistas y envía sin que nadie tenga nada abierto. La configuración que se
 * guarda aquí es exactamente la que consumirá ese cron: `hora`, `dias`,
 * `plantilla` y `chatId`. Por eso la pantalla lo dice en vez de fingir que ya
 * funciona desatendido.
 */
const CLAVE = "apolo:programacion";

export interface Programacion {
  id: string;
  activa: boolean;
  plantilla: IdPlantilla;
  /** 0–23, hora local. */
  hora: number;
  minuto: number;
  /** 0 = domingo. Vacío = todos los días. */
  dias: number[];
  chatId: string;
  etiqueta: string;
  /** ISO del último envío. Es lo que impide repetir dentro del mismo turno. */
  ultimoEnvio?: string;
}

export interface EstadoProgramacion {
  programaciones: Programacion[];
}

const VACIO: EstadoProgramacion = { programaciones: [] };

let actual: EstadoProgramacion = VACIO;
let leido = false;
const oyentes = new Set<() => void>();

function leer(): EstadoProgramacion {
  if (leido) return actual;
  leido = true;
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    const p = crudo ? (JSON.parse(crudo) as Partial<EstadoProgramacion>) : null;
    actual = { programaciones: p?.programaciones ?? [] };
  } catch {
    actual = VACIO;
  }
  return actual;
}

function guardar(nuevo: EstadoProgramacion) {
  actual = nuevo;
  leido = true;
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(nuevo));
  } catch {
    /* sin persistencia, la sesión sigue */
  }
  for (const o of oyentes) o();
}

export function agregarProgramacion(p: Omit<Programacion, "id">): void {
  guardar({
    programaciones: [
      ...leer().programaciones,
      { ...p, id: `prog-${Date.now().toString(36)}` },
    ],
  });
}

export function alternarProgramacion(id: string): void {
  guardar({
    programaciones: leer().programaciones.map((p) =>
      p.id === id ? { ...p, activa: !p.activa } : p,
    ),
  });
}

export function borrarProgramacion(id: string): void {
  guardar({ programaciones: leer().programaciones.filter((p) => p.id !== id) });
}

export function marcarEnviada(id: string, enISO: string): void {
  guardar({
    programaciones: leer().programaciones.map((p) =>
      p.id === id ? { ...p, ultimoEnvio: enISO } : p,
    ),
  });
}

function suscribir(cb: () => void): () => void {
  oyentes.add(cb);
  return () => {
    oyentes.delete(cb);
  };
}

export function useProgramaciones(): Programacion[] {
  return useSyncExternalStore(
    suscribir,
    () => leer().programaciones,
    () => VACIO.programaciones,
  );
}
