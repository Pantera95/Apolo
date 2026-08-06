import { describe, expect, it } from "vitest";

import {
  AVISO_CONSUMO,
  avanceContraPresupuesto,
  deudaEscalada,
  diasVencidos,
  estadoPresupuesto,
  importarPresupuesto,
  resumirEscalado,
  tramoDe,
  verificarCierre,
  type DeudaEscalada,
  type Presupuesto,
} from "@/lib/datos/obra-premium";
import { ESTADO_APOLO_VACIO, type EstadoApolo } from "@/lib/db/almacen";
import type { Articulo, Asiento, Obra, Saldo } from "@/lib/dominio/tipos";

const AHORA = Date.parse("2026-08-06T12:00:00.000Z");
const hace = (dias: number) => new Date(AHORA - dias * 86_400_000).toISOString();

const OBRA: Obra = {
  id: "o1",
  codigo: "OBR-2401",
  nombre: "Planta",
  ubicacionGeografica: "Lechería",
  estado: "activa",
};

const art = (codigo: string, clase: Articulo["clase"], costo: number): Articulo => ({
  id: `a-${codigo}`,
  codigo,
  descripcion: codigo,
  clase,
  unidadBase: "und",
  costoPromedioUsd: costo,
  activo: true,
});

const CEMENTO = art("CEM-42R", "consumible", 10);
const TALADRO = art("TAL-01", "retornable", 200);

const SALDO_CERO: Saldo = { fisico: 0, reservado: 0, averiado: 0, enTransito: 0, enObra: 0 };

function asiento(a: Partial<Asiento> & { articuloId: string; enObra: number; fecha: string }): Asiento {
  return {
    id: `as-${Math.random()}`,
    fecha: a.fecha,
    tipo: "despacho",
    articuloId: a.articuloId,
    almacenId: "alm",
    ubicacionId: "ub",
    delta: { ...SALDO_CERO, enObra: a.enObra },
    usuarioId: a.usuarioId ?? "almacen1",
    obraId: "o1",
  } as Asiento;
}

function estadoCon(asientos: Asiento[], extra: Partial<EstadoApolo> = {}): EstadoApolo {
  return {
    ...ESTADO_APOLO_VACIO,
    articulos: [CEMENTO, TALADRO],
    obras: [OBRA],
    ...extra,
    inventario: { saldos: new Map(), asientos },
  };
}

// ---------------------------------------------------------------------------

describe("avanceContraPresupuesto", () => {
  const presupuesto: Presupuesto = {
    lineas: [{ obraCodigo: "OBR-2401", articuloCodigo: "CEM-42R", cantidad: 100, costoUnitarioUsd: 10 }],
    importadoEn: hace(30),
    archivo: "p.csv",
  };

  it("compara el consumo real contra lo presupuestado", () => {
    const e = estadoCon([asiento({ articuloId: CEMENTO.id, enObra: 60, fecha: hace(5) })]);
    const a = avanceContraPresupuesto(e, OBRA, presupuesto);
    expect(a.presupuestadoUsd).toBe(1000);
    expect(a.consumidoUsd).toBe(600);
    expect(a.consumo).toBeCloseTo(0.6);
  });

  it("NO suma comprometido dentro de consumido", () => {
    // Lo comprometido todavia se puede parar; lo consumido ya no. Fundirlos
    // quitaria al gerente la unica ventana en la que puede actuar.
    const e = estadoCon([asiento({ articuloId: CEMENTO.id, enObra: 60, fecha: hace(5) })], {
      solicitudes: [
        {
          id: "s1",
          codigo: "SOL-1",
          obraId: "o1",
          estado: "aprobada",
          lineas: [{ articuloId: CEMENTO.id, cantidadSolicitada: 20, cantidadDespachada: 0 }],
          creadaPor: "u1",
          fecha: hace(2),
        },
      ],
    });
    const a = avanceContraPresupuesto(e, OBRA, presupuesto);
    expect(a.consumidoUsd).toBe(600);
    expect(a.comprometidoUsd).toBe(200);
    // El consumo del presupuesto SI cuenta las dos: es lo ya reservado.
    expect(a.consumo).toBeCloseTo(0.8);
  });

  it("enseña el consumo de un articulo que nadie presupuesto", () => {
    // Omitirlo escondería exactamente la desviación que hay que ver.
    const e = estadoCon([asiento({ articuloId: TALADRO.id, enObra: 2, fecha: hace(3) })]);
    const a = avanceContraPresupuesto(e, OBRA, presupuesto);
    const r = a.renglones.find((x) => x.articuloCodigo === "TAL-01");
    expect(r).toBeDefined();
    expect(r?.presupuestadoUsd).toBe(0);
    expect(r?.desviacionUsd).toBe(400);
  });

  it("sin presupuesto el consumo es null, no cero", () => {
    const e = estadoCon([asiento({ articuloId: CEMENTO.id, enObra: 10, fecha: hace(1) })]);
    const a = avanceContraPresupuesto(e, OBRA, null);
    expect(a.consumo).toBeNull();
    expect(estadoPresupuesto(a.consumo)).toBe("sin-presupuesto");
  });

  it("ordena los excedidos por desviacion", () => {
    const e = estadoCon([
      asiento({ articuloId: CEMENTO.id, enObra: 200, fecha: hace(4) }),
      asiento({ articuloId: TALADRO.id, enObra: 1, fecha: hace(4) }),
    ]);
    const a = avanceContraPresupuesto(e, OBRA, presupuesto);
    expect(a.excedidos[0].articuloCodigo).toBe("CEM-42R");
  });

  it("solo cuenta las lineas de SU obra", () => {
    const p: Presupuesto = {
      ...presupuesto,
      lineas: [
        ...presupuesto.lineas,
        { obraCodigo: "OTRA", articuloCodigo: "CEM-42R", cantidad: 999, costoUnitarioUsd: 10 },
      ],
    };
    const a = avanceContraPresupuesto(estadoCon([]), OBRA, p);
    expect(a.presupuestadoUsd).toBe(1000);
  });
});

describe("estadoPresupuesto", () => {
  it("avisa antes de excederse, no despues", () => {
    expect(estadoPresupuesto(0.5)).toBe("normal");
    expect(estadoPresupuesto(AVISO_CONSUMO)).toBe("aviso");
    expect(estadoPresupuesto(1.2)).toBe("excedido");
  });
});

describe("importarPresupuesto", () => {
  const validos = new Set(["CEM-42R", "TAL-01"]);

  it("lee obra, articulo, cantidad y costo", () => {
    const csv = "Obra;Articulo;Cantidad;Costo unitario\r\nOBR-2401;CEM-42R;100;10";
    const r = importarPresupuesto(csv, validos);
    expect(r.lineas).toHaveLength(1);
    expect(r.lineas[0].cantidad).toBe(100);
    expect(r.errores).toHaveLength(0);
  });

  it("informa de los codigos que no estan en el catalogo", () => {
    // Un codigo mal escrito nunca se cruzaria con un consumo y la obra
    // pareceria gastar de menos.
    const csv = "OBR-2401;NO-EXISTE;10;5";
    const r = importarPresupuesto(csv, validos);
    expect(r.desconocidos).toContain("NO-EXISTE");
  });

  it("rechaza cantidades negativas", () => {
    const csv = "OBR-2401;CEM-42R;-5;10";
    const r = importarPresupuesto(csv, validos);
    expect(r.lineas).toHaveLength(0);
    expect(r.errores[0]).toContain("negativos");
  });

  it("detecta el separador", () => {
    expect(importarPresupuesto("OBR-2401,CEM-42R,10,5", validos).lineas).toHaveLength(1);
  });

  it("un archivo vacio es error explicito", () => {
    expect(importarPresupuesto("", validos).errores.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------

describe("verificarCierre", () => {
  it("una obra limpia se puede cerrar", () => {
    expect(verificarCierre(estadoCon([]), OBRA, AHORA).puedeCerrar).toBe(true);
  });

  it("la herramienta sin retornar BLOQUEA", () => {
    // Cerrar con deuda viva la haria desaparecer del panel sin resolverse.
    const e = estadoCon([asiento({ articuloId: TALADRO.id, enObra: 3, fecha: hace(10) })]);
    const c = verificarCierre(e, OBRA, AHORA);
    expect(c.puedeCerrar).toBe(false);
    expect(c.bloqueos.some((b) => b.id === "herramienta")).toBe(true);
  });

  it("las solicitudes abiertas bloquean", () => {
    const e = estadoCon([], {
      solicitudes: [
        {
          id: "s1", codigo: "SOL-1", obraId: "o1", estado: "solicitada",
          lineas: [], creadaPor: "u1", fecha: hace(1),
        },
      ],
    });
    expect(verificarCierre(e, OBRA, AHORA).puedeCerrar).toBe(false);
  });

  it("las discrepancias bloquean: es dinero que no cuadra", () => {
    const e = estadoCon([], {
      despachos: [
        {
          id: "d1", codigo: "DSP-1", solicitudId: "s1", obraId: "o1",
          estado: "con_discrepancia", transporte: "flota", lineas: [], creadoEn: hace(3),
        },
      ],
    });
    const c = verificarCierre(e, OBRA, AHORA);
    expect(c.puedeCerrar).toBe(false);
    expect(c.bloqueos.some((b) => b.id === "discrepancias")).toBe(true);
  });

  it("las ordenes de compra son ADVERTENCIA, no bloqueo", () => {
    // Apolo no asocia ordenes a obras: afirmar que es de ESTA seria inventar.
    const e = estadoCon([], {
      ordenes: [
        {
          id: "oc1", codigo: "OC-1", proveedorId: "p1", estado: "enviada",
          fechaEmision: hace(20), fechaEsperada: hace(5),
          lineas: [{ articuloId: CEMENTO.id, cantidadPedida: 10, cantidadRecibida: 0, costoUnitarioUsd: 10 }],
        },
      ],
    });
    const c = verificarCierre(e, OBRA, AHORA);
    expect(c.puedeCerrar).toBe(true);
    expect(c.advertencias.some((a) => a.id === "compras")).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe("escalado de deuda", () => {
  it("clasifica por tramos de antiguedad", () => {
    expect(tramoDe(5)).toBe("reciente");
    expect(tramoDe(35)).toBe("30");
    expect(tramoDe(70)).toBe("60");
    expect(tramoDe(120)).toBe("90");
  });

  it("el borde exacto entra en el tramo", () => {
    expect(tramoDe(30)).toBe("30");
    expect(tramoDe(90)).toBe("90");
  });

  it("recoge el responsable del asiento de salida", () => {
    const e = estadoCon([
      asiento({ articuloId: TALADRO.id, enObra: 2, fecha: hace(70), usuarioId: "jperez" }),
    ]);
    const d = deudaEscalada(e, "o1", AHORA);
    expect(d[0].responsable).toBe("jperez");
    expect(d[0].tramo).toBe("60");
  });

  it("el valor en riesgo cuenta desde 60 dias", () => {
    // A los tres meses la conversacion ya no es recuperarla, es darla de baja.
    const deudas: DeudaEscalada[] = [
      { articuloCodigo: "A", descripcion: "A", unidades: 1, valorUsd: 100, diasMax: 10, tramo: "reciente", responsable: "x", desde: hace(10) },
      { articuloCodigo: "B", descripcion: "B", unidades: 1, valorUsd: 200, diasMax: 70, tramo: "60", responsable: "x", desde: hace(70) },
      { articuloCodigo: "C", descripcion: "C", unidades: 1, valorUsd: 300, diasMax: 120, tramo: "90", responsable: "x", desde: hace(120) },
    ];
    const r = resumirEscalado(deudas);
    expect(r.enRiesgoUsd).toBe(500);
    expect(r.vencidas).toHaveLength(2);
  });

  it("sin deuda no hay riesgo ni vencidas", () => {
    const r = resumirEscalado([]);
    expect(r.enRiesgoUsd).toBe(0);
    expect(diasVencidos([])).toBe(0);
  });
});
