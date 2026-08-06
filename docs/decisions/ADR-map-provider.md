# ADR — Proveedor de mapas

**Estado:** aceptado para el incremento 1 · a revisar antes del 2

## Decisión

**SVG propio ahora. MapLibre GL JS recomendado para producción.**

## Comparación

| | Licencia | Coste | Lock-in | Bundle | Callejero |
|---|---|---|---|---|---|
| **MapLibre GL** | BSD-3 | Gratis (teselas aparte) | Bajo | ~800 KB | Sí |
| Mapbox GL | Propietaria desde v2 | Por carga de mapa | **Alto** | ~800 KB | Sí |
| Google Maps | Propietaria | Por carga, con tarjeta obligatoria | **Alto** | ~500 KB | Sí |
| HERE | Propietaria | Por transacción | Alto | ~600 KB | Sí |
| Leaflet | BSD-2 | Gratis | Bajo | ~140 KB | Sí (ráster) |
| **SVG propio** | — | 0 | **Ninguno** | ~4 KB | **No** |

## Por qué SVG ahora

MapLibre necesita teselas de un proveedor, una clave y ~800 KB. Nada de eso
está acordado, y el encargo prohíbe conectar servicios productivos en este
incremento. El SVG enseña lo que hay que validar hoy —posiciones relativas,
rutas, geocercas, estado en vivo— sin clave, sin red y sin lock-in.

**Lo que NO tiene, y hay que decirlo:** no hay callejero. Un desvío se ve como
separación de la línea recta, no como "tomó la avenida equivocada". Para
supervisión real eso no basta.

## Por qué MapLibre después

Es el único de la lista con licencia libre, callejero y sin lock-in de
proveedor: las teselas se pueden servir desde MapTiler, Protomaps o un servidor
propio, y cambiar de una a otra es cambiar una URL. Mapbox y Google atan el
código al proveedor; Leaflet es más ligero pero su rendimiento cae con muchos
marcadores en movimiento, que es justo este caso.

La pantalla no depende del mapa: le pasa coordenadas. Sustituir el componente
no toca ninguna regla.
