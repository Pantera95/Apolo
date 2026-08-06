import { describe, expect, it } from "vitest";

import {
  MAX_WAYPOINTS,
  enlacePunto,
  enlaceRutaCompleta,
  enlaceSiguienteParada,
} from "@/lib/logistica/enlaces";
import type { Lugar, ParadaRuta, PlanRuta } from "@/lib/logistica/tipos";

const LUGARES: Lugar[] = [
  { id: "alm", nombre: "Almacén Central", tipo: "almacen", lat: 10.1811, lon: -64.6911 },
  { id: "o1", nombre: "Obra Uno", tipo: "obra", lat: 10.1333, lon: -64.6833 },
  { id: "o2", nombre: "Obra Dos", tipo: "obra", lat: 10.24, lon: -64.59 },
  { id: "o3", nombre: "Obra Tres", tipo: "obra", lat: 10.205, lon: -64.72 },
];

function parada(orden: number, lugarId: string, estado: ParadaRuta["estado"] = "pendiente"): ParadaRuta {
  return {
    id: `p${orden}`,
    orden,
    lugarId,
    despachoId: `DSP-${orden}`,
    estado,
    llegadaPlanificada: "2026-08-06T09:00:00.000Z",
    servicioMin: 20,
    pesoKg: 100,
    volumenM3: 1,
  };
}

function ruta(paradas: ParadaRuta[]): PlanRuta {
  return {
    id: "r1",
    codigo: "RTA-0001",
    fecha: "2026-08-06",
    almacenOrigenId: "alm",
    vehiculoId: "v1",
    choferId: "c1",
    estado: "en_ruta",
    paradas,
    trazado: [],
    distanciaPlanKm: 40,
    duracionPlanMin: 90,
    version: 1,
  };
}

describe("enlaceRutaCompleta", () => {
  it("usa el esquema universal, sin clave de API", () => {
    const e = enlaceRutaCompleta(ruta([parada(1, "o1")]), LUGARES);
    expect(e?.url).toContain("https://www.google.com/maps/dir/?api=1");
    // La Directions API cobra por peticion; este esquema no.
    expect(e?.url).not.toContain("key=");
  });

  it("sale y REGRESA al almacen", () => {
    // El viaje planificado incluye la vuelta: el camion no se queda en la obra.
    const e = enlaceRutaCompleta(ruta([parada(1, "o1")]), LUGARES);
    const u = new URL(e!.url);
    expect(u.searchParams.get("origin")).toBe(u.searchParams.get("destination"));
  });

  it("respeta el orden de las paradas aunque lleguen desordenadas", () => {
    const e = enlaceRutaCompleta(ruta([parada(2, "o2"), parada(1, "o1")]), LUGARES);
    const w = new URL(e!.url).searchParams.get("waypoints") ?? "";
    expect(w.indexOf("10.133300")).toBeLessThan(w.indexOf("10.240000"));
  });

  it("envia coordenadas, no nombres", () => {
    // Una obra en un camino sin asfaltar no esta indexada en Google; la
    // coordenada siempre resuelve.
    const e = enlaceRutaCompleta(ruta([parada(1, "o1")]), LUGARES);
    expect(e?.url).not.toContain("Obra%20Uno");
    expect(new URL(e!.url).searchParams.get("waypoints")).toBe("10.133300,-64.683300");
  });

  it("informa de las paradas que no caben, no las descarta en silencio", () => {
    // Por encima de 9 waypoints Google descarta paradas sin avisar, y el chofer
    // navegaria una ruta incompleta sin saberlo.
    const muchas = Array.from({ length: MAX_WAYPOINTS + 3 }, (_, i) =>
      parada(i + 1, i % 3 === 0 ? "o1" : i % 3 === 1 ? "o2" : "o3"),
    );
    const e = enlaceRutaCompleta(ruta(muchas), LUGARES);
    expect(e?.paradas).toBe(MAX_WAYPOINTS);
    expect(e?.omitidas).toHaveLength(3);
  });

  it("una parada sin coordenada se ignora sin romper el enlace", () => {
    const e = enlaceRutaCompleta(ruta([parada(1, "fantasma"), parada(2, "o1")]), LUGARES);
    expect(e?.paradas).toBe(1);
  });

  it("sin paradas no inventa un enlace", () => {
    expect(enlaceRutaCompleta(ruta([]), LUGARES)).toBeNull();
  });

  it("sin almacen conocido devuelve null", () => {
    const r = { ...ruta([parada(1, "o1")]), almacenOrigenId: "no-existe" };
    expect(enlaceRutaCompleta(r, LUGARES)).toBeNull();
  });

  it("es una URL valida y en modo conduccion", () => {
    const e = enlaceRutaCompleta(ruta([parada(1, "o1"), parada(2, "o2")]), LUGARES);
    expect(() => new URL(e!.url)).not.toThrow();
    expect(new URL(e!.url).searchParams.get("travelmode")).toBe("driving");
  });
});

describe("enlaceSiguienteParada", () => {
  it("apunta a la primera parada no cerrada", () => {
    const e = enlaceSiguienteParada(
      ruta([parada(1, "o1", "completada"), parada(2, "o2")]),
      LUGARES,
    );
    expect(e?.destino.id).toBe("o2");
  });

  it("NO fija origen: usa la posicion real del telefono", () => {
    // El almacen del que salio hace dos horas no sirve como origen.
    const e = enlaceSiguienteParada(ruta([parada(1, "o1")]), LUGARES);
    expect(new URL(e!.url).searchParams.get("origin")).toBeNull();
  });

  it("con el viaje terminado devuelve null", () => {
    const e = enlaceSiguienteParada(
      ruta([parada(1, "o1", "completada"), parada(2, "o2", "fallida")]),
      LUGARES,
    );
    expect(e).toBeNull();
  });
});

describe("enlacePunto", () => {
  it("usa search y no dir: se pide ver donde esta, no como llegar", () => {
    const u = enlacePunto({ lat: 10.1811, lon: -64.6911 });
    expect(u).toContain("/maps/search/");
    // Se comprueba el valor DECODIFICADO: la coma viaja como %2C y afirmar
    // sobre la cadena cruda probaria la codificacion, no el comportamiento.
    expect(new URL(u).searchParams.get("query")).toBe("10.181100,-64.691100");
  });
});
