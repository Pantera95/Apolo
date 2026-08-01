/**
 * Unidades de medida y conversión.
 *
 * Regla dura: los movimientos SIEMPRE se guardan en la unidad base del
 * artículo. La UI puede capturar en cualquier unidad declarada, pero el kardex
 * no. Sin esto, un "50" en el histórico no significa nada — ¿50 sacos o 50 kg?
 */

import type { Articulo, CodigoUnidad, Resultado } from "./tipos";
import { fallo, ok } from "./tipos";

export type Dimension =
  | "conteo"
  | "longitud"
  | "area"
  | "volumen"
  | "masa"
  | "empaque";

export interface Unidad {
  codigo: CodigoUnidad;
  es: string;
  en: string;
  dimension: Dimension;
  /**
   * Factor hacia la unidad canónica de su dimensión (und, m, m2, m3, kg).
   * Las unidades de empaque no lo tienen: "1 caja" no significa nada hasta que
   * un artículo declare cuántas unidades base contiene.
   */
  factorCanonico?: number;
}

export const UNIDADES: readonly Unidad[] = [
  // Conteo
  { codigo: "und", es: "Unidad", en: "Unit", dimension: "conteo", factorCanonico: 1 },
  { codigo: "par", es: "Par", en: "Pair", dimension: "conteo", factorCanonico: 2 },
  { codigo: "juego", es: "Juego", en: "Set", dimension: "empaque" },

  // Empaque: sin factor fijo, cada artículo declara el suyo.
  { codigo: "caja", es: "Caja", en: "Box", dimension: "empaque" },
  { codigo: "paquete", es: "Paquete", en: "Pack", dimension: "empaque" },
  { codigo: "saco", es: "Saco", en: "Sack", dimension: "empaque" },
  { codigo: "bolsa", es: "Bolsa", en: "Bag", dimension: "empaque" },
  { codigo: "rollo", es: "Rollo", en: "Roll", dimension: "empaque" },
  { codigo: "cunete", es: "Cuñete", en: "Pail", dimension: "empaque" },
  { codigo: "tambor", es: "Tambor", en: "Drum", dimension: "empaque" },
  { codigo: "lamina", es: "Lámina", en: "Sheet", dimension: "empaque" },
  { codigo: "barra", es: "Barra", en: "Bar", dimension: "empaque" },
  { codigo: "tubo", es: "Tubo", en: "Pipe", dimension: "empaque" },

  // Longitud
  { codigo: "m", es: "Metro", en: "Meter", dimension: "longitud", factorCanonico: 1 },
  { codigo: "pie", es: "Pie", en: "Foot", dimension: "longitud", factorCanonico: 0.3048 },
  { codigo: "pulg", es: "Pulgada", en: "Inch", dimension: "longitud", factorCanonico: 0.0254 },

  // Área y volumen
  { codigo: "m2", es: "Metro cuadrado", en: "Square meter", dimension: "area", factorCanonico: 1 },
  { codigo: "m3", es: "Metro cúbico", en: "Cubic meter", dimension: "volumen", factorCanonico: 1 },
  { codigo: "l", es: "Litro", en: "Liter", dimension: "volumen", factorCanonico: 0.001 },
  { codigo: "ml", es: "Mililitro", en: "Milliliter", dimension: "volumen", factorCanonico: 0.000001 },
  { codigo: "gal", es: "Galón", en: "Gallon", dimension: "volumen", factorCanonico: 0.00378541 },

  // Masa
  { codigo: "kg", es: "Kilogramo", en: "Kilogram", dimension: "masa", factorCanonico: 1 },
  { codigo: "g", es: "Gramo", en: "Gram", dimension: "masa", factorCanonico: 0.001 },
  { codigo: "ton", es: "Tonelada", en: "Metric ton", dimension: "masa", factorCanonico: 1000 },
  { codigo: "lb", es: "Libra", en: "Pound", dimension: "masa", factorCanonico: 0.45359237 },
] as const;

const PORCODIGO = new Map(UNIDADES.map((u) => [u.codigo, u]));

export function unidad(codigo: CodigoUnidad): Unidad | undefined {
  return PORCODIGO.get(codigo);
}

/**
 * Convierte una cantidad capturada en `desde` a la unidad base del artículo.
 *
 * Orden de resolución, y el orden importa:
 *   1. Si ya viene en la unidad base, no se toca.
 *   2. Si el artículo declaró una equivalencia explícita, manda esa. Un artículo
 *      puede decir "1 saco = 42.5 kg" y eso pisa cualquier tabla genérica.
 *   3. Si ambas unidades comparten dimensión física, se usa el factor canónico.
 *   4. Si no, es un ERROR EXPLÍCITO. No se adivina.
 */
export function aUnidadBase(
  articulo: Articulo,
  cantidad: number,
  desde: CodigoUnidad,
): Resultado<number> {
  if (!Number.isFinite(cantidad)) {
    return fallo("CANTIDAD_INVALIDA", `Cantidad no numérica: ${cantidad}`);
  }

  if (desde === articulo.unidadBase) return ok(cantidad);

  const declarada = articulo.equivalencias?.[desde];
  if (typeof declarada === "number" && declarada > 0) {
    return ok(cantidad * declarada);
  }

  const uDesde = PORCODIGO.get(desde);
  const uBase = PORCODIGO.get(articulo.unidadBase);
  if (
    uDesde?.factorCanonico !== undefined &&
    uBase?.factorCanonico !== undefined &&
    uDesde.dimension === uBase.dimension
  ) {
    return ok((cantidad * uDesde.factorCanonico) / uBase.factorCanonico);
  }

  return fallo(
    "UNIDAD_NO_DECLARADA",
    `El artículo ${articulo.codigo} no declara equivalencia de "${desde}" a "${articulo.unidadBase}"`,
  );
}
