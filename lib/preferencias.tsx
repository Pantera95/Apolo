"use client";

/**
 * Preferencias del usuario: tema e idioma.
 *
 * Patrón de store: localStorage + CustomEvent + hook. Es el mismo que van a
 * usar los datos del dominio, así que conviene que la primera pieza lo fije.
 *
 * Se lee con useSyncExternalStore en vez de con un efecto porque localStorage
 * es estado externo al render: el servidor no lo tiene, y leerlo dentro de un
 * useEffect provoca un render en cascada además de un parpadeo.
 *
 * Las claves llevan el prefijo "apolo:" — cada una equivale a una futura
 * columna de preferencias, así que el nombre se elige ahora y no se cambia.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { textos, type ClaveTexto, type Idioma } from "./i18n/textos";

export type Tema = "claro" | "oscuro";

export const CLAVE_TEMA = "apolo:tema";
export const CLAVE_IDIOMA = "apolo:idioma";
const EVENTO = "apolo:preferencias";

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

function suscribir(alCambiar: () => void): () => void {
  // "storage" cubre el cambio hecho en OTRA pestaña; el evento propio cubre el
  // de esta. Sin los dos, dos pestañas abiertas se desincronizan.
  window.addEventListener("storage", alCambiar);
  window.addEventListener(EVENTO, alCambiar);
  return () => {
    window.removeEventListener("storage", alCambiar);
    window.removeEventListener(EVENTO, alCambiar);
  };
}

function leer(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function escribir(clave: string, valor: string): void {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    // Navegación privada o almacenamiento lleno: la preferencia no persiste,
    // pero la app sigue funcionando.
  }
  window.dispatchEvent(new CustomEvent(EVENTO));
}

const temaCliente = (): Tema => (leer(CLAVE_TEMA) === "oscuro" ? "oscuro" : "claro");
const temaServidor = (): Tema => "claro";

const idiomaCliente = (): Idioma => (leer(CLAVE_IDIOMA) === "en" ? "en" : "es");
const idiomaServidor = (): Idioma => "es";

const listoCliente = () => true;
const listoServidor = () => false;

// ---------------------------------------------------------------------------
// Contexto
// ---------------------------------------------------------------------------

interface Preferencias {
  tema: Tema;
  idioma: Idioma;
  /** Falso hasta que el cliente hidrata: evita pintar datos falsos. */
  listo: boolean;
  alternarTema: () => void;
  alternarIdioma: () => void;
  t: (clave: ClaveTexto) => string;
}

const Contexto = createContext<Preferencias | null>(null);

export function ProveedorPreferencias({ children }: { children: ReactNode }) {
  const tema = useSyncExternalStore(suscribir, temaCliente, temaServidor);
  const idioma = useSyncExternalStore(suscribir, idiomaCliente, idiomaServidor);
  const listo = useSyncExternalStore(suscribir, listoCliente, listoServidor);

  // Sincroniza el DOM con la preferencia. El script anti-parpadeo del layout ya
  // puso la clase antes del primer pintado; esto la mantiene al conmutarla.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", tema === "oscuro");
  }, [tema]);

  useEffect(() => {
    document.documentElement.lang = idioma;
  }, [idioma]);

  const alternarTema = useCallback(
    () => escribir(CLAVE_TEMA, temaCliente() === "claro" ? "oscuro" : "claro"),
    [],
  );

  const alternarIdioma = useCallback(
    () => escribir(CLAVE_IDIOMA, idiomaCliente() === "es" ? "en" : "es"),
    [],
  );

  const t = useCallback((clave: ClaveTexto) => textos[idioma][clave], [idioma]);

  const valor = useMemo(
    () => ({ tema, idioma, listo, alternarTema, alternarIdioma, t }),
    [tema, idioma, listo, alternarTema, alternarIdioma, t],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function usePreferencias(): Preferencias {
  const ctx = useContext(Contexto);
  if (!ctx) {
    throw new Error("usePreferencias debe usarse dentro de ProveedorPreferencias");
  }
  return ctx;
}

/** Atajo para el caso más común: solo traducir. */
export function useT(): (clave: ClaveTexto) => string {
  return usePreferencias().t;
}
