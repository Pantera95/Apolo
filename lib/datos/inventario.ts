/**
 * Vistas de inventario. Funciones puras: agregan los saldos por artículo y por
 * ubicación sin tocar el estado ni recalcular nada que el kardex ya sepa.
 */

import type { EstadoApolo } from "@/lib/db/almacen";
import type {
  Almacen,
  Articulo,
  Asiento,
  ClaseArticulo,
  Saldo,
  Ubicacion,
} from "@/lib/dominio/tipos";
import { disponible, SALDO_CERO } from "@/lib/dominio/tipos";

export interface FilaInventario {
  articulo: Articulo;
  saldo: Saldo;
  disponible: number;
  valorUsd: number;
  /** En cuántas ubicaciones distintas hay existencia física. */
  ubicaciones: number;
}

function sumar(a: Saldo, b: Saldo): Saldo {
  return {
    fisico: a.fisico + b.fisico,
    reservado: a.reservado + b.reservado,
    averiado: a.averiado + b.averiado,
    enTransito: a.enTransito + b.enTransito,
    enObra: a.enObra + b.enObra,
  };
}

export interface FiltroInventario {
  texto?: string;
  clase?: ClaseArticulo | "todas";
  almacenId?: string | "todos";
}

/**
 * Una fila por artículo, agregando todas sus ubicaciones.
 *
 * Se listan TODOS los artículos del catálogo, también los que están en cero:
 * un artículo que desaparece de la lista cuando se agota es justo el que
 * alguien necesita encontrar para reponerlo.
 */
export function filasInventario(
  estado: EstadoApolo,
  filtro: FiltroInventario = {},
): FilaInventario[] {
  const acumulado = new Map<string, { saldo: Saldo; ubicaciones: Set<string> }>();

  for (const [clave, saldo] of estado.inventario.saldos) {
    const [articuloId, almacenId, ubicacionId] = clave.split("|");
    if (
      filtro.almacenId &&
      filtro.almacenId !== "todos" &&
      almacenId !== filtro.almacenId
    ) {
      continue;
    }
    const actual = acumulado.get(articuloId) ?? {
      saldo: { ...SALDO_CERO },
      ubicaciones: new Set<string>(),
    };
    actual.saldo = sumar(actual.saldo, saldo);
    if (saldo.fisico > 0) actual.ubicaciones.add(`${almacenId}|${ubicacionId}`);
    acumulado.set(articuloId, actual);
  }

  const texto = filtro.texto?.trim().toLowerCase();

  return estado.articulos
    .filter((a) => {
      if (filtro.clase && filtro.clase !== "todas" && a.clase !== filtro.clase) {
        return false;
      }
      if (texto) {
        const heno = `${a.codigo} ${a.descripcion}`.toLowerCase();
        if (!heno.includes(texto)) return false;
      }
      // Al filtrar por almacén solo tienen sentido los artículos que existen
      // allí; sin filtro, se muestran todos aunque estén en cero.
      if (filtro.almacenId && filtro.almacenId !== "todos") {
        return acumulado.has(a.id);
      }
      return true;
    })
    .map((articulo) => {
      const agregado = acumulado.get(articulo.id);
      const saldo = agregado?.saldo ?? { ...SALDO_CERO };
      return {
        articulo,
        saldo,
        disponible: disponible(saldo),
        valorUsd: disponible(saldo) * articulo.costoPromedioUsd,
        ubicaciones: agregado?.ubicaciones.size ?? 0,
      };
    });
}

export interface SaldoUbicado {
  almacen: Almacen | undefined;
  ubicacion: Ubicacion | undefined;
  saldo: Saldo;
  disponible: number;
}

export function saldosPorUbicacion(
  estado: EstadoApolo,
  articuloId: string,
): SaldoUbicado[] {
  const almacenes = new Map(estado.almacenes.map((a) => [a.id, a]));
  const ubicaciones = new Map(estado.ubicaciones.map((u) => [u.id, u]));

  const salida: SaldoUbicado[] = [];
  for (const [clave, saldo] of estado.inventario.saldos) {
    const [id, almacenId, ubicacionId] = clave.split("|");
    if (id !== articuloId) continue;
    salida.push({
      almacen: almacenes.get(almacenId),
      ubicacion: ubicaciones.get(ubicacionId),
      saldo,
      disponible: disponible(saldo),
    });
  }

  return salida.sort(
    (a, b) => (a.ubicacion?.ordenRecorrido ?? 0) - (b.ubicacion?.ordenRecorrido ?? 0),
  );
}

/** Kardex completo de un artículo, del movimiento más reciente al más viejo. */
export function kardexDe(estado: EstadoApolo, articuloId: string): Asiento[] {
  return estado.inventario.asientos
    .filter((a) => a.articuloId === articuloId)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export function totalInventario(filas: FilaInventario[]): number {
  return filas.reduce((s, f) => s + f.valorUsd, 0);
}
