import type { ReactNode } from "react";

/**
 * Contenedores de Apolo.
 *
 * `min-w-0` no es cosmético: sin él, una gráfica responsiva dentro de una
 * cuadrícula desborda horizontalmente en móvil, porque los hijos de grid y flex
 * no encogen por debajo de su contenido.
 */

export function Tarjeta({
  titulo,
  descripcion,
  accion,
  children,
  className = "",
}: {
  titulo?: string;
  descripcion?: string;
  accion?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={[
        // `vidrio` trae superficie, desenfoque, borde y canto de luz. El borde
        // ya cumple 3:1 sobre las tres superficies, así que no hace falta
        // subirlo a `borde-fuerte` ni doblar su grosor como antes.
        "vidrio backdrop-blur-xl backdrop-saturate-150 min-w-0",
        className,
      ].join(" ")}
    >
      {(titulo || accion) && (
        <header className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5">
          <div className="min-w-0">
            {/* El título va en píldora, no en texto suelto: es la forma que
                define la dirección visual y evita el encabezado genérico. */}
            {titulo && (
              <h2 className="inline-flex rounded-pildora bg-superficie-2 px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-[0.08em]">
                {titulo}
              </h2>
            )}
            {descripcion && (
              <p className="mt-2 text-sm text-texto-2">{descripcion}</p>
            )}
          </div>
          {accion}
        </header>
      )}
      <div className="p-6">{children}</div>
    </section>
  );
}

export type VarianteKpi = "marca" | "luz" | "contorno";

/**
 * Tarjeta de indicador.
 *
 * Deliberadamente SIN barra de color lateral ni jerarquía etiqueta-arriba /
 * número-abajo: eso es el patrón genérico de panel administrativo. Aquí el
 * número es un titular —tipografía enorme y muy apretada— y el color es un
 * bloque sólido que ocupa toda la tarjeta, que es lo que caracteriza la
 * dirección visual elegida.
 *
 * `listo` existe para no pintar nunca un "0" mientras cargan los datos del
 * cliente: una cifra falsa que después salta es peor que un esqueleto.
 */
export function TarjetaKpi({
  etiqueta,
  valor,
  pie,
  variante = "contorno",
  destacada = false,
  listo = true,
  className = "",
}: {
  etiqueta: string;
  valor: string;
  pie?: string;
  variante?: VarianteKpi;
  destacada?: boolean;
  listo?: boolean;
  className?: string;
}) {
  const estilos: Record<VarianteKpi, string> = {
    // Los bloques macizos NO llevan vidrio: un color de marca a plena
    // saturación detrás de un desenfoque se ensucia y pierde la fuerza que es
    // justo su razón de existir.
    marca: "bg-bloque-marca text-bloque-marca-texto border-transparent",
    luz: "bg-bloque-luz text-bloque-luz-texto border-transparent",
    contorno: "vidrio backdrop-blur-xl backdrop-saturate-150 text-texto",
  };

  // El texto secundario del bloque verde NO baja de opacidad: al 70% caería a
  // 3.89:1. Se diferencia por peso y tamaño, que es más accesible que el alfa.
  const tenue: Record<VarianteKpi, string> = {
    marca: "text-bloque-marca-texto/70",
    luz: "text-bloque-luz-texto/85",
    contorno: "text-texto-3",
  };

  return (
    <article
      className={[
        "flex min-w-0 flex-col justify-between rounded-tarjeta p-6",
        // El borde solo lo pintan las variantes macizas; `vidrio` trae el suyo.
        variante === "contorno" ? "" : "border",
        estilos[variante],
        className,
      ].join(" ")}
    >
      <p
        className={`text-[11px] font-medium uppercase tracking-[0.08em] ${tenue[variante]}`}
      >
        {etiqueta}
      </p>

      {listo ? (
        <p
          /*
            El tamaño está calibrado al ancho real de la tarjeta: a text-4xl,
            un importe como "USD 128.326" no cabe en una columna de cuatro y se
            partía en dos líneas. `break-words` queda solo de red de seguridad
            para valores excepcionalmente largos.
          */
          className={`cifra mt-6 min-w-0 break-words font-extrabold leading-[0.9] tracking-[-0.04em] ${
            destacada
              ? "text-4xl sm:text-5xl xl:text-6xl"
              : "text-[clamp(1.35rem,2.1vw,1.875rem)]"
          }`}
        >
          {valor}
        </p>
      ) : (
        <div
          role="status"
          aria-label="Cargando"
          className={`mt-6 rounded-lg ${destacada ? "h-16 w-40" : "h-11 w-28"} ${
            variante === "contorno" ? "bg-superficie-2" : "bg-white/20"
          }`}
        />
      )}

      {pie && (
        <p className={`mt-4 text-sm font-semibold leading-snug ${tenue[variante]}`}>
          {pie}
        </p>
      )}
    </article>
  );
}
