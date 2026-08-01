"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { Icono } from "./icono";

/**
 * Diálogo modal sobre el <dialog> nativo.
 *
 * Se usa el elemento nativo a propósito: el navegador ya resuelve el foco
 * atrapado, la capa superior y el cierre con Escape. Reimplementar eso a mano
 * es la vía rápida a un modal que un teclado no puede cerrar.
 */
export function Dialogo({
  abierto,
  titulo,
  descripcion,
  onCerrar,
  children,
  pie,
}: {
  abierto: boolean;
  titulo: string;
  descripcion?: string;
  onCerrar: () => void;
  children: ReactNode;
  pie?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (abierto && !dialogo.open) dialogo.showModal();
    if (!abierto && dialogo.open) dialogo.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onCerrar();
      }}
      onClick={(e) => {
        // Cerrar al pulsar fuera: el <dialog> recibe el clic del backdrop.
        if (e.target === ref.current) onCerrar();
      }}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-tarjeta border-2 border-borde bg-superficie p-0 text-texto backdrop:bg-black/60"
    >
      <div className="flex items-start justify-between gap-4 border-b border-borde px-6 py-5">
        <div className="min-w-0">
          <h2 className="text-lg leading-tight">{titulo}</h2>
          {descripcion && (
            <p className="mt-1.5 text-sm text-texto-2">{descripcion}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onCerrar}
          aria-label={titulo}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-texto-2 hover:bg-superficie-2 hover:text-texto"
        >
          <Icono nombre="cerrar" tam={20} />
        </button>
      </div>

      <div className="px-6 py-5">{children}</div>

      {pie && (
        <div className="flex flex-wrap justify-end gap-2 border-t border-borde px-6 py-4">
          {pie}
        </div>
      )}
    </dialog>
  );
}
