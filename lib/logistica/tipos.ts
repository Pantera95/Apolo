/**
 * Centro de Control Logístico — tipos y puertos.
 *
 * REGLA DE FRONTERA: el dominio no importa nada de Traccar, VROOM, GraphHopper,
 * MapLibre ni Telegram. Todo proveedor externo entra por una interfaz definida
 * aquí. Es lo que permite arrancar con un simulador y cambiar a Traccar sin
 * tocar una sola regla de negocio.
 *
 * Apolo sigue siendo la fuente de verdad operacional. Telegram es un canal de
 * aviso, no un sistema de registro: si el mensaje no sale, la entrega existe
 * igual.
 */

// ---------------------------------------------------------------------------
// Geografía
// ---------------------------------------------------------------------------

export interface Coordenada {
  lat: number;
  lon: number;
}

/**
 * Punto con nombre: un almacén, una obra o una parada.
 *
 * Las obras del dominio guardan `ubicacionGeografica` como texto libre. No se
 * cambia ese campo: se añade la coordenada aparte, porque el texto sigue siendo
 * lo que un chofer lee y la coordenada lo que consume el mapa.
 */
export interface Lugar extends Coordenada {
  id: string;
  nombre: string;
  tipo: "almacen" | "obra";
}

export interface Geocerca {
  id: string;
  lugarId: string;
  nombre: string;
  centro: Coordenada;
  /** Metros. Fuera de este radio se considera que el vehículo no ha llegado. */
  radioM: number;
}

// ---------------------------------------------------------------------------
// Máquinas de estados
// ---------------------------------------------------------------------------

/**
 * Estados del viaje.
 *
 * Es una máquina NUEVA que envuelve al despacho existente sin sustituirla: el
 * `EstadoDespacho` del dominio sigue mandando sobre el inventario, y este
 * describe dónde está el camión. Fundir las dos rompería la regla de que un
 * despacho no consume inventario dos veces.
 */
export type EstadoViaje =
  | "planificado"
  | "asignado"
  | "en_carga"
  | "cargado"
  | "listo_para_salida"
  | "en_ruta"
  | "proximo"
  | "en_geocerca"
  | "descargando"
  | "completado"
  | "fallido"
  | "cancelado"
  | "con_incidencia";

export type EstadoParada =
  | "pendiente"
  | "en_ruta"
  | "proxima"
  | "llegada_detectada"
  | "llegada_confirmada"
  | "descargando"
  | "entrega_parcial"
  | "completada"
  | "fallida"
  | "omitida";

export type EstadoVehiculo =
  | "disponible"
  | "asignado"
  | "cargando"
  | "en_ruta"
  | "detenido"
  | "descargando"
  | "mantenimiento"
  | "averiado"
  | "fuera_de_servicio"
  | "sin_conexion_gps";

// ---------------------------------------------------------------------------
// Flota
// ---------------------------------------------------------------------------

/**
 * Capacidad del vehículo.
 *
 * Peso Y volumen, no uno de los dos: una carga de aislante llena el camión sin
 * acercarse al límite de peso, y una de cemento lo satura de peso con el
 * camión medio vacío. Validar solo una deja pasar la mitad de los errores.
 */
export interface CapacidadVehiculo {
  pesoKg: number;
  volumenM3: number;
}

export interface VehiculoLogistico {
  id: string;
  placa: string;
  descripcion: string;
  capacidad: CapacidadVehiculo;
  estado: EstadoVehiculo;
  almacenBaseId: string;
  /** Sin dispositivo no hay tracking, y eso es una alerta por sí sola. */
  dispositivoGpsId?: string;
}

// ---------------------------------------------------------------------------
// Rutas y paradas
// ---------------------------------------------------------------------------

export interface ParadaRuta {
  id: string;
  orden: number;
  lugarId: string;
  despachoId: string;
  estado: EstadoParada;
  /** ISO. Planificado. */
  llegadaPlanificada: string;
  /** Minutos de descarga previstos. */
  servicioMin: number;
  /** ISO. Real, cuando ocurre. */
  llegadaReal?: string;
  salidaReal?: string;
  pesoKg: number;
  volumenM3: number;
}

export interface PlanRuta {
  id: string;
  codigo: string;
  fecha: string;
  almacenOrigenId: string;
  vehiculoId: string;
  choferId: string;
  estado: EstadoViaje;
  paradas: ParadaRuta[];
  /** Polilínea planificada. En el simulador son tramos rectos entre paradas. */
  trazado: Coordenada[];
  distanciaPlanKm: number;
  duracionPlanMin: number;
  /** Versión: republicar una ruta no borra la anterior, la sucede. */
  version: number;
  publicadaEn?: string;
}

// ---------------------------------------------------------------------------
// Telemetría
// ---------------------------------------------------------------------------

export interface PosicionVehiculo extends Coordenada {
  vehiculoId: string;
  /** ISO. Del dispositivo, no del servidor: llegan desordenadas. */
  registradaEn: string;
  velocidadKmh: number;
  rumbo: number;
}

export type TipoEventoTracking =
  | "entrada_geocerca"
  | "salida_geocerca"
  | "detencion"
  | "desvio"
  | "exceso_velocidad"
  | "perdida_senal"
  | "recuperacion_senal";

export interface EventoTracking {
  /** Idempotencia: el mismo evento reenviado no se procesa dos veces. */
  id: string;
  vehiculoId: string;
  tipo: TipoEventoTracking;
  en: string;
  posicion?: Coordenada;
  detalle: string;
}

// ---------------------------------------------------------------------------
// Puertos de proveedor
// ---------------------------------------------------------------------------

/** Traccar en producción; simulador en el demo. */
export interface ProveedorTracking {
  nombre: string;
  ultimaPosicion(vehiculoId: string): Promise<PosicionVehiculo | null>;
  historial(vehiculoId: string, desde: Date, hasta: Date): Promise<PosicionVehiculo[]>;
  suscribir(vehiculoId: string, cb: (e: EventoTracking) => void): () => void;
}

/** VROOM en producción; heurística propia en el demo. */
export interface ProveedorOptimizacion {
  nombre: string;
  optimizar(entrada: EntradaOptimizacion): Promise<ResultadoOptimizacion>;
}

export interface EntradaOptimizacion {
  origen: Lugar;
  paradas: { lugarId: string; despachoId: string; pesoKg: number; volumenM3: number; servicioMin: number; prioridad: number }[];
  vehiculo: VehiculoLogistico;
  salidaISO: string;
  velocidadMediaKmh: number;
}

export interface ResultadoOptimizacion {
  orden: string[];
  distanciaKm: number;
  duracionMin: number;
  /** Lo que NO cupo. Devolverlo es obligatorio: descartarlo en silencio
      haría creer que todo el pedido salió en el camión. */
  descartadas: { despachoId: string; motivo: string }[];
}

/** Telegram en producción; registro en memoria en el demo. */
export interface ProveedorNotificacion {
  nombre: string;
  /** `true` = se envió de verdad. En modo prueba siempre es false. */
  enviar(mensaje: MensajeNotificacion): Promise<{ enviado: boolean; motivo?: string }>;
}

export interface MensajeNotificacion {
  /** Clave de deduplicación. Dos eventos con la misma clave son el mismo aviso. */
  clave: string;
  destino: string;
  severidad: Severidad;
  titulo: string;
  cuerpo: string;
  enlace?: string;
}

export type Severidad = "informativa" | "advertencia" | "alta" | "critica";

export interface Suscripcion {
  id: string;
  /** Identificador del chat. Nunca se muestra completo en pantalla. */
  chatId: string;
  etiqueta: string;
  rol: string;
  obraIds: string[];
  almacenIds: string[];
  severidadMinima: Severidad;
  activa: boolean;
}
