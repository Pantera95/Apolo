"use client";

import { RADIO_BARRA } from "@/components/ui/graficas-panel";

import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

import { dineroCompacto, numero } from "@/lib/datos/indicadores";
import { usePreferencias } from "@/lib/preferencias";

/**
 * Gramática de gráficas.
 *
 * Cada forma responde a una pregunta distinta, y usar la equivocada no es un
 * detalle estético: cambia lo que el ojo puede leer.
 *
 *   COMPARAR magnitudes        → barras. El ojo compara longitudes con precisión.
 *   TIEMPO                     → líneas. La pendiente ES la información.
 *   RELACIÓN entre dos medidas → dispersión. Es la única que enseña correlación.
 *   DISTRIBUCIÓN               → histograma. Enseña la forma, no el promedio.
 *   PARTES DE UN TODO (≤3)     → torta. Con cuatro o más, imposible ordenarlas.
 *
 * El límite de tres en la torta no es arbitrario: el ojo compara ángulos mal, y
 * a partir de cuatro porciones hay que leer la leyenda para saber cuál es
 * mayor. Si son más, la función devuelve barras en vez de una torta ilegible.
 */

/**
 * Paleta de series, con tokens que CAMBIAN de valor entre temas.
 *
 * No se usan los `--bloque-*`: están fijados iguales en claro y oscuro para que
 * los bloques KPI se vean idénticos, y eso hace que `--bloque-marca` (#143a7a)
 * se funda con la superficie oscura (#1a3355) y la serie desaparezca.
 */
const PALETA = ["--serie-1", "--serie-2", "--serie-3", "--serie-4", "--peligro"];

export function tono(css: string): string {
  /*
   * DEVUELVE `var(--token)`, NO EL VALOR RESUELTO.
   *
   * Antes leia la variable con `getComputedStyle` y devolvia el hex. Eso tenia
   * dos fallos, y los dos salian en pantalla sin dar ni un error:
   *
   *   1. SE CONGELA. El hex se captura en el render y ahi se queda: al cambiar
   *      de tema las graficas conservaban los colores del tema anterior. Se vio
   *      midiendo — el DOM en `dark`, `--serie-1` valiendo #6f9bff, y los
   *      sectores pintados con los hex del tema claro.
   *   2. EN EL SERVIDOR NO HAY `window`, asi que el primer render devolvia
   *      "#888" para todo y dependia de que la hidratacion lo corrigiera.
   *
   * SVG acepta `var()` en `fill` y `stroke`, y las propiedades de un `style`
   * en linea tambien. Al pasar la variable sin resolver, el color lo decide el
   * navegador en cada repintado y el cambio de tema es automatico.
   */
  return `var(${css})`;
}

function ejeComun(idioma: "es" | "en", moneda: boolean) {
  return {
    stroke: tono("--grafico-eje"),
    fontSize: 11,
    tickFormatter: (v: unknown) =>
      moneda ? dineroCompacto(Number(v) || 0, idioma) : numero(Number(v) || 0, idioma),
  };
}

function tooltipComun() {
  return {
    background: tono("--superficie"),
    border: `1px solid ${tono("--borde-fuerte")}`,
    borderRadius: 10,
    color: tono("--texto"),
    fontSize: 12,
  };
}

function Marco({
  titulo,
  nota,
  children,
}: {
  titulo: string;
  nota?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-tarjeta border border-borde bg-superficie p-4">
      <h3 className="mono text-[11px] font-bold uppercase tracking-[0.12em] text-texto-3">
        {titulo}
      </h3>
      <div className="mt-3 min-w-0">{children}</div>
      {nota && <p className="mt-2 text-[11px] leading-relaxed text-texto-3">{nota}</p>}
    </section>
  );
}

// ---------------------------------------------------------------------------
// COMPARAR → barras
// ---------------------------------------------------------------------------

export interface Barra {
  etiqueta: string;
  valor: number;
  /** Se pinta como problema en vez de neutro. */
  alerta?: boolean;
}

export function BarrasComparativas({
  datos,
  titulo,
  nota,
  moneda = false,
}: {
  datos: Barra[];
  titulo: string;
  nota?: string;
  moneda?: boolean;
}) {
  const { idioma } = usePreferencias();
  if (datos.length === 0) return null;

  return (
    <Marco titulo={titulo} nota={nota}>
      <ResponsiveContainer width="100%" height={Math.max(180, datos.length * 40)}>
        <BarChart data={datos} layout="vertical" margin={{ left: 4, right: 20 }}>
          {/* Sin rejilla: quedan solo las lineas de datos. Las referencias de
              escala las dan los numeros del eje, que no dibujan nada. */}
          <XAxis axisLine={false} tickLine={false} type="number" {...ejeComun(idioma, moneda)} />
          <YAxis axisLine={false} tickLine={false}
            type="category"
            dataKey="etiqueta"
            width={130}
            stroke={tono("--grafico-eje")}
            fontSize={11}
          />
          <Tooltip
            cursor={{ fill: tono("--superficie-2") }}
            contentStyle={tooltipComun()}
            formatter={(v) =>
              moneda
                ? dineroCompacto(Number(v) || 0, idioma)
                : numero(Number(v) || 0, idioma)
            }
          />
          <Bar dataKey="valor" radius={RADIO_BARRA} minPointSize={6} isAnimationActive={false}>
            {datos.map((d, i) => (
              <Cell
                key={d.etiqueta}
                fill={d.alerta ? tono("--peligro") : tono(PALETA[i % PALETA.length])}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Marco>
  );
}

// ---------------------------------------------------------------------------
// RELACIÓN → dispersión
// ---------------------------------------------------------------------------

export interface PuntoDispersion {
  x: number;
  y: number;
  z?: number;
  etiqueta: string;
}

/**
 * Dispersión: la única forma que enseña si dos medidas se mueven juntas.
 *
 * En barras o líneas, la relación entre endeudamiento y rentabilidad no se ve;
 * aquí la nube dice de un vistazo si hay correlación, si no la hay, o si hay un
 * caso raro que se sale del grupo.
 */
export function Dispersion({
  datos,
  titulo,
  nota,
  ejeX,
  ejeY,
}: {
  datos: PuntoDispersion[];
  titulo: string;
  nota?: string;
  ejeX: string;
  ejeY: string;
}) {
  const { idioma } = usePreferencias();
  if (datos.length < 2) return null;

  return (
    <Marco titulo={titulo} nota={nota}>
      <ResponsiveContainer width="100%" height={240}>
        <ScatterChart margin={{ left: 4, right: 16, top: 8, bottom: 16 }}>
                    {/*
            SIN REJILLA NI EJES DIBUJADOS. Quedan solo las curvas de datos.

            Las reglas horizontales cruzaban la tarjeta de lado a lado con el
            mismo grosor que la propia serie, asi que competian con lo unico que
            hay que mirar. Los NUMEROS del eje se quedan —no son lineas, y sin
            ellos se pierde la magnitud—, pero sin su barra ni sus marquitas.
          */}
          <XAxis axisLine={false} tickLine={false}
            type="number"
            dataKey="x"
            name={ejeX}
            stroke={tono("--grafico-eje")}
            fontSize={11}
            tickFormatter={(v) => numero(Number(v) || 0, idioma)}
            label={{
              value: ejeX,
              position: "insideBottom",
              offset: -8,
              fill: tono("--grafico-eje"),
              fontSize: 11,
            }}
          />
          <YAxis axisLine={false} tickLine={false}
            type="number"
            dataKey="y"
            name={ejeY}
            stroke={tono("--grafico-eje")}
            fontSize={11}
            width={54}
            tickFormatter={(v) => numero(Number(v) || 0, idioma)}
          />
          {/* El tamaño del punto añade una tercera dimensión sin otro eje. */}
          <ZAxis type="number" dataKey="z" range={[60, 340]} />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            contentStyle={tooltipComun()}
            formatter={(v, n) => [numero(Number(v) || 0, idioma), String(n)]}
            labelFormatter={() => ""}
          />
          <Scatter
            data={datos}
            fill={tono("--serie-1")}
            // Contorno: sobre fondo oscuro dos puntos que se solapan sin borde
            // se leen como uno solo.
            stroke={tono("--superficie")}
            strokeWidth={1.5}
          >
            {datos.map((d, i) => (
              <Cell
                key={d.etiqueta}
                // El último punto es el cierre vigente: se destaca para que se
                // vea hacia dónde se movió la empresa.
                fill={i === datos.length - 1 ? tono("--serie-2") : tono("--serie-1")}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </Marco>
  );
}

// ---------------------------------------------------------------------------
// DISTRIBUCIÓN → histograma
// ---------------------------------------------------------------------------

export interface Tramo {
  etiqueta: string;
  cuenta: number;
  alerta?: boolean;
}

/**
 * Histograma: enseña la FORMA del reparto, no su promedio.
 *
 * Un promedio de cobertura de 20 días esconde que la mitad de los artículos
 * están a 3 y la otra mitad a 40. El histograma lo hace evidente, y por eso las
 * barras van pegadas: no son categorías sueltas, son tramos contiguos.
 */
export function Histograma({
  tramos,
  titulo,
  nota,
}: {
  tramos: Tramo[];
  titulo: string;
  nota?: string;
}) {
  const { idioma } = usePreferencias();
  if (tramos.every((t) => t.cuenta === 0)) return null;

  return (
    <Marco titulo={titulo} nota={nota}>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={tramos} margin={{ left: 4, right: 12, top: 6 }} barCategoryGap={2}>
                    {/*
            SIN REJILLA NI EJES DIBUJADOS. Quedan solo las curvas de datos.

            Las reglas horizontales cruzaban la tarjeta de lado a lado con el
            mismo grosor que la propia serie, asi que competian con lo unico que
            hay que mirar. Los NUMEROS del eje se quedan —no son lineas, y sin
            ellos se pierde la magnitud—, pero sin su barra ni sus marquitas.
          */}
          <XAxis axisLine={false} tickLine={false} dataKey="etiqueta" stroke={tono("--grafico-eje")} fontSize={11} />
          <YAxis axisLine={false} tickLine={false} allowDecimals={false} stroke={tono("--grafico-eje")} fontSize={11} width={34} />
          <Tooltip
            cursor={{ fill: tono("--superficie-2") }}
            contentStyle={tooltipComun()}
            formatter={(v) => numero(Number(v) || 0, idioma)}
          />
          <Bar dataKey="cuenta" radius={RADIO_BARRA} minPointSize={6} isAnimationActive={false}>
            {tramos.map((t) => (
              <Cell
                key={t.etiqueta}
                fill={t.alerta ? tono("--peligro") : tono("--serie-1")}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Marco>
  );
}

// ---------------------------------------------------------------------------
// PARTES DE UN TODO (≤3) → torta
// ---------------------------------------------------------------------------

export interface Porcion {
  etiqueta: string;
  valor: number;
}

/**
 * Torta, con un máximo estricto de tres porciones.
 *
 * Con cuatro o más el ojo no puede ordenarlas: comparamos longitudes bien y
 * ángulos mal. Por eso, si llegan más de tres, esta función DEVUELVE BARRAS en
 * vez de dibujar una torta ilegible — es preferible romper la expectativa de
 * forma que entregar una gráfica que no se puede leer.
 */
export const MAX_PORCIONES = 3;

export function Torta({
  porciones,
  titulo,
  nota,
  moneda = true,
}: {
  porciones: Porcion[];
  titulo: string;
  nota?: string;
  moneda?: boolean;
}) {
  const { idioma } = usePreferencias();
  const validas = porciones.filter((p) => p.valor > 0);

  if (validas.length === 0) return null;

  if (validas.length > MAX_PORCIONES) {
    return (
      <BarrasComparativas
        datos={validas.map((p) => ({ etiqueta: p.etiqueta, valor: p.valor }))}
        titulo={titulo}
        nota={nota}
        moneda={moneda}
      />
    );
  }

  const total = validas.reduce((s, p) => s + p.valor, 0);

  return (
    <Marco titulo={titulo} nota={nota}>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={validas}
            dataKey="valor"
            nameKey="etiqueta"
            innerRadius="46%"
            outerRadius="78%"
            paddingAngle={2}
            isAnimationActive={false}
            // El porcentaje va DENTRO: obligar a cruzar leyenda y porción para
            // saber cuánto vale cada una anula la ventaja de la forma.
            label={(e) => {
              const v = Number((e as { valor?: number }).valor) || 0;
              return total > 0 ? `${Math.round((v / total) * 100)}%` : "";
            }}
            labelLine={false}
          >
            {validas.map((p, i) => (
              <Cell key={p.etiqueta} fill={tono(PALETA[i % PALETA.length])} />
            ))}
          </Pie>
            /*
              EL TEXTO DE LA LEYENDA NO LLEVA EL COLOR DE LA SERIE.

              Recharts pinta cada etiqueta con el color de su serie, y esos
              colores estan calibrados como NO-TEXTO: se les exige 3:1 porque son
              trazos y rellenos. Como texto de 11px necesitan 4,5:1, y medido
              sobre la tarjeta oscura daban 3,57 / 2,82 / 2,85:1.

              El color sigue estando: lo lleva la muestra que Recharts dibuja al
              lado. Separar los papeles —color en la muestra, texto legible— es
              lo correcto, y ademas es lo unico que funciona sin desvirtuar la
              paleta de las series para poder usarla como tinta.
            */
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            iconType="square"
            formatter={(v) => (
              <span style={{ color: "var(--texto-2)" }}>{String(v)}</span>
            )}
          />
          <Tooltip
            contentStyle={tooltipComun()}
            formatter={(v) =>
              moneda
                ? dineroCompacto(Number(v) || 0, idioma)
                : numero(Number(v) || 0, idioma)
            }
          />
        </PieChart>
      </ResponsiveContainer>
    </Marco>
  );
}
