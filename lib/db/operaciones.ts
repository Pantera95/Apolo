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
import { fallo, ok } from "@/lib/dominio/tipos";
import {
  ponerEnRuta,
  registrarEntrega,
  registrarPreparacion,
  type Despacho,
  type PruebaEntrega,
} from "@/lib/dominio/entrega";
import { getEstado, setEstado, type EstadoApolo } from "./almacen";

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

// ---------------------------------------------------------------------------
// Despacho
// ---------------------------------------------------------------------------

const USUARIO = "demo-owner";

function reemplazar(estado: EstadoApolo, despacho: Despacho): Despacho[] {
  return estado.despachos.map((d) => (d.id === despacho.id ? despacho : d));
}

/** Marcar un renglón como recogido. No mueve existencia: el picking es físico. */
export function prepararLinea(
  despachoId: string,
  articuloId: string,
  ubicacionId: string,
  cantidad: number,
): Resultado<Despacho> {
  const estado = getEstado();
  const despacho = estado.despachos.find((d) => d.id === despachoId);
  if (!despacho) return fallo("CANTIDAD_INVALIDA", "Despacho desconocido");

  const r = registrarPreparacion(despacho, articuloId, ubicacionId, cantidad);
  if (!r.ok) return r;

  setEstado({ ...estado, despachos: reemplazar(estado, r.valor) });
  return ok(r.valor);
}

/**
 * Sacar a ruta: aquí SÍ se mueve el inventario. Sale del estante y entra en
 * tránsito, consumiendo la reserva.
 *
 * Si algún renglón falla, no se guarda nada: se trabaja sobre una copia del
 * inventario y solo se persiste cuando todos pasaron. Un despacho a medias en
 * el kardex sería peor que no despacharlo.
 */
export function sacarARuta(despachoId: string): Resultado<Despacho> {
  const estado = getEstado();
  const despacho = estado.despachos.find((d) => d.id === despachoId);
  if (!despacho) return fallo("CANTIDAD_INVALIDA", "Despacho desconocido");

  const fecha = new Date().toISOString();
  const transicion = ponerEnRuta(despacho, fecha);
  if (!transicion.ok) return transicion;

  let inventario = estado.inventario;
  for (const linea of despacho.lineas) {
    const articulo = estado.articulos.find((a) => a.id === linea.articuloId);
    if (!articulo) return fallo("CANTIDAD_INVALIDA", "Artículo desconocido");

    const r = aplicar(
      inventario,
      {
        tipo: "despacho",
        cantidad: linea.cantidad,
        obraId: despacho.obraId,
        fecha,
        usuarioId: USUARIO,
        documentoId: despacho.codigo,
        articuloId: linea.articuloId,
        almacenId: linea.almacenId,
        ubicacionId: linea.ubicacionId,
      },
      articulo,
    );
    if (!r.ok) return r;
    inventario = r.valor.estado;
  }

  setEstado({
    ...estado,
    inventario,
    despachos: reemplazar(estado, transicion.valor),
  });
  return ok(transicion.valor);
}

/**
 * Registrar la entrega: de tránsito a obra.
 *
 * La coincidencia de la orden la calcula el dominio. Si no cuadra, la entrega
 * se registra igual —la mercancía ya está en obra— pero queda marcada.
 */
export function entregar(
  despachoId: string,
  pod: Omit<PruebaEntrega, "coincide" | "fecha">,
): Resultado<Despacho> {
  const estado = getEstado();
  const despacho = estado.despachos.find((d) => d.id === despachoId);
  if (!despacho) return fallo("CANTIDAD_INVALIDA", "Despacho desconocido");

  const fecha = new Date().toISOString();
  const transicion = registrarEntrega(despacho, { ...pod, fecha });
  if (!transicion.ok) return transicion;

  let inventario = estado.inventario;
  for (const linea of despacho.lineas) {
    const articulo = estado.articulos.find((a) => a.id === linea.articuloId);
    if (!articulo) return fallo("CANTIDAD_INVALIDA", "Artículo desconocido");

    const r = aplicar(
      inventario,
      {
        tipo: "entrega",
        cantidad: linea.cantidad,
        obraId: despacho.obraId,
        fecha,
        usuarioId: USUARIO,
        documentoId: despacho.codigo,
        articuloId: linea.articuloId,
        almacenId: linea.almacenId,
        ubicacionId: linea.ubicacionId,
      },
      articulo,
    );
    if (!r.ok) return r;
    inventario = r.valor.estado;
  }

  setEstado({
    ...estado,
    inventario,
    despachos: reemplazar(estado, transicion.valor),
  });
  return ok(transicion.valor);
}
