import { describe, expect, it } from "vitest";

import {
  esTerminal,
  estaCompletamenteDespachada,
  pendientePorDespachar,
  puedeMoverFisico,
  registrarDespacho,
  transicionar,
  transicionesPosibles,
  type Solicitud,
} from "./despacho";

function solicitud(over: Partial<Solicitud> = {}): Solicitud {
  return {
    id: "sol-1",
    codigo: "SOL-0001",
    obraId: "obra-1",
    estado: "aprobada",
    creadaPor: "u-1",
    fecha: "2026-08-01T12:00:00.000Z",
    lineas: [
      { articuloId: "art-1", cantidadSolicitada: 100, cantidadDespachada: 0 },
      { articuloId: "art-2", cantidadSolicitada: 20, cantidadDespachada: 0 },
    ],
    ...over,
  };
}

describe("la aprobación es bloqueante", () => {
  it("no se puede saltar de solicitada a preparación", () => {
    const r = transicionar("solicitada", "en_preparacion", "almacenista");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("APROBACION_REQUERIDA");
  });

  it("el aprobador sí puede aprobar", () => {
    const r = transicionar("solicitada", "aprobada", "aprobador");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor).toBe("aprobada");
  });

  it("quien solicita no puede aprobar su propia solicitud", () => {
    const r = transicionar("solicitada", "aprobada", "solicitante");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("TRANSICION_NO_PERMITIDA");
  });

  it("el almacenista no puede aprobar", () => {
    expect(transicionar("solicitada", "aprobada", "almacenista").ok).toBe(false);
  });

  it("el owner puede hacer todo el recorrido", () => {
    const camino = [
      ["borrador", "solicitada"],
      ["solicitada", "aprobada"],
      ["aprobada", "en_preparacion"],
      ["en_preparacion", "despachada"],
      ["despachada", "entregada"],
      ["entregada", "cerrada"],
    ] as const;
    for (const [desde, hasta] of camino) {
      expect(transicionar(desde, hasta, "owner").ok).toBe(true);
    }
  });
});

describe("qué habilita el movimiento físico", () => {
  it("nada se baja del estante antes de la aprobación", () => {
    expect(puedeMoverFisico("borrador")).toBe(false);
    expect(puedeMoverFisico("solicitada")).toBe(false);
    expect(puedeMoverFisico("rechazada")).toBe(false);
  });

  it("desde aprobada en adelante sí", () => {
    expect(puedeMoverFisico("aprobada")).toBe(true);
    expect(puedeMoverFisico("en_preparacion")).toBe(true);
    expect(puedeMoverFisico("despachada")).toBe(true);
  });

  it("una solicitud rechazada o anulada está terminada", () => {
    expect(esTerminal("rechazada")).toBe(true);
    expect(esTerminal("anulada")).toBe(true);
    expect(esTerminal("cerrada")).toBe(true);
    expect(esTerminal("aprobada")).toBe(false);
  });
});

describe("transiciones ofrecidas por rol", () => {
  it("el aprobador solo ve aprobar o rechazar", () => {
    expect(transicionesPosibles("solicitada", "aprobador").sort()).toEqual([
      "aprobada",
      "rechazada",
    ]);
  });

  it("el rol de consulta no puede mover nada", () => {
    expect(transicionesPosibles("solicitada", "consulta")).toEqual([]);
    expect(transicionesPosibles("aprobada", "consulta")).toEqual([]);
  });
});

describe("despacho parcial", () => {
  it("acumula lo despachado y deja visible el pendiente", () => {
    const r1 = registrarDespacho(solicitud(), "art-1", 60);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;

    expect(pendientePorDespachar(r1.valor.lineas[0])).toBe(40);
    expect(estaCompletamenteDespachada(r1.valor)).toBe(false);

    const r2 = registrarDespacho(r1.valor, "art-1", 40);
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;

    expect(pendientePorDespachar(r2.valor.lineas[0])).toBe(0);
    // Sigue incompleta: falta la otra línea. Una solicitud no se cierra sola.
    expect(estaCompletamenteDespachada(r2.valor)).toBe(false);

    const r3 = registrarDespacho(r2.valor, "art-2", 20);
    expect(r3.ok).toBe(true);
    if (r3.ok) expect(estaCompletamenteDespachada(r3.valor)).toBe(true);
  });

  it("no deja despachar más de lo pendiente", () => {
    const r = registrarDespacho(solicitud(), "art-1", 101);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("STOCK_INSUFICIENTE");
  });

  it("no deja despachar una solicitud sin aprobar", () => {
    const r = registrarDespacho(solicitud({ estado: "solicitada" }), "art-1", 10);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("APROBACION_REQUERIDA");
  });

  it("rechaza un artículo que no está en la solicitud", () => {
    const r = registrarDespacho(solicitud(), "art-99", 1);
    expect(r.ok).toBe(false);
  });

  it("no muta la solicitud original", () => {
    const original = solicitud();
    registrarDespacho(original, "art-1", 60);
    expect(original.lineas[0].cantidadDespachada).toBe(0);
  });
});
