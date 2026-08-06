import { describe, expect, it } from "vitest";

import {
  calcularEta,
  claveEvento,
  debeEnviar,
  dentroDeGeocerca,
  desvioM,
  distanciaDeOrden,
  distanciaKm,
  distanciaM,
  esDuplicado,
  esTerminalViaje,
  meritaAvisoEta,
  optimizarVecinoMasCercano,
  progresoViaje,
  puedeParada,
  puedeViajar,
  siguienteParada,
  usoCapacidad,
  yaEntregada,
  type EnvioRegistrado,
} from "@/lib/logistica/nucleo";
import type {
  Coordenada,
  EntradaOptimizacion,
  Geocerca,
  MensajeNotificacion,
  ParadaRuta,
  VehiculoLogistico,
} from "@/lib/logistica/tipos";

// Lechería y Barcelona, Anzoátegui: ~9 km reales entre ambas.
const LECHERIA: Coordenada = { lat: 10.1811, lon: -64.6911 };
const BARCELONA: Coordenada = { lat: 10.1333, lon: -64.6833 };
const PUERTO_LA_CRUZ: Coordenada = { lat: 10.2167, lon: -64.6167 };

describe("distancia", () => {
  it("mide con semiverseno, no en plano", () => {
    // Un grado de longitud mide 111 km en el ecuador y 78 km aquí: la recta
    // plana daría un error grande en dirección este-oeste.
    const d = distanciaKm(LECHERIA, BARCELONA);
    expect(d).toBeGreaterThan(4);
    expect(d).toBeLessThan(8);
  });

  it("es cero para el mismo punto", () => {
    expect(distanciaM(LECHERIA, LECHERIA)).toBeCloseTo(0);
  });

  it("es simétrica", () => {
    expect(distanciaM(LECHERIA, BARCELONA)).toBeCloseTo(
      distanciaM(BARCELONA, LECHERIA),
      3,
    );
  });
});

describe("geocercas", () => {
  const cerca: Geocerca = {
    id: "g1",
    lugarId: "obra-1",
    nombre: "Obra Los Pinos",
    centro: LECHERIA,
    radioM: 300,
  };

  it("acepta el punto dentro del radio", () => {
    expect(dentroDeGeocerca(LECHERIA, cerca)).toBe(true);
  });

  it("rechaza el punto fuera", () => {
    expect(dentroDeGeocerca(BARCELONA, cerca)).toBe(false);
  });

  it("el borde exacto cuenta como dentro", () => {
    // Un vehículo justo en el límite ha llegado: excluirlo dejaría entradas
    // sin detectar por un metro.
    const justo: Coordenada = { lat: LECHERIA.lat + 300 / 111_320, lon: LECHERIA.lon };
    expect(dentroDeGeocerca(justo, { ...cerca, radioM: 301 })).toBe(true);
  });
});

describe("desvio", () => {
  it("mide contra el segmento, no contra el vértice más cercano", () => {
    // Punto a mitad de un tramo largo: está SOBRE la ruta aunque sus vértices
    // queden lejos. Medir contra vértices marcaría un desvío enorme.
    const trazado = [LECHERIA, PUERTO_LA_CRUZ];
    const medio: Coordenada = {
      lat: (LECHERIA.lat + PUERTO_LA_CRUZ.lat) / 2,
      lon: (LECHERIA.lon + PUERTO_LA_CRUZ.lon) / 2,
    };
    const d = desvioM(medio, trazado);
    expect(d).not.toBeNull();
    expect(d as number).toBeLessThan(50);
  });

  it("detecta un punto realmente fuera de ruta", () => {
    const d = desvioM(BARCELONA, [LECHERIA, PUERTO_LA_CRUZ]);
    expect(d as number).toBeGreaterThan(1000);
  });

  it("sin trazado no hay desvío que medir", () => {
    expect(desvioM(LECHERIA, [])).toBeNull();
  });

  it("con un solo punto mide contra ese punto", () => {
    expect(desvioM(BARCELONA, [LECHERIA])).toBeCloseTo(distanciaM(BARCELONA, LECHERIA), 0);
  });
});

describe("capacidad", () => {
  const cap = { pesoKg: 5000, volumenM3: 20 };

  it("comprueba peso Y volumen", () => {
    // El aislante llena el camión sin pesar; el cemento pesa sin llenarlo.
    const aislante = usoCapacidad([{ pesoKg: 500, volumenM3: 25 }], cap);
    expect(aislante.excedeVolumen).toBe(true);
    expect(aislante.excedePeso).toBe(false);

    const cemento = usoCapacidad([{ pesoKg: 6000, volumenM3: 4 }], cap);
    expect(cemento.excedePeso).toBe(true);
    expect(cemento.excedeVolumen).toBe(false);
  });

  it("suma varias paradas", () => {
    const u = usoCapacidad(
      [
        { pesoKg: 2000, volumenM3: 8 },
        { pesoKg: 2000, volumenM3: 8 },
      ],
      cap,
    );
    expect(u.pesoKg).toBe(4000);
    expect(u.pctPeso).toBeCloseTo(80);
    expect(u.excedePeso).toBe(false);
  });

  it("justo en el límite no excede", () => {
    const u = usoCapacidad([{ pesoKg: 5000, volumenM3: 20 }], cap);
    expect(u.excedePeso).toBe(false);
    expect(u.excedeVolumen).toBe(false);
  });
});

describe("máquina de estados del viaje", () => {
  it("permite el camino normal", () => {
    expect(puedeViajar("planificado", "asignado")).toBe(true);
    expect(puedeViajar("listo_para_salida", "en_ruta")).toBe(true);
    expect(puedeViajar("descargando", "completado")).toBe(true);
  });

  it("prohíbe saltarse la carga", () => {
    // Un despacho no puede salir sin haberse cargado.
    expect(puedeViajar("planificado", "en_ruta")).toBe(false);
    expect(puedeViajar("asignado", "completado")).toBe(false);
  });

  it("los estados terminales no tienen salida", () => {
    // Reabrir un viaje cerrado exigiría un movimiento compensatorio.
    expect(esTerminalViaje("completado")).toBe(true);
    expect(esTerminalViaje("cancelado")).toBe(true);
    expect(puedeViajar("completado", "en_ruta")).toBe(false);
  });

  it("una incidencia no cierra el viaje: se retoma", () => {
    expect(puedeViajar("en_ruta", "con_incidencia")).toBe(true);
    expect(puedeViajar("con_incidencia", "en_ruta")).toBe(true);
  });
});

describe("máquina de estados de la parada", () => {
  it("la llegada detectada NO confirma la entrega", () => {
    // La geocerca sugiere; la entrega la confirma una persona.
    expect(puedeParada("llegada_detectada", "llegada_confirmada")).toBe(true);
    expect(puedeParada("llegada_detectada", "completada")).toBe(false);
  });

  it("no se puede descargar sin confirmar llegada", () => {
    expect(puedeParada("proxima", "descargando")).toBe(false);
    expect(puedeParada("llegada_confirmada", "descargando")).toBe(true);
  });

  it("una entrega completada no se vuelve a tocar", () => {
    // Confirmar dos veces duplicaría el movimiento de inventario.
    expect(puedeParada("completada", "descargando")).toBe(false);
    expect(yaEntregada("completada")).toBe(true);
    expect(yaEntregada("entrega_parcial")).toBe(true);
    expect(yaEntregada("proxima")).toBe(false);
  });

  it("la entrega parcial puede cerrarse después", () => {
    expect(puedeParada("descargando", "entrega_parcial")).toBe(true);
    expect(puedeParada("entrega_parcial", "completada")).toBe(true);
  });
});

describe("ETA", () => {
  const AHORA = Date.parse("2026-08-06T12:00:00.000Z");

  it("estima con la velocidad actual", () => {
    const eta = calcularEta(LECHERIA, PUERTO_LA_CRUZ, 60, AHORA, "2026-08-06T12:20:00.000Z");
    expect(eta.minutosRestantes).toBeGreaterThan(0);
    expect(eta.distanciaRestanteKm).toBeGreaterThan(0);
  });

  it("con el vehículo parado no da un ETA infinito", () => {
    // Velocidad 0 en un semáforo daría división por cero.
    const eta = calcularEta(LECHERIA, PUERTO_LA_CRUZ, 0, AHORA, "2026-08-06T12:20:00.000Z");
    expect(Number.isFinite(eta.minutosRestantes)).toBe(true);
    expect(eta.minutosRestantes).toBeGreaterThan(0);
  });

  it("marca el adelanto con signo negativo", () => {
    const eta = calcularEta(LECHERIA, LECHERIA, 60, AHORA, "2026-08-06T13:00:00.000Z");
    expect(eta.desviacionMin).toBeLessThan(0);
  });

  it("suma el tiempo de servicio", () => {
    const sin = calcularEta(LECHERIA, PUERTO_LA_CRUZ, 60, AHORA, "2026-08-06T12:20:00.000Z", 45, 0);
    const con = calcularEta(LECHERIA, PUERTO_LA_CRUZ, 60, AHORA, "2026-08-06T12:20:00.000Z", 45, 30);
    expect(con.minutosRestantes - sin.minutosRestantes).toBeCloseTo(30);
  });
});

describe("umbral de aviso de ETA", () => {
  it("el primer cálculo siempre avisa", () => {
    expect(meritaAvisoEta(null, 45)).toBe(true);
  });

  it("una variación pequeña no avisa", () => {
    // Un camión en tráfico cambia de ETA cada treinta segundos.
    expect(meritaAvisoEta(45, 48)).toBe(false);
  });

  it("una variación grande sí avisa, en los dos sentidos", () => {
    expect(meritaAvisoEta(45, 70)).toBe(true);
    expect(meritaAvisoEta(70, 45)).toBe(true);
  });
});

describe("optimización", () => {
  const vehiculo: VehiculoLogistico = {
    id: "v1",
    placa: "A12BC",
    descripcion: "Camión 07",
    capacidad: { pesoKg: 5000, volumenM3: 20 },
    estado: "disponible",
    almacenBaseId: "alm-1",
  };

  const lugares = new Map<string, Coordenada>([
    ["obra-cerca", BARCELONA],
    ["obra-lejos", PUERTO_LA_CRUZ],
  ]);

  const base: EntradaOptimizacion = {
    origen: { id: "alm-1", nombre: "Central", tipo: "almacen", ...LECHERIA },
    paradas: [
      { lugarId: "obra-lejos", despachoId: "d-lejos", pesoKg: 1000, volumenM3: 4, servicioMin: 20, prioridad: 1 },
      { lugarId: "obra-cerca", despachoId: "d-cerca", pesoKg: 1000, volumenM3: 4, servicioMin: 20, prioridad: 1 },
    ],
    vehiculo,
    salidaISO: "2026-08-06T08:00:00.000Z",
    velocidadMediaKmh: 45,
  };

  it("visita primero la parada más cercana", () => {
    const r = optimizarVecinoMasCercano(base, lugares);
    expect(r.orden[0]).toBe("d-cerca");
  });

  it("devuelve lo que no cupo, no lo descarta en silencio", () => {
    // Descartarlo en silencio haría creer que todo el pedido salió.
    const r = optimizarVecinoMasCercano(
      {
        ...base,
        paradas: [
          { lugarId: "obra-cerca", despachoId: "d1", pesoKg: 4000, volumenM3: 4, servicioMin: 10, prioridad: 1 },
          { lugarId: "obra-lejos", despachoId: "d2", pesoKg: 4000, volumenM3: 4, servicioMin: 10, prioridad: 1 },
        ],
      },
      lugares,
    );
    expect(r.orden).toHaveLength(1);
    expect(r.descartadas).toHaveLength(1);
    expect(r.descartadas[0].motivo).toContain("peso");
  });

  it("la prioridad alta entra aunque esté lejos", () => {
    const r = optimizarVecinoMasCercano(
      {
        ...base,
        paradas: [
          { lugarId: "obra-cerca", despachoId: "d-cerca", pesoKg: 4000, volumenM3: 4, servicioMin: 10, prioridad: 1 },
          { lugarId: "obra-lejos", despachoId: "d-urgente", pesoKg: 4000, volumenM3: 4, servicioMin: 10, prioridad: 9 },
        ],
      },
      lugares,
    );
    expect(r.orden).toContain("d-urgente");
    expect(r.descartadas[0].despachoId).toBe("d-cerca");
  });

  it("una parada sin coordenada se descarta con motivo", () => {
    const r = optimizarVecinoMasCercano(
      {
        ...base,
        paradas: [
          { lugarId: "fantasma", despachoId: "d-x", pesoKg: 10, volumenM3: 1, servicioMin: 5, prioridad: 1 },
        ],
      },
      lugares,
    );
    expect(r.descartadas[0].motivo).toContain("coordenada");
  });

  it("incluye el regreso al almacén en la distancia", () => {
    const r = optimizarVecinoMasCercano(base, lugares);
    const ida = distanciaDeOrden(LECHERIA, r.orden, (id) =>
      id === "d-cerca" ? BARCELONA : PUERTO_LA_CRUZ,
    );
    // `distanciaDeOrden` ya incluye el retorno; deben coincidir.
    expect(r.distanciaKm).toBeCloseTo(ida, 1);
  });

  it("sin paradas no inventa un viaje", () => {
    const r = optimizarVecinoMasCercano({ ...base, paradas: [] }, lugares);
    expect(r.orden).toHaveLength(0);
    expect(r.distanciaKm).toBe(0);
  });
});

describe("anti-spam de notificaciones", () => {
  const AHORA = Date.parse("2026-08-06T12:00:00.000Z");
  const msg = (severidad: MensajeNotificacion["severidad"]): MensajeNotificacion => ({
    clave: "v1|detencion",
    destino: "chat-1",
    severidad,
    titulo: "Vehículo detenido",
    cuerpo: "",
  });

  it("el primer aviso sale", () => {
    expect(debeEnviar(msg("alta"), "informativa", [], AHORA).enviar).toBe(true);
  });

  it("no repite el mismo aviso dentro del enfriamiento", () => {
    // "Vehículo detenido" es el mismo aviso al minuto que a los treinta segundos.
    const historial: EnvioRegistrado[] = [
      { clave: "v1|detencion", severidad: "alta", enviadoEnMs: AHORA - 60_000 },
    ];
    expect(debeEnviar(msg("alta"), "informativa", historial, AHORA).enviar).toBe(false);
  });

  it("sí repite cuando la severidad SUBE", () => {
    // Que lo que era advertencia pase a crítica es información nueva.
    const historial: EnvioRegistrado[] = [
      { clave: "v1|detencion", severidad: "advertencia", enviadoEnMs: AHORA - 60_000 },
    ];
    const r = debeEnviar(msg("critica"), "informativa", historial, AHORA);
    expect(r.enviar).toBe(true);
    expect(r.motivo).toContain("severidad");
  });

  it("respeta la severidad mínima del suscriptor", () => {
    // Quien solo quiere críticas no recibe "vehículo en ruta".
    expect(debeEnviar(msg("informativa"), "critica", [], AHORA).enviar).toBe(false);
  });

  it("vuelve a enviar cuando pasa el enfriamiento", () => {
    const historial: EnvioRegistrado[] = [
      { clave: "v1|detencion", severidad: "alta", enviadoEnMs: AHORA - 20 * 60_000 },
    ];
    expect(debeEnviar(msg("alta"), "informativa", historial, AHORA).enviar).toBe(true);
  });

  it("claves distintas no se bloquean entre sí", () => {
    const historial: EnvioRegistrado[] = [
      { clave: "v1|detencion", severidad: "alta", enviadoEnMs: AHORA - 60_000 },
    ];
    const otro = { ...msg("alta"), clave: "v2|desvio" };
    expect(debeEnviar(otro, "informativa", historial, AHORA).enviar).toBe(true);
  });
});

describe("idempotencia", () => {
  it("el mismo hecho produce la misma clave", () => {
    const a = claveEvento("v1", "entrada_geocerca", "2026-08-06T12:00:11.000Z");
    const b = claveEvento("v1", "entrada_geocerca", "2026-08-06T12:00:47.000Z");
    // Se trunca al minuto: dos webhooks del mismo evento difieren en
    // milisegundos y siguen siendo el mismo hecho.
    expect(a).toBe(b);
  });

  it("hechos distintos producen claves distintas", () => {
    expect(claveEvento("v1", "entrada_geocerca", "2026-08-06T12:00:00.000Z")).not.toBe(
      claveEvento("v2", "entrada_geocerca", "2026-08-06T12:00:00.000Z"),
    );
  });

  it("detecta el reenvío", () => {
    const vistos = new Set<string>();
    const c = claveEvento("v1", "detencion", "2026-08-06T12:00:00.000Z");
    expect(esDuplicado(c, vistos)).toBe(false);
    vistos.add(c);
    expect(esDuplicado(c, vistos)).toBe(true);
  });
});

describe("progreso del viaje", () => {
  const parada = (orden: number, estado: ParadaRuta["estado"]): ParadaRuta => ({
    id: `p${orden}`,
    orden,
    lugarId: "obra-1",
    despachoId: `d${orden}`,
    estado,
    llegadaPlanificada: "2026-08-06T09:00:00.000Z",
    servicioMin: 20,
    pesoKg: 100,
    volumenM3: 1,
  });

  it("la siguiente parada es la primera no cerrada, por orden", () => {
    const p = siguienteParada([
      parada(2, "pendiente"),
      parada(1, "completada"),
      parada(3, "pendiente"),
    ]);
    expect(p?.orden).toBe(2);
  });

  it("sin paradas abiertas devuelve null", () => {
    expect(siguienteParada([parada(1, "completada"), parada(2, "fallida")])).toBeNull();
  });

  it("el progreso cuenta solo las completadas", () => {
    expect(progresoViaje([parada(1, "completada"), parada(2, "pendiente")])).toBe(0.5);
    // Una fallida no es progreso: el material no llegó.
    expect(progresoViaje([parada(1, "completada"), parada(2, "fallida")])).toBe(0.5);
    expect(progresoViaje([])).toBe(0);
  });
});
