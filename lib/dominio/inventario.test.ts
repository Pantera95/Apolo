import { describe, expect, it } from "vitest";

import {
  aplicar,
  ESTADO_VACIO,
  reconciliar,
  saldoDe,
  transferir,
  type EstadoInventario,
  type Operacion,
} from "./inventario";
import type { Articulo, ClaveSaldo, Saldo } from "./tipos";
import { disponible } from "./tipos";

const UBICACION: ClaveSaldo = {
  articuloId: "art-1",
  almacenId: "alm-1",
  ubicacionId: "ubi-1",
};

function articulo(over: Partial<Articulo> = {}): Articulo {
  return {
    id: "art-1",
    codigo: "TOR-3/8",
    descripcion: "Tornillo galvanizado 3/8",
    clase: "consumible",
    unidadBase: "und",
    costoPromedioUsd: 0.4,
    activo: true,
    ...over,
  };
}

/** Encadena operaciones y falla el test en la primera que no pase. */
function correr(
  ops: Operacion[],
  art: Articulo,
  inicial: EstadoInventario = ESTADO_VACIO,
): EstadoInventario {
  return ops.reduce((estado, op) => {
    const r = aplicar(estado, op, art);
    if (!r.ok) throw new Error(`${op.tipo}: ${r.error.codigo} — ${r.error.detalle}`);
    return r.valor.estado;
  }, inicial);
}

const base = { ...UBICACION, usuarioId: "u-1" };

describe("recepción y disponibilidad", () => {
  it("una recepción suma al físico y al disponible", () => {
    const estado = correr(
      [{ tipo: "recepcion", cantidad: 500, ...base }],
      articulo(),
    );
    const saldo = saldoDe(estado, UBICACION);
    expect(saldo.fisico).toBe(500);
    expect(disponible(saldo)).toBe(500);
  });

  it("lo averiado no cuenta como disponible aunque esté físicamente", () => {
    const saldo: Saldo = {
      fisico: 100,
      reservado: 0,
      averiado: 30,
      enTransito: 0,
      enObra: 0,
    };
    expect(disponible(saldo)).toBe(70);
  });
});

describe("reserva", () => {
  it("aparta sin sacar del almacén: baja el disponible, no el físico", () => {
    const estado = correr(
      [
        { tipo: "recepcion", cantidad: 100, ...base },
        { tipo: "reserva", cantidad: 40, obraId: "obra-1", ...base },
      ],
      articulo(),
    );
    const saldo = saldoDe(estado, UBICACION);
    expect(saldo.fisico).toBe(100);
    expect(saldo.reservado).toBe(40);
    expect(disponible(saldo)).toBe(60);
  });

  it("no permite reservar más de lo disponible", () => {
    const estado = correr([{ tipo: "recepcion", cantidad: 10, ...base }], articulo());
    const r = aplicar(
      estado,
      { tipo: "reserva", cantidad: 11, obraId: "obra-1", ...base },
      articulo(),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("STOCK_INSUFICIENTE");
  });

  it("dos obras no pueden reservar el mismo material", () => {
    const estado = correr(
      [
        { tipo: "recepcion", cantidad: 10, ...base },
        { tipo: "reserva", cantidad: 8, obraId: "obra-1", ...base },
      ],
      articulo(),
    );
    const r = aplicar(
      estado,
      { tipo: "reserva", cantidad: 5, obraId: "obra-2", ...base },
      articulo(),
    );
    expect(r.ok).toBe(false);
  });
});

describe("stock negativo", () => {
  it("un ajuste negativo no puede dejar el físico bajo cero", () => {
    const estado = correr([{ tipo: "recepcion", cantidad: 5, ...base }], articulo());
    const r = aplicar(
      estado,
      { tipo: "ajuste", signo: -1, cantidad: 6, motivo: "merma", ...base },
      articulo(),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("STOCK_NEGATIVO");
  });

  it("no se puede despachar sin haber reservado", () => {
    const estado = correr([{ tipo: "recepcion", cantidad: 5, ...base }], articulo());
    const r = aplicar(
      estado,
      { tipo: "despacho", cantidad: 5, obraId: "obra-1", ...base },
      articulo(),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("STOCK_NEGATIVO");
  });
});

describe("motivo obligatorio", () => {
  it("rechaza un ajuste sin motivo", () => {
    const estado = correr([{ tipo: "recepcion", cantidad: 5, ...base }], articulo());
    const sinMotivo = {
      tipo: "ajuste",
      signo: -1,
      cantidad: 1,
      motivo: undefined,
      ...base,
    } as unknown as Operacion;
    const r = aplicar(estado, sinMotivo, articulo());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("MOTIVO_REQUERIDO");
  });

  it("un conteo que difiere exige motivo", () => {
    const estado = correr([{ tipo: "recepcion", cantidad: 100, ...base }], articulo());
    const sin = aplicar(estado, { tipo: "conteo", contado: 97, cantidad: 0, ...base }, articulo());
    expect(sin.ok).toBe(false);
    if (!sin.ok) expect(sin.error.codigo).toBe("MOTIVO_REQUERIDO");

    const con = aplicar(
      estado,
      { tipo: "conteo", contado: 97, cantidad: 0, motivo: "merma", ...base },
      articulo(),
    );
    expect(con.ok).toBe(true);
    if (con.ok) expect(saldoDe(con.valor.estado, UBICACION).fisico).toBe(97);
  });

  it("un conteo que cuadra no necesita motivo", () => {
    const estado = correr([{ tipo: "recepcion", cantidad: 100, ...base }], articulo());
    const r = aplicar(estado, { tipo: "conteo", contado: 100, cantidad: 0, ...base }, articulo());
    expect(r.ok).toBe(true);
  });
});

describe("retorno de obra según la clase del artículo", () => {
  const llave = articulo({ clase: "retornable", codigo: "LLA-14", descripcion: "Llave 14mm" });

  const hastaObra: Operacion[] = [
    { tipo: "recepcion", cantidad: 10, ...base },
    { tipo: "reserva", cantidad: 4, obraId: "obra-1", ...base },
    { tipo: "despacho", cantidad: 4, obraId: "obra-1", ...base },
    { tipo: "entrega", cantidad: 4, obraId: "obra-1", ...base },
  ];

  it("un consumible no puede retornar de obra", () => {
    const estado = correr(hastaObra, articulo());
    const r = aplicar(
      estado,
      { tipo: "retorno", cantidad: 4, obraId: "obra-1", condicion: "bueno", ...base },
      articulo(),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("ARTICULO_NO_RETORNABLE");
  });

  it("una herramienta en buen estado vuelve al físico", () => {
    const estado = correr(
      [
        ...hastaObra,
        { tipo: "retorno", cantidad: 4, obraId: "obra-1", condicion: "bueno", ...base },
      ],
      llave,
    );
    const saldo = saldoDe(estado, UBICACION);
    expect(saldo.enObra).toBe(0);
    expect(saldo.fisico).toBe(10);
    expect(disponible(saldo)).toBe(10);
  });

  it("una herramienta rota vuelve a averiado y no queda disponible", () => {
    const estado = correr(
      [
        ...hastaObra,
        { tipo: "retorno", cantidad: 4, obraId: "obra-1", condicion: "averiado", ...base },
      ],
      llave,
    );
    const saldo = saldoDe(estado, UBICACION);
    expect(saldo.averiado).toBe(4);
    expect(saldo.fisico).toBe(6);
    expect(disponible(saldo)).toBe(2);
  });

  it("no se puede retornar más de lo que hay en obra", () => {
    const estado = correr(hastaObra, llave);
    const r = aplicar(
      estado,
      { tipo: "retorno", cantidad: 5, obraId: "obra-1", condicion: "bueno", ...base },
      llave,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("STOCK_NEGATIVO");
  });
});

describe("flujo completo hacia obra", () => {
  it("recepción → reserva → despacho → entrega deja la deuda en obra", () => {
    const estado = correr(
      [
        { tipo: "recepcion", cantidad: 100, ...base },
        { tipo: "reserva", cantidad: 30, obraId: "obra-1", ...base },
        { tipo: "despacho", cantidad: 30, obraId: "obra-1", ...base },
      ],
      articulo(),
    );

    const enCamino = saldoDe(estado, UBICACION);
    expect(enCamino.fisico).toBe(70);
    expect(enCamino.reservado).toBe(0);
    expect(enCamino.enTransito).toBe(30);

    const entregado = correr(
      [{ tipo: "entrega", cantidad: 30, obraId: "obra-1", ...base }],
      articulo(),
      estado,
    );
    const saldo = saldoDe(entregado, UBICACION);
    expect(saldo.enTransito).toBe(0);
    expect(saldo.enObra).toBe(30);
    expect(saldo.fisico).toBe(70);
  });
});

describe("transferencia entre almacenes", () => {
  const destino: ClaveSaldo = {
    articuloId: "art-1",
    almacenId: "alm-2",
    ubicacionId: "ubi-9",
  };

  it("genera dos asientos y conserva el total", () => {
    const estado = correr([{ tipo: "recepcion", cantidad: 80, ...base }], articulo());
    const r = transferir(estado, UBICACION, destino, 30, "u-1", articulo());

    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.valor.asientos).toHaveLength(2);
    expect(r.valor.asientos[0].tipo).toBe("transferencia_salida");
    expect(r.valor.asientos[1].tipo).toBe("transferencia_entrada");
    // Una transferencia no crea ni destruye existencia.
    expect(saldoDe(r.valor.estado, UBICACION).fisico).toBe(50);
    expect(saldoDe(r.valor.estado, destino).fisico).toBe(30);
    expect(reconciliar(r.valor.estado)).toEqual([]);
  });

  it("no permite transferir más de lo que hay", () => {
    const estado = correr([{ tipo: "recepcion", cantidad: 10, ...base }], articulo());
    const r = transferir(estado, UBICACION, destino, 11, "u-1", articulo());
    expect(r.ok).toBe(false);
  });
});

describe("reconciliación kardex vs saldo", () => {
  it("no reporta nada cuando el sistema está sano", () => {
    const estado = correr(
      [
        { tipo: "recepcion", cantidad: 100, ...base },
        { tipo: "reserva", cantidad: 30, obraId: "obra-1", ...base },
        { tipo: "despacho", cantidad: 30, obraId: "obra-1", ...base },
        { tipo: "entrega", cantidad: 30, obraId: "obra-1", ...base },
        { tipo: "ajuste", signo: -1, cantidad: 5, motivo: "rotura", ...base },
      ],
      articulo(),
    );
    expect(reconciliar(estado)).toEqual([]);
  });

  it("detecta un saldo manipulado por fuera del kardex", () => {
    const sano = correr([{ tipo: "recepcion", cantidad: 100, ...base }], articulo());

    // Simula el bug clásico: alguien escribió el saldo sin dejar asiento.
    const saldos = new Map(sano.saldos);
    saldos.set("art-1|alm-1|ubi-1", { ...saldoDe(sano, UBICACION), fisico: 93 });
    const corrupto: EstadoInventario = { saldos, asientos: sano.asientos };

    const discrepancias = reconciliar(corrupto);
    expect(discrepancias).toHaveLength(1);
    expect(discrepancias[0]).toMatchObject({
      campo: "fisico",
      segunSaldo: 93,
      segunKardex: 100,
      diferencia: -7,
    });
  });

  it("no inventa discrepancias con cantidades fraccionarias", () => {
    const cable = articulo({ codigo: "CAB-2/0", unidadBase: "m" });
    const estado = correr(
      [
        { tipo: "recepcion", cantidad: 0.1, ...base },
        { tipo: "recepcion", cantidad: 0.2, ...base },
        { tipo: "ajuste", signo: -1, cantidad: 0.3, motivo: "merma", ...base },
      ],
      cable,
    );
    expect(saldoDe(estado, UBICACION).fisico).toBe(0);
    expect(reconciliar(estado)).toEqual([]);
  });
});

describe("inmutabilidad del kardex", () => {
  it("los asientos no se pueden modificar", () => {
    const estado = correr([{ tipo: "recepcion", cantidad: 10, ...base }], articulo());
    const asiento = estado.asientos[0];
    expect(() => {
      (asiento as { tipo: string }).tipo = "ajuste";
    }).toThrow();
  });

  it("cada operación deja rastro de usuario y fecha", () => {
    const estado = correr(
      [{ tipo: "ajuste", signo: 1, cantidad: 5, motivo: "merma", ...base }],
      articulo(),
    );
    const asiento = estado.asientos[0];
    expect(asiento.usuarioId).toBe("u-1");
    expect(asiento.motivo).toBe("merma");
    expect(Date.parse(asiento.fecha)).not.toBeNaN();
  });
});
