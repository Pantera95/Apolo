"use client";

import { useState } from "react";
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

import { ImportarFinanzas } from "@/components/premium/importar-finanzas";
import { Alerta } from "@/components/ui/alerta";
import { Insignia, type TonoInsignia } from "@/components/ui/insignia";
import { useEstadosFinancieros } from "@/lib/dashboard/estados-store";
import {
  calcularFinanzas,
  type Familia,
  type IndicadorFinanciero,
  type Origen,
  type Veredicto,
} from "@/lib/dashboard/finanzas";
import type { DatosPanel, Rebanada } from "@/lib/dashboard/tipos";
import { dinero, dineroCompacto, numero } from "@/lib/datos/indicadores";
import { usePreferencias } from "@/lib/preferencias";

const FAMILIAS: { id: Familia; clave: string }[] = [
  { id: "liquidez", clave: "fin.liquidez" },
  { id: "endeudamiento", clave: "fin.endeudamiento" },
  { id: "rentabilidad", clave: "fin.rentabilidad" },
  { id: "gestion", clave: "fin.gestion" },
];

const TONO_VEREDICTO: Record<Veredicto, TonoInsignia> = {
  bueno: "ok",
  aceptable: "advertencia",
  malo: "peligro",
  "sin-datos": "neutro",
};

/**
 * Situación financiera.
 *
 * Va ARRIBA del panel operativo porque quien abre este tablero decide con
 * dinero: si la empresa aguanta el corto plazo, cuánto debe y cuánto rinde. La
 * cola de trabajo importa después.
 *
 * Cada indicador declara su ORIGEN, y esa es la decisión central del bloque:
 *
 *   Del kardex   Apolo lo midió. Inventario valorizado, consumo a coste.
 *   Declarado    lo aportó el contador en un archivo.
 *   Mixto        fórmula estándar alimentada con las dos cosas.
 *
 * Mezclarlos sin distinguir haría pasar por medición lo que es la declaración
 * de un tercero, y en un tablero financiero eso no es un matiz.
 */
export function SeccionFinanciera({ datos }: { datos: DatosPanel }) {
  const { t, idioma } = usePreferencias();
  const guardado = useEstadosFinancieros();

  const indicadores = calcularFinanzas(guardado.estados, datos.finanzasDerivadas, idioma);
  const hayBalance = Object.keys(guardado.estados).length > 0;

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-extrabold tracking-[-0.02em] sm:text-2xl">
            {t("fin.titulo")}
          </h2>
          <p className="mt-1 text-sm text-texto-2">{t("fin.sub")}</p>
        </div>
        <ImportarFinanzas />
      </div>

      {!hayBalance && (
        <Alerta tono="info" titulo={t("fin.sinBalance")}>
          {t("fin.formatoDetalle")}
        </Alerta>
      )}

      {FAMILIAS.map((f) => {
        const grupo = indicadores.filter((i) => i.familia === f.id);
        return (
          <div key={f.id} className="min-w-0">
            <h3 className="mono mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-texto-3">
              {t(f.clave as never)}
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {grupo.map((i) => (
                <TarjetaFinanciera key={i.id} indicador={i} />
              ))}
            </div>
          </div>
        );
      })}

      <Desgloses datos={datos} />
    </section>
  );
}

function TarjetaFinanciera({ indicador }: { indicador: IndicadorFinanciero }) {
  const { t, idioma } = usePreferencias();
  const sinDatos = indicador.valor === null;

  return (
    <div
      className={`flex min-w-0 flex-col rounded-tarjeta border p-4 ${
        indicador.veredicto === "malo"
          ? "border-peligro/50 bg-peligro-tenue"
          : indicador.veredicto === "aceptable"
            ? "border-advertencia/50 bg-advertencia-tenue"
            : "border-borde-fuerte bg-superficie"
      }`}
      title={`${indicador.nombre}\n\n${indicador.formula}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
        <p className="min-w-0 text-[11px] font-bold uppercase tracking-[0.1em] text-texto-3">
          {indicador.nombre}
        </p>
        <EtiquetaOrigen origen={indicador.origen} />
      </div>

      <p className="cifra mt-3 min-w-0 break-words text-[clamp(1.2rem,2vw,1.7rem)] font-extrabold leading-[0.95] tracking-[-0.03em]">
        {sinDatos ? (
          <span className="text-sm font-bold text-texto-3">{t("fin.sinDatos")}</span>
        ) : (
          formatear(indicador.valor as number, indicador.unidad, idioma)
        )}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {!sinDatos && (
          <Insignia tono={TONO_VEREDICTO[indicador.veredicto]}>
            {t(`fin.${indicador.veredicto === "sin-datos" ? "sinDatos" : indicador.veredicto}` as never)}
          </Insignia>
        )}
      </div>

      <p className="mt-2 text-xs leading-relaxed text-texto-3">
        {sinDatos && indicador.falta.length > 0
          ? `${t("fin.falta")}: ${indicador.falta.join(", ")}`
          : indicador.lectura}
      </p>

      <p className="mono mt-2 text-[10px] leading-relaxed text-texto-3">
        {indicador.formula}
      </p>
    </div>
  );
}

/** Sin esta etiqueta, una cifra declarada pasaría por una medición del sistema. */
function EtiquetaOrigen({ origen }: { origen: Origen }) {
  const { t } = usePreferencias();
  const mapa: Record<Origen, { clave: string; cls: string }> = {
    derivado: { clave: "fin.derivado", cls: "text-luz" },
    declarado: { clave: "fin.declarado", cls: "text-texto-3" },
    mixto: { clave: "fin.mixto", cls: "text-info" },
  };
  const { clave, cls } = mapa[origen];
  return (
    <span className={`mono shrink-0 text-[9px] font-bold tracking-[0.1em] ${cls}`}>
      {t(clave as never).toUpperCase()}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Desgloses
// ---------------------------------------------------------------------------

type Dimension = "almacen" | "clase" | "obra";

/**
 * Desgloses del inventario.
 *
 * Es el drill-down: se elige la dimensión y la misma magnitud —dinero
 * inmovilizado— se reparte por almacén, por clase de artículo o por obra. Que
 * sean la misma magnitud vista desde tres ángulos es lo que permite comparar;
 * tres gráficas de tres cosas distintas no se comparan, solo se miran.
 */
function Desgloses({ datos }: { datos: DatosPanel }) {
  const { t, idioma } = usePreferencias();
  const [dim, setDim] = useState<Dimension>("almacen");

  const fuentes: Record<Dimension, { datos: Rebanada[]; clave: string }> = {
    almacen: { datos: datos.porAlmacen, clave: "fin.porAlmacen" },
    clase: { datos: datos.porClase, clave: "fin.porClase" },
    obra: { datos: datos.porObra, clave: "fin.porObra" },
  };

  const activa = fuentes[dim];
  const total = activa.datos.reduce((s, r) => s + r.valorUsd, 0);

  return (
    <section className="min-w-0 rounded-tarjeta border border-borde-fuerte bg-superficie p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-extrabold uppercase tracking-[0.06em]">
          {t("fin.desglose")}
        </h3>
        <div className="flex flex-wrap gap-1" role="tablist" aria-label={t("fin.desglose")}>
          {(Object.keys(fuentes) as Dimension[]).map((d) => (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={d === dim}
              onClick={() => setDim(d)}
              className={`mono flex min-h-11 items-center rounded-pildora px-3 text-[11px] font-bold uppercase tracking-[0.1em] transition-colors ${
                d === dim
                  ? "bg-marca-fondo text-white"
                  : "bg-superficie-2 text-texto-2 hover:text-texto"
              }`}
            >
              {t(fuentes[d].clave as never)}
            </button>
          ))}
        </div>
      </div>

      {activa.datos.length === 0 ? (
        <p className="mt-6 text-sm text-texto-3">{t("fin.sinDatos")}</p>
      ) : (
        <>
          <p className="cifra mt-4 text-2xl font-extrabold">{dinero(total, idioma)}</p>

          <ResponsiveContainer
            width="100%"
            height={Math.max(200, activa.datos.length * 44)}
            className="mt-4"
          >
            <BarChart data={activa.datos} layout="vertical" margin={{ left: 4, right: 24 }}>
              <CartesianGrid horizontal={false} stroke={tono("--borde")} />
              <XAxis
                type="number"
                stroke={tono("--texto-3")}
                fontSize={11}
                tickFormatter={(v) => dineroCompacto(Number(v) || 0, idioma)}
              />
              <YAxis
                type="category"
                dataKey="etiqueta"
                width={120}
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
                formatter={(v) => dinero(Number(v) || 0, idioma)}
              />
              <Bar dataKey="valorUsd" radius={[0, 6, 6, 0]}>
                {activa.datos.map((r, i) => (
                  <Cell
                    key={r.clave}
                    // El primero es el mayor: se destaca para que el orden de
                    // magnitud se lea sin recorrer la leyenda.
                    fill={i === 0 ? tono("--bloque-luz") : tono("--marca-fondo")}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* La tabla acompaña a la gráfica: una barra no da la cifra exacta ni
              se puede copiar a un correo. */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[22rem] text-left text-xs">
              <thead>
                <tr className="border-b border-borde text-texto-3">
                  <th className="py-2 font-bold">—</th>
                  <th className="py-2 text-right font-bold">USD</th>
                  <th className="py-2 text-right font-bold">%</th>
                  <th className="py-2 text-right font-bold">Und.</th>
                </tr>
              </thead>
              <tbody>
                {activa.datos.map((r) => (
                  <tr key={r.clave} className="border-b border-borde last:border-0">
                    <td className="py-2 font-bold">{r.etiqueta}</td>
                    <td className="cifra py-2 text-right">{dinero(r.valorUsd, idioma)}</td>
                    <td className="cifra py-2 text-right text-texto-3">
                      {total > 0 ? numero((r.valorUsd / total) * 100, idioma) : "0"}%
                    </td>
                    <td className="cifra py-2 text-right text-texto-3">
                      {numero(Math.round(r.unidades), idioma)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function tono(css: string): string {
  if (typeof window === "undefined") return "#888";
  return getComputedStyle(document.documentElement).getPropertyValue(css).trim() || "#888";
}

function formatear(
  valor: number,
  unidad: IndicadorFinanciero["unidad"],
  idioma: "es" | "en",
): string {
  switch (unidad) {
    case "usd":
      return dinero(valor, idioma);
    case "porcentaje":
      return `${numero(valor, idioma)}%`;
    case "dias":
      return `${numero(Math.round(valor), idioma)} d`;
    default:
      return numero(valor, idioma);
  }
}
