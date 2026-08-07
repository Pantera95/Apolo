/**
 * Set de iconos propio. Trazo de 1.75 sobre lienzo de 24 para que se lean a
 * 18px en la barra lateral sin emborronarse. Sin librería externa: son doce
 * iconos, no vale la pena una dependencia que se rompa en la próxima versión.
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
      <rect x="3" y="3" width="7.5" height="8.5" rx="2" />
      <rect x="13.5" y="3" width="7.5" height="5" rx="2" />
      <rect x="3" y="14.5" width="7.5" height="6.5" rx="2" />
      <rect x="13.5" y="11" width="7.5" height="10" rx="2" />
    </>
  ),
  obras: (
    <>
      <path d="M3 21h18" />
      <path d="M5 21V8l7-5 7 5v13" />
      <path d="M10 21v-6h4v6" />
    </>
  ),
  inventario: (
    <>
      <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" />
      <path d="M3 7.5 12 12l9-4.5" />
      <path d="M12 12v9" />
    </>
  ),
  solicitudes: (
    <>
      <rect x="4.5" y="3" width="15" height="18" rx="2.5" />
      <path d="M8.5 8.5h7M8.5 12.5h7M8.5 16.5h4" />
    </>
  ),
  despacho: (
    <>
      <path d="M2.5 7h10v9h-10z" />
      <path d="M12.5 10.5h4l3 3V16h-7z" />
      <circle cx="6.5" cy="18.5" r="2" />
      <circle cx="16.5" cy="18.5" r="2" />
    </>
  ),
  herramientas: (
    <>
      <path d="M14.5 6.5a4 4 0 0 0 5.2 5.2l-8.4 8.4a2.4 2.4 0 0 1-3.4-3.4z" />
      <path d="M14.5 6.5 17 4l3 3-2.5 2.5" />
    </>
  ),
  compras: (
    <>
      <path d="M3 4h2.2l2 11.5h10.4L20 7H6" />
      <circle cx="9" cy="19.5" r="1.6" />
      <circle cx="17" cy="19.5" r="1.6" />
    </>
  ),
  importacion: (
    <>
      <path d="M12 3v11" />
      <path d="m7.5 9.5 4.5 4.5 4.5-4.5" />
      <path d="M4 17v2.5a1.5 1.5 0 0 0 1.5 1.5h13a1.5 1.5 0 0 0 1.5-1.5V17" />
    </>
  ),
  // Compas de dibujo: mide y traza, que es lo que hace el modulo. No se
  // reutiliza el carrito de compras — dos entradas del mismo grupo con el
  // mismo icono se confunden a 18 px de alto.
  estimaciones: (
    <>
      <circle cx="12" cy="4" r="1.5" />
      <path d="m10.8 5.3-5.3 14.2M13.2 5.3l5.3 14.2" />
      <path d="M8.4 13.2a7 7 0 0 0 7.2 0" />
    </>
  ),
  reportes: (
    <>
      <path d="M3 20.5h18" />
      <path d="M6.5 20.5V12M12 20.5V5M17.5 20.5v-6" />
    </>
  ),
  sol: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" />
    </>
  ),
  luna: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />,
  idioma: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3.5 9.5h17M3.5 14.5h17" />
      <path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18z" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  cerrar: <path d="M6 6l12 12M18 6L6 18" />,
  alerta: (
    <>
      <path d="M12 3.5 21 19.5H3z" />
      <path d="M12 9.5v4.5M12 17h.01" />
    </>
  ),
  flecha: <path d="M5 12h14M13 6l6 6-6 6" />,
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
      strokeWidth={1.75}
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
        El hexágono del logotipo, con la "A" dorada dentro.

        Se dibuja en SVG y no se usa el PNG original por tres razones: pesa
        1,3MB, se ve borroso en pantallas densas al escalarlo, y un vector puede
        heredar los tokens de marca. Las proporciones siguen al logotipo.

        Usa los tokens FIJOS de bloque, no los del tema: la marca tiene que
        verse igual sobre el panel oscuro de la nav y sobre el lienzo claro.
      */}
      <path
        d="M32 3 58 18v28L32 61 6 46V18z"
        fill="var(--bloque-marca)"
      />
      {/* Cara interior en oro: es la que da el volumen del isotipo. */}
      <path d="M32 12 50 22.5v19L32 52 14 41.5v-19z" fill="var(--bloque-luz)" />
      {/* La A, en el azul de la marca para que recorte sobre el oro. */}
      <path
        d="M32 19 43 45h-6.2l-1.9-4.8h-5.8L27.2 45H21zm0 10.8-2 5.2h4z"
        fill="var(--bloque-marca)"
      />
    </svg>
  );
}
