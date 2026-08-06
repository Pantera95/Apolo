# Fuentes de datos y plan de migración a Supabase

## Hoy: `fuente-local.ts`

Todo el panel sale del estado en memoria (`EstadoApolo`), que a su vez vive en
localStorage. Un solo cálculo síncrono produce el `DatosPanel` completo: no hay
una consulta por widget, así que **no existe el problema N+1** ni consultas
duplicadas entre tarjetas.

| Bloque del panel | De dónde sale hoy |
|---|---|
| Valor de inventario / material en obra | `inventario.saldos` × `articulo.costoPromedioUsd` |
| Consumo, rotación, cobertura | `inventario.asientos` filtrados por tipo y ventana |
| Solicitudes por estado, bloqueadas | `solicitudes[]` |
| Despachos por estado, entregas completas | `despachos[]` |
| Compras abiertas / retrasadas / por recibir | `ordenes[]` |
| Herramienta sin retornar | `saldos.enObra` sobre artículos `retornable` |
| Alerta de descuadre | `reconciliar(estado.inventario)` — kardex vs. saldos |

## Mañana: adaptador Supabase

Se escribe **un archivo nuevo**, `lib/dashboard/fuente-supabase.ts`, que cumple
el mismo puerto `FuenteDashboard`. Ningún componente cambia.

### Qué NO debe hacer

Recorrer el kardex en el cliente. En el demo son cientos de asientos; en
producción son millones. El recorrido de `consumoEnVentana` es exactamente el
que debe convertirse en agregación del servidor.

### Reparto propuesto

| Cálculo | Mecanismo | Frecuencia |
|---|---|---|
| Saldos valorizados por almacén/clase | Vista SQL `v_inventario_valorizado` | Tiempo real |
| Consumo por artículo y ventana | Función RPC `fn_consumo(desde, hasta, obra_id, almacen_id)` | Bajo demanda |
| Cobertura y stock crítico | Vista materializada `mv_cobertura`, refresco por evento de kardex | Evento + horaria |
| Solicitudes/despachos por estado | Vista SQL simple, índice por `(estado, obra_id, fecha)` | Tiempo real |
| Obras críticas | Vista materializada `mv_obras_resumen` | Horaria |
| Alertas | **Derivadas, no almacenadas** (ver abajo) | Tiempo real |
| Snapshots para tendencias | Tabla `dashboard_metric_snapshots`, job diario | Diaria |

### Por qué las alertas se derivan y no se guardan

Una alerta almacenada en una tabla se queda encendida cuando la causa ya se
resolvió, y a partir de ahí nadie vuelve a mirarlas. Las de este panel se
recalculan de la condición: si la condición desaparece, la alerta desaparece
sola. Solo tendría sentido persistir el **acuse** (quién la vio y cuándo), no la
alerta.

### Tablas nuevas mínimas

Antes de crear nada, reutilizar el dominio existente. Solo hacen falta:

- `dashboard_metric_snapshots` — serie histórica para tendencias reales.
  Hoy la comparación es contra la ventana anterior calculada al vuelo, lo que
  funciona pero recorre dos veces el mismo rango.
- `dashboard_preferences` — filtros por defecto, obra y almacén principal.
- Las cinco del documento de KPIs que desbloquean las métricas hoy imposibles
  (transiciones de estado, fecha comprometida, cierre de recepción, conteo
  cíclico, cronograma).

### Índices que el panel necesita

```sql
create index on asientos (fecha desc, tipo);
create index on asientos (articulo_id, fecha desc);
create index on asientos (obra_id) where obra_id is not null;
create index on solicitudes (estado, obra_id);
create index on despachos (estado, obra_id);
create index on ordenes_compra (estado, fecha_esperada);
```

Los tres primeros son los que sostienen la ventana temporal, que es el filtro
que toca todas las consultas del panel.

## Estrategia de refresco

- **Por evento**: cualquier asiento de kardex invalida `mv_cobertura`.
- **Horaria**: `mv_obras_resumen`, que tolera estar desactualizado 60 minutos.
- **Diaria**: snapshot de métricas a medianoche, para la serie histórica.
- **Bajo demanda**: el botón de actualizar del encabezado.

No conectar datos productivos hasta que el modelo y las consultas se revisen.
