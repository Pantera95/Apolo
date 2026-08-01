"use client";

/**
 * Pestañas.
 *
 * En móvil se desplazan en horizontal; NUNCA se parten en varias filas. Un
 * grupo de pestañas que se apila deja de leerse como un selector y empieza a
 * parecer una lista de enlaces sueltos, y el usuario pierde de vista cuál está
 * activa.
 */
export function Pestanas<T extends string>({
  valor,
  onCambio,
  opciones,
  etiqueta,
}: {
  valor: T;
  onCambio: (v: T) => void;
  opciones: { valor: T; texto: string; contador?: number }[];
  etiqueta: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={etiqueta}
      className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
    >
      {opciones.map((o) => {
        const activa = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            role="tab"
            aria-selected={activa}
            onClick={() => onCambio(o.valor)}
            className={[
              "flex min-h-11 shrink-0 items-center gap-2 rounded-pildora border-2 px-4 text-sm font-bold transition-colors",
              activa
                ? "border-transparent bg-bloque-marca text-white"
                : "border-borde bg-superficie text-texto-2 hover:border-borde-fuerte hover:text-texto",
            ].join(" ")}
          >
            {o.texto}
            {o.contador !== undefined && (
              <span
                className={`cifra rounded-pildora px-1.5 text-xs ${
                  activa ? "bg-white/20" : "bg-superficie-2"
                }`}
              >
                {o.contador}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
