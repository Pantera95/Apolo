import { describe, expect, it } from "vitest";

import {
  aptitud,
  componer,
  PLANTILLAS,
  textoPlano,
  UMBRAL_RETRASO_MIN,
  type CtxLogistica,
} from "@/lib/logistica/plantillas";
import {
  CHOFERES_DEMO,
  LUGARES_DEMO,
  VEHICULOS_DEMO,
  etaDeRuta,
  eventosDeRuta,
  posicionSimulada,
  rutasDemo,
} from "@/lib/logistica/simulado";

/**
 * Cada plantilla contra cada viaje de la demostración.
 *
 * Esta suite existe por una razón concreta: estos mensajes se envían EN VIVO
 * delante de un cliente. Un mensaje que sale con `undefined`, con `NaN`, o que
 * afirma algo falso no se puede recoger del grupo de Telegram.
 */

const AHORA = Date.parse("2026-08-07T15:30:00.000Z");
const RUTAS = rutasDemo(AHORA);

function ctx(indiceRuta: number): CtxLogistica {
  const ruta = RUTAS[indiceRuta];
  const pos = posicionSimulada(ruta, AHORA);
  const info = pos ? etaDeRuta(ruta, pos, AHORA) : null;
  const vehiculo = VEHICULOS_DEMO.find((v) => v.id === ruta.vehiculoId);
  const nombreLugar = (id: string) =>
    LUGARES_DEMO.find((l) => l.id === id)?.nombre ?? "—";

  return {
    ruta,
    rutas: RUTAS,
    vehiculo: vehiculo?.descripcion ?? ruta.vehiculoId,
    capacidad: vehiculo?.capacidad ?? null,
    chofer: CHOFERES_DEMO[ruta.vehiculoId] ?? "—",
    destino: info ? nombreLugar(info.parada.lugarId) : "—",
    eta: info?.eta ?? null,
    eventos: pos ? eventosDeRuta(ruta, pos, AHORA) : [],
    velocidadKmh: pos?.velocidadKmh ?? null,
    hora: (iso) => new Date(iso).toISOString().slice(11, 16),
    nombreLugar,
    urlRuta: "https://www.google.com/maps/dir/?api=1&destination=x",
    urlSiguiente: "https://www.google.com/maps/dir/?api=1&destination=y",
    nombreSiguiente: "Planta de Proceso",
    paradasEnEnlace: ruta.paradas.length,
    omitidas: [],
  };
}

const TODAS = PLANTILLAS.map((p) => p.id);

describe("plantillas de logística — todas contra todos los viajes", () => {
  for (let i = 0; i < RUTAS.length; i++) {
    describe(`viaje ${RUTAS[i].codigo}`, () => {
      const c = ctx(i);

      for (const id of TODAS) {
        it(`${id}: compone sin huecos ni cifras rotas`, () => {
          const html = componer(id, c);
          expect(html.length).toBeGreaterThan(60);
          // Lo que delata una plantilla mal armada.
          expect(html).not.toMatch(/undefined|NaN|\[object|Infinity/);
          // Nunca dos saltos de línea seguidos de más: son huecos de campos
          // vacíos que se filtraron.
          expect(html).not.toMatch(/\n{4,}/);
        });

        it(`${id}: cabe en un mensaje de Telegram`, () => {
          // sendMessage corta en 4096 y RECHAZA por encima, no trunca.
          expect(componer(id, c).length).toBeLessThan(4096);
        });

        it(`${id}: no deja etiquetas HTML sin cerrar`, () => {
          const html = componer(id, c);
          const abre = (html.match(/<b>/g) ?? []).length;
          const cierra = (html.match(/<\/b>/g) ?? []).length;
          expect(abre).toBe(cierra);
        });
      }
    });
  }
});

describe("aptitud — la puerta que evita mandar algo falso", () => {
  /**
   * El defecto que motivó todo esto. Dos de los tres viajes de demostración
   * tienen CERO paradas completadas; el botón "Entrega completada" componía
   * igual y anunciaba "0 de 1 paradas". Sale perfectamente formado, y eso es
   * justo lo que lo hace peligroso.
   */
  it("no deja anunciar una entrega sin paradas completadas", () => {
    const sinEntregas = RUTAS.map((_, i) => ctx(i)).filter(
      (c) => c.ruta.paradas.every((p) => p.estado !== "completada"),
    );
    expect(sinEntregas.length).toBeGreaterThan(0);
    for (const c of sinEntregas) {
      const a = aptitud("entrega", c);
      expect(a.apto).toBe(false);
      expect(a.motivo).toMatch(/completada/i);
    }
  });

  it("sí la deja cuando hay al menos una entrega hecha", () => {
    const conEntrega = RUTAS.map((_, i) => ctx(i)).find((c) =>
      c.ruta.paradas.some((p) => p.estado === "completada"),
    );
    expect(conEntrega).toBeDefined();
    expect(aptitud("entrega", conEntrega!).apto).toBe(true);
  });

  /**
   * Una alerta cuyo motivo es "Sin eventos abiertos" enseña al canal a
   * ignorar las alertas, que es el daño más caro de todos.
   */
  it("no deja emitir una alerta sin incidencia ni retraso", () => {
    const c = ctx(0);
    const tranquilo: CtxLogistica = {
      ...c,
      eventos: [],
      eta: c.eta ? { ...c.eta, desviacionMin: 2 } : null,
    };
    const a = aptitud("alerta", tranquilo);
    expect(a.apto).toBe(false);
    expect(a.motivo).toMatch(/incidencias|retraso/i);
  });

  it("la deja cuando el retraso supera el umbral, aunque no haya eventos", () => {
    const c = ctx(0);
    const tarde: CtxLogistica = {
      ...c,
      eventos: [],
      eta: c.eta ? { ...c.eta, desviacionMin: UMBRAL_RETRASO_MIN + 5 } : null,
    };
    expect(aptitud("alerta", tarde).apto).toBe(true);
    expect(componer("alerta", tarde)).toContain("Retraso");
  });

  it("sin posición no deja informar un ETA que no existe", () => {
    const c: CtxLogistica = { ...ctx(0), eta: null };
    const a = aptitud("en_ruta", c);
    expect(a.apto).toBe(false);
    expect(a.motivo).toMatch(/posición/i);
  });
});

describe("contenido de cada informe", () => {
  const c = ctx(0);

  it("la salida lleva carga, paradas y hora de la primera", () => {
    const t = textoPlano(componer("salida", c));
    expect(t).toMatch(/Carga:.*kg/);
    expect(t).toMatch(/Paradas planificadas: \d+/);
    expect(t).toMatch(/Primera parada:/);
  });

  it("en ruta lleva ETA con minutos y distancia, y progreso", () => {
    const t = textoPlano(componer("en_ruta", c));
    expect(t).toMatch(/ETA:.*\d+ min.*km/);
    expect(t).toMatch(/Progreso: \d+ de \d+ paradas/);
  });

  /**
   * A qué obra afecta: sin eso el aviso obliga a abrir el sistema para saber a
   * quién llamar, y en ese rato la obra ya está parada.
   */
  it("la alerta dice a qué entregas afecta", () => {
    const tarde: CtxLogistica = {
      ...c,
      eventos: [],
      eta: c.eta ? { ...c.eta, desviacionMin: 25 } : null,
    };
    const t = textoPlano(componer("alerta", tarde));
    expect(t).toContain("Entregas afectadas");
    expect(t).toContain("Acción recomendada");
  });

  it("la entrega dice qué se entregó y qué queda", () => {
    const t = textoPlano(componer("entrega", c));
    expect(t).toMatch(/Despacho .*kg/);
    expect(t).toMatch(/Avance del viaje: \d+ de \d+/);
  });

  it("el resumen totaliza la jornada, no solo lista viajes", () => {
    const t = textoPlano(componer("resumen", c));
    expect(t).toMatch(/Paradas: \d+ de \d+ completadas/);
    expect(t).toMatch(/Carga movida: .*kg/);
  });

  it("escapa el HTML de los nombres", () => {
    // Un `<` sin escapar rompe el parseo de Telegram y el mensaje NO llega.
    const raro: CtxLogistica = {
      ...c,
      chofer: "Pérez & <Hijos>",
    };
    expect(componer("salida", raro)).toContain("Pérez &amp; &lt;Hijos&gt;");
  });

  it("los enlaces sobreviven al texto plano", () => {
    const t = textoPlano(componer("en_ruta", c));
    expect(t).toContain("https://www.google.com/maps/dir/");
  });
});
