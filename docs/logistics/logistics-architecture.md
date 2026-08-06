# Centro de Control Logístico — arquitectura

## Auditoría previa

| Ya existía | No existía |
|---|---|
| `Vehiculo`, `Chofer` | Capacidad (peso/volumen) |
| `Despacho` con `choferId`/`vehiculoId` | Rutas y paradas |
| Máquina de 5 estados: `en_preparacion → listo → en_ruta → entregado \| con_discrepancia` | Coordenadas (las obras guardan `ubicacionGeografica` como TEXTO LIBRE) |
| Kardex inmutable, `Resultado<T>`, 302 pruebas | Tracking, ETA, geocercas, notificaciones |

`npm test`, `npx tsc --noEmit` y `npm run build` estaban en verde antes de tocar nada.

## La decisión que sostiene todo: puertos

El dominio **no importa nada** de Traccar, VROOM, GraphHopper, MapLibre ni
Telegram. Cada proveedor entra por una interfaz de `lib/logistica/tipos.ts`:

- `ProveedorTracking` → hoy simulado, mañana Traccar
- `ProveedorOptimizacion` → hoy heurística local, mañana VROOM
- `ProveedorNotificacion` → hoy registro en memoria, mañana Telegram

Los simuladores existen para que el flujo completo se pruebe **sin claves, sin
red y sin dispositivos**, que es exactamente lo que el encargo exige en esta
fase.

## Dos máquinas de estados, no una

`EstadoViaje` (13 estados) es **nueva** y envuelve al `EstadoDespacho`
existente sin sustituirlo. El estado del despacho sigue mandando sobre el
inventario; el del viaje describe dónde está el camión.

Fundirlas rompería la regla más cara del sistema: **un despacho no puede
consumir inventario dos veces**. Por eso `llegada_detectada` (geocerca) **no**
transiciona a `completada` — solo a `llegada_confirmada`. La geocerca sugiere;
la entrega la confirma una persona.

Los estados terminales no tienen salida. Reabrir un viaje cerrado exigiría un
movimiento compensatorio, igual que en el kardex.

## Reglas implementadas y probadas

- Capacidad en **peso Y volumen**. El aislante llena el camión sin pesar; el
  cemento pesa sin llenarlo. Validar una sola deja pasar la mitad de los errores.
- Distancia por **semiverseno**, no euclídea. Un grado de longitud mide 111 km
  en el ecuador y 78 km en Anzoátegui.
- Desvío contra el **segmento**, no el vértice más cercano. Un camión a mitad
  de un tramo de 8 km está sobre la ruta; medir contra vértices marcaría un
  desvío enorme en cada tramo largo.
- ETA con **velocidad media** cuando la instantánea es 0. Un camión en un
  semáforo daría ETA infinito.
- Optimización que **devuelve lo que no cupo**. Descartarlo en silencio haría
  creer que todo el pedido salió en el camión.
- Idempotencia por clave derivada del contenido, truncada al minuto: dos
  webhooks del mismo hecho difieren en milisegundos.

46 pruebas en `lib/logistica/nucleo.test.ts`. Total del proyecto: 348.

## Lo que queda fuera de este incremento

Supabase (migraciones, RLS, Realtime, PostGIS, Storage, Edge Functions),
Traccar, VROOM, GraphHopper, la PWA del conductor y el bot real. Todo eso
necesita infraestructura y claves que no existen; el encargo lo pone como
condición explícita: *"no conectes todavía dispositivos GPS productivos ni
envíes mensajes reales"*.
