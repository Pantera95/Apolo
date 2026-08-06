/**
 * Catálogo de métricas del panel Premium.
 *
 * Una métrica no es un número suelto: es una definición. Sin fórmula escrita y
 * sin umbrales, dos personas miran el mismo 87% y discuten qué significa. Por
 * eso cada KPI declara de dónde sale, en qué unidad, cada cuánto se recalcula y
 * a partir de qué valor deja de ser normal.
 *
 * REGLA QUE NO SE NEGOCIA: cuando no hay datos suficientes para una fórmula, el
 * valor es `null` y la pantalla dice "Datos insuficientes". No se rellena con
 * cero, ni con un promedio, ni con un valor de ejemplo. Un cero inventado en un
 * panel de dirección se convierte en una decisión equivocada.
 */

export type UnidadKpi = "porcentaje" | "dias" | "horas" | "usd" | "conteo" | "veces";

export type Tendencia = "sube" | "baja" | "plano";

/** Cómo se lee la métrica: para OTIF más es mejor, para retrasos es al revés. */
export type Direccion = "mas-es-mejor" | "menos-es-mejor" | "neutra";

export type Severidad = "informativa" | "advertencia" | "alta" | "critica";

export interface DefinicionKpi {
  id: string;
  nombre: string;
  descripcion: string;
  formula: string;
  unidad: UnidadKpi;
  fuente: string;
  periodicidad: "evento" | "hora" | "dia" | "demanda";
  dimensiones: string[];
  direccion: Direccion;
  /** Hasta aquí, normal. Más allá, advertencia. */
  umbralAdvertencia?: number;
  /** Más allá de aquí, crítico. */
  umbralCritico?: number;
  visualizacion: string;
  /**
   * Por qué NO se puede calcular hoy, si es el caso. Que esté escrito aquí es
   * lo que impide que alguien lo "arregle" inventando el dato.
   */
  faltaDato?: string;
}

export interface ValorKpi {
  id: string;
  /** `null` = datos insuficientes. Nunca 0 por defecto. */
  valor: number | null;
  /** Valor del periodo anterior, para la variación. `null` si no hay con qué comparar. */
  anterior: number | null;
  /** Serie corta para el sparkline. Vacía si no aplica. */
  serie: number[];
}

// ---------------------------------------------------------------------------
// Filtros
// ---------------------------------------------------------------------------

export type Periodo =
  | "hoy"
  | "7d"
  | "30d"
  | "mes"
  | "trimestre"
  | "anio"
  | "personalizado";

export interface Filtros {
  periodo: Periodo;
  /** Solo con periodo `personalizado`. ISO. */
  desde?: string;
  hasta?: string;
  /** `null` = todas. */
  obraId: string | null;
  /** `null` = todos. */
  almacenId: string | null;
}

export const FILTROS_INICIALES: Filtros = {
  periodo: "30d",
  obraId: null,
  almacenId: null,
};

/** Ventana de tiempo ya resuelta a milisegundos, con su periodo comparable. */
export interface Ventana {
  desdeMs: number;
  hastaMs: number;
  /** Misma duración, inmediatamente anterior. Para la variación. */
  previoDesdeMs: number;
  previoHastaMs: number;
  etiqueta: string;
}

// ---------------------------------------------------------------------------
// Alertas
// ---------------------------------------------------------------------------

export type TipoAlerta =
  | "stock_critico"
  | "solicitud_sin_aprobar"
  | "aprobada_sin_preparar"
  | "compra_retrasada"
  | "despacho_detenido"
  | "entrega_con_discrepancia"
  | "herramienta_vencida"
  | "inventario_descuadrado";

export interface Alerta {
  id: string;
  tipo: TipoAlerta;
  severidad: Severidad;
  titulo: string;
  detalle: string;
  obraId?: string;
  almacenId?: string;
  responsable?: string;
  /** ISO. Cuándo empezó la condición, no cuándo se generó la alerta. */
  desde: string;
  accion: string;
  /** Ruta del módulo donde se resuelve. */
  enlace: string;
}

// ---------------------------------------------------------------------------
// Filas de tablas
// ---------------------------------------------------------------------------

export interface FilaObraCritica {
  obraId: string;
  codigo: string;
  nombre: string;
  /** Fracción 0..1 de material entregado sobre solicitado. */
  avanceMaterial: number | null;
  solicitudesBloqueadas: number;
  materialesCriticos: number;
  entregasConDiscrepancia: number;
  herramientaPendiente: number;
  valorEnObraUsd: number;
  alertas: number;
}

export interface FilaStockCritico {
  articuloId: string;
  codigo: string;
  descripcion: string;
  disponible: number;
  consumoDiario: number | null;
  /** Días de cobertura. `null` si no hay consumo con el que estimarlo. */
  cobertura: number | null;
  obrasAfectadas: number;
}

export interface Conteo {
  clave: string;
  etiqueta: string;
  valor: number;
}

// ---------------------------------------------------------------------------
// El paquete que consume la pantalla
// ---------------------------------------------------------------------------

export interface DatosPanel {
  generadoEn: string;
  kpis: Record<string, ValorKpi>;
  alertas: Alerta[];
  obrasCriticas: FilaObraCritica[];
  stockCritico: FilaStockCritico[];
  solicitudesPorEstado: Conteo[];
  despachosPorEstado: Conteo[];
  avanceObras: { obraId: string; codigo: string; solicitado: number; entregado: number }[];
  /** Serie de valor despachado por día dentro de la ventana. */
  serieDespacho: { fecha: string; valorUsd: number }[];
}

/**
 * Puerto de datos del panel.
 *
 * La pantalla depende de esta interfaz, no del almacén local. Cuando entre
 * Supabase se escribe una segunda implementación que llama a vistas SQL y
 * funciones RPC, y no se toca ni un componente. Es la razón de que exista.
 */
export interface FuenteDashboard {
  obtener(filtros: Filtros, ahoraMs: number): Promise<DatosPanel>;
}
