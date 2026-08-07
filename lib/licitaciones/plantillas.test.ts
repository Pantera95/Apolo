import { describe, expect, it } from "vitest";

import { computoSimulado, HISTORICO_DEMO } from "@/lib/licitaciones/ingesta";
import { estimar } from "@/lib/licitaciones/motor";
import {
  componer,
  desviacionHh,
  PLANTILLAS_EST,
  textoPlano,
  type CtxPlantilla,
} from "@/lib/licitaciones/plantillas";
import { PARAMETROS_INICIALES } from "@/lib/licitaciones/tipos";

const ingesta = computoSimulado("plataforma.rvt", "revit");
const estimacion = estimar(ingesta.renglones, PARAMETROS_INICIALES);

const CTX: CtxPlantilla = {
  proyecto: "Plataforma de procesamiento · Fase 1",
  cliente: "Global XXI, C.A.",
  origen: "Autodesk Revit",
  archivo: ingesta.archivo,
  estimacion,
  parametros: PARAMETROS_INICIALES,
  historico: HISTORICO_DEMO,
  simulado: true,
  preparadoPor: "Estimaciones y Costos",
};

describe("plantillas de estimación", () => {
  it("todas componen un mensaje no vacío", () => {
    for (const p of PLANTILLAS_EST) {
      const html = componer(p.id, CTX);
      expect(html.length).toBeGreaterThan(60);
      expect(html).not.toMatch(/undefined|NaN|\[object/);
    }
  });

  /**
   * Telegram corta la leyenda de un DOCUMENTO en 1024 caracteres —un cuarto de
   * lo que admite un mensaje suelto— y no la trunca: rechaza el envío entero.
   * Como cualquiera de estas plantillas puede acabar adjunta a un PDF, todas
   * tienen que caber.
   */
  it("caben en la leyenda de un documento de Telegram", () => {
    for (const p of PLANTILLAS_EST) {
      expect(componer(p.id, CTX).length).toBeLessThan(1024);
    }
  });

  it("el aviso de demostración va en todas", () => {
    for (const p of PLANTILLAS_EST) {
      expect(componer(p.id, CTX)).toContain("demostración");
    }
  });

  it("no lo pone cuando el cómputo es real", () => {
    const html = componer("resumen", { ...CTX, simulado: false });
    expect(html).not.toContain("demostración");
  });

  it("escapa el HTML del nombre del proyecto", () => {
    // Un `<` sin escapar rompe el parseo de Telegram y el mensaje no llega.
    const html = componer("resumen", { ...CTX, proyecto: "Fase <1> & 2" });
    expect(html).toContain("Fase &lt;1&gt; &amp; 2");
  });

  describe("alerta de rendimiento", () => {
    it("dispara con los datos de demostración", () => {
      const d = desviacionHh(CTX);
      expect(d).not.toBeNull();
      expect(d!.pct).toBeGreaterThan(15);
      expect(componer("alerta_rendimiento", CTX)).toContain("Alerta de rendimiento");
    });

    /**
     * Sin histórico no se inventa una alerta: un aviso sin base contra la que
     * comparar es peor que ningún aviso, porque enseña a ignorar los que sí
     * tienen fundamento.
     */
    it("sin histórico lo dice, en vez de alarmar sin base", () => {
      const html = componer("alerta_rendimiento", { ...CTX, historico: [] });
      expect(html).toContain("No hay obras históricas");
      expect(html).not.toContain("Requiere justificación");
    });

    it("cuando el rendimiento es conservador no alarma", () => {
      // Se duplican las HH del proyecto para volverlo pesimista.
      const lento = estimar(
        ingesta.renglones.map((r) => ({ ...r, rendimientoHh: r.rendimientoHh * 12 })),
        PARAMETROS_INICIALES,
      );
      const html = componer("alerta_rendimiento", { ...CTX, estimacion: lento });
      expect(html).toContain("dentro de rango");
      expect(html).not.toContain("⚠️");
    });
  });

  it("la RFQ declara que el monto es solo material", () => {
    // Sin esta línea un proveedor podría cotizar incluyendo mano de obra.
    expect(componer("rfq", CTX)).toContain("solo material");
  });

  it("textoPlano deja los enlaces legibles y quita las etiquetas", () => {
    const plano = textoPlano('Ver <a href="https://x.test">el mapa</a> y <b>ya</b>');
    expect(plano).toBe("Ver el mapa (https://x.test) y ya");
  });
});
