"use client";

import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * RADIO DE BARRA — dos valores, y la diferencia NO es estética.
 *
 * `RADIO_BARRA` es para toda barra cuyo ALTO (o largo) sea el dato. Con radio
 * completo, una barra corta se redondea hasta convertirse en una lenteja y su
 * altura deja de poder compararse con las demás: el remate se come la
 * información. Se comprobó en pantalla, con las minigráficas de las tarjetas
 * financieras, después de haber unificado todo a 999 «por coherencia».
 *
 * `RADIO_CAPSULA` es solo para fondos de ALTURA FIJA —las cápsulas detrás de la
 * curva de tendencia—, donde no hay altura que leer y la píldora completa es
 * justo la forma de la referencia.
 *
 * Coherencia es un lenguaje común, no el mismo número para trabajos distintos.
 */
export const RADIO_BARRA = 6;
export const RADIO_CAPSULA = 999;

/**
 * Familia de gráficas del panel, replicada de la maqueta de referencia.
 *
 * Son siete formas distintas y cada una responde a una pregunta distinta. Esa es
 * la razón de que existan por separado en vez de resolverlo todo con barras:
 *
 *   MedidorSemicircular  ¿cuánto de un máximo conocido?  (ocupación, avance)
 *   MedidorAnillo        un valor único que preside      (indicador de cabecera)
 *   BarrasAgrupadas      comparar categorías entre sí    (mes contra mes)
 *   BarraProgreso        varios porcentajes en lista     (cumplimiento por obra)
 *   AreaDentada          movimiento diario, con su ruido (despachos por día)
 *   AreaSuave            una tendencia con un hito       (acumulado con corte)
 *   LineasConRejilla     dos magnitudes comparadas       (real contra plan)
 *
 * TODAS SIN ANIMACIÓN DE ENTRADA. Con varias en la misma pantalla, el conjunto
 * se dibuja solo cada vez que cambia un filtro y eso retrasa la lectura del
 * dato, que es lo único que se viene a hacer aquí. Además Recharts anima desde
 * radio o altura cero y, con la pestaña en segundo plano, esa animación no
 * avanza nunca: la gráfica se queda vacía sin dar ningún error.
 */

/* ── 1. Medidor semicircular ─────────────────────────────────────────────
 * Arco de 180° con degradado, el porcentaje dentro y el pie debajo.
 *
 * Va en SVG a mano y no en Recharts: un `PieChart` con ángulo inicial 180 sí
 * dibuja el arco, pero no admite un degradado que recorra el trazo ni un
 * remate redondeado, que son justo los dos rasgos de la referencia.
 */
export function MedidorSemicircular({
  pct,
  etiqueta,
  pie,
  desde = "var(--serie-4)",
  hasta = "var(--serie-1)",
}: {
  pct: number;
  etiqueta?: string;
  pie?: string;
  desde?: string;
  hasta?: string;
}) {
  const v = Math.max(0, Math.min(100, pct));
  const id = `med-${etiqueta?.replace(/\W/g, "") ?? "x"}-${Math.round(v)}`;
  // Semicírculo de radio 52 centrado en (60,60): la longitud del arco es π·r.
  const largo = Math.PI * 52;

  return (
    <figure className="flex min-w-0 flex-col items-center">
      <svg viewBox="0 0 120 72" className="w-full max-w-[160px]" role="img"
        aria-label={`${etiqueta ?? ""} ${v.toFixed(0)}%`}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={desde} />
            <stop offset="100%" stopColor={hasta} />
          </linearGradient>
        </defs>
        {/* Canal: el 100% siempre visible, para que un valor bajo no parezca
            un gráfico roto sino un valor bajo. */}
        <path
          d="M 8 60 A 52 52 0 0 1 112 60"
          fill="none"
          stroke="var(--superficie-2)"
          strokeWidth={12}
          strokeLinecap="round"
        />
        <path
          d="M 8 60 A 52 52 0 0 1 112 60"
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray={largo}
          strokeDashoffset={largo * (1 - v / 100)}
        />
        <text
          x="60" y="54" textAnchor="middle"
          className="fill-texto"
          style={{ fontSize: 22, fontWeight: 600 }}
        >
          {v.toFixed(0)}%
        </text>
      </svg>
      {pie && (
        <figcaption className="mt-2 text-center text-[11px] leading-snug text-texto-3">
          {pie}
        </figcaption>
      )}
    </figure>
  );
}

/* ── 2. Anillo completo ──────────────────────────────────────────────────
 * El indicador que preside una tarjeta: valor grande dentro del aro.
 */
export function MedidorAnillo({
  pct,
  valor,
  etiqueta,
  desde = "var(--serie-4)",
  hasta = "var(--serie-3)",
}: {
  pct: number;
  valor: string;
  etiqueta?: string;
  desde?: string;
  hasta?: string;
}) {
  const v = Math.max(0, Math.min(100, pct));
  const id = `anillo-${valor.replace(/\W/g, "")}`;
  const r = 46;
  const largo = 2 * Math.PI * r;

  return (
    <figure className="flex flex-col items-center">
      <svg viewBox="0 0 120 120" className="w-full max-w-[150px]" role="img"
        aria-label={`${etiqueta ?? ""} ${valor}`}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={desde} />
            <stop offset="100%" stopColor={hasta} />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r={r} fill="none"
          stroke="var(--superficie-2)" strokeWidth={10} />
        {/* -90° para que el arco arranque arriba y no a las tres en punto. */}
        <circle
          cx="60" cy="60" r={r} fill="none"
          stroke={`url(#${id})`} strokeWidth={10} strokeLinecap="round"
          strokeDasharray={largo}
          strokeDashoffset={largo * (1 - v / 100)}
          transform="rotate(-90 60 60)"
        />
        <text x="60" y="58" textAnchor="middle" className="fill-texto"
          style={{ fontSize: 20, fontWeight: 600 }}>
          {valor}
        </text>
        {etiqueta && (
          <text x="60" y="76" textAnchor="middle" className="fill-texto-3"
            style={{ fontSize: 8, letterSpacing: "0.08em" }}>
            {etiqueta.toUpperCase()}
          </text>
        )}
      </svg>
    </figure>
  );
}

/* ── 3. Barras agrupadas con deltas ──────────────────────────────────────
 * Grupos de barras finas y redondeadas, con una fila de variaciones debajo.
 */
export function BarrasAgrupadas({
  datos,
  series,
  deltas,
  alto = 150,
}: {
  datos: Record<string, string | number>[];
  series: { clave: string; nombre: string; color: string }[];
  /** La fila de pies: "Compras +385", "Ventas −78". */
  deltas?: { nombre: string; delta: number; formato: (n: number) => string }[];
  alto?: number;
}) {
  return (
    <div className="min-w-0">
      <ResponsiveContainer width="100%" height={alto}>
        <BarChart data={datos} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
          barGap={2} barCategoryGap="26%">
          {/*
            CON ETIQUETAS. La maqueta de referencia las oculta, y copiar eso fue
            un error: allí las barras son decorativas y aquí dicen un mes. Un
            grupo de barras sin saber a qué periodo pertenece no se puede leer,
            por bonito que quede.
          */}
          <XAxis
            dataKey="etiqueta"
            axisLine={false}
            tickLine={false}
            fontSize={10}
            stroke="var(--texto-3)"
          />
          <YAxis hide />
          <Tooltip
            cursor={{ fill: "var(--superficie-hover)" }}
            contentStyle={cajaTooltip}
          />
          {series.map((s) => (
            <Bar key={s.clave} dataKey={s.clave} name={s.nombre}
              fill={s.color} radius={RADIO_BARRA} minPointSize={6} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>

      {deltas && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {deltas.map((d) => (
            <span key={d.nombre}
              className="caja inline-flex items-center gap-1.5 rounded-pildora px-2.5 py-1 text-[11px]">
              <span className="text-texto-3">{d.nombre}</span>
              {/*
                El SIGNO va delante del número y además decide el color. Solo
                con color, quien no distingue rojo de verde no lee la dirección.
              */}
              <span className={d.delta >= 0 ? "text-ok" : "text-peligro"}>
                {d.delta >= 0 ? "+" : "−"}
                {d.formato(Math.abs(d.delta))}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── 4. Barra de progreso en píldora ─────────────────────────────────────── */
export function BarraProgreso({
  pct,
  etiqueta,
  desde = "var(--serie-3)",
  hasta = "var(--serie-1)",
}: {
  pct: number;
  etiqueta: string;
  desde?: string;
  hasta?: string;
}) {
  const v = Math.max(0, Math.min(100, pct));
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div
        className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-pildora bg-superficie-2"
        role="progressbar"
        aria-valuenow={Math.round(v)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={etiqueta}
      >
        <div
          className="h-full rounded-pildora"
          style={{
            width: `${v}%`,
            background: `linear-gradient(90deg, ${desde}, ${hasta})`,
          }}
        />
      </div>
      <span className="shrink-0 tabular-nums text-sm text-texto">
        {v.toFixed(0)}%
      </span>
    </div>
  );
}

/* ── 5. Área dentada ─────────────────────────────────────────────────────
 * Movimiento diario CON su ruido. `linear` y no `monotone`: suavizar aquí
 * escondería justo los picos que son el dato.
 */
export function AreaDentada({
  datos,
  clave = "valor",
  desde = "var(--serie-2)",
  hasta = "var(--serie-1)",
  alto = 110,
}: {
  datos: Record<string, string | number>[];
  clave?: string;
  desde?: string;
  hasta?: string;
  alto?: number;
}) {
  const id = `dent-${clave}-${desde.replace(/\W/g, "")}`;
  return (
    <ResponsiveContainer width="100%" height={alto}>
      <AreaChart data={datos} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={desde} stopOpacity={0.85} />
            <stop offset="100%" stopColor={hasta} stopOpacity={0.15} />
          </linearGradient>
        </defs>
        <XAxis axisLine={false} tickLine={false} dataKey="etiqueta" hide />
        <YAxis hide />
        <Tooltip cursor={false} contentStyle={cajaTooltip} />
        <Area type="linear" dataKey={clave} stroke={desde} strokeWidth={2}
          fill={`url(#${id})`} isAnimationActive={false} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ── 6. Área suave con hito ──────────────────────────────────────────────
 * Acumulado con una marca vertical punteada y su punto.
 */
export function AreaSuave({
  datos,
  clave = "valor",
  hito,
  formato,
  desde = "var(--serie-4)",
  hasta = "var(--serie-1)",
  alto = 160,
}: {
  datos: Record<string, string | number>[];
  clave?: string;
  /** Etiqueta del punto que se marca. Sin ella no se dibuja marca. */
  hito?: string;
  formato?: (n: number) => string;
  desde?: string;
  hasta?: string;
  alto?: number;
}) {
  const id = `suave-${clave}`;
  const fila = hito ? datos.find((d) => d.etiqueta === hito) : undefined;
  return (
    <ResponsiveContainer width="100%" height={alto}>
      <AreaChart data={datos} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={desde} stopOpacity={0.7} />
            <stop offset="100%" stopColor={hasta} stopOpacity={0.15} />
          </linearGradient>
        </defs>
        <XAxis dataKey="etiqueta" axisLine={false} tickLine={false}
          fontSize={10} stroke="var(--texto-3)" />
        <YAxis axisLine={false} tickLine={false} width={34}
          fontSize={10} stroke="var(--texto-3)" />
        <Tooltip cursor={false} contentStyle={cajaTooltip} />
        {hito && (
          <ReferenceLine x={hito} stroke="var(--texto-3)" strokeDasharray="3 3" />
        )}
        <Area type="monotone" dataKey={clave} stroke={hasta} strokeWidth={2}
          fill={`url(#${id})`} isAnimationActive={false} dot={false} />
        {fila && (
          <ReferenceDot x={String(fila.etiqueta)} y={Number(fila[clave]) || 0}
            r={4} fill={hasta} stroke="var(--superficie)" strokeWidth={2}
            label={formato ? {
              value: formato(Number(fila[clave]) || 0),
              position: "top", fill: "var(--texto)", fontSize: 11, fontWeight: 600,
            } : undefined}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ── 7. Líneas con rejilla de puntos ─────────────────────────────────────
 * Dos magnitudes comparadas: una sólida con marcas y otra discontinua.
 *
 * ES LA ÚNICA DE LA FAMILIA QUE LLEVA REJILLA, y es a propósito: aquí el valor
 * exacto importa —se compara contra un plan— y sin referencia horizontal solo
 * se leería la forma. En las demás la rejilla sobraba y se quitó.
 */
export function LineasConRejilla({
  datos,
  series,
  destacado,
  formato,
  alto = 170,
}: {
  datos: Record<string, string | number>[];
  series: { clave: string; nombre: string; color: string; discontinua?: boolean }[];
  /** Etiqueta del punto que se rotula con su valor. */
  destacado?: string;
  formato?: (n: number) => string;
  alto?: number;
}) {
  const principal = series[0];
  const fila = destacado ? datos.find((d) => d.etiqueta === destacado) : undefined;
  return (
    <ResponsiveContainer width="100%" height={alto}>
      <LineChart data={datos} margin={{ top: 22, right: 10, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--borde-fuerte)" strokeDasharray="2 4" />
        <XAxis dataKey="etiqueta" axisLine={false} tickLine={false}
          fontSize={10} stroke="var(--texto-3)" />
        <YAxis axisLine={false} tickLine={false} width={36}
          fontSize={10} stroke="var(--texto-3)" />
        <Tooltip cursor={false} contentStyle={cajaTooltip} />
        {series.map((s) => (
          <Line key={s.clave} type="monotone" dataKey={s.clave} name={s.nombre}
            stroke={s.color} strokeWidth={2}
            strokeDasharray={s.discontinua ? "5 4" : undefined}
            dot={s.discontinua ? false : { r: 3, strokeWidth: 0, fill: s.color }}
            activeDot={{ r: 5 }} isAnimationActive={false} />
        ))}
        {fila && principal && (
          <ReferenceDot x={String(fila.etiqueta)} y={Number(fila[principal.clave]) || 0}
            r={5} fill={principal.color} stroke="var(--superficie)" strokeWidth={2}
            label={{
              value: formato
                ? formato(Number(fila[principal.clave]) || 0)
                : String(fila[principal.clave]),
              position: "top", fill: "var(--texto)", fontSize: 12, fontWeight: 600,
            }}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Caja del tooltip, igual en toda la familia. */
const cajaTooltip = {
  background: "var(--superficie)",
  border: "1px solid var(--borde-fuerte)",
  borderRadius: 10,
  fontSize: 12,
  color: "var(--texto)",
} as const;

/** Envoltorio de tarjeta para cualquiera de las anteriores. */
export function TarjetaGrafica({
  titulo,
  valor,
  pie,
  children,
  className = "",
}: {
  titulo: string;
  valor?: string;
  pie?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`caja flex min-w-0 flex-col p-4 ${className}`}>
      <h3 className="text-[13px] text-texto-2">{titulo}</h3>
      {valor && (
        <p className="mt-1 text-xl tabular-nums text-texto">{valor}</p>
      )}
      <div className="mt-3 min-w-0 flex-1">{children}</div>
      {pie && <div className="mt-2 text-[11px] text-texto-3">{pie}</div>}
    </section>
  );
}
