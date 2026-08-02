import { describe, expect, it } from "vitest";

import {
  costoPromedioPonderado,
  diasDeAtraso,
  estaAbierta,
  estaRecibida,
  pendientePorRecibir,
  registrarRecepcion,
  totalOrden,
  totalRecibido,
  transicionarOrden,
  type OrdenCompra,
} from "./compras";

const FECHA = "2026-08-01T12:00:00.000Z";

function orden(over: Partial<OrdenCompra> = {}): OrdenCompra {
  return {
    id: "oc-1",
    codigo: "OC-0042",
    proveedorId: "pro-1",
    estado: "enviada",
    fechaEmision: "2026-07-10T12:00:00.000Z",
    fechaEsperada: "2026-07-25T12:00:00.000Z",
    lineas: [
      { articuloId: "art-20", cantidadPedida: 100, cantidadRecibida: 0, costoUnitarioUsd: 60 },
      { articuloId: "art-22", cantidadPedida: 20, cantidadRecibida: 0, costoUnitarioUsd: 70 },
    ],
    ...over,
  };
}

describe("recepción parcial", () => {
  it("acumula lo recibido y deja visible el pendiente", () => {
    const r = registrarRecepcion(orden(), "art-20", 60);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(pendientePorRecibir(r.valor.lineas[0])).toBe(40);
    expect(r.valor.estado).toBe("parcial");
    expect(estaRecibida(r.valor)).toBe(false);
  });

  it("solo se cierra cuando TODAS las líneas llegaron completas", () => {
    let oc = orden();
    for (const [articulo, cantidad] of [
      ["art-20", 100],
      ["art-22", 19],
    ] as const) {
      const r = registrarRecepcion(oc, articulo, cantidad);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      oc = r.valor;
    }
    // Falta 1 unidad: la orden NO puede cerrarse sola.
    expect(oc.estado).toBe("parcial");

    const ultima = registrarRecepcion(oc, "art-22", 1);
    expect(ultima.ok && ultima.valor.estado).toBe("recibida");
  });

  it("no deja recibir más de lo pendiente", () => {
    const r = registrarRecepcion(orden(), "art-20", 101);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("STOCK_INSUFICIENTE");
  });

  it("no se recibe sobre un borrador ni sobre una cancelada", () => {
    for (const estado of ["borrador", "cancelada", "recibida"] as const) {
      const r = registrarRecepcion(orden({ estado }), "art-20", 10);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.codigo).toBe("TRANSICION_NO_PERMITIDA");
    }
  });

  it("rechaza un artículo que no está en la orden", () => {
    expect(registrarRecepcion(orden(), "art-99", 5).ok).toBe(false);
  });

  it("rechaza cantidades no positivas", () => {
    expect(registrarRecepcion(orden(), "art-20", 0).ok).toBe(false);
    expect(registrarRecepcion(orden(), "art-20", -5).ok).toBe(false);
  });

  it("no muta la orden original", () => {
    const original = orden();
    registrarRecepcion(original, "art-20", 60);
    expect(original.lineas[0].cantidadRecibida).toBe(0);
  });
});

describe("estados de la orden", () => {
  it("una orden a medias no se puede cancelar", () => {
    // Ya trajo mercancía: cancelarla borraría una entrada real de almacén.
    const r = transicionarOrden("parcial", "cancelada");
    expect(r.ok).toBe(false);
  });

  it("un borrador se puede enviar o cancelar", () => {
    expect(transicionarOrden("borrador", "enviada").ok).toBe(true);
    expect(transicionarOrden("borrador", "cancelada").ok).toBe(true);
  });

  it("recibida y cancelada son terminales", () => {
    expect(transicionarOrden("recibida", "enviada").ok).toBe(false);
    expect(transicionarOrden("cancelada", "enviada").ok).toBe(false);
  });

  it("solo enviada y parcial pueden traer mercancía", () => {
    expect(estaAbierta(orden({ estado: "enviada" }))).toBe(true);
    expect(estaAbierta(orden({ estado: "parcial" }))).toBe(true);
    expect(estaAbierta(orden({ estado: "borrador" }))).toBe(false);
    expect(estaAbierta(orden({ estado: "recibida" }))).toBe(false);
  });
});

describe("totales", () => {
  it("suma lo pedido y lo efectivamente recibido", () => {
    expect(totalOrden(orden())).toBe(100 * 60 + 20 * 70);

    const r = registrarRecepcion(orden(), "art-20", 50);
    expect(r.ok && totalRecibido(r.valor)).toBe(50 * 60);
  });
});

describe("costo promedio ponderado", () => {
  it("promedia según las cantidades, no a partes iguales", () => {
    // 100 a $10 y 100 a $20 → $15. Pero 900 a $10 y 100 a $20 → $11.
    expect(costoPromedioPonderado(100, 10, 100, 20)).toBe(15);
    expect(costoPromedioPonderado(900, 10, 100, 20)).toBe(11);
  });

  it("sin existencia previa manda el costo entrante", () => {
    // Promediar contra cero daría la mitad del valor real.
    expect(costoPromedioPonderado(0, 0, 50, 42)).toBe(42);
    expect(costoPromedioPonderado(0, 99, 50, 42)).toBe(42);
  });

  it("sin entrada el costo no se mueve", () => {
    expect(costoPromedioPonderado(100, 10, 0, 999)).toBe(10);
  });

  it("mantiene el costo si entra al mismo precio", () => {
    expect(costoPromedioPonderado(100, 10, 100, 10)).toBe(10);
  });
});

describe("atraso", () => {
  const ahora = Date.parse(FECHA);

  it("cuenta los días vencidos de una orden abierta", () => {
    // Esperada el 25/jul, hoy 1/ago → 7 días.
    expect(diasDeAtraso(orden(), ahora)).toBe(7);
  });

  it("una orden cerrada no acumula atraso", () => {
    expect(diasDeAtraso(orden({ estado: "recibida" }), ahora)).toBe(0);
  });

  it("no cuenta días antes de vencer", () => {
    expect(
      diasDeAtraso(orden({ fechaEsperada: "2026-09-01T12:00:00.000Z" }), ahora),
    ).toBe(0);
  });

  it("sin reloj todavía no cuenta", () => {
    expect(diasDeAtraso(orden(), 0)).toBe(0);
  });
});
