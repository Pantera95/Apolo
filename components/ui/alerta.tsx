import type { ReactNode } from "react";

import { Icono } from "./icono";

export type TonoAlerta = "info" | "advertencia" | "peligro" | "luz";

const TONOS: Record<TonoAlerta, { caja: string; texto: string }> = {
  info: { caja: "bg-info-tenue border-info/30", texto: "text-info" },
  advertencia: {
    caja: "bg-advertencia-tenue border-advertencia/30",
    texto: "text-advertencia",
  },
  peligro: { caja: "bg-peligro-tenue border-peligro/30", texto: "text-peligro" },
  luz: { caja: "bg-luz-tenue border-luz/50", texto: "text-texto" },
};

export function Alerta({
  tono = "info",
  titulo,
  children,
  accion,
}: {
  tono?: TonoAlerta;
  titulo?: string;
  children: ReactNode;
  accion?: ReactNode;
}) {
  const estilo = TONOS[tono];
  return (
    <div
      role="status"
      className={`flex min-w-0 flex-wrap items-start gap-3 rounded-tarjeta border px-4 py-3 ${estilo.caja}`}
    >
      <span className={`mt-0.5 shrink-0 ${estilo.texto}`}>
        <Icono nombre="alerta" tam={18} />
      </span>
      <div className="min-w-0 flex-1">
        {titulo && <p className="text-sm font-bold">{titulo}</p>}
        <div className="text-sm text-texto-2">{children}</div>
      </div>
      {accion}
    </div>
  );
}
