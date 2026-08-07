import { describe, expect, it } from "vitest";

import { leerScheduleCsv } from "@/lib/licitaciones/ingesta";
import { estimar } from "@/lib/licitaciones/motor";
import { csvDeModelo, MODELOS_DEMO } from "@/lib/licitaciones/modelos-demo";
import { PARAMETROS_INICIALES } from "@/lib/licitaciones/tipos";

/**
 * Los modelos de muestra tienen que funcionar de punta a punta.
 *
 * Son lo que se enseña en una demostración delante del cliente: si uno de los
 * cuatro produce un cómputo vacío, un APU sin hojas o una cifra absurda, se
 * descubre allí. Estas pruebas recorren el mismo camino que la pantalla —CSV
 * de texto, lector real, motor— para cada uno.
 */
describe("modelos de muestra", () => {
  it("son cuatro obras distintas, no variantes de la misma", () => {
    expect(MODELOS_DEMO).toHaveLength(4);
    const dominantes = new Set(MODELOS_DEMO.map((m) => m.disciplinaDominante));
    // Si todas cargasen el peso en la misma disciplina, la demostración
    // enseñaría cuatro veces el mismo gráfico.
    expect(dominantes.size).toBeGreaterThanOrEqual(3);
  });

  for (const m of MODELOS_DEMO) {
    describe(m.nombre, () => {
      const r = leerScheduleCsv(csvDeModelo(m), m.archivo);
      const e = estimar(r.renglones, PARAMETROS_INICIALES);

      it("se lee entero, sin perder renglones", () => {
        expect(r.avisos).toEqual([]);
        expect(r.renglones).toHaveLength(m.filas.length);
        expect(r.simulado).toBe(false);
      });

      it("produce hojas de APU", () => {
        // Sin renglones con composición el entregable del APU saldría vacío,
        // que es justo lo que no puede pasar en una demostración.
        const conDesglose = e.apus.filter((a) => a.desglose.detallado);
        expect(conDesglose.length).toBeGreaterThanOrEqual(3);
      });

      it("da cifras de un orden de magnitud creíble", () => {
        expect(e.totalUsd).toBeGreaterThan(100_000);
        expect(e.totalUsd).toBeLessThan(60_000_000);
        // Un plazo de EPC va de unas semanas a un par de años. Fuera de ahí,
        // el cliente deja de mirar la pantalla.
        expect(Math.ceil(e.diasEstimados)).toBeGreaterThan(10);
        expect(Math.ceil(e.diasEstimados)).toBeLessThan(730);
      });

      it("reparte el trabajo entre varias disciplinas", () => {
        expect(e.porDisciplina.length).toBeGreaterThanOrEqual(3);
      });

      it("la matriz de cotización agrupa en varias familias", () => {
        const familias = new Set(e.apus.map((a) => a.renglon.codigo.split("-")[1]));
        expect(familias.size).toBeGreaterThanOrEqual(4);
      });
    });
  }

  it("las comillas de pulgada sobreviven al CSV", () => {
    // `Tuberia 6"` aparece en varios modelos y es el caso que rompía el lector.
    const conComillas = MODELOS_DEMO.filter((m) =>
      m.filas.some((f) => String(f[2]).includes('"') || String(f[3]).includes('"')),
    );
    expect(conComillas.length).toBeGreaterThan(0);

    for (const m of conComillas) {
      const r = leerScheduleCsv(csvDeModelo(m), m.archivo);
      expect(r.renglones).toHaveLength(m.filas.length);
    }
  });

  it("cada modelo lleva un nombre de archivo distinto", () => {
    const nombres = new Set(MODELOS_DEMO.map((m) => m.archivo));
    expect(nombres.size).toBe(MODELOS_DEMO.length);
  });
});
