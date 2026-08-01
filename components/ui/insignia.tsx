import type { ReactNode } from "react";

/**
 * Insignia de estado.
 *
 * Regla: el estado NUNCA se comunica solo con color. Cada insignia lleva su
 * texto, y las críticas además un punto — un daltónico y una impresión en
 * blanco y negro tienen que poder leerlas igual.
 */

export type TonoInsignia =
  | "neutro"
  | "marca"
  | "luz"
  | "ok"
  | "advertencia"
  | "peligro"
  | "info";

const TONOS: Record<TonoInsignia, string> = {
  neutro: "bg-superficie-2 text-texto-2 border-borde",
  marca: "bg-marca-tenue text-marca border-transparent",
  luz: "bg-luz-tenue text-texto border-transparent",
  ok: "bg-ok-tenue text-ok border-transparent",
  advertencia: "bg-advertencia-tenue text-advertencia border-transparent",
  peligro: "bg-peligro-tenue text-peligro border-transparent",
  info: "bg-info-tenue text-info border-transparent",
};

const PUNTO: Record<TonoInsignia, string> = {
  neutro: "bg-texto-3",
  marca: "bg-marca",
  luz: "bg-luz",
  ok: "bg-ok",
  advertencia: "bg-advertencia",
  peligro: "bg-peligro",
  info: "bg-info",
};

export function Insignia({
  tono = "neutro",
  punto = false,
  children,
}: {
  tono?: TonoInsignia;
  punto?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pildora border px-2.5 py-1 text-xs font-bold ${TONOS[tono]}`}
    >
      {punto && (
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${PUNTO[tono]}`}
        />
      )}
      {children}
    </span>
  );
}
