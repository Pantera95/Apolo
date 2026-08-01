import { describe, expect, it } from "vitest";

import { aCSV, BOM, escaparCsv, nombreArchivo } from "./csv";

interface Fila {
  codigo: string;
  descripcion: string;
  cantidad: number;
}

const columnas = [
  { clave: "codigo", titulo: "Código", valor: (f: Fila) => f.codigo },
  { clave: "descripcion", titulo: "Descripción", valor: (f: Fila) => f.descripcion },
  { clave: "cantidad", titulo: "Cantidad", valor: (f: Fila) => f.cantidad },
];

describe("escapado", () => {
  it("deja en paz lo que no necesita comillas", () => {
    expect(escaparCsv("TOR-58", ";")).toBe("TOR-58");
    expect(escaparCsv(42, ";")).toBe("42");
  });

  it("entrecomilla cuando aparece el separador", () => {
    expect(escaparCsv("Anaco; El Tigre", ";")).toBe('"Anaco; El Tigre"');
  });

  it("duplica las comillas internas", () => {
    // Una descripción como: Tubería 6" SCH40
    expect(escaparCsv('Tubería 6" SCH40', ";")).toBe('"Tubería 6"" SCH40"');
  });

  it("entrecomilla los saltos de línea", () => {
    expect(escaparCsv("linea1\nlinea2", ";")).toBe('"linea1\nlinea2"');
  });

  it("convierte nulo y ausente en celda vacía", () => {
    expect(escaparCsv(null, ";")).toBe("");
    expect(escaparCsv(undefined, ";")).toBe("");
  });
});

describe("generación", () => {
  it("escribe cabecera y filas separadas por CRLF", () => {
    const csv = aCSV(columnas, [
      { codigo: "TOR-58", descripcion: "Tornillo", cantidad: 100 },
    ]);
    expect(csv).toBe("Código;Descripción;Cantidad\r\nTOR-58;Tornillo;100");
  });

  it("respeta el separador pedido", () => {
    const csv = aCSV(
      columnas,
      [{ codigo: "A", descripcion: "B", cantidad: 1 }],
      ",",
    );
    expect(csv).toBe("Código,Descripción,Cantidad\r\nA,B,1");
  });

  it("un valor con el separador nuevo se entrecomilla, y con el viejo no", () => {
    const filas = [{ codigo: "A", descripcion: "uno, dos", cantidad: 1 }];
    expect(aCSV(columnas, filas, ";")).toContain("uno, dos;");
    expect(aCSV(columnas, filas, ",")).toContain('"uno, dos"');
  });

  it("sin filas deja solo la cabecera", () => {
    expect(aCSV(columnas, [])).toBe("Código;Descripción;Cantidad");
  });
});

describe("nombre de archivo", () => {
  const fecha = new Date("2026-08-01T12:00:00.000Z");

  it("incluye la fecha para que dos descargas no se pisen", () => {
    expect(nombreArchivo("Kardex", fecha)).toBe("apolo-kardex-2026-08-01.csv");
  });

  it("quita tildes y espacios", () => {
    expect(nombreArchivo("Deuda de herramienta", fecha)).toBe(
      "apolo-deuda-de-herramienta-2026-08-01.csv",
    );
    expect(nombreArchivo("Existencia valorizada", fecha)).toBe(
      "apolo-existencia-valorizada-2026-08-01.csv",
    );
  });
});

describe("compatibilidad con Excel", () => {
  it("el BOM existe y es el carácter correcto", () => {
    // Sin él, Excel lee Latin-1 y "Rondón" sale como "RondÃ³n".
    expect(BOM).toBe("﻿");
    expect(BOM.charCodeAt(0)).toBe(0xfeff);
  });
});
