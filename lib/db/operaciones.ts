"use client";

/**
 * Puente entre la UI y el motor de inventario.
 *
 * Ninguna pantalla llama a `aplicar` directamente: pasa por aquí, y aquí es
 * donde se persiste. Cuando exista backend, este archivo se convierte en la
 * llamada al servidor y las pantallas no cambian.
 *
 * Si el dominio rechaza la operación, NO se guarda nada. El error sube a la
 * vista para que lo muestre; no se traga en silencio.
 */

import { aplicar, transferir, type Operacion } from "@/lib/dominio/inventario";
import type { Asiento, ClaveSaldo, Resultado } from "@/lib/dominio/tipos";
import { disponible, fallo, ok } from "@/lib/dominio/tipos";
import {
  transicionar,
  type EstadoSolicitud,
  type Rol,
  type Solicitud,
} from "@/lib/dominio/despacho";
import {
  ponerEnRuta,
  puedeDespacharse,
  registrarEntrega,
  registrarPreparacion,
  type Despacho,
  type LineaDespacho,
  type PruebaEntrega,
  type TipoTransporte,
} from "@/lib/dominio/entrega";
import { puedeRetornar } from "@/lib/datos/obras";
import { getEstado, setEstado, type EstadoApolo } from "./almacen";

export function ejecutar(op: Operacion): Resultado<Asiento> {
  const estado = getEstado();
  const articulo = estado.articulos.find((a) => a.id === op.articuloId);
  if (!articulo) {
    return fallo("CANTIDAD_INVALIDA", `Artículo desconocido: ${op.articuloId}`);
  }

  const r = aplicar(estado.inventario, op, articulo);
  if (!r.ok) return r;

  setEstado({ ...estado, inventario: r.valor.estado });
  return { ok: true, valor: r.valor.asiento };
}

export function ejecutarTransferencia(
  origen: ClaveSaldo,
  destino: ClaveSaldo,
  cantidad: number,
  usuarioId: string,
  nota?: string,
): Resultado<Asiento[]> {
  const estado = getEstado();
  const articulo = estado.articulos.find((a) => a.id === origen.articuloId);
  if (!articulo) {
    return fallo("CANTIDAD_INVALIDA", `Artículo desconocido: ${origen.articuloId}`);
  }

  const r = transferir(
    estado.inventario,
    origen,
    destino,
    cantidad,
    usuarioId,
    articulo,
    nota,
  );
  if (!r.ok) return r;

  setEstado({ ...estado, inventario: r.valor.estado });
  return { ok: true, valor: r.valor.asientos };
}

// ---------------------------------------------------------------------------
// Retorno de herramienta
// ---------------------------------------------------------------------------

/**
 * Devolver herramienta desde una obra.
 *
 * Añade una barrera que el motor de inventario por sí solo no puede poner: el
 * saldo `enObra` está agregado por ubicación, no por obra, así que el dominio
 * aceptaría que OBR-2401 devolviera herramienta que en realidad tiene
 * OBR-2402. Aquí se comprueba contra el kardex de ESA obra.
 */
export function registrarRetornoObra(
  obraId: string,
  articuloId: string,
  almacenId: string,
  ubicacionId: string,
  cantidad: number,
  condicion: "bueno" | "averiado",
): Resultado<Asiento> {
  const estado = getEstado();

  const disponibleParaRetorno = puedeRetornar(
    estado,
    obraId,
    articuloId,
    Date.now(),
  );
  if (cantidad > disponibleParaRetorno) {
    return fallo(
      "STOCK_INSUFICIENTE",
      `Esa obra tiene ${disponibleParaRetorno} sin devolver, no ${cantidad}`,
    );
  }

  return ejecutar({
    tipo: "retorno",
    obraId,
    condicion,
    cantidad,
    articuloId,
    almacenId,
    ubicacionId,
    usuarioId: USUARIO,
  });
}

// ---------------------------------------------------------------------------
// Solicitudes
// ---------------------------------------------------------------------------

const USUARIO = "demo-owner";

function correlativo(existentes: string[], prefijo: string): string {
  const numeros = existentes
    .map((c) => Number(c.replace(`${prefijo}-`, "")))
    .filter((n) => Number.isFinite(n));
  const siguiente = (numeros.length ? Math.max(...numeros) : 0) + 1;
  return `${prefijo}-${String(siguiente).padStart(4, "0")}`;
}

/**
 * Una solicitud nace SOLICITADA, no aprobada. Quien la crea no puede
 * autorizarla: esa es toda la razón de existir de la cadena.
 */
export function crearSolicitud(
  obraId: string,
  lineas: { articuloId: string; cantidad: number }[],
): Resultado<Solicitud> {
  if (!obraId) return fallo("CANTIDAD_INVALIDA", "Falta la obra");
  if (lineas.length === 0) {
    return fallo("CANTIDAD_INVALIDA", "La solicitud no tiene renglones");
  }
  if (lineas.some((l) => !Number.isFinite(l.cantidad) || l.cantidad <= 0)) {
    return fallo("CANTIDAD_INVALIDA", "Hay renglones sin cantidad válida");
  }

  const estado = getEstado();
  const codigo = correlativo(
    estado.solicitudes.map((s) => s.codigo),
    "SOL",
  );

  const solicitud: Solicitud = {
    id: `sol-${codigo}`,
    codigo,
    obraId,
    estado: "solicitada",
    creadaPor: USUARIO,
    fecha: new Date().toISOString(),
    lineas: lineas.map((l) => ({
      articuloId: l.articuloId,
      cantidadSolicitada: l.cantidad,
      cantidadDespachada: 0,
    })),
  };

  setEstado({ ...estado, solicitudes: [solicitud, ...estado.solicitudes] });
  return ok(solicitud);
}

export function cambiarEstadoSolicitud(
  solicitudId: string,
  hasta: EstadoSolicitud,
  rol: Rol = "owner",
): Resultado<Solicitud> {
  const estado = getEstado();
  const solicitud = estado.solicitudes.find((s) => s.id === solicitudId);
  if (!solicitud) return fallo("CANTIDAD_INVALIDA", "Solicitud desconocida");

  const r = transicionar(solicitud.estado, hasta, rol);
  if (!r.ok) return r;

  const actualizada: Solicitud = {
    ...solicitud,
    estado: r.valor,
    aprobadaPor: r.valor === "aprobada" ? USUARIO : solicitud.aprobadaPor,
  };

  setEstado({
    ...estado,
    solicitudes: estado.solicitudes.map((s) =>
      s.id === solicitudId ? actualizada : s,
    ),
  });
  return ok(actualizada);
}

// ---------------------------------------------------------------------------
// Despacho
// ---------------------------------------------------------------------------

/**
 * Elige de dónde sacar el material: la ubicación con más disponible.
 * PROVISIONAL — el cliente confirmará su criterio real (FIFO por lote, cercanía
 * a la puerta, etc.). Se aísla aquí para poder cambiarlo en un solo sitio.
 */
function mejorUbicacion(
  estado: EstadoApolo,
  articuloId: string,
  necesario: number,
): { almacenId: string; ubicacionId: string } | null {
  let mejor: { almacenId: string; ubicacionId: string; disp: number } | null = null;

  for (const [clave, saldo] of estado.inventario.saldos) {
    const [id, almacenId, ubicacionId] = clave.split("|");
    if (id !== articuloId) continue;
    const disp = disponible(saldo);
    if (disp < necesario) continue;
    if (!mejor || disp > mejor.disp) mejor = { almacenId, ubicacionId, disp };
  }

  return mejor ? { almacenId: mejor.almacenId, ubicacionId: mejor.ubicacionId } : null;
}

/**
 * Genera el despacho de una solicitud APROBADA y reserva el material.
 *
 * La barrera se comprueba aquí otra vez aunque la UI no ofrezca el botón: la
 * pantalla puede equivocarse, el dominio no.
 */
export function crearDespachoDesdeSolicitud(
  solicitudId: string,
  transporte: TipoTransporte,
  asignacion: {
    choferId?: string;
    vehiculoId?: string;
    transportistaExterno?: string;
    guiaExterna?: string;
  },
): Resultado<Despacho> {
  const estado = getEstado();
  const solicitud = estado.solicitudes.find((s) => s.id === solicitudId);
  if (!solicitud) return fallo("CANTIDAD_INVALIDA", "Solicitud desconocida");

  const permitido = puedeDespacharse(solicitud);
  if (!permitido.ok) return permitido;

  const fecha = new Date().toISOString();
  const codigo = correlativo(estado.despachos.map((d) => d.codigo), "DES");

  const lineas: LineaDespacho[] = [];
  let inventario = estado.inventario;

  for (const linea of solicitud.lineas) {
    const pendiente = linea.cantidadSolicitada - linea.cantidadDespachada;
    if (pendiente <= 0) continue;

    const ubicacion = mejorUbicacion(estado, linea.articuloId, pendiente);
    if (!ubicacion) {
      return fallo(
        "STOCK_INSUFICIENTE",
        `No hay una ubicación con ${pendiente} disponibles de ${linea.articuloId}`,
      );
    }

    const articulo = estado.articulos.find((a) => a.id === linea.articuloId);
    if (!articulo) return fallo("CANTIDAD_INVALIDA", "Artículo desconocido");

    const r = aplicar(
      inventario,
      {
        tipo: "reserva",
        cantidad: pendiente,
        obraId: solicitud.obraId,
        fecha,
        usuarioId: USUARIO,
        documentoId: codigo,
        articuloId: linea.articuloId,
        ...ubicacion,
      },
      articulo,
    );
    if (!r.ok) return r;
    inventario = r.valor.estado;

    lineas.push({
      articuloId: linea.articuloId,
      cantidad: pendiente,
      preparado: 0,
      ...ubicacion,
    });
  }

  if (lineas.length === 0) {
    return fallo("CANTIDAD_INVALIDA", "No queda nada pendiente por despachar");
  }

  const despacho: Despacho = {
    id: `des-${codigo}`,
    codigo,
    solicitudId,
    obraId: solicitud.obraId,
    estado: "en_preparacion",
    transporte,
    ...asignacion,
    lineas,
    creadoEn: fecha,
  };

  // La solicitud avanza a preparación en la misma operación: el despacho ES su
  // preparación, y dejarla "aprobada" haría que se pudiera duplicar.
  const avance = transicionar(solicitud.estado, "en_preparacion", "owner");
  const solicitudes = avance.ok
    ? estado.solicitudes.map((s) =>
        s.id === solicitudId ? { ...s, estado: avance.valor } : s,
      )
    : estado.solicitudes;

  setEstado({
    ...estado,
    inventario,
    solicitudes,
    despachos: [...estado.despachos, despacho],
  });
  return ok(despacho);
}

function reemplazar(estado: EstadoApolo, despacho: Despacho): Despacho[] {
  return estado.despachos.map((d) => (d.id === despacho.id ? despacho : d));
}

/** Marcar un renglón como recogido. No mueve existencia: el picking es físico. */
export function prepararLinea(
  despachoId: string,
  articuloId: string,
  ubicacionId: string,
  cantidad: number,
): Resultado<Despacho> {
  const estado = getEstado();
  const despacho = estado.despachos.find((d) => d.id === despachoId);
  if (!despacho) return fallo("CANTIDAD_INVALIDA", "Despacho desconocido");

  const r = registrarPreparacion(despacho, articuloId, ubicacionId, cantidad);
  if (!r.ok) return r;

  setEstado({ ...estado, despachos: reemplazar(estado, r.valor) });
  return ok(r.valor);
}

/**
 * Sacar a ruta: aquí SÍ se mueve el inventario. Sale del estante y entra en
 * tránsito, consumiendo la reserva.
 *
 * Si algún renglón falla, no se guarda nada: se trabaja sobre una copia del
 * inventario y solo se persiste cuando todos pasaron. Un despacho a medias en
 * el kardex sería peor que no despacharlo.
 */
export function sacarARuta(despachoId: string): Resultado<Despacho> {
  const estado = getEstado();
  const despacho = estado.despachos.find((d) => d.id === despachoId);
  if (!despacho) return fallo("CANTIDAD_INVALIDA", "Despacho desconocido");

  const fecha = new Date().toISOString();
  const transicion = ponerEnRuta(despacho, fecha);
  if (!transicion.ok) return transicion;

  let inventario = estado.inventario;
  for (const linea of despacho.lineas) {
    const articulo = estado.articulos.find((a) => a.id === linea.articuloId);
    if (!articulo) return fallo("CANTIDAD_INVALIDA", "Artículo desconocido");

    const r = aplicar(
      inventario,
      {
        tipo: "despacho",
        cantidad: linea.cantidad,
        obraId: despacho.obraId,
        fecha,
        usuarioId: USUARIO,
        documentoId: despacho.codigo,
        articuloId: linea.articuloId,
        almacenId: linea.almacenId,
        ubicacionId: linea.ubicacionId,
      },
      articulo,
    );
    if (!r.ok) return r;
    inventario = r.valor.estado;
  }

  setEstado({
    ...estado,
    inventario,
    despachos: reemplazar(estado, transicion.valor),
  });
  return ok(transicion.valor);
}

/**
 * Registrar la entrega: de tránsito a obra.
 *
 * La coincidencia de la orden la calcula el dominio. Si no cuadra, la entrega
 * se registra igual —la mercancía ya está en obra— pero queda marcada.
 */
export function entregar(
  despachoId: string,
  pod: Omit<PruebaEntrega, "coincide" | "fecha">,
): Resultado<Despacho> {
  const estado = getEstado();
  const despacho = estado.despachos.find((d) => d.id === despachoId);
  if (!despacho) return fallo("CANTIDAD_INVALIDA", "Despacho desconocido");

  const fecha = new Date().toISOString();
  const transicion = registrarEntrega(despacho, { ...pod, fecha });
  if (!transicion.ok) return transicion;

  let inventario = estado.inventario;
  for (const linea of despacho.lineas) {
    const articulo = estado.articulos.find((a) => a.id === linea.articuloId);
    if (!articulo) return fallo("CANTIDAD_INVALIDA", "Artículo desconocido");

    const r = aplicar(
      inventario,
      {
        tipo: "entrega",
        cantidad: linea.cantidad,
        obraId: despacho.obraId,
        fecha,
        usuarioId: USUARIO,
        documentoId: despacho.codigo,
        articuloId: linea.articuloId,
        almacenId: linea.almacenId,
        ubicacionId: linea.ubicacionId,
      },
      articulo,
    );
    if (!r.ok) return r;
    inventario = r.valor.estado;
  }

  setEstado({
    ...estado,
    inventario,
    despachos: reemplazar(estado, transicion.valor),
  });
  return ok(transicion.valor);
}
