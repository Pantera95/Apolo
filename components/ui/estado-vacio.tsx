import type { ReactNode } from "react";

import { Icono, type NombreIcono } from "./icono";

/**
 * Estado vacío.
 *
 * Un vacío sin explicación se lee como "esto está roto". Siempre dice qué falta
 * y, cuando existe, ofrece la acción que lo llena.
 */
export function EstadoVacio({
  icono = "inventario",
  titulo,
  detalle,
  accion,
}: {
  icono?: NombreIcono;
  titulo: string;
  detalle?: string;
  accion?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-tarjeta bg-superficie-2 text-texto-3">
        <Icono nombre={icono} tam={26} />
      </div>
      <h3 className="text-base">{titulo}</h3>
      {detalle && (
        <p className="mt-2 max-w-md text-sm leading-relaxed text-texto-2">
          {detalle}
        </p>
      )}
      {accion && <div className="mt-5">{accion}</div>}
    </div>
  );
}
