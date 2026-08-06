import type { EstadosFinancieros } from "@/lib/dashboard/finanzas";

/**
 * Estados financieros ficticios para la demostración.
 *
 * QUÉ SE INVENTA Y QUÉ NO — importa la distinción:
 *
 * Se inventan los INSUMOS: activo, pasivo, patrimonio, ventas, utilidad. Son
 * cifras que Apolo no puede conocer porque no factura, y sin ellas trece de los
 * diecisiete indicadores quedan vacíos y el demo no enseña nada.
 *
 * NO se inventa ningún indicador. Cada punto de cada gráfica lo calcula la
 * misma fórmula que usaría con las cifras reales del cliente.
 *
 * LA TRAYECTORIA ES DELIBERADA. Una empresa que mejora en línea recta doce
 * meses seguidos no existe y no convence a nadie que haya visto un balance.
 * Esta arranca apretada de liquidez, mete deuda a largo para financiar obra,
 * sufre un trimestre malo de márgenes y se recupera, con un mes de tensión de
 * caja por un cobro que se atrasó. Da una historia que contar delante del
 * cliente en vez de doce barras iguales.
 */

const MESES = 12;

/** Factor estacional: el segundo trimestre es el fuerte de obra. */
function estacion(mes: number): number {
  const ciclo = [0.78, 0.85, 1.06, 1.22, 1.28, 1.14, 0.95, 0.88, 1.08, 1.2, 1.1, 0.86];
  return ciclo[mes % 12];
}

/**
 * Sacudidas puntuales.
 *
 * Sin ellas la curva es un plano inclinado y las gráficas no dicen nada. Cada
 * una corresponde a un suceso que un gerente reconoce: un cobro que se atrasa,
 * un lote de material importado que llega caro, una amortización grande.
 */
function sacudida(i: number): { caja: number; margen: number; pasivo: number } {
  // `i` es meses hacia atrás desde el cierre: 11 = el más antiguo.
  if (i === 9) return { caja: 0.55, margen: 1, pasivo: 1.15 }; // cobro atrasado
  if (i >= 5 && i <= 7) return { caja: 0.9, margen: 0.78, pasivo: 1.05 }; // material caro
  if (i === 3) return { caja: 1.25, margen: 1.06, pasivo: 0.72 }; // amortización
  return { caja: 1, margen: 1, pasivo: 1 };
}

/**
 * Participación de cada obra y cada almacén en el negocio.
 *
 * Es lo que permite que filtrar por obra o por almacén MUEVA las cifras: los
 * flujos (ventas, costo, utilidad) se prorratean por la participación de la
 * obra, y el inventario y las cuentas por pagar por la del almacén.
 *
 * Se declara aquí, no se deduce: repartir a partes iguales daría el mismo
 * porcentaje para todas y filtrar seguiría sin cambiar nada relativo.
 */
export const PARTICIPACION_OBRA: Record<string, number> = {
  "obra-pinos": 0.34,
  "obra-refineria": 0.28,
  "obra-muelle": 0.23,
  "obra-planta": 0.15,
};

export const PARTICIPACION_ALMACEN: Record<string, number> = {
  "alm-central": 0.68,
  "alm-norte": 0.32,
};

/**
 * Cuota de participación de una obra o un almacén.
 *
 * Devuelve 1 sin filtro: la empresa completa.
 *
 * Para lo que no está declarado —y eso incluye TODAS las obras que crea la
 * semilla operativa, que genera sus propios identificadores— la cuota se deriva
 * del identificador con un hash estable. Repartir a partes iguales daría el
 * mismo porcentaje a todas y filtrar de una obra a otra no cambiaría nada
 * relativo, que es justo lo que hay que poder enseñar.
 *
 * El hash es determinista: la misma obra tiene siempre la misma cuota entre
 * recargas, que es lo que un demo necesita para ser creíble.
 */
export function cuota(
  tabla: Record<string, number>,
  id: string | null,
  cuantos: number,
): number {
  if (!id) return 1;
  const declarada = tabla[id];
  if (declarada !== undefined) return declarada;

  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  // Reparto entre el 55% y el 145% de la parte proporcional: distinto entre sí
  // pero sin que ninguna obra se coma el balance entero.
  const base = cuantos > 0 ? 1 / cuantos : 1;
  return base * (0.55 + ((h % 100) / 100) * 0.9);
}

/**
 * Serie de doce cortes mensuales, del más antiguo al más reciente.
 *
 * `anclaMs` es el mes de cierre. Se calcula relativa al reloj para que el demo
 * no aparezca con la contabilidad de hace dos años.
 */
export function serieFinancieraDemo(anclaMs: number): EstadosFinancieros[] {
  const salida: EstadosFinancieros[] = [];
  const fin = new Date(anclaMs);

  for (let i = MESES - 1; i >= 0; i--) {
    const d = new Date(fin.getFullYear(), fin.getMonth() - i, 1);
    const t = (MESES - 1 - i) / (MESES - 1); // 0 al inicio, 1 al final
    const est = estacion(d.getMonth());
    const s = sacudida(i);

    // Crecimiento del negocio: +42% en el año, con estacionalidad encima.
    const ventasNetas = Math.round(980_000 * (1 + 0.42 * t) * est);

    const margenBruto = 0.33 * (1 + 0.08 * t) * s.margen;
    const utilidadBruta = Math.round(ventasNetas * margenBruto);
    const costoVentas = ventasNetas - utilidadBruta;

    // Los gastos fijos no bajan con las ventas: por eso el mes flojo duele.
    const gastosFijos = 195_000;
    const utilidadNeta = Math.round(utilidadBruta - gastosFijos);

    const inventario = Math.round(320_000 * (1 + 0.26 * t) * (est > 1 ? 1.22 : 0.9));
    const cuentasPorCobrar = Math.round(ventasNetas * (s.caja < 1 ? 0.62 : 0.42));
    const caja = Math.round(120_000 * (1 + 0.5 * t) * s.caja);
    const activoCorriente = inventario + cuentasPorCobrar + caja;
    const activoFijo = Math.round(1_450_000 * (1 + 0.12 * t));
    const activoTotal = activoCorriente + activoFijo;

    const pasivoNoCorriente = Math.round(
      (i >= 8 ? 180_000 : 620_000 * (1 - 0.28 * t)) * s.pasivo,
    );
    const cuentasPorPagar = Math.round(costoVentas * 0.38 * s.pasivo);
    const pasivoCorriente = cuentasPorPagar + Math.round(140_000 * est);
    const pasivoTotal = pasivoCorriente + pasivoNoCorriente;
    const patrimonioNeto = activoTotal - pasivoTotal;

    salida.push({
      corte: new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString(),
      activoCorriente,
      activoTotal,
      pasivoCorriente,
      pasivoNoCorriente,
      pasivoTotal,
      patrimonioNeto,
      inventario,
      inventarioPromedio: inventario,
      ventasNetas,
      ventasCredito: Math.round(ventasNetas * 0.68),
      ventasACoste: costoVentas,
      costoVentas,
      utilidadBruta,
      utilidadNeta,
      cuentasPorCobrarPromedio: cuentasPorCobrar,
      cuentasPorPagar,
      accionesEnCirculacion: 50_000,
      dividendosPagados: Math.round(Math.max(0, utilidadNeta) * 0.25),
    });
  }

  return salida;
}

/**
 * Prorratea un corte por la participación de la obra y del almacén.
 *
 * QUÉ SE PRORRATEA Y QUÉ NO:
 *
 *   Flujos (ventas, costo, utilidad, cuentas por cobrar) → por OBRA. Son lo que
 *   esa obra generó.
 *   Inventario y cuentas por pagar → por ALMACÉN. Son existencias y compromisos
 *   de ese almacén.
 *   Patrimonio y activo fijo → NO se prorratean por obra. El capital social de
 *   la empresa no pertenece a una obra, y repartirlo produciría un ROE por obra
 *   que no significa nada.
 *
 * Cuando hay filtro, el activo total y el pasivo total se recomponen de sus
 * partes prorrateadas, así que los ratios siguen cuadrando entre sí.
 */
export function prorratear(
  ef: EstadosFinancieros,
  cuotaObra: number,
  cuotaAlmacen: number,
): EstadosFinancieros {
  if (cuotaObra === 1 && cuotaAlmacen === 1) return ef;

  const esc = (v: number | undefined, k: number) =>
    v === undefined ? undefined : Math.round(v * k);

  const inventario = esc(ef.inventario, cuotaAlmacen);
  const cuentasPorCobrar = esc(ef.cuentasPorCobrarPromedio, cuotaObra);
  const cuentasPorPagar = esc(ef.cuentasPorPagar, cuotaAlmacen);

  // La caja no se atribuye a una obra: se deduce de lo que quedaba en el corte
  // completo y se reparte por la cuota de obra, que es la que la genera.
  const cajaOriginal =
    (ef.activoCorriente ?? 0) -
    (ef.inventario ?? 0) -
    (ef.cuentasPorCobrarPromedio ?? 0);
  const caja = Math.round(Math.max(0, cajaOriginal) * cuotaObra);

  const activoCorriente = (inventario ?? 0) + (cuentasPorCobrar ?? 0) + caja;
  const activoFijo = Math.round(
    ((ef.activoTotal ?? 0) - (ef.activoCorriente ?? 0)) * cuotaObra,
  );
  const activoTotal = activoCorriente + activoFijo;

  const otrosPasivosCortos = Math.round(
    Math.max(0, (ef.pasivoCorriente ?? 0) - (ef.cuentasPorPagar ?? 0)) * cuotaObra,
  );
  const pasivoCorriente = (cuentasPorPagar ?? 0) + otrosPasivosCortos;
  const pasivoNoCorriente = esc(ef.pasivoNoCorriente, cuotaObra) ?? 0;
  const pasivoTotal = pasivoCorriente + pasivoNoCorriente;

  return {
    ...ef,
    activoCorriente,
    activoTotal,
    pasivoCorriente,
    pasivoNoCorriente,
    pasivoTotal,
    patrimonioNeto: activoTotal - pasivoTotal,
    inventario,
    inventarioPromedio: esc(ef.inventarioPromedio, cuotaAlmacen),
    ventasNetas: esc(ef.ventasNetas, cuotaObra),
    ventasCredito: esc(ef.ventasCredito, cuotaObra),
    ventasACoste: esc(ef.ventasACoste, cuotaObra),
    costoVentas: esc(ef.costoVentas, cuotaObra),
    utilidadBruta: esc(ef.utilidadBruta, cuotaObra),
    utilidadNeta: esc(ef.utilidadNeta, cuotaObra),
    cuentasPorCobrarPromedio: cuentasPorCobrar,
    cuentasPorPagar,
  };
}
