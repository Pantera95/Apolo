# Apolo

Sistema de control de inventario, almacén, obras y despacho para operaciones de
construcción industrial.

> **Estado: demostración.** Los datos viven en el navegador de quien la mira y
> los permisos son estructura, no seguridad. No hay backend todavía.

## Qué resuelve

Una constructora grande no pierde dinero por vender poco: lo pierde porque no
sabe **dónde están sus propias cosas**. El material sale a una obra y nadie
sabe cuánto queda; una herramienta se presta y nadie sabe quién la tiene.

Apolo gira alrededor de la **OBRA**, no del pedido. Todo material se asigna a
una obra, toda herramienta se presta a una obra y debe volver, y todo consumo
se imputa a una obra.

## Decisiones que definen el producto

- **El kardex es inmutable.** Un error se corrige con un asiento contrario,
  nunca editando ni borrando. Los saldos se materializan aparte y una función
  de reconciliación verifica que no se hayan separado.
- **La aprobación es bloqueante.** No existe transición de `solicitada` a
  `en_preparacion`: ese hueco en la máquina de estados *es* la regla de negocio.
- **Tres clases de artículo** con comportamientos distintos: consumible (no
  vuelve), retornable (genera deuda contra la obra y una persona) y certificado
  (trazabilidad de colada, requisito de la industria petrolera).
- **Todo ajuste exige motivo.** Sin él, un descuadre es inexplicable tres meses
  después.
- **Stock negativo prohibido.** El sistema bloquea, no advierte.
- **Apolo nunca genera facturas** ni escribe en el ERP del cliente. La
  integración es de un solo sentido: se consumen sus exports.

## Estructura

```
app/                 rutas y sistema de diseño
  marca.css          identidad visual aislada — cambiarla es tocar solo esto
  globals.css        tokens semánticos claro/oscuro
components/ui/       primitivos propios, sin librerías de terceros
components/shell/    navegación y chasis
lib/dominio/         motor de inventario: funciones puras con tests
lib/datos/           semilla de demostración e indicadores derivados
lib/db/              capa de persistencia (hoy localStorage, mañana Supabase)
docs/decisions/      reglas de negocio confirmadas
```

Las reglas de inventario son **funciones puras** que no tocan almacenamiento ni
React. Cuando entre el backend cambia quién las llama, no lo que hacen.

## Desarrollo

```bash
npm install
npm run dev          # http://localhost:3100
npm test             # suite del dominio
npx tsc --noEmit     # typecheck estricto
npm run build
```

## Stack

Next.js · React · TypeScript strict · Tailwind CSS v4 · Vitest · Vercel

Sin librerías de componentes: los primitivos son propios para tener control
total del sistema de diseño.

## Documentación

- [`PLAN.md`](PLAN.md) — planning de fases
- [`docs/decisions/`](docs/decisions/) — reglas de negocio confirmadas
