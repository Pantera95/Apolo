import { describe, expect, it } from "vitest";

import {
  filasDeuda,
  filasDespachos,
  filasExistencia,
  filasKardex,
} from "./reportes";
import { construirSemilla } from "./semilla";
import { valorDisponible } from "./indicadores";
import { ESTADO_APOLO_VACIO } from "@/lib/db/almacen";

const AHORA_FECHA = new Date("2026-08-01T12:00:00.000Z");
const AHORA = AHORA_FECHA.getTime();
const estado = construirSemilla(AHORA_FECHA);

describe("kardex", () => {
  it("resuelve códigos y nombres, no identificadores", () => {
    // Lo abre una persona en Excel: "art-13" no le dice nada.
    const [fila] = filasKardex(estado);
    expect(fila.codigoArticulo).not.toMatch(/^art-/);
    expect(fila.almacen).not.toMatch(/^alm-/);
    if (fila.obra) expect(fila.obra).not.toMatch(/^obr-/);
  });

  it("viene del movimiento más reciente al más antiguo", () => {
    const filas = filasKardex(estado);
    for (let i = 1; i < filas.length; i++) {
      expect(filas[i - 1].fecha >= filas[i].fecha).toBe(true);
    }
  });

  it("filtra por tipo de movimiento", () => {
    const ajustes = filasKardex(estado, { tipo: "ajuste" });
    expect(ajustes.length).toBeGreaterThan(0);
    expect(ajustes.every((f) => f.tipo === "ajuste")).toBe(true);
  });

  it("filtra por artículo", () => {
    const filas = filasKardex(estado, { articuloId: "art-13" });
    expect(filas.length).toBeGreaterThan(0);
    expect(filas.every((f) => f.codigoArticulo === "LLA-C14")).toBe(true);
  });

  it("el rango de fechas se aplica a la fecha de CADA asiento", () => {
    // La trampa clásica es filtrar por el archivo o por el orden de la lista.
    const desde = "2026-07-01";
    const filas = filasKardex(estado, { desde });
    expect(filas.length).toBeGreaterThan(0);
    expect(filas.every((f) => f.fecha.slice(0, 10) >= desde)).toBe(true);

    const hasta = "2026-06-01";
    const viejas = filasKardex(estado, { hasta });
    expect(viejas.every((f) => f.fecha.slice(0, 10) <= hasta)).toBe(true);
  });

  it("un rango imposible devuelve vacío, no todo", () => {
    expect(
      filasKardex(estado, { desde: "2030-01-01", hasta: "2030-01-02" }),
    ).toEqual([]);
  });

  it("los ajustes conservan su motivo", () => {
    const conMotivo = filasKardex(estado, { tipo: "ajuste" });
    expect(conMotivo.every((f) => f.motivo !== "")).toBe(true);
  });
});

describe("existencia valorizada", () => {
  it("el valor total coincide con el indicador global", () => {
    const total = filasExistencia(estado).reduce((s, f) => s + f.valorUsd, 0);
    expect(total).toBeCloseTo(valorDisponible(estado), 4);
  });

  it("el disponible descuenta reservado y averiado", () => {
    for (const f of filasExistencia(estado)) {
      expect(f.disponible).toBeCloseTo(f.fisico - f.reservado - f.averiado, 6);
    }
  });

  it("detalla por ubicación, no solo por artículo", () => {
    const filas = filasExistencia(estado);
    expect(filas.every((f) => f.ubicacion !== "")).toBe(true);
  });
});

describe("deuda de herramienta", () => {
  it("solo lista retornables con unidades pendientes", () => {
    for (const f of filasDeuda(estado, AHORA)) {
      expect(f.unidades).toBeGreaterThan(0);
    }
  });

  it("ordena por antigüedad, lo más viejo primero", () => {
    const filas = filasDeuda(estado, AHORA);
    for (let i = 1; i < filas.length; i++) {
      expect(filas[i - 1].dias).toBeGreaterThanOrEqual(filas[i].dias);
    }
  });

  it("identifica la obra por código y nombre", () => {
    for (const f of filasDeuda(estado, AHORA)) {
      expect(f.obra).not.toMatch(/^obr-/);
      expect(f.nombreObra.length).toBeGreaterThan(0);
    }
  });
});

describe("despachos", () => {
  it("cubre todos los despachos", () => {
    expect(filasDespachos(estado)).toHaveLength(estado.despachos.length);
  });

  it("la verificación se exporta legible, no como booleano", () => {
    const filas = filasDespachos(estado);
    const conPod = filas.filter((f) => f.receptor !== "");
    expect(conPod.length).toBeGreaterThan(0);
    for (const f of conPod) {
      expect(["Sí", "No"]).toContain(f.verificada);
    }
    expect(conPod.some((f) => f.verificada === "No")).toBe(true);
  });

  it("los que aún no salieron no traen fecha de salida ni entrega", () => {
    for (const f of filasDespachos(estado)) {
      if (f.estado === "en_preparacion" || f.estado === "listo") {
        expect(f.salida).toBe("");
        expect(f.entrega).toBe("");
      }
    }
  });

  it("el responsable sale resuelto según el tipo de transporte", () => {
    for (const f of filasDespachos(estado)) {
      expect(f.responsable.length).toBeGreaterThan(0);
      if (f.transporte === "externo") {
        expect(f.responsable).toMatch(/TO-|Transporte/);
      }
    }
  });
});

describe("estado vacío", () => {
  it("ningún reporte revienta sin datos", () => {
    expect(filasKardex(ESTADO_APOLO_VACIO)).toEqual([]);
    expect(filasExistencia(ESTADO_APOLO_VACIO)).toEqual([]);
    expect(filasDeuda(ESTADO_APOLO_VACIO, AHORA)).toEqual([]);
    expect(filasDespachos(ESTADO_APOLO_VACIO)).toEqual([]);
  });
});
