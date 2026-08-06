"use client";

import type { Coordenada, Lugar, PlanRuta, PosicionVehiculo } from "@/lib/logistica/tipos";
import { GEOCERCAS_DEMO } from "@/lib/logistica/simulado";

/**
 * Mapa del Centro de Control — SVG propio, sin librería ni proveedor.
 *
 * DECISIÓN DELIBERADA para el primer incremento (ver ADR-map-provider):
 * MapLibre GL JS es la elección recomendada para producción, pero necesita
 * teselas de un proveedor, una clave y ~800 KB de bundle. Nada de eso está
 * acordado todavía, y el encargo prohíbe conectar servicios productivos en
 * este incremento.
 *
 * Un SVG con proyección propia enseña exactamente lo mismo que hay que validar
 * ahora —posiciones relativas, rutas, geocercas, estado en vivo— sin clave, sin
 * red y sin vendor lock-in. Cuando el proveedor se decida, se sustituye este
 * componente: la pantalla no depende de él, solo le pasa coordenadas.
 *
 * Lo que NO tiene y hay que decir en voz alta: no hay callejero. Un desvío se
 * ve como separación de la línea recta, no como "tomó la avenida equivocada".
 */

const MARGEN = 0.012;

interface Props {
  lugares: Lugar[];
  rutas: PlanRuta[];
  posiciones: Map<string, PosicionVehiculo>;
  seleccion: string | null;
  onSeleccionar: (rutaId: string) => void;
  etiquetaVehiculo: (rutaId: string) => string;
}

export function MapaControl({
  lugares,
  rutas,
  posiciones,
  seleccion,
  onSeleccionar,
  etiquetaVehiculo,
}: Props) {
  const puntos: Coordenada[] = [
    ...lugares,
    ...rutas.flatMap((r) => r.trazado),
    ...[...posiciones.values()],
  ];
  if (puntos.length === 0) return null;

  const minLat = Math.min(...puntos.map((p) => p.lat)) - MARGEN;
  const maxLat = Math.max(...puntos.map((p) => p.lat)) + MARGEN;
  const minLon = Math.min(...puntos.map((p) => p.lon)) - MARGEN;
  const maxLon = Math.max(...puntos.map((p) => p.lon)) + MARGEN;

  const W = 1000;
  const H = 620;
  // La longitud se comprime por el coseno de la latitud: sin esta corrección
  // el mapa saldría estirado en horizontal y las distancias engañarían.
  const kLon = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);

  const x = (lon: number) => ((lon - minLon) / (maxLon - minLon)) * W;
  const y = (lat: number) => H - ((lat - minLat) / (maxLat - minLat)) * H;
  const r = (metros: number) => {
    const gradosLat = metros / 111_320;
    return (gradosLat / (maxLat - minLat)) * H;
  };
  void kLon;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-full w-full"
      role="img"
      aria-label="Mapa de operación logística"
    >
      <defs>
        <pattern id="rejilla" width="50" height="50" patternUnits="userSpaceOnUse">
          <path d="M50 0H0V50" fill="none" stroke="var(--borde)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="var(--superficie-2)" />
      <rect width={W} height={H} fill="url(#rejilla)" />

      {/* Geocercas primero: van debajo de todo lo demás. */}
      {GEOCERCAS_DEMO.map((g) => (
        <circle
          key={g.id}
          cx={x(g.centro.lon)}
          cy={y(g.centro.lat)}
          r={Math.max(6, r(g.radioM))}
          fill="var(--marca)"
          fillOpacity="0.08"
          stroke="var(--marca)"
          strokeOpacity="0.35"
          strokeDasharray="4 4"
        />
      ))}

      {/* Rutas planificadas. La seleccionada se engrosa y cambia de color. */}
      {rutas.map((ruta) => {
        const activa = ruta.id === seleccion;
        return (
          <polyline
            key={ruta.id}
            points={ruta.trazado.map((c) => `${x(c.lon)},${y(c.lat)}`).join(" ")}
            fill="none"
            stroke={activa ? "var(--bloque-luz)" : "var(--borde-fuerte)"}
            strokeWidth={activa ? 4 : 2}
            strokeDasharray={activa ? undefined : "8 6"}
            strokeLinejoin="round"
          />
        );
      })}

      {lugares.map((l) => (
        <g key={l.id}>
          {l.tipo === "almacen" ? (
            <rect
              x={x(l.lon) - 8}
              y={y(l.lat) - 8}
              width="16"
              height="16"
              rx="3"
              fill="var(--marca-fondo)"
              stroke="var(--texto-invertido)"
              strokeWidth="2"
            />
          ) : (
            <circle
              cx={x(l.lon)}
              cy={y(l.lat)}
              r="7"
              fill="var(--superficie)"
              stroke="var(--borde-fuerte)"
              strokeWidth="2.5"
            />
          )}
          <text
            x={x(l.lon) + 13}
            y={y(l.lat) + 4}
            fontSize="13"
            fill="var(--texto-2)"
            fontWeight="600"
          >
            {l.nombre}
          </text>
        </g>
      ))}

      {/* Vehículos al final: siempre por encima. */}
      {rutas.map((ruta) => {
        const p = posiciones.get(ruta.vehiculoId);
        if (!p) return null;
        const activa = ruta.id === seleccion;
        const detenido = p.velocidadKmh === 0;
        return (
          <g
            key={ruta.vehiculoId}
            onClick={() => onSeleccionar(ruta.id)}
            className="cursor-pointer"
            role="button"
            tabIndex={0}
            aria-label={etiquetaVehiculo(ruta.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onSeleccionar(ruta.id);
            }}
          >
            {/* Halo de selección: 44px de área de pulsación real. */}
            <circle
              cx={x(p.lon)}
              cy={y(p.lat)}
              r="22"
              fill={activa ? "var(--bloque-luz)" : "transparent"}
              fillOpacity="0.18"
            />
            <circle
              cx={x(p.lon)}
              cy={y(p.lat)}
              r="10"
              fill={detenido ? "var(--advertencia)" : "var(--bloque-luz)"}
              stroke="var(--texto-invertido)"
              strokeWidth="2.5"
            />
            {/* Flecha de rumbo: un marcador que no gira parece un error. */}
            <polygon
              points={`0,-16 5,-8 -5,-8`}
              transform={`translate(${x(p.lon)},${y(p.lat)}) rotate(${p.rumbo})`}
              fill={detenido ? "var(--advertencia)" : "var(--bloque-luz)"}
            />
            <text
              x={x(p.lon)}
              y={y(p.lat) + 4}
              fontSize="10"
              fontWeight="800"
              textAnchor="middle"
              fill="var(--texto-invertido)"
            >
              {etiquetaVehiculo(ruta.id).slice(0, 2)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
