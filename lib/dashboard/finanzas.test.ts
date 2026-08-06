import { describe, expect, it } from "vitest";

import {
  anualizar,
  apalancamientoTotal,
  beneficioPorAccion,
  calcularFinanzas,
  diasDeInventario,
  div,
  endeudamientoCortoPlazo,
  endeudamientoLargoPlazo,
  endeudamientoTotal,
  fondoDeManiobra,
  importarEstadosFinancieros,
  indiceRotacion,
  margenUtilidadBruta,
  pruebaAcida,
  razonCorriente,
  rentabilidadSobreVentas,
  roa,
  roe,
  rotacionCartera,
  rotacionProveedores,
  type DerivadoDeApolo,
} from "@/lib/dashboard/finanzas";

const DERIVADO: DerivadoDeApolo = {
  inventarioValorizado: 125_000,
  consumoACoste: 30_000,
  comprometidoConProveedores: 47_000,
  diasDelPeriodo: 30,
};

describe("div", () => {
  it("no devuelve Infinity ni NaN", () => {
    expect(div(5, 0)).toBeNull();
    expect(div(0, 0)).toBeNull();
    expect(div(undefined, 5)).toBeNull();
    expect(div(5, undefined)).toBeNull();
  });

  it("divide cuando puede", () => {
    expect(div(10, 4)).toBe(2.5);
  });
});

describe("liquidez", () => {
  it("fondo de maniobra es la resta, y puede ser negativo", () => {
    expect(fondoDeManiobra(180, 120)).toBe(60);
    // Un fondo negativo es un dato real —desequilibrio—, no un error.
    expect(fondoDeManiobra(100, 150)).toBe(-50);
  });

  it("razón corriente reproduce el ejemplo del enunciado", () => {
    // 180M de activo corriente contra 120M de pasivo corriente.
    expect(razonCorriente(180_000_000, 120_000_000)).toBeCloseTo(1.5);
  });

  it("prueba ácida descuenta el inventario del activo corriente", () => {
    expect(pruebaAcida(200, 50, 100)).toBeCloseTo(1.5);
  });

  it("sin pasivo corriente no hay ratio de liquidez", () => {
    expect(razonCorriente(180, 0)).toBeNull();
    expect(pruebaAcida(200, 50, 0)).toBeNull();
  });
});

describe("endeudamiento", () => {
  it("endeudamiento total reproduce el ejemplo del enunciado", () => {
    // Pasivo 90.000 sobre activo 600.000 = 15%.
    expect(endeudamientoTotal(90_000, 600_000)).toBeCloseTo(15);
  });

  it("devuelve porcentaje, no fracción", () => {
    // Un 15% tiene que salir 15, no 0,15: la tarjeta lo pinta con el signo %.
    expect(endeudamientoTotal(90_000, 600_000)).toBeGreaterThan(1);
  });

  it("corto plazo sobre patrimonio, en porcentaje", () => {
    expect(endeudamientoCortoPlazo(25, 100)).toBeCloseTo(25);
  });

  it("largo plazo y apalancamiento son razones, no porcentajes", () => {
    expect(endeudamientoLargoPlazo(50, 100)).toBeCloseTo(0.5);
    expect(apalancamientoTotal(80, 100)).toBeCloseTo(0.8);
  });

  it("sin patrimonio no hay apalancamiento", () => {
    expect(apalancamientoTotal(80, 0)).toBeNull();
  });
});

describe("rentabilidad", () => {
  it("ROA reproduce el ejemplo del enunciado", () => {
    // 8M de utilidad neta sobre 60M de activos ≈ 13%.
    expect(roa(8_000_000, 60_000_000)).toBeCloseTo(13.33, 1);
  });

  it("margen bruto da porcentaje legible, no la razón entre cien", () => {
    // El enunciado escribe UB/(VN*100), que daría 0,002 para un margen del 20%.
    // Se implementa la fórmula correcta.
    expect(margenUtilidadBruta(20, 100)).toBeCloseTo(20);
  });

  it("rentabilidad sobre ventas hace lo mismo", () => {
    expect(rentabilidadSobreVentas(10, 100)).toBeCloseTo(10);
  });

  it("ROE distingue pérdida de ausencia de datos", () => {
    expect(roe(-5_000, 100_000)).toBeCloseTo(-5);
    expect(roe(undefined, 100_000)).toBeNull();
  });

  it("beneficio por acción sin acciones es null", () => {
    expect(beneficioPorAccion(1000, 0)).toBeNull();
    expect(beneficioPorAccion(1000, 250)).toBe(4);
  });
});

describe("gestion", () => {
  it("índice de rotación reproduce el ejemplo del enunciado", () => {
    // 40M a coste sobre 5M de inventario promedio = 8 vueltas.
    expect(indiceRotacion(40_000_000, 5_000_000)).toBe(8);
  });

  it("días de inventario anualiza sobre 365", () => {
    // 5M de inventario contra 40M de costo anual ≈ 45,6 días.
    expect(diasDeInventario(5_000_000, 40_000_000)).toBeCloseTo(45.6, 1);
  });

  it("rotación de cartera y de proveedores", () => {
    expect(rotacionCartera(120, 30)).toBe(4);
    expect(rotacionProveedores(50, 200)).toBe(0.25);
  });

  it("sin costo de ventas no hay días de inventario", () => {
    expect(diasDeInventario(5_000, 0)).toBeNull();
  });
});

describe("anualizar", () => {
  it("lleva el consumo del periodo a base anual", () => {
    // 30.000 en 30 días son 365.000 al año.
    expect(anualizar(30_000, 30)).toBeCloseTo(365_000);
  });

  it("sin días no divide por cero", () => {
    expect(anualizar(30_000, 0)).toBe(0);
  });
});

describe("calcularFinanzas", () => {
  it("devuelve los diecisiete indicadores", () => {
    const r = calcularFinanzas({}, DERIVADO);
    expect(r).toHaveLength(17);
  });

  it("sin balance declarado, los ratios contables quedan sin datos", () => {
    const r = calcularFinanzas({}, DERIVADO);
    const roaCalc = r.find((x) => x.id === "roa");
    expect(roaCalc?.valor).toBeNull();
    expect(roaCalc?.veredicto).toBe("sin-datos");
    // Y dice qué falta, en vez de callarse.
    expect(roaCalc?.falta.length).toBeGreaterThan(0);
  });

  it("lo que Apolo sí sabe se calcula sin balance", () => {
    const r = calcularFinanzas({}, DERIVADO);
    const inv = r.find((x) => x.id === "inventario_valorizado");
    expect(inv?.valor).toBe(125_000);
    expect(inv?.origen).toBe("derivado");

    const rot = r.find((x) => x.id === "indice_rotacion");
    expect(rot?.valor).not.toBeNull();
    // Se marca como mixto: usa consumo del kardex, no ventas declaradas.
    expect(rot?.origen).toBe("mixto");
  });

  it("el inventario declarado gana al derivado", () => {
    const r = calcularFinanzas({ inventario: 999 }, DERIVADO);
    const acida = r.find((x) => x.id === "prueba_acida");
    expect(acida?.origen).toBe("declarado");
  });

  it("marca el veredicto según las bandas del enunciado", () => {
    const r = calcularFinanzas(
      { activoCorriente: 300, pasivoCorriente: 100, pasivoTotal: 50, activoTotal: 500 },
      DERIVADO,
    );
    // RC = 3 > 2 → cubre holgadamente.
    expect(r.find((x) => x.id === "razon_corriente")?.veredicto).toBe("bueno");
    // FM = 200 ≥ 0 → equilibrio.
    expect(r.find((x) => x.id === "fondo_maniobra")?.veredicto).toBe("bueno");
    // ET = 10% → bajo riesgo.
    expect(r.find((x) => x.id === "endeudamiento_total")?.veredicto).toBe("bueno");
  });

  it("un fondo de maniobra negativo sale como desequilibrio", () => {
    const r = calcularFinanzas({ activoCorriente: 50, pasivoCorriente: 200 }, DERIVADO);
    const fm = r.find((x) => x.id === "fondo_maniobra");
    expect(fm?.valor).toBe(-150);
    expect(fm?.veredicto).toBe("malo");
  });
});

describe("importarEstadosFinancieros", () => {
  it("lee el formato concepto;valor", () => {
    const csv = "Concepto;Valor\r\nActivo corriente;180000\r\nPasivo corriente;120000";
    const r = importarEstadosFinancieros(csv);
    expect(r.estados.activoCorriente).toBe(180_000);
    expect(r.estados.pasivoCorriente).toBe(120_000);
    expect(r.errores).toHaveLength(0);
  });

  it("detecta el separador en vez de exigir uno", () => {
    // Excel en inglés exporta con coma; en español con punto y coma.
    const conComa = "Concepto,Valor\r\nActivo total,600000";
    expect(importarEstadosFinancieros(conComa).estados.activoTotal).toBe(600_000);
  });

  it("acepta el concepto sin tildes y en cualquier caja", () => {
    const csv = "PATRIMONIO NETO;500000";
    expect(importarEstadosFinancieros(csv).estados.patrimonioNeto).toBe(500_000);
  });

  it("informa de los conceptos que no supo interpretar", () => {
    // No se descartan en silencio: quien importa tiene que ver que su fila
    // no entró en ningún indicador.
    const csv = "Caja y bancos;5000\r\nActivo total;600000";
    const r = importarEstadosFinancieros(csv);
    expect(r.desconocidos).toContain("Caja y bancos");
    expect(r.estados.activoTotal).toBe(600_000);
  });

  it("señala la fila cuando el valor no es un número", () => {
    const csv = "Activo total;no-es-numero";
    const r = importarEstadosFinancieros(csv);
    expect(r.errores).toHaveLength(1);
    expect(r.errores[0]).toContain("Fila 1");
    expect(r.estados.activoTotal).toBeUndefined();
  });

  it("un archivo vacío es un error explícito, no un balance en cero", () => {
    const r = importarEstadosFinancieros("");
    expect(r.errores.length).toBeGreaterThan(0);
    expect(Object.keys(r.estados)).toHaveLength(0);
  });
});
