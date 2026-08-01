"use client";

/**
 * Puente entre la UI y el motor de inventario.
 *
 * Ninguna pantalla llama a `aplicar` directamente: pasa por aquí, y aquí es
 * donde se persiste. Cuando exista backend, este archivo se convierte en la
 * llamada al servidor y las pantallas no cambian.
 *
 * Si el dominio rechaza la operación, NO se guarda nada. El error sube a la
 * vista para que lo muestre; no se traga en silencio.
 */

import { aplicar, transferir, type Operacion } from "@/lib/dominio/inventario";
import type { Asiento, ClaveSaldo, Resultado } from "@/lib/dominio/tipos";
import { fallo } from "@/lib/dominio/tipos";
import { getEstado, setEstado } from "./almacen";

export function ejecutar(op: Operacion): Resultado<Asiento> {
  const estado = getEstado();
  const articulo = estado.articulos.find((a) => a.id === op.articuloId);
  if (!articulo) {
    return fallo("CANTIDAD_INVALIDA", `Artículo desconocido: ${op.articuloId}`);
  }

  const r = aplicar(estado.inventario, op, articulo);
  if (!r.ok) return r;

  setEstado({ ...estado, inventario: r.valor.estado });
  return { ok: true, valor: r.valor.asiento };
}

export function ejecutarTransferencia(
  origen: ClaveSaldo,
  destino: ClaveSaldo,
  cantidad: number,
  usuarioId: string,
  nota?: string,
): Resultado<Asiento[]> {
  const estado = getEstado();
  const articulo = estado.articulos.find((a) => a.id === origen.articuloId);
  if (!articulo) {
    return fallo("CANTIDAD_INVALIDA", `Artículo desconocido: ${origen.articuloId}`);
  }

  const r = transferir(
    estado.inventario,
    origen,
    destino,
    cantidad,
    usuarioId,
    articulo,
    nota,
  );
  if (!r.ok) return r;

  setEstado({ ...estado, inventario: r.valor.estado });
  return { ok: true, valor: r.valor.asientos };
}
