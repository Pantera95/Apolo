/**
 * Ciclo de vida de una solicitud de material y su despacho a obra.
 *
 * Regla dura confirmada con el cliente: si la solicitud no está aprobada, el
 * sistema NO deja avanzar y lo físico no debe ocurrir. No es una advertencia
 * que se pueda ignorar — es un bloqueo de estado. Por eso la autorización vive
 * en la máquina de estados y no en un `if` dentro de una pantalla.
 */

import type { Resultado } from "./tipos";
import { fallo, ok } from "./tipos";

export type EstadoSolicitud =
  | "borrador"
  | "solicitada"
  | "aprobada"
  | "rechazada"
  | "en_preparacion"
  | "despachada"
  | "entregada"
  | "cerrada"
  | "anulada";

export type Rol =
  | "owner"
  | "administrador"
  | "aprobador"
  | "almacenista"
  | "chofer"
  | "solicitante"
  | "consulta";

interface Transicion {
  desde: EstadoSolicitud;
  hasta: EstadoSolicitud;
  roles: readonly Rol[];
}

/**
 * Nótese que NO existe transición de "solicitada" a "en_preparacion".
 * Ese hueco es la regla de negocio: no se puede saltar la aprobación.
 */
const TRANSICIONES: readonly Transicion[] = [
  { desde: "borrador", hasta: "solicitada", roles: ["owner", "administrador", "solicitante"] },
  { desde: "borrador", hasta: "anulada", roles: ["owner", "administrador", "solicitante"] },

  { desde: "solicitada", hasta: "aprobada", roles: ["owner", "administrador", "aprobador"] },
  { desde: "solicitada", hasta: "rechazada", roles: ["owner", "administrador", "aprobador"] },
  { desde: "solicitada", hasta: "anulada", roles: ["owner", "administrador"] },

  { desde: "aprobada", hasta: "en_preparacion", roles: ["owner", "administrador", "almacenista"] },
  { desde: "aprobada", hasta: "anulada", roles: ["owner", "administrador"] },

  { desde: "en_preparacion", hasta: "despachada", roles: ["owner", "administrador", "almacenista"] },
  { desde: "en_preparacion", hasta: "anulada", roles: ["owner", "administrador"] },

  { desde: "despachada", hasta: "entregada", roles: ["owner", "administrador", "chofer"] },

  { desde: "entregada", hasta: "cerrada", roles: ["owner", "administrador", "almacenista"] },
] as const;

/** Estados desde los cuales la mercancía ya puede moverse físicamente. */
const PERMITE_MOVIMIENTO_FISICO: ReadonlySet<EstadoSolicitud> = new Set([
  "aprobada",
  "en_preparacion",
  "despachada",
]);

export function esTerminal(estado: EstadoSolicitud): boolean {
  return estado === "cerrada" || estado === "anulada" || estado === "rechazada";
}

/**
 * La pregunta que el almacén hace de verdad: "¿puedo bajar esto del estante?".
 * Que sea una función y no un condicional repartido evita que una pantalla
 * nueva se olvide de preguntarlo.
 */
export function puedeMoverFisico(estado: EstadoSolicitud): boolean {
  return PERMITE_MOVIMIENTO_FISICO.has(estado);
}

export function transicionesPosibles(
  desde: EstadoSolicitud,
  rol: Rol,
): EstadoSolicitud[] {
  return TRANSICIONES.filter((t) => t.desde === desde && t.roles.includes(rol)).map(
    (t) => t.hasta,
  );
}

export function transicionar(
  desde: EstadoSolicitud,
  hasta: EstadoSolicitud,
  rol: Rol,
): Resultado<EstadoSolicitud> {
  const existe = TRANSICIONES.find((t) => t.desde === desde && t.hasta === hasta);

  if (!existe) {
    // Mensaje específico para el salto que la gente va a intentar de verdad:
    // mandar a preparar sin que nadie haya aprobado.
    if (desde === "solicitada" && hasta === "en_preparacion") {
      return fallo(
        "APROBACION_REQUERIDA",
        "La solicitud debe estar aprobada antes de prepararse en almacén",
      );
    }
    return fallo(
      "TRANSICION_NO_PERMITIDA",
      `No existe transición de "${desde}" a "${hasta}"`,
    );
  }

  if (!existe.roles.includes(rol)) {
    return fallo(
      "TRANSICION_NO_PERMITIDA",
      `El rol "${rol}" no puede pasar de "${desde}" a "${hasta}"`,
    );
  }

  return ok(hasta);
}

// ---------------------------------------------------------------------------
// Despacho parcial
// ---------------------------------------------------------------------------

export interface LineaSolicitud {
  articuloId: string;
  /** En unidad base del artículo. */
  cantidadSolicitada: number;
  cantidadDespachada: number;
}

export interface Solicitud {
  id: string;
  codigo: string;
  obraId: string;
  estado: EstadoSolicitud;
  lineas: LineaSolicitud[];
  creadaPor: string;
  aprobadaPor?: string;
  fecha: string;
}

export function pendientePorDespachar(linea: LineaSolicitud): number {
  return Math.max(0, linea.cantidadSolicitada - linea.cantidadDespachada);
}

export function estaCompletamenteDespachada(solicitud: Solicitud): boolean {
  return solicitud.lineas.every((l) => pendientePorDespachar(l) === 0);
}

/**
 * Registra un despacho parcial. El cliente confirmó que un pedido puede salir
 * en partes; el saldo pendiente tiene que quedar VISIBLE, porque una solicitud
 * que se cierra sola con la mitad del material es exactamente el tipo de error
 * que hoy nadie detecta.
 */
export function registrarDespacho(
  solicitud: Solicitud,
  articuloId: string,
  cantidad: number,
): Resultado<Solicitud> {
  if (!puedeMoverFisico(solicitud.estado)) {
    return fallo(
      "APROBACION_REQUERIDA",
      `No se puede despachar una solicitud en estado "${solicitud.estado}"`,
    );
  }
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return fallo("CANTIDAD_INVALIDA", "La cantidad debe ser mayor que cero");
  }

  const linea = solicitud.lineas.find((l) => l.articuloId === articuloId);
  if (!linea) {
    return fallo("CANTIDAD_INVALIDA", `El artículo ${articuloId} no está en la solicitud`);
  }
  if (cantidad > pendientePorDespachar(linea)) {
    return fallo(
      "STOCK_INSUFICIENTE",
      `Pendiente ${pendientePorDespachar(linea)}, se intenta despachar ${cantidad}`,
    );
  }

  return ok({
    ...solicitud,
    lineas: solicitud.lineas.map((l) =>
      l.articuloId === articuloId
        ? { ...l, cantidadDespachada: l.cantidadDespachada + cantidad }
        : l,
    ),
  });
}
