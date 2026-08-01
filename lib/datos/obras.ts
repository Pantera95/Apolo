/**
 * Vistas por obra.
 *
 * Aquí se junta todo: la obra es el centro del dominio, así que esta es la
 * pantalla que responde a la pregunta que trajo al cliente — *¿qué le he
 * mandado a esta obra y qué me tiene que devolver?*
 *
 * El saldo agregado sabe cuánto material está "en obra", pero no en CUÁL. Ese
 * desglose solo existe en el kardex, porque cada asiento guarda su obra.
 */

import type { EstadoApolo } from "@/lib/db/almacen";
import type { Articulo, Obra } from "@/lib/dominio/tipos";
import type { Solicitud } from "@/lib/dominio/despacho";
import { esTerminal } from "@/lib/dominio/despacho";
import type { Despacho } from "@/lib/dominio/entrega";

const DIA_MS = 86_400_000;

function indice(estado: EstadoApolo): Map<string, Articulo> {
  return new Map(estado.articulos.map((a) => [a.id, a]));
}

export interface RenglonObra {
  articulo: Articulo;
  unidades: number;
  valorUsd: number;
}

/**
 * Qué tiene esta obra encima, artículo por artículo.
 * Se reconstruye sumando los movimientos de `enObra` de su kardex.
 */
export function materialDeObra(
  estado: EstadoApolo,
  obraId: string,
): RenglonObra[] {
  const articulos = indice(estado);
  const acumulado = new Map<string, number>();

  for (const a of estado.inventario.asientos) {
    if (a.obraId !== obraId || a.delta.enObra === 0) continue;
    acumulado.set(
      a.articuloId,
      (acumulado.get(a.articuloId) ?? 0) + a.delta.enObra,
    );
  }

  const salida: RenglonObra[] = [];
  for (const [articuloId, unidades] of acumulado) {
    const articulo = articulos.get(articuloId);
    if (!articulo || unidades <= 0) continue;
    salida.push({
      articulo,
      unidades,
      valorUsd: unidades * articulo.costoPromedioUsd,
    });
  }

  return salida.sort((a, b) => b.valorUsd - a.valorUsd);
}

export interface DeudaObra extends RenglonObra {
  /** Días desde la entrega más antigua que sigue sin volver. */
  diasMax: number;
  almacenId: string;
  ubicacionId: string;
}

/**
 * Deuda de herramienta de una obra: lo retornable que salió y no ha vuelto.
 *
 * La antigüedad se calcula por FIFO — los retornos se descuentan contra las
 * entregas más viejas — porque si no, una herramienta prestada hace meses
 * parecería reciente en cuanto vuelva otra unidad cualquiera.
 */
export function deudaDeObra(
  estado: EstadoApolo,
  obraId: string,
  ahora: number,
): DeudaObra[] {
  const articulos = indice(estado);

  const entregas = new Map<string, { fecha: string; unidades: number }[]>();
  const retornos = new Map<string, number>();
  const ubicacion = new Map<string, { almacenId: string; ubicacionId: string }>();

  for (const a of estado.inventario.asientos) {
    if (a.obraId !== obraId) continue;
    if (articulos.get(a.articuloId)?.clase !== "retornable") continue;

    if (a.delta.enObra > 0) {
      const lista = entregas.get(a.articuloId) ?? [];
      lista.push({ fecha: a.fecha, unidades: a.delta.enObra });
      entregas.set(a.articuloId, lista);
      // De dónde salió es a dónde debe volver.
      ubicacion.set(a.articuloId, {
        almacenId: a.almacenId,
        ubicacionId: a.ubicacionId,
      });
    } else if (a.delta.enObra < 0) {
      retornos.set(
        a.articuloId,
        (retornos.get(a.articuloId) ?? 0) + Math.abs(a.delta.enObra),
      );
    }
  }

  const salida: DeudaObra[] = [];
  for (const [articuloId, lista] of entregas) {
    const articulo = articulos.get(articuloId);
    const donde = ubicacion.get(articuloId);
    if (!articulo || !donde) continue;

    let porDescontar = retornos.get(articuloId) ?? 0;
    let pendientes = 0;
    let masVieja: string | null = null;

    for (const entrega of [...lista].sort((a, b) => a.fecha.localeCompare(b.fecha))) {
      const consumido = Math.min(porDescontar, entrega.unidades);
      porDescontar -= consumido;
      const restante = entrega.unidades - consumido;
      if (restante <= 0) continue;
      pendientes += restante;
      masVieja ??= entrega.fecha;
    }

    if (pendientes <= 0) continue;

    salida.push({
      articulo,
      unidades: pendientes,
      valorUsd: pendientes * articulo.costoPromedioUsd,
      diasMax:
        ahora > 0 && masVieja
          ? Math.max(0, Math.floor((ahora - Date.parse(masVieja)) / DIA_MS))
          : 0,
      ...donde,
    });
  }

  return salida.sort((a, b) => b.diasMax - a.diasMax);
}

/** Cuántas unidades de un artículo puede devolver ESTA obra, y no otra. */
export function puedeRetornar(
  estado: EstadoApolo,
  obraId: string,
  articuloId: string,
  ahora: number,
): number {
  return (
    deudaDeObra(estado, obraId, ahora).find((d) => d.articulo.id === articuloId)
      ?.unidades ?? 0
  );
}

export function solicitudesDeObra(
  estado: EstadoApolo,
  obraId: string,
): Solicitud[] {
  return estado.solicitudes
    .filter((s) => s.obraId === obraId)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export function despachosDeObra(estado: EstadoApolo, obraId: string): Despacho[] {
  return estado.despachos
    .filter((d) => d.obraId === obraId)
    .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
}

export interface ResumenObra {
  obra: Obra;
  valorEnObra: number;
  renglones: number;
  deudaUnidades: number;
  deudaValorUsd: number;
  deudaDiasMax: number;
  solicitudesAbiertas: number;
  despachos: number;
}

export function resumenObras(estado: EstadoApolo, ahora: number): ResumenObra[] {
  return estado.obras
    .map((obra) => {
      const material = materialDeObra(estado, obra.id);
      const deuda = deudaDeObra(estado, obra.id, ahora);
      return {
        obra,
        valorEnObra: material.reduce((s, m) => s + m.valorUsd, 0),
        renglones: material.length,
        deudaUnidades: deuda.reduce((s, d) => s + d.unidades, 0),
        deudaValorUsd: deuda.reduce((s, d) => s + d.valorUsd, 0),
        deudaDiasMax: deuda.reduce((m, d) => Math.max(m, d.diasMax), 0),
        solicitudesAbiertas: solicitudesDeObra(estado, obra.id).filter(
          (s) => !esTerminal(s.estado),
        ).length,
        despachos: despachosDeObra(estado, obra.id).length,
      };
    })
    .sort((a, b) => b.valorEnObra - a.valorEnObra);
}
