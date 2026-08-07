import { describe, expect, it } from "vitest";

import {
  agruparRfq,
  calcularApu,
  cantidadFinal,
  desempeno,
  desviacionRendimiento,
  duracionDias,
  estimar,
  horasHombre,
  promedioIndice,
} from "@/lib/licitaciones/motor";
import { PARAMETROS_INICIALES, type ObraHistorica, type RenglonMto } from "@/lib/licitaciones/tipos";

const P = { ...PARAMETROS_INICIALES, costoHoraHombreUsd: 10, fas: 2, overhead: 0.2, utilidad: 0.1 };

const renglon = (extra: Partial<RenglonMto> = {}): RenglonMto => ({
  id: "r1",
  disciplina: "civil",
  codigo: "CON-280",
  descripcion: "Concreto premezclado",
  especificacion: "f'c=280 kg/cm2",
  unidad: "m3",
  cantidadBase: 100,
  factorDesperdicio: 0.05,
  costoMaterialUsd: 90,
  rendimientoHh: 2,
  costoEquipoUsd: 10,
  ...extra,
});

describe("cantidadFinal", () => {
  it("aplica el desperdicio sobre la base", () => {
    expect(cantidadFinal(100, 0.05)).toBe(105);
  });

  it("NO encadena el desperdicio", () => {
    // 5% sobre 100 son 105. Encadenarlo daria 110,25 y nadie sabria de donde.
    expect(cantidadFinal(cantidadFinal(100, 0.05), 0)).toBe(105);
  });

  it("sin desperdicio devuelve la base", () => {
    expect(cantidadFinal(100, 0)).toBe(100);
  });

  it("una base negativa no produce cantidad negativa", () => {
    expect(cantidadFinal(-5, 0.1)).toBe(0);
  });
});

describe("horasHombre", () => {
  it("multiplica cantidad por rendimiento", () => {
    expect(horasHombre(105, 2)).toBe(210);
  });

  it("no produce horas negativas", () => {
    expect(horasHombre(-5, 2)).toBe(0);
    expect(horasHombre(5, -2)).toBe(0);
  });
});

describe("duracionDias", () => {
  it("reparte las horas entre cuadrillas, personas y jornada", () => {
    // 240 HH / (3 cuadrillas x 1 persona x 8 h) = 10 dias.
    expect(duracionDias(240, 3, 8)).toBe(10);
  });

  it("cuenta las PERSONAS de la cuadrilla", () => {
    // La formula clasica HH/(cuadrillas x 8) trata cada cuadrilla como una
    // persona: 61.000 HH con 3 cuadrillas darian 2.975 dias, ocho años.
    const sinPersonas = duracionDias(61_499, 3, 8) as number;
    const conPersonas = duracionDias(61_499, 3, 8, 12) as number;
    expect(sinPersonas).toBeGreaterThan(2_500);
    expect(conPersonas).toBeLessThan(250);
    expect(conPersonas).toBeCloseTo(sinPersonas / 12, 5);
  });

  it("sin personas devuelve null", () => {
    expect(duracionDias(240, 3, 8, 0)).toBeNull();
  });

  it("sin cuadrillas devuelve null, no cero", () => {
    // Cero cuadrillas no son cero dias: es un plazo incalculable, y devolver 0
    // haria pensar que el trabajo es instantaneo.
    expect(duracionDias(240, 0, 8)).toBeNull();
    expect(duracionDias(240, 3, 0)).toBeNull();
  });

  it("mas cuadrillas acortan el plazo", () => {
    expect(duracionDias(240, 6, 8)).toBe(5);
  });
});

describe("calcularApu", () => {
  it("el FAS solo multiplica la mano de obra", () => {
    // 105 m3 x 2 HH = 210 HH x 10 USD x FAS 2 = 4200 de mano de obra.
    // Material: 105 x 90 = 9450. Equipos: 105 x 10 = 1050.
    // Si el FAS tocara el material, este saldria 18900 y la oferta se
    // inflaria un 40% perdiendo la licitacion.
    const a = calcularApu(renglon(), P);
    expect(a.materialesUsd).toBe(9450);
    expect(a.equiposUsd).toBe(1050);
    expect(a.manoObraUsd).toBe(4200);
  });

  it("aplica overhead y utilidad EN CASCADA, no sumados", () => {
    const a = calcularApu(renglon(), P);
    const directo = 9450 + 1050 + 4200; // 14700
    expect(a.costoDirectoUsd).toBe(directo);
    expect(a.indirectosUsd).toBeCloseTo(directo * 0.2);
    // Utilidad sobre (directo + indirectos), no sobre el directo.
    expect(a.utilidadUsd).toBeCloseTo(directo * 1.2 * 0.1);
    // 20% + 10% NO son 30%: son 32%.
    expect(a.totalUsd).toBeCloseTo(directo * 1.2 * 1.1);
    expect(a.totalUsd).toBeGreaterThan(directo * 1.3);
  });

  it("el precio unitario va sobre la cantidad final, no la del plano", () => {
    const a = calcularApu(renglon(), P);
    expect(a.precioUnitarioUsd).toBeCloseTo(a.totalUsd / 105);
  });

  it("usa el desperdicio por defecto cuando el renglon no trae el suyo", () => {
    const a = calcularApu(renglon({ factorDesperdicio: 0 }), { ...P, desperdicioPorDefecto: 0.1 });
    expect(a.cantidadFinal).toBeCloseTo(110);
  });

  it("una cantidad cero no rompe el precio unitario", () => {
    const a = calcularApu(renglon({ cantidadBase: 0 }), P);
    expect(Number.isFinite(a.precioUnitarioUsd)).toBe(true);
    expect(a.precioUnitarioUsd).toBe(0);
  });
});

describe("estimar", () => {
  const civil = renglon({ id: "a", disciplina: "civil", rendimientoHh: 2 });
  const piping = renglon({ id: "b", disciplina: "piping", codigo: "TUB-A106", rendimientoHh: 8 });

  it("EL PLAZO ES LA RUTA MAS LARGA, no la suma", () => {
    // Las disciplinas avanzan en paralelo: piping no espera a civil. Sumar los
    // plazos daria una oferta tres veces mas larga que la real.
    const e = estimar([civil, piping], P);
    const suma = e.porDisciplina.reduce((s, d) => s + d.dias, 0);
    const mayor = Math.max(...e.porDisciplina.map((d) => d.dias));
    expect(e.diasEstimados).toBe(mayor);
    expect(e.diasEstimados).toBeLessThan(suma);
  });

  it("suma los costos de todas las disciplinas", () => {
    const e = estimar([civil, piping], P);
    const a = calcularApu(civil, P);
    const b = calcularApu(piping, P);
    expect(e.totalUsd).toBeCloseTo(a.totalUsd + b.totalUsd);
  });

  it("agrupa por disciplina ordenando por monto", () => {
    const e = estimar([civil, piping], P);
    expect(e.porDisciplina[0].totalUsd).toBeGreaterThanOrEqual(e.porDisciplina[1].totalUsd);
  });

  it("sin renglones no inventa un proyecto", () => {
    const e = estimar([], P);
    expect(e.totalUsd).toBe(0);
    expect(e.diasEstimados).toBe(0);
  });
});

describe("desempeno", () => {
  const obra: ObraHistorica = {
    codigo: "OBR-2301", nombre: "Planta", anio: 2024,
    pvUsd: 1_000_000, evUsd: 900_000, acUsd: 1_100_000,
    horasHombre: 40_000, toneladasAcero: 200, m3Concreto: 1_000,
  };

  it("SPI y CPI se leen contra 1", () => {
    const d = desempeno(obra);
    expect(d.spi).toBeCloseTo(0.9); // atrasado
    expect(d.cpi).toBeCloseTo(0.818, 2); // sobrecosto
  });

  it("sin presupuesto el indice es null, no Infinity", () => {
    const d = desempeno({ ...obra, pvUsd: 0, acUsd: 0 });
    expect(d.spi).toBeNull();
    expect(d.cpi).toBeNull();
  });

  it("calcula ratios de rendimiento", () => {
    const d = desempeno(obra);
    expect(d.hhPorTonelada).toBe(200);
    expect(d.hhPorM3).toBe(40);
  });

  it("el promedio ignora las obras sin el indice", () => {
    const p = promedioIndice([obra, { ...obra, pvUsd: 0 }], (d) => d.spi);
    expect(p).toBeCloseTo(0.9);
  });

  it("sin obras comparables devuelve null", () => {
    expect(promedioIndice([], (d) => d.spi)).toBeNull();
  });
});

describe("desviacionRendimiento", () => {
  it("positivo = la estimacion es mas optimista que la historia", () => {
    // Se estima 150 HH/t cuando historicamente son 200: 25% mas optimista.
    expect(desviacionRendimiento(150, 200)).toBeCloseTo(25);
  });

  it("negativo = se estima mas conservador", () => {
    expect(desviacionRendimiento(250, 200)).toBeCloseTo(-25);
  });

  it("sin historico no hay comparacion", () => {
    expect(desviacionRendimiento(150, null)).toBeNull();
    expect(desviacionRendimiento(150, 0)).toBeNull();
  });
});

describe("agruparRfq", () => {
  it("agrupa por familia del codigo", () => {
    const apus = estimar(
      [
        renglon({ id: "1", codigo: "TUB-4-A106", disciplina: "piping" }),
        renglon({ id: "2", codigo: "TUB-6-A106", disciplina: "piping" }),
        renglon({ id: "3", codigo: "VAL-4-150", disciplina: "piping" }),
      ],
      P,
    ).apus;
    const fam = agruparRfq(apus);
    expect(fam.find((f) => f.familia === "TUB")?.renglones).toBe(2);
    expect(fam.find((f) => f.familia === "VAL")?.renglones).toBe(1);
  });

  it("el monto de la RFQ es SOLO material", () => {
    // A un proveedor no se le pide que cotice la mano de obra ni la utilidad
    // de la constructora.
    const apus = estimar([renglon()], P).apus;
    const fam = agruparRfq(apus);
    expect(fam[0].montoEstimadoUsd).toBe(9450);
    expect(fam[0].montoEstimadoUsd).toBeLessThan(apus[0].totalUsd);
  });

  it("no mezcla familias de disciplinas distintas", () => {
    const apus = estimar(
      [
        renglon({ id: "1", codigo: "SOP-01", disciplina: "piping" }),
        renglon({ id: "2", codigo: "SOP-01", disciplina: "estructural" }),
      ],
      P,
    ).apus;
    expect(agruparRfq(apus)).toHaveLength(2);
  });
});
