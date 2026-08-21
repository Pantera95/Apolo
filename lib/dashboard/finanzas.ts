import { aNumero, leerCsv, normalizarEncabezado } from "@/lib/dominio/importacion";

/**
 * Indicadores financieros.
 *
 * DE DÓNDE SALEN LOS DATOS — esto es lo primero que hay que entender:
 *
 * Apolo es un sistema de almacén y obra. Guarda inventario, órdenes de compra y
 * consumo. NO tiene balance general ni cuenta de resultados: no hay ventas
 * —Apolo nunca factura, es una regla del producto—, ni patrimonio, ni caja, ni
 * cuentas por cobrar.
 *
 * Por eso las cifras se separan en dos orígenes y la pantalla siempre dice cuál
 * es cuál:
 *
 *   DERIVADO   sale del kardex. Inventario valorizado y consumo a coste.
 *   DECLARADO  lo aporta el contador importando un archivo. Todo lo demás.
 *
 * Mezclar los dos sin distinguirlos sería el peor error posible aquí: haría
 * pasar por medición lo que es una declaración de un tercero.
 *
 * Las fórmulas son las estándar del análisis financiero y están implementadas
 * tal cual. Ninguna se "ajusta" para que dé mejor.
 */

const DIAS_ANIO = 365;

// ---------------------------------------------------------------------------
// Entradas
// ---------------------------------------------------------------------------

/**
 * Las cifras del balance y del estado de resultados.
 *
 * Todo es opcional: un demo puede tener solo media contabilidad cargada, y cada
 * indicador decide por su cuenta si tiene con qué calcularse.
 */
export interface EstadosFinancieros {
  /** ISO. A qué fecha corresponde el corte declarado. */
  corte?: string;
  activoCorriente?: number;
  activoTotal?: number;
  pasivoCorriente?: number;
  pasivoNoCorriente?: number;
  pasivoTotal?: number;
  patrimonioNeto?: number;
  /** Existencias declaradas. Si falta, se usa el inventario del kardex. */
  inventario?: number;
  inventarioPromedio?: number;
  ventasNetas?: number;
  ventasCredito?: number;
  ventasACoste?: number;
  costoVentas?: number;
  utilidadBruta?: number;
  utilidadNeta?: number;
  cuentasPorCobrarPromedio?: number;
  cuentasPorPagar?: number;
  accionesEnCirculacion?: number;
  dividendosPagados?: number;
}

/** Lo que Apolo sí puede medir por sí mismo. */
export interface DerivadoDeApolo {
  /** Existencia física valorizada al costo promedio ponderado. */
  inventarioValorizado: number;
  /** Consumo del periodo a coste. El equivalente al "costo de ventas" del almacén. */
  consumoACoste: number;
  /** Comprometido en órdenes abiertas: es una cuenta por pagar en formación. */
  comprometidoConProveedores: number;
  /** Días que cubre la ventana analizada, para anualizar. */
  diasDelPeriodo: number;
}

export type Origen = "derivado" | "declarado" | "mixto";

export type Familia = "liquidez" | "endeudamiento" | "rentabilidad" | "gestion";

export type Veredicto = "bueno" | "aceptable" | "malo" | "sin-datos";

export interface IndicadorFinanciero {
  id: string;
  nombre: string;
  familia: Familia;
  formula: string;
  unidad: "usd" | "razon" | "porcentaje" | "dias";
  origen: Origen;
  /** `null` = faltan cifras. Nunca cero por defecto. */
  valor: number | null;
  veredicto: Veredicto;
  /** Lectura en una frase de lo que significa ESTE valor, no el indicador. */
  lectura: string;
  /** Qué cifras faltan, cuando faltan. */
  falta: string[];
}

// ---------------------------------------------------------------------------
// Aritmética defensiva
// ---------------------------------------------------------------------------

/** División que devuelve null en vez de NaN o Infinity. */
export function div(numerador?: number, denominador?: number): number | null {
  if (numerador === undefined || denominador === undefined) return null;
  if (!Number.isFinite(numerador) || !Number.isFinite(denominador)) return null;
  if (denominador === 0) return null;
  return numerador / denominador;
}

function resta(a?: number, b?: number): number | null {
  if (a === undefined || b === undefined) return null;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return a - b;
}

function faltantes(campos: Record<string, number | undefined>): string[] {
  return Object.entries(campos)
    .filter(([, v]) => v === undefined || !Number.isFinite(v))
    .map(([k]) => k);
}

// ---------------------------------------------------------------------------
// Las 17 fórmulas, puras
// ---------------------------------------------------------------------------

/** FM = Activo Corriente − Pasivo Corriente. ≥ 0 es equilibrio. */
export function fondoDeManiobra(ac?: number, pc?: number): number | null {
  return resta(ac, pc);
}

/** RC = Activo Corriente / Pasivo Corriente. ≤ 1 no cubre el corto plazo. */
export function razonCorriente(ac?: number, pc?: number): number | null {
  return div(ac, pc);
}

/** PA = (Activo Corriente − Inventario) / Pasivo Corriente. */
export function pruebaAcida(ac?: number, inventario?: number, pc?: number): number | null {
  const sinInventario = resta(ac, inventario);
  if (sinInventario === null) return null;
  return div(sinInventario, pc);
}

/** ET = Pasivo Total / Activo Total, en porcentaje. */
export function endeudamientoTotal(pt?: number, at?: number): number | null {
  const r = div(pt, at);
  return r === null ? null : r * 100;
}

/** ECP = Pasivo Corriente / Patrimonio Neto, en porcentaje. */
export function endeudamientoCortoPlazo(pc?: number, pn?: number): number | null {
  const r = div(pc, pn);
  return r === null ? null : r * 100;
}

/** ELP = Pasivo No Corriente / Patrimonio Neto. */
export function endeudamientoLargoPlazo(pnc?: number, pn?: number): number | null {
  return div(pnc, pn);
}

/** AT = Pasivo Total / Patrimonio Neto. < 1 cubre obligaciones con terceros. */
export function apalancamientoTotal(pt?: number, pn?: number): number | null {
  return div(pt, pn);
}

/**
 * MUB = Utilidad Bruta / Ventas Netas × 100.
 *
 * El enunciado la escribe como `UB / (VN * 100)`, que da la razón dividida por
 * cien en vez de un porcentaje. Se implementa la fórmula correcta: un margen
 * del 20% tiene que salir 20, no 0,002.
 */
export function margenUtilidadBruta(ub?: number, vn?: number): number | null {
  const r = div(ub, vn);
  return r === null ? null : r * 100;
}

/** ROA = Utilidad Neta / Activos, en porcentaje. */
export function roa(un?: number, activos?: number): number | null {
  const r = div(un, activos);
  return r === null ? null : r * 100;
}

/** ROE = Utilidad Neta / Patrimonio, en porcentaje. */
export function roe(un?: number, patrimonio?: number): number | null {
  const r = div(un, patrimonio);
  return r === null ? null : r * 100;
}

/** RV = Utilidad Neta / Ventas Netas × 100. Mismo ajuste que el margen bruto. */
export function rentabilidadSobreVentas(un?: number, vn?: number): number | null {
  const r = div(un, vn);
  return r === null ? null : r * 100;
}

/**
 * Rentabilidad por dividendo.
 *
 * El enunciado la define como `Utilidad Neta / Acciones en circulación`, que es
 * el beneficio por acción, no el dividend yield. Se implementa lo que la
 * fórmula dice y se nombra por lo que es: beneficio por acción. Llamar "yield"
 * a esto llevaría a compararlo con yields de mercado, que es otra magnitud.
 */
export function beneficioPorAccion(un?: number, acciones?: number): number | null {
  return div(un, acciones);
}

/** IR = Ventas a precio de coste / Inventario promedio. */
export function indiceRotacion(ventasACoste?: number, inventarioPromedio?: number): number | null {
  return div(ventasACoste, inventarioPromedio);
}

/** RC = Ventas a crédito / Promedio de cuentas por cobrar. */
export function rotacionCartera(ventasCredito?: number, cxcPromedio?: number): number | null {
  return div(ventasCredito, cxcPromedio);
}

/** RP = Cuentas por pagar / Costo de ventas. */
export function rotacionProveedores(cxp?: number, costoVentas?: number): number | null {
  return div(cxp, costoVentas);
}

/** IE = Inventario promedio × 365 / Costo de ventas. Días de existencias. */
export function diasDeInventario(inventarioPromedio?: number, costoVentas?: number): number | null {
  if (inventarioPromedio === undefined) return null;
  return div(inventarioPromedio * DIAS_ANIO, costoVentas);
}

// ---------------------------------------------------------------------------
// Interpretación
// ---------------------------------------------------------------------------

/**
 * Bandas de interpretación.
 *
 * Salen del enunciado del cliente. Donde el enunciado es ambiguo se elige el
 * criterio conservador y se dice cuál es: es preferible que un indicador
 * aparezca como "revisar" de más a que pase por bueno de menos.
 */
function veredictoDe(id: string, v: number | null): Veredicto {
  if (v === null) return "sin-datos";
  switch (id) {
    case "fondo_maniobra":
      return v >= 0 ? "bueno" : "malo";
    case "razon_corriente":
      // > 2 cubre holgadamente; entre 1 y 2 cubre pero sin margen; ≤ 1 no cubre.
      return v > 2 ? "bueno" : v > 1 ? "aceptable" : "malo";
    case "prueba_acida":
      return v > 1 ? "bueno" : "malo";
    case "endeudamiento_total":
      // Por encima de 100% las deudas superan los activos.
      return v > 100 ? "malo" : v > 60 ? "aceptable" : "bueno";
    case "endeudamiento_corto":
      // El enunciado marca 20-30% como buen poder de negociación.
      return v >= 20 && v <= 30 ? "bueno" : v < 20 ? "aceptable" : "malo";
    case "endeudamiento_largo":
      return v < 1 ? "bueno" : "malo";
    case "apalancamiento":
      return v < 1 ? "bueno" : "malo";
    case "margen_bruto":
      return v <= 0 ? "malo" : v >= 20 ? "bueno" : "aceptable";
    case "roa":
      return v > 5 ? "bueno" : v > 0 ? "aceptable" : "malo";
    case "roe":
      return v > 0 ? "bueno" : "malo";
    case "rentabilidad_ventas":
      return v > 0 ? "bueno" : "malo";
    case "indice_rotacion":
      // Rango industrial del enunciado: 4-5.
      return v >= 4 ? "bueno" : v >= 2 ? "aceptable" : "malo";
    case "dias_inventario":
      return v <= 60 ? "bueno" : v <= 120 ? "aceptable" : "malo";
    default:
      return "aceptable";
  }
}

/** Lectura en una frase de lo que significa el valor concreto. */
function lecturaDe(id: string, v: number | null, idioma: "es" | "en"): string {
  const es = idioma === "es";
  if (v === null) {
    return es
      ? "Faltan cifras del balance para calcularlo."
      : "Balance figures are missing.";
  }
  switch (id) {
    case "fondo_maniobra":
      return v >= 0
        ? es ? "Equilibrio financiero: el activo corriente cubre las deudas a corto plazo." : "Financial balance: current assets cover short-term debt."
        : es ? "Desequilibrio: las deudas a corto plazo superan el activo corriente." : "Imbalance: short-term debt exceeds current assets.";
    case "razon_corriente":
      return v > 2
        ? es ? "Cubre holgadamente las obligaciones a corto plazo." : "Comfortably covers short-term obligations."
        : v > 1
          ? es ? "Cubre el corto plazo, pero sin margen." : "Covers the short term, with no margin."
          : es ? "No alcanza para cumplir las obligaciones a corto plazo." : "Not enough to meet short-term obligations.";
    case "prueba_acida":
      return v > 1
        ? es ? "Cumple el corto plazo incluso sin vender el inventario." : "Meets the short term even without selling inventory."
        : es ? "Depende de vender inventario para cumplir sus obligaciones." : "Depends on selling inventory to meet obligations.";
    case "endeudamiento_total":
      return v > 100
        ? es ? "Las deudas superan los activos." : "Debt exceeds assets."
        : es ? "Las deudas se mantienen por debajo de los activos." : "Debt stays below assets.";
    case "endeudamiento_largo":
      return v < 1
        ? es ? "Mayor solvencia a largo plazo." : "Greater long-term solvency."
        : es ? "Liquidez en riesgo por deuda a largo plazo." : "Liquidity at risk from long-term debt.";
    case "apalancamiento":
      return v < 1
        ? es ? "El patrimonio cubre las obligaciones con terceros." : "Equity covers third-party obligations."
        : es ? "Las obligaciones con terceros superan el patrimonio." : "Third-party obligations exceed equity.";
    case "roa":
      return v > 5
        ? es ? "La empresa es rentable sobre sus activos." : "The company is profitable on its assets."
        : es ? "Rentabilidad sobre activos por debajo del umbral de referencia." : "Return on assets below the reference threshold.";
    case "indice_rotacion":
      return es
        ? `El inventario rota ${v.toFixed(1)} veces; unos ${Math.round(12 / Math.max(v, 0.01))} meses por vuelta.`
        : `Inventory turns ${v.toFixed(1)} times; about ${Math.round(12 / Math.max(v, 0.01))} months per turn.`;
    case "dias_inventario":
      return es
        ? `Hay existencias para unos ${Math.round(v)} días al ritmo de consumo actual.`
        : `Stock covers about ${Math.round(v)} days at the current consumption rate.`;
    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// Ensamblado
// ---------------------------------------------------------------------------

/**
 * Calcula los 17 indicadores.
 *
 * Donde falta una cifra declarada pero Apolo tiene el equivalente derivado, se
 * usa el derivado y el indicador queda marcado como `mixto`. El caso claro es
 * el inventario: si el contador no lo declara, se usa el valorizado del kardex,
 * que además es más fiable porque se reconcilia contra los asientos.
 */
export function calcularFinanzas(
  ef: EstadosFinancieros,
  derivado: DerivadoDeApolo,
  idioma: "es" | "en" = "es",
): IndicadorFinanciero[] {
  // El inventario del kardex sustituye al declarado cuando este falta.
  const inventario = ef.inventario ?? derivado.inventarioValorizado;
  const inventarioPromedio = ef.inventarioPromedio ?? inventario;
  // El consumo a coste del periodo es el análogo del costo de ventas del
  // almacén: es lo que salió y no volvió, valorizado.
  const costoVentas = ef.costoVentas ?? anualizar(derivado.consumoACoste, derivado.diasDelPeriodo);
  const ventasACoste = ef.ventasACoste ?? costoVentas;
  const cuentasPorPagar = ef.cuentasPorPagar ?? derivado.comprometidoConProveedores;

  const usaDerivado = {
    inventario: ef.inventario === undefined,
    costoVentas: ef.costoVentas === undefined,
    cxp: ef.cuentasPorPagar === undefined,
  };

  const def = (
    id: string,
    nombre: string,
    familia: Familia,
    formula: string,
    unidad: IndicadorFinanciero["unidad"],
    valor: number | null,
    origen: Origen,
    falta: string[],
  ): IndicadorFinanciero => ({
    id,
    nombre,
    familia,
    formula,
    unidad,
    origen,
    valor,
    veredicto: veredictoDe(id, valor),
    lectura: lecturaDe(id, valor, idioma),
    falta,
  });

  return [
    // --- Liquidez ---------------------------------------------------------
    def(
      "fondo_maniobra",
      idioma === "es" ? "Fondo de maniobra" : "Working capital",
      "liquidez",
      "Activo Corriente − Pasivo Corriente",
      "usd",
      fondoDeManiobra(ef.activoCorriente, ef.pasivoCorriente),
      "declarado",
      faltantes({ activoCorriente: ef.activoCorriente, pasivoCorriente: ef.pasivoCorriente }),
    ),
    def(
      "razon_corriente",
      idioma === "es" ? "Razón corriente" : "Current ratio",
      "liquidez",
      "Activo Corriente / Pasivo Corriente",
      "razon",
      razonCorriente(ef.activoCorriente, ef.pasivoCorriente),
      "declarado",
      faltantes({ activoCorriente: ef.activoCorriente, pasivoCorriente: ef.pasivoCorriente }),
    ),
    def(
      "prueba_acida",
      idioma === "es" ? "Prueba ácida" : "Acid test",
      "liquidez",
      "(Activo Corriente − Inventario) / Pasivo Corriente",
      "razon",
      pruebaAcida(ef.activoCorriente, inventario, ef.pasivoCorriente),
      usaDerivado.inventario ? "mixto" : "declarado",
      faltantes({ activoCorriente: ef.activoCorriente, pasivoCorriente: ef.pasivoCorriente }),
    ),

    // --- Endeudamiento ----------------------------------------------------
    def(
      "endeudamiento_total",
      idioma === "es" ? "Endeudamiento total" : "Total debt ratio",
      "endeudamiento",
      "Pasivo Total / Activo Total × 100",
      "porcentaje",
      endeudamientoTotal(ef.pasivoTotal, ef.activoTotal),
      "declarado",
      faltantes({ pasivoTotal: ef.pasivoTotal, activoTotal: ef.activoTotal }),
    ),
    def(
      "endeudamiento_corto",
      idioma === "es" ? "Endeudamiento a corto plazo" : "Short-term debt",
      "endeudamiento",
      "Pasivo Corriente / Patrimonio Neto × 100",
      "porcentaje",
      endeudamientoCortoPlazo(ef.pasivoCorriente, ef.patrimonioNeto),
      "declarado",
      faltantes({ pasivoCorriente: ef.pasivoCorriente, patrimonioNeto: ef.patrimonioNeto }),
    ),
    def(
      "endeudamiento_largo",
      idioma === "es" ? "Endeudamiento a largo plazo" : "Long-term debt",
      "endeudamiento",
      "Pasivo No Corriente / Patrimonio Neto",
      "razon",
      endeudamientoLargoPlazo(ef.pasivoNoCorriente, ef.patrimonioNeto),
      "declarado",
      faltantes({ pasivoNoCorriente: ef.pasivoNoCorriente, patrimonioNeto: ef.patrimonioNeto }),
    ),
    def(
      "apalancamiento",
      idioma === "es" ? "Apalancamiento total" : "Leverage",
      "endeudamiento",
      "Pasivo Total / Patrimonio Neto",
      "razon",
      apalancamientoTotal(ef.pasivoTotal, ef.patrimonioNeto),
      "declarado",
      faltantes({ pasivoTotal: ef.pasivoTotal, patrimonioNeto: ef.patrimonioNeto }),
    ),

    // --- Rentabilidad -----------------------------------------------------
    def(
      "margen_bruto",
      idioma === "es" ? "Margen de utilidad bruta" : "Gross margin",
      "rentabilidad",
      "Utilidad Bruta / Ventas Netas × 100",
      "porcentaje",
      margenUtilidadBruta(ef.utilidadBruta, ef.ventasNetas),
      "declarado",
      faltantes({ utilidadBruta: ef.utilidadBruta, ventasNetas: ef.ventasNetas }),
    ),
    def(
      "roa",
      "ROA",
      "rentabilidad",
      "Utilidad Neta / Activo Total × 100",
      "porcentaje",
      roa(ef.utilidadNeta, ef.activoTotal),
      "declarado",
      faltantes({ utilidadNeta: ef.utilidadNeta, activoTotal: ef.activoTotal }),
    ),
    def(
      "roe",
      "ROE",
      "rentabilidad",
      "Utilidad Neta / Patrimonio Neto × 100",
      "porcentaje",
      roe(ef.utilidadNeta, ef.patrimonioNeto),
      "declarado",
      faltantes({ utilidadNeta: ef.utilidadNeta, patrimonioNeto: ef.patrimonioNeto }),
    ),
    def(
      "rentabilidad_ventas",
      idioma === "es" ? "Rentabilidad sobre ventas" : "Return on sales",
      "rentabilidad",
      "Utilidad Neta / Ventas Netas × 100",
      "porcentaje",
      rentabilidadSobreVentas(ef.utilidadNeta, ef.ventasNetas),
      "declarado",
      faltantes({ utilidadNeta: ef.utilidadNeta, ventasNetas: ef.ventasNetas }),
    ),
    def(
      "beneficio_accion",
      idioma === "es" ? "Beneficio por acción" : "Earnings per share",
      "rentabilidad",
      "Utilidad Neta / Acciones en circulación",
      "usd",
      beneficioPorAccion(ef.utilidadNeta, ef.accionesEnCirculacion),
      "declarado",
      faltantes({ utilidadNeta: ef.utilidadNeta, accionesEnCirculacion: ef.accionesEnCirculacion }),
    ),

    // --- Gestión ----------------------------------------------------------
    def(
      "indice_rotacion",
      idioma === "es" ? "Índice de rotación" : "Inventory turnover",
      "gestion",
      "Ventas a precio de coste / Inventario promedio",
      "razon",
      indiceRotacion(ventasACoste, inventarioPromedio),
      usaDerivado.costoVentas || usaDerivado.inventario ? "mixto" : "declarado",
      [],
    ),
    def(
      "rotacion_cartera",
      idioma === "es" ? "Rotación de cartera" : "Receivables turnover",
      "gestion",
      "Ventas a crédito / Promedio de cuentas por cobrar",
      "razon",
      rotacionCartera(ef.ventasCredito, ef.cuentasPorCobrarPromedio),
      "declarado",
      faltantes({
        ventasCredito: ef.ventasCredito,
        cuentasPorCobrarPromedio: ef.cuentasPorCobrarPromedio,
      }),
    ),
    def(
      "rotacion_proveedores",
      idioma === "es" ? "Rotación de proveedores" : "Payables turnover",
      "gestion",
      "Cuentas por pagar / Costo de ventas",
      "razon",
      rotacionProveedores(cuentasPorPagar, costoVentas),
      usaDerivado.cxp || usaDerivado.costoVentas ? "mixto" : "declarado",
      [],
    ),
    def(
      "dias_inventario",
      idioma === "es" ? "Días de inventario" : "Days of inventory",
      "gestion",
      "Inventario promedio × 365 / Costo de ventas",
      "dias",
      diasDeInventario(inventarioPromedio, costoVentas),
      usaDerivado.costoVentas || usaDerivado.inventario ? "mixto" : "declarado",
      [],
    ),
    def(
      "inventario_valorizado",
      idioma === "es" ? "Inventario valorizado" : "Inventory at cost",
      "gestion",
      "Σ(existencia física × costo promedio ponderado)",
      "usd",
      derivado.inventarioValorizado,
      "derivado",
      [],
    ),
  ];
}

/**
 * Lleva una cifra del periodo a base anual.
 *
 * Los ratios de gestión están definidos sobre el año. Comparar un consumo de 30
 * días contra un inventario de corte daría una rotación doce veces menor de la
 * real, y el indicador saldría siempre en rojo.
 */
export function anualizar(valorDelPeriodo: number, diasDelPeriodo: number): number {
  if (diasDelPeriodo <= 0) return 0;
  return (valorDelPeriodo / diasDelPeriodo) * DIAS_ANIO;
}

// ---------------------------------------------------------------------------
// Importación
// ---------------------------------------------------------------------------

/**
 * Formato del archivo de estados financieros. PROVISIONAL.
 *
 * Dos columnas: concepto y valor. Se eligió el formato largo y no una fila con
 * dieciocho columnas porque un contador lo exporta de cualquier sistema y lo
 * puede escribir a mano sin equivocarse de posición.
 *
 * El cliente todavía tiene que confirmar el formato definitivo. Mientras tanto
 * se aceptan estos nombres y sus variantes sin tildes ni mayúsculas.
 */
/**
 * Solo los campos NUMÉRICOS del balance. `corte` queda fuera a propósito: es
 * una fecha, y si entrara aquí el importador aceptaría asignarle un número.
 */
export type CampoNumerico = Exclude<keyof EstadosFinancieros, "corte">;

export const CAMPOS_ACEPTADOS: Record<string, CampoNumerico> = {
  "activo corriente": "activoCorriente",
  "activo total": "activoTotal",
  "pasivo corriente": "pasivoCorriente",
  "pasivo no corriente": "pasivoNoCorriente",
  "pasivo total": "pasivoTotal",
  "patrimonio neto": "patrimonioNeto",
  patrimonio: "patrimonioNeto",
  inventario: "inventario",
  "inventario promedio": "inventarioPromedio",
  "ventas netas": "ventasNetas",
  "ventas a credito": "ventasCredito",
  "ventas a coste": "ventasACoste",
  "ventas a precio de coste": "ventasACoste",
  "costo de ventas": "costoVentas",
  "costo ventas": "costoVentas",
  "utilidad bruta": "utilidadBruta",
  "utilidad neta": "utilidadNeta",
  "cuentas por cobrar promedio": "cuentasPorCobrarPromedio",
  "cuentas por pagar": "cuentasPorPagar",
  "acciones en circulacion": "accionesEnCirculacion",
  "dividendos pagados": "dividendosPagados",
};

export interface ResultadoImportacion {
  estados: EstadosFinancieros;
  reconocidos: string[];
  /** Conceptos del archivo que no se supo interpretar. Se informan, no se ignoran. */
  desconocidos: string[];
  errores: string[];
}

/**
 * Lee el archivo de estados financieros.
 *
 * Los conceptos no reconocidos se DEVUELVEN, no se descartan en silencio: quien
 * importa tiene que poder ver que su fila "Caja y bancos" no entró en ningún
 * indicador, en vez de descubrirlo cuando un ratio no cuadra.
 */
export function importarEstadosFinancieros(texto: string): ResultadoImportacion {
  const estados: EstadosFinancieros = {};
  const reconocidos: string[] = [];
  const desconocidos: string[] = [];
  const errores: string[] = [];

  // El separador se detecta: un contador exporta con `;` en Excel español y
  // con `,` en el inglés, y obligar a uno de los dos garantiza soporte técnico.
  const separador = detectarSeparador(texto);
  const filas = leerCsv(texto, separador);
  if (filas.length === 0) {
    return { estados, reconocidos, desconocidos, errores: ["El archivo está vacío."] };
  }

  for (const [i, fila] of filas.entries()) {
    if (fila.length < 2) continue;
    const concepto = normalizarEncabezado(fila[0] ?? "");
    if (!concepto) continue;
    // Cabecera típica: se salta sin considerarla un error.
    if (concepto === "concepto" || concepto === "cuenta") continue;

    const campo = CAMPOS_ACEPTADOS[concepto];
    if (!campo) {
      desconocidos.push(fila[0]);
      continue;
    }

    const valor = aNumero(fila[1] ?? "");
    if (valor === null) {
      errores.push(`Fila ${i + 1}: "${fila[1]}" no es un número.`);
      continue;
    }
    estados[campo] = valor;
    reconocidos.push(fila[0]);
  }

  return { estados, reconocidos, desconocidos, errores };
}

function detectarSeparador(texto: string): string {
  const primera = texto.split(/\r?\n/, 1)[0] ?? "";
  const puntoYComa = (primera.match(/;/g) ?? []).length;
  const coma = (primera.match(/,/g) ?? []).length;
  const tab = (primera.match(/\t/g) ?? []).length;
  if (tab > puntoYComa && tab > coma) return "\t";
  return puntoYComa >= coma ? ";" : ",";
}

/** Plantilla descargable, para que nadie tenga que adivinar el formato. */
export function plantillaCsv(): string {
  const filas = [
    ["Concepto", "Valor"],
    ["Activo corriente", "0"],
    ["Activo total", "0"],
    ["Pasivo corriente", "0"],
    ["Pasivo no corriente", "0"],
    ["Pasivo total", "0"],
    ["Patrimonio neto", "0"],
    ["Inventario promedio", "0"],
    ["Ventas netas", "0"],
    ["Ventas a credito", "0"],
    ["Costo de ventas", "0"],
    ["Utilidad bruta", "0"],
    ["Utilidad neta", "0"],
    ["Cuentas por cobrar promedio", "0"],
    ["Cuentas por pagar", "0"],
    ["Acciones en circulacion", "0"],
  ];
  return filas.map((f) => f.join(";")).join("\r\n");
}


/**
 * Salud por familia: cuántos indicadores salen favorables, sobre los que tienen
 * datos.
 *
 * EL DENOMINADOR SON LOS INDICADORES CON CIFRAS, no todos. Contar los
 * `sin-datos` como fallos convertiría "el cliente no ha importado el balance"
 * en "la empresa está mal", que es una acusación, no un indicador. Se devuelve
 * `conDatos` aparte para que la pantalla pueda decir sobre cuántos se calcula.
 *
 * Con cero indicadores medibles el porcentaje es `null`, nunca 0: un anillo
 * vacío afirma que nada va bien, y lo que pasa es que no se sabe.
 */
export function saludPorFamilia(
  indicadores: IndicadorFinanciero[],
): { familia: Familia; buenos: number; conDatos: number; pct: number | null }[] {
  const familias: Familia[] = ["liquidez", "endeudamiento", "rentabilidad", "gestion"];

  return familias.map((familia) => {
    const dela = indicadores.filter((i) => i.familia === familia);
    const conDatos = dela.filter((i) => i.veredicto !== "sin-datos");
    const buenos = conDatos.filter((i) => i.veredicto === "bueno").length;
    return {
      familia,
      buenos,
      conDatos: conDatos.length,
      pct: conDatos.length > 0 ? (buenos / conDatos.length) * 100 : null,
    };
  });
}

/** La misma lectura, sobre el conjunto: para el indicador de cabecera. */
export function saludGlobal(
  indicadores: IndicadorFinanciero[],
): { buenos: number; conDatos: number; pct: number | null } {
  const conDatos = indicadores.filter((i) => i.veredicto !== "sin-datos");
  const buenos = conDatos.filter((i) => i.veredicto === "bueno").length;
  return {
    buenos,
    conDatos: conDatos.length,
    pct: conDatos.length > 0 ? (buenos / conDatos.length) * 100 : null,
  };
}
