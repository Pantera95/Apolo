import { describe, expect, it } from "vitest";

import { enObraPorObra, movimientosPorMes } from "@/lib/datos/indicadores";
import type { EstadoApolo } from "@/lib/db/almacen";
import { SALDO_CERO, type Asiento } from "@/lib/dominio/tipos";

/**
 * Las series que alimentan las gráficas del panel.
 *
 * Se prueban porque son las dos que pueden mentir en silencio: una suma con el
 * signo equivocado o un porcentaje sobre el total equivocado no rompen nada,
 * solo dibujan una barra de la altura que no es.
 */

function asiento(p: {
  fecha: string;
  fisico?: number;
  enObra?: number;
  obraId?: string;
}): Asiento {
  return {
    id: `AS-${p.fecha}-${p.fisico ?? 0}-${p.enObra ?? 0}-${p.obraId ?? ""}`,
    articuloId: "A",
    almacenId: "AL",
    ubicacionId: "U",
    fecha: p.fecha,
    tipo: "despacho",
    usuarioId: "U-1",
    obraId: p.obraId,
    delta: { ...SALDO_CERO, fisico: p.fisico ?? 0, enObra: p.enObra ?? 0 },
  };
}

const estadoCon = (asientos: Asiento[], obras: { id: string; nombre: string }[] = []) =>
  ({ inventario: { asientos }, obras }) as unknown as EstadoApolo;

describe("movimientosPorMes", () => {
  /**
   * El punto del helper: un mes con mucho movimiento en las dos direcciones NO
   * puede verse igual que un mes quieto. Sumar el neto los igualaría.
   */
  it("separa entradas de salidas en vez de netearlas", () => {
    const e = estadoCon([
      asiento({ fecha: "2026-03-01T10:00:00Z", fisico: 500 }),
      asiento({ fecha: "2026-03-20T10:00:00Z", fisico: -480 }),
    ]);
    expect(movimientosPorMes(e)).toEqual([
      { etiqueta: "2026-03", entradas: 500, salidas: 480 },
    ]);
  });

  it("devuelve las salidas en positivo, para poder graficarlas", () => {
    const e = estadoCon([asiento({ fecha: "2026-03-02T00:00:00Z", fisico: -75 })]);
    expect(movimientosPorMes(e)[0].salidas).toBe(75);
  });

  it("ordena cronológicamente y recorta a los últimos meses pedidos", () => {
    const e = estadoCon([
      asiento({ fecha: "2026-05-01T00:00:00Z", fisico: 1 }),
      asiento({ fecha: "2026-01-01T00:00:00Z", fisico: 1 }),
      asiento({ fecha: "2026-03-01T00:00:00Z", fisico: 1 }),
    ]);
    expect(movimientosPorMes(e, 2).map((m) => m.etiqueta)).toEqual([
      "2026-03",
      "2026-05",
    ]);
  });

  /**
   * Un movimiento del 31 a las 23:00 UTC pertenece a SU mes. Construir un Date
   * lo movería al mes anterior en husos negativos, y el corte mensual del
   * almacén dejaría de cuadrar con el del cliente.
   */
  it("un movimiento de fin de mes no se escapa al mes anterior", () => {
    const e = estadoCon([asiento({ fecha: "2026-03-31T23:30:00Z", fisico: 10 })]);
    expect(movimientosPorMes(e)[0].etiqueta).toBe("2026-03");
  });
});

describe("enObraPorObra", () => {
  it("agrupa por obra y reparte el porcentaje sobre el total EN OBRA", () => {
    const e = estadoCon(
      [
        asiento({ fecha: "2026-03-01T00:00:00Z", enObra: 75, obraId: "O1" }),
        asiento({ fecha: "2026-03-02T00:00:00Z", enObra: 25, obraId: "O2" }),
      ],
      [
        { id: "O1", nombre: "Planta" },
        { id: "O2", nombre: "Tanques" },
      ],
    );
    const r = enObraPorObra(e);
    expect(r.map((x) => [x.nombre, x.pct])).toEqual([
      ["Planta", 75],
      ["Tanques", 25],
    ]);
  });

  it("ignora los asientos sin obra", () => {
    const e = estadoCon([asiento({ fecha: "2026-03-01T00:00:00Z", enObra: 50 })]);
    expect(enObraPorObra(e)).toEqual([]);
  });

  /** Sin total, un porcentaje seria NaN y llegaria a pantalla como "NaN%". */
  it("sin material en obra devuelve lista vacía, nunca NaN", () => {
    const e = estadoCon([
      asiento({ fecha: "2026-03-01T00:00:00Z", enObra: -10, obraId: "O1" }),
    ]);
    for (const x of enObraPorObra(e)) expect(Number.isNaN(x.pct)).toBe(false);
  });
});
