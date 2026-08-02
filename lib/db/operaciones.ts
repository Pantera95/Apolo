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
import {
  buscarArticulo,
  type FilaImportada,
  type PerfilImportacion,
} from "@/lib/dominio/importacion";
import { puedeRetornar } from "@/lib/datos/obras";
import {
  getEstado,
  setEstado,
  type ArchivoImportado,
  type EstadoApolo,
} from "./almacen";

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
// Importación
// ---------------------------------------------------------------------------

/** Huellas de todo lo ya cargado y NO revertido, para detectar duplicados. */
export function clavesCargadas(estado: EstadoApolo): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const archivo of estado.archivos) {
    if (archivo.revertido) continue;
    for (const clave of archivo.claves) mapa.set(clave, archivo.nombre);
  }
  return mapa;
}

export interface ResultadoImportacion {
  archivo: ArchivoImportado;
  importadas: number;
  omitidas: { linea: number; codigo: string; motivo: string }[];
}

/**
 * Aplica una importación de entradas al almacén.
 *
 * Todo o nada respecto al inventario: se trabaja sobre una copia y solo se
 * persiste si cada fila válida pudo aplicarse. Las filas que no se pueden
 * resolver (código inexistente o ambiguo) se OMITEN y se informan: importar
 * media verdad en silencio es peor que no importar.
 */
export function aplicarImportacion(
  nombreArchivo: string,
  perfil: PerfilImportacion,
  filas: FilaImportada[],
  almacenId: string,
  ubicacionId: string,
): Resultado<ResultadoImportacion> {
  const estado = getEstado();
  if (filas.length === 0) {
    return fallo("CANTIDAD_INVALIDA", "No hay filas que importar");
  }

  const fecha = new Date().toISOString();
  const omitidas: ResultadoImportacion["omitidas"] = [];
  const asientoIds: string[] = [];
  const claves: string[] = [];
  let inventario = estado.inventario;

  for (const fila of filas) {
    const encontrado = buscarArticulo(fila.codigo, estado.articulos);

    if (encontrado === null) {
      omitidas.push({ linea: fila.linea, codigo: fila.codigo, motivo: "desconocido" });
      continue;
    }
    if (encontrado === "ambiguo") {
      omitidas.push({ linea: fila.linea, codigo: fila.codigo, motivo: "ambiguo" });
      continue;
    }

    const r = aplicar(
      inventario,
      {
        tipo: "recepcion",
        cantidad: fila.cantidad,
        // La fecha de CADA fila, no la del archivo: un export puede cruzar años.
        fecha: fila.fecha ? `${fila.fecha}T12:00:00.000Z` : fecha,
        usuarioId: USUARIO,
        documentoId: fila.documento || nombreArchivo,
        articuloId: encontrado.id,
        almacenId,
        ubicacionId,
      },
      encontrado,
    );
    if (!r.ok) return r;

    inventario = r.valor.estado;
    asientoIds.push(r.valor.asiento.id);
    claves.push(fila.clave);
  }

  if (asientoIds.length === 0) {
    return fallo(
      "CANTIDAD_INVALIDA",
      "Ninguna fila pudo resolverse contra el catálogo",
    );
  }

  const archivo: ArchivoImportado = {
    id: `arc-${Date.now().toString(36)}`,
    nombre: nombreArchivo,
    perfilId: perfil.id,
    perfilNombre: perfil.nombre,
    fecha,
    filasImportadas: asientoIds.length,
    filasOmitidas: omitidas.length,
    asientoIds,
    claves,
    revertido: false,
  };

  setEstado({
    ...estado,
    inventario,
    archivos: [archivo, ...estado.archivos],
  });

  return ok({ archivo, importadas: asientoIds.length, omitidas });
}

/**
 * Revierte un archivo cargado por error.
 *
 * NO se borran asientos: el kardex es inmutable y un error se corrige con el
 * asiento contrario. Se generan ajustes de signo opuesto con motivo propio, de
 * modo que la auditoría conserve las dos mitades de la historia.
 *
 * Al quedar revertido, sus huellas dejan de contar para la idempotencia y el
 * archivo se puede volver a cargar corregido.
 */
export function revertirArchivo(archivoId: string): Resultado<number> {
  const estado = getEstado();
  const archivo = estado.archivos.find((a) => a.id === archivoId);
  if (!archivo) return fallo("CANTIDAD_INVALIDA", "Archivo desconocido");
  if (archivo.revertido) {
    return fallo("TRANSICION_NO_PERMITIDA", "Ese archivo ya fue revertido");
  }

  const porId = new Map(estado.inventario.asientos.map((a) => [a.id, a]));
  const fecha = new Date().toISOString();
  let inventario = estado.inventario;
  let revertidos = 0;

  for (const id of archivo.asientoIds) {
    const original = porId.get(id);
    if (!original) continue;

    const articulo = estado.articulos.find((a) => a.id === original.articuloId);
    if (!articulo) continue;

    const r = aplicar(
      inventario,
      {
        tipo: "ajuste",
        signo: -1,
        motivo: "reversion_importacion",
        cantidad: original.delta.fisico,
        fecha,
        usuarioId: USUARIO,
        documentoId: archivo.nombre,
        articuloId: original.articuloId,
        almacenId: original.almacenId,
        ubicacionId: original.ubicacionId,
      },
      articulo,
    );
    if (!r.ok) return r;

    inventario = r.valor.estado;
    revertidos++;
  }

  setEstado({
    ...estado,
    inventario,
    archivos: estado.archivos.map((a) =>
      a.id === archivoId ? { ...a, revertido: true } : a,
    ),
  });

  return ok(revertidos);
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

export interface LineaRetorno {
  obraId: string;
  articuloId: string;
  almacenId: string;
  ubicacionId: string;
  cantidad: number;
  condicion: "bueno" | "averiado";
}

/**
 * Retorno múltiple: cuando llega el camión de vuelta con media obra encima.
 *
 * Es TODO O NADA. Se valida y se aplica sobre una copia, y solo se persiste si
 * todos los renglones pasaron. Un retorno a medias dejaría al almacenista sin
 * saber qué quedó registrado y qué no, que es peor que no registrar nada.
 */
export function registrarRetornosMultiples(
  lineas: LineaRetorno[],
): Resultado<Asiento[]> {
  if (lineas.length === 0) {
    return fallo("CANTIDAD_INVALIDA", "No hay renglones que devolver");
  }

  const estado = getEstado();
  const ahora = Date.now();

  // Varios renglones pueden apuntar a la misma obra y artículo; el límite se
  // comprueba sobre la SUMA, no renglón por renglón.
  const acumulado = new Map<string, number>();
  for (const l of lineas) {
    const clave = `${l.obraId}|${l.articuloId}`;
    acumulado.set(clave, (acumulado.get(clave) ?? 0) + l.cantidad);
  }
  for (const [clave, total] of acumulado) {
    const [obraId, articuloId] = clave.split("|");
    const permitido = puedeRetornar(estado, obraId, articuloId, ahora);
    if (total > permitido) {
      return fallo(
        "STOCK_INSUFICIENTE",
        `Esa obra tiene ${permitido} sin devolver de ${articuloId}, no ${total}`,
      );
    }
  }

  let inventario = estado.inventario;
  const asientos: Asiento[] = [];

  for (const l of lineas) {
    const articulo = estado.articulos.find((a) => a.id === l.articuloId);
    if (!articulo) return fallo("CANTIDAD_INVALIDA", "Artículo desconocido");

    const r = aplicar(
      inventario,
      {
        tipo: "retorno",
        obraId: l.obraId,
        condicion: l.condicion,
        cantidad: l.cantidad,
        articuloId: l.articuloId,
        almacenId: l.almacenId,
        ubicacionId: l.ubicacionId,
        usuarioId: USUARIO,
      },
      articulo,
    );
    if (!r.ok) return r;

    inventario = r.valor.estado;
    asientos.push(r.valor.asiento);
  }

  setEstado({ ...estado, inventario });
  return ok(asientos);
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
