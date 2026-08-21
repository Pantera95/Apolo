# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Cuatro perfiles operan Apolo, y sus contextos son incompatibles entre sí. Eso es
un dato de producto, no un detalle: obliga a que la misma información se pueda
leer de pie con guantes y también en una tabla densa de escritorio.

- **Almacén**, en patio o galpón. Recibe, despacha y presta herramienta. De pie,
  a menudo con guantes y con sol directo, posiblemente desde un móvil.
- **Administración**, en escritorio. Solicitudes, compras, conciliación y
  reportes. Sesiones largas contra tablas densas en pantalla grande.
- **Dirección**, consultando. No opera: mira indicadores, aprueba y recibe
  informes por Telegram o PDF. Entra poco y quiere la respuesta rápido.
- **Ingeniería de obra**. Estimaciones, cómputos métricos y procura. Trabaja
  contra modelos de diseño y análisis de precio unitario.

## Product Purpose

Controlar el material, la herramienta y la procura de una constructora de Oil &
Gas: qué hay, dónde está, hacia qué obra salió y quién responde por ello.

El éxito es que el histórico cuadre con lo que hay en el estante, y que la deuda
de herramienta y el material despachado y no consumido dejen de descubrirse en
un inventario anual.

## Positioning

**Apolo cubre el hueco que el ERP del cliente no cubre, sin tocar el ERP.**

Existe un sistema contable y fiscal, pero el movimiento físico de material y
herramienta vive fuera de él. Apolo entra ahí consumiendo sus exports en un solo
sentido: nunca escribe en el sistema de origen. Si Apolo se apaga mañana, el ERP
queda exactamente igual que estaba.

Eso es lo que un producto vecino no puede copiar de forma honesta: la mayoría
pide migrar o pide escribir. Apolo no pide ninguna de las dos cosas, y por eso
puede adoptarse sin poner en riesgo lo que ya funciona.

El kardex inmutable es la otra mitad: un error se corrige con un asiento
contrario, nunca editando ni borrando, así que la verdad es auditable por
construcción.

## Operating Context

- El material sale del almacén hacia obras identificadas, con guía y responsable.
- La herramienta se presta y se devuelve; la deuda abierta se sigue por obra y
  por responsable, con antigüedad.
- Las solicitudes de obra recorren una cadena de firmas que depende del monto.
- La procura compara ofertas a costo desembarcado real, incluyendo incoterm,
  flete, seguro y aduana.
- La dirección consume el estado por PDF y por un canal de Telegram de la
  empresa. El bot es de solo lectura.
- Fase actual: **demostración de presentación**. Los datos viven en el navegador.

## Capabilities and Constraints

Restricciones irrevocables, ya vigentes en el código y en `CLAUDE.md`:

- **Apolo nunca genera facturas ni documentos fiscales.** El documento fiscal
  sale de otro sistema. No se implementa nada que roce cumplimiento SENIAT.
- **Apolo nunca escribe en el ERP del cliente.** La integración es de un solo
  sentido: se consumen sus exports.
- **El kardex es inmutable.** Se corrige con asiento contrario, nunca editando.
- Sin marketplaces y sin integración de transportistas (UPS/FedEx/DHL).
- **Sumigases, Sudematin y SumiControl no tienen ninguna relación con Apolo.** Ni
  datos, ni clientes, ni módulos, ni referencias en el código o en la interfaz.
- Toda operación de inventario devuelve un resultado explícito: un descuadre es
  una condición de negocio que se informa, no un fallo que se traga.
- El dominio se nombra en español; los identificadores evitan tildes y `ñ`.

### DECISIÓN ABIERTA: interno frente a SaaS

El usuario confirmó que Apolo es **un SaaS para varias constructoras del sector
Oil & Gas**, no una herramienta interna de una sola empresa.

**Esto contradice `CLAUDE.md`, que hoy dice "Sistema interno … para una
constructora grande".** La contradicción está sin resolver a propósito y no debe
darse por zanjada en ninguna dirección hasta que el usuario lo decida, porque
arrastra consecuencias que aún NO están implementadas:

- Aislamiento de datos por empresa cliente (hoy todo vive en un `localStorage`
  sin noción de inquilino).
- Alta y onboarding de empresas nuevas.
- El plan Premium tendría que ser un nivel comercial real, no el conmutador de
  demostración que es hoy.
- El vocabulario del producto no puede quedarse pegado al de un cliente concreto.

Ninguna de esas cuatro está construida. Registrarlas aquí evita que trabajo
futuro asuma que sí.

## Brand Commitments

- Nombre: **Apolo**. Dios de la luz — el producto existe para que una empresa vea
  lo que hoy no ve de su propio almacén.
- Marca gráfica: disco solar cortado por un haz, que es también un rayo de
  escaneo. Vive en `components/ui/icono.tsx`.
- Español como idioma principal, con inglés disponible.
- Restricción visual vinculante declarada por el usuario: la identidad se copia
  de `https://nexux.framer.website/` y de las capturas de `Rediseño/`. Queda
  registrada tal cual, sin ampliarla: las decisiones visuales no pertenecen a
  este archivo.

## Evidence on Hand

- 631 pruebas del dominio en verde, más 4 de la serie del panel.
- Guion de contraste propio, `scripts/contraste.mjs`, con 210 pares medidos.
- Formato de planilla APU del cliente trazado línea a línea en
  `lib/licitaciones/composiciones.ts`, de modo que la suite actúa como contrato
  con ese formato.
- Documentos: `docs/APOLO-BRIEFING-IA.txt` y `docs/APOLO-BLUEPRINT.txt`.

**Ausencias que el trabajo futuro NO debe inventar:** no hay clientes reales, ni
testimonios, ni cifras de negocio, ni precios, ni casos de éxito, ni acuerdos de
despliegue. Todos los datos de la demostración son ficticios y la interfaz lo
declara. Cualquier cifra que aparezca en una pantalla o en un PDF es de
demostración mientras no se diga lo contrario.

## Product Principles

1. **Adoptarlo no puede poner en riesgo lo que ya funciona.** Un solo sentido de
   integración, sin migración previa, sin escribir en el sistema de origen.
2. **La verdad es auditable por construcción.** Kardex inmutable; corregir es
   asentar, nunca borrar.
3. **Un descuadre se informa, no se esconde.** Las operaciones devuelven un
   resultado explícito en vez de fallar en silencio.
4. **La misma información sirve a cuatro contextos incompatibles.** Lo que se lee
   con guantes al sol y lo que se lee en una tabla densa son la misma verdad
   presentada distinto, no dos productos.
5. **Se mide, no se estima.** El color, el contraste y el rendimiento se
   verifican con herramientas antes de darlos por buenos.

## Accessibility & Inclusion

Requisito derivado del contexto real de uso, no de una norma genérica:

- El perfil de almacén trabaja **con guantes y con sol directo**, así que los
  objetivos táctiles de 44 px y el contraste alto no son una casilla de
  cumplimiento sino una condición de funcionamiento.
- Contraste verificado con medición, nunca estimado. Umbral vigente: 4,5:1 para
  texto y 3:1 para límites no textuales.
- Los dos temas, claro y oscuro, se comprueban por separado.
