# ADR — Proveedor de tracking

**Estado:** aceptado

## Decisión

**Traccar como servicio independiente.** Simulador que cumple el mismo puerto
para el incremento 1.

## Reparto de la telemetría (Opción A del encargo)

- **Traccar** conserva la telemetría cruda: cada punto GPS, historial completo.
- **Supabase** conserva solo lo operacional: última posición, eventos
  relevantes, entradas y salidas de geocerca, resúmenes de viaje, desviaciones.

Guardar cada punto GPS en Supabase Realtime es inviable: un camión emite cada
10 s, y diez camiones en jornada de 10 h son 36.000 filas diarias que además
nadie consulta punto por punto. Traccar ya está diseñado para eso.

## Origen de la posición

| Opción | Fiabilidad | Coste | Depende del chofer |
|---|---|---|---|
| **Dispositivo GPS físico** | Alta | Hardware + instalación | No |
| Traccar Client (móvil) | Media | 0 | **Sí** |
| App del conductor | Media | Desarrollo | **Sí** |

**Recomendación:** dispositivo físico en la flota propia, Traccar Client en
vehículos contratados. Un chofer que cierra la app deja el viaje sin
seguimiento, y eso convierte la supervisión en opcional.

## Idempotencia

Traccar reenvía webhooks sin confirmación y las posiciones llegan
desordenadas. La clave se deriva del contenido —vehículo, tipo, minuto— y no de
un autoincremento, para que el reenvío del mismo hecho produzca la misma clave
y se descarte.
