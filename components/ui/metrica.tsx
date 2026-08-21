"use client";

import type { ReactNode } from "react";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";

import { Icono } from "@/components/ui/icono";

/**
 * Tarjeta de métrica — la unidad del panel rediseñado.
 *
 * NO ES LA ANTERIOR CON OTRO COLOR, y esa fue la corrección: la primera pasada
 * cambió los tokens y dejó la misma caja, que es un cambio de piel. La
 * anatomía de la referencia es otra:
 *
 *   · La ETIQUETA va arriba y pequeña, no compitiendo con la cifra.
 *   · La CIFRA es el héroe: grande de verdad, con dígitos tabulares para que
 *     no baile al actualizarse.
 *   · Un CHIP DE VARIACIÓN al lado, con su flecha y su color.
 *   · Una CURVA CON HALO ocupando el pie de la tarjeta, sangrada hasta los
 *     bordes: no es un gráfico aparte, es el fondo de la propia cifra.
 *   · Una AFORDANCIA `↗` arriba a la derecha cuando la tarjeta lleva a algún
 *     sitio. Si no lleva a ninguna parte, no se pinta: una flecha que no
 *     navega es una promesa incumplida.
 *
 * La curva es DECORACIÓN CONTEXTUAL, no un gráfico que se lea: sin ejes, sin
 * rejilla y sin tooltip. Por eso va con `aria-hidden` y la cifra la acompaña
 * en texto — quien use lector de pantalla no se pierde nada.
 */

export type TonoMetrica = "marca" | "luz" | "neutro";

const RELLENO: Record<TonoMetrica, string> = {
  marca: "var(--serie-1)",
  luz: "var(--serie-2)",
  /* NO `--serie-4`: al reordenar las series a la paleta de la landing ese slot
     pasó a ser rosa, y el tono llamado "neutro" quedó pintado del color más
     saturado del conjunto. Ahora tira de su propio token apagado. */
  neutro: "var(--grafico-neutro)",
};

export interface Variacion {
  /** Positivo = subió. El signo decide la flecha, no el color. */
  pct: number;
  /**
   * Si subir es bueno. NO SE PUEDE ASUMIR: que suba la deuda de herramienta es
   * malo y que suba el disponible es bueno, y pintar las dos de verde sería
   * mentir con color.
   */
  subirEsBueno: boolean;
  nota?: string;
}

export function Metrica({
  etiqueta,
  valor,
  pie,
  variacion,
  serie,
  tono = "neutro",
  heroe = false,
  destino,
  onAbrir,
  listo = true,
  className = "",
  children,
}: {
  etiqueta: string;
  valor: string;
  pie?: string;
  variacion?: Variacion;
  /** Puntos de la curva de fondo. Menos de tres no dibuja nada. */
  serie?: number[];
  tono?: TonoMetrica;
  /** La tarjeta protagonista de la rejilla: cifra al doble de cuerpo. */
  heroe?: boolean;
  /** Texto accesible del `↗`. Sin él, la flecha no se pinta. */
  destino?: string;
  onAbrir?: () => void;
  listo?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const id = `halo-${tono}-${etiqueta.replace(/\W/g, "")}`;
  const datos = (serie ?? []).map((v, i) => ({ i, v }));
  const hayCurva = datos.length >= 3;

  /*
   * DOMINIO CON AIRE, calculado a mano.
   *
   * Con el dominio automatico de Recharts el minimo se apoya EXACTAMENTE en el
   * borde inferior y el maximo en el superior: la curva se pega al suelo en los
   * tramos bajos y el pico se corta contra el canto de la tarjeta. Es la causa
   * de que estas chispas se vieran aplastadas.
   *
   * Se reserva un 18% del recorrido por arriba y por abajo. Cuando la serie es
   * PLANA el recorrido es cero y el porcentaje no daria margen ninguno —la
   * division dejaria la linea clavada en el borde—, asi que ahi se usa un margen
   * absoluto y la recta queda centrada, que es lo que corresponde: no hubo
   * variacion.
   */
  const valores = datos.map((d) => d.v);
  const min = Math.min(...valores, 0);
  const max = Math.max(...valores, 0);
  const recorrido = max - min;
  const aire = recorrido === 0 ? 1 : recorrido * 0.18;
  const dominio: [number, number] = [min - aire, max + aire];

  return (
    <article
      className={`caja relative flex min-w-0 flex-col overflow-hidden [container-type:inline-size] ${className}`}
    >
      {/*
        TÍTULO EN FRASE NORMAL, no en mayúsculas diminutas. En la referencia
        dice "Income Breakdown" a 17 px y peso medio, con el mismo tamaño que
        leerías en un documento. La versión anterior lo ponía en versalitas de
        10 px, que es la convención de un panel de control clásico y justo lo
        que la referencia evita.
      */}
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <h3
          className="min-w-0 leading-snug text-texto"
          style={{
            fontSize: "var(--apolo-titulo-tarjeta)",
            fontWeight: "var(--apolo-peso-titular)",
          }}
        >
          {etiqueta}
        </h3>
        {destino && onAbrir && (
          <button
            type="button"
            onClick={onAbrir}
            aria-label={destino}
            /*
              CAJA CON BORDE, como en la referencia: un cuadrado redondeado de
              32 px con el borde de la tarjeta. El área táctil se extiende a 44
              con `before`, sin agrandar el dibujo — un objetivo de 32 px
              incumple el mínimo y agrandar la caja rompería la proporción.
            */
            className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-control border border-borde text-texto-3 transition-colors before:absolute before:-inset-1.5 before:content-[''] hover:border-borde-fuerte hover:text-texto"
          >
            <Icono nombre="flecha" tam={13} />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-x-3 gap-y-1 px-5 pt-3">
        {/*
          El cuerpo se acota con `clamp` al ANCHO DE LA TARJETA, no a la del
          viewport: en la rejilla bento conviven columnas de 1 y de 3, y un
          tamaño fijo cortaba "USD 122.326" en las estrechas. `cqi` mide el
          contenedor, para lo cual la tarjeta declara `container-type`.
        */}
        <p
          className={`leading-[1.05] tracking-[-0.03em] tabular-nums ${
            listo ? "" : "animate-pulse opacity-40"
          }`}
          style={{
            fontWeight: "var(--apolo-peso-cifra)",
            fontSize: heroe
              ? "clamp(1.75rem, 9cqi, 3rem)"
              : "clamp(1.35rem, 11cqi, 2rem)",
          }}
        >
          {valor}
        </p>
        {variacion && <ChipVariacion {...variacion} />}
      </div>

      {pie && <p className="px-5 pt-1.5 text-xs leading-snug text-texto-3">{pie}</p>}

      {children && <div className="px-5 pt-3">{children}</div>}

      {/*
        La curva se sangra hasta los bordes y va al fondo. `mt-auto` la empuja
        abajo para que todas las tarjetas de una fila terminen igual aunque su
        texto ocupe distinto.
      */}
      {hayCurva && (
        /*
          LA TARJETA HÉROE OCUPA DOS FILAS, y con una altura fija de 80 px el
          gráfico quedaba como un hilo al fondo de un rectángulo casi vacío. Ahí
          la curva crece con la tarjeta; en las normales se queda fija, porque
          son bajas y estirarla se comería el pie.
        */
        <div
          className={`mt-auto w-full pt-3 ${heroe ? "min-h-[7rem] flex-1" : "h-20"}`}
          aria-hidden="true"
        >
          <ResponsiveContainer width="100%" height="100%">
            {/* El margen superior deja pasar el grosor del trazo: a 0, la mitad
                del stroke del pico queda fuera del lienzo y se ve cortado. */}
            <AreaChart data={datos} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <YAxis hide domain={dominio} />
              <defs>
                <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={RELLENO[tono]} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={RELLENO[tono]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={RELLENO[tono]}
                strokeWidth={2}
                fill={`url(#${id})`}
                /* Sin animación de entrada: es fondo, y una curva que se
                   dibuja sola cada vez que cambia un filtro distrae de la
                   cifra, que es lo único que hay que leer aquí. */
                isAnimationActive={false}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </article>
  );
}

/**
 * Chip de variación.
 *
 * EL COLOR LO DECIDE `subirEsBueno`, NO EL SIGNO. Que la deuda de herramienta
 * suba un 12% es malo aunque el número sea positivo; pintarlo de verde porque
 * lleva un `+` delante sería informar al revés.
 *
 * La flecha acompaña siempre al color: quien no distingue rojo de verde tiene
 * que poder leerlo igual.
 */
function ChipVariacion({ pct, subirEsBueno, nota }: Variacion) {
  const subio = pct >= 0;
  const bueno = subio === subirEsBueno;
  const tono = bueno
    ? "bg-ok-tenue text-ok"
    : "bg-peligro-tenue text-peligro";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-pildora px-2 py-0.5 text-[11px] font-semibold tabular-nums ${tono}`}
    >
      <span aria-hidden="true">{subio ? "↑" : "↓"}</span>
      {Math.abs(pct).toFixed(1)}%
      {nota && <span className="font-normal opacity-80">{nota}</span>}
    </span>
  );
}
