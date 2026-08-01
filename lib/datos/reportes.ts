/**
 * Reportes.
 *
 * Cada reporte devuelve filas YA resueltas —con el código del artículo, el de
 * la obra y el nombre del almacén, no los identificadores— porque lo que se
 * exporta lo va a leer una persona en Excel, no un programa.
 */

import type { EstadoApolo } from "@/lib/db/almacen";
import type { Asiento, MotivoAjuste, TipoMovimiento } from "@/lib/dominio/tipos";
import type { EstadoDespacho, TipoTransporte } from "@/lib/dominio/entrega";
import { totalUnidades } from "@/lib/dominio/entrega";
import { deudaDeObra } from "./obras";

// ---------------------------------------------------------------------------
// Kardex
// ---------------------------------------------------------------------------

export interface FilaKardex {
  id: string;
  fecha: string;
  tipo: TipoMovimiento;
  codigoArticulo: string;
  descripcion: string;
  unidad: string;
  almacen: string;
  ubicacion: string;
  obra: string;
  motivo: MotivoAjuste | "";
  documento: string;
  usuario: string;
  fisico: number;
  reservado: number;
  enTransito: number;
  enObra: number;
  averiado: number;
}

export interface FiltroKardex {
  desde?: string;
  hasta?: string;
  tipo?: TipoMovimiento | "todos";
  articuloId?: string | "todos";
}

export function filasKardex(
  estado: EstadoApolo,
  filtro: FiltroKardex = {},
): FilaKardex[] {
  const articulos = new Map(estado.articulos.map((a) => [a.id, a]));
  const almacenes = new Map(estado.almacenes.map((a) => [a.id, a]));
  const ubicaciones = new Map(estado.ubicaciones.map((u) => [u.id, u]));
  const obras = new Map(estado.obras.map((o) => [o.id, o]));

  return estado.inventario.asientos
    .filter((a: Asiento) => {
      // El rango se compara sobre la fecha de CADA asiento, nunca sobre el
      // nombre del archivo ni el orden de la lista.
      if (filtro.desde && a.fecha.slice(0, 10) < filtro.desde) return false;
      if (filtro.hasta && a.fecha.slice(0, 10) > filtro.hasta) return false;
      if (filtro.tipo && filtro.tipo !== "todos" && a.tipo !== filtro.tipo) {
        return false;
      }
      if (
        filtro.articuloId &&
        filtro.articuloId !== "todos" &&
        a.articuloId !== filtro.articuloId
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .map((a) => {
      const articulo = articulos.get(a.articuloId);
      const ubicacion = ubicaciones.get(a.ubicacionId);
      return {
        id: a.id,
        fecha: a.fecha,
        tipo: a.tipo,
        codigoArticulo: articulo?.codigo ?? a.articuloId,
        descripcion: articulo?.descripcion ?? "",
        unidad: articulo?.unidadBase ?? "",
        almacen: almacenes.get(a.almacenId)?.nombre ?? a.almacenId,
        ubicacion: ubicacion ? `${ubicacion.pasillo}-${ubicacion.rack}` : "",
        obra: a.obraId ? (obras.get(a.obraId)?.codigo ?? a.obraId) : "",
        motivo: a.motivo ?? "",
        documento: a.documentoId ?? "",
        usuario: a.usuarioId,
        fisico: a.delta.fisico,
        reservado: a.delta.reservado,
        enTransito: a.delta.enTransito,
        enObra: a.delta.enObra,
        averiado: a.delta.averiado,
      };
    });
}

// ---------------------------------------------------------------------------
// Existencia valorizada
// ---------------------------------------------------------------------------

export interface FilaExistencia {
  id: string;
  codigo: string;
  descripcion: string;
  clase: string;
  unidad: string;
  almacen: string;
  ubicacion: string;
  fisico: number;
  reservado: number;
  disponible: number;
  enObra: number;
  averiado: number;
  costoUnitario: number;
  valorUsd: number;
}

/** Una fila por artículo Y ubicación: es el detalle que se lleva a un conteo. */
export function filasExistencia(estado: EstadoApolo): FilaExistencia[] {
  const articulos = new Map(estado.articulos.map((a) => [a.id, a]));
  const almacenes = new Map(estado.almacenes.map((a) => [a.id, a]));
  const ubicaciones = new Map(estado.ubicaciones.map((u) => [u.id, u]));

  const salida: FilaExistencia[] = [];
  for (const [clave, saldo] of estado.inventario.saldos) {
    const [articuloId, almacenId, ubicacionId] = clave.split("|");
    const articulo = articulos.get(articuloId);
    if (!articulo) continue;

    const disponible = saldo.fisico - saldo.reservado - saldo.averiado;
    const ubicacion = ubicaciones.get(ubicacionId);

    salida.push({
      id: clave,
      codigo: articulo.codigo,
      descripcion: articulo.descripcion,
      clase: articulo.clase,
      unidad: articulo.unidadBase,
      almacen: almacenes.get(almacenId)?.nombre ?? almacenId,
      ubicacion: ubicacion ? `${ubicacion.pasillo}-${ubicacion.rack}` : "",
      fisico: saldo.fisico,
      reservado: saldo.reservado,
      disponible,
      enObra: saldo.enObra,
      averiado: saldo.averiado,
      costoUnitario: articulo.costoPromedioUsd,
      valorUsd: disponible * articulo.costoPromedioUsd,
    });
  }

  return salida.sort((a, b) => b.valorUsd - a.valorUsd);
}

// ---------------------------------------------------------------------------
// Deuda de herramienta consolidada
// ---------------------------------------------------------------------------

export interface FilaDeuda {
  id: string;
  obra: string;
  nombreObra: string;
  codigo: string;
  descripcion: string;
  unidades: number;
  unidad: string;
  dias: number;
  valorUsd: number;
}

export function filasDeuda(estado: EstadoApolo, ahora: number): FilaDeuda[] {
  const salida: FilaDeuda[] = [];

  for (const obra of estado.obras) {
    for (const d of deudaDeObra(estado, obra.id, ahora)) {
      salida.push({
        id: `${obra.id}-${d.articulo.id}`,
        obra: obra.codigo,
        nombreObra: obra.nombre,
        codigo: d.articulo.codigo,
        descripcion: d.articulo.descripcion,
        unidades: d.unidades,
        unidad: d.articulo.unidadBase,
        dias: d.diasMax,
        valorUsd: d.valorUsd,
      });
    }
  }

  return salida.sort((a, b) => b.dias - a.dias);
}

// ---------------------------------------------------------------------------
// Despachos y entregas
// ---------------------------------------------------------------------------

export interface FilaDespacho {
  id: string;
  codigo: string;
  obra: string;
  estado: EstadoDespacho;
  transporte: TipoTransporte;
  responsable: string;
  unidades: number;
  renglones: number;
  creado: string;
  salida: string;
  entrega: string;
  receptor: string;
  ordenReceptor: string;
  verificada: string;
}

export function filasDespachos(estado: EstadoApolo): FilaDespacho[] {
  const obras = new Map(estado.obras.map((o) => [o.id, o]));
  const choferes = new Map(estado.choferes.map((c) => [c.id, c]));

  return [...estado.despachos]
    .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn))
    .map((d) => ({
      id: d.id,
      codigo: d.codigo,
      obra: obras.get(d.obraId)?.codigo ?? d.obraId,
      estado: d.estado,
      transporte: d.transporte,
      responsable:
        d.transporte === "flota"
          ? (choferes.get(d.choferId ?? "")?.nombre ?? "")
          : `${d.transportistaExterno ?? ""} ${d.guiaExterna ?? ""}`.trim(),
      unidades: totalUnidades(d),
      renglones: d.lineas.length,
      creado: d.creadoEn,
      salida: d.salidaEn ?? "",
      entrega: d.entregaEn ?? "",
      receptor: d.pod?.receptor ?? "",
      ordenReceptor: d.pod?.ordenReceptor ?? "",
      // Se exporta como texto legible: quien abre el Excel no lee booleanos.
      verificada: d.pod ? (d.pod.coincide ? "Sí" : "No") : "",
    }));
}
