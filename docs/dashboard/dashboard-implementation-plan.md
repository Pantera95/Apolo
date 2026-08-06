# Plan de implementación — Panel Premium

## Incremento 1 — HECHO

Lo que el encargo marca como "primer incremento obligatorio".

- [x] Encabezado con filtros (periodo, obra, almacén) que mandan sobre todo el panel
- [x] Tarjetas ejecutivas con umbral, dirección, variación y tooltip de fórmula
- [x] Gráfica de solicitudes por estado
- [x] Gráfica de despachos por estado
- [x] Gráfica de avance **de material** por obra
- [x] Tabla de stock crítico con cobertura estimada
- [x] Centro de alertas con severidad, acción y enlace al módulo
- [x] Tabla de obras que requieren atención
- [x] Estados `cargando`, `vacío` y `error`
- [x] Datos desacoplados tras el puerto `FuenteDashboard`
- [x] Exportación a CSV con separador `;` y BOM
- [x] 37 pruebas sobre las fórmulas
- [x] Responsive verificado; ninguna cifra se parte de 320px a 1440px
- [x] Conmutador "Plan Premium" junto a los datos de demostración

Verificación: `npm test` 268/268 · `npx tsc --noEmit` limpio · `npm run build` OK.

## Incremento 2 — modelo de datos

Los cinco cambios que desbloquean las métricas hoy imposibles. Van primero
porque son de modelo, y cada semana que pasa sin ellos es una semana de
histórico que no se podrá reconstruir.

1. Tabla de transiciones de estado de solicitud → `tiempo_aprobacion`, ciclo por etapa
2. `prometida_para` en despacho → mitad temporal de `otif`
3. `recibida_en` en orden de compra → `cumplimiento_proveedor`, lead time real
4. Módulo de conteo cíclico → `exactitud_inventario`
5. Cronograma de obra → `cumplimiento_plan_obra`, variación contra plan

## Incremento 3 — Supabase

Solo cuando el modelo esté acordado con el cliente.

1. Migraciones de las tablas del dominio existente
2. Vistas SQL e índices del documento de fuentes de datos
3. `lib/dashboard/fuente-supabase.ts` cumpliendo el mismo puerto
4. RLS según el documento de permisos, con vistas `security invoker`
5. Vistas materializadas y jobs de refresco
6. Snapshots diarios para tendencias reales

No conectar datos productivos hasta que las consultas se revisen.

## Incremento 4 — roles y personalización

Requiere autenticación, que hoy no existe.

1. Supabase Auth y tabla de roles por usuario
2. Recorte del panel por rol
3. Preferencias persistidas: filtros por defecto, obra y almacén principal
4. Reordenar y ocultar módulos

## Riesgos y decisiones pendientes

**El demo calcula en el cliente.** Correcto para cientos de asientos, inviable
para millones. La frontera está marcada en `fuente-local.ts`; el riesgo es que
alguien copie ese patrón al adaptador de Supabase en vez de sustituirlo por
agregación del servidor.

**Los umbrales están puestos por criterio de ingeniería, no acordados con el
cliente.** Que 3 solicitudes sin aprobar sea "advertencia" y 8 sea "crítico" es
una suposición razonable, no un dato. Hay que validarlos antes de que alguien
tome decisiones con el semáforo.

**El avance de material no es avance de obra.** Está etiquetado como tal en
pantalla y en el código, pero es la confusión más probable en una demostración:
si el cliente lo lee como avance de cronograma, hay que corregirlo en voz alta.

**Sin autenticación no hay permisos.** El documento de permisos diseña el
reparto, pero mientras no exista RLS cualquier filtro por rol es decorativo.
