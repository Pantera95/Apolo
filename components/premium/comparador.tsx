"use client";

import { useMemo, useState } from "react";

import { definicion, estadoUmbral } from "@/lib/dashboard/catalogo";
import { calcularPanel } from "@/lib/dashboard/fuente-local";
import { variacion } from "@/lib/dashboard/kpis";
import type { Filtros, Periodo } from "@/lib/dashboard/tipos";
import { dinero, numero } from "@/lib/datos/indicadores";
import type { EstadoApolo } from "@/lib/db/almacen";
import { usePreferencias } from "@/lib/preferencias";

const PERIODOS: { valor: Periodo; es: string; en: string }[] = [
  { valor: "hoy", es: "Hoy", en: "Today" },
  { valor: "7d", es: "Últimos 7 días", en: "Last 7 days" },
  { valor: "30d", es: "Últimos 30 días", en: "Last 30 days" },
  { valor: "mes", es: "Mes actual", en: "This month" },
  { valor: "trimestre", es: "Trimestre", en: "Quarter" },
  { valor: "anio", es: "Año", en: "Year" },
];

/**
 * FLUJO: se acumula dentro de la ventana, así que cambiar el periodo lo mueve.
 * Es lo único que tiene sentido comparar entre dos periodos.
 */
const FLUJO = ["rotacion", "entregas_completas", "stock_critico"];

/**
 * SALDO A FECHA: es una foto del estado actual, no un acumulado.
 *
 * El inventario que hay hoy es el mismo se mire "el mes" o "el trimestre", así
 * que su delta siempre sería 0%. Se muestran en un bloque aparte y sin columna
 * de variación, en vez de en la tabla de comparación: una fila que siempre
 * marca 0% hace pensar que el comparador está roto.
 */
const SALDO = [
  "valor_en_obra",
  "valor_inventario",
  "valor_por_recibir",
  "obras_activas",
  "solicitudes_por_aprobar",
  "aprobadas_sin_preparar",
  "despachos_activos",
  "compras_retrasadas",
  "herramienta_pendiente",
];

/**
 * Comparador de periodos.
 *
 * El panel ya compara contra la ventana inmediatamente anterior, pero eso no
 * responde la pregunta que hace un gerente en un comité: "¿cómo vamos este
 * trimestre contra el año?". Aquí las dos ventanas se eligen a mano y se
 * calculan por separado con la misma función que pinta el panel.
 *
 * La obra y el almacén NO se duplican: se comparan dos periodos de la MISMA
 * obra. Cambiar las dos cosas a la vez produce una diferencia que no se puede
 * atribuir a ninguna de las dos.
 */
export function ComparadorPeriodos({
  estado,
  filtros,
  ahora,
}: {
  estado: EstadoApolo;
  filtros: Filtros;
  ahora: number;
}) {
  const { t, idioma } = usePreferencias();
  const [abierto, setAbierto] = useState(false);
  const [periodoA, setPeriodoA] = useState<Periodo>("mes");
  const [periodoB, setPeriodoB] = useState<Periodo>("trimestre");

  const { a, b } = useMemo(() => {
    // Se hereda obra y almacén del panel: comparar dos periodos de obras
    // distintas daría una diferencia inatribuible.
    const base = { obraId: filtros.obraId, almacenId: filtros.almacenId };
    return {
      a: calcularPanel(estado, { ...base, periodo: periodoA }, ahora),
      b: calcularPanel(estado, { ...base, periodo: periodoB }, ahora),
    };
  }, [estado, filtros.obraId, filtros.almacenId, periodoA, periodoB, ahora]);

  const etiqueta = (p: Periodo) =>
    PERIODOS.find((x) => x.valor === p)?.[idioma === "es" ? "es" : "en"] ?? p;

  return (
    <section className="min-w-0 rounded-tarjeta border border-borde-fuerte bg-superficie p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-extrabold uppercase tracking-[0.06em]">
          {t("cmp.titulo")}
        </h2>
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          className="flex min-h-11 items-center text-xs font-bold text-marca hover:underline"
        >
          {abierto ? t("cmp.ocultar") : t("cmp.mostrar")}
        </button>
      </div>

      {abierto && (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(
              [
                ["A", periodoA, setPeriodoA],
                ["B", periodoB, setPeriodoB],
              ] as const
            ).map(([nombre, valor, set]) => (
              <label key={nombre} className="min-w-0 text-xs">
                <span className="mb-1.5 block font-extrabold uppercase tracking-[0.08em] text-texto-2">
                  {t("cmp.periodo")} {nombre}
                </span>
                <select
                  value={valor}
                  onChange={(e) => set(e.target.value as Periodo)}
                  className="min-h-12 w-full rounded-control border border-borde-fuerte bg-superficie px-3 text-sm text-texto"
                >
                  {PERIODOS.map((p) => (
                    <option key={p.valor} value={p.valor}>
                      {idioma === "es" ? p.es : p.en}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-xs">
              <thead>
                <tr className="border-b border-borde text-texto-3">
                  <th className="py-2 font-bold">{t("cmp.indicador")}</th>
                  <th className="py-2 text-right font-bold">{etiqueta(periodoA)}</th>
                  <th className="py-2 text-right font-bold">{etiqueta(periodoB)}</th>
                  <th className="py-2 text-right font-bold">Δ</th>
                </tr>
              </thead>
              <tbody>
                {FLUJO.map((id) => {
                  const def = definicion(id);
                  if (!def) return null;
                  const va = a.kpis[id]?.valor ?? null;
                  const vb = b.kpis[id]?.valor ?? null;
                  const d = variacion(va, vb);

                  // El signo bueno depende de la dirección del KPI: menos
                  // compras retrasadas es una mejora, menos inventario no.
                  const mejora =
                    d === null || d === 0
                      ? null
                      : def.direccion === "menos-es-mejor"
                        ? d < 0
                        : def.direccion === "mas-es-mejor"
                          ? d > 0
                          : null;

                  return (
                    <tr key={id} className="border-b border-borde last:border-0">
                      <td className="py-2">
                        <span className="font-bold">{def.nombre}</span>
                        <span
                          className={`mono ml-2 text-[10px] ${
                            estadoUmbral(def, va) === "critico"
                              ? "text-peligro"
                              : "text-texto-3"
                          }`}
                        >
                          {def.unidad}
                        </span>
                      </td>
                      <td className="cifra py-2 text-right font-bold">
                        {fmt(va, def.unidad, idioma)}
                      </td>
                      <td className="cifra py-2 text-right text-texto-2">
                        {fmt(vb, def.unidad, idioma)}
                      </td>
                      <td
                        className={`cifra py-2 text-right font-bold ${
                          mejora === null
                            ? "text-texto-3"
                            : mejora
                              ? "text-ok"
                              : "text-peligro"
                        }`}
                      >
                        {d === null
                          ? "—"
                          : `${d > 0 ? "+" : ""}${numero(d, idioma)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-texto-3">
            {t("cmp.nota")}
          </p>

          <h3 className="mono mt-5 text-[11px] font-bold uppercase tracking-[0.12em] text-texto-3">
            {t("cmp.saldos")}
          </h3>
          <p className="mt-1 text-[11px] leading-relaxed text-texto-3">
            {t("cmp.saldosNota")}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {SALDO.map((id) => {
              const def = definicion(id);
              if (!def) return null;
              const v = a.kpis[id]?.valor ?? null;
              return (
                <div
                  key={id}
                  className="min-w-0 rounded-control border border-borde bg-superficie-2 p-3"
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-texto-3">
                    {def.nombre}
                  </p>
                  <p className="cifra mt-1 break-words text-sm font-extrabold">
                    {fmt(v, def.unidad, idioma)}
                  </p>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function fmt(v: number | null, unidad: string, idioma: "es" | "en"): string {
  if (v === null) return "—";
  if (unidad === "usd") return dinero(v, idioma);
  if (unidad === "porcentaje") return `${numero(v, idioma)}%`;
  if (unidad === "veces") return `${numero(v, idioma)}×`;
  return numero(v, idioma);
}
