import { describe, expect, it } from "vitest";

import { aUnidadBase, UNIDADES, unidad } from "./unidades";
import type { Articulo } from "./tipos";

function articulo(over: Partial<Articulo> = {}): Articulo {
  return {
    id: "art-1",
    codigo: "TOR-3/8",
    descripcion: "Tornillo galvanizado 3/8",
    clase: "consumible",
    unidadBase: "und",
    costoPromedioUsd: 0.4,
    activo: true,
    ...over,
  };
}

describe("catálogo de unidades", () => {
  it("no tiene códigos repetidos", () => {
    const codigos = UNIDADES.map((u) => u.codigo);
    expect(new Set(codigos).size).toBe(codigos.length);
  });

  it("toda unidad tiene nombre en los dos idiomas", () => {
    for (const u of UNIDADES) {
      expect(u.es.length).toBeGreaterThan(0);
      expect(u.en.length).toBeGreaterThan(0);
    }
  });

  it("las unidades de empaque no traen factor fijo", () => {
    // "1 caja" no significa nada hasta que un artículo declare su contenido.
    expect(unidad("caja")?.factorCanonico).toBeUndefined();
    expect(unidad("saco")?.factorCanonico).toBeUndefined();
  });
});

describe("conversión a unidad base", () => {
  it("deja igual lo que ya viene en unidad base", () => {
    const r = aUnidadBase(articulo(), 250, "und");
    expect(r.ok && r.valor).toBe(250);
  });

  it("usa la equivalencia declarada por el artículo", () => {
    const art = articulo({ equivalencias: { caja: 100 } });
    const r = aUnidadBase(art, 3, "caja");
    expect(r.ok && r.valor).toBe(300);
  });

  it("la equivalencia del artículo manda sobre la tabla genérica", () => {
    // Un saco de cemento pesa 42.5 kg: eso lo declara el artículo, no una tabla.
    const cemento = articulo({
      codigo: "CEM-GRIS",
      unidadBase: "kg",
      equivalencias: { saco: 42.5 },
    });
    const r = aUnidadBase(cemento, 4, "saco");
    expect(r.ok && r.valor).toBe(170);
  });

  it("convierte entre unidades de la misma dimensión física", () => {
    const acero = articulo({ codigo: "VIG-H", unidadBase: "kg" });
    const r = aUnidadBase(acero, 2, "ton");
    expect(r.ok && r.valor).toBe(2000);
  });

  it("convierte longitudes imperiales a métricas", () => {
    const cable = articulo({ codigo: "CAB-2/0", unidadBase: "m" });
    const r = aUnidadBase(cable, 100, "pie");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor).toBeCloseTo(30.48, 6);
  });

  it("falla explícitamente si la equivalencia no está declarada", () => {
    // No se adivina: "3 cajas de tornillos" sin saber cuántos trae la caja es
    // exactamente el dato que produce un descuadre imposible de rastrear.
    const r = aUnidadBase(articulo(), 3, "caja");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("UNIDAD_NO_DECLARADA");
  });

  it("no cruza dimensiones incompatibles", () => {
    const r = aUnidadBase(articulo({ unidadBase: "kg" }), 5, "m");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("UNIDAD_NO_DECLARADA");
  });

  it("rechaza cantidades no numéricas", () => {
    const r = aUnidadBase(articulo(), Number.NaN, "und");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("CANTIDAD_INVALIDA");
  });
});
