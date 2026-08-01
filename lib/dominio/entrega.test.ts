import { describe, expect, it } from "vitest";

import {
  estaPreparado,
  normalizarOrden,
  ordenesCoinciden,
  pendienteDePreparar,
  ponerEnRuta,
  puedeDespacharse,
  registrarEntrega,
  registrarPreparacion,
  rutaDePreparacion,
  totalUnidades,
  type Despacho,
} from "./entrega";
import type { Solicitud } from "./despacho";

const FECHA = "2026-08-01T12:00:00.000Z";

function despacho(over: Partial<Despacho> = {}): Despacho {
  return {
    id: "des-1",
    codigo: "DES-0042",
    solicitudId: "sol-1",
    obraId: "obr-2401",
    estado: "en_preparacion",
    transporte: "flota",
    choferId: "cho-1",
    vehiculoId: "veh-1",
    creadoEn: FECHA,
    lineas: [
      { articuloId: "art-1", ubicacionId: "ubi-b2", almacenId: "alm-cen", cantidad: 10, preparado: 0 },
      { articuloId: "art-2", ubicacionId: "ubi-a1", almacenId: "alm-cen", cantidad: 5, preparado: 0 },
    ],
    ...over,
  };
}

function solicitud(estado: Solicitud["estado"]): Solicitud {
  return {
    id: "sol-1",
    codigo: "SOL-0148",
    obraId: "obr-2401",
    estado,
    creadaPor: "u-1",
    fecha: FECHA,
    lineas: [],
  };
}

describe("un despacho solo nace de una solicitud autorizada", () => {
  it("rechaza una solicitud sin aprobar", () => {
    const r = puedeDespacharse(solicitud("solicitada"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("APROBACION_REQUERIDA");
  });

  it("acepta una aprobada", () => {
    expect(puedeDespacharse(solicitud("aprobada")).ok).toBe(true);
  });

  it("rechaza una rechazada o anulada", () => {
    expect(puedeDespacharse(solicitud("rechazada")).ok).toBe(false);
    expect(puedeDespacharse(solicitud("anulada")).ok).toBe(false);
  });
});

describe("preparación", () => {
  it("recorre las ubicaciones en orden físico, no en el orden pedido", () => {
    // ubi-a1 se visita antes que ubi-b2 aunque se pidiera después.
    const orden = new Map([
      ["ubi-a1", 10],
      ["ubi-b2", 40],
    ]);
    const ruta = rutaDePreparacion(despacho(), orden);
    expect(ruta.map((l) => l.ubicacionId)).toEqual(["ubi-a1", "ubi-b2"]);
  });

  it("acumula lo preparado y deja ver el pendiente", () => {
    const r = registrarPreparacion(despacho(), "art-1", "ubi-b2", 4);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(pendienteDePreparar(r.valor.lineas[0])).toBe(6);
    expect(estaPreparado(r.valor)).toBe(false);
    expect(r.valor.estado).toBe("en_preparacion");
  });

  it("pasa a listo solo cuando TODAS las líneas están completas", () => {
    let d = despacho();
    const a = registrarPreparacion(d, "art-1", "ubi-b2", 10);
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    d = a.valor;
    expect(d.estado).toBe("en_preparacion");

    const b = registrarPreparacion(d, "art-2", "ubi-a1", 5);
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(b.valor.estado).toBe("listo");
    expect(estaPreparado(b.valor)).toBe(true);
  });

  it("no deja preparar más de lo pedido", () => {
    const r = registrarPreparacion(despacho(), "art-1", "ubi-b2", 11);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("STOCK_INSUFICIENTE");
  });

  it("no deja preparar un despacho que ya salió", () => {
    const r = registrarPreparacion(despacho({ estado: "en_ruta" }), "art-1", "ubi-b2", 1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("TRANSICION_NO_PERMITIDA");
  });

  it("no muta el despacho original", () => {
    const original = despacho();
    registrarPreparacion(original, "art-1", "ubi-b2", 4);
    expect(original.lineas[0].preparado).toBe(0);
  });
});

describe("salida a ruta", () => {
  const listo = despacho({
    estado: "listo",
    lineas: [
      { articuloId: "art-1", ubicacionId: "ubi-b2", almacenId: "alm-cen", cantidad: 10, preparado: 10 },
    ],
  });

  it("no sale un despacho que aún se está preparando", () => {
    const r = ponerEnRuta(despacho(), FECHA);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("TRANSICION_NO_PERMITIDA");
  });

  it("con flota propia exige chofer y vehículo", () => {
    const sinChofer = ponerEnRuta({ ...listo, choferId: undefined }, FECHA);
    expect(sinChofer.ok).toBe(false);

    const completo = ponerEnRuta(listo, FECHA);
    expect(completo.ok).toBe(true);
    if (completo.ok) {
      expect(completo.valor.estado).toBe("en_ruta");
      expect(completo.valor.salidaEn).toBe(FECHA);
    }
  });

  it("con transporte contratado exige transportista y guía", () => {
    const externo = {
      ...listo,
      transporte: "externo" as const,
      choferId: undefined,
      vehiculoId: undefined,
    };
    expect(ponerEnRuta(externo, FECHA).ok).toBe(false);

    const conGuia = ponerEnRuta(
      { ...externo, transportistaExterno: "Transporte Oriente", guiaExterna: "TO-99120" },
      FECHA,
    );
    expect(conGuia.ok).toBe(true);
  });
});

describe("verificación de la orden de entrega", () => {
  it("ignora guiones, espacios y mayúsculas al comparar", () => {
    // El receptor escribe a mano en obra: un guion de más no puede invalidar
    // una entrega correcta, o el operario aprenderá a ignorar la alerta.
    expect(normalizarOrden("des-0042")).toBe("DES0042");
    expect(ordenesCoinciden("DES-0042", "des 0042")).toBe(true);
    expect(ordenesCoinciden("DES-0042", "DES0042")).toBe(true);
  });

  it("detecta que son documentos distintos", () => {
    expect(ordenesCoinciden("DES-0042", "DES-0043")).toBe(false);
  });
});

describe("entrega", () => {
  const enRuta = despacho({ estado: "en_ruta" });

  it("solo se entrega lo que va en ruta", () => {
    const r = registrarEntrega(despacho({ estado: "listo" }), {
      receptor: "J. Pérez",
      ordenReceptor: "DES-0042",
      fecha: FECHA,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("TRANSICION_NO_PERMITIDA");
  });

  it("exige quién recibe y qué orden trae", () => {
    expect(
      registrarEntrega(enRuta, { receptor: "  ", ordenReceptor: "DES-0042", fecha: FECHA }).ok,
    ).toBe(false);
    expect(
      registrarEntrega(enRuta, { receptor: "J. Pérez", ordenReceptor: " ", fecha: FECHA }).ok,
    ).toBe(false);
  });

  it("cierra como entregado cuando las órdenes coinciden", () => {
    const r = registrarEntrega(enRuta, {
      receptor: "J. Pérez",
      ordenReceptor: "des 0042",
      fecha: FECHA,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valor.estado).toBe("entregado");
    expect(r.valor.pod?.coincide).toBe(true);
    expect(r.valor.entregaEn).toBe(FECHA);
  });

  it("registra la entrega PERO la marca cuando no coinciden", () => {
    // La mercancía ya se entregó: negarlo no la devuelve. Se deja constancia.
    const r = registrarEntrega(enRuta, {
      receptor: "J. Pérez",
      ordenReceptor: "DES-9999",
      fecha: FECHA,
      observacion: "El receptor trae otra orden",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valor.estado).toBe("con_discrepancia");
    expect(r.valor.pod?.coincide).toBe(false);
    expect(r.valor.pod?.observacion).toBeTruthy();
  });

  it("nadie puede declarar coincidencia a mano", () => {
    // `coincide` se calcula; el tipo del parámetro ni siquiera lo acepta.
    const r = registrarEntrega(enRuta, {
      receptor: "J. Pérez",
      ordenReceptor: "OTRA-COSA",
      fecha: FECHA,
    });
    expect(r.ok && r.valor.pod?.coincide).toBe(false);
  });
});

describe("totales", () => {
  it("suma las unidades del despacho", () => {
    expect(totalUnidades(despacho())).toBe(15);
  });
});
