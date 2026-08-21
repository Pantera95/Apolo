/**
 * Set de iconos propio. Sin librería externa: son diecisiete iconos, no vale la
 * pena una dependencia que se rompa en la próxima versión.
 *
 * TRAZO DE 1.5, bajado desde 1.75 al adoptar el lenguaje de la landing. Con
 * Poppins 500 y paneles de canto fino, un icono a 1.75 pesa más que el texto que
 * etiqueta y tira de la vista hacia la barra lateral en vez de hacia el dato.
 *
 * Tres se redibujaron porque no se leían a 18 px, que es su tamaño real:
 *   obras         la casita de tejado decía "inicio" y competía con Panel;
 *                 ahora es un edificio industrial con vanos.
 *   inventario    el cubo isométrico se volvía una mancha hexagonal; ahora son
 *                 cajas apiladas.
 *   estimaciones  el compás se confundía con una "A" de texto; ahora es la
 *                 escuadra graduada, que es lo que hace el módulo: medir.
 */

export type NombreIcono =
  | "panel"
  | "obras"
  | "inventario"
  | "solicitudes"
  | "despacho"
  | "herramientas"
  | "compras"
  | "estimaciones"
  | "importacion"
  | "reportes"
  | "sol"
  | "luna"
  | "idioma"
  | "menu"
  | "cerrar"
  | "alerta"
  | "flecha";

const TRAZOS: Record<NombreIcono, React.ReactNode> = {
  panel: (
    <>
      <rect x="3" y="3" width="7" height="8" rx="1.8" />
      <rect x="14" y="3" width="7" height="5" rx="1.8" />
      <rect x="3" y="14" width="7" height="7" rx="1.8" />
      <rect x="14" y="11" width="7" height="10" rx="1.8" />
    </>
  ),
  // Edificio con vanos, no una casa: el modulo son obras de construccion
  // industrial. La casita de tejado se leia como "inicio" y competia con Panel.
  obras: (
    <>
      <path d="M3 21h18" />
      <path d="M5 21V6.5a1.5 1.5 0 0 1 1.5-1.5h7a1.5 1.5 0 0 1 1.5 1.5V21" />
      <path d="M15 21V11h3.5A1.5 1.5 0 0 1 20 12.5V21" />
      <path d="M8 9h1.5M11.5 9H13M8 13h1.5M11.5 13H13" />
    </>
  ),
  // Cajas apiladas. El cubo isometrico anterior a 18px se convertia en una
  // mancha hexagonal indescifrable.
  inventario: (
    <>
      <rect x="3" y="12.5" width="8" height="8" rx="1.4" />
      <rect x="13" y="12.5" width="8" height="8" rx="1.4" />
      <rect x="8" y="3.5" width="8" height="8" rx="1.4" />
      <path d="M10.2 3.5v2.6M15.2 12.5v2.6M5.2 12.5v2.6" />
    </>
  ),
  solicitudes: (
    <>
      <path d="M6 3.5h8.5L19 8v12.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1z" />
      <path d="M14 3.5V8h5" />
      <path d="M8.5 12.5h7M8.5 16.5h4.5" />
    </>
  ),
  despacho: (
    <>
      <path d="M2.5 6.5h10.5v10H2.5z" />
      <path d="M13 10h3.6l2.9 3v3.5H13z" />
      <circle cx="6.5" cy="18.5" r="1.9" />
      <circle cx="16.5" cy="18.5" r="1.9" />
      <path d="M8.4 18.5h6.2" />
    </>
  ),
  herramientas: (
    <>
      <path d="M14.8 6.6a4 4 0 0 0 5.1 5.1l-8.3 8.3a2.35 2.35 0 0 1-3.3-3.3z" />
      <path d="m14.8 6.6 2.4-2.4 3.1 3.1-2.4 2.4" />
    </>
  ),
  compras: (
    <>
      <path d="M2.5 4h2.3l2.1 10.8h9.7l1.9-7.6H6" />
      <circle cx="9" cy="19.3" r="1.5" />
      <circle cx="16.4" cy="19.3" r="1.5" />
    </>
  ),
  importacion: (
    <>
      <path d="M12 3.5v10.5" />
      <path d="m7.8 9.8 4.2 4.2 4.2-4.2" />
      <path d="M4.5 16.5v3a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-3" />
    </>
  ),
  // Escuadra y lapiz: el modulo MIDE sobre un modelo y de ahi saca un precio.
  // El compas anterior se confundia con la "A" de un icono de texto.
  estimaciones: (
    <>
      <path d="M3.5 20.5 20.5 3.5" />
      <path d="M3.5 20.5v-6.2M3.5 20.5h6.2" />
      <path d="m7.2 16.8 2.1 2.1M10.4 13.6l2.1 2.1M13.6 10.4l2.1 2.1M16.8 7.2l2.1 2.1" />
    </>
  ),
  reportes: (
    <>
      <path d="M3.5 20.5h17" />
      <path d="M7 20.5v-6M12 20.5V5.5M17 20.5v-9" />
    </>
  ),
  sol: (
    <>
      <circle cx="12" cy="12" r="3.8" />
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6" />
    </>
  ),
  luna: <path d="M20 14.6A8.4 8.4 0 0 1 9.4 4a8.4 8.4 0 1 0 10.6 10.6z" />,
  idioma: (
    <>
      <circle cx="12" cy="12" r="8.7" />
      <path d="M3.6 9.4h16.8M3.6 14.6h16.8" />
      <path d="M12 3.3a14.5 14.5 0 0 1 0 17.4a14.5 14.5 0 0 1 0-17.4z" />
    </>
  ),
  menu: <path d="M4 7.5h16M4 12h16M4 16.5h16" />,
  cerrar: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  alerta: (
    <>
      <path d="M10.7 4.2 2.8 18a1.5 1.5 0 0 0 1.3 2.3h15.8a1.5 1.5 0 0 0 1.3-2.3L13.3 4.2a1.5 1.5 0 0 0-2.6 0z" />
      <path d="M12 9.5v4M12 17h.01" />
    </>
  ),
  flecha: <path d="M4.5 12h15M13.5 6l6 6-6 6" />,
};

export function Icono({
  nombre,
  tam = 20,
  className = "",
}: {
  nombre: NombreIcono;
  tam?: number;
  className?: string;
}) {
  return (
    <svg
      width={tam}
      height={tam}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {TRAZOS[nombre]}
    </svg>
  );
}

/**
 * Marca de Apolo: el disco solar cortado por un haz.
 * Apolo es el dios de la luz, y el producto existe para alumbrar lo que la
 * empresa hoy no ve de su propio almacén. El haz es también un rayo de escaneo.
 */
export function MarcaApolo({ tam = 28 }: { tam?: number }) {
  return (
    <svg
      width={tam}
      height={tam}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      {/*
        El isotipo: un cubo isométrico con la "A" recortada en la cara frontal.

        Se dibuja en SVG y no se usa el PNG original por tres razones: pesa
        1,3 MB, se ve borroso en pantallas densas al escalarlo, y un vector
        hereda los tokens de marca.

        LO QUE HACE QUE SE LEA COMO UN CUBO SON LAS TRES CARAS, no el contorno.
        Un hexágono con un hexágono dorado dentro es un hexágono; el volumen
        aparece cuando las tres caras que concurren en el centro llevan tonos
        distintos, como la luz real sobre un sólido. Por eso el oro va en tres
        valores y no en uno.

        Usa tonos FIJOS de marca y no los del tema: el isotipo tiene que verse
        igual sobre el panel oscuro de la navegación y sobre el lienzo claro.
      */}
      <path d="M32 3 58 18v28L32 61 6 46V18z" fill="var(--bloque-marca)" />

      {/* Cara superior: la que recibe la luz. */}
      <path d="M32 12 50 22.5 32 33 14 22.5z" fill="var(--apolo-oro-claro)" />
      {/* Cara izquierda, en el oro base. */}
      <path d="M14 22.5 32 33v19L14 41.5z" fill="var(--apolo-oro-bloque)" />
      {/* Cara derecha, en sombra: es la que cierra el volumen. */}
      <path d="M50 22.5v19L32 52V33z" fill="var(--apolo-oro-sombra)" />

      {/*
        La "A", en el azul de la marca para que recorte sobre el oro. Se dibuja
        sobre las tres caras a la vez, que es lo que la ata al sólido en vez de
        dejarla flotando encima.

        VA GRANDE Y PESADA A PROPÓSITO. Un primer trazo más fino se leía bien a
        240 px y se convertía en un borrón a los 28 px de la barra lateral, que
        es el único tamaño al que este isotipo se ve de verdad. Ocupa casi todo
        el hexágono interior, como en el logotipo original, y el contrapunzón
        es lo bastante ancho para no cerrarse al reducir.
      */}
      <path
        d="M32 13.5 49.5 50.5h-8l-2.9-6.8H25.4l-2.9 6.8h-8zm0 13.2-4 9.9h8z"
        fill="var(--bloque-marca)"
        fillRule="evenodd"
      />
    </svg>
  );
}

