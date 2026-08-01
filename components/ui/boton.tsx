"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Botón de Apolo.
 *
 * Altura mínima 44px en todas las variantes salvo "compacto": el operario de
 * almacén va a tocar esto con guantes y con el teléfono en la mano.
 *
 * La variante "luz" usa el lima de la marca como FONDO con texto casi negro
 * encima (13.5:1). El lima nunca se usa como color de texto.
 */

type Variante = "primario" | "luz" | "suave" | "fantasma" | "peligro";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  compacto?: boolean;
  iconoIzquierda?: ReactNode;
  children: ReactNode;
}

const VARIANTES: Record<Variante, string> = {
  primario:
    "bg-marca-fondo text-white hover:brightness-110 active:brightness-95 border border-transparent",
  luz: "bg-luz text-[var(--apolo-tinta)] hover:brightness-105 active:brightness-95 border border-transparent",
  suave:
    "bg-superficie text-texto border border-borde hover:bg-superficie-hover hover:border-borde-fuerte",
  fantasma:
    "bg-transparent text-texto-2 border border-transparent hover:bg-superficie-2 hover:text-texto",
  peligro:
    "bg-peligro-tenue text-peligro border border-transparent hover:brightness-95",
};

export function Boton({
  variante = "suave",
  compacto = false,
  iconoIzquierda,
  children,
  className = "",
  type = "button",
  ...resto
}: Props) {
  return (
    <button
      type={type}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-control font-semibold",
        "transition-[filter,background-color,border-color] duration-150",
        "disabled:opacity-45 disabled:pointer-events-none",
        compacto ? "min-h-9 px-3 text-sm" : "min-h-11 px-4 text-sm",
        VARIANTES[variante],
        className,
      ].join(" ")}
      {...resto}
    >
      {iconoIzquierda}
      {children}
    </button>
  );
}
