import { describe, expect, it } from "vitest";

import {
  saludGlobal,
  saludPorFamilia,
  type Familia,
  type IndicadorFinanciero,
  type Veredicto,
} from "@/lib/dashboard/finanzas";

/**
 * La salud que alimenta el anillo y las barras del panel Premium.
 *
 * Se prueba porque el error posible aquí no es un fallo, es una CALUMNIA: si el
 * denominador incluye los indicadores sin cifras, no haber importado el balance
 * se dibuja como "la empresa va mal".
 */

const ind = (familia: Familia, veredicto: Veredicto): IndicadorFinanciero =>
  ({
    id: `${familia}-${veredicto}-${Math.random()}`,
    nombre: "x",
    familia,
    formula: "x",
    unidad: "razon",
    origen: "declarado",
    valor: veredicto === "sin-datos" ? null : 1,
    veredicto,
    lectura: "",
    falta: [],
  }) as IndicadorFinanciero;

describe("saludPorFamilia", () => {
  it("calcula sobre los indicadores CON datos, no sobre todos", () => {
    const r = saludPorFamilia([
      ind("liquidez", "bueno"),
      ind("liquidez", "malo"),
      // Este no debe contar como fallo: no se sabe.
      ind("liquidez", "sin-datos"),
    ]);
    const liq = r.find((x) => x.familia === "liquidez")!;
    expect(liq.conDatos).toBe(2);
    expect(liq.pct).toBe(50);
  });

  it("aceptable no es bueno", () => {
    const r = saludPorFamilia([ind("gestion", "aceptable"), ind("gestion", "bueno")]);
    expect(r.find((x) => x.familia === "gestion")!.pct).toBe(50);
  });

  /** Un anillo a 0 afirma que nada va bien; `null` dice que no se sabe. */
  it("sin indicadores medibles devuelve null, nunca cero", () => {
    const r = saludPorFamilia([ind("rentabilidad", "sin-datos")]);
    expect(r.find((x) => x.familia === "rentabilidad")!.pct).toBeNull();
  });

  it("devuelve siempre las cuatro familias, aunque estén vacías", () => {
    expect(saludPorFamilia([]).map((x) => x.familia)).toEqual([
      "liquidez",
      "endeudamiento",
      "rentabilidad",
      "gestion",
    ]);
  });
});

describe("saludGlobal", () => {
  it("agrega el conjunto con el mismo criterio", () => {
    const r = saludGlobal([
      ind("liquidez", "bueno"),
      ind("gestion", "bueno"),
      ind("gestion", "malo"),
      ind("rentabilidad", "sin-datos"),
    ]);
    expect(r).toEqual({ buenos: 2, conDatos: 3, pct: (2 / 3) * 100 });
  });

  it("sin datos, null", () => {
    expect(saludGlobal([]).pct).toBeNull();
  });
});
