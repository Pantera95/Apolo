"use client";

import * as maplibregl from "maplibre-gl";
import type { Map as MapaGL, Marker } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

import { GEOCERCAS_DEMO } from "@/lib/logistica/simulado";
import type { Lugar, PlanRuta, PosicionVehiculo } from "@/lib/logistica/tipos";

import "maplibre-gl/dist/maplibre-gl.css";

/**
 * Mapa real con callejero — MapLibre GL + teselas de OpenStreetMap.
 *
 * POR QUÉ MAPLIBRE Y NO GOOGLE MAPS: Google exige una clave con tarjeta de
 * crédito asociada y cobra por carga de mapa; en un panel que un supervisor
 * deja abierto toda la jornada eso es una factura variable difícil de acotar.
 * MapLibre es BSD-3 y las teselas son intercambiables cambiando una URL, así
 * que no ata el código a ningún proveedor.
 *
 * LAS TESELAS SON DE OPENSTREETMAP, sin clave. Sirven para el demo, pero su
 * política de uso NO permite tráfico de producción: antes de desplegar esto de
 * verdad hay que pasar a MapTiler, Protomaps o un servidor propio. Es cambiar
 * `TESELAS` y nada más — está aislado a propósito.
 *
 * Frente al SVG anterior esto añade lo único que le faltaba: calles. Un desvío
 * deja de verse como "separación de una recta" y pasa a verse como "tomó la
 * avenida equivocada", que es lo que un supervisor necesita para llamar al
 * chofer.
 */

const TESELAS = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const ESTILO: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: [TESELAS],
      tileSize: 256,
      attribution: "© OpenStreetMap",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

interface Props {
  lugares: Lugar[];
  rutas: PlanRuta[];
  posiciones: Map<string, PosicionVehiculo>;
  seleccion: string | null;
  onSeleccionar: (rutaId: string) => void;
  etiquetaVehiculo: (rutaId: string) => string;
  /** Tema activo: el mapa se atenúa en oscuro para no deslumbrar. */
  oscuro: boolean;
}

export function MapaReal({
  lugares,
  rutas,
  posiciones,
  seleccion,
  onSeleccionar,
  etiquetaVehiculo,
  oscuro,
}: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapaGL | null>(null);
  const marcadores = useRef<Marker[]>([]);
  const listo = useRef(false);
  /**
   * Las teselas pueden no llegar: una red corporativa que filtra dominios, una
   * política de uso de OSM, o un panel embebido que bloquea imágenes externas.
   * Sin este aviso el usuario vería un mapa en blanco y pensaría que la
   * aplicación falla, cuando lo que falla es la fuente del callejero.
   */
  const [fallaTeselas, setFallaTeselas] = useState(false);

  // Inicialización: una sola vez. Recrear el mapa en cada render perdería el
  // encuadre que el usuario acaba de ajustar.
  useEffect(() => {
    if (!contenedor.current || mapa.current) return;

    const m = new maplibregl.Map({
      container: contenedor.current,
      style: ESTILO,
      center: [-64.66, 10.19],
      zoom: 11,
      attributionControl: { compact: true },
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    m.on("load", () => {
      listo.current = true;
    });
    m.on("error", (e) => {
      const url = (e as unknown as { sourceId?: string }).sourceId;
      if (url === "osm") setFallaTeselas(true);
    });
    mapa.current = m;

    return () => {
      m.remove();
      mapa.current = null;
      listo.current = false;
    };
  }, []);

  // Rutas y geocercas: capas GeoJSON que se reemplazan cuando cambian.
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;

    const pintar = () => {
      const rutasGeo: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: rutas.map((r) => ({
          type: "Feature",
          properties: { id: r.id, activa: r.id === seleccion },
          geometry: {
            type: "LineString",
            coordinates: r.trazado.map((c) => [c.lon, c.lat]),
          },
        })),
      };

      // Las geocercas se dibujan como polígonos aproximados: MapLibre no tiene
      // círculos en metros sobre el terreno, y un `circle` en píxeles cambiaría
      // de tamaño real con el zoom, que es justo lo contrario de una geocerca.
      const cercasGeo: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: GEOCERCAS_DEMO.map((g) => ({
          type: "Feature",
          properties: { nombre: g.nombre },
          geometry: { type: "Polygon", coordinates: [circulo(g.centro.lon, g.centro.lat, g.radioM)] },
        })),
      };

      for (const [id, datos] of [
        ["rutas", rutasGeo],
        ["cercas", cercasGeo],
      ] as const) {
        const src = m.getSource(id) as maplibregl.GeoJSONSource | undefined;
        if (src) src.setData(datos);
        else m.addSource(id, { type: "geojson", data: datos });
      }

      if (!m.getLayer("cercas-relleno")) {
        m.addLayer({
          id: "cercas-relleno",
          type: "fill",
          source: "cercas",
          paint: { "fill-color": "#1b4fa6", "fill-opacity": 0.12 },
        });
        m.addLayer({
          id: "cercas-borde",
          type: "line",
          source: "cercas",
          paint: { "line-color": "#1b4fa6", "line-width": 1.5, "line-dasharray": [2, 2] },
        });
      }

      if (!m.getLayer("rutas-linea")) {
        m.addLayer({
          id: "rutas-linea",
          type: "line",
          source: "rutas",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": ["case", ["get", "activa"], "#f2b01e", "#8ab4f0"],
            "line-width": ["case", ["get", "activa"], 5, 3],
            "line-opacity": 0.95,
          },
        });
      }
    };

    if (listo.current) pintar();
    else m.once("load", pintar);
  }, [rutas, seleccion]);

  // Vehículos y lugares: marcadores DOM, que aceptan clic y estilo propio.
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;

    for (const mk of marcadores.current) mk.remove();
    marcadores.current = [];

    for (const l of lugares) {
      const el = document.createElement("div");
      el.className = "apolo-lugar";
      el.setAttribute("aria-hidden", "true");
      el.style.cssText = `width:14px;height:14px;border-radius:${
        l.tipo === "almacen" ? "3px" : "50%"
      };background:${l.tipo === "almacen" ? "#143a7a" : "#ffffff"};border:2.5px solid ${
        l.tipo === "almacen" ? "#ffffff" : "#143a7a"
      };box-shadow:0 1px 4px rgba(0,0,0,.4)`;
      marcadores.current.push(
        new maplibregl.Marker({ element: el })
          .setLngLat([l.lon, l.lat])
          .setPopup(new maplibregl.Popup({ offset: 14 }).setText(l.nombre))
          .addTo(m),
      );
    }

    for (const r of rutas) {
      const p = posiciones.get(r.vehiculoId);
      if (!p) continue;
      const activa = r.id === seleccion;
      const detenido = p.velocidadKmh === 0;

      const el = document.createElement("button");
      el.type = "button";
      el.setAttribute("aria-label", etiquetaVehiculo(r.id));
      // 44px reales de área de pulsación, aunque el punto visible sea menor.
      el.style.cssText = `width:44px;height:44px;display:grid;place-items:center;background:none;border:0;cursor:pointer;padding:0`;
      const punto = document.createElement("span");
      punto.style.cssText = `width:${activa ? 22 : 18}px;height:${activa ? 22 : 18}px;border-radius:50%;background:${
        detenido ? "#f0ad3f" : "#f2b01e"
      };border:3px solid ${activa ? "#143a7a" : "#ffffff"};box-shadow:0 2px 8px rgba(0,0,0,.45)`;
      el.appendChild(punto);
      el.addEventListener("click", () => onSeleccionar(r.id));

      marcadores.current.push(
        new maplibregl.Marker({ element: el }).setLngLat([p.lon, p.lat]).addTo(m),
      );
    }
  }, [lugares, rutas, posiciones, seleccion, onSeleccionar, etiquetaVehiculo]);

  return (
    <div
      ref={contenedor}
      className="relative h-full w-full"
      // El filtro atenúa el callejero claro en tema oscuro. Es lo que hacen los
      // mapas nocturnos de verdad: sin esto, el mapa deslumbra en una sala de
      // control con las luces bajas.
      style={oscuro ? { filter: "brightness(0.72) saturate(0.85) contrast(1.05)" } : undefined}
      role="application"
      aria-label="Mapa de operación logística"
    >
      {fallaTeselas && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 m-3 rounded-control border border-advertencia/40 bg-advertencia-tenue p-2 text-[11px] text-advertencia">
          No se pudieron cargar las teselas del callejero. Las rutas y los
          vehículos siguen siendo correctos; cambia a &quot;Esquema&quot; para
          verlos sin depender de la red.
        </div>
      )}
    </div>
  );
}

/** Polígono que aproxima un círculo de `radioM` metros alrededor del punto. */
function circulo(lon: number, lat: number, radioM: number, pasos = 48): [number, number][] {
  const puntos: [number, number][] = [];
  const dLat = radioM / 111_320;
  // La longitud se comprime por el coseno de la latitud: sin corregirlo el
  // "círculo" saldría un óvalo estirado en horizontal.
  const dLon = dLat / Math.cos((lat * Math.PI) / 180);
  for (let i = 0; i <= pasos; i++) {
    const a = (i / pasos) * 2 * Math.PI;
    puntos.push([lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return puntos;
}
