/**
 * Compras: proveedores, órdenes y recepción.
 *
 * El cliente confirmó recepción PARCIAL, que es lo normal en esta industria:
 * el proveedor manda 60 de los 100 tubos y el resto en dos semanas. El saldo
 * pendiente tiene que quedar visible; una orden que se cierra sola con la
 * mitad del material es el error que después nadie sabe explicar.
 */

import type { Resultado } from "./tipos";
import { fallo, ok } from "./tipos";

export interface Proveedor {
  id: string;
  nombre: string;
  contacto: string;
  telefono?: string;
  /** Días que tarda en entregar. Alimenta el punto de reposición. */
  leadTimeDias: number;
  activo: boolean;
}

export type EstadoOrden =
  | "borrador"
  | "enviada"
  | "parcial"
  | "recibida"
  | "cancelada";

export interface LineaOrden {
  articuloId: string;
  /** En unidad base del artículo. */
  cantidadPedida: number;
  cantidadRecibida: number;
  costoUnitarioUsd: number;
}

export interface OrdenCompra {
  id: string;
  codigo: string;
  proveedorId: string;
  estado: EstadoOrden;
  fechaEmision: string;
  fechaEsperada: string;
  lineas: LineaOrden[];
  nota?: string;
}

// ---------------------------------------------------------------------------
// Cálculos
// ---------------------------------------------------------------------------

export function pendientePorRecibir(linea: LineaOrden): number {
  return Math.max(0, linea.cantidadPedida - linea.cantidadRecibida);
}

export function estaRecibida(orden: OrdenCompra): boolean {
  return orden.lineas.every((l) => pendientePorRecibir(l) === 0);
}

export function totalOrden(orden: OrdenCompra): number {
  return orden.lineas.reduce(
    (s, l) => s + l.cantidadPedida * l.costoUnitarioUsd,
    0,
  );
}

export function totalRecibido(orden: OrdenCompra): number {
  return orden.lineas.reduce(
    (s, l) => s + l.cantidadRecibida * l.costoUnitarioUsd,
    0,
  );
}

/** Una orden viva es la que todavía puede traer mercancía. */
export function estaAbierta(orden: OrdenCompra): boolean {
  return orden.estado === "enviada" || orden.estado === "parcial";
}

/**
 * Costo promedio ponderado.
 *
 * Es el método elegido porque con inflación y varios proveedores el mismo
 * artículo entra a precios muy distintos, y el último costo distorsiona la
 * valorización del inventario entero.
 *
 * Si no había existencia, el costo entrante manda: promediar contra cero
 * daría la mitad del valor real.
 */
export function costoPromedioPonderado(
  existencia: number,
  costoActual: number,
  entrante: number,
  costoEntrante: number,
): number {
  if (entrante <= 0) return costoActual;
  if (existencia <= 0) return costoEntrante;

  const total = existencia + entrante;
  return (existencia * costoActual + entrante * costoEntrante) / total;
}

// ---------------------------------------------------------------------------
// Estados
// ---------------------------------------------------------------------------

const TRANSICIONES: Record<EstadoOrden, EstadoOrden[]> = {
  borrador: ["enviada", "cancelada"],
  enviada: ["parcial", "recibida", "cancelada"],
  // Una orden a medias ya trajo mercancía: cancelarla borraría esa entrada.
  parcial: ["recibida"],
  recibida: [],
  cancelada: [],
};

export function transicionarOrden(
  desde: EstadoOrden,
  hasta: EstadoOrden,
): Resultado<EstadoOrden> {
  if (!TRANSICIONES[desde].includes(hasta)) {
    return fallo(
      "TRANSICION_NO_PERMITIDA",
      `No se puede pasar de "${desde}" a "${hasta}"`,
    );
  }
  return ok(hasta);
}

// ---------------------------------------------------------------------------
// Recepción
// ---------------------------------------------------------------------------

/**
 * Registra la llegada de parte de una línea.
 *
 * Solo se recibe sobre una orden ENVIADA o PARCIAL: un borrador todavía no se
 * mandó al proveedor y una cancelada no debería traer nada.
 */
export function registrarRecepcion(
  orden: OrdenCompra,
  articuloId: string,
  cantidad: number,
): Resultado<OrdenCompra> {
  if (!estaAbierta(orden)) {
    return fallo(
      "TRANSICION_NO_PERMITIDA",
      `No se recibe sobre una orden en estado "${orden.estado}"`,
    );
  }
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return fallo("CANTIDAD_INVALIDA", "La cantidad debe ser mayor que cero");
  }

  const linea = orden.lineas.find((l) => l.articuloId === articuloId);
  if (!linea) {
    return fallo("CANTIDAD_INVALIDA", "Ese artículo no está en la orden");
  }

  const pendiente = pendientePorRecibir(linea);
  if (cantidad > pendiente) {
    return fallo(
      "STOCK_INSUFICIENTE",
      `Pendiente ${pendiente}, se intenta recibir ${cantidad}`,
    );
  }

  const lineas = orden.lineas.map((l) =>
    l === linea ? { ...l, cantidadRecibida: l.cantidadRecibida + cantidad } : l,
  );
  const siguiente: OrdenCompra = { ...orden, lineas };

  return ok({
    ...siguiente,
    estado: estaRecibida(siguiente) ? "recibida" : "parcial",
  });
}

/**
 * Días de atraso de una orden abierta respecto a su fecha esperada.
 * Devuelve 0 si aún no vence o si todavía no hay reloj.
 */
export function diasDeAtraso(orden: OrdenCompra, ahora: number): number {
  if (ahora === 0 || !estaAbierta(orden)) return 0;
  const esperada = Date.parse(orden.fechaEsperada);
  if (Number.isNaN(esperada)) return 0;
  return Math.max(0, Math.floor((ahora - esperada) / 86_400_000));
}
