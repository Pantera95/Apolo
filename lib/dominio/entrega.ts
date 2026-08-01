/**
 * Despacho y entrega.
 *
 * La empresa reparte con sus propios camiones y a veces contrata transporte.
 * No hay integración con transportistas: lo que hay que controlar es interno —
 * qué salió, con quién, y si llegó completo.
 *
 * REGLA CENTRAL, confirmada con el cliente: el receptor en obra tiene una orden
 * de entrega física, y esa orden DEBE coincidir con la que trae el chofer. La
 * verificación es esa comparación, y cuando no coinciden el sistema no lo
 * oculta: registra la discrepancia y la deja visible.
 */

import { puedeMoverFisico, type Solicitud } from "./despacho";
import type { Resultado } from "./tipos";
import { fallo, ok } from "./tipos";

export type EstadoDespacho =
  | "en_preparacion"
  | "listo"
  | "en_ruta"
  | "entregado"
  | "con_discrepancia";

export type TipoTransporte = "flota" | "externo";

export interface Chofer {
  id: string;
  nombre: string;
  telefono?: string;
}

export interface Vehiculo {
  id: string;
  placa: string;
  descripcion: string;
}

export interface LineaDespacho {
  articuloId: string;
  ubicacionId: string;
  almacenId: string;
  /** En unidad base del artículo. */
  cantidad: number;
  preparado: number;
}

/**
 * Prueba de entrega. `ordenReceptor` es lo que el receptor tiene en la mano;
 * `coincide` se calcula, no se declara: nadie puede marcar como correcta una
 * entrega que no cuadra.
 */
export interface PruebaEntrega {
  receptor: string;
  ordenReceptor: string;
  coincide: boolean;
  observacion?: string;
  fecha: string;
  /** En producción será una foto o firma capturada; en el demo, su presencia. */
  evidencia?: string;
}

export interface Despacho {
  id: string;
  codigo: string;
  solicitudId: string;
  obraId: string;
  estado: EstadoDespacho;
  transporte: TipoTransporte;
  choferId?: string;
  vehiculoId?: string;
  transportistaExterno?: string;
  guiaExterna?: string;
  lineas: LineaDespacho[];
  creadoEn: string;
  salidaEn?: string;
  entregaEn?: string;
  pod?: PruebaEntrega;
}

// ---------------------------------------------------------------------------
// Creación
// ---------------------------------------------------------------------------

/**
 * Un despacho solo puede nacer de una solicitud que ya pasó la autorización.
 * Es la misma barrera que en la máquina de estados, aplicada al objeto físico:
 * sin aprobación no se baja nada del estante.
 */
export function puedeDespacharse(solicitud: Solicitud): Resultado<true> {
  if (!puedeMoverFisico(solicitud.estado)) {
    return fallo(
      "APROBACION_REQUERIDA",
      `La solicitud ${solicitud.codigo} está en "${solicitud.estado}"`,
    );
  }
  return ok(true);
}

// ---------------------------------------------------------------------------
// Preparación
// ---------------------------------------------------------------------------

export function pendienteDePreparar(linea: LineaDespacho): number {
  return Math.max(0, linea.cantidad - linea.preparado);
}

export function estaPreparado(despacho: Despacho): boolean {
  return despacho.lineas.every((l) => pendienteDePreparar(l) === 0);
}

/**
 * Ruta de preparación: las líneas se recorren en el orden físico del almacén,
 * no en el orden en que se pidieron. Un picker que va y vuelve por el mismo
 * pasillo pierde el turno entero.
 */
export function rutaDePreparacion(
  despacho: Despacho,
  ordenPorUbicacion: Map<string, number>,
): LineaDespacho[] {
  return [...despacho.lineas].sort(
    (a, b) =>
      (ordenPorUbicacion.get(a.ubicacionId) ?? 0) -
      (ordenPorUbicacion.get(b.ubicacionId) ?? 0),
  );
}

export function registrarPreparacion(
  despacho: Despacho,
  articuloId: string,
  ubicacionId: string,
  cantidad: number,
): Resultado<Despacho> {
  if (despacho.estado !== "en_preparacion") {
    return fallo(
      "TRANSICION_NO_PERMITIDA",
      `El despacho está en "${despacho.estado}" y ya no se prepara`,
    );
  }
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return fallo("CANTIDAD_INVALIDA", "La cantidad debe ser mayor que cero");
  }

  const linea = despacho.lineas.find(
    (l) => l.articuloId === articuloId && l.ubicacionId === ubicacionId,
  );
  if (!linea) {
    return fallo("CANTIDAD_INVALIDA", "Esa línea no pertenece al despacho");
  }
  if (cantidad > pendienteDePreparar(linea)) {
    return fallo(
      "STOCK_INSUFICIENTE",
      `Pendiente ${pendienteDePreparar(linea)}, se intenta preparar ${cantidad}`,
    );
  }

  const lineas = despacho.lineas.map((l) =>
    l === linea ? { ...l, preparado: l.preparado + cantidad } : l,
  );
  const siguiente: Despacho = { ...despacho, lineas };

  return ok(
    estaPreparado(siguiente) ? { ...siguiente, estado: "listo" } : siguiente,
  );
}

// ---------------------------------------------------------------------------
// Salida a ruta
// ---------------------------------------------------------------------------

/**
 * Poner en ruta exige saber QUIÉN lleva la mercancía. Con flota propia, chofer
 * y vehículo; con transporte contratado, el nombre y el número de guía. Sin
 * eso, cuando algo no llegue no habrá a quién preguntarle.
 */
export function ponerEnRuta(
  despacho: Despacho,
  fecha: string,
): Resultado<Despacho> {
  if (despacho.estado !== "listo") {
    return fallo(
      "TRANSICION_NO_PERMITIDA",
      `Solo sale a ruta un despacho "listo"; está en "${despacho.estado}"`,
    );
  }

  if (despacho.transporte === "flota") {
    if (!despacho.choferId || !despacho.vehiculoId) {
      return fallo("CANTIDAD_INVALIDA", "Falta asignar chofer y vehículo");
    }
  } else if (!despacho.transportistaExterno || !despacho.guiaExterna) {
    return fallo(
      "CANTIDAD_INVALIDA",
      "Falta el transportista y el número de guía",
    );
  }

  return ok({ ...despacho, estado: "en_ruta", salidaEn: fecha });
}

// ---------------------------------------------------------------------------
// Entrega
// ---------------------------------------------------------------------------

/**
 * Normaliza para comparar: el receptor escribe a mano en una obra, con lápiz y
 * polvo. "obr-2401 / 0148" y "OBR2401-0148" son el mismo documento, y hacer
 * fallar la verificación por un guion sería enseñarle al operario a ignorarla.
 */
export function normalizarOrden(valor: string): string {
  return valor.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function ordenesCoinciden(propia: string, receptor: string): boolean {
  return normalizarOrden(propia) === normalizarOrden(receptor);
}

/**
 * Registra la entrega.
 *
 * Si las órdenes no coinciden la entrega SE REGISTRA IGUAL —la mercancía ya se
 * entregó físicamente, negarlo no la devuelve— pero queda marcada como
 * `con_discrepancia` para que alguien la revise. Ocultarlo sería peor: el
 * descuadre aparecería semanas después sin rastro de dónde nació.
 */
export function registrarEntrega(
  despacho: Despacho,
  pod: Omit<PruebaEntrega, "coincide">,
): Resultado<Despacho> {
  if (despacho.estado !== "en_ruta") {
    return fallo(
      "TRANSICION_NO_PERMITIDA",
      `Solo se entrega un despacho en ruta; está en "${despacho.estado}"`,
    );
  }
  if (!pod.receptor.trim()) {
    return fallo("CANTIDAD_INVALIDA", "Falta quién recibe");
  }
  if (!pod.ordenReceptor.trim()) {
    return fallo("CANTIDAD_INVALIDA", "Falta la orden de entrega del receptor");
  }

  const coincide = ordenesCoinciden(despacho.codigo, pod.ordenReceptor);

  return ok({
    ...despacho,
    estado: coincide ? "entregado" : "con_discrepancia",
    entregaEn: pod.fecha,
    pod: { ...pod, coincide },
  });
}

export function totalUnidades(despacho: Despacho): number {
  return despacho.lineas.reduce((s, l) => s + l.cantidad, 0);
}
