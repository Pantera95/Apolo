import type {
  CapacidadVehiculo,
  Coordenada,
  EntradaOptimizacion,
  EstadoParada,
  EstadoViaje,
  Geocerca,
  MensajeNotificacion,
  ParadaRuta,
  ResultadoOptimizacion,
  Severidad,
} from "@/lib/logistica/tipos";

/**
 * Núcleo logístico: funciones puras.
 *
 * Sin React, sin almacén, sin proveedores. Es lo único de este módulo que se
 * puede probar de verdad, y donde viven las reglas que no pueden romperse: una
 * transición inválida, una carga que excede la capacidad o una entrega
 * confirmada dos veces tienen que fallar AQUÍ, no en la pantalla.
 */

const RADIO_TIERRA_M = 6_371_000;

// ---------------------------------------------------------------------------
// Geografía
// ---------------------------------------------------------------------------

/**
 * Distancia entre dos puntos por la fórmula del semiverseno.
 *
 * No se usa distancia euclídea sobre lat/lon: un grado de longitud mide 111 km
 * en el ecuador y 78 km en Anzoátegui, así que la recta plana daría errores del
 * 30% justo en la dirección este-oeste.
 */
export function distanciaM(a: Coordenada, b: Coordenada): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * RADIO_TIERRA_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function distanciaKm(a: Coordenada, b: Coordenada): number {
  return distanciaM(a, b) / 1000;
}

/** ¿La posición cae dentro de la geocerca? */
export function dentroDeGeocerca(p: Coordenada, g: Geocerca): boolean {
  return distanciaM(p, g.centro) <= g.radioM;
}

/**
 * Distancia del vehículo al trazado planificado.
 *
 * Se mide contra el SEGMENTO más cercano, no contra el vértice más cercano. Un
 * camión a mitad de un tramo recto de 8 km está sobre la ruta, pero su vértice
 * más próximo queda a 4 km: medir contra vértices marcaría un desvío enorme en
 * cada tramo largo.
 */
export function desvioM(p: Coordenada, trazado: Coordenada[]): number | null {
  if (trazado.length === 0) return null;
  if (trazado.length === 1) return distanciaM(p, trazado[0]);

  let min = Infinity;
  for (let i = 0; i < trazado.length - 1; i++) {
    min = Math.min(min, distanciaASegmentoM(p, trazado[i], trazado[i + 1]));
  }
  return min;
}

function distanciaASegmentoM(p: Coordenada, a: Coordenada, b: Coordenada): number {
  // Proyección local en metros: a esta escala la curvatura es despreciable y
  // permite proyectar el punto sobre el segmento con álgebra plana.
  const mLat = 111_320;
  const mLon = 111_320 * Math.cos((p.lat * Math.PI) / 180);
  const px = (p.lon - a.lon) * mLon;
  const py = (p.lat - a.lat) * mLat;
  const bx = (b.lon - a.lon) * mLon;
  const by = (b.lat - a.lat) * mLat;

  const len2 = bx * bx + by * by;
  if (len2 === 0) return Math.hypot(px, py);

  // t acotado a [0,1]: fuera de ese rango el punto más cercano es un extremo.
  const t = Math.max(0, Math.min(1, (px * bx + py * by) / len2));
  return Math.hypot(px - t * bx, py - t * by);
}

// ---------------------------------------------------------------------------
// Capacidad
// ---------------------------------------------------------------------------

export interface UsoCapacidad {
  pesoKg: number;
  volumenM3: number;
  pctPeso: number;
  pctVolumen: number;
  excedePeso: boolean;
  excedeVolumen: boolean;
}

/**
 * Uso de la capacidad del vehículo.
 *
 * Se comprueban las DOS dimensiones. Una carga de aislante llena el camión sin
 * acercarse al límite de peso; una de cemento lo satura de peso con el camión
 * medio vacío. Validar solo una deja pasar la mitad de los errores.
 */
export function usoCapacidad(
  paradas: { pesoKg: number; volumenM3: number }[],
  cap: CapacidadVehiculo,
): UsoCapacidad {
  const pesoKg = paradas.reduce((s, p) => s + p.pesoKg, 0);
  const volumenM3 = paradas.reduce((s, p) => s + p.volumenM3, 0);
  const pctPeso = cap.pesoKg > 0 ? (pesoKg / cap.pesoKg) * 100 : 0;
  const pctVolumen = cap.volumenM3 > 0 ? (volumenM3 / cap.volumenM3) * 100 : 0;
  return {
    pesoKg,
    volumenM3,
    pctPeso,
    pctVolumen,
    excedePeso: cap.pesoKg > 0 && pesoKg > cap.pesoKg,
    excedeVolumen: cap.volumenM3 > 0 && volumenM3 > cap.volumenM3,
  };
}

// ---------------------------------------------------------------------------
// Máquinas de estados
// ---------------------------------------------------------------------------

/**
 * Transiciones permitidas del viaje.
 *
 * Un mapa explícito y no un `if`: así la regla se lee de un vistazo y añadir un
 * estado obliga a decidir de dónde se llega a él. Los estados terminales no
 * tienen salida a propósito — reabrir un viaje cerrado exigiría un movimiento
 * compensatorio, igual que en el kardex.
 */
const TRANSICIONES_VIAJE: Record<EstadoViaje, EstadoViaje[]> = {
  planificado: ["asignado", "cancelado"],
  asignado: ["en_carga", "planificado", "cancelado"],
  en_carga: ["cargado", "con_incidencia", "cancelado"],
  cargado: ["listo_para_salida", "en_carga", "con_incidencia"],
  listo_para_salida: ["en_ruta", "con_incidencia", "cancelado"],
  en_ruta: ["proximo", "en_geocerca", "con_incidencia", "fallido"],
  proximo: ["en_geocerca", "en_ruta", "con_incidencia", "fallido"],
  en_geocerca: ["descargando", "en_ruta", "con_incidencia", "fallido"],
  descargando: ["completado", "en_ruta", "con_incidencia", "fallido"],
  // Una incidencia no cierra el viaje: se resuelve y se retoma.
  con_incidencia: ["en_ruta", "descargando", "fallido", "cancelado"],
  completado: [],
  fallido: [],
  cancelado: [],
};

const TRANSICIONES_PARADA: Record<EstadoParada, EstadoParada[]> = {
  pendiente: ["en_ruta", "omitida"],
  en_ruta: ["proxima", "omitida", "fallida"],
  proxima: ["llegada_detectada", "en_ruta", "fallida"],
  // La llegada DETECTADA por geocerca no confirma la entrega: solo sugiere.
  llegada_detectada: ["llegada_confirmada", "en_ruta", "fallida"],
  llegada_confirmada: ["descargando", "fallida"],
  descargando: ["completada", "entrega_parcial", "fallida"],
  entrega_parcial: ["completada", "fallida"],
  completada: [],
  fallida: [],
  omitida: [],
};

export function puedeViajar(desde: EstadoViaje, hasta: EstadoViaje): boolean {
  return TRANSICIONES_VIAJE[desde].includes(hasta);
}

export function puedeParada(desde: EstadoParada, hasta: EstadoParada): boolean {
  return TRANSICIONES_PARADA[desde].includes(hasta);
}

export function esTerminalViaje(e: EstadoViaje): boolean {
  return TRANSICIONES_VIAJE[e].length === 0;
}

export function siguientesViaje(e: EstadoViaje): EstadoViaje[] {
  return [...TRANSICIONES_VIAJE[e]];
}

/**
 * Estados desde los que la entrega ya está confirmada.
 *
 * Confirmar dos veces duplicaría el movimiento de inventario, que es la regla
 * más cara de romper de todo el sistema.
 */
export function yaEntregada(e: EstadoParada): boolean {
  return e === "completada" || e === "entrega_parcial";
}

// ---------------------------------------------------------------------------
// ETA
// ---------------------------------------------------------------------------

export interface Eta {
  /** ISO. */
  llegadaEstimada: string;
  minutosRestantes: number;
  distanciaRestanteKm: number;
  /** Minutos de desvío frente a lo planificado. Negativo = adelantado. */
  desviacionMin: number;
}

/**
 * ETA a la siguiente parada.
 *
 * Se usa la velocidad media del trayecto, no la instantánea: un camión parado
 * en un semáforo tiene velocidad 0 y daría un ETA infinito. Con velocidad
 * instantánea nula se cae a la media planificada.
 */
export function calcularEta(
  posicion: Coordenada,
  destino: Coordenada,
  velocidadKmh: number,
  ahoraMs: number,
  llegadaPlanificadaISO: string,
  velocidadMediaKmh = 45,
  servicioMin = 0,
): Eta {
  const distanciaRestanteKm = distanciaKm(posicion, destino);
  const v = velocidadKmh > 5 ? velocidadKmh : velocidadMediaKmh;
  const minutosRestantes = (distanciaRestanteKm / v) * 60 + servicioMin;
  const llegadaMs = ahoraMs + minutosRestantes * 60_000;
  const plan = Date.parse(llegadaPlanificadaISO);

  return {
    llegadaEstimada: new Date(llegadaMs).toISOString(),
    minutosRestantes,
    distanciaRestanteKm,
    desviacionMin: Number.isFinite(plan) ? (llegadaMs - plan) / 60_000 : 0,
  };
}

/** Umbral por debajo del cual un cambio de ETA no merece avisar a nadie. */
export const UMBRAL_AVISO_ETA_MIN = 10;

/**
 * ¿Merece la pena avisar de este ETA?
 *
 * Un camión en tráfico cambia de ETA cada treinta segundos. Avisar de cada
 * variación convierte el canal en ruido y la gente lo silencia — y entonces
 * tampoco lee la alerta que sí importaba.
 */
export function meritaAvisoEta(anteriorMin: number | null, actualMin: number): boolean {
  if (anteriorMin === null) return true;
  return Math.abs(actualMin - anteriorMin) >= UMBRAL_AVISO_ETA_MIN;
}

// ---------------------------------------------------------------------------
// Optimización (heurística local, sustituible por VROOM)
// ---------------------------------------------------------------------------

/**
 * Orden de paradas por vecino más cercano, respetando capacidad y prioridad.
 *
 * NO pretende ser VROOM. Es una heurística honesta para el demo: sirve para
 * enseñar el flujo completo —comparar manual contra optimizado, ver el ahorro—
 * sin depender de un servicio externo. El puerto `ProveedorOptimizacion` está
 * definido para que VROOM entre después sin tocar la pantalla.
 *
 * Lo que NO cabe se DEVUELVE en `descartadas`. Descartarlo en silencio haría
 * creer que todo el pedido salió en el camión.
 */
export function optimizarVecinoMasCercano(
  entrada: EntradaOptimizacion,
  lugares: Map<string, Coordenada>,
): ResultadoOptimizacion {
  const cap = entrada.vehiculo.capacidad;
  const descartadas: ResultadoOptimizacion["descartadas"] = [];

  // Prioridad alta primero: una parada urgente no puede quedar fuera porque
  // otra estuviera más cerca del almacén.
  const candidatas = [...entrada.paradas].sort((a, b) => b.prioridad - a.prioridad);

  const aceptadas: typeof candidatas = [];
  let peso = 0;
  let volumen = 0;
  for (const p of candidatas) {
    if (peso + p.pesoKg > cap.pesoKg) {
      descartadas.push({ despachoId: p.despachoId, motivo: "excede peso" });
      continue;
    }
    if (volumen + p.volumenM3 > cap.volumenM3) {
      descartadas.push({ despachoId: p.despachoId, motivo: "excede volumen" });
      continue;
    }
    if (!lugares.has(p.lugarId)) {
      descartadas.push({ despachoId: p.despachoId, motivo: "sin coordenada" });
      continue;
    }
    aceptadas.push(p);
    peso += p.pesoKg;
    volumen += p.volumenM3;
  }

  const orden: string[] = [];
  let actual: Coordenada = entrada.origen;
  const pendientes = [...aceptadas];
  let distanciaKmTotal = 0;
  let servicioMin = 0;

  while (pendientes.length > 0) {
    let mejor = 0;
    let mejorD = Infinity;
    for (let i = 0; i < pendientes.length; i++) {
      const c = lugares.get(pendientes[i].lugarId);
      if (!c) continue;
      const d = distanciaKm(actual, c);
      if (d < mejorD) {
        mejorD = d;
        mejor = i;
      }
    }
    const elegida = pendientes.splice(mejor, 1)[0];
    orden.push(elegida.despachoId);
    distanciaKmTotal += mejorD;
    servicioMin += elegida.servicioMin;
    actual = lugares.get(elegida.lugarId) as Coordenada;
  }

  // Regreso al almacén: el camión no se queda en la última obra.
  if (orden.length > 0) distanciaKmTotal += distanciaKm(actual, entrada.origen);

  const v = entrada.velocidadMediaKmh > 0 ? entrada.velocidadMediaKmh : 45;
  return {
    orden,
    distanciaKm: distanciaKmTotal,
    duracionMin: (distanciaKmTotal / v) * 60 + servicioMin,
    descartadas,
  };
}

/** Distancia total de un orden dado. Sirve para comparar manual vs. optimizado. */
export function distanciaDeOrden(
  origen: Coordenada,
  orden: string[],
  lugarDe: (despachoId: string) => Coordenada | undefined,
): number {
  let total = 0;
  let actual = origen;
  for (const id of orden) {
    const c = lugarDe(id);
    if (!c) continue;
    total += distanciaKm(actual, c);
    actual = c;
  }
  return total + (orden.length > 0 ? distanciaKm(actual, origen) : 0);
}

// ---------------------------------------------------------------------------
// Anti-spam de notificaciones
// ---------------------------------------------------------------------------

const ORDEN_SEVERIDAD: Record<Severidad, number> = {
  informativa: 0,
  advertencia: 1,
  alta: 2,
  critica: 3,
};

export interface EnvioRegistrado {
  clave: string;
  severidad: Severidad;
  enviadoEnMs: number;
}

/** Minutos de enfriamiento por severidad. Lo crítico repite antes. */
export const ENFRIAMIENTO_MIN: Record<Severidad, number> = {
  informativa: 60,
  advertencia: 30,
  alta: 15,
  critica: 5,
};

/**
 * ¿Se envía este mensaje?
 *
 * Tres frenos, y los tres hacen falta:
 *
 *   1. Severidad mínima del suscriptor. Quien solo quiere críticas no recibe
 *      "vehículo en ruta".
 *   2. Deduplicación por clave. "Vehículo detenido" es el mismo aviso a los
 *      treinta segundos que al minuto.
 *   3. Enfriamiento por tiempo. Salvo que la severidad SUBA: si lo que era
 *      advertencia pasa a crítica, eso es información nueva y se envía aunque
 *      el enfriamiento siga activo.
 *
 * Sin esto el canal se vuelve ruido, la gente lo silencia, y entonces tampoco
 * lee la alerta que sí importaba.
 */
export function debeEnviar(
  mensaje: MensajeNotificacion,
  severidadMinima: Severidad,
  historial: EnvioRegistrado[],
  ahoraMs: number,
): { enviar: boolean; motivo: string } {
  if (ORDEN_SEVERIDAD[mensaje.severidad] < ORDEN_SEVERIDAD[severidadMinima]) {
    return { enviar: false, motivo: "por debajo de la severidad suscrita" };
  }

  const previo = historial
    .filter((h) => h.clave === mensaje.clave)
    .sort((a, b) => b.enviadoEnMs - a.enviadoEnMs)[0];

  if (!previo) return { enviar: true, motivo: "primer aviso" };

  if (ORDEN_SEVERIDAD[mensaje.severidad] > ORDEN_SEVERIDAD[previo.severidad]) {
    return { enviar: true, motivo: "la severidad subió" };
  }

  const transcurridoMin = (ahoraMs - previo.enviadoEnMs) / 60_000;
  const enfriamiento = ENFRIAMIENTO_MIN[mensaje.severidad];
  if (transcurridoMin < enfriamiento) {
    return { enviar: false, motivo: `en enfriamiento (${enfriamiento} min)` };
  }

  return { enviar: true, motivo: "enfriamiento cumplido" };
}

// ---------------------------------------------------------------------------
// Idempotencia
// ---------------------------------------------------------------------------

/**
 * Clave estable de un evento de tracking.
 *
 * Traccar reenvía webhooks cuando no recibe confirmación, y las posiciones
 * llegan desordenadas. La clave se construye del contenido —no de un
 * autoincremento— para que el mismo hecho produzca siempre la misma clave y el
 * reenvío se descarte.
 */
export function claveEvento(
  vehiculoId: string,
  tipo: string,
  enISO: string,
  extra = "",
): string {
  // Se trunca al minuto: dos webhooks del mismo evento pueden diferir en
  // milisegundos y seguirían siendo el mismo hecho.
  return `${vehiculoId}|${tipo}|${enISO.slice(0, 16)}|${extra}`;
}

export function esDuplicado(clave: string, vistos: Set<string>): boolean {
  return vistos.has(clave);
}

// ---------------------------------------------------------------------------
// Progreso del viaje
// ---------------------------------------------------------------------------

/** Siguiente parada pendiente, o null si el viaje terminó. */
export function siguienteParada(paradas: ParadaRuta[]): ParadaRuta | null {
  return (
    [...paradas]
      .sort((a, b) => a.orden - b.orden)
      .find((p) => !["completada", "fallida", "omitida"].includes(p.estado)) ?? null
  );
}

export function progresoViaje(paradas: ParadaRuta[]): number {
  if (paradas.length === 0) return 0;
  const hechas = paradas.filter((p) => p.estado === "completada").length;
  return hechas / paradas.length;
}
