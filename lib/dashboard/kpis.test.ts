import { describe, expect, it } from "vitest";

import { estadoUmbral, definicion } from "@/lib/dashboard/catalogo";
import {
  cobertura,
  cumplimientoPlanObra,
  dentro,
  entregasCompletas,
  otif,
  porcentaje,
  promedio,
  resolverVentana,
  rotacion,
  tendencia,
  variacion,
  variacionConsumo,
} from "@/lib/dashboard/kpis";
import type { DefinicionKpi, Filtros } from "@/lib/dashboard/tipos";

describe("porcentaje", () => {
  it("calcula la razón sobre cien", () => {
    expect(porcentaje(45, 50)).toBe(90);
  });

  it("devuelve null sin denominador en vez de NaN", () => {
    // 0/0 es NaN y se pintaría literalmente en la tarjeta.
    expect(porcentaje(0, 0)).toBeNull();
    expect(porcentaje(5, 0)).toBeNull();
  });

  it("devuelve null con denominador negativo", () => {
    expect(porcentaje(5, -3)).toBeNull();
  });

  it("distingue cero real de ausencia de datos", () => {
    // Ninguna entrega salió completa: eso es 0%, un dato, no un hueco.
    expect(entregasCompletas(0, 12)).toBe(0);
    // No hubo entregas: no hay porcentaje que dar.
    expect(entregasCompletas(0, 0)).toBeNull();
  });
});

describe("otif", () => {
  it("exige ambas condiciones, no la media", () => {
    expect(otif(8, 10)).toBe(80);
  });

  it("no inventa cuando no hay entregas cerradas", () => {
    expect(otif(0, 0)).toBeNull();
  });
});

describe("cobertura", () => {
  it("estima los días que dura el stock", () => {
    expect(cobertura(100, 5)).toBe(20);
  });

  it("sin consumo NO es cobertura infinita", () => {
    // Un artículo parado un año no está a salvo: es que no hay con qué estimar.
    expect(cobertura(100, 0)).toBeNull();
    expect(cobertura(100, -1)).toBeNull();
  });

  it("con stock cero da cobertura cero, no null", () => {
    expect(cobertura(0, 5)).toBe(0);
  });
});

describe("variacion", () => {
  it("compara contra el periodo anterior", () => {
    expect(variacion(120, 100)).toBeCloseTo(20);
    expect(variacion(80, 100)).toBeCloseTo(-20);
  });

  it("de cero a algo no es infinito por ciento", () => {
    expect(variacion(5, 0)).toBeNull();
  });

  it("de cero a cero es cero, no null", () => {
    expect(variacion(0, 0)).toBe(0);
  });

  it("caer a cero es -100%", () => {
    expect(variacion(0, 5)).toBe(-100);
  });

  it("usa el valor absoluto del anterior para no invertir el signo", () => {
    // Con anterior negativo, dividir sin abs daría la variación al revés.
    expect(variacion(-5, -10)).toBeCloseTo(50);
  });
});

describe("tendencia", () => {
  it("ignora el ruido por debajo del umbral", () => {
    expect(tendencia(100.2, 100)).toBe("plano");
  });

  it("detecta subida y bajada", () => {
    expect(tendencia(130, 100)).toBe("sube");
    expect(tendencia(70, 100)).toBe("baja");
  });

  it("es plana sin datos con los que comparar", () => {
    expect(tendencia(null, 100)).toBe("plano");
    expect(tendencia(100, null)).toBe("plano");
  });
});

describe("variacionConsumo", () => {
  it("conserva el signo: consumir de menos es negativo", () => {
    expect(variacionConsumo(80, 100)).toBeCloseTo(-20);
    expect(variacionConsumo(130, 100)).toBeCloseTo(30);
  });

  it("no calcula sin plan contra el que comparar", () => {
    expect(variacionConsumo(80, 0)).toBeNull();
  });
});

describe("promedio", () => {
  it("distingue media cero de ausencia de muestras", () => {
    expect(promedio([0, 0])).toBe(0);
    expect(promedio([])).toBeNull();
  });

  it("descarta valores no finitos", () => {
    expect(promedio([2, 4, NaN, Infinity])).toBe(3);
  });
});

describe("rotacion y cumplimiento", () => {
  it("rotación es consumo sobre inventario medio", () => {
    expect(rotacion(300, 100)).toBe(3);
    expect(rotacion(300, 0)).toBeNull();
  });

  it("cumplimiento de plan sin plan es null", () => {
    expect(cumplimientoPlanObra(50, 0)).toBeNull();
    expect(cumplimientoPlanObra(45, 50)).toBe(90);
  });
});

// ---------------------------------------------------------------------------

const base: Filtros = { periodo: "30d", obraId: null, almacenId: null };
// 15 de junio de 2026, 12:00 UTC.
const AHORA = Date.parse("2026-06-15T12:00:00.000Z");

describe("resolverVentana", () => {
  it("el periodo anterior dura exactamente lo mismo que el actual", () => {
    // Comparar 30 días contra un mes natural de 28 hace que febrero parezca
    // una caída del negocio.
    const v = resolverVentana(base, AHORA);
    expect(v.hastaMs - v.desdeMs).toBe(v.previoHastaMs - v.previoDesdeMs);
  });

  it("el periodo anterior termina donde empieza el actual", () => {
    const v = resolverVentana(base, AHORA);
    expect(v.previoHastaMs).toBe(v.desdeMs);
  });

  it("hoy arranca a medianoche, no hace 24 horas", () => {
    const v = resolverVentana({ ...base, periodo: "hoy" }, AHORA);
    const d = new Date(v.desdeMs);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  it("el trimestre empieza en el primer mes de su trimestre", () => {
    const v = resolverVentana({ ...base, periodo: "trimestre" }, AHORA);
    // Junio cae en el trimestre que abre en abril.
    expect(new Date(v.desdeMs).getMonth()).toBe(3);
  });

  it("un rango personalizado invertido se ordena en vez de romper", () => {
    const v = resolverVentana(
      {
        ...base,
        periodo: "personalizado",
        desde: "2026-06-10T00:00:00.000Z",
        hasta: "2026-06-01T00:00:00.000Z",
      },
      AHORA,
    );
    expect(v.desdeMs).toBeLessThan(v.hastaMs);
  });

  it("un rango personalizado ilegible cae a 30 días en vez de dar NaN", () => {
    const v = resolverVentana(
      { ...base, periodo: "personalizado", desde: "no-es-fecha" },
      AHORA,
    );
    expect(Number.isFinite(v.desdeMs)).toBe(true);
    expect(Number.isFinite(v.hastaMs)).toBe(true);
  });
});

describe("dentro", () => {
  it("acota por los dos extremos", () => {
    const v = resolverVentana(base, AHORA);
    expect(dentro("2026-06-14T00:00:00.000Z", v.desdeMs, v.hastaMs)).toBe(true);
    expect(dentro("2026-01-01T00:00:00.000Z", v.desdeMs, v.hastaMs)).toBe(false);
  });

  it("una fecha ilegible queda fuera, no dentro", () => {
    const v = resolverVentana(base, AHORA);
    expect(dentro("basura", v.desdeMs, v.hastaMs)).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe("estadoUmbral", () => {
  const masEsMejor: DefinicionKpi = {
    ...(definicion("entregas_completas") as DefinicionKpi),
  };
  const menosEsMejor: DefinicionKpi = {
    ...(definicion("compras_retrasadas") as DefinicionKpi),
  };

  it("con 'más es mejor', quedarse corto es lo malo", () => {
    expect(estadoUmbral(masEsMejor, 99)).toBe("normal");
    expect(estadoUmbral(masEsMejor, 90)).toBe("advertencia");
    expect(estadoUmbral(masEsMejor, 70)).toBe("critico");
  });

  it("con 'menos es mejor', pasarse es lo malo", () => {
    // El mismo comparador para ambos casos daría el semáforo invertido.
    expect(estadoUmbral(menosEsMejor, 0)).toBe("normal");
    expect(estadoUmbral(menosEsMejor, 2)).toBe("advertencia");
    expect(estadoUmbral(menosEsMejor, 9)).toBe("critico");
  });

  it("sin valor devuelve sin-datos, nunca normal", () => {
    expect(estadoUmbral(masEsMejor, null)).toBe("sin-datos");
  });
});

describe("catálogo", () => {
  it("no tiene identificadores repetidos", () => {
    const ids = new Set<string>();
    for (const k of [
      "obras_activas",
      "solicitudes_por_aprobar",
      "otif",
      "valor_inventario",
    ]) {
      expect(definicion(k)).toBeDefined();
      ids.add(k);
    }
    expect(ids.size).toBe(4);
  });

  it("toda métrica no calculable explica qué dato falta", () => {
    // Sin esta regla alguien 'arregla' el hueco inventando el dato.
    for (const id of ["otif", "cumplimiento_plan_obra", "exactitud_inventario"]) {
      const d = definicion(id);
      expect(d?.faltaDato, `${id} debe declarar el dato que falta`).toBeTruthy();
    }
  });

  it("toda métrica declara fórmula, unidad y visualización", () => {
    for (const id of ["obras_activas", "valor_inventario", "rotacion"]) {
      const d = definicion(id);
      expect(d?.formula).toBeTruthy();
      expect(d?.unidad).toBeTruthy();
      expect(d?.visualizacion).toBeTruthy();
    }
  });
});
