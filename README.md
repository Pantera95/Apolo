# Apolo

Control de inventario, almacén, obras, despacho, estimación y procura para una
constructora del sector Oil & Gas.

> **Estado: demostración.** Los datos viven en el navegador de quien la mira y
> los permisos son estructura, no seguridad. No hay backend todavía. Todas las
> cifras que aparecen en pantalla y en los PDF son ficticias.

## Qué resuelve

Una constructora grande no pierde dinero por vender poco: lo pierde porque no
sabe **dónde están sus propias cosas**. El material sale a una obra y nadie sabe
cuánto queda; una herramienta se presta y nadie sabe quién la tiene.

Apolo gira alrededor de la **OBRA**, no del pedido. Todo material se asigna a una
obra, toda herramienta se presta a una obra y debe volver, y todo consumo se
imputa a una obra.

**Dónde encaja.** El cliente ya tiene un ERP para lo contable y lo fiscal, pero
el movimiento físico de material y herramienta vive fuera de él. Apolo cubre ese
hueco **sin tocar el ERP**: consume sus exports en un solo sentido y nunca
escribe en el sistema de origen. Si Apolo se apaga mañana, el ERP queda
exactamente como estaba.

> **Decisión abierta: interno o SaaS.** Este README y `CLAUDE.md` describen un
> sistema para *una* constructora; el registro de producto
> ([`PRODUCT.md`](PRODUCT.md)) recoge la respuesta del cliente de que será un
> **SaaS para varias**. Multi-inquilino, alta de empresas y un plan Premium
> comercial **no están construidos**. La contradicción está anotada a propósito
> y sin resolver: quien la decida tiene que actualizar los dos archivos.

## Módulos

**Operación** — Panel, Obras, Solicitudes, Despacho y Centro de Control
(seguimiento de flota sobre callejero real, con enlaces de navegación a Google
Maps e informes por Telegram).

**Almacén** — Inventario, Herramientas, Estimaciones, Compras y Procura.

**Datos** — Importación y Reportes.

**Presentación** — `/presentacion`, la landing pública. No lleva el chasis de la
aplicación (ver *Estructura*).

### Estimaciones

Del modelo de diseño a la oferta. Es el módulo más grande y tiene su propia
frontera declarada:

```
[ Archivo BIM/CAD ] → [ Ingesta ] → [ Motor de reglas y rendimientos ]
                                              │
                 ┌────────────────────────────┼────────────────────────────┐
              [ MTO/BOM ]              [ Matriz RFQ ]              [ APU ]
                 └────────────────────────────┼────────────────────────────┘
                                              │
                          [ KPIs contra obras históricas ]
                                              │
                    [ Informe PDF + APU PDF → Telegram ]
```

**Qué se lee de verdad y qué no.** Un `.rvt` no se puede abrir en un navegador:
es un contenedor OLE propietario que exige Autodesk Platform Services, de pago.
Los `.mac` de AVEVA son macros de su motor. Lo procesable son los **exports**:
CSV y XML se leen fila por fila; `.rvt`, `.ifc` y `.mac` producen un cómputo de
demostración. La pantalla lo dice **antes** de subir nada, con una etiqueta por
formato, y el documento estampa el aviso en todas sus páginas.

**El origen lo decide la extensión, no el desplegable.** Si alguien declara
"CSV" y sube un `.rvt`, se informa Revit y se avisa de la discrepancia. Lo
contrario haría que un PDF dijera "Schedule en CSV" sobre un cómputo simulado.

**Dos entregables en PDF**, generados en el cliente y enviables por Telegram: el
informe consolidado (seis capítulos) y el APU, en el formato de planilla que
audita la operadora — una hoja por renglón, con firmas.

### Procura

El ciclo de compra por etapas del EDT: requisición, licitación, evaluación,
adjudicación y cierre. Dos reglas lo sostienen:

**Las etapas son puertas, no etiquetas.** Un expediente no sale de licitación sin
tres ofertas y las aclaratorias cerradas, ni de evaluación sin dictamen técnico
en todas. Un tablero donde todo se arrastra a cualquier sitio produce compras que
ningún auditor puede justificar.

**Se compara por costo desembarcado, no por precio de oferta.** Un FOB excluye
flete, seguro y aranceles; un DDP los incluye. Poner las dos cifras en la misma
columna y quedarse con la menor adjudica al proveedor equivocado de forma
sistemática, y el sobrecosto aparece cuando la mercancía ya está en puerto. En
los datos de muestra, una oferta de 392.000 FOB desembarca en 475.800 y pierde
contra una de 448.000 DDP.

## Decisiones que definen el producto

- **El kardex es inmutable.** Un error se corrige con un asiento contrario, nunca
  editando ni borrando. Los saldos se materializan aparte y una función de
  reconciliación verifica que no se hayan separado.
- **La aprobación es bloqueante.** No existe transición de `solicitada` a
  `en_preparacion`: ese hueco en la máquina de estados *es* la regla de negocio.
- **Tres clases de artículo** con comportamientos distintos: consumible (no
  vuelve), retornable (genera deuda contra la obra y una persona) y certificado
  (trazabilidad de colada, requisito de la industria petrolera).
- **El FAS solo carga la mano de obra.** Aplicarlo también al material inflaría
  la oferta un 30-40 % y se perdería la licitación sin entender por qué.
- **Los recargos se suman sobre el costo directo**, no se encadenan, porque así
  lo hace la planilla de la operadora. El modo cascada existe como parámetro
  visible: rinde un 2,8 % más y esa elección debe ser consciente.
- **El plazo es la ruta más larga, no la suma.** Las disciplinas avanzan en
  paralelo; sumar sus plazos daría una oferta tres veces más larga.
- **Todo ajuste exige motivo.** Sin él, un descuadre es inexplicable tres meses
  después.
- **Stock negativo prohibido.** El sistema bloquea, no advierte.
- **Apolo nunca genera facturas** ni documentos fiscales, ni escribe en el ERP
  del cliente.

## Sistema de diseño

La identidad se copió de una referencia externa que el cliente fijó como
vinculante, **midiendo sus valores** en vez de interpretarlos: fondo `#00031c`,
paneles de vidrio (blanco al 4 % sobre el suelo, declarados ya compuestos para
poder medirlos), titulares en Poppins 500 con interlínea 1.0, y gráficos sin
rejilla ni ejes dibujados — solo las curvas de datos.

- `app/marca.css` — la identidad, aislada. Cambiarla es tocar solo este archivo.
- `app/globals.css` — tokens semánticos por tema.
- `app/presentacion/landing.css` — la landing declara los suyos aparte, a
  propósito: compartir tokens devolvía la maqueta anterior con otros colores.

**El chasis no cambia de color, solo el lienzo de trabajo.** La barra de
navegación es oscura en los dos temas. Es una regla, no una casualidad: romperla
dejó el texto de la barra a 2,19:1 en tema claro.

## Accesibilidad y color

Ningún tono mantiene 4,5:1 sobre fondo claro **y** oscuro, así que los tokens
**cambian de valor** entre temas. El contraste **se mide, no se estima**, y hacen
falta **las dos** comprobaciones porque miden cosas distintas:

```bash
node scripts/contraste.mjs          # 210 pares de tokens, ambos temas
```

Compara pares de tokens leyendo el CSS. Es barato y no necesita navegador, pero
**no puede ver un token correcto aplicado a la superficie equivocada**.

```js
// scripts/auditor-contraste-dom.js — pegar en la consola del navegador
auditarContraste({ ambosTemas: true });
```

Recorre cada nodo de texto pintado, compone el fondo efectivo capa por capa y
mide lo que el ojo ve. Existe porque el primero daba 210/210 mientras la barra de
navegación era ilegible: el fallo no estaba en ningún par de tokens, estaba en
cuál pintaba qué. Hay que repetirlo por ruta.

Tres cosas que el auditor hace y conviene no deshacer:

- **Apaga las transiciones antes de medir.** Con la pestaña en segundo plano
  `requestAnimationFrame` se congela, y una tarjeta con `transition-colors` se
  queda en el color del tema *anterior*. Once de catorce "fallos" fueron eso.
- **Convierte `oklab()` a mano.** Tailwind v4 lo emite para las opacidades y
  `canvas.fillStyle` no lo entiende: al asignarlo conserva el valor anterior en
  silencio, y un rótulo de 3,83:1 salía como 1,02:1.
- **Aparta lo que hay sobre un degradado** como *no verificable* en vez de
  contarlo como fallo. Un degradado tiene un color por píxel; no hay un único
  ratio que calcular.

## Estructura

```
app/
  (app)/             la aplicación. El grupo NO añade segmento: /inventario
                     sigue siendo /inventario. Existe para que la landing no
                     herede el chasis lateral.
  presentacion/      la landing pública, con su propio CSS
  marca.css          identidad visual aislada
  globals.css        tokens semánticos claro/oscuro
  api/telegram/      envío, webhook del bot y registro (solo servidor)
components/ui/       primitivos propios, sin librerías de terceros
components/shell/    navegación y chasis
lib/dominio/         motor de inventario: funciones puras con tests
lib/licitaciones/    motor de estimación, APU, PDFs y plantillas de aviso
lib/logistica/       rutas, ETA, geocercas y anti-spam de notificaciones
lib/dashboard/       indicadores, series y estado del plan Premium
lib/datos/           semilla de demostración e indicadores derivados
lib/bot/             comandos del bot de Telegram, solo lectura
lib/db/              capa de persistencia (hoy localStorage, mañana Supabase)
docs/decisions/      reglas de negocio confirmadas
scripts/             contraste WCAG, auditor de DOM y PDFs fuera del navegador
```

Las reglas de negocio son **funciones puras** que no tocan almacenamiento ni
React. Cuando entre el backend cambia quién las llama, no lo que hacen.

Las integraciones entran por **puertos**: ingesta de modelos, tracking,
optimización de rutas y notificación. Hoy los cumplen adaptadores locales;
mañana, un servicio real sin tocar el motor ni la pantalla.

## El bot de Telegram

Catorce comandos, **todos de solo lectura**. Ninguno aprueba, cancela ni
despacha: un mensaje de Telegram se reenvía y se falsifica sin esfuerzo, y no hay
forma de saber quién pulsó de verdad.

El webhook atiende `message` **y** `channel_post`. Telegram entrega los mensajes
de un grupo como lo primero y los de un canal como lo segundo; mirar solo
`message` dejaba al bot sordo justo donde vive, sin ningún error que lo delatara.

### El token

Vive en `TELEGRAM_BOT_TOKEN`, variable de entorno **del servidor**. Nunca se
declara `NEXT_PUBLIC_`: quien tiene el token de un bot puede leer y escribir en
todos sus chats, y una variable pública en Next queda incrustada en el JavaScript
que descarga cualquiera. Sin token configurado la aplicación compone el mensaje
igual y responde `enviado: false` con el motivo — es el estado normal de un demo,
no una avería.

## Desarrollo

```bash
npm install
npm run dev          # http://localhost:3100
npm test             # 635 pruebas
npx tsc --noEmit     # typecheck estricto
npm run build
```

```bash
node scripts/pdf-muestra.mjs ./salida
```

Genera los entregables de los cuatro modelos de muestra fuera del navegador, para
poder **mirar** las hojas — que es la única forma de ver que una columna se sale
o que un texto pisa otro.

## Stack

Next.js 16 · React 19 · TypeScript strict · Tailwind CSS v4 · Vitest · Recharts ·
MapLibre GL · jsPDF · Vercel

Sin librerías de componentes: los primitivos son propios para tener control total
del sistema de diseño.

## Documentación

- [`PRODUCT.md`](PRODUCT.md) — registro de producto: usuarios, posición,
  restricciones irrevocables y decisiones abiertas
- [`PLAN.md`](PLAN.md) — planning de fases
- [`docs/decisions/`](docs/decisions/) — reglas de negocio confirmadas
