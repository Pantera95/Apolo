"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { EstadoVacio } from "@/components/ui/estado-vacio";
import type { Conteo } from "@/lib/dashboard/tipos";
import { numero } from "@/lib/datos/indicadores";
import { usePreferencias } from "@/lib/preferencias";
import type { ClaveTexto } from "@/lib/i18n/textos";

/**
 * Gráficas del panel.
 *
 * Todas son de barras. No es pereza: el encargo pedía embudos y donuts, pero
 * lo que se compara aquí son magnitudes de la misma naturaleza, y en eso la
 * barra gana a cualquier forma circular — el ojo compara longitudes bien y
 * ángulos mal. Un donut de "solicitudes por estado" obliga a leer la leyenda
 * para saber cuál es mayor.
 *
 * Los colores salen de los tokens del tema, no del tema por defecto de
 * Recharts, para que la gráfica siga siendo legible al cambiar de modo.
 */

function tono(css: string): string {
  if (typeof window === "undefined") return "#888";
  return getComputedStyle(document.documentElement).getPropertyValue(css).trim() || "#888";
}

/** Barras horizontales para distribuciones por estado. */
export function BarrasEstado({
  datos,
  titulo,
  vacio,
  destacar,
}: {
  datos: Conteo[];
  titulo: string;
  vacio: string;
  /** Estados que deben pintarse como problema en vez de neutro. */
  destacar?: string[];
}) {
  const { t, idioma } = usePreferencias();

  if (datos.length === 0) {
    return <Marco titulo={titulo}><EstadoVacio titulo={vacio} /></Marco>;
  }

  const filas = datos.map((d) => ({
    ...d,
    etiqueta: traducirEstado(d.clave, t),
  }));

  return (
    <Marco titulo={titulo}>
      <ResponsiveContainer width="100%" height={Math.max(180, filas.length * 42)}>
        <BarChart data={filas} layout="vertical" margin={{ left: 4, right: 24 }}>
          <CartesianGrid horizontal={false} stroke={tono("--borde")} />
          <XAxis
            type="number"
            allowDecimals={false}
            stroke={tono("--texto-3")}
            fontSize={11}
          />
          <YAxis
            type="category"
            dataKey="etiqueta"
            width={128}
            stroke={tono("--texto-3")}
            fontSize={11}
          />
          <Tooltip
            cursor={{ fill: tono("--superficie-2") }}
            contentStyle={{
              background: tono("--superficie"),
              border: `1px solid ${tono("--borde-fuerte")}`,
              borderRadius: 10,
              color: tono("--texto"),
              fontSize: 12,
            }}
            formatter={(v) => [numero(Number(v) || 0, idioma), ""]}
          />
          <Bar dataKey="valor" radius={[0, 6, 6, 0]}>
            {filas.map((f) => (
              <Cell
                key={f.clave}
                fill={
                  destacar?.includes(f.clave)
                    ? tono("--advertencia")
                    : tono("--marca-fondo")
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Marco>
  );
}

/**
 * Avance de material por obra.
 *
 * Dos barras por obra: solicitado y entregado. NO se llama "avance de obra"
 * porque Apolo no guarda cronograma y no puede saberlo; lo que sí sabe es qué
 * fracción del material pedido ya llegó, que es dato real y útil.
 */
export function BarrasAvance({
  datos,
  titulo,
  nota,
  vacio,
}: {
  datos: { obraId: string; codigo: string; solicitado: number; entregado: number }[];
  titulo: string;
  nota: string;
  vacio: string;
}) {
  const { idioma } = usePreferencias();

  if (datos.length === 0) {
    return <Marco titulo={titulo}><EstadoVacio titulo={vacio} /></Marco>;
  }

  return (
    <Marco titulo={titulo} nota={nota}>
      <ResponsiveContainer width="100%" height={Math.max(200, datos.length * 46)}>
        <BarChart data={datos} layout="vertical" margin={{ left: 4, right: 24 }}>
          <CartesianGrid horizontal={false} stroke={tono("--borde")} />
          <XAxis type="number" stroke={tono("--texto-3")} fontSize={11} />
          <YAxis
            type="category"
            dataKey="codigo"
            width={96}
            stroke={tono("--texto-3")}
            fontSize={11}
          />
          <Tooltip
            cursor={{ fill: tono("--superficie-2") }}
            contentStyle={{
              background: tono("--superficie"),
              border: `1px solid ${tono("--borde-fuerte")}`,
              borderRadius: 10,
              color: tono("--texto"),
              fontSize: 12,
            }}
            formatter={(v) => numero(Number(v) || 0, idioma)}
          />
          <Bar dataKey="solicitado" fill={tono("--borde-fuerte")} radius={[0, 6, 6, 0]} />
          <Bar dataKey="entregado" fill={tono("--bloque-luz")} radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Marco>
  );
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
    <section className="min-w-0 rounded-tarjeta border border-borde-fuerte bg-superficie p-4">
      <h2 className="text-sm font-extrabold uppercase tracking-[0.06em]">{titulo}</h2>
      {nota && <p className="mt-1 text-xs leading-relaxed text-texto-3">{nota}</p>}
      <div className="mt-4 min-w-0">{children}</div>
    </section>
  );
}

/**
 * Los estados del dominio ya están traducidos en el diccionario de la app.
 *
 * Se prueban los dos prefijos porque solicitudes y despachos tienen catálogos
 * distintos con nombres que se solapan ("en_preparacion" existe en ambos). `t`
 * devuelve `undefined` para una clave que no existe, no la clave, así que la
 * comprobación es contra undefined y no contra el texto.
 */
function traducirEstado(clave: string, t: (k: ClaveTexto) => string): string {
  const comoSolicitud = t(`estado.${clave}` as ClaveTexto) as string | undefined;
  if (comoSolicitud) return comoSolicitud;
  const comoDespacho = t(`des.${clave}` as ClaveTexto) as string | undefined;
  if (comoDespacho) return comoDespacho;
  return clave.replace(/_/g, " ");
}
