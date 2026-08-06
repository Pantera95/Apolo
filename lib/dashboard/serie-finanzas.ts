import {
  calcularFinanzas,
  type DerivadoDeApolo,
  type EstadosFinancieros,
  type IndicadorFinanciero,
} from "@/lib/dashboard/finanzas";
import {
  PARTICIPACION_ALMACEN,
  PARTICIPACION_OBRA,
  cuota,
  prorratear,
} from "@/lib/dashboard/semilla-finanzas";
import type { Filtros, Periodo } from "@/lib/dashboard/tipos";

/**
 * Serie histórica de cada indicador.
 *
 * Cada punto se calcula con la MISMA fórmula pura que el valor actual, aplicada
 * al corte de ese mes. No hay ningún valor inventado en las gráficas: lo único
 * ficticio en el demo son los insumos del balance, y la pantalla lo rotula.
 */

export interface PuntoIndicador {
  /** Etiqueta corta del corte, para el eje. */
  etiqueta: string;
  corte: string;
  valor: number | null;
}

/**
 * Cuántos cierres mensuales se muestran en cada periodo del filtro.
 *
 * Un balance es MENSUAL: no existe un corte diario, así que "hoy" no puede
 * mostrar un punto por hora. Lo que hace el filtro es fijar cuánta historia se
 * enseña alrededor del cierre vigente, y la pantalla lo dice literalmente
 * ("últimos N cierres").
 *
 * Antes "30 días" daba 2 puntos y la gráfica salía como una recta: dos puntos
 * SIEMPRE son una recta, no hay tendencia que ver. El mínimo es 4 porque por
 * debajo de eso una línea de tiempo no informa de nada.
 */
export function cortesDelPeriodo(periodo: Periodo): number {
  switch (periodo) {
    case "hoy":
    case "7d":
      return 4;
    case "30d":
    case "mes":
      return 6;
    case "trimestre":
      return 9;
    case "anio":
      return 12;
    default:
      return 6;
  }
}

/**
 * Recorta la serie al periodo elegido.
 *
 * Se devuelve al menos un punto SIEMPRE: una gráfica vacía porque el filtro
 * pidió un día se lee como un fallo, no como una decisión.
 */
export function recortarSerie(
  historial: EstadosFinancieros[],
  periodo: Periodo,
): EstadosFinancieros[] {
  if (historial.length === 0) return [];
  const n = Math.max(1, Math.min(cortesDelPeriodo(periodo), historial.length));
  return historial.slice(-n);
}

/**
 * Aplica los filtros de obra y almacén al histórico.
 *
 * Es lo que hace que elegir una obra MUEVA las cifras: los flujos se prorratean
 * por la participación de esa obra y las existencias por la del almacén. Sin
 * esto, cambiar el selector no alteraba un solo indicador financiero y la
 * función parecía decorativa.
 */
export function aplicarFiltros(
  historial: EstadosFinancieros[],
  filtros: Filtros,
  totalObras: number,
  totalAlmacenes: number,
): EstadosFinancieros[] {
  const cObra = cuota(PARTICIPACION_OBRA, filtros.obraId, totalObras);
  const cAlmacen = cuota(PARTICIPACION_ALMACEN, filtros.almacenId, totalAlmacenes);
  if (cObra === 1 && cAlmacen === 1) return historial;
  return historial.map((ef) => prorratear(ef, cObra, cAlmacen));
}

/**
 * Serie de un indicador concreto a lo largo de los cortes.
 *
 * El `derivado` se mantiene fijo en todos los puntos porque es el estado ACTUAL
 * del kardex: Apolo no guarda inventario valorizado histórico. Los indicadores
 * mixtos, por tanto, varían solo por su parte declarada, y eso es honesto —
 * simular un inventario histórico que nadie midió sería inventar.
 */
export function serieDeIndicador(
  id: string,
  cortes: EstadosFinancieros[],
  derivado: DerivadoDeApolo,
  idioma: "es" | "en",
): PuntoIndicador[] {
  return cortes.map((ef) => {
    const calc = calcularFinanzas(ef, derivado, idioma);
    const ind = calc.find((x) => x.id === id);
    return {
      etiqueta: etiquetaCorte(ef.corte, idioma),
      corte: ef.corte ?? "",
      valor: ind?.valor ?? null,
    };
  });
}

/** Todos los indicadores con su serie ya calculada, en una sola pasada. */
export function indicadoresConSerie(
  cortes: EstadosFinancieros[],
  derivado: DerivadoDeApolo,
  idioma: "es" | "en",
): { indicadores: IndicadorFinanciero[]; series: Map<string, PuntoIndicador[]> } {
  const porCorte = cortes.map((ef) => ({
    ef,
    calc: calcularFinanzas(ef, derivado, idioma),
  }));

  const ultimo = porCorte[porCorte.length - 1];
  const indicadores = ultimo ? ultimo.calc : calcularFinanzas({}, derivado, idioma);

  const series = new Map<string, PuntoIndicador[]>();
  for (const ind of indicadores) {
    series.set(
      ind.id,
      porCorte.map(({ ef, calc }) => ({
        etiqueta: etiquetaCorte(ef.corte, idioma),
        corte: ef.corte ?? "",
        valor: calc.find((x) => x.id === ind.id)?.valor ?? null,
      })),
    );
  }

  return { indicadores, series };
}

export function etiquetaCorte(iso: string | undefined, idioma: "es" | "en"): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(idioma === "es" ? "es-VE" : "en-US", { month: "short" });
}
