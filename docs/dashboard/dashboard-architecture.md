# Panel Premium — arquitectura

## Qué es y qué no es

Apolo base entrega el **panel operativo**: siete indicadores y la actividad del
día. Premium añade la **capa de dirección** — ventanas comparables, umbrales,
centro de alertas, obras críticas — y se enseña como lo que es: una opción sobre
esta misma versión, no un producto distinto.

No se apilan los dos paneles. Son dos lecturas del mismo negocio para dos
personas distintas, y mostrarlas juntas obligaría a bajar media pantalla para
llegar a la que interesa. El conmutador vive en la barra superior, junto a los
datos de demostración.

## Auditoría previa (estado encontrado)

| | |
|---|---|
| Stack | Next.js 16.2.12 App Router · React 19.2.4 · TypeScript strict · Tailwind v4 |
| Gráficas | **Recharts ya instalado** y documentado en `PLAN.md` como la decisión del proyecto |
| Rutas | 9 módulos bajo `app/`, todos client components |
| Dominio | `lib/dominio/` — funciones puras, `Resultado<T>`, sin React ni storage |
| Persistencia | `lib/db/almacen.ts` — memoria + localStorage tras `useSyncExternalStore` |
| Pruebas | Vitest, 231 pruebas antes de este trabajo |
| `npm test` · `tsc --noEmit` · `npm run build` | los tres en verde antes de tocar nada |

**No se evaluó ninguna librería de gráficas nueva.** El encargo pedía elegir
entre Recharts, ECharts, Nivo y Visx, pero el proyecto ya tiene Recharts
instalado y esa decisión ya está justificada en `PLAN.md`. Añadir una segunda
librería para el mismo trabajo duplicaría el bundle sin ganar nada.

## Estructura

```
lib/dashboard/
  tipos.ts        Tipos + el puerto FuenteDashboard
  catalogo.ts     Catálogo de KPIs: fórmula, unidad, umbrales, dirección
  kpis.ts         Fórmulas puras + ventanas de tiempo
  kpis.test.ts    37 pruebas sobre las fórmulas
  fuente-local.ts Implementación del puerto sobre el almacén en memoria
  premium.ts      Conmutador (useSyncExternalStore sobre localStorage)

components/premium/
  panel.tsx       Composición + estados cargando/vacío/error
  encabezado.tsx  Filtros que mandan sobre TODO el panel
  tarjeta-kpi.tsx Tarjeta con umbral, tendencia y tooltip de fórmula
  graficas.tsx    Barras (Recharts) con colores de los tokens del tema
  tablas.tsx      Alertas, obras críticas, stock crítico
```

## La decisión que sostiene el resto: el puerto

La pantalla depende de la interfaz `FuenteDashboard`, no del almacén local:

```ts
export interface FuenteDashboard {
  obtener(filtros: Filtros, ahoraMs: number): Promise<DatosPanel>;
}
```

Cuando entre Supabase se escribe **un segundo archivo** que devuelve el mismo
`DatosPanel` desde vistas SQL y funciones RPC. No se toca ni un componente.

`fuente-local.ts` recorre el kardex completo en memoria, y en el demo eso es
correcto: son cientos de asientos. **Con Supabase NO debe hacerse así** — el
recorrido equivalente vive en una vista materializada. La frontera está marcada
a propósito para que el cambio sea sustituir ese archivo, no reescribir la
pantalla.

## Decisiones de interfaz

**Todas las gráficas son de barras.** El encargo pedía embudos y donuts, pero lo
que se compara aquí son magnitudes de la misma naturaleza, y el ojo compara
longitudes bien y ángulos mal. Un donut de "solicitudes por estado" obliga a
leer la leyenda para saber cuál es mayor.

**Los filtros mandan sobre todo el panel**, no sobre un widget. Un tablero donde
cada gráfica se filtra por su cuenta hace que dos números de la misma pantalla
hablen de periodos distintos, y a partir de ahí nadie se fía de ninguno.

**El semáforo lleva color Y texto.** Un indicador solo cromático deja fuera a
quien no distingue rojo de verde, que en una constructora es aproximadamente uno
de cada doce hombres en plantilla.

**El esqueleto de carga reproduce la rejilla real**, no un spinner centrado: el
contenido aparece donde el ojo ya está mirando en vez de saltar al terminar.

**Un fallo de cálculo no tumba la página.** El resultado se modela como unión
`cargando | error | ok` y se devuelve desde el `useMemo`; nunca se escribe estado
durante el render.

## Reglas del dominio que este trabajo NO toca

El panel **solo lee**. No hay una sola escritura en `lib/dominio/` ni en
`lib/db/operaciones.ts`. En consecuencia siguen intactas:

- El kardex es inmutable; los ajustes son movimientos compensatorios.
- No hay stock negativo.
- Las solicitudes pasan por aprobación; no hay salto de `solicitada` a
  `en_preparacion`.
- Consumibles, retornables y certificados conservan sus reglas distintas.
- Las funciones puras de `lib/dominio/` no se acoplan a React ni a Supabase.

Las 231 pruebas existentes siguen pasando sin modificación.

## Lo que queda fuera de este incremento

El encargo describe un producto de varios meses. Este incremento cubre lo que él
mismo marca como **"primer incremento obligatorio"**. Queda fuera, y es trabajo
real pendiente:

- Migraciones SQL, RLS, vistas materializadas y Edge Functions — **no hay
  proyecto Supabase todavía**, y el propio encargo dice "no conectes datos
  productivos hasta que el modelo haya sido revisado". Diseñarlas contra un
  esquema no acordado sería trabajo desechable.
- Roles y permisos por usuario. Hoy Apolo no tiene autenticación: los permisos
  son estructura de demo, no seguridad, y así está avisado en pantalla.
- Personalización persistida (reordenar tarjetas, guardar vistas).
- Secciones dedicadas de compras/proveedores y despachos/entregas con su propio
  detalle; hoy están representadas por sus KPIs y alertas.
- Virtualización de tablas: con los volúmenes del demo no aporta nada.
