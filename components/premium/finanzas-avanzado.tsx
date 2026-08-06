"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Insignia } from "@/components/ui/insignia";
import type { EstadosFinancieros } from "@/lib/dashboard/finanzas";
import { etiquetaCorte } from "@/lib/dashboard/serie-finanzas";
import { dinero, dineroCompacto, numero } from "@/lib/datos/indicadores";
import type { EstadoApolo } from "@/lib/db/almacen";
import { usePreferencias } from "@/lib/preferencias";

function tono(css: string): string {
  if (typeof window === "undefined") return "#888";
  return getComputedStyle(document.documentElement).getPropertyValue(css).trim() || "#888";
}

// ---------------------------------------------------------------------------
// Curva comparada
// ---------------------------------------------------------------------------

export interface SerieCurva {
  clave: string;
  nombre: string;
  color: string;
}

/**
 * Curva comparada de dos o más magnitudes en el tiempo.
 *
 * Curva suave (`monotone`) y no recta entre puntos: en una serie mensual la
 * interpolación suave se lee como una evolución, que es lo que es, mientras que
 * el zigzag recto sugiere saltos bruscos que no ocurrieron.
 *
 * `monotone` y no `natural`: la interpolación natural puede inventar un mínimo
 * por debajo del punto más bajo real, y en una gráfica de dinero eso significa
 * dibujar una pérdida que no existió.
 *
 * El punto va relleno en cada cierre. Sin marcas, una curva de seis meses y una
 * de sesenta se ven igual.
 */
export function CurvaComparada({
  filas,
  series,
  titulo,
  subtitulo,
  alto = 260,
  moneda = true,
}: {
  filas: Record<string, string | number | null>[];
  series: SerieCurva[];
  titulo: string;
  subtitulo?: string;
  alto?: number;
  moneda?: boolean;
}) {
  const { idioma } = usePreferencias();
  if (filas.length < 2) return null;

  return (
    <section className="min-w-0 rounded-tarjeta border border-borde-fuerte bg-superficie p-4">
      <h3 className="text-base font-extrabold tracking-[-0.01em]">{titulo}</h3>
      {subtitulo && <p className="mt-0.5 text-xs text-texto-3">{subtitulo}</p>}

      <ResponsiveContainer width="100%" height={alto} className="mt-4">
        <LineChart data={filas} margin={{ left: 4, right: 16, top: 10 }}>
          {/* Rejilla horizontal y punteada: la vertical compite con las curvas
              y no aporta nada cuando el eje X son meses. */}
          <CartesianGrid
            stroke={tono("--grafico-rejilla")}
            strokeDasharray="4 6"
            vertical={false}
          />
          <XAxis
            dataKey="etiqueta"
            stroke={tono("--grafico-eje")}
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke={tono("--grafico-eje")}
            fontSize={11}
            width={58}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) =>
              moneda
                ? dineroCompacto(Number(v) || 0, idioma)
                : numero(Number(v) || 0, idioma)
            }
          />
          <Tooltip
            cursor={{ stroke: tono("--grafico-eje"), strokeWidth: 1 }}
            contentStyle={{
              background: tono("--superficie"),
              border: `1px solid ${tono("--borde-fuerte")}`,
              borderRadius: 10,
              color: tono("--texto"),
              fontSize: 12,
              boxShadow: "0 6px 20px rgb(0 0 0 / .18)",
            }}
            labelStyle={{ fontWeight: 800, marginBottom: 4 }}
            formatter={(v, n) => [
              moneda ? dinero(Number(v) || 0, idioma) : numero(Number(v) || 0, idioma),
              series.find((s) => s.clave === n)?.nombre ?? String(n),
            ]}
          />
          <Legend
            verticalAlign="bottom"
            height={30}
            iconType="plainline"
            wrapperStyle={{ fontSize: 11, color: tono("--texto-2") }}
            formatter={(v) => series.find((s) => s.clave === v)?.nombre ?? String(v)}
          />
          {series.map((s) => (
            <Line
              key={s.clave}
              type="monotone"
              dataKey={s.clave}
              name={s.clave}
              stroke={s.color}
              strokeWidth={2.5}
              dot={{ r: 3.5, fill: s.color, strokeWidth: 0 }}
              activeDot={{ r: 6, strokeWidth: 2, stroke: tono("--superficie") }}
              isAnimationActive={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Tarjetas de cifra
// ---------------------------------------------------------------------------

export interface Cifra {
  etiqueta: string;
  valor: string;
  detalle: string;
  destacada?: boolean;
}

function FilaCifras({ cifras }: { cifras: Cifra[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {cifras.map((c) => (
        <div
          key={c.etiqueta}
          className={`min-w-0 rounded-control border p-3 ${
            c.destacada
              ? "border-advertencia/50 bg-advertencia-tenue"
              : "border-borde bg-superficie-2"
          }`}
        >
          <p className="text-[10px] font-bold uppercase leading-tight tracking-[0.08em] text-texto-3">
            {c.etiqueta}
          </p>
          <p className="cifra mt-1.5 break-words text-[clamp(1rem,1.6vw,1.35rem)] font-extrabold leading-none">
            {c.valor}
          </p>
          <p className="mt-1 text-[10px] leading-tight text-texto-3">{c.detalle}</p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Histórico de ventas y compras
// ---------------------------------------------------------------------------

/**
 * Histórico completo, SIN filtro de periodo.
 *
 * Es deliberado: "histórico" significa todo lo que hay, y recortarlo con el
 * selector lo convertiría en otra vista del mismo periodo que ya está arriba.
 * El rango real se imprime al pie para que nadie tenga que suponerlo.
 *
 * Las "compras" son el costo de ventas: es lo que la empresa gastó en material
 * para producir esas ventas. No se llama "compras" a la orden de compra emitida
 * —esa puede no haberse recibido— porque mezclaría comprometido con ejecutado.
 */
export function HistoricoVentasCompras({
  historial,
  demo,
}: {
  historial: EstadosFinancieros[];
  demo: boolean;
}) {
  const { t, idioma } = usePreferencias();
  if (historial.length < 2) return null;

  const filas = historial.map((ef) => ({
    etiqueta: etiquetaCorte(ef.corte, idioma),
    ventas: ef.ventasNetas ?? null,
    compras: ef.costoVentas ?? null,
    utilidad: ef.utilidadNeta ?? null,
  }));

  const suma = (k: "ventasNetas" | "costoVentas" | "utilidadNeta" | "utilidadBruta") =>
    historial.reduce((s, ef) => s + (ef[k] ?? 0), 0);

  const ventas = suma("ventasNetas");
  const compras = suma("costoVentas");
  const utilidad = suma("utilidadNeta");
  const bruta = suma("utilidadBruta");

  const desde = historial[0]?.corte;
  const hasta = historial[historial.length - 1]?.corte;
  const rango = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString(idioma === "es" ? "es-VE" : "en-US", {
      month: "short",
      year: "numeric",
    }) : "—";

  const cifras: Cifra[] = [
    {
      etiqueta: t("hist.ventas"),
      valor: dinero(ventas, idioma),
      detalle: `${rango(desde)} → ${rango(hasta)}`,
      destacada: true,
    },
    {
      etiqueta: t("hist.utilidad"),
      valor: dinero(utilidad, idioma),
      detalle: t("hist.utilidadDet"),
    },
    {
      etiqueta: t("hist.roi"),
      // ROI sobre el COSTO, no sobre las ventas: es cuánto devolvió cada dólar
      // invertido en material, que es la pregunta de un almacén.
      valor: compras > 0 ? `${numero((utilidad / compras) * 100, idioma)}%` : "—",
      detalle: t("hist.roiDet"),
    },
    {
      etiqueta: t("hist.margen"),
      valor: ventas > 0 ? `${numero((bruta / ventas) * 100, idioma)}%` : "—",
      detalle: t("hist.margenDet"),
    },
    {
      etiqueta: t("hist.compras"),
      valor: dinero(compras, idioma),
      detalle: t("hist.comprasDet"),
    },
    {
      etiqueta: t("hist.costo"),
      valor: dinero(compras, idioma),
      detalle: t("hist.costoDet"),
    },
  ];

  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-tarjeta border border-borde-fuerte bg-superficie p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-extrabold tracking-[-0.01em]">
            {t("hist.titulo")}
          </h3>
          <p className="mt-0.5 text-xs text-texto-3">{t("hist.sub")}</p>
        </div>
        <Insignia tono={demo ? "advertencia" : "ok"} punto>
          {historial.length} {t("hist.cierres")}
        </Insignia>
      </div>

      <FilaCifras cifras={cifras} />

      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={filas} margin={{ left: 4, right: 16, top: 8 }}>
          <CartesianGrid stroke={tono("--grafico-rejilla")} strokeDasharray="4 6" vertical={false} />
          <XAxis dataKey="etiqueta" stroke={tono("--grafico-eje")} fontSize={11} tickLine={false} axisLine={false} />
          <YAxis
            stroke={tono("--grafico-eje")}
            fontSize={11}
            width={58}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => dineroCompacto(Number(v) || 0, idioma)}
          />
          <Tooltip
            contentStyle={{
              background: tono("--superficie"),
              border: `1px solid ${tono("--borde-fuerte")}`,
              borderRadius: 10,
              color: tono("--texto"),
              fontSize: 12,
            }}
            formatter={(v, n) => [dinero(Number(v) || 0, idioma), etiquetaSerie(String(n), t)]}
          />
          <Legend
            verticalAlign="top"
            align="left"
            height={28}
            iconType="circle"
            wrapperStyle={{ fontSize: 11, color: tono("--texto-2") }}
            formatter={(v) => etiquetaSerie(String(v), t)}
          />
          <Line type="monotone" dataKey="ventas" stroke={tono("--serie-1")} strokeWidth={2.5} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="compras" stroke={tono("--serie-2")} strokeWidth={2.5} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="utilidad" stroke={tono("--serie-3")} strokeWidth={2.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>

      <p className="text-[11px] text-texto-3">
        {rango(desde)} – {rango(hasta)} · {historial.length} {t("hist.cierres")}
      </p>
    </section>
  );
}

function etiquetaSerie(clave: string, t: (k: never) => string): string {
  const mapa: Record<string, string> = {
    ventas: t("hist.serieVentas" as never),
    compras: t("hist.serieCompras" as never),
    utilidad: t("hist.serieUtilidad" as never),
  };
  return mapa[clave] ?? clave;
}

// ---------------------------------------------------------------------------
// Rentabilidad / ROI
// ---------------------------------------------------------------------------

/**
 * Rentabilidad del periodo, con desgloses.
 *
 * QUÉ ES REAL Y QUÉ ES DERIVADO — importa decirlo:
 *
 * El ranking de artículos sale del KARDEX: es el consumo valorizado real de
 * cada artículo, lo que de verdad salió del almacén. Sobre esa base se aplica
 * el margen DECLARADO del periodo para estimar el retorno.
 *
 * Es decir: el reparto entre artículos es medición; la tasa de margen es
 * declaración. No se inventa un margen distinto por artículo, porque Apolo no
 * sabe a qué precio se vendió cada uno — no factura.
 */
export function RentabilidadRoi({
  cortes,
  estado,
}: {
  cortes: EstadosFinancieros[];
  estado: EstadoApolo;
}) {
  const { t, idioma } = usePreferencias();
  if (cortes.length === 0) return null;

  const suma = (k: "ventasNetas" | "costoVentas" | "utilidadNeta" | "utilidadBruta") =>
    cortes.reduce((s, ef) => s + (ef[k] ?? 0), 0);

  const ventas = suma("ventasNetas");
  const compras = suma("costoVentas");
  const utilidad = suma("utilidadNeta");
  const bruta = suma("utilidadBruta");
  const tasaMargen = ventas > 0 ? bruta / ventas : 0;

  // Consumo valorizado por artículo: dato REAL del kardex.
  const articulos = new Map(estado.articulos.map((a) => [a.id, a]));
  const consumo = new Map<string, number>();
  for (const a of estado.inventario.asientos) {
    const esConsumo = a.tipo === "entrega" || (a.tipo === "ajuste" && a.motivo === "consumo_interno");
    if (!esConsumo) continue;
    const art = articulos.get(a.articuloId);
    if (!art) continue;
    const cant = Math.abs(a.delta.enObra || a.delta.fisico || 0);
    if (cant <= 0) continue;
    consumo.set(a.articuloId, (consumo.get(a.articuloId) ?? 0) + cant * art.costoPromedioUsd);
  }

  const top = [...consumo.entries()]
    .sort((x, y) => y[1] - x[1])
    .slice(0, 5)
    .map(([id, valor]) => ({
      nombre: articulos.get(id)?.descripcion ?? id,
      codigo: articulos.get(id)?.codigo ?? id,
      valor,
      retorno: tasaMargen > 0 && valor > 0 ? (valor * tasaMargen) / valor * 100 : null,
    }));

  const porClase = new Map<string, number>();
  for (const [id, valor] of consumo) {
    const clase = articulos.get(id)?.clase ?? "—";
    porClase.set(clase, (porClase.get(clase) ?? 0) + valor);
  }
  const totalClase = [...porClase.values()].reduce((s, v) => s + v, 0);

  const cifras: Cifra[] = [
    {
      etiqueta: t("roi.periodo"),
      valor: compras > 0 ? `${numero((utilidad / compras) * 100, idioma)}%` : "—",
      detalle: t("roi.periodoDet"),
      destacada: true,
    },
    {
      etiqueta: t("roi.utilidad"),
      valor: dinero(utilidad, idioma),
      detalle: `${cortes.length} ${t("hist.cierres")}`,
    },
    {
      etiqueta: t("hist.margen"),
      valor: ventas > 0 ? `${numero(tasaMargen * 100, idioma)}%` : "—",
      detalle: t("hist.margenDet"),
    },
    {
      etiqueta: t("roi.ventasCompras"),
      valor: compras > 0 ? `${numero(ventas / compras, idioma)}×` : "—",
      detalle: `${dineroCompacto(ventas, idioma)} / ${dineroCompacto(compras, idioma)}`,
    },
  ];

  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-tarjeta border border-borde-fuerte bg-superficie p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-extrabold tracking-[-0.01em]">{t("roi.titulo")}</h3>
          <p className="mt-0.5 text-xs text-texto-3">{t("roi.sub")}</p>
        </div>
        <Insignia tono="marca">{t("roi.clave")}</Insignia>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cifras.map((c) => (
          <div
            key={c.etiqueta}
            className={`min-w-0 rounded-control border p-3 ${
              c.destacada
                ? "border-advertencia/50 bg-advertencia-tenue"
                : "border-borde bg-superficie-2"
            }`}
          >
            <p className="text-[10px] font-bold uppercase leading-tight tracking-[0.08em] text-texto-3">
              {c.etiqueta}
            </p>
            <p className="cifra mt-1.5 break-words text-[clamp(1.05rem,1.8vw,1.5rem)] font-extrabold leading-none">
              {c.valor}
            </p>
            <p className="mt-1 text-[10px] leading-tight text-texto-3">{c.detalle}</p>
          </div>
        ))}
      </div>

      {top.length > 0 && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="min-w-0">
            <p className="mono mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-texto-3">
              {t("roi.topArticulos")}
            </p>
            <ul className="flex flex-col gap-1.5">
              {top.map((a) => (
                <li
                  key={a.codigo}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-borde pb-1.5 text-xs last:border-0"
                >
                  <span className="min-w-0 truncate">
                    <span className="codigo font-bold">{a.codigo}</span>
                    <span className="ml-2 text-texto-3">{a.nombre}</span>
                  </span>
                  <Insignia tono="ok">{dineroCompacto(a.valor, idioma)}</Insignia>
                </li>
              ))}
            </ul>
          </div>

          <div className="min-w-0">
            <p className="mono mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-texto-3">
              {t("roi.porClase")}
            </p>
            <ul className="flex flex-col gap-1.5">
              {[...porClase.entries()]
                .sort((x, y) => y[1] - x[1])
                .map(([clase, valor]) => (
                  <li
                    key={clase}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-borde pb-1.5 text-xs last:border-0"
                  >
                    <span className="capitalize">{clase}</span>
                    <Insignia tono="advertencia">
                      {totalClase > 0 ? numero((valor / totalClase) * 100, idioma) : 0}%
                    </Insignia>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-texto-3">{t("roi.nota")}</p>
    </section>
  );
}
