"use client";

import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";

/**
 * Campos de formulario.
 *
 * Usan `--borde-fuerte` (3:1 medido), no el borde decorativo: un campo que no
 * se distingue del fondo es un error de accesibilidad, no una decisión de
 * estilo. Altura mínima 44px porque el almacén los toca con guantes.
 */

export function Campo({
  etiqueta,
  ayuda,
  error,
  sufijo,
  className = "",
  ...resto
}: InputHTMLAttributes<HTMLInputElement> & {
  etiqueta: string;
  ayuda?: string;
  error?: string;
  sufijo?: ReactNode;
}) {
  const id = useId();
  return (
    <div className={`min-w-0 ${className}`}>
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.08em] text-texto-2"
      >
        {etiqueta}
      </label>
      <div className="relative">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={ayuda || error ? `${id}-ayuda` : undefined}
          className={[
            "min-h-11 w-full rounded-control border-2 bg-superficie px-3 text-sm font-semibold text-texto",
            "placeholder:font-medium placeholder:text-texto-3",
            error ? "border-peligro" : "border-borde-fuerte",
            sufijo ? "pr-16" : "",
          ].join(" ")}
          {...resto}
        />
        {sufijo && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-bold text-texto-3">
            {sufijo}
          </span>
        )}
      </div>
      {(ayuda || error) && (
        <p
          id={`${id}-ayuda`}
          className={`mt-1.5 text-xs ${error ? "font-bold text-peligro" : "text-texto-3"}`}
        >
          {error ?? ayuda}
        </p>
      )}
    </div>
  );
}

export function Selector({
  etiqueta,
  ayuda,
  error,
  children,
  className = "",
  ...resto
}: SelectHTMLAttributes<HTMLSelectElement> & {
  etiqueta: string;
  ayuda?: string;
  error?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className={`min-w-0 ${className}`}>
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.08em] text-texto-2"
      >
        {etiqueta}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        className={[
          "min-h-11 w-full appearance-none rounded-control border-2 bg-superficie px-3 text-sm font-semibold text-texto",
          error ? "border-peligro" : "border-borde-fuerte",
        ].join(" ")}
        {...resto}
      >
        {children}
      </select>
      {(ayuda || error) && (
        <p className={`mt-1.5 text-xs ${error ? "font-bold text-peligro" : "text-texto-3"}`}>
          {error ?? ayuda}
        </p>
      )}
    </div>
  );
}

/** Grupo de opciones excluyentes. Más rápido que un select para dos opciones. */
export function Segmentado<T extends string>({
  etiqueta,
  valor,
  onCambio,
  opciones,
}: {
  etiqueta: string;
  valor: T;
  onCambio: (v: T) => void;
  opciones: { valor: T; texto: string }[];
}) {
  return (
    <div className="min-w-0">
      <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.08em] text-texto-2">
        {etiqueta}
      </span>
      <div
        role="radiogroup"
        aria-label={etiqueta}
        className="flex overflow-hidden rounded-control border-2 border-borde-fuerte"
      >
        {opciones.map((o) => (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={valor === o.valor}
            onClick={() => onCambio(o.valor)}
            className={[
              "min-h-11 flex-1 px-3 text-sm font-bold transition-colors",
              valor === o.valor
                ? "bg-marca-fondo text-white"
                : "bg-superficie text-texto-2 hover:bg-superficie-2",
            ].join(" ")}
          >
            {o.texto}
          </button>
        ))}
      </div>
    </div>
  );
}
