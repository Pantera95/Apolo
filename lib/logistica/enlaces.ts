import { siguienteParada } from "@/lib/logistica/nucleo";
import type { Coordenada, Lugar, PlanRuta } from "@/lib/logistica/tipos";

/**
 * Enlaces de navegación a Google Maps.
 *
 * Se usa el esquema de URL universal (`maps/dir/?api=1`), NO la Directions API:
 *
 *   - No necesita clave ni facturación. La Directions API cobra por petición.
 *   - Abre la aplicación nativa en Android e iOS, y el navegador en escritorio.
 *     Un enlace que obliga a copiar coordenadas a mano no lo usa ningún chofer.
 *   - Es estable y documentada por Google; los formatos antiguos tipo
 *     `maps?saddr=` funcionan por inercia y pueden dejar de hacerlo.
 *
 * Las coordenadas se envían como `lat,lon` en vez de nombres de lugar: un
 * nombre depende de que Google lo tenga indexado, y una obra en un camino sin
 * asfaltar no lo está. La coordenada siempre resuelve.
 */

/**
 * Google limita el esquema de URL a 9 puntos intermedios.
 *
 * Por encima de eso el enlace se abre pero descarta paradas EN SILENCIO, que es
 * el peor fallo posible aquí: el chofer navegaría una ruta incompleta sin que
 * nada se lo dijera.
 */
export const MAX_WAYPOINTS = 9;

const BASE = "https://www.google.com/maps/dir/?api=1";

function coord(c: Coordenada): string {
  // Seis decimales ≈ 11 cm. Más precisión solo alarga la URL sin ganar nada.
  return `${c.lat.toFixed(6)},${c.lon.toFixed(6)}`;
}

export interface EnlaceRuta {
  url: string;
  /** Paradas que NO cupieron en el enlace. Se informan, no se descartan. */
  omitidas: string[];
  paradas: number;
}

/**
 * Ruta completa planificada: almacén → obras en orden → vuelta al almacén.
 *
 * El destino es el almacén y no la última obra porque el viaje planificado
 * incluye el regreso: el camión no se queda en la obra, y la distancia y el
 * tiempo del plan ya cuentan la vuelta.
 */
export function enlaceRutaCompleta(
  ruta: PlanRuta,
  lugares: Lugar[],
): EnlaceRuta | null {
  const porId = new Map(lugares.map((l) => [l.id, l]));
  const origen = porId.get(ruta.almacenOrigenId);
  if (!origen) return null;

  const enOrden = [...ruta.paradas].sort((a, b) => a.orden - b.orden);
  const puntos = enOrden
    .map((p) => ({ parada: p, lugar: porId.get(p.lugarId) }))
    .filter((x): x is { parada: (typeof enOrden)[number]; lugar: Lugar } => Boolean(x.lugar));

  if (puntos.length === 0) return null;

  const dentro = puntos.slice(0, MAX_WAYPOINTS);
  const omitidas = puntos.slice(MAX_WAYPOINTS).map((x) => x.lugar.nombre);

  const params = new URLSearchParams({
    origin: coord(origen),
    destination: coord(origen),
    travelmode: "driving",
  });

  // Los waypoints van separados por "|", que URLSearchParams codifica como
  // %7C. Google lo acepta codificado, así que no hay que construirlo a mano.
  params.set("waypoints", dentro.map((x) => coord(x.lugar)).join("|"));

  return {
    url: `${BASE}&${params.toString()}`,
    omitidas,
    paradas: dentro.length,
  };
}

/**
 * Navegación directa a la siguiente parada pendiente.
 *
 * Es lo que un chofer necesita AHORA. La ruta completa sirve al supervisor;
 * al conductor le sobra todo lo que no sea el siguiente destino.
 *
 * El origen se deja vacío a propósito: así Google usa la posición real del
 * teléfono en ese momento, que es más útil que el almacén del que salió hace
 * dos horas.
 */
export function enlaceSiguienteParada(
  ruta: PlanRuta,
  lugares: Lugar[],
): { url: string; destino: Lugar } | null {
  const parada = siguienteParada(ruta.paradas);
  if (!parada) return null;
  const destino = lugares.find((l) => l.id === parada.lugarId);
  if (!destino) return null;

  const params = new URLSearchParams({
    destination: coord(destino),
    travelmode: "driving",
  });

  return { url: `${BASE}&${params.toString()}`, destino };
}

/**
 * Enlace a un punto suelto, para localizar un vehículo o una obra.
 *
 * Usa `maps/search` y no `dir`: no se pide una ruta, se pide "enséñame dónde
 * está esto". Con `dir` Google abriría el planificador con un destino y ningún
 * origen, que no es lo que se quiere al mirar dónde está un camión parado.
 */
export function enlacePunto(c: Coordenada): string {
  const params = new URLSearchParams({ api: "1", query: coord(c) });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}
