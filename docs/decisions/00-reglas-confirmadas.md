# Apolo — Reglas de negocio confirmadas

> Estado: confirmado con el cliente interno el 2026-08-01, salvo lo marcado **PROVISIONAL**.
> Lo PROVISIONAL se diseñó sin datos reales y debe validarse tras la presentación.

---

## 0. Regla irrevocable

Apolo es un producto independiente. **Sumigases, Sudematin y SumiControl no tienen relación con
Apolo**: ni datos, ni clientes, ni módulos, ni referencias. El documento "Blueprint Macedonia" es
material de partida del que se toma lo que sirve y se descarta lo demás. Ninguna decisión de Apolo
se justifica con "así lo hace SumiControl".

---

## 1. Qué es Apolo

Sistema interno de control de inventario, almacén, obras y despacho para una constructora grande
del sector Oil & Gas (ingeniería y construcción, área industrial, equipos pesados, procura), con
varios contratos abiertos simultáneamente en distintas ubicaciones.

**El dolor real:** la empresa es tan grande que no logra rastrear sus propias cosas. El almacén no
está al día. No es un problema de vender más: es un problema de saber qué tienen, dónde está y
quién lo tiene.

**Insight central del dominio:** el objeto alrededor del que gira todo NO es el pedido — es la
**OBRA**. El material se asigna a una obra, la herramienta se presta a una obra y debe volver, el
consumo se imputa a una obra. Esto es lo que separa a Apolo de cualquier sistema de ecommerce.

## 2. Qué Apolo NO hace

- **No genera facturas ni documentos fiscales, bajo ningún concepto.** Eso implica cumplimiento
  SENIAT y es terreno explícitamente descartado. El documento fiscal sale de otro sistema.
- No vende en marketplaces (Shopify/Amazon/ML). Todo lo "multicanal" se descarta.
- No compra etiquetas ni integra carriers (UPS/FedEx/DHL).
- No escribe nunca en el ERP del cliente. La integración es de un solo sentido: se consumen sus
  exports.
- No maneja ventas internas, gastos, comisiones, bonos, cuentas por cobrar ni por pagar.

## 3. Artículos — tres clases

La clase determina el comportamiento en todo el sistema.

| Clase | Retorna de obra | Identidad | Ejemplos |
|---|---|---|---|
| `CONSUMIBLE` | No | Solo SKU | clavos, tornillos, electrodos, pintura, cemento |
| `RETORNABLE` | **Sí, obligatorio** | Serie o placa de activo + responsable | llaves, sierras cortadoras, esmeriles, andamios |
| `CERTIFICADO` | No | Colada / *heat number* + certificado adjunto | tubería, válvulas, bridas, material crítico |

`RETORNABLE` es el corazón del producto: una herramienta que sale a obra genera una **deuda** contra
esa obra y contra una persona, y esa deuda se ve hasta que vuelva. Es la respuesta directa al dolor
declarado.

`CERTIFICADO` es requisito real de la industria petrolera (trazabilidad de material) y es un
diferenciador fuerte: ningún sistema genérico de inventario lo trae.

**PROVISIONAL:** los equipos mayores (grúas, camiones especializados) probablemente necesiten
horómetro y plan de mantenimiento. Se deja fuera del demo y se modela como `RETORNABLE` por ahora.

## 4. Inventario

- Un SKU puede existir en varios almacenes y se transfiere entre ellos.
- Ubicaciones internas: **almacén → pasillo → rack**. Marcado como quitable si el cliente no lo usa.
- Cantidades por SKU/almacén/ubicación: `fisico`, `reservado`, `disponible`, `en_transito`,
  `en_obra`, `dañado`.
  - `disponible = fisico − reservado − dañado`
- **Stock negativo prohibido.** El sistema bloquea, no advierte.
- Todo movimiento genera un asiento inmutable de kardex. El saldo se guarda materializado y se
  actualiza en la misma operación; un chequeo de reconciliación compara ambos y alerta si difieren.
  Ninguno de los dos es opcional.
- **Todo ajuste manual exige motivo.** Catálogo cerrado inicial: `merma`, `rotura`,
  `consumo_interno`, `dañado_de_fabrica`. **PROVISIONAL** — se ampliará con los motivos reales.
- Conteo cíclico **quincenal** (cada 15 días). **PROVISIONAL.**
- Costeo: **promedio ponderado**. **PROVISIONAL** — no confirmado por el cliente.

## 5. Unidades de medida

Cada SKU tiene una unidad base y factores de conversión declarados. Catálogo inicial cubriendo
empacadoras y ferretería/construcción:

`und` · `caja` · `paquete` · `saco` · `bolsa` · `rollo` · `par` · `juego` · `cuñete` · `tambor`
`m` · `m2` · `m3` · `ml` · `pie` · `pulg` · `l` · `gal` · `kg` · `g` · `ton` · `lb` · `lámina` · `barra` · `tubo`

Un SKU declara su equivalencia (ej. `1 caja = 100 und`). Los movimientos se registran siempre en la
**unidad base**; la UI permite capturar en cualquier unidad y convierte. Sin esto, "50" no significa
nada.

## 6. Flujo de despacho — autorización en cadena

Regla dura: **si la solicitud no está aprobada, el sistema no deja avanzar y lo físico no debe
ocurrir.** No es una advertencia, es un bloqueo de estado.

```
SOLICITUD          creada por obra o por un área interna
   ↓               (genera alerta al aprobador)
APROBACIÓN         un rol autorizado aprueba o rechaza — BLOQUEANTE
   ↓
RESERVA            el stock queda apartado (reservado ↑, disponible ↓)
   ↓
PREPARACIÓN        picking por ubicación
   ↓
DESPACHO           sale del almacén (fisico ↓, en_transito ↑)
   ↓
ENTREGA            POD del chofer; debe coincidir con la orden del receptor
   ↓
EN OBRA            (en_obra ↑) — si hay RETORNABLES, queda deuda abierta
   ↓
RETORNO            solo artículos RETORNABLE (en_obra ↓, fisico ↑ o dañado ↑)
```

- El despacho puede ser **parcial**: la solicitud queda abierta con el saldo pendiente.
- Toda transición de estado queda en bitácora con usuario, fecha y motivo si aplica.

## 7. Origen de la demanda

- **Interna:** un área o una obra solicita material desde dentro de Apolo con un formato propio de
  Apolo (equivalente funcional a una nota de entrega interna). Es el caso principal.
- **Externa:** se puede despachar material a un tercero como parte del servicio de construcción.
- **ERP:** se cargan archivos exportados del ERP del cliente. Apolo nunca escribe de vuelta.

## 8. Tracking y entrega

- **Ambas modalidades:** flota propia (chofer, vehículo, ruta) y transportista externo contratado
  (con su número de guía, sin integración de API).
- Panel de despacho: ruta del día, carga del vehículo, estado por parada.
- **Prueba de entrega (POD):** firma y/o foto captada por el chofer.
- **No hay link público de seguimiento.** El receptor tiene una orden de entrega física que debe
  **coincidir** con la que genera el chofer en el sistema. La validación es esa coincidencia.
- Los choferes tienen datos móviles → el POD no necesita funcionar offline en esta etapa.

## 9. Devoluciones

- Un `RETORNABLE` que vuelve de obra reingresa a stock (`fisico ↑`) o a `dañado` según su estado.
- Un `CONSUMIBLE` no vuelve; su salida a obra es consumo definitivo.
- Toda devolución exige inspección y motivo si no reingresa como bueno.

## 10. Escaneo

- Los productos **ya tienen código de barras**. Apolo no imprime etiquetas por ahora.
- En producción se usarán pistolas lectoras y cámara de celular.
- **Fuera del demo por decisión explícita**: no invertir esfuerzo en escaneo todavía. La UI se
  diseña con un campo de entrada que acepta tecleo o lectura, que es lo que una pistola emula.

## 11. Compras

- Órdenes de compra a proveedores dentro de Apolo.
- Recepción **parcial** de mercancía; el saldo pendiente queda visible.

## 12. Usuarios y permisos

- Para el demo: roles ficticios, y todo se muestra y navega como `owner` — es a quien se le presenta
  el producto.
- Costos y utilidad visibles para todos **por ahora**. **PROVISIONAL:** en producción hay que separar
  quién ve dinero.
- Autenticación prevista: correo + contraseña para roles de oficina; acceso simplificado para
  operarios de almacén.
- Escala objetivo en producción: **30–60 usuarios**, y aproximadamente **el doble de SKUs** que un
  sistema de inventario mediano. El demo no necesita ese volumen, pero el modelo sí debe aguantarlo.

⚠️ **Mientras no haya backend, los permisos son estructura, no seguridad.** Decirlo explícitamente
al presentar.

## 13. Moneda e idioma

- Moneda interna única: **USD**. Si un monto se captura en Bs, se guarda la tasa usada y el monto
  convertido. Nunca se guarda solo el nominal.
- Idioma: **español e inglés**, configurable.

## 14. Datos del demo

El cliente no entrega información real hasta después de la presentación. Por lo tanto **no hay datos
reales** y no se deben inventar cifras que parezcan reales.

Instrucción recibida: contadores en cero, pero los dashboards armados.
**Ver la nota abierta en `PLAN.md` §Decisiones pendientes** — un dashboard en cero no vende, y la
propuesta es tener ambos estados conmutables.
