import { describe, expect, it } from "vitest";

import {
  aFechaIso,
  aNumero,
  analizar,
  buscarArticulo,
  claveFila,
  conciliar,
  detectarDuplicados,
  leerCsv,
  normalizarEncabezado,
  type PerfilImportacion,
} from "./importacion";

const perfil: PerfilImportacion = {
  id: "perfil-1",
  nombre: "Perfil ERP demo",
  tipo: "movimientos",
  separador: ";",
  columnas: {
    codigo: "Código Artículo",
    cantidad: "Cantidad",
    fecha: "Fecha",
    documento: "Documento",
  },
};

const archivo = [
  "Código Artículo;Cantidad;Fecha;Documento",
  "TOR-58;100;01/07/2026;FC-001",
  "ELE-6013;25,5;02/07/2026;FC-002",
].join("\n");

describe("normalización de encabezados", () => {
  it("iguala tildes, mayúsculas y espacios de más", () => {
    // Si el ERP escribe "CODIGO  ARTICULO", sigue siendo la misma columna.
    expect(normalizarEncabezado("Código Artículo")).toBe("codigo articulo");
    expect(normalizarEncabezado("CODIGO  ARTICULO ")).toBe("codigo articulo");
    expect(normalizarEncabezado(" código artículo")).toBe("codigo articulo");
  });
});

describe("lectura de CSV", () => {
  it("respeta las comillas y no parte el campo", () => {
    // Un split() partiría esta descripción por la mitad.
    const filas = leerCsv('a;b\n"Tubería 6"" SCH40; roja";10', ";");
    expect(filas[1][0]).toBe('Tubería 6" SCH40; roja');
    expect(filas[1][1]).toBe("10");
  });

  it("quita el BOM que mete Excel", () => {
    // Con BOM, la primera columna se llamaría "﻿Codigo" y no casaría.
    const filas = leerCsv("﻿Codigo;Cantidad\nA;1", ";");
    expect(filas[0][0]).toBe("Codigo");
  });

  it("ignora líneas en blanco", () => {
    expect(leerCsv("a;b\n\n1;2\n\n", ";")).toHaveLength(2);
  });

  it("soporta CRLF", () => {
    expect(leerCsv("a;b\r\n1;2", ";")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("conversión de cantidades", () => {
  it("acepta formato local y anglosajón", () => {
    expect(aNumero("1234.56")).toBe(1234.56);
    expect(aNumero("1234,56")).toBe(1234.56);
    expect(aNumero("1.234,56")).toBe(1234.56);
    expect(aNumero("1,234.56")).toBe(1234.56);
  });

  it("rechaza lo que no es un número", () => {
    expect(aNumero("")).toBeNull();
    expect(aNumero("N/A")).toBeNull();
  });
});

describe("conversión de fechas", () => {
  it("acepta ISO y d/m/aaaa", () => {
    expect(aFechaIso("2026-07-01")).toBe("2026-07-01");
    expect(aFechaIso("1/7/2026")).toBe("2026-07-01");
    expect(aFechaIso("01-07-2026")).toBe("2026-07-01");
  });

  it("rechaza lo que no reconoce en vez de inventar una fecha", () => {
    expect(aFechaIso("julio 2026")).toBeNull();
    expect(aFechaIso("")).toBeNull();
  });
});

describe("análisis con perfil", () => {
  it("localiza las columnas por nombre, no por posición", () => {
    // Se antepone una columna: un importador posicional guardaría basura.
    const conColumnaExtra = [
      "Sucursal;Código Artículo;Cantidad;Fecha;Documento",
      "Oriente;TOR-58;100;01/07/2026;FC-001",
    ].join("\n");
    const r = analizar(conColumnaExtra, perfil);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valor.filas[0].codigo).toBe("TOR-58");
    expect(r.valor.filas[0].cantidad).toBe(100);
  });

  it("da error explícito si falta una columna del perfil", () => {
    const sinDocumento = "Código Artículo;Cantidad;Fecha\nTOR-58;100;01/07/2026";
    const r = analizar(sinDocumento, perfil);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.detalle).toContain("Documento");
  });

  it("convierte cantidades y fechas de cada fila", () => {
    const r = analizar(archivo, perfil);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valor.filas).toHaveLength(2);
    expect(r.valor.filas[1].cantidad).toBe(25.5);
    expect(r.valor.filas[1].fecha).toBe("2026-07-02");
  });

  it("señala la línea exacta de cada fila mala y no la importa", () => {
    const conBasura = [
      "Código Artículo;Cantidad;Fecha;Documento",
      "TOR-58;100;01/07/2026;FC-001",
      ";50;01/07/2026;FC-002",
      "ELE-6013;N/A;01/07/2026;FC-003",
      "DIS-45;10;julio;FC-004",
    ].join("\n");

    const r = analizar(conBasura, perfil);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.valor.filas).toHaveLength(1);
    expect(r.valor.errores).toEqual([
      { linea: 3, motivo: "codigo", valor: "" },
      { linea: 4, motivo: "cantidad", valor: "N/A" },
      { linea: 5, motivo: "fecha", valor: "julio" },
    ]);
  });

  it("rechaza cantidades cero o negativas", () => {
    const r = analizar(
      "Código Artículo;Cantidad;Fecha;Documento\nTOR-58;0;01/07/2026;FC-001",
      perfil,
    );
    expect(r.ok && r.valor.filas).toHaveLength(0);
  });

  it("un archivo vacío no pasa por bueno", () => {
    expect(analizar("", perfil).ok).toBe(false);
  });
});

describe("idempotencia", () => {
  it("señala CUÁL fila se repite y de qué archivo viene", () => {
    // Decir solo "ya se cargó" es inútil si el ERP reexporta el mes entero.
    const r = analizar(archivo, perfil);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const yaCargadas = new Map([
      [r.valor.filas[0].clave, "compras-junio.csv"],
    ]);
    const duplicados = detectarDuplicados(r.valor.filas, yaCargadas);

    expect(duplicados).toHaveLength(1);
    expect(duplicados[0]).toMatchObject({
      linea: 2,
      codigo: "TOR-58",
      archivoPrevio: "compras-junio.csv",
    });
  });

  it("detecta la fila repetida dentro del propio archivo", () => {
    const conRepetida = [
      "Código Artículo;Cantidad;Fecha;Documento",
      "TOR-58;100;01/07/2026;FC-001",
      "TOR-58;100;01/07/2026;FC-001",
    ].join("\n");

    const r = analizar(conRepetida, perfil);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const duplicados = detectarDuplicados(r.valor.filas, new Map());
    expect(duplicados).toHaveLength(1);
    expect(duplicados[0].linea).toBe(3);
    expect(duplicados[0].archivoPrevio).toBe("línea 2");
  });

  it("no marca como duplicado lo que solo cambia en cantidad", () => {
    const filas = [
      { codigo: "TOR-58", cantidad: 100, fecha: "2026-07-01", documento: "FC-001" },
      { codigo: "TOR-58", cantidad: 50, fecha: "2026-07-01", documento: "FC-001" },
    ];
    expect(claveFila(filas[0])).not.toBe(claveFila(filas[1]));
  });

  it("la huella ignora mayúsculas y espacios del código", () => {
    expect(
      claveFila({ codigo: " tor-58 ", cantidad: 1, fecha: "2026-07-01", documento: "a" }),
    ).toBe(
      claveFila({ codigo: "TOR-58", cantidad: 1, fecha: "2026-07-01", documento: "A" }),
    );
  });
});

describe("búsqueda de artículo por código", () => {
  const catalogo = [
    { id: "a", codigo: "6X8AT" },
    { id: "b", codigo: "6x8AT" },
    { id: "c", codigo: "TOR-58" },
  ];

  it("la coincidencia exacta manda: son productos distintos", () => {
    // Trampa real de datos de producción: dos códigos que solo difieren en
    // una mayúscula pueden ser dos artículos diferentes.
    expect(buscarArticulo("6X8AT", catalogo)).toMatchObject({ id: "a" });
    expect(buscarArticulo("6x8AT", catalogo)).toMatchObject({ id: "b" });
  });

  it("el respaldo insensible resuelve solo si hay un único candidato", () => {
    expect(buscarArticulo("tor-58", catalogo)).toMatchObject({ id: "c" });
  });

  it("con dos candidatos se declara ambiguo en vez de elegir uno", () => {
    expect(buscarArticulo("6X8at", catalogo)).toBe("ambiguo");
  });

  it("ignora espacios alrededor", () => {
    expect(buscarArticulo("  TOR-58 ", catalogo)).toMatchObject({ id: "c" });
  });

  it("devuelve nulo si no existe", () => {
    expect(buscarArticulo("NO-EXISTE", catalogo)).toBeNull();
  });
});

describe("conciliación con el ERP", () => {
  const apolo = new Map([
    ["TOR-58", { descripcion: "Tornillo", cantidad: 37 }],
    ["ELE-6013", { descripcion: "Electrodo", cantidad: 100 }],
    ["DIS-45", { descripcion: "Disco", cantidad: 12 }],
  ]);

  it("reporta la diferencia con signo", () => {
    const dif = conciliar(
      [
        { codigo: "TOR-58", cantidad: 40 },
        { codigo: "ELE-6013", cantidad: 100 },
      ],
      apolo,
    );
    const tornillo = dif.find((d) => d.codigo === "TOR-58");
    expect(tornillo).toMatchObject({ segunErp: 40, segunApolo: 37, diferencia: 3 });
  });

  it("no reporta lo que cuadra", () => {
    const dif = conciliar([{ codigo: "ELE-6013", cantidad: 100 }], apolo);
    expect(dif.find((d) => d.codigo === "ELE-6013")).toBeUndefined();
  });

  it("lo que Apolo tiene y el ERP no menciona también es diferencia", () => {
    const dif = conciliar([{ codigo: "TOR-58", cantidad: 37 }], apolo);
    const soloApolo = dif.find((d) => d.codigo === "ELE-6013");
    expect(soloApolo).toMatchObject({ segunErp: 0, segunApolo: 100, diferencia: -100 });
  });

  it("ordena por la diferencia más grande en valor absoluto", () => {
    const dif = conciliar([{ codigo: "TOR-58", cantidad: 40 }], apolo);
    for (let i = 1; i < dif.length; i++) {
      expect(Math.abs(dif[i - 1].diferencia)).toBeGreaterThanOrEqual(
        Math.abs(dif[i].diferencia),
      );
    }
  });

  it("compara sin distinguir mayúsculas", () => {
    const dif = conciliar([{ codigo: "tor-58", cantidad: 37 }], apolo);
    expect(dif.find((d) => d.codigo === "TOR-58")).toBeUndefined();
  });
});
