import { describe, expect, it } from "vitest";

import {
  computoSimulado,
  HISTORICO_DEMO,
  ingestaLocal,
  leerScheduleCsv,
  plantillaScheduleCsv,
  origenPorExtension,
} from "@/lib/licitaciones/ingesta";

describe("leerScheduleCsv", () => {
  const cab = "Disciplina;Codigo;Descripcion;Especificacion;Unidad;Cantidad;Desperdicio;Costo material;Rendimiento HH;Costo equipo";

  it("lee un renglon completo", () => {
    const r = leerScheduleCsv(`${cab}\r\nPiping;TUB-6;Tuberia;A106;m;100;0.05;62;1.35;3.8`, "s.csv");
    expect(r.renglones).toHaveLength(1);
    expect(r.renglones[0].disciplina).toBe("piping");
    expect(r.renglones[0].cantidadBase).toBe(100);
    expect(r.simulado).toBe(false);
  });

  it("normaliza los alias de disciplina", () => {
    const r = leerScheduleCsv(`Tuberias;A;B;C;m;10;;;;`, "s.csv");
    expect(r.renglones[0].disciplina).toBe("piping");
  });

  it("AVISA de las filas ilegibles en vez de descartarlas", () => {
    // Un computo al que le faltan renglones en silencio produce una oferta por
    // debajo del costo y nadie se entera hasta ganar la licitacion.
    const r = leerScheduleCsv(`${cab}\r\nCivil;A;B;C;m3;no-es-numero;;;;`, "s.csv");
    expect(r.renglones).toHaveLength(0);
    expect(r.avisos.some((a) => a.includes("ilegible"))).toBe(true);
  });

  it("detecta el separador", () => {
    const r = leerScheduleCsv(`Civil,A,B,C,m3,50,,,,`, "s.csv");
    expect(r.renglones[0].cantidadBase).toBe(50);
  });

  it("un archivo sin renglones reconocibles lo dice", () => {
    const r = leerScheduleCsv("basura", "s.csv");
    expect(r.avisos.length).toBeGreaterThan(0);
  });

  it("la plantilla se lee a si misma", () => {
    const r = leerScheduleCsv(plantillaScheduleCsv(), "plantilla.csv");
    expect(r.renglones).toHaveLength(2);
  });

  it("sobrevive a la marca de pulgada en la descripcion", () => {
    // Los diametros se escriben 6", 3/4"... Una comilla sin escapar rompe el
    // parseo y se pierde el renglon entero.
    const r = leerScheduleCsv(plantillaScheduleCsv(), "plantilla.csv");
    expect(r.renglones[1].descripcion).toContain('6"');
  });
});

describe("computoSimulado", () => {
  it("se marca SIEMPRE como simulado", () => {
    // Nunca se presenta como si viniera del archivo.
    const r = computoSimulado("modelo.rvt", "revit");
    expect(r.simulado).toBe(true);
    expect(r.avisos.length).toBeGreaterThan(0);
  });

  it("cubre las seis disciplinas", () => {
    const r = computoSimulado("m.rvt", "revit");
    const d = new Set(r.renglones.map((x) => x.disciplina));
    expect(d.size).toBe(6);
  });

  it("las cantidades son positivas y con especificacion", () => {
    for (const x of computoSimulado("m.rvt", "revit").renglones) {
      expect(x.cantidadBase).toBeGreaterThan(0);
      expect(x.especificacion.length).toBeGreaterThan(0);
    }
  });
});

describe("historico", () => {
  it("trae obras con valor ganado y costo real", () => {
    expect(HISTORICO_DEMO.length).toBeGreaterThanOrEqual(4);
    for (const o of HISTORICO_DEMO) {
      expect(o.pvUsd).toBeGreaterThan(0);
      expect(o.acUsd).toBeGreaterThan(0);
      expect(o.toneladasAcero).toBeGreaterThan(0);
    }
  });

  it("incluye obras buenas y malas: si todas cumplen, no hay nada que aprender", () => {
    const conSobrecosto = HISTORICO_DEMO.filter((o) => o.acUsd > o.evUsd);
    const sinSobrecosto = HISTORICO_DEMO.filter((o) => o.acUsd <= o.evUsd);
    expect(conSobrecosto.length).toBeGreaterThan(0);
    expect(sinSobrecosto.length).toBeGreaterThan(0);
  });
});

describe("el origen que se informa es el real, no el declarado", () => {
  /**
   * Este fallo se vio en pantalla, no leyendo el codigo: con el selector en su
   * valor por defecto y un `.rvt` arrastrado encima, la vista previa del
   * mensaje decia "Origen: Schedule en CSV" sobre un computo SIMULADO. Ese
   * encabezado viaja al PDF y a la mesa de licitacion.
   */
  it("un .rvt subido con el selector en CSV se informa como Revit", async () => {
    const archivo = new File(["x"], "plataforma.rvt");
    const r = await ingestaLocal().procesar(archivo, "csv");
    expect(r.origen).toBe("revit");
    expect(r.simulado).toBe(true);
  });

  it("y avisa de la discrepancia en vez de corregirla en silencio", async () => {
    const archivo = new File(["x"], "plataforma.rvt");
    const r = await ingestaLocal().procesar(archivo, "csv");
    expect(r.avisos.some((a) => /Manda la extensi/.test(a))).toBe(true);
  });

  it("un CSV subido declarando Revit se lee como CSV, no se simula", async () => {
    const csv = "Civil;CIV-CON-04;Concreto;f'c=280;m3;100;0.05;118;2.4;14";
    const r = await ingestaLocal().procesar(new File([csv], "schedule.csv"), "revit");
    expect(r.simulado).toBe(false);
    expect(r.origen).toBe("csv");
    expect(r.renglones).toHaveLength(1);
  });

  it("sin discrepancia no inventa avisos", async () => {
    const r = await ingestaLocal().procesar(new File(["x"], "modelo.rvt"), "revit");
    expect(r.avisos.some((a) => /Manda la extensi/.test(a))).toBe(false);
  });

  it("una extension desconocida respeta lo declarado", () => {
    expect(origenPorExtension("modelo.zip")).toBeNull();
  });
});
