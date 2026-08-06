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
 * misma fórmula que usaría con las cifras reales del cliente. Lo que se ve es
 * aritmética honesta sobre datos de ejemplo, no un dibujo bonito.
 *
 * La pantalla lo rotula siempre: "Datos ficticios, no son cifras del cliente".
 *
 * LA TRAYECTORIA ES DELIBERADA. Una empresa que mejora en línea recta doce
 * meses seguidos no existe y no convence a nadie que haya visto un balance.
 * Esta arranca apretada de liquidez, mete deuda a largo para financiar obra,
 * sufre un trimestre malo de márgenes y se recupera. Da una historia que
 * contar delante del cliente en vez de doce barras iguales.
 */

const MESES = 12;

/** Factor estacional: el segundo trimestre es el fuerte de obra. */
function estacion(mes: number): number {
  const ciclo = [0.86, 0.9, 1.02, 1.14, 1.18, 1.1, 0.98, 0.94, 1.04, 1.12, 1.06, 0.92];
  return ciclo[mes % 12];
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

    // Crecimiento del negocio: +38% en el año, con estacionalidad encima.
    const ventasNetas = Math.round(980_000 * (1 + 0.38 * t) * est);

    // El margen bruto cae en el trimestre 5-7 (materiales importados caros) y
    // se recupera. Sin ese valle, la grafica de rentabilidad no dice nada.
    const valle = i >= 5 && i <= 7 ? 0.82 : 1;
    const margenBruto = 0.33 * (1 + 0.06 * t) * valle;
    const utilidadBruta = Math.round(ventasNetas * margenBruto);
    const costoVentas = ventasNetas - utilidadBruta;

    // Los gastos fijos no bajan con las ventas: por eso el mes flojo duele.
    const gastosFijos = 195_000;
    const utilidadNeta = Math.round(utilidadBruta - gastosFijos);

    // Balance. El activo corriente crece con la operación; el inventario sube
    // antes del pico de obra y se descarga después.
    const inventario = Math.round(320_000 * (1 + 0.22 * t) * (est > 1 ? 1.18 : 0.94));
    const cuentasPorCobrar = Math.round(ventasNetas * 0.42);
    const caja = Math.round(120_000 * (1 + 0.5 * t));
    const activoCorriente = inventario + cuentasPorCobrar + caja;
    const activoFijo = Math.round(1_450_000 * (1 + 0.12 * t));
    const activoTotal = activoCorriente + activoFijo;

    // Deuda a largo para financiar equipo: entra en el mes 4 y se amortiza.
    const pasivoNoCorriente = i >= 8 ? 180_000 : Math.round(620_000 * (1 - 0.28 * t));
    const cuentasPorPagar = Math.round(costoVentas * 0.38);
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

/** Etiqueta corta del corte, para el eje de las gráficas. */
export function etiquetaCorte(iso: string | undefined, idioma: "es" | "en"): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(idioma === "es" ? "es-VE" : "en-US", {
    month: "short",
  });
}
