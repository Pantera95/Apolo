import { describe, expect, it } from "vitest";

import { serieAcumulada } from "@/lib/datos/indicadores";
import type { EstadoApolo } from "@/lib/db/almacen";
import { SALDO_CERO, type Asiento } from "@/lib/dominio/tipos";

/**
 * La serie de las chispas del panel.
 *
 * Se prueba porque ANTES MENTÍA: dibujaba `Math.abs(delta.fisico)`, o sea la
 * magnitud de movimientos sueltos sin signo y sin acumular, y la segunda
 * tarjeta reutilizaba esa misma serie invertida. Un test fija que lo que se
 * grafica es un NIVEL cronológico y no un montón de magnitudes.
 */

function asiento(fecha: string, enObra: number): Asiento {
  return {
    id: `AS-${fecha}-${enObra}`,
    articuloId: "A",
    almacenId: "AL",
    ubicacionId: "U",
    fecha,
    tipo: "despacho",
    usuarioId: "U-1",
    delta: { ...SALDO_CERO, enObra },
  };
}

/**
 * `serieAcumulada` sólo lee `inventario.asientos`, así que el resto del estado
 * no se construye. El doble cast es deliberado y está acotado a este ayudante:
 * fabricar un `EstadoApolo` completo —doce colecciones— para probar una suma
 * acumulada añadiría ruido sin añadir cobertura.
 */
function estadoCon(asientos: Asiento[]): EstadoApolo {
  return { inventario: { asientos } } as unknown as EstadoApolo;
}

describe("serieAcumulada", () => {
  it("acumula en orden cronológico, del más viejo al más nuevo", () => {
    const e = estadoCon([
      asiento("2026-03-03", 5),
      asiento("2026-03-02", 20),
      asiento("2026-03-01", 10),
    ]);
    // Cronológico: 10, luego +20 = 30, luego +5 = 35.
    expect(serieAcumulada(e, (s) => s.enObra)).toEqual([10, 30, 35]);
  });

  /**
   * El punto de todo el arreglo: una salida tiene que BAJAR la curva. Con el
   * valor absoluto anterior, una devolución de 40 se dibujaba igual que un
   * despacho de 40 y la línea sólo sabía subir.
   */
  it("un delta negativo hace bajar el nivel", () => {
    const e = estadoCon([asiento("2026-03-02", -40), asiento("2026-03-01", 100)]);
    expect(serieAcumulada(e, (s) => s.enObra)).toEqual([100, 60]);
  });

  it("respeta el número de cortes pedido", () => {
    const e = estadoCon(
      Array.from({ length: 20 }, (_, i) =>
        asiento(`2026-03-${String(i + 1).padStart(2, "0")}`, 1),
      ),
    );
    expect(serieAcumulada(e, (s) => s.enObra, 5)).toHaveLength(5);
  });

  it("sin asientos devuelve una serie vacía, no ceros inventados", () => {
    expect(serieAcumulada(estadoCon([]), (s) => s.enObra)).toEqual([]);
  });
});
