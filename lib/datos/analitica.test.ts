import { describe, expect, it } from "vitest";

import {
  antiguedadHerramienta,
  articulosDormidos,
  distribucionPorClase,
  formatear,
  insights,
  pendientesDeRetorno,
  serieMovimientos,
  valorPorObra,
} from "./analitica";
import { construirSemilla } from "./semilla";
import { valorEnObra } from "./indicadores";
import { ESTADO_APOLO_VACIO } from "@/lib/db/almacen";

const AHORA = new Date("2026-08-01T12:00:00.000Z");
/** `articulosDormidos` trabaja en milisegundos, no en Date. */
const AHORA_MS = AHORA.getTime();
const estado = construirSemilla(AHORA);

describe("serie de movimiento", () => {
  it("devuelve un punto por día del rango pedido", () => {
    expect(serieMovimientos(estado, 45, AHORA)).toHaveLength(45);
    expect(serieMovimientos(estado, 30, AHORA)).toHaveLength(30);
  });

  it("registra entradas y salidas reales", () => {
    const serie = serieMovimientos(estado, 60, AHORA);
    const entradas = serie.reduce((s, p) => s + p.entradas, 0);
    const salidas = serie.reduce((s, p) => s + p.salidas, 0);
    expect(entradas).toBeGreaterThan(0);
    expect(salidas).toBeGreaterThan(0);
    // Se recibió más de lo que salió: el almacén no puede haber despachado
    // más de lo que entró alguna vez.
    expect(entradas).toBeGreaterThan(salidas);
  });

  it("no rompe con el estado vacío", () => {
    const serie = serieMovimientos(ESTADO_APOLO_VACIO, 10, AHORA);
    expect(serie).toHaveLength(10);
    expect(serie.every((p) => p.entradas === 0 && p.salidas === 0)).toBe(true);
  });
});

describe("concentración por obra", () => {
  it("reparte el valor en obra entre las obras", () => {
    const obras = valorPorObra(estado);
    expect(obras.length).toBeGreaterThan(0);
    // La suma por obra tiene que coincidir con el total del indicador global,
    // que se calcula por una vía distinta (saldos, no kardex).
    const suma = obras.reduce((s, o) => s + o.valorUsd, 0);
    expect(suma).toBeCloseTo(Math.round(valorEnObra(estado)), -1);
  });

  it("los porcentajes suman 100", () => {
    const suma = valorPorObra(estado).reduce((s, o) => s + o.porcentaje, 0);
    expect(suma).toBeCloseTo(100, 6);
  });

  it("viene ordenada de mayor a menor", () => {
    const obras = valorPorObra(estado);
    for (let i = 1; i < obras.length; i++) {
      expect(obras[i - 1].valorUsd).toBeGreaterThanOrEqual(obras[i].valorUsd);
    }
  });
});

describe("distribución por clase", () => {
  it("cubre las tres clases y suma 100%", () => {
    const clases = distribucionPorClase(estado);
    expect(new Set(clases.map((c) => c.clase))).toEqual(
      new Set(["consumible", "retornable", "certificado"]),
    );
    expect(clases.reduce((s, c) => s + c.porcentaje, 0)).toBeCloseTo(100, 6);
  });
});

describe("antigüedad de la herramienta", () => {
  it("descuenta los retornos contra las entregas más antiguas", () => {
    // Si el descuento no fuera FIFO, una entrega vieja parcialmente devuelta
    // aparecería como reciente y la alerta perdería sentido.
    const pendientes = pendientesDeRetorno(estado, AHORA);
    expect(pendientes.length).toBeGreaterThan(0);
    for (let i = 1; i < pendientes.length; i++) {
      expect(pendientes[i - 1].dias).toBeGreaterThanOrEqual(pendientes[i].dias);
    }
  });

  it("las unidades pendientes cuadran con lo que sigue en obra", () => {
    const pendientes = pendientesDeRetorno(estado, AHORA);
    const total = pendientes.reduce((s, p) => s + p.unidades, 0);

    const retornables = new Set(
      estado.articulos.filter((a) => a.clase === "retornable").map((a) => a.id),
    );
    let enObra = 0;
    for (const [clave, saldo] of estado.inventario.saldos) {
      if (retornables.has(clave.split("|")[0])) enObra += saldo.enObra;
    }
    expect(total).toBeCloseTo(enObra, 6);
  });

  it("reparte en cuatro tramos sin perder unidades", () => {
    const tramos = antiguedadHerramienta(estado, AHORA);
    expect(tramos.map((t) => t.tramo)).toEqual(["0-15", "16-30", "31-60", "60+"]);
    const enTramos = tramos.reduce((s, t) => s + t.unidades, 0);
    const pendientes = pendientesDeRetorno(estado, AHORA).reduce(
      (s, p) => s + p.unidades,
      0,
    );
    expect(enTramos).toBeCloseTo(pendientes, 6);
  });
});

describe("insights", () => {
  it("no dice nada cuando no hay datos", () => {
    expect(insights(ESTADO_APOLO_VACIO, AHORA)).toEqual([]);
  });

  it("genera observaciones con valores derivados, no textos fijos", () => {
    const obs = insights(estado, AHORA);
    expect(obs.length).toBeGreaterThan(0);
    for (const o of obs) {
      expect(o.clave.startsWith("insight.")).toBe(true);
      expect(Object.keys(o.valores).length).toBeGreaterThan(0);
    }
  });

  it("marca la concentración como advertencia solo si supera la mitad", () => {
    const obs = insights(estado, AHORA).find((o) => o.id === "concentracion");
    expect(obs).toBeDefined();
    if (!obs) return;
    const pct = Number(obs.valores.pct);
    expect(obs.tono).toBe(pct >= 50 ? "advertencia" : "info");
  });
});

describe("insights ampliados", () => {
  const obs = insights(estado, AHORA);
  const porId = new Map(obs.map((o) => [o.id, o]));

  it("avisa de las compras vencidas con su peor atraso", () => {
    const compras = porId.get("compras-atrasadas");
    expect(compras).toBeDefined();
    expect(Number(compras?.valores.n)).toBeGreaterThan(0);
    expect(Number(compras?.valores.dias)).toBeGreaterThan(0);
    expect(compras?.moneda).toContain("valor");
  });

  it("señala las entregas firmadas con orden que no cuadra", () => {
    const disc = porId.get("discrepancias");
    expect(disc).toBeDefined();
    expect(disc?.tono).toBe("peligro");
    // Nombra los despachos: sin el código, nadie sabe cuál revisar.
    expect(String(disc?.valores.codigos)).toMatch(/DES-/);
  });

  it("reporta la herramienta que volvió rota", () => {
    const averiada = porId.get("averiada");
    expect(averiada).toBeDefined();
    expect(Number(averiada?.valores.unidades)).toBeGreaterThan(0);
  });

  it("no repite identificadores entre observaciones", () => {
    expect(new Set(obs.map((o) => o.id)).size).toBe(obs.length);
  });
});

describe("capital dormido", () => {
  it("cuenta solo lo que lleva más del umbral sin moverse", () => {
    const conUmbralAlto = articulosDormidos(estado, AHORA_MS);
    // Con un "ahora" muy posterior, todo el catálogo queda dormido.
    const muyDespues = articulosDormidos(estado, AHORA_MS + 400 * 86_400_000);
    expect(muyDespues.articulos).toBeGreaterThan(conUmbralAlto.articulos);
  });

  it("sin reloj no adivina", () => {
    expect(articulosDormidos(estado, 0)).toEqual({ articulos: 0, valorUsd: 0 });
  });

  it("no cuenta artículos sin existencia disponible", () => {
    const dormidos = articulosDormidos(estado, AHORA_MS + 400 * 86_400_000);
    expect(dormidos.articulos).toBeLessThanOrEqual(estado.articulos.length);
    expect(dormidos.valorUsd).toBeGreaterThan(0);
  });
});

describe("formateo de plantillas", () => {
  it("sustituye los marcadores", () => {
    expect(formatear("{pct}% está en {obra}.", { pct: 62, obra: "OBR-2402" })).toBe(
      "62% está en OBR-2402.",
    );
  });

  it("concuerda el número: uno va en singular", () => {
    // Sin esto salía "1 entregas se firmaron" delante del cliente.
    const plantilla = "{n} {n:p|entrega se firmó|entregas se firmaron} mal.";
    expect(formatear(plantilla, { n: 1 })).toBe("1 entrega se firmó mal.");
    expect(formatear(plantilla, { n: 3 })).toBe("3 entregas se firmaron mal.");
  });

  it("el cero va en plural, como en español", () => {
    expect(formatear("{n:p|día|días}", { n: 0 })).toBe("días");
  });

  it("admite varios plurales en la misma frase", () => {
    const plantilla = "{n} {n:p|orden|órdenes} que no {n:p|ha|han} llegado";
    expect(formatear(plantilla, { n: 1 })).toBe("1 orden que no ha llegado");
    expect(formatear(plantilla, { n: 2 })).toBe("2 órdenes que no han llegado");
  });

  it("deja visible el marcador que no recibió valor", () => {
    // Falla ruidosamente en pantalla en vez de mostrar un hueco silencioso.
    expect(formatear("{a} y {b}", { a: 1 })).toBe("1 y {b}");
  });
});
