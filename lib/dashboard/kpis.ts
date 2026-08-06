import type { Filtros, Tendencia, Ventana } from "@/lib/dashboard/tipos";

/**
 * Fórmulas del panel. Funciones puras: sin React, sin almacén, sin Supabase.
 *
 * Están aquí y no dentro de los componentes porque son lo único del panel que
 * se puede probar de verdad. Un porcentaje mal calculado dentro de un JSX no
 * lo detecta nadie hasta que un gerente toma una decisión con él.
 *
 * Todas devuelven `null` cuando el denominador no existe. Ver la regla en
 * `tipos.ts`: no se rellena con cero.
 */

const DIA_MS = 86_400_000;

/** Días de cobertura por debajo de los cuales un artículo es crítico. */
export const DIAS_COBERTURA_MINIMA = 7;

// ---------------------------------------------------------------------------
// Razones y porcentajes
// ---------------------------------------------------------------------------

/**
 * Porcentaje con denominador comprobado.
 *
 * `0/0` en JavaScript es `NaN` y `1/0` es `Infinity`; los dos se pintan como
 * basura en una tarjeta. Sin datos, no hay porcentaje.
 */
export function porcentaje(parte: number, total: number): number | null {
  if (!Number.isFinite(parte) || !Number.isFinite(total) || total <= 0) return null;
  return (parte / total) * 100;
}

export function razon(numerador: number, denominador: number): number | null {
  if (!Number.isFinite(numerador) || !Number.isFinite(denominador) || denominador <= 0) {
    return null;
  }
  return numerador / denominador;
}

/** OTIF: a tiempo Y completas. Ambas condiciones, no la media de las dos. */
export function otif(aTiempoYCompletas: number, totalCerradas: number): number | null {
  return porcentaje(aTiempoYCompletas, totalCerradas);
}

export function entregasCompletas(sinDiferencia: number, total: number): number | null {
  return porcentaje(sinDiferencia, total);
}

export function exactitudInventario(sinDiferencia: number, auditados: number): number | null {
  return porcentaje(sinDiferencia, auditados);
}

export function cumplimientoProveedor(aTiempo: number, total: number): number | null {
  return porcentaje(aTiempo, total);
}

export function cumplimientoPlanObra(real: number, planificado: number): number | null {
  return porcentaje(real, planificado);
}

/**
 * Variación de consumo frente a lo planificado.
 *
 * Se devuelve con signo: negativo es consumir menos de lo previsto. Tomar el
 * valor absoluto perdería justo la información que interesa.
 */
export function variacionConsumo(real: number, planificado: number): number | null {
  if (!Number.isFinite(real) || !Number.isFinite(planificado) || planificado <= 0) {
    return null;
  }
  return ((real - planificado) / planificado) * 100;
}

/**
 * Días de cobertura: cuánto dura el stock al ritmo de consumo actual.
 *
 * Sin consumo NO es cobertura infinita: es que no hay con qué estimarla. Un
 * artículo parado puede llevar un año sin moverse y no por eso está a salvo.
 */
export function cobertura(disponible: number, consumoDiario: number): number | null {
  if (!Number.isFinite(disponible) || !Number.isFinite(consumoDiario)) return null;
  if (consumoDiario <= 0) return null;
  return disponible / consumoDiario;
}

/** Rotación: cuántas veces se consumió el inventario medio en el periodo. */
export function rotacion(consumoPeriodo: number, inventarioPromedio: number): number | null {
  return razon(consumoPeriodo, inventarioPromedio);
}

/** Promedio que distingue "media cero" de "sin muestras". */
export function promedio(valores: number[]): number | null {
  const limpios = valores.filter((v) => Number.isFinite(v));
  if (limpios.length === 0) return null;
  return limpios.reduce((a, b) => a + b, 0) / limpios.length;
}

/** Diferencia en días entre dos instantes, hacia adelante. */
export function dias(desdeMs: number, hastaMs: number): number {
  return (hastaMs - desdeMs) / DIA_MS;
}

// ---------------------------------------------------------------------------
// Variación entre periodos
// ---------------------------------------------------------------------------

/**
 * Variación porcentual contra el periodo anterior.
 *
 * Casos que rompen la fórmula ingenua y que aquí se tratan aparte:
 * de 0 a 5 no es "infinito por ciento", es que antes no había nada; y de 5 a 0
 * es -100%, no una división inválida.
 */
export function variacion(actual: number | null, anterior: number | null): number | null {
  if (actual === null || anterior === null) return null;
  if (anterior === 0) return actual === 0 ? 0 : null;
  return ((actual - anterior) / Math.abs(anterior)) * 100;
}

/** Umbral por debajo del cual una variación es ruido, no tendencia. */
const RUIDO = 0.5;

export function tendencia(actual: number | null, anterior: number | null): Tendencia {
  const v = variacion(actual, anterior);
  if (v === null || Math.abs(v) < RUIDO) return "plano";
  return v > 0 ? "sube" : "baja";
}

// ---------------------------------------------------------------------------
// Ventanas de tiempo
// ---------------------------------------------------------------------------

/**
 * Resuelve el filtro de periodo a milisegundos, con su ventana comparable.
 *
 * El periodo anterior tiene EXACTAMENTE la misma duración y termina donde
 * empieza el actual. Comparar 30 días contra un mes natural de 28 hace que
 * febrero parezca una caída del negocio.
 */
export function resolverVentana(filtros: Filtros, ahoraMs: number): Ventana {
  const ahora = new Date(ahoraMs);
  let desdeMs: number;
  let hastaMs = ahoraMs;
  let etiqueta: string;

  switch (filtros.periodo) {
    case "hoy": {
      const d = new Date(ahora);
      d.setHours(0, 0, 0, 0);
      desdeMs = d.getTime();
      etiqueta = "Hoy";
      break;
    }
    case "7d":
      desdeMs = ahoraMs - 7 * DIA_MS;
      etiqueta = "Últimos 7 días";
      break;
    case "30d":
      desdeMs = ahoraMs - 30 * DIA_MS;
      etiqueta = "Últimos 30 días";
      break;
    case "mes": {
      const d = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
      desdeMs = d.getTime();
      etiqueta = "Mes actual";
      break;
    }
    case "trimestre": {
      const inicio = Math.floor(ahora.getMonth() / 3) * 3;
      desdeMs = new Date(ahora.getFullYear(), inicio, 1).getTime();
      etiqueta = "Trimestre";
      break;
    }
    case "anio":
      desdeMs = new Date(ahora.getFullYear(), 0, 1).getTime();
      etiqueta = "Año";
      break;
    case "personalizado": {
      const d = filtros.desde ? Date.parse(filtros.desde) : NaN;
      const h = filtros.hasta ? Date.parse(filtros.hasta) : NaN;
      // Un rango inválido cae a 30 días en vez de producir NaN por todo el panel.
      desdeMs = Number.isFinite(d) ? d : ahoraMs - 30 * DIA_MS;
      hastaMs = Number.isFinite(h) ? h : ahoraMs;
      etiqueta = "Rango personalizado";
      break;
    }
  }

  if (hastaMs < desdeMs) [desdeMs, hastaMs] = [hastaMs, desdeMs];
  const duracion = Math.max(hastaMs - desdeMs, DIA_MS);

  return {
    desdeMs,
    hastaMs,
    previoDesdeMs: desdeMs - duracion,
    previoHastaMs: desdeMs,
    etiqueta,
  };
}

export function dentro(iso: string, desdeMs: number, hastaMs: number): boolean {
  const t = Date.parse(iso);
  return Number.isFinite(t) && t >= desdeMs && t <= hastaMs;
}
