import { describe, expect, it } from "vitest";

import {
  despachosDeObra,
  deudaDeObra,
  materialDeObra,
  puedeRetornar,
  resumenObras,
  solicitudesDeObra,
} from "./obras";
import { construirSemilla } from "./semilla";
import { valorEnObra } from "./indicadores";
import { ESTADO_APOLO_VACIO } from "@/lib/db/almacen";

const AHORA_FECHA = new Date("2026-08-01T12:00:00.000Z");
const AHORA = AHORA_FECHA.getTime();
const estado = construirSemilla(AHORA_FECHA);

describe("material por obra", () => {
  it("reparte el total en obra entre las obras, sin perder ni inventar valor", () => {
    // Se calcula recorriendo el kardex; el total global sale de los saldos.
    // Son dos caminos independientes y tienen que coincidir.
    const suma = estado.obras.reduce(
      (s, o) =>
        s + materialDeObra(estado, o.id).reduce((x, m) => x + m.valorUsd, 0),
      0,
    );
    expect(suma).toBeCloseTo(valorEnObra(estado), 4);
  });

  it("no devuelve renglones en cero ni negativos", () => {
    for (const obra of estado.obras) {
      for (const renglon of materialDeObra(estado, obra.id)) {
        expect(renglon.unidades).toBeGreaterThan(0);
      }
    }
  });

  it("viene ordenado por valor", () => {
    const material = materialDeObra(estado, "obr-2402");
    for (let i = 1; i < material.length; i++) {
      expect(material[i - 1].valorUsd).toBeGreaterThanOrEqual(material[i].valorUsd);
    }
  });
});

describe("deuda de herramienta por obra", () => {
  it("solo cuenta artículos retornables", () => {
    for (const obra of estado.obras) {
      for (const d of deudaDeObra(estado, obra.id, AHORA)) {
        expect(d.articulo.clase).toBe("retornable");
      }
    }
  });

  it("la suma por obra cuadra con la deuda global", () => {
    const porObra = estado.obras.reduce(
      (s, o) =>
        s + deudaDeObra(estado, o.id, AHORA).reduce((x, d) => x + d.unidades, 0),
      0,
    );

    const retornables = new Set(
      estado.articulos.filter((a) => a.clase === "retornable").map((a) => a.id),
    );
    let enObra = 0;
    for (const [clave, saldo] of estado.inventario.saldos) {
      if (retornables.has(clave.split("|")[0])) enObra += saldo.enObra;
    }
    expect(porObra).toBeCloseTo(enObra, 6);
  });

  it("indica a qué ubicación debe volver", () => {
    for (const d of deudaDeObra(estado, "obr-2401", AHORA)) {
      expect(d.almacenId).toBeTruthy();
      expect(d.ubicacionId).toBeTruthy();
    }
  });

  it("ordena por antigüedad, lo más viejo primero", () => {
    const deuda = deudaDeObra(estado, "obr-2401", AHORA);
    for (let i = 1; i < deuda.length; i++) {
      expect(deuda[i - 1].diasMax).toBeGreaterThanOrEqual(deuda[i].diasMax);
    }
  });

  it("sin reloj todavía no cuenta días, pero sí unidades", () => {
    // Antes de hidratar no se sabe qué hora es; inventar una daría un
    // desajuste entre servidor y cliente.
    const sinReloj = deudaDeObra(estado, "obr-2401", 0);
    expect(sinReloj.length).toBeGreaterThan(0);
    expect(sinReloj.every((d) => d.diasMax === 0)).toBe(true);
  });
});

describe("límite de retorno por obra", () => {
  it("una obra no puede devolver más de lo que ella tiene", () => {
    const deuda = deudaDeObra(estado, "obr-2401", AHORA);
    expect(deuda.length).toBeGreaterThan(0);

    const primera = deuda[0];
    expect(puedeRetornar(estado, "obr-2401", primera.articulo.id, AHORA)).toBe(
      primera.unidades,
    );
  });

  it("devuelve cero para un artículo que esa obra no tiene", () => {
    // El saldo agregado no distingue obras; esta función sí, y es la barrera
    // que impide que una obra devuelva la herramienta de otra.
    expect(puedeRetornar(estado, "obr-2401", "art-01", AHORA)).toBe(0);
  });

  it("devuelve cero para una obra sin nada", () => {
    expect(puedeRetornar(estado, "obr-inexistente", "art-13", AHORA)).toBe(0);
  });
});

describe("resumen de obras", () => {
  it("ordena por capital inmovilizado", () => {
    const resumen = resumenObras(estado, AHORA);
    expect(resumen).toHaveLength(estado.obras.length);
    for (let i = 1; i < resumen.length; i++) {
      expect(resumen[i - 1].valorEnObra).toBeGreaterThanOrEqual(
        resumen[i].valorEnObra,
      );
    }
  });

  it("cuenta solo las solicitudes que siguen vivas", () => {
    for (const r of resumenObras(estado, AHORA)) {
      const todas = solicitudesDeObra(estado, r.obra.id);
      expect(r.solicitudesAbiertas).toBeLessThanOrEqual(todas.length);
    }
  });

  it("no rompe con el estado vacío", () => {
    expect(resumenObras(ESTADO_APOLO_VACIO, AHORA)).toEqual([]);
  });
});

describe("historial por obra", () => {
  it("solicitudes y despachos vienen del más reciente al más antiguo", () => {
    const solicitudes = solicitudesDeObra(estado, "obr-2401");
    for (let i = 1; i < solicitudes.length; i++) {
      expect(solicitudes[i - 1].fecha >= solicitudes[i].fecha).toBe(true);
    }
    const despachos = despachosDeObra(estado, "obr-2401");
    for (let i = 1; i < despachos.length; i++) {
      expect(despachos[i - 1].creadoEn >= despachos[i].creadoEn).toBe(true);
    }
  });

  it("cada obra solo ve lo suyo", () => {
    for (const obra of estado.obras) {
      expect(
        solicitudesDeObra(estado, obra.id).every((s) => s.obraId === obra.id),
      ).toBe(true);
      expect(
        despachosDeObra(estado, obra.id).every((d) => d.obraId === obra.id),
      ).toBe(true);
    }
  });
});
