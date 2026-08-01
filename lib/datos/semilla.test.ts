import { describe, expect, it } from "vitest";

import { construirSemilla } from "./semilla";
import {
  bajoMinimo,
  herramientaAveriada,
  herramientaSinRetornar,
  solicitudesPorAprobar,
  valorDisponible,
  valorEnObra,
} from "./indicadores";
import { reconciliar } from "@/lib/dominio/inventario";
import { disponible } from "@/lib/dominio/tipos";

// Fecha fija: la semilla debe ser reproducible para poder afirmar cifras.
const AHORA = new Date("2026-08-01T12:00:00.000Z");

describe("semilla de demostración", () => {
  it("se construye sin violar ninguna regla del dominio", () => {
    // construirSemilla lanza si el motor rechaza cualquier movimiento, así que
    // que esto no explote ya es la garantía principal.
    expect(() => construirSemilla(AHORA)).not.toThrow();
  });

  it("deja el kardex y los saldos cuadrados", () => {
    const estado = construirSemilla(AHORA);
    expect(reconciliar(estado.inventario)).toEqual([]);
  });

  it("no produce ninguna cantidad negativa", () => {
    const estado = construirSemilla(AHORA);
    for (const [clave, saldo] of estado.inventario.saldos) {
      for (const campo of Object.keys(saldo) as (keyof typeof saldo)[]) {
        expect(
          saldo[campo],
          `${clave}.${campo} quedó negativo`,
        ).toBeGreaterThanOrEqual(0);
      }
      expect(disponible(saldo)).toBeGreaterThanOrEqual(0);
    }
  });

  it("tiene catálogo suficiente para recorrer la presentación", () => {
    const estado = construirSemilla(AHORA);
    expect(estado.articulos.length).toBeGreaterThanOrEqual(20);
    expect(estado.almacenes).toHaveLength(3);
    expect(estado.obras.length).toBeGreaterThanOrEqual(4);
    expect(estado.inventario.asientos.length).toBeGreaterThan(50);
  });

  it("trae despachos en todas las etapas para poder recorrer el flujo", () => {
    const estados = new Set(construirSemilla(AHORA).despachos.map((d) => d.estado));
    expect(estados).toEqual(
      new Set(["en_preparacion", "listo", "en_ruta", "entregado", "con_discrepancia"]),
    );
  });

  it("la entrega con orden distinta queda marcada, no oculta", () => {
    const conProblema = construirSemilla(AHORA).despachos.find(
      (d) => d.estado === "con_discrepancia",
    );
    expect(conProblema?.pod?.coincide).toBe(false);
    expect(conProblema?.pod?.receptor).toBeTruthy();
  });

  it("la flota y los vehículos referenciados existen", () => {
    const estado = construirSemilla(AHORA);
    const choferes = new Set(estado.choferes.map((c) => c.id));
    const vehiculos = new Set(estado.vehiculos.map((v) => v.id));
    for (const d of estado.despachos) {
      if (d.choferId) expect(choferes.has(d.choferId)).toBe(true);
      if (d.vehiculoId) expect(vehiculos.has(d.vehiculoId)).toBe(true);
    }
  });

  it("incluye las tres clases de artículo", () => {
    const clases = new Set(construirSemilla(AHORA).articulos.map((a) => a.clase));
    expect(clases).toEqual(new Set(["consumible", "retornable", "certificado"]));
  });
});

describe("indicadores derivados", () => {
  const estado = construirSemilla(AHORA);

  it("valoriza existencia disponible y material en obra", () => {
    expect(valorDisponible(estado)).toBeGreaterThan(0);
    expect(valorEnObra(estado)).toBeGreaterThan(0);
  });

  it("mide la deuda de herramienta solo sobre artículos retornables", () => {
    const deuda = herramientaSinRetornar(estado);
    expect(deuda.unidades).toBeGreaterThan(0);

    // Ningún consumible ni certificado puede aparecer en esa cifra: la única
    // vía para que algo esté "en obra" y sea retornable es el guion de la
    // semilla, y el dominio impide retornar lo que no lo es.
    const soloRetornables = estado.articulos
      .filter((a) => a.clase === "retornable")
      .map((a) => a.id);
    let unidadesRetornables = 0;
    for (const [clave, saldo] of estado.inventario.saldos) {
      if (soloRetornables.includes(clave.split("|")[0])) {
        unidadesRetornables += saldo.enObra;
      }
    }
    expect(deuda.unidades).toBe(unidadesRetornables);
  });

  it("registra herramienta que volvió averiada", () => {
    expect(herramientaAveriada(estado).unidades).toBeGreaterThan(0);
  });

  it("deja solicitudes esperando aprobación", () => {
    const pendientes = solicitudesPorAprobar(estado);
    expect(pendientes.length).toBeGreaterThan(0);
    expect(pendientes.every((s) => s.estado === "solicitada")).toBe(true);
  });

  it("detecta artículos bajo mínimo", () => {
    // Con un umbral del 100% todo lo despachado cae bajo mínimo: comprueba que
    // el cálculo responde al umbral y no devuelve una lista fija.
    expect(bajoMinimo(estado, 1).length).toBeGreaterThan(
      bajoMinimo(estado, 0.1).length,
    );
  });
});
