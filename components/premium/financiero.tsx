"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ImportarFinanzas } from "@/components/premium/importar-finanzas";
import { Alerta } from "@/components/ui/alerta";
import { Insignia, type TonoInsignia } from "@/components/ui/insignia";
import { useEstadosFinancieros } from "@/lib/dashboard/estados-store";
import type {
  Familia,
  IndicadorFinanciero,
  Origen,
  Veredicto,
} from "@/lib/dashboard/finanzas";
import {
  BarrasComparativas,
  Dispersion,
  Histograma,
  Torta,
} from "@/components/premium/graficas-bi";
import {
  aplicarFiltros,
  indicadoresConSerie,
  recortarSerie,
  type PuntoIndicador,
} from "@/lib/dashboard/serie-finanzas";
import type { DatosPanel, Filtros, Rebanada } from "@/lib/dashboard/tipos";
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

function tono(css: string): string {
  if (typeof window === "undefined") return "#888";
  return getComputedStyle(document.documentElement).getPropertyValue(css).trim() || "#888";
}

/**
 * Situación financiera.
 *
 * Va ARRIBA del panel operativo porque quien abre este tablero decide con
 * dinero: si la empresa aguanta el corto plazo, cuánto debe y cuánto rinde.
 *
 * CADA indicador lleva su gráfica. Un ratio suelto no dice nada —un ROE del 8%
 * puede ser una recuperación o un desplome, según de dónde venga—, y la
 * tendencia es justo lo que convierte el número en una decisión.
 *
 * Cada punto de cada gráfica lo calcula la MISMA fórmula pura que el valor
 * actual, aplicada al corte de ese mes. En el demo lo único ficticio son los
 * insumos del balance, y la pantalla lo rotula.
 */
export function SeccionFinanciera({
  datos,
  filtros,
  totalObras,
  totalAlmacenes,
}: {
  datos: DatosPanel;
  filtros: Filtros;
  totalObras: number;
  totalAlmacenes: number;
}) {
  const { t, idioma } = usePreferencias();
  const guardado = useEstadosFinancieros();

  /**
   * Los TRES filtros mueven las cifras:
   * el periodo recorta cuántos cierres se muestran, y la obra y el almacén
   * prorratean los flujos y las existencias por su participación.
   */
  const cortes = useMemo(() => {
    const filtrado = aplicarFiltros(
      guardado.historial,
      filtros,
      totalObras,
      totalAlmacenes,
    );
    return recortarSerie(filtrado, filtros.periodo);
  }, [guardado.historial, filtros, totalObras, totalAlmacenes]);

  const { indicadores, series } = useMemo(
    () => indicadoresConSerie(cortes, datos.finanzasDerivadas, idioma),
    [cortes, datos.finanzasDerivadas, idioma],
  );

  const hayBalance = guardado.historial.length > 0;

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-extrabold tracking-[-0.02em] sm:text-2xl">
            {t("fin.titulo")}
          </h2>
          <p className="mt-1 text-sm text-texto-2">
            {t("fin.sub")}
            {hayBalance && ` · ${cortes.length} ${idioma === "es" ? "cortes" : "periods"}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {guardado.demo && <Insignia tono="advertencia">{t("demo.ficticios")}</Insignia>}
          <ImportarFinanzas />
        </div>
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
                <TarjetaFinanciera
                  key={i.id}
                  indicador={i}
                  serie={series.get(i.id) ?? []}
                />
              ))}
            </div>
            <div className="mt-3">
              <GraficaFamilia familia={f.id} indicadores={grupo} series={series} />
            </div>
          </div>
        );
      })}

      <BloqueBI indicadores={indicadores} series={series} datos={datos} />

      <Desgloses datos={datos} />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Bloque BI: cada pregunta con su forma
// ---------------------------------------------------------------------------

/**
 * Las cuatro lecturas que no da una línea de tiempo.
 *
 * Cada gráfica responde a una pregunta distinta y usa la forma que le
 * corresponde. Repetir líneas para todo desperdicia tres de las cuatro.
 */
function BloqueBI({
  indicadores,
  series,
  datos,
}: {
  indicadores: IndicadorFinanciero[];
  series: Map<string, PuntoIndicador[]>;
  datos: DatosPanel;
}) {
  const { t, idioma } = usePreferencias();

  const valor = (id: string) => indicadores.find((i) => i.id === id)?.valor ?? null;
  const serie = (id: string) => (series.get(id) ?? []).filter((p) => p.valor !== null);

  // COMPARAR: los porcentajes de las cuatro familias, en la misma escala.
  const comparables = indicadores
    .filter((i) => i.unidad === "porcentaje" && i.valor !== null)
    .map((i) => ({
      etiqueta: i.nombre,
      valor: i.valor as number,
      alerta: i.veredicto === "malo",
    }));

  // RELACIÓN: endeudamiento contra rentabilidad, corte a corte. Un punto por
  // mes: es la nube la que dice si más deuda vino con más o menos retorno.
  const end = serie("endeudamiento_total");
  const rent = serie("roe");
  const dispersion = end
    .map((p, i) => ({
      x: p.valor as number,
      y: (rent[i]?.valor as number) ?? null,
      z: Math.abs((valor("valor_inventario") ?? 1) / 1000),
      etiqueta: p.etiqueta,
    }))
    .filter((p): p is { x: number; y: number; z: number; etiqueta: string } => p.y !== null);

  // DISTRIBUCIÓN: cómo se reparte la cobertura de los artículos críticos. El
  // promedio esconde que la mitad esté a tres días.
  const tramos = [
    { etiqueta: "0-2 d", cuenta: 0, alerta: true },
    { etiqueta: "3-6 d", cuenta: 0, alerta: true },
    { etiqueta: "7-14 d", cuenta: 0 },
    { etiqueta: "15-30 d", cuenta: 0 },
    { etiqueta: "+30 d", cuenta: 0 },
  ];
  for (const a of datos.stockCritico) {
    const c = a.cobertura;
    if (c === null) continue;
    const i = c < 3 ? 0 : c < 7 ? 1 : c < 15 ? 2 : c < 31 ? 3 : 4;
    tramos[i].cuenta += 1;
  }

  // PARTES DE UN TODO: la estructura del balance son exactamente TRES bloques,
  // que es el máximo que una torta puede mostrar sin volverse ilegible.
  const estructura = [
    { etiqueta: t("fin.pasivoCorto"), valor: valor("endeudamiento_corto") ?? 0 },
    { etiqueta: t("fin.pasivoLargo"), valor: (valor("endeudamiento_largo") ?? 0) * 100 },
    { etiqueta: t("fin.patrimonio"), valor: 100 },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <BarrasComparativas
        datos={comparables}
        titulo={t("bi.comparar")}
        nota={t("bi.compararNota")}
      />
      <Dispersion
        datos={dispersion}
        titulo={t("bi.relacion")}
        nota={t("bi.relacionNota")}
        ejeX={idioma === "es" ? "Endeudamiento %" : "Debt ratio %"}
        ejeY="ROE %"
      />
      <Histograma
        tramos={tramos}
        titulo={t("bi.distribucion")}
        nota={t("bi.distribucionNota")}
      />
      <Torta
        porciones={estructura}
        titulo={t("bi.estructura")}
        nota={t("bi.estructuraNota")}
        moneda={false}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tarjeta con sparkline
// ---------------------------------------------------------------------------

function TarjetaFinanciera({
  indicador,
  serie,
}: {
  indicador: IndicadorFinanciero;
  serie: PuntoIndicador[];
}) {
  const { t, idioma } = usePreferencias();
  const sinDatos = indicador.valor === null;

  const puntos = serie.filter((p) => p.valor !== null);
  const primero = puntos[0]?.valor ?? null;
  const ultimo = puntos[puntos.length - 1]?.valor ?? null;
  // La dirección se lee del extremo al extremo, no del último salto: un mes
  // flojo dentro de una subida sostenida no es un cambio de tendencia.
  const subiendo = primero !== null && ultimo !== null && ultimo >= primero;

  const colorLinea = subiendo ? tono("--serie-alza") : tono("--serie-baja");

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

      {/*
        Minigráfica de COLUMNAS, no de línea.

        Los cierres mensuales son valores discretos: comparar seis meses entre
        sí es comparar magnitudes, y en eso la columna gana a la línea. Además,
        una línea de 2px sobre fondo oscuro casi no se ve, mientras que una
        columna tiene superficie y se lee de un vistazo.

        La línea se reserva para "Evolución del periodo", que es donde la
        pendiente sí es la información.

        La última columna va destacada: es el cierre vigente, el que importa.
      */}
      {puntos.length > 1 && (
        <div className="mt-2 h-12 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={puntos} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
              <Tooltip
                cursor={{ fill: tono("--superficie-2") }}
                contentStyle={{
                  background: tono("--superficie"),
                  border: `1px solid ${tono("--borde-fuerte")}`,
                  borderRadius: 8,
                  color: tono("--texto"),
                  fontSize: 11,
                }}
                formatter={(v) => formatear(Number(v) || 0, indicador.unidad, idioma)}
                labelFormatter={(l) => String(l)}
              />
              <Bar dataKey="valor" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                {puntos.map((_, i) => (
                  <Cell
                    key={i}
                    fill={i === puntos.length - 1 ? colorLinea : tono("--grafico-rejilla")}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {!sinDatos && (
          <Insignia tono={TONO_VEREDICTO[indicador.veredicto]}>
            {t(
              `fin.${indicador.veredicto === "sin-datos" ? "sinDatos" : indicador.veredicto}` as never,
            )}
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
// Gráfica comparada por familia
// ---------------------------------------------------------------------------

/**
 * Una gráfica por familia, con todos sus indicadores superpuestos.
 *
 * Solo se superponen los que comparten unidad. Meter el fondo de maniobra
 * —en dólares— en el mismo eje que la razón corriente —una razón entre 0 y 3—
 * aplastaría la segunda contra el suelo y la gráfica no se podría leer.
 */
function GraficaFamilia({
  familia,
  indicadores,
  series,
}: {
  familia: Familia;
  indicadores: IndicadorFinanciero[];
  series: Map<string, PuntoIndicador[]>;
}) {
  const { t, idioma } = usePreferencias();

  // Se elige la unidad más representada: es la que deja más líneas en la misma
  // gráfica sin falsear la escala.
  const porUnidad = new Map<string, IndicadorFinanciero[]>();
  for (const i of indicadores) {
    if (i.valor === null) continue;
    porUnidad.set(i.unidad, [...(porUnidad.get(i.unidad) ?? []), i]);
  }
  const elegidos = [...porUnidad.values()].sort((a, b) => b.length - a.length)[0] ?? [];
  if (elegidos.length === 0) return null;

  const base = series.get(elegidos[0].id) ?? [];
  if (base.length < 2) return null;

  const filas = base.map((p, idx) => {
    const fila: Record<string, string | number | null> = { etiqueta: p.etiqueta };
    for (const i of elegidos) fila[i.id] = series.get(i.id)?.[idx]?.valor ?? null;
    return fila;
  });

  // Series con tokens propios: los `--bloque-*` están fijados iguales en los
  // dos temas y sobre fondo oscuro se funden con la superficie.
  const colores = [
    tono("--serie-1"),
    tono("--serie-2"),
    tono("--serie-3"),
    tono("--serie-4"),
  ];
  const unidad = elegidos[0].unidad;

  return (
    <div className="min-w-0 rounded-tarjeta border border-borde bg-superficie p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="mono text-[11px] font-bold uppercase tracking-[0.12em] text-texto-3">
          {t("fin.evolucion")}
        </p>
        <div className="flex flex-wrap gap-3">
          {elegidos.map((i, n) => (
            <span key={i.id} className="flex items-center gap-1.5 text-[11px] text-texto-2">
              <span
                aria-hidden="true"
                className="h-2 w-4 rounded-sm"
                style={{ background: colores[n % colores.length] }}
              />
              {i.nombre}
            </span>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={180} className="mt-3">
        <LineChart data={filas} margin={{ left: 4, right: 12, top: 6 }}>
          <CartesianGrid stroke={tono("--grafico-rejilla")} vertical={false} />
          <XAxis dataKey="etiqueta" stroke={tono("--grafico-eje")} fontSize={11} />
          <YAxis
            stroke={tono("--grafico-eje")}
            fontSize={11}
            width={54}
            tickFormatter={(v) =>
              unidad === "usd"
                ? dineroCompacto(Number(v) || 0, idioma)
                : numero(Number(v) || 0, idioma)
            }
          />
          <Tooltip
            contentStyle={{
              background: tono("--superficie"),
              border: `1px solid ${tono("--borde-fuerte")}`,
              borderRadius: 10,
              color: tono("--texto"),
              fontSize: 12,
            }}
            formatter={(v, n) => [
              formatear(Number(v) || 0, unidad, idioma),
              elegidos.find((i) => i.id === n)?.nombre ?? String(n),
            ]}
          />
          {elegidos.map((i, n) => (
            <Line
              key={i.id}
              type="monotone"
              dataKey={i.id}
              stroke={colores[n % colores.length]}
              strokeWidth={3}
              // Los puntos marcan cada cierre: sin ellos no se sabe si la línea
              // tiene seis cortes o sesenta.
              dot={{ r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              // Sin animación: con cuatro líneas redibujándose a cada cambio de
              // filtro, la animación se percibe como parpadeo.
              isAnimationActive={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-2 text-[11px] text-texto-3">{t(`fin.leyenda.${familia}` as never)}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Desgloses
// ---------------------------------------------------------------------------

type Dimension = "almacen" | "clase" | "obra";

/**
 * Desgloses del inventario.
 *
 * El drill-down: la misma magnitud —dinero inmovilizado— repartida por almacén,
 * clase u obra. Que sean la misma magnitud vista desde tres ángulos es lo que
 * permite compararlas; tres gráficas de tres cosas distintas no se comparan.
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
              <CartesianGrid horizontal={false} stroke={tono("--grafico-rejilla")} />
              <XAxis
                type="number"
                stroke={tono("--grafico-eje")}
                fontSize={11}
                tickFormatter={(v) => dineroCompacto(Number(v) || 0, idioma)}
              />
              <YAxis
                type="category"
                dataKey="etiqueta"
                width={120}
                stroke={tono("--grafico-eje")}
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
                    fill={i === 0 ? tono("--serie-2") : tono("--serie-1")}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

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
