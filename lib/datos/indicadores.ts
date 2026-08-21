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
 * Nivel acumulado de una magnitud del saldo a lo largo de los últimos asientos.
 *
 * EXISTE PORQUE LAS CHISPAS DEL PANEL MENTÍAN. Antes se dibujaba
 * `Math.abs(delta.fisico)` de los últimos doce movimientos, que no es una serie
 * temporal: es la MAGNITUD de movimientos sueltos, sin signo y sin acumular.
 * Una recepción de 400 y un despacho de 400 daban el mismo punto, y la curva
 * salía plana con un pico — que era exactamente lo que se veía en pantalla.
 *
 * Y la segunda tarjeta usaba esa misma serie INVERTIDA, o sea la misma curva en
 * espejo haciéndose pasar por la tendencia de otro indicador.
 *
 * Aquí se acumula el delta CON SIGNO en orden cronológico, así que el último
 * punto es el nivel de hoy y la pendiente dice si sube o baja. `medir` elige qué
 * magnitud del saldo se sigue, para que cada tarjeta grafique SU propio dato.
 */
export function serieAcumulada(
  estado: EstadoApolo,
  medir: (s: Readonly<Saldo>) => number,
  cortes = 12,
): number[] {
  // `movimientosRecientes` devuelve del más nuevo al más viejo; para acumular
  // hay que recorrerlo al revés, o la curva contaría la historia hacia atrás.
  const cronologico = [...movimientosRecientes(estado, cortes)].reverse();

  let nivel = 0;
  return cronologico.map((a) => {
    nivel += medir(a.delta);
    return nivel;
  });
}

/**
 * Entradas y salidas físicas agrupadas por mes.
 *
 * SE SEPARAN POR SIGNO, no se suman. El neto de un mes con 500 recibidos y 480
 * despachados es 20, y ese 20 no dice nada de la actividad del almacén: un mes
 * quieto y un mes frenético pueden dar el mismo neto. Lo que se compara es el
 * volumen de cada dirección.
 *
 * Las salidas se devuelven en POSITIVO para poder graficarlas como barra; el
 * signo ya lo lleva el nombre de la serie.
 */
export function movimientosPorMes(
  estado: EstadoApolo,
  meses = 6,
): { etiqueta: string; entradas: number; salidas: number }[] {
  const acumulado = new Map<string, { entradas: number; salidas: number }>();

  for (const a of estado.inventario.asientos) {
    // `fecha` es ISO, así que los diez primeros caracteres son la fecha y los
    // siete primeros el mes. Cortar la cadena evita construir un Date por
    // asiento y, sobre todo, evita que la zona horaria mueva un movimiento de
    // fin de mes al mes anterior.
    const mes = a.fecha.slice(0, 7);
    const acc = acumulado.get(mes) ?? { entradas: 0, salidas: 0 };
    if (a.delta.fisico >= 0) acc.entradas += a.delta.fisico;
    else acc.salidas += -a.delta.fisico;
    acumulado.set(mes, acc);
  }

  return [...acumulado.entries()]
    .sort((x, y) => x[0].localeCompare(y[0]))
    .slice(-meses)
    .map(([mes, v]) => ({ etiqueta: mes, ...v }));
}

/**
 * Material en obra por obra, con su peso sobre el total.
 *
 * El porcentaje es sobre el TOTAL EN OBRA, no sobre el inventario entero: la
 * pregunta que responde es "de lo que está fuera, cuánto tiene cada obra", y
 * mezclarlo con lo que sigue en almacén daría porcentajes que nunca suman 100.
 */
export function enObraPorObra(
  estado: EstadoApolo,
): { obraId: string; nombre: string; unidades: number; pct: number }[] {
  const porObra = new Map<string, number>();

  for (const a of estado.inventario.asientos) {
    if (!a.obraId || a.delta.enObra === 0) continue;
    porObra.set(a.obraId, (porObra.get(a.obraId) ?? 0) + a.delta.enObra);
  }

  const total = [...porObra.values()].reduce((s, v) => s + Math.max(0, v), 0);

  return [...porObra.entries()]
    .filter(([, v]) => v > 0)
    .sort((x, y) => y[1] - x[1])
    .map(([obraId, unidades]) => ({
      obraId,
      nombre: estado.obras.find((o) => o.id === obraId)?.nombre ?? obraId,
      unidades,
      // Sin total no hay porcentaje: devolver 0 es preferible a un NaN que se
      // cuela hasta la pantalla como "NaN%".
      pct: total > 0 ? (unidades / total) * 100 : 0,
    }));
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
