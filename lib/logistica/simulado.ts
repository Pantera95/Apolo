import {
  calcularEta,
  claveEvento,
  dentroDeGeocerca,
  desvioM,
  distanciaKm,
  optimizarVecinoMasCercano,
  siguienteParada,
} from "@/lib/logistica/nucleo";
import type {
  Coordenada,
  EntradaOptimizacion,
  EstadoViaje,
  EventoTracking,
  Geocerca,
  Lugar,
  MensajeNotificacion,
  ParadaRuta,
  PlanRuta,
  PosicionVehiculo,
  ProveedorNotificacion,
  ProveedorOptimizacion,
  ProveedorTracking,
  Suscripcion,
  VehiculoLogistico,
} from "@/lib/logistica/tipos";

/**
 * Proveedores simulados del primer incremento.
 *
 * Cumplen los mismos puertos que Traccar, VROOM y Telegram cumplirán después.
 * Existen para que el flujo completo —planificar, salir, seguir, entregar,
 * avisar— se pueda enseñar y probar sin ningún servicio externo, sin claves y
 * sin conexión.
 *
 * NADA de este archivo sale a Internet. El encargo lo pide explícitamente: no
 * conectar GPS productivos ni enviar mensajes reales sin configuración de
 * entorno explícita.
 */

// ---------------------------------------------------------------------------
// Escenario: Lechería, Anzoátegui
// ---------------------------------------------------------------------------

export const ALMACENES_DEMO: Lugar[] = [
  { id: "alm-central", nombre: "Almacén Central", tipo: "almacen", lat: 10.1811, lon: -64.6911 },
  { id: "alm-norte", nombre: "Almacén Norte", tipo: "almacen", lat: 10.2167, lon: -64.6167 },
];

export const OBRAS_DEMO: Lugar[] = [
  { id: "obra-pinos", nombre: "Obra Los Pinos", tipo: "obra", lat: 10.1333, lon: -64.6833 },
  { id: "obra-refineria", nombre: "Ampliación Refinería", tipo: "obra", lat: 10.2400, lon: -64.5900 },
  { id: "obra-muelle", nombre: "Muelle Industrial", tipo: "obra", lat: 10.2050, lon: -64.7200 },
  { id: "obra-planta", nombre: "Planta de Proceso", tipo: "obra", lat: 10.1550, lon: -64.6300 },
];

export const LUGARES_DEMO: Lugar[] = [...ALMACENES_DEMO, ...OBRAS_DEMO];

/** Radios distintos: un almacén ocupa más terreno que un frente de obra. */
export const GEOCERCAS_DEMO: Geocerca[] = LUGARES_DEMO.map((l) => ({
  id: `gc-${l.id}`,
  lugarId: l.id,
  nombre: l.nombre,
  centro: { lat: l.lat, lon: l.lon },
  radioM: l.tipo === "almacen" ? 400 : 250,
}));

export const VEHICULOS_DEMO: VehiculoLogistico[] = [
  {
    id: "veh-07",
    placa: "A12BC7D",
    descripcion: "Camión 07 — plataforma",
    capacidad: { pesoKg: 12000, volumenM3: 36 },
    estado: "en_ruta",
    almacenBaseId: "alm-central",
    dispositivoGpsId: "gps-07",
  },
  {
    id: "veh-11",
    placa: "B44XY1Z",
    descripcion: "Camión 11 — volteo",
    capacidad: { pesoKg: 9000, volumenM3: 14 },
    estado: "en_ruta",
    almacenBaseId: "alm-central",
    dispositivoGpsId: "gps-11",
  },
  {
    id: "veh-03",
    placa: "C90KL5M",
    descripcion: "Camioneta 03 — herramienta",
    capacidad: { pesoKg: 1200, volumenM3: 6 },
    estado: "cargando",
    almacenBaseId: "alm-norte",
    dispositivoGpsId: "gps-03",
  },
  {
    id: "veh-15",
    placa: "D21PQ8R",
    descripcion: "Camión 15 — estacas",
    capacidad: { pesoKg: 8000, volumenM3: 22 },
    // Sin dispositivo: es una alerta por sí sola y el panel la muestra.
    estado: "disponible",
    almacenBaseId: "alm-central",
  },
];

export const CHOFERES_DEMO: Record<string, string> = {
  "veh-07": "Carlos Méndez",
  "veh-11": "Ramón Guaita",
  "veh-03": "Luis Salazar",
  "veh-15": "Sin asignar",
};

function iso(base: number, minutos: number): string {
  return new Date(base + minutos * 60_000).toISOString();
}

/**
 * Rutas del día.
 *
 * Se construyen relativas a `ahoraMs` para que el demo siempre esté "en hora"
 * sin importar cuándo se abra: fechas fijas harían que el escenario apareciera
 * con seis meses de retraso.
 */
export function rutasDemo(ahoraMs: number): PlanRuta[] {
  const coord = new Map(LUGARES_DEMO.map((l) => [l.id, { lat: l.lat, lon: l.lon }]));

  const construir = (
    id: string,
    codigo: string,
    vehiculoId: string,
    origenId: string,
    estado: EstadoViaje,
    paradas: { lugarId: string; despachoId: string; estado: ParadaRuta["estado"]; min: number; pesoKg: number; volumenM3: number }[],
  ): PlanRuta => {
    const origen = coord.get(origenId) as Coordenada;
    const trazado: Coordenada[] = [origen, ...paradas.map((p) => coord.get(p.lugarId) as Coordenada), origen];
    let km = 0;
    for (let i = 0; i < trazado.length - 1; i++) km += distanciaKm(trazado[i], trazado[i + 1]);

    return {
      id,
      codigo,
      fecha: new Date(ahoraMs).toISOString().slice(0, 10),
      almacenOrigenId: origenId,
      vehiculoId,
      choferId: vehiculoId,
      estado,
      trazado,
      distanciaPlanKm: km,
      duracionPlanMin: (km / 45) * 60 + paradas.length * 25,
      version: 1,
      publicadaEn: iso(ahoraMs, -180),
      paradas: paradas.map((p, i) => ({
        id: `${id}-p${i + 1}`,
        orden: i + 1,
        lugarId: p.lugarId,
        despachoId: p.despachoId,
        estado: p.estado,
        llegadaPlanificada: iso(ahoraMs, p.min),
        servicioMin: 25,
        pesoKg: p.pesoKg,
        volumenM3: p.volumenM3,
        llegadaReal: p.estado === "completada" ? iso(ahoraMs, p.min - 6) : undefined,
      })),
    };
  };

  return [
    construir("ruta-1", "RTA-0241", "veh-07", "alm-central", "en_ruta", [
      { lugarId: "obra-pinos", despachoId: "DSP-024", estado: "completada", min: -45, pesoKg: 4200, volumenM3: 11 },
      { lugarId: "obra-planta", despachoId: "DSP-025", estado: "proxima", min: 18, pesoKg: 3100, volumenM3: 9 },
      { lugarId: "obra-refineria", despachoId: "DSP-026", estado: "pendiente", min: 75, pesoKg: 2600, volumenM3: 8 },
    ]),
    construir("ruta-2", "RTA-0242", "veh-11", "alm-central", "en_ruta", [
      { lugarId: "obra-muelle", despachoId: "DSP-027", estado: "llegada_detectada", min: -8, pesoKg: 6400, volumenM3: 10 },
    ]),
    construir("ruta-3", "RTA-0243", "veh-03", "alm-norte", "en_carga", [
      { lugarId: "obra-refineria", despachoId: "DSP-028", estado: "pendiente", min: 95, pesoKg: 700, volumenM3: 4 },
    ]),
  ];
}

// ---------------------------------------------------------------------------
// Tracking simulado
// ---------------------------------------------------------------------------

/**
 * Posición interpolada sobre el trazado.
 *
 * El avance se deriva del reloj, no de un temporizador: así dos pestañas
 * abiertas muestran el mismo camión en el mismo sitio, y recargar no teletransporta
 * el vehículo al principio de la ruta.
 */
export function posicionSimulada(ruta: PlanRuta, ahoraMs: number): PosicionVehiculo {
  const t = ruta.trazado;
  // Ciclo de 50 minutos sobre el trazado; el desfase por ruta evita que todos
  // los camiones salgan sincronizados como en un desfile.
  const desfase = ruta.id.charCodeAt(ruta.id.length - 1) * 137;
  const ciclo = 50 * 60_000;
  const avance = (((ahoraMs + desfase * 1000) % ciclo) / ciclo) * (t.length - 1);
  const i = Math.min(Math.floor(avance), t.length - 2);
  const f = avance - i;

  const a = t[i];
  const b = t[i + 1];
  const lat = a.lat + (b.lat - a.lat) * f;
  const lon = a.lon + (b.lon - a.lon) * f;

  // Rumbo desde el tramo: un marcador que no gira parece un error de dibujo.
  const rumbo = (Math.atan2(b.lon - a.lon, b.lat - a.lat) * 180) / Math.PI;

  return {
    vehiculoId: ruta.vehiculoId,
    lat,
    lon,
    registradaEn: new Date(ahoraMs).toISOString(),
    // El camión "para" en las inmediaciones de cada vértice, como en la calle.
    velocidadKmh: f < 0.08 || f > 0.92 ? 0 : 38 + ((i * 7) % 22),
    rumbo: (rumbo + 360) % 360,
  };
}

export function trackingSimulado(rutas: PlanRuta[]): ProveedorTracking {
  return {
    nombre: "simulado",
    async ultimaPosicion(vehiculoId) {
      const r = rutas.find((x) => x.vehiculoId === vehiculoId);
      return r ? posicionSimulada(r, Date.now()) : null;
    },
    async historial(vehiculoId, desde, hasta) {
      const r = rutas.find((x) => x.vehiculoId === vehiculoId);
      if (!r) return [];
      const paso = 60_000;
      const out: PosicionVehiculo[] = [];
      for (let t = desde.getTime(); t <= hasta.getTime(); t += paso) {
        out.push(posicionSimulada(r, t));
      }
      return out;
    },
    suscribir(vehiculoId, cb) {
      const reloj = window.setInterval(() => {
        const r = rutas.find((x) => x.vehiculoId === vehiculoId);
        if (!r) return;
        const p = posicionSimulada(r, Date.now());
        if (p.velocidadKmh === 0) {
          cb({
            id: claveEvento(vehiculoId, "detencion", p.registradaEn),
            vehiculoId,
            tipo: "detencion",
            en: p.registradaEn,
            posicion: { lat: p.lat, lon: p.lon },
            detalle: "Vehículo detenido",
          });
        }
      }, 15_000);
      return () => window.clearInterval(reloj);
    },
  };
}

/**
 * Eventos derivados del estado actual.
 *
 * Se calculan de la posición, no se almacenan: una alerta guardada se queda
 * encendida cuando la causa ya se resolvió. Cada evento trae su clave de
 * idempotencia para que un reenvío no lo procese dos veces.
 */
export function eventosDeRuta(
  ruta: PlanRuta,
  posicion: PosicionVehiculo,
  ahoraMs: number,
): EventoTracking[] {
  const out: EventoTracking[] = [];
  const p: Coordenada = { lat: posicion.lat, lon: posicion.lon };

  for (const g of GEOCERCAS_DEMO) {
    if (dentroDeGeocerca(p, g)) {
      out.push({
        id: claveEvento(ruta.vehiculoId, "entrada_geocerca", posicion.registradaEn, g.id),
        vehiculoId: ruta.vehiculoId,
        tipo: "entrada_geocerca",
        en: posicion.registradaEn,
        posicion: p,
        detalle: `Dentro de ${g.nombre}`,
      });
    }
  }

  const d = desvioM(p, ruta.trazado);
  if (d !== null && d > 800) {
    out.push({
      id: claveEvento(ruta.vehiculoId, "desvio", posicion.registradaEn),
      vehiculoId: ruta.vehiculoId,
      tipo: "desvio",
      en: posicion.registradaEn,
      posicion: p,
      detalle: `A ${Math.round(d)} m de la ruta planificada`,
    });
  }

  if (posicion.velocidadKmh === 0) {
    out.push({
      id: claveEvento(ruta.vehiculoId, "detencion", posicion.registradaEn),
      vehiculoId: ruta.vehiculoId,
      tipo: "detencion",
      en: posicion.registradaEn,
      posicion: p,
      detalle: "Vehículo detenido",
    });
  }

  void ahoraMs;
  return out;
}

/** ETA a la siguiente parada de la ruta, o null si el viaje terminó. */
export function etaDeRuta(ruta: PlanRuta, posicion: PosicionVehiculo, ahoraMs: number) {
  const parada = siguienteParada(ruta.paradas);
  if (!parada) return null;
  const destino = LUGARES_DEMO.find((l) => l.id === parada.lugarId);
  if (!destino) return null;
  return {
    parada,
    destino,
    eta: calcularEta(
      { lat: posicion.lat, lon: posicion.lon },
      { lat: destino.lat, lon: destino.lon },
      posicion.velocidadKmh,
      ahoraMs,
      parada.llegadaPlanificada,
      45,
      parada.servicioMin,
    ),
  };
}

// ---------------------------------------------------------------------------
// Optimización simulada
// ---------------------------------------------------------------------------

export function optimizacionSimulada(): ProveedorOptimizacion {
  const lugares = new Map<string, Coordenada>(
    LUGARES_DEMO.map((l) => [l.id, { lat: l.lat, lon: l.lon }]),
  );
  return {
    nombre: "heuristica-local",
    async optimizar(entrada: EntradaOptimizacion) {
      return optimizarVecinoMasCercano(entrada, lugares);
    },
  };
}

// ---------------------------------------------------------------------------
// Notificaciones en modo prueba
// ---------------------------------------------------------------------------

export interface EnvioSimulado extends MensajeNotificacion {
  enMs: number;
  enviado: boolean;
  motivo: string;
}

/**
 * Telegram en modo prueba.
 *
 * NO envía nada. Registra el mensaje exactamente como saldría, con su formato
 * final, para poder revisarlo en pantalla. El envío real exige que
 * `TELEGRAM_BOT_TOKEN` esté configurado en el servidor y ocurre en una Edge
 * Function, nunca en el navegador: el token no puede llegar al cliente.
 */
export function notificacionEnPruebas(
  registrar: (e: EnvioSimulado) => void,
): ProveedorNotificacion {
  return {
    nombre: "telegram-pruebas",
    async enviar(mensaje) {
      const motivo = "modo prueba: no se contacta con Telegram";
      registrar({ ...mensaje, enMs: Date.now(), enviado: false, motivo });
      return { enviado: false, motivo };
    },
  };
}

export const SUSCRIPCIONES_DEMO: Suscripcion[] = [
  {
    id: "sus-1",
    chatId: "-100••••4821",
    etiqueta: "Supervisión Logística",
    rol: "Encargado de logística",
    obraIds: [],
    almacenIds: ["alm-central"],
    severidadMinima: "advertencia",
    activa: true,
  },
  {
    id: "sus-2",
    chatId: "••••7734",
    etiqueta: "Gerencia de obra — Los Pinos",
    rol: "Gerente de obra",
    obraIds: ["obra-pinos"],
    almacenIds: [],
    severidadMinima: "alta",
    activa: true,
  },
  {
    id: "sus-3",
    chatId: "••••2190",
    etiqueta: "Receptor — Refinería",
    rol: "Receptor en obra",
    obraIds: ["obra-refineria"],
    almacenIds: [],
    severidadMinima: "critica",
    activa: false,
  },
];

/**
 * Formato del mensaje.
 *
 * Breve y accionable: quién, qué, dónde, cuándo y el enlace para actuar. Un
 * mensaje que obliga a abrir la app para entender qué pasó no sirve de nada en
 * un teléfono a pie de obra.
 */
export function formatearMensaje(m: MensajeNotificacion): string {
  const cabecera = `[${m.severidad.toUpperCase()}] ${m.titulo}`;
  return [cabecera, m.cuerpo, m.enlace ? `Ver seguimiento:\n${m.enlace}` : ""]
    .filter(Boolean)
    .join("\n");
}
