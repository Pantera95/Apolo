"use client";

/**
 * Gráficos del panel.
 *
 * Todos consumen los tokens del sistema de diseño mediante var(--…), que
 * funciona igual dentro de un SVG. Así el gráfico cambia con el tema sin una
 * sola línea de lógica de color.
 *
 * Regla de contenedor: el padre SIEMPRE lleva min-w-0. Sin eso, un gráfico
 * responsivo dentro de una cuadrícula desborda en móvil porque los hijos de
 * grid y flex no encogen por debajo de su contenido.
 */

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ReactNode } from "react";

const EJE = {
  stroke: "var(--texto-3)",
  fontSize: 11,
  fontWeight: 700,
} as const;

function Recuadro({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-control border-2 border-borde bg-superficie px-3 py-2 shadow-apolo">
      {children}
    </div>
  );
}

/** Recharts admite valores escalares o de rango; aquí todos son escalares. */
interface DatoTooltip {
  name?: string | number;
  value?: string | number | readonly (string | number)[];
  color?: string;
}

function escalar(v: DatoTooltip["value"]): number {
  return Number(Array.isArray(v) ? v[0] : (v ?? 0));
}

function contenidoTooltip(
  formato: (v: number) => string,
  etiqueta?: (nombre: string) => string,
) {
  // Recharts 3 entrega el payload como readonly; la firma tiene que aceptarlo.
  function Contenido({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: readonly DatoTooltip[];
    label?: string | number;
  }) {
    if (!active || !payload?.length) return null;
    return (
      <Recuadro>
        {label !== undefined && (
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-texto-3">
            {String(label)}
          </p>
        )}
        {payload.map((p, i) => (
          <p key={i} className="flex items-center gap-2 text-xs font-bold">
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: p.color }}
            />
            <span className="text-texto-2">
              {etiqueta ? etiqueta(String(p.name ?? "")) : String(p.name ?? "")}
            </span>
            <span className="cifra ml-auto">{formato(escalar(p.value))}</span>
          </p>
        ))}
      </Recuadro>
    );
  }
  return Contenido;
}

// ---------------------------------------------------------------------------

export function GraficoMovimiento({
  datos,
  formato,
  formatoEje,
  etiquetas,
  alto = 220,
}: {
  datos: { fecha: string; entradas: number; salidas: number }[];
  formato: (v: number) => string;
  /** Compacto: en el eje no cabe la cifra completa. */
  formatoEje: (v: number) => string;
  etiquetas: { entradas: string; salidas: string };
  alto?: number;
}) {
  const traducir = (clave: string) =>
    clave === "entradas" ? etiquetas.entradas : etiquetas.salidas;

  return (
    <div className="min-w-0" style={{ height: alto }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={datos} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="gradEntradas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--luz)" stopOpacity={0.45} />
              <stop offset="100%" stopColor="var(--luz)" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gradSalidas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--marca)" stopOpacity={0.45} />
              <stop offset="100%" stopColor="var(--marca)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="fecha"
            tickLine={false}
            axisLine={false}
            tick={EJE}
            minTickGap={32}
            tickFormatter={(v: string) => v.slice(5)}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={EJE}
            width={44}
            tickFormatter={(v: number) => formatoEje(v)}
          />
          <Tooltip
            content={contenidoTooltip(formato, traducir)}
            cursor={{ stroke: "var(--borde-fuerte)", strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey="entradas"
            stroke="var(--luz)"
            strokeWidth={2}
            fill="url(#gradEntradas)"
          />
          <Area
            type="monotone"
            dataKey="salidas"
            stroke="var(--marca)"
            strokeWidth={2}
            fill="url(#gradSalidas)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function GraficoObras({
  datos,
  formato,
  alto = 200,
}: {
  datos: { codigo: string; valorUsd: number }[];
  formato: (v: number) => string;
  alto?: number;
}) {
  return (
    <div className="min-w-0" style={{ height: alto }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={datos}
          layout="vertical"
          margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
          barCategoryGap={10}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="codigo"
            tickLine={false}
            axisLine={false}
            tick={{ ...EJE, fontSize: 11 }}
            width={78}
          />
          <Tooltip
            content={contenidoTooltip(formato)}
            cursor={{ fill: "var(--superficie-2)" }}
          />
          <Bar dataKey="valorUsd" name="valorUsd" radius={[0, 6, 6, 0]}>
            {datos.map((_, i) => (
              <Cell
                key={i}
                fill={i === 0 ? "var(--bloque-marca)" : "var(--marca)"}
                fillOpacity={i === 0 ? 1 : 0.45}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------

const COLOR_CLASE: Record<string, string> = {
  consumible: "var(--marca)",
  retornable: "var(--luz)",
  certificado: "var(--info)",
};

export function GraficoClases({
  datos,
  formato,
  etiqueta,
  alto = 200,
}: {
  datos: { clase: string; valorUsd: number }[];
  formato: (v: number) => string;
  etiqueta: (clase: string) => string;
  alto?: number;
}) {
  return (
    <div className="min-w-0" style={{ height: alto }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip content={contenidoTooltip(formato, etiqueta)} />
          <Pie
            data={datos.map((d) => ({ ...d, name: d.clase }))}
            dataKey="valorUsd"
            nameKey="name"
            innerRadius="58%"
            outerRadius="88%"
            paddingAngle={3}
            stroke="var(--superficie)"
            strokeWidth={2}
          >
            {datos.map((d) => (
              <Cell key={d.clase} fill={COLOR_CLASE[d.clase] ?? "var(--texto-3)"} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------

/** Los tramos viejos se pintan con el color de alarma: el estado no es solo color, pero ayuda. */
const COLOR_TRAMO = [
  "var(--ok)",
  "var(--info)",
  "var(--advertencia)",
  "var(--peligro)",
];

export function GraficoAntiguedad({
  datos,
  formato,
  alto = 200,
}: {
  datos: { tramo: string; unidades: number }[];
  formato: (v: number) => string;
  alto?: number;
}) {
  return (
    <div className="min-w-0" style={{ height: alto }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <XAxis dataKey="tramo" tickLine={false} axisLine={false} tick={EJE} />
          <YAxis tickLine={false} axisLine={false} tick={EJE} width={38} />
          <Tooltip
            content={contenidoTooltip(formato)}
            cursor={{ fill: "var(--superficie-2)" }}
          />
          <Bar dataKey="unidades" name="unidades" radius={[6, 6, 0, 0]}>
            {datos.map((_, i) => (
              <Cell key={i} fill={COLOR_TRAMO[i] ?? "var(--texto-3)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
