# Apolo — Planning de ejecución

Objetivo inmediato: **un demo presentable a una constructora grande de Oil & Gas.**
No es un producto funcional en producción. Es la demostración de lo que Apolo puede ser, sobre la
que después se harán modificaciones con el cliente ya sentado en la mesa.

Reglas de negocio: [`docs/decisions/00-reglas-confirmadas.md`](docs/decisions/00-reglas-confirmadas.md)

---

## 1. Stack

| Capa | Decisión |
|---|---|
| Framework | Next.js (App Router) + React + TypeScript strict |
| Estilos | Tailwind CSS v4 con tokens semánticos en variables CSS |
| Componentes | Primitivos propios — sin librería de terceros |
| Gráficas | Recharts para las interactivas, SVG propio para las simples |
| Datos (fase demo) | En memoria + localStorage, detrás de una capa `lib/db` |
| Datos (fase 2) | Supabase (Postgres + Auth + RLS) — **fuera del demo** |
| Deploy | Vercel → `apolo.vercel.app` |
| Repo | `Pantera95/Apolo`, público mientras sea demo |
| Tests | Vitest, obligatorios sobre las reglas de inventario |
| i18n | es / en conmutable |

### Por qué "sin librería de componentes"

No es dogma heredado: es que los dashboards BI dinámicos son el gancho comercial de esta
presentación, y una librería genérica hace que el producto se vea como los otros veinte que el
cliente ya vio. Control total del sistema de diseño = el demo se ve como un producto, no como una
plantilla.

### Cómo el demo no miente

El demo no tiene servidor, y eso está bien para una presentación. Lo que no puede pasar es que la
lógica que se enseña sea falsa. Por eso:

1. **Las reglas de inventario van en funciones puras** (`reservar`, `despachar`, `retornar`,
   `ajustar`, `recibir`) que reciben estado y devuelven movimientos. No tocan storage. Con tests.
   Esas funciones no cambian cuando entre Supabase.
2. **Un solo módulo `lib/db`** con firmas estables. Hoy localStorage, mañana Supabase. Cambia el
   cuerpo, no las pantallas.
3. **El SQL del esquema se escribe desde ya** aunque no se ejecute, para no improvisarlo bajo presión
   cuando el cliente diga "aquí está mi servidor".
4. Al presentar se dice claro: los datos viven en ese navegador, y los permisos son estructura, no
   seguridad.

---

## 2. Identidad visual — propuesta

Debe ser propia, distinta a cualquier otro producto nuestro, y **no puede verse genérica**.

**Concepto: instrumento de precisión industrial.** No cohetes ni "espacio" (la trampa obvia con el
nombre Apolo). La empresa mide, fabrica, construye y certifica bajo normas internacionales — la
marca debe verse como un instrumento calibrado, no como una app de startup.

- **Marca gráfica:** una plomada — el instrumento de precisión más antiguo de la construcción — cuyo
  contorno lee simultáneamente como **pin de ubicación**. Precisión + rastreo en un solo símbolo, que
  es exactamente lo que Apolo vende. Encaja además dentro de una "A".
- **Color:** azul petróleo profundo como marca (evoca el sector sin ser literal), grafito neutro para
  la estructura, y **ámbar de señalización** reservado exclusivamente para alertas y deudas de
  herramienta. Que el ámbar signifique siempre "algo te falta" es un recurso de diseño, no decoración.
- **Tipografía:** *Archivo* para títulos (carácter de señalética industrial) + *IBM Plex Sans* para
  interfaz + *IBM Plex Mono* para SKUs, series y coladas. Plex tiene linaje de ingeniería y numerales
  tabulares reales — necesarios para que las columnas de cantidades no bailen.
- **Tema claro y oscuro**, con los tonos de marca y semánticos cambiando de valor entre temas (ningún
  tono único mantiene contraste legible sobre fondo claro y oscuro a la vez).

> Si prefieres otra dirección, mándame referencias visuales y hago variantes antes de fijar tokens.

---

## 3. Módulos

Orden de importancia para esta empresa, que no es el orden de un sistema de ecommerce:

1. **Dashboard BI** — el gancho. Prioridad declarada.
2. **Obras / Proyectos** — el centro del dominio. Todo se imputa a una obra.
3. **Inventario** — SKUs, clases de artículo, almacenes, pasillos, racks, unidades, ajustes.
4. **Solicitudes y despacho** — con la cadena de autorización bloqueante.
5. **Tracking y POD** — flota propia + transportista externo.
6. **Herramientas retornables** — quién tiene qué, en qué obra, desde cuándo. El dolor real.
7. **Compras y recepción** — órdenes a proveedor, recepción parcial.
8. **Importación desde ERP** — perfiles de mapeo de columnas, idempotencia, reversión.
9. **Conciliación ERP vs físico** — la diferencia que hoy nadie mide.
10. **Reportes**

---

## 4. Fases

### F0 · Fundaciones — *el esqueleto*
Repo, Next.js + TS strict + Tailwind v4, sistema de tokens claro/oscuro, primitivos (Button,
SectionCard, StatCard, StatusBadge, EmptyState, AlertCard, Icon, ConfirmDialog, tabla con orden y
paginación, ThemeToggle), layout con sidebar y header, i18n es/en, deploy a Vercel funcionando.
**Entregable: shell navegable en línea.**

### F1 · Motor de inventario — *sin UI*
Tipos del dominio, funciones puras de movimiento, kardex inmutable, saldo materializado,
reconciliación, conversión de unidades, bloqueo de stock negativo, máquina de estados del despacho
con autorización bloqueante. **Todo con tests.** Es el único módulo donde un bug cuesta dinero real.

### F2 · Dashboard BI
La pantalla que abre la presentación. KPIs, series, alertas de herramienta no retornada, obras
activas, movimientos recientes, estados de carga honestos (nunca pintar "0" mientras carga).

### F3 · Inventario y catálogo
Catálogo de SKUs con las tres clases, almacenes/pasillos/racks, existencias por ubicación, ajustes
con motivo obligatorio, transferencias entre almacenes, historial de kardex.

### F4 · Obras y despacho
Obras como centro de costo y destino. Solicitud → aprobación bloqueante → reserva → preparación →
despacho parcial o total. Alertas al aprobador.

### F5 · Tracking y POD
Panel de despacho, ruta del día, carga del vehículo, chofer, entrega con firma/foto, verificación de
coincidencia contra la orden de entrega del receptor. Transportista externo con número de guía.

### F6 · Herramientas retornables
Deuda de herramienta por obra y por responsable, antigüedad del préstamo, retorno con inspección,
alertas de lo que lleva demasiado tiempo fuera.

### F7 · Compras y recepción
Proveedores, órdenes de compra, recepción parcial, actualización de `en_transito` → `fisico`.

### F8 · Importador ERP + conciliación
Carga de Excel/CSV con mapeo de columnas guardado como perfil reutilizable, detección de duplicados
señalando **cuál** movimiento se repite, reversión completa de un archivo cargado por error, y la
pantalla de conciliación: *"tu ERP dice 40, el almacén tiene 37, aquí están los 3 movimientos que lo
explican"*.

### F9 · Auditoría de diseño
Contraste medido sobre píxel compuesto, área táctil mínima, tablas con orden y paginación, 375 px,
modo oscuro, estados vacíos y de carga, `prefers-reduced-motion`.

### F10 · Post-presentación *(fuera del demo)*
Supabase con RLS, autenticación real, escaneo con pistola y cámara, multi-tenant, equipos mayores con
horómetro y mantenimiento.

**Demo mínimo presentable: F0 → F6.** F7 y F8 se pueden mostrar como estructura con datos de ejemplo
si el calendario aprieta.

---

## 5. Qué hace único a Apolo

No es "Veeqo en español". Es el sistema de almacén para una empresa que **ya tiene un ERP que no va a
cambiar** y que **reparte con sus propios camiones a sus propias obras**.

1. **La obra como centro del modelo** — nadie más lo hace así; los sistemas de inventario giran
   alrededor del pedido o del canal de venta.
2. **Deuda de herramienta retornable** — responde literalmente al dolor declarado: no saben dónde
   están sus cosas.
3. **Trazabilidad de material certificado** (colada, certificado de calidad) — requisito real de la
   industria petrolera que ningún sistema genérico trae.
4. **Importador universal con perfiles de ERP** — la realidad local es un Excel distinto por empresa,
   no una API.
5. **Conciliación ERP vs físico** como pantalla de primera clase.
6. **Dashboards BI dinámicos** — el gancho comercial.

---

## 6. Decisiones pendientes

1. ~~**Datos del demo.**~~ **RESUELTO:** los dos estados, conmutables. El demo arranca con datos
   evidentemente ficticios (obras, SKUs y movimientos inventados, sin parecerse a cifras reales del
   cliente) y hay un botón *"Reiniciar a cero"* que deja el sistema como recién instalado. En la
   presentación se pueden mostrar ambos.
2. ~~**Identidad visual.**~~ **RESUELTO en proceso:** el cliente interno enviará referencias visuales
   antes de fijar nada. **No se fija ningún token de marca hasta recibirlas.** F0 se construye con una
   paleta neutra provisional y todo el color de marca aislado en un solo archivo, de modo que el
   cambio posterior sea de un archivo y no de toda la app.
3. **Costeo:** propuesto promedio ponderado. Sin confirmar.
4. **Trazabilidad:** propuestas tres clases de artículo (consumible / retornable / certificado). Sin
   confirmar con el cliente.
5. **Vercel sí, Supabase fase 2** — confirmado, pero una respuesta anterior fue ambigua. Asumido así.

## 7. Reordenamiento por la espera de referencias

Mientras llegan las referencias visuales, se adelanta lo que **no depende de la identidad**:

- **F1 (motor de inventario) se adelanta antes que F2.** Son funciones puras con tests: kardex,
  saldos, reconciliación, conversión de unidades, máquina de estados del despacho. Cero dependencia
  del color. Es además el módulo de mayor riesgo, así que adelantarlo es ganancia neta.
- **F0 se construye con paleta neutra provisional**, con la marca aislada en un único archivo de
  tokens.
- Se fija la identidad y se aplica cuando lleguen las referencias, sin repintar componentes.
