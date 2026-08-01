import { describe, expect, it } from "vitest";

import {
  filasInventario,
  kardexDe,
  saldosPorUbicacion,
  totalInventario,
} from "./inventario";
import { construirSemilla } from "./semilla";
import { valorDisponible } from "./indicadores";
import { ESTADO_APOLO_VACIO } from "@/lib/db/almacen";
import { disponible } from "@/lib/dominio/tipos";

const AHORA = new Date("2026-08-01T12:00:00.000Z");
const estado = construirSemilla(AHORA);

describe("filas de inventario", () => {
  it("lista una fila por artículo del catálogo", () => {
    expect(filasInventario(estado)).toHaveLength(estado.articulos.length);
  });

  it("el valor total coincide con el indicador global", () => {
    // Se calcula por dos vías distintas: si divergen, una de las dos miente.
    expect(totalInventario(filasInventario(estado))).toBeCloseTo(
      valorDisponible(estado),
      6,
    );
  });

  it("filtra por texto en código y en descripción", () => {
    expect(filasInventario(estado, { texto: "TOR-58" })).toHaveLength(1);
    const porDescripcion = filasInventario(estado, { texto: "electrodo" });
    expect(porDescripcion.length).toBeGreaterThanOrEqual(2);
  });

  it("la búsqueda no distingue mayúsculas", () => {
    expect(filasInventario(estado, { texto: "tor-58" })).toHaveLength(1);
  });

  it("filtra por clase", () => {
    const retornables = filasInventario(estado, { clase: "retornable" });
    expect(retornables.length).toBeGreaterThan(0);
    expect(retornables.every((f) => f.articulo.clase === "retornable")).toBe(true);
  });

  it("al filtrar por almacén solo deja lo que existe allí", () => {
    const enPatio = filasInventario(estado, { almacenId: "alm-pat" });
    expect(enPatio.length).toBeGreaterThan(0);
    expect(enPatio.length).toBeLessThan(estado.articulos.length);
  });

  it("sin filtro de almacén incluye artículos en cero", () => {
    // Un artículo que desaparece de la lista al agotarse es justo el que
    // alguien necesita encontrar para reponerlo.
    const todas = filasInventario(estado);
    expect(todas.length).toBe(estado.articulos.length);
  });

  it("el disponible descuenta reservado y averiado", () => {
    for (const fila of filasInventario(estado)) {
      expect(fila.disponible).toBe(disponible(fila.saldo));
    }
  });

  it("no rompe con el estado vacío", () => {
    expect(filasInventario(ESTADO_APOLO_VACIO)).toEqual([]);
  });
});

describe("saldos por ubicación", () => {
  it("devuelve las ubicaciones de un artículo ordenadas por recorrido", () => {
    const ubicaciones = saldosPorUbicacion(estado, "art-13");
    expect(ubicaciones.length).toBeGreaterThan(0);
    for (let i = 1; i < ubicaciones.length; i++) {
      expect(ubicaciones[i - 1].ubicacion?.ordenRecorrido ?? 0).toBeLessThanOrEqual(
        ubicaciones[i].ubicacion?.ordenRecorrido ?? 0,
      );
    }
  });

  it("resuelve el almacén y la ubicación, no solo los identificadores", () => {
    const [primera] = saldosPorUbicacion(estado, "art-13");
    expect(primera.almacen?.nombre).toBeTruthy();
    expect(primera.ubicacion?.pasillo).toBeTruthy();
  });

  it("la suma por ubicación cuadra con la fila agregada", () => {
    const fila = filasInventario(estado).find((f) => f.articulo.id === "art-13");
    const suma = saldosPorUbicacion(estado, "art-13").reduce(
      (s, u) => s + u.saldo.fisico,
      0,
    );
    expect(suma).toBeCloseTo(fila?.saldo.fisico ?? 0, 6);
  });
});

describe("kardex por artículo", () => {
  it("devuelve solo los movimientos de ese artículo", () => {
    const kardex = kardexDe(estado, "art-13");
    expect(kardex.length).toBeGreaterThan(0);
    expect(kardex.every((a) => a.articuloId === "art-13")).toBe(true);
  });

  it("viene del más reciente al más antiguo", () => {
    const kardex = kardexDe(estado, "art-13");
    for (let i = 1; i < kardex.length; i++) {
      expect(kardex[i - 1].fecha >= kardex[i].fecha).toBe(true);
    }
  });

  it("un artículo sin movimientos devuelve lista vacía", () => {
    expect(kardexDe(estado, "art-inexistente")).toEqual([]);
  });
});
