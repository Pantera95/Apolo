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
        "min-w-0 rounded-tarjeta border-2 border-borde bg-superficie",
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
    marca: "bg-bloque-marca text-white border-transparent",
    luz: "bg-bloque-luz text-white border-transparent",
    contorno: "bg-superficie text-texto border-borde shadow-dura",
  };

  const tenue: Record<VarianteKpi, string> = {
    marca: "text-white/70",
    luz: "text-white/70",
    contorno: "text-texto-3",
  };

  return (
    <article
      className={[
        "flex min-w-0 flex-col justify-between rounded-tarjeta border-2 p-6",
        estilos[variante],
        className,
      ].join(" ")}
    >
      <p
        className={`text-[11px] font-extrabold uppercase tracking-[0.12em] ${tenue[variante]}`}
      >
        {etiqueta}
      </p>

      {listo ? (
        <p
          className={`cifra mt-6 font-extrabold leading-[0.85] tracking-[-0.04em] ${
            destacada ? "text-6xl sm:text-7xl" : "text-4xl sm:text-5xl"
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
