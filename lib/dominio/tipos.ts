/**
 * Tipos del dominio de Apolo.
 *
 * El objeto central de este dominio NO es el pedido: es la OBRA. Todo material
 * se asigna a una obra, toda herramienta se presta a una obra y debe volver, y
 * todo consumo se imputa a una obra. Esa es la diferencia estructural frente a
 * cualquier sistema de inventario de ecommerce.
 */

// ---------------------------------------------------------------------------
// Resultado: éxito o error de negocio, sin excepciones.
// ---------------------------------------------------------------------------

/**
 * Las reglas de inventario devuelven Resultado en vez de lanzar excepciones.
 * Un descuadre de stock es una condición de negocio esperada, no un fallo del
 * programa, y quien llama SIEMPRE debe decidir qué hacer con él.
 */
export type Resultado<T> =
  | { ok: true; valor: T }
  | { ok: false; error: ErrorDominio };

/**
 * El código es estable y se traduce en la UI; el detalle es para diagnóstico.
 * Nunca se muestra `detalle` crudo al operario.
 */
export interface ErrorDominio {
  codigo: CodigoError;
  detalle: string;
}

export type CodigoError =
  | "STOCK_INSUFICIENTE"
  | "STOCK_NEGATIVO"
  | "MOTIVO_REQUERIDO"
  | "CANTIDAD_INVALIDA"
  | "UNIDAD_NO_DECLARADA"
  | "ARTICULO_NO_RETORNABLE"
  | "TRANSICION_NO_PERMITIDA"
  | "APROBACION_REQUERIDA"
  | "SERIE_REQUERIDA"
  | "CERTIFICADO_REQUERIDO";

export const ok = <T>(valor: T): Resultado<T> => ({ ok: true, valor });

export const fallo = <T>(
  codigo: CodigoError,
  detalle: string,
): Resultado<T> => ({ ok: false, error: { codigo, detalle } });

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

/**
 * La clase del artículo determina su comportamiento en TODO el sistema.
 *
 * - consumible: sale a obra y no vuelve (clavos, electrodos, pintura).
 * - retornable: sale a obra y DEBE volver. Genera deuda contra la obra y contra
 *   un responsable. Es la respuesta al dolor declarado por el cliente: no saben
 *   dónde están sus propias herramientas.
 * - certificado: material crítico con trazabilidad de colada y certificado de
 *   calidad. Requisito real de la industria petrolera (tubería, válvulas,
 *   bridas). No vuelve.
 */
export type ClaseArticulo = "consumible" | "retornable" | "certificado";

export interface Articulo {
  id: string;
  codigo: string;
  descripcion: string;
  clase: ClaseArticulo;
  /** Unidad en la que se guardan TODOS los movimientos de este artículo. */
  unidadBase: CodigoUnidad;
  /**
   * Cuántas unidades base representa una unidad alternativa.
   * Ej. { caja: 100 } significa "1 caja = 100 und".
   * Si una unidad no está aquí, capturar en ella es un error explícito: no se
   * adivinan equivalencias.
   */
  equivalencias?: Partial<Record<CodigoUnidad, number>>;
  /** Costo promedio ponderado en USD por unidad base. */
  costoPromedioUsd: number;
  activo: boolean;
}

export type CodigoUnidad =
  | "und" | "caja" | "paquete" | "saco" | "bolsa" | "rollo" | "par" | "juego"
  | "cunete" | "tambor" | "lamina" | "barra" | "tubo"
  | "m" | "m2" | "m3" | "ml" | "pie" | "pulg"
  | "l" | "gal"
  | "kg" | "g" | "ton" | "lb";

// ---------------------------------------------------------------------------
// Almacén, ubicación y obra
// ---------------------------------------------------------------------------

export interface Almacen {
  id: string;
  codigo: string;
  nombre: string;
  activo: boolean;
}

/**
 * Ubicación interna: almacén → pasillo → rack.
 * PROVISIONAL: si el cliente no usa este nivel de detalle se colapsa a una
 * ubicación única por almacén sin tocar el kardex.
 */
export interface Ubicacion {
  id: string;
  almacenId: string;
  pasillo: string;
  rack: string;
  /** Orden de recorrido para el picking. Menor = se visita primero. */
  ordenRecorrido: number;
}

export interface Obra {
  id: string;
  codigo: string;
  nombre: string;
  ubicacionGeografica: string;
  estado: "activa" | "suspendida" | "cerrada";
}

// ---------------------------------------------------------------------------
// Saldos
// ---------------------------------------------------------------------------

/**
 * Todas las cantidades están en la unidad base del artículo.
 *
 * `enObra` no es una existencia del almacén: es material o herramienta que ya
 * salió. Se lleva aquí porque para un retornable esa cantidad es una DEUDA
 * que alguien tiene que devolver, y es exactamente lo que hoy nadie mide.
 */
export interface Saldo {
  fisico: number;
  reservado: number;
  averiado: number;
  enTransito: number;
  enObra: number;
}

export const SALDO_CERO: Readonly<Saldo> = Object.freeze({
  fisico: 0,
  reservado: 0,
  averiado: 0,
  enTransito: 0,
  enObra: 0,
});

/**
 * Lo que realmente se puede comprometer con una obra nueva.
 * Lo reservado ya tiene dueño y lo averiado no se puede entregar.
 */
export function disponible(saldo: Saldo): number {
  return saldo.fisico - saldo.reservado - saldo.averiado;
}

/** Clave de un saldo: un artículo en una ubicación concreta de un almacén. */
export interface ClaveSaldo {
  articuloId: string;
  almacenId: string;
  ubicacionId: string;
}

export function clave(k: ClaveSaldo): string {
  return `${k.articuloId}|${k.almacenId}|${k.ubicacionId}`;
}

// ---------------------------------------------------------------------------
// Kardex
// ---------------------------------------------------------------------------

export type TipoMovimiento =
  | "recepcion"
  | "ajuste"
  | "reserva"
  | "liberacion_reserva"
  | "despacho"
  | "entrega"
  | "retorno"
  | "transferencia_salida"
  | "transferencia_entrada"
  | "conteo";

/**
 * Catálogo cerrado de motivos de ajuste.
 * PROVISIONAL: son los cuatro confirmados. Sin motivo obligatorio, un descuadre
 * es inexplicable tres meses después — por eso el tipo lo exige.
 */
export type MotivoAjuste =
  | "merma"
  | "rotura"
  | "consumo_interno"
  | "danado_de_fabrica"
  /**
   * Reversión de un archivo importado por error. No es un descuadre físico,
   * y por eso tiene motivo propio: mezclarlo con "merma" ensuciaría cualquier
   * análisis de pérdidas.
   */
  | "reversion_importacion";

/**
 * Un asiento de kardex es INMUTABLE. Nunca se edita ni se borra: un error se
 * corrige con un asiento contrario. Es la verdad auditable del sistema.
 */
export interface Asiento extends ClaveSaldo {
  readonly id: string;
  readonly fecha: string;
  readonly tipo: TipoMovimiento;
  /** Cambios firmados sobre el saldo, en unidad base. */
  readonly delta: Readonly<Saldo>;
  readonly usuarioId: string;
  readonly obraId?: string;
  readonly motivo?: MotivoAjuste;
  readonly documentoId?: string;
  readonly nota?: string;
}
