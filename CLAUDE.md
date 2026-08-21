@AGENTS.md

# Apolo

Sistema interno de inventario, almacén, obras y despacho para una constructora
grande del sector Oil & Gas. Actualmente en fase de **demo de presentación**.

- Planning: [`PLAN.md`](PLAN.md)
- Reglas de negocio confirmadas: [`docs/decisions/`](docs/decisions/)

## Regla irrevocable

**Sumigases, Sudematin y SumiControl no tienen ninguna relación con Apolo.** Ni
datos, ni clientes, ni módulos, ni referencias en el código o en la UI. El
documento "Blueprint Macedonia" es material de partida del que se toma lo que
sirve y se descarta el resto — no es una autoridad y ninguna decisión de Apolo
se justifica citándolo.

## Límites del producto

- **Apolo NUNCA genera facturas ni documentos fiscales.** El documento fiscal
  sale de otro sistema. No se implementa nada que roce cumplimiento SENIAT.
- Apolo **nunca escribe** en el ERP del cliente. La integración es de un solo
  sentido: se consumen sus exports.
- Sin marketplaces, sin integración de carriers (UPS/FedEx/DHL).

## Convenciones

- El dominio se nombra en español (`Articulo`, `Saldo`, `Obra`, `Solicitud`).
  Los identificadores evitan tildes y `ñ`: se usa `averiado`, no `dañado`.
- Los comentarios explican el **porqué** — la regla de negocio —, no el qué.
- Las reglas de inventario viven en `lib/dominio/` como **funciones puras** con
  tests. No tocan storage ni React. Cuando entre Supabase cambia quién las
  llama, no lo que hacen.
- Toda operación de inventario devuelve `Resultado<T>`, no lanza excepciones: un
  descuadre es una condición de negocio, no un fallo del programa.
- El kardex es inmutable. Un error se corrige con un asiento contrario, nunca
  editando o borrando.
- **La identidad vive en `app/identidad.css`**, y es UNA sola para la landing y
  para la aplicación. Antes cada superficie tenía la suya y por eso la landing
  se veía mejor: no era el color, era que la app conservaba otros materiales,
  otra tipografía y otros radios.
- **Apolo es oscuro. No hay tema claro.** Suelo `#00031c`, paneles de vidrio
  (blanco al 4 % con canto al 10 %), Poppins, radio 1,25rem y las cintas de luz
  de fondo. Los tokens del tema claro siguen en el archivo pero no se sirven.
- **Los paneles son translúcidos a propósito.** El velo deja pasar las cintas
  del fondo; uno opaco del mismo color medio se ve plano porque la luz muere
  detrás.
- **El canto del vidrio no cumple 3:1 y es una decisión, no un descuido.** Está
  escrito en `scripts/contraste.mjs`. Lo que sí lo cumple es `--borde-fuerte`,
  que viste CONTROLES: un campo de formulario que no se distingue del fondo no
  se puede usar, y eso la identidad no lo negocia.
- **Cada bloque grande declara qué tinta lleva.** No son intercambiables.
- Se mide antes de dar por bueno un color, nunca se estima. Y hacen falta las
  dos comprobaciones: `scripts/contraste.mjs` para los pares de tokens y
  `scripts/auditor-contraste-dom.js` para lo que se pinta de verdad — un token
  correcto en la superficie equivocada pasa la primera sin despeinarse.

## Comandos

```bash
npm run dev        # servidor de desarrollo
npm test           # suite del dominio
npx tsc --noEmit   # typecheck estricto
```
