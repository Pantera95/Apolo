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
- Los valores de marca (color, tipografía) viven aislados en `app/marca.css`
  para poder cambiar la identidad sin tocar componentes.
- **La paleta se comparte con la landing de Global XXI**: azul petrolero como
  marca, cian como la "luz" que señala el dato, ámbar como acento de apoyo. Son
  los mismos hex que el sitio corporativo, a petición del cliente: quien entra
  desde la landing no debe sentir que cambió de empresa. Si cambian allí, hay
  que cambiarlos aquí. Antes Apolo era violeta y verde.
- **Cada bloque grande declara qué tinta lleva.** No son intercambiables: el
  azul es oscuro y pide blanco, el cian es CLARO —por saturado que se vea— y
  pide tinta oscura. Blanco sobre cian daría 1,7:1.
- Ningún tono único mantiene 4,5:1 sobre fondo claro Y oscuro, así que los
  tokens **cambian de valor** entre temas. Se mide antes de dar por bueno un
  color, nunca se estima.

## Comandos

```bash
npm run dev        # servidor de desarrollo
npm test           # suite del dominio
npx tsc --noEmit   # typecheck estricto
```
