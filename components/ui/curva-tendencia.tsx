"use client";

import { RADIO_CAPSULA } from "@/components/ui/graficas-panel";

import {
  Area,
  Bar,
  Cell,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Curva de tendencia con cápsulas de fondo.
 *
 * Copia el estilo de la referencia que fijó el cliente, pieza por pieza:
 *
 *   · CÁPSULAS. Una columna redondeada por punto, a toda la altura del área.
 *     Sustituyen a la rejilla: dan la referencia vertical sin cruzar el lienzo
 *     con líneas que compiten con el trazo.
 *   · CÁPSULA RESALTADA en el punto actual. Es lo que dice "hoy" sin necesidad
 *     de una leyenda que lo explique.
 *   · SÓLIDO HASTA HOY, DISCONTINUO DESPUÉS. La discontinuidad no es un adorno:
 *     es la convención que distingue lo medido de lo proyectado.
 *   · PUNTO CON PLOMADA al corte, con su valor encima.
 *   · EJE EN DOS LÍNEAS: rótulo arriba, número debajo.
 *
 * NO INVENTA PROYECCIÓN. `indiceCorte` es opcional, y cuando no se pasa toda la
 * curva es sólida y la plomada cae en el último punto real. Apolo no tiene hoy
 * datos de pronóstico, y dibujar un tramo discontinuo sin ellos sería fabricar
 * una previsión financiera con forma de gráfico — que es peor que no tenerla,
 * porque parece un dato.
 */

export interface PuntoTendencia {
  /** Rótulo principal del eje: "Wed", "mar.", "Sem 12". */
  etiqueta: string;
  /** Segunda línea del eje: el día, el año, lo que acompañe. Opcional. */
  sub?: string;
  /** Un valor por clave de serie. Con una sola serie, una sola clave. */
  [clave: string]: string | number | null | undefined;
}

/**
 * La fila que consume Recharts. `etiqueta` y `sub` van declarados aparte de las
 * series porque el eje los necesita con forma conocida: con un `Record` suelto,
 * el tick no puede garantizar que exista `etiqueta`.
 */
interface FilaTendencia {
  etiqueta: string;
  sub?: string;
  capsula: number;
  [clave: string]: string | number | null | undefined;
}

export interface SerieTendencia {
  clave: string;
  nombre: string;
  color: string;
}

export function CurvaTendencia({
  datos,
  series,
  indiceCorte,
  formato,
  alto = 240,
}: {
  datos: PuntoTendencia[];
  series: SerieTendencia[];
  /**
   * Último índice con dato REAL. A partir de aquí el trazo va discontinuo.
   * Sin este parámetro no hay proyección y todo es sólido.
   */
  indiceCorte?: number;
  formato: (v: number) => string;
  alto?: number;
}) {
  if (datos.length < 2 || series.length === 0) return null;

  const corte = indiceCorte ?? datos.length - 1;
  /*
   * EL RELLENO SOLO LO LLEVA LA PRIMERA SERIE. Con dos áreas superpuestas el
   * color de la zona común no es el de ninguna de las dos y deja de poder
   * leerse; en la referencia hay una sola curva y una sola mancha.
   */
  const principal = series[0];
  const id = `tend-${principal.clave.replace(/\W/g, "")}`;

  /*
   * Se parte la serie en dos columnas en vez de pintar una y taparla.
   *
   * `real` lleva null después del corte y `proyectado` lleva null antes, así que
   * Recharts dibuja dos trazos distintos sobre la misma escala. El punto del
   * corte se REPITE en las dos: sin él, entre lo sólido y lo discontinuo
   * quedaría un hueco del ancho de un tramo.
   */
  const filas = datos.map((d, i) => {
    const fila: FilaTendencia = {
      etiqueta: d.etiqueta,
      sub: d.sub,
      // Valor constante para las cápsulas: ocupan siempre toda la altura.
      capsula: 1,
    };
    for (const s of series) {
      const v = typeof d[s.clave] === "number" ? (d[s.clave] as number) : null;
      fila[`${s.clave}__real`] = i <= corte ? v : null;
      fila[`${s.clave}__proy`] = i >= corte ? v : null;
    }
    return fila;
  });

  const hayProyeccion = corte < datos.length - 1;

  return (
    <ResponsiveContainer width="100%" height={alto}>
      <ComposedChart
        data={filas}
        /* Margen derecho generoso: la etiqueta del punto de corte vive en el
           último tramo y con 8px se recortaba contra el canto de la tarjeta. */
        margin={{ top: 28, right: 34, bottom: 4, left: 8 }}
        /*
          ANCHO DE CÁPSULA RELATIVO, no fijo.
          Con `barSize={38}` y seis cortes repartidos en mil píxeles, las
          cápsulas quedaban como postes sueltos en medio del vacío. En la
          referencia casi llenan el ancho y el hueco entre ellas es estrecho.
          `barCategoryGap` reserva ese hueco en porcentaje, así que la cápsula
          crece con el espacio disponible y el ritmo se conserva con seis puntos
          o con sesenta.
        */
        barCategoryGap="14%"
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={principal.color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={principal.color} stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Escala propia de las cápsulas, oculta: su altura no es un dato. */}
        <YAxis axisLine={false} tickLine={false} yAxisId="capsulas" domain={[0, 1]} hide />
        <YAxis axisLine={false} tickLine={false}
          yAxisId="valor"
          hide
          /* Aire arriba y abajo para que el pico no se corte contra el canto y
             el valle no se pegue al eje. */
          domain={[
            (min: number) => min - (Math.abs(min) || 1) * 0.15,
            (max: number) => max + (Math.abs(max) || 1) * 0.15,
          ]}
        />

        <Bar
          yAxisId="capsulas"
          dataKey="capsula"
          radius={RADIO_CAPSULA} minPointSize={6}
          isAnimationActive={false}
        >
          {filas.map((_, i) => (
            <Cell
              key={i}
              fill={i === corte ? "var(--marca-tenue)" : "var(--superficie-2)"}
            />
          ))}
        </Bar>

        <Area
          yAxisId="valor"
          type="monotone"
          dataKey={`${principal.clave}__real`}
          stroke="none"
          fill={`url(#${id})`}
          isAnimationActive={false}
          connectNulls={false}
        />

        {/* La plomada: baja del punto de corte hasta el eje y ancla la lectura. */}
        <ReferenceLine
          yAxisId="capsulas"
          x={filas[corte].etiqueta}
          stroke={principal.color}
          strokeWidth={1.5}
        />

        {/*
          EL PUNTO DEL CORTE, con su valor encima.
          Es lo que ancla la lectura: sin él, la plomada llega a una curva y no
          se sabe a qué altura la corta. Va solo en la serie principal — un
          punto por cada línea convertiría el corte en un racimo ilegible.
        */}
        <ReferenceDot
          yAxisId="valor"
          x={filas[corte].etiqueta}
          y={Number(filas[corte][`${principal.clave}__real`]) || 0}
          r={4}
          fill={principal.color}
          stroke="var(--superficie)"
          strokeWidth={2}
          label={{
            value: formato(Number(filas[corte][`${principal.clave}__real`]) || 0),
            position: "top",
            offset: 12,
            fill: "var(--texto)",
            fontSize: 12,
            fontWeight: 600,
          }}
        />

        {series.map((s) => (
          <Line
            key={`${s.clave}-real`}
            yAxisId="valor"
            type="monotone"
            dataKey={`${s.clave}__real`}
            name={s.nombre}
            stroke={s.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
            connectNulls={false}
          />
        ))}

        {hayProyeccion &&
          series.map((s) => (
            <Line
              key={`${s.clave}-proy`}
              yAxisId="valor"
              type="monotone"
              dataKey={`${s.clave}__proy`}
              name={s.nombre}
              stroke={s.color}
              strokeWidth={2}
              /* Discontinuo: la convención que separa lo medido de lo estimado. */
              strokeDasharray="5 4"
              dot={false}
              isAnimationActive={false}
              connectNulls={false}
            />
          ))}

        <XAxis
          dataKey="etiqueta"
          axisLine={false}
          tickLine={false}
          interval={0}
          height={38}
          tick={(props) => <TickDoble {...props} filas={filas} />}
        />

        <Tooltip
          cursor={false}
          contentStyle={{
            background: "var(--superficie)",
            border: "1px solid var(--borde-fuerte)",
            borderRadius: 10,
            fontSize: 12,
            color: "var(--texto)",
          }}
          /* El sufijo interno `__real` / `__proy` no debe salir a pantalla:
             se recupera el nombre humano de la serie. */
          formatter={(v, n) => [
            formato(Number(v) || 0),
            series.find((s) => String(n).startsWith(s.clave))?.nombre ?? String(n),
          ]}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/**
 * Tick de dos líneas: rótulo arriba, número debajo y más apagado.
 *
 * Va como componente y no como `tickFormatter` porque un formateador sólo puede
 * devolver una cadena, y aquí hacen falta dos `tspan` con estilos distintos.
 */
function TickDoble({
  x,
  y,
  payload,
  filas,
}: {
  /*
   * `x` e `y` llegan como `string | number` en los tipos de Recharts, aunque en
   * la práctica sean números. Se aceptan como vienen y se normalizan aquí, en
   * vez de forzar el tipo en la llamada: el `as` en el punto de uso esconde el
   * problema, esto lo resuelve.
   */
  x?: string | number;
  y?: string | number;
  payload?: { value?: string; index?: number };
  filas: FilaTendencia[];
}) {
  const px = typeof x === "number" ? x : Number(x) || 0;
  const py = typeof y === "number" ? y : Number(y) || 0;
  const fila = filas[payload?.index ?? -1];
  return (
    <g transform={`translate(${px},${py})`}>
      <text textAnchor="middle" fontSize={11} fill="var(--texto-2)" dy={14}>
        {payload?.value}
      </text>
      {fila?.sub && (
        <text textAnchor="middle" fontSize={10} fill="var(--texto-3)" dy={29}>
          {fila.sub}
        </text>
      )}
    </g>
  );
}
