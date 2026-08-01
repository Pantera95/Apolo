/**
 * Indicadores derivados del estado. Funciones puras y testeables: ninguna
 * pantalla calcula cifras por su cuenta, así dos vistas no pueden mostrar
 * números distintos del mismo dato.
 */

import type { EstadoApolo } from "@/lib/db/almacen";
import type { Articulo, Asiento, Saldo } from "@/lib/dominio/tipos";
import { disponible } from "@/lib/dominio/tipos";
import type { Solicitud } from "@/lib/dominio/despacho";

function porArticulo(estado: EstadoApolo): Map<string, Articulo> {
  return new Map(estado.articulos.map((a) => [a.id, a]));
}

/** La clave del saldo es "articulo|almacen|ubicacion". */
function articuloDeClave(clave: string): string {
  return clave.split("|")[0];
}

function acumular(
  estado: EstadoApolo,
  campo: (s: Saldo) => number,
  filtro?: (a: Articulo) => boolean,
): { unidades: number; valorUsd: number } {
  const articulos = porArticulo(estado);
  let unidades = 0;
  let valorUsd = 0;

  for (const [clave, saldo] of estado.inventario.saldos) {
    const articulo = articulos.get(articuloDeClave(clave));
    if (!articulo) continue;
    if (filtro && !filtro(articulo)) continue;
    const cantidad = campo(saldo);
    unidades += cantidad;
    valorUsd += cantidad * articulo.costoPromedioUsd;
  }

  return { unidades, valorUsd };
}

/** Existencia realmente comprometible, valorizada al costo promedio. */
export function valorDisponible(estado: EstadoApolo): number {
  return acumular(estado, disponible).valorUsd;
}

/** Material que ya salió del almacén y todavía no se consumió. */
export function valorEnObra(estado: EstadoApolo): number {
  return acumular(estado, (s) => s.enObra).valorUsd;
}

/**
 * La deuda de herramienta: unidades retornables que están en obra y no han
 * vuelto. Es el indicador que responde al dolor declarado por el cliente.
 */
export function herramientaSinRetornar(estado: EstadoApolo): {
  unidades: number;
  valorUsd: number;
} {
  return acumular(estado, (s) => s.enObra, (a) => a.clase === "retornable");
}

/** Herramienta que volvió rota: no cuenta como disponible. */
export function herramientaAveriada(estado: EstadoApolo): {
  unidades: number;
  valorUsd: number;
} {
  return acumular(estado, (s) => s.averiado, (a) => a.clase === "retornable");
}

/** Solicitudes bloqueadas esperando que alguien autorice. */
export function solicitudesPorAprobar(estado: EstadoApolo): Solicitud[] {
  return estado.solicitudes.filter((s) => s.estado === "solicitada");
}

export function movimientosRecientes(estado: EstadoApolo, cuantos = 8): Asiento[] {
  return [...estado.inventario.asientos]
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, cuantos);
}

/**
 * Artículos cuya existencia disponible quedó por debajo del umbral.
 * PROVISIONAL: el umbral real lo define el cliente por artículo; mientras
 * tanto se usa una fracción de lo recibido para que la alerta exista.
 */
export function bajoMinimo(
  estado: EstadoApolo,
  umbralRelativo = 0.25,
): { articulo: Articulo; disponible: number; recibido: number }[] {
  const articulos = porArticulo(estado);
  const recibidoPorArticulo = new Map<string, number>();

  for (const asiento of estado.inventario.asientos) {
    if (asiento.tipo !== "recepcion") continue;
    recibidoPorArticulo.set(
      asiento.articuloId,
      (recibidoPorArticulo.get(asiento.articuloId) ?? 0) + asiento.delta.fisico,
    );
  }

  const disponiblePorArticulo = new Map<string, number>();
  for (const [clave, saldo] of estado.inventario.saldos) {
    const id = articuloDeClave(clave);
    disponiblePorArticulo.set(
      id,
      (disponiblePorArticulo.get(id) ?? 0) + disponible(saldo),
    );
  }

  const salida: { articulo: Articulo; disponible: number; recibido: number }[] = [];
  for (const [id, recibido] of recibidoPorArticulo) {
    const articulo = articulos.get(id);
    if (!articulo || recibido <= 0) continue;
    const disp = disponiblePorArticulo.get(id) ?? 0;
    if (disp < recibido * umbralRelativo) {
      salida.push({ articulo, disponible: disp, recibido });
    }
  }

  return salida.sort((a, b) => a.disponible / a.recibido - b.disponible / b.recibido);
}

// ---------------------------------------------------------------------------
// Formato
// ---------------------------------------------------------------------------

/**
 * Los montos se muestran sin decimales: en un panel operativo los centavos son
 * ruido, y con miles de líneas la columna se vuelve ilegible.
 */
export function dinero(usd: number, idioma: "es" | "en" = "es"): string {
  return new Intl.NumberFormat(idioma === "es" ? "es-VE" : "en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(usd);
}

/**
 * Versión compacta para ejes de gráfico: "60 mil" en vez de "USD 60.000".
 * En un eje no hay sitio para la cifra completa, y el valor exacto ya lo da
 * el tooltip al pasar por encima.
 */
export function dineroCompacto(usd: number, idioma: "es" | "en" = "es"): string {
  return new Intl.NumberFormat(idioma === "es" ? "es-VE" : "en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(usd);
}

export function numero(n: number, idioma: "es" | "en" = "es"): string {
  return new Intl.NumberFormat(idioma === "es" ? "es-VE" : "en-US", {
    maximumFractionDigits: 2,
  }).format(n);
}
