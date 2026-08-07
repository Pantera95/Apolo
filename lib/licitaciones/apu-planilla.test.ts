import { describe, expect, it } from "vitest";

import { COMPOSICIONES_DEMO } from "@/lib/licitaciones/composiciones";
import { calcularApu } from "@/lib/licitaciones/motor";
import { PARAMETROS_INICIALES, type Parametros, type RenglonMto } from "@/lib/licitaciones/tipos";

/**
 * El APU de la planilla del cliente, reproducido cifra por cifra.
 *
 * Esta suite es un CONTRATO CON EL FORMATO DEL CLIENTE, no una prueba del
 * motor en abstracto: si alguien cambia cómo se aplican el FAS o los recargos,
 * la oferta deja de cuadrar con la planilla que la operadora audita y aquí se
 * entera, no en la mesa de licitación.
 *
 * Referencia — ítem CIV-CON-04, vaciado de concreto f'c=280:
 *   Materiales 150,95 · Equipos 12,35 · M.O. directa 31,30 · FAS@110% 34,43
 *   Directo 229,03 · Indirectos 15% 34,35 · Imprevistos 5% 11,45
 *   Utilidad 10% 22,90 · PRECIO UNITARIO 297,73 USD/m³
 */

const RENGLON: RenglonMto = {
  id: "t",
  disciplina: "civil",
  codigo: "CIV-CON-04",
  descripcion: "Vaciado de concreto f'c=280 kg/cm² en fundaciones",
  especificacion: "f'c=280 kg/cm²",
  unidad: "m³",
  cantidadBase: 1_500,
  // Cero: la merma ya va dentro de los coeficientes de la composición (1,05
  // m³ de premezclado por cada m³ de obra). Aplicar además el desperdicio
  // global la contaría dos veces.
  factorDesperdicio: 0,
  costoMaterialUsd: 0,
  rendimientoHh: 0,
  costoEquipoUsd: 0,
  composicion: COMPOSICIONES_DEMO["CIV-CON-04"],
};

const P: Parametros = { ...PARAMETROS_INICIALES, desperdicioPorDefecto: 0 };

const suma = (l: { costoUsd: number }[]) => l.reduce((s, i) => s + i.costoUsd, 0);

describe("APU contra la planilla del cliente", () => {
  const apu = calcularApu(RENGLON, P);
  const g = apu.desglose;

  it("reproduce el subtotal de materiales", () => {
    expect(suma(g.materiales)).toBeCloseTo(150.95, 2);
  });

  it("reproduce la mano de obra directa y el FAS al 110%", () => {
    expect(g.manoObraDirectaUsd).toBeCloseTo(31.3, 2);
    expect(g.fasUsd).toBeCloseTo(34.43, 2);
    expect(g.manoObraCargadaUsd).toBeCloseTo(65.73, 2);
  });

  /**
   * La única línea de la planilla que NO reconcilia.
   *
   * El original declara "Herramientas Menores (% M.O.) · 5,0000 %" y luego
   * escribe 1,85 — pero el 5% de la mano de obra directa (31,30) son 1,57, y
   * el 5% de la cargada (65,73) son 3,29. El 1,85 sería el 5% de 37,00, cifra
   * que no aparece en ninguna parte del documento.
   *
   * Apolo calcula el porcentaje declarado en vez de copiar el número, porque
   * un APU cuyo total no se deriva de sus propias líneas es exactamente lo que
   * un auditor de la operadora devuelve. La diferencia son 28 centavos por m³.
   */
  it("calcula las herramientas menores como el % declarado, no como el número impreso", () => {
    const herramientas = g.equipos.find((l) => l.esPorcentaje);
    expect(herramientas?.costoUsd).toBeCloseTo(1.565, 3);
    expect(suma(g.equipos)).toBeCloseTo(12.065, 2);
  });

  it("llega a un precio unitario a 36 céntimos del de la planilla", () => {
    // 297,37 contra 297,73. La diferencia NO es ruido de redondeo: son los
    // 0,285 USD de la línea de herramientas, propagados por el 30% de recargo
    // (0,285 × 1,30 = 0,37). Todo lo demás cuadra al céntimo.
    expect(apu.precioUnitarioUsd).toBeCloseTo(297.37, 2);
    // La brecha es la línea de herramientas propagada por el 30% de recargo.
    // No coincide al céntimo con 0,285 × 1,30 porque el 297,73 de la planilla
    // viene ya redondeado desde 297,739.
    const brecha = 297.73 - apu.precioUnitarioUsd;
    expect(brecha).toBeCloseTo(0.36, 2);
    expect(Math.abs(brecha - (1.85 - 1.565) * 1.3)).toBeLessThan(0.01);
  });

  it("aplica los tres recargos sobre el costo directo, no en cascada", () => {
    const directo = apu.costoDirectoUsd / apu.cantidadFinal;
    expect(apu.indirectosUsd / apu.cantidadFinal).toBeCloseTo(directo * 0.15, 4);
    expect(apu.imprevistosUsd / apu.cantidadFinal).toBeCloseTo(directo * 0.05, 4);
    expect(apu.utilidadUsd / apu.cantidadFinal).toBeCloseTo(directo * 0.1, 4);
  });

  /**
   * Los dos modos NO son equivalentes, y la diferencia paga sueldos.
   *
   * Con 15/5/10 el aditivo recarga un 30,0% y el cascada un 32,825%. Sobre
   * este renglón de 1.500 m³ son casi 10.000 USD. Por eso es un parámetro
   * visible y no una decisión escondida en el motor.
   */
  it("el modo cascada da un 2,8% más que el aditivo", () => {
    const cascada = calcularApu(RENGLON, { ...P, modoMarkup: "cascada" });
    const razon = cascada.totalUsd / apu.totalUsd;
    expect(razon).toBeCloseTo(1.32825 / 1.3, 4);
    expect(cascada.totalUsd - apu.totalUsd).toBeGreaterThan(9_000);
  });

  it("las HH salen de sumar la cuadrilla, no de un promedio", () => {
    // 0,10 capataz + 0,80 oficial + 1,20 ayudante = 2,10 HH por m³.
    expect(apu.horasHombre / apu.cantidadFinal).toBeCloseTo(2.1, 4);
  });
});

describe("renglones sin composición", () => {
  const sinComposicion: RenglonMto = {
    ...RENGLON,
    composicion: undefined,
    costoMaterialUsd: 118,
    rendimientoHh: 2.4,
    costoEquipoUsd: 14,
  };

  it("emite el APU igual, pero declarándolo agregado", () => {
    const apu = calcularApu(sinComposicion, P);
    // Marcarlo importa: el documento tiene que decir que el desglose no vino
    // del origen, en vez de aparentar un detalle que nadie cargó.
    expect(apu.desglose.detallado).toBe(false);
    expect(apu.precioUnitarioUsd).toBeGreaterThan(0);
  });

  it("no inventa una cuadrilla: usa el rendimiento agregado", () => {
    const apu = calcularApu(sinComposicion, P);
    expect(apu.horasHombre / apu.cantidadFinal).toBeCloseTo(2.4, 4);
    expect(apu.desglose.manoObra).toHaveLength(1);
  });
});
