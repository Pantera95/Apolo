import { describe, expect, it } from "vitest";

import {
  DIAS_VENCIDO,
  fichasHerramienta,
  prestamosAbiertos,
  resumenHerramientas,
} from "./herramientas";
import { deudaDeObra } from "./obras";
import { construirSemilla } from "./semilla";
import { herramientaSinRetornar } from "./indicadores";
import { ESTADO_APOLO_VACIO } from "@/lib/db/almacen";

const AHORA_FECHA = new Date("2026-08-01T12:00:00.000Z");
const AHORA = AHORA_FECHA.getTime();
const estado = construirSemilla(AHORA_FECHA);

describe("préstamos abiertos", () => {
  it("solo lista retornables con unidades fuera", () => {
    const prestamos = prestamosAbiertos(estado, AHORA);
    expect(prestamos.length).toBeGreaterThan(0);
    for (const p of prestamos) {
      expect(p.articulo.clase).toBe("retornable");
      expect(p.unidades).toBeGreaterThan(0);
    }
  });

  it("coincide con la suma de las deudas por obra", () => {
    // Esta vista y la de Obras salen del mismo cálculo a propósito: si se
    // separan, dos pantallas mostrarían números distintos del mismo hecho.
    const porObra = estado.obras.reduce(
      (s, o) => s + deudaDeObra(estado, o.id, AHORA).reduce((x, d) => x + d.unidades, 0),
      0,
    );
    const consolidado = prestamosAbiertos(estado, AHORA).reduce(
      (s, p) => s + p.unidades,
      0,
    );
    expect(consolidado).toBe(porObra);
  });

  it("cuadra con el indicador global del panel", () => {
    const consolidado = prestamosAbiertos(estado, AHORA).reduce(
      (s, p) => s + p.unidades,
      0,
    );
    expect(consolidado).toBeCloseTo(herramientaSinRetornar(estado).unidades, 6);
  });

  it("ordena lo más viejo primero: es lo que hay que ir a buscar", () => {
    const prestamos = prestamosAbiertos(estado, AHORA);
    for (let i = 1; i < prestamos.length; i++) {
      expect(prestamos[i - 1].dias).toBeGreaterThanOrEqual(prestamos[i].dias);
    }
  });

  it("dice a qué ubicación debe volver cada préstamo", () => {
    for (const p of prestamosAbiertos(estado, AHORA)) {
      expect(p.almacenId).toBeTruthy();
      expect(p.ubicacionId).toBeTruthy();
    }
  });

  it("identifica obra y artículo, no identificadores sueltos", () => {
    for (const p of prestamosAbiertos(estado, AHORA)) {
      expect(p.obra.codigo).toBeTruthy();
      expect(p.articulo.codigo).toBeTruthy();
    }
  });
});

describe("ficha por herramienta", () => {
  const fichas = fichasHerramienta(estado, AHORA);

  it("hay una ficha por artículo retornable", () => {
    const retornables = estado.articulos.filter((a) => a.clase === "retornable");
    expect(fichas).toHaveLength(retornables.length);
  });

  it("el total reparte entre almacén y obra", () => {
    for (const f of fichas) {
      expect(f.total).toBeCloseTo(f.enAlmacen + f.fuera, 6);
    }
  });

  it("lo averiado cuenta en el total pero no en el disponible", () => {
    // Sigue siendo un activo de la empresa aunque no se pueda usar; sacarlo
    // del recuento es como se pierde la pista de lo que hay que reparar.
    const conAveria = fichas.find((f) => f.averiado > 0);
    expect(conAveria).toBeDefined();
    if (!conAveria) return;
    expect(conAveria.disponible).toBeLessThan(conAveria.enAlmacen);
    expect(conAveria.total).toBeGreaterThanOrEqual(conAveria.averiado);
  });

  it("cuenta en cuántas obras está repartida cada herramienta", () => {
    const fuera = fichas.filter((f) => f.fuera > 0);
    expect(fuera.length).toBeGreaterThan(0);
    for (const f of fuera) expect(f.obras).toBeGreaterThan(0);
  });

  it("una herramienta sin préstamos no acumula días", () => {
    for (const f of fichas) {
      if (f.fuera === 0) expect(f.diasMax).toBe(0);
    }
  });

  it("ordena por lo que está fuera", () => {
    for (let i = 1; i < fichas.length; i++) {
      expect(fichas[i - 1].fuera).toBeGreaterThanOrEqual(fichas[i].fuera);
    }
  });
});

describe("resumen", () => {
  it("consolida sin perder unidades", () => {
    const resumen = resumenHerramientas(estado, AHORA);
    const suma = fichasHerramienta(estado, AHORA).reduce((s, f) => s + f.fuera, 0);
    expect(resumen.unidadesFuera).toBeCloseTo(suma, 6);
  });

  it("cuenta como vencido solo lo que supera el umbral", () => {
    const resumen = resumenHerramientas(estado, AHORA);
    const vencidos = prestamosAbiertos(estado, AHORA).filter(
      (p) => p.dias > DIAS_VENCIDO,
    );
    expect(resumen.prestamosVencidos).toBe(vencidos.length);
    expect(resumen.prestamosVencidos).toBeGreaterThan(0);
  });

  it("no rompe con el estado vacío", () => {
    const vacio = resumenHerramientas(ESTADO_APOLO_VACIO, AHORA);
    expect(vacio.unidadesFuera).toBe(0);
    expect(vacio.articulos).toBe(0);
    expect(prestamosAbiertos(ESTADO_APOLO_VACIO, AHORA)).toEqual([]);
  });
});
