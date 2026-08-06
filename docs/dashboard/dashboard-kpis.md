# Catálogo de KPIs — Panel Premium

Fuente de verdad en código: [`lib/dashboard/catalogo.ts`](../../lib/dashboard/catalogo.ts).
Fórmulas puras y probadas: [`lib/dashboard/kpis.ts`](../../lib/dashboard/kpis.ts).

Este documento describe; el código decide. Si los dos discrepan, manda el código
y este archivo está desactualizado.

## La regla que gobierna todo el panel

> Cuando no hay datos suficientes para una fórmula, el valor es `null` y la
> pantalla dice **"Datos insuficientes"**. No se rellena con cero, ni con un
> promedio, ni con un valor de ejemplo.

Un cero inventado en un panel de dirección no es un detalle cosmético: es una
decisión equivocada esperando a ocurrir. `0 %` de entregas completas significa
que todas llegaron mal; "sin entregas cerradas" significa otra cosa
completamente distinta. Las fórmulas devuelven `null` en vez de `NaN` o
`Infinity` porque los dos se pintan como basura en una tarjeta.

## Métricas que SÍ se calculan hoy

| ID | Nombre | Fórmula | Unidad | Umbral adv. | Umbral crít. |
|---|---|---|---|---|---|
| `obras_activas` | Obras activas | `count(obras donde estado = activa)` | conteo | — | — |
| `solicitudes_por_aprobar` | Solicitudes por aprobar | `count(estado = solicitada)` | conteo | 3 | 8 |
| `aprobadas_sin_preparar` | Aprobadas sin preparar | `count(estado = aprobada)` | conteo | 3 | 6 |
| `despachos_activos` | Despachos activos | `count(en_preparacion, listo, en_ruta)` | conteo | — | — |
| `en_ruta` | En ruta | `count(estado = en_ruta)` | conteo | — | — |
| `entregas_completas` | Entregas completas | `sin_diferencias / cerradas * 100` | % | 95 | 85 |
| `compras_abiertas` | Compras abiertas | `count(enviada, parcial)` | conteo | — | — |
| `compras_retrasadas` | Compras retrasadas | `count(abiertas donde esperada < hoy)` | conteo | 1 | 4 |
| `valor_por_recibir` | Valor por recibir | `Σ(pendiente × costo)` | USD | — | — |
| `valor_inventario` | Valor de inventario | `Σ(físico × costo_promedio)` | USD | — | — |
| `valor_en_obra` | Material en obra | `Σ(en_obra × costo_promedio)` | USD | — | — |
| `stock_critico` | Artículos en stock crítico | `count(cobertura < 7 días)` | conteo | 1 | 5 |
| `rotacion` | Rotación | `consumo_periodo / inventario_promedio` | veces | — | — |
| `herramienta_pendiente` | Herramienta sin retornar | `Σ(en_obra) sobre retornables` | conteo | — | — |

### Notas de cálculo que no son evidentes

**Consumo** se mide sobre asientos de tipo `entrega` y ajustes con motivo
`consumo_interno`. **No** cuenta despachos: un despacho que todavía viaja no se
ha consumido, y contarlo inflaría la rotación.

**Cobertura** (`disponible / consumo_diario`) devuelve `null` cuando el consumo
es cero. Sin consumo NO es cobertura infinita: un artículo puede llevar un año
parado y no por eso está a salvo — es que no hay con qué estimar.

**La variación contra el periodo anterior** usa una ventana de la misma
duración exacta, terminada donde empieza la actual. Comparar 30 días contra un
mes natural de 28 haría que febrero pareciera una caída del negocio.

**De 0 a 5 no es "infinito por ciento"**: es que antes no había nada, y la
variación devuelve `null`. De 5 a 0 sí es −100 %.

**La dirección importa para el semáforo.** En OTIF quedarse corto es lo malo;
en compras retrasadas lo malo es pasarse. Un solo comparador para los dos casos
daría el semáforo invertido en la mitad de las tarjetas.

## Métricas que NO se pueden calcular y por qué

Están en el catálogo, se muestran en pantalla y declaran su carencia. Esconderlas
haría creer que el panel las cubre; borrarlas invitaría a que alguien las
"implemente" rellenando con un supuesto.

| ID | Qué falta |
|---|---|
| `otif` | La mitad "completa" sí sale, pero la de "a tiempo" no: un despacho lleva salida y llegada reales, **no fecha comprometida**. Sin fecha prometida no hay puntualidad que medir. |
| `tiempo_aprobacion` | La solicitud guarda **quién** aprobó, no **cuándo**. Hace falta un sello de tiempo por transición de estado. |
| `cumplimiento_proveedor` | La orden registra cantidades recibidas por línea, pero no la fecha de recepción completa. Sin fecha de cierre no hay nada que comparar contra `fechaEsperada`. |
| `exactitud_inventario` | No existe módulo de conteo cíclico. Los ajustes registran una corrección, pero no cuántas posiciones se auditaron **sin** encontrar diferencia, que es el denominador. |
| `cumplimiento_plan_obra` | Apolo no guarda cronograma: la obra solo tiene código, nombre, ubicación y estado. Sin fechas de plan ni partidas no hay avance planificado. |

### Lo que el panel muestra en su lugar

En vez de un "avance de obra" inventado, el panel muestra **avance de material**:
qué fracción de lo solicitado por cada obra ya fue despachada. Es dato real, sale
del kardex, y **no se llama avance de obra** en ninguna parte de la interfaz.

## Qué haría falta para cerrar los huecos

1. **Tabla de transiciones de estado** (`solicitud_id`, `desde`, `hasta`,
   `usuario_id`, `en`). Desbloquea `tiempo_aprobacion` y el tiempo de ciclo
   completo por etapa.
2. **Fecha comprometida en el despacho** (`prometida_para`). Desbloquea la mitad
   temporal de `otif` y todo el bloque de puntualidad.
3. **Cierre de recepción en la orden de compra** (`recibida_en`). Desbloquea
   `cumplimiento_proveedor` y el lead time real por proveedor.
4. **Módulo de conteo cíclico** (`conteo_id`, `posicion`, `esperado`, `contado`).
   Desbloquea `exactitud_inventario`.
5. **Cronograma de obra** (partidas, fechas plan, pesos). Desbloquea
   `cumplimiento_plan_obra` y la variación de consumo contra plan.

Las cinco son cambios de modelo, no de panel. Ninguna se puede aproximar desde
los datos actuales sin inventar.
