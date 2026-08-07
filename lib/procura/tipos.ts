/**
 * Procura — el ciclo de compra de materiales e insumos industriales.
 *
 * Cubre las cinco etapas del EDT: requisición, licitación, evaluación,
 * adjudicación y cierre. No sustituye al módulo de Compras, que sigue llevando
 * las órdenes ya emitidas y su recepción: Procura es lo que ocurre ANTES de que
 * exista una orden, cuando todavía se está decidiendo a quién comprarle.
 *
 * SIN BACKEND TODAVÍA. Estas interfaces son el esquema que mañana se traduce a
 * tablas; hoy viven en el mismo almacenamiento local que el resto de Apolo. Se
 * declaran completas a propósito para que la migración sea un mapeo y no un
 * rediseño.
 */

// ---------------------------------------------------------------------------
// Etapas del EDT
// ---------------------------------------------------------------------------

export type EtapaProcura =
  | "requisicion"
  | "licitacion"
  | "evaluacion"
  | "adjudicacion"
  | "cierre";

export const ETAPAS: { id: EtapaProcura; edt: string; nombre: string; corto: string }[] = [
  { id: "requisicion", edt: "1.1", nombre: "Requisición y validación", corto: "Requisición" },
  { id: "licitacion", edt: "1.2", nombre: "Licitación y gestión de ofertas", corto: "Licitación" },
  { id: "evaluacion", edt: "1.3", nombre: "Evaluación integrada", corto: "Evaluación" },
  { id: "adjudicacion", edt: "1.4", nombre: "Formalización y contratación", corto: "Adjudicación" },
  { id: "cierre", edt: "1.5", nombre: "Cierre y transición financiera", corto: "Cierre" },
];

export const ORDEN_ETAPA: Record<EtapaProcura, number> = {
  requisicion: 0,
  licitacion: 1,
  evaluacion: 2,
  adjudicacion: 3,
  cierre: 4,
};

// ---------------------------------------------------------------------------
// Incoterms
// ---------------------------------------------------------------------------

/**
 * Incoterms admitidos.
 *
 * IMPORTAN PARA COMPARAR, no son una etiqueta. Un precio FOB excluye flete,
 * seguro y aranceles; un DDP los incluye todos. Poner las dos cifras en la
 * misma columna y quedarse con la menor adjudica al proveedor equivocado de
 * forma sistemática, y el sobrecosto aparece cuando la mercancía ya está en
 * puerto.
 */
export type Incoterm = "EXW" | "FOB" | "CFR" | "CIF" | "DAP" | "DDP";

export const INCOTERMS: {
  id: Incoterm;
  nombre: string;
  /** Qué NO cubre el precio del proveedor y hay que sumarle para comparar. */
  faltaFlete: boolean;
  faltaSeguro: boolean;
  faltaAduana: boolean;
}[] = [
  { id: "EXW", nombre: "EXW · en fábrica", faltaFlete: true, faltaSeguro: true, faltaAduana: true },
  { id: "FOB", nombre: "FOB · libre a bordo", faltaFlete: true, faltaSeguro: true, faltaAduana: true },
  { id: "CFR", nombre: "CFR · costo y flete", faltaFlete: false, faltaSeguro: true, faltaAduana: true },
  { id: "CIF", nombre: "CIF · costo, seguro y flete", faltaFlete: false, faltaSeguro: false, faltaAduana: true },
  { id: "DAP", nombre: "DAP · entregado en destino", faltaFlete: false, faltaSeguro: false, faltaAduana: true },
  { id: "DDP", nombre: "DDP · entregado con derechos pagados", faltaFlete: false, faltaSeguro: false, faltaAduana: false },
];

// ---------------------------------------------------------------------------
// Entidades
// ---------------------------------------------------------------------------

export type Criticidad = "critica" | "alta" | "normal";

export interface PartidaProcura {
  id: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  /** Norma o especificación exigible: API 600, ASME B16.5, ISO 9001. */
  norma: string;
  /** Data sheet adjunto. `null` mientras no se haya cargado. */
  fichaTecnicaUrl: string | null;
}

export type EstadoOferta =
  | "recibida"
  | "en_revision"
  | "aprobada_tecnica"
  | "rechazada_tecnica"
  | "adjudicada";

export interface OfertaProveedor {
  id: string;
  proveedorId: string;
  proveedorNombre: string;
  /** Puntuación técnica sobre 100. `null` mientras no haya dictamen. */
  puntajeTecnico: number | null;
  precioUsd: number;
  incoterm: Incoterm;
  /**
   * Costos que el incoterm deja fuera y que la empresa tendría que pagar.
   * Se guardan aparte del precio para poder auditar la comparación.
   */
  fleteUsd: number;
  seguroUsd: number;
  aduanaUsd: number;
  entregaSemanas: number;
  /** Días de crédito ofrecidos. Cero = pago contra entrega. */
  creditoDias: number;
  estado: EstadoOferta;
  /** Excepciones a la especificación que el proveedor declara. */
  excepciones: string[];
}

export interface AclaracionTecnica {
  id: string;
  /** Quién pregunta: normalmente un licitante. */
  proveedorNombre: string;
  pregunta: string;
  respuesta: string | null;
  /** Cierto cuando la respuesta cambia el alcance y hay que emitir boletín. */
  emiteBoletin: boolean;
  fechaIso: string;
}

export type EstadoAprobacionOc =
  | "borrador"
  | "en_firmas"
  | "aprobada"
  | "acusada"
  | "rechazada";

export type EstadoFinanciero =
  | "sin_iniciar"
  | "anticipo_pagado"
  | "facturado"
  | "pagado";

export interface FirmaDoa {
  rol: string;
  nombre: string;
  firmadoIso: string | null;
}

export interface OrdenGenerada {
  numero: string;
  montoUsd: number;
  estadoAprobacion: EstadoAprobacionOc;
  /** Firmas exigidas por la matriz de autorización, en orden. */
  firmas: FirmaDoa[];
  /** Acuse de recibo del proveedor. */
  acusadaIso: string | null;
  pdfUrl: string | null;
  estadoFinanciero: EstadoFinanciero;
}

export interface ProcesoProcura {
  id: string;
  /** PROC-2026-001. */
  codigo: string;
  titulo: string;
  etapa: EtapaProcura;
  departamento: string;
  obraId: string | null;
  criticidad: Criticidad;
  /** Presupuesto base aprobado. Referencia del ahorro. */
  presupuestoUsd: number;
  /** Monto adjudicado. `null` mientras no se adjudique. */
  adjudicadoUsd: number | null;
  partidas: PartidaProcura[];
  ofertas: OfertaProveedor[];
  aclaraciones: AclaracionTecnica[];
  orden: OrdenGenerada | null;
  creadoIso: string;
  /** Fecha en que la orden quedó aprobada. Cierra el lead time. */
  ordenAprobadaIso: string | null;
  /** Partida presupuestaria contra la que se imputa. */
  partidaPresupuestaria: string;
}

// ---------------------------------------------------------------------------
// Matriz de autorización (DOA)
// ---------------------------------------------------------------------------

/**
 * Quién tiene que firmar según el monto.
 *
 * Los tramos son ACUMULATIVOS: una orden de 800.000 USD no la firma solo el
 * comité, la firman también el analista y el gerente. Tratarlos como
 * excluyentes dejaría las órdenes grandes con menos control que las pequeñas,
 * que es exactamente lo contrario de lo que busca una matriz de autorización.
 */
export const MATRIZ_DOA: { hastaUsd: number; rol: string }[] = [
  { hastaUsd: 50_000, rol: "Analista de Procura" },
  { hastaUsd: 250_000, rol: "Gerente de Procura" },
  { hastaUsd: 1_000_000, rol: "Dirección de Operaciones" },
  { hastaUsd: Number.POSITIVE_INFINITY, rol: "Comité de Compras" },
];
