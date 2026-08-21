"use client";

import { RADIO_BARRA } from "@/components/ui/graficas-panel";

import {
  Bar,
  BarChart,
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
  /*
   * DEVUELVE `var(--token)`, NO EL VALOR RESUELTO.
   *
   * Leerlo con `getComputedStyle` tenia dos fallos que salian en pantalla sin
   * dar ni un error: el hex se CONGELA en el render —al cambiar de tema las
   * graficas conservaban los colores del tema anterior— y en el servidor no hay
   * `window`, asi que el primer render devolvia "#888" para todo y dependia de
   * que la hidratacion lo corrigiera. Cuando no lo corregia, toda la grafica
   * salia gris.
   *
   * SVG acepta `var()` en `fill` y `stroke`, y las propiedades de un `style` en
   * linea tambien. Sin resolver, el color lo decide el navegador en cada
   * repintado y el cambio de tema es automatico.
   */
  return `var(${css})`;
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
          {/* Sin rejilla: quedan solo las lineas de datos. Las referencias de
              escala las dan los numeros del eje, que no dibujan nada. */}
          <XAxis axisLine={false} tickLine={false}
            type="number"
            allowDecimals={false}
            stroke={tono("--texto-3")}
            fontSize={11}
          />
          <YAxis axisLine={false} tickLine={false}
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
          <Bar dataKey="valor" radius={RADIO_BARRA} minPointSize={6} isAnimationActive={false}>
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
          {/* Sin rejilla: quedan solo las lineas de datos. Las referencias de
              escala las dan los numeros del eje, que no dibujan nada. */}
          <XAxis axisLine={false} tickLine={false} type="number" stroke={tono("--texto-3")} fontSize={11} />
          <YAxis axisLine={false} tickLine={false}
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
          <Bar dataKey="solicitado" fill={tono("--borde-fuerte")} radius={RADIO_BARRA} minPointSize={6} isAnimationActive={false} />
          <Bar dataKey="entregado" fill={tono("--bloque-luz")} radius={RADIO_BARRA} minPointSize={6} isAnimationActive={false} />
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
