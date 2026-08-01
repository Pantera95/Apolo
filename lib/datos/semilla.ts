/**
 * Semilla de demostración.
 *
 * *** DATOS FICTICIOS. *** No provienen del cliente ni pretenden parecerse a
 * sus cifras reales: sirven para que la presentación pueda recorrer el producto
 * con las pantallas llenas. El botón "Reiniciar a cero" deja el sistema como
 * recién instalado.
 *
 * Se construye EJECUTANDO las funciones puras del dominio, no escribiendo
 * saldos a mano. Así el kardex y las existencias nacen cuadrados por
 * construcción, y si una regla de negocio los rechazara, la semilla falla en
 * vez de producir un inventario imposible.
 */

import type { EstadoApolo } from "@/lib/db/almacen";
import { aplicar, ESTADO_VACIO, type EstadoInventario, type Operacion } from "@/lib/dominio/inventario";
import type {
  Almacen,
  Articulo,
  ClaveSaldo,
  Obra,
  Ubicacion,
} from "@/lib/dominio/tipos";
import type { Solicitud } from "@/lib/dominio/despacho";

// ---------------------------------------------------------------------------
// Catálogos ficticios
// ---------------------------------------------------------------------------

const ALMACENES: Almacen[] = [
  { id: "alm-cen", codigo: "ALM-CEN", nombre: "Almacén Central", activo: true },
  { id: "alm-pat", codigo: "ALM-PAT", nombre: "Patio Industrial", activo: true },
  { id: "alm-obr", codigo: "ALM-OBR", nombre: "Depósito de Obra", activo: true },
];

const UBICACIONES: Ubicacion[] = [
  { id: "ubi-a1", almacenId: "alm-cen", pasillo: "A", rack: "1", ordenRecorrido: 10 },
  { id: "ubi-a2", almacenId: "alm-cen", pasillo: "A", rack: "2", ordenRecorrido: 20 },
  { id: "ubi-b1", almacenId: "alm-cen", pasillo: "B", rack: "1", ordenRecorrido: 30 },
  { id: "ubi-b2", almacenId: "alm-cen", pasillo: "B", rack: "2", ordenRecorrido: 40 },
  { id: "ubi-p1", almacenId: "alm-pat", pasillo: "P", rack: "1", ordenRecorrido: 10 },
  { id: "ubi-p2", almacenId: "alm-pat", pasillo: "P", rack: "2", ordenRecorrido: 20 },
  { id: "ubi-o1", almacenId: "alm-obr", pasillo: "O", rack: "1", ordenRecorrido: 10 },
];

const OBRAS: Obra[] = [
  {
    id: "obr-2401",
    codigo: "OBR-2401",
    nombre: "Planta deshidratadora — módulo 2",
    ubicacionGeografica: "Anaco",
    estado: "activa",
  },
  {
    id: "obr-2402",
    codigo: "OBR-2402",
    nombre: 'Línea de flujo 12" tramo norte',
    ubicacionGeografica: "El Tigre",
    estado: "activa",
  },
  {
    id: "obr-2403",
    codigo: "OBR-2403",
    nombre: "Mantenimiento mayor estación 5",
    ubicacionGeografica: "Punta de Mata",
    estado: "activa",
  },
  {
    id: "obr-2404",
    codigo: "OBR-2404",
    nombre: "Montaje tanque TK-301",
    ubicacionGeografica: "Jose",
    estado: "suspendida",
  },
];

type Fila = [
  id: string,
  codigo: string,
  descripcion: string,
  clase: Articulo["clase"],
  unidadBase: Articulo["unidadBase"],
  costo: number,
  equivalencias?: Articulo["equivalencias"],
];

const FILAS: Fila[] = [
  // Consumibles
  ["art-01", "ELE-6013", 'Electrodo E6013 1/8"', "consumible", "kg", 4.2, { caja: 20 }],
  ["art-02", "ELE-7018", 'Electrodo E7018 1/8"', "consumible", "kg", 5.8, { caja: 20 }],
  ["art-03", "TOR-58", 'Tornillo galvanizado 5/8" x 3"', "consumible", "und", 0.85, { caja: 50 }],
  ["art-04", "TUE-58", 'Tuerca hexagonal 5/8"', "consumible", "und", 0.32, { caja: 100 }],
  ["art-05", "DIS-45", 'Disco de corte 4-1/2"', "consumible", "und", 1.9, { caja: 25 }],
  ["art-06", "PIN-EPX", "Pintura epóxica gris RAL 7035", "consumible", "gal", 38, { cunete: 5 }],
  ["art-07", "CIN-TEF", 'Cinta de teflón 1/2"', "consumible", "und", 0.6, { caja: 100 }],
  ["art-08", "GUA-NIT", "Guantes de nitrilo talla L", "consumible", "par", 2.4, { caja: 12 }],
  ["art-09", "CEM-GRIS", "Cemento gris tipo I", "consumible", "kg", 0.18, { saco: 42.5 }],
  ["art-10", "ARE-LAV", "Arena lavada", "consumible", "m3", 24, undefined],
  ["art-11", "CAB-20", "Cable THW 2/0 AWG", "consumible", "m", 9.4, { rollo: 100 }],
  ["art-12", "OXI-IND", "Oxígeno industrial", "consumible", "m3", 6.1, undefined],

  // Retornables — la deuda que hoy nadie mide
  ["art-13", "LLA-C14", "Llave combinada 14 mm", "retornable", "und", 12, undefined],
  ["art-14", "SIE-CIR", 'Sierra circular 7-1/4"', "retornable", "und", 145, undefined],
  ["art-15", "ESM-ANG", 'Esmeril angular 4-1/2"', "retornable", "und", 98, undefined],
  ["art-16", "TAL-PER", "Taladro percutor 1/2 HP", "retornable", "und", 210, undefined],
  ["art-17", "AND-MOD", "Cuerpo de andamio modular", "retornable", "und", 87, undefined],
  ["art-18", "MAN-HID", "Manómetro hidráulico 0-600 bar", "retornable", "und", 165, undefined],
  ["art-19", "EQU-SOL", "Máquina de soldar 400 A", "retornable", "und", 1850, undefined],

  // Certificados — trazabilidad de colada, requisito de la industria
  ["art-20", "TUB-CS6", 'Tubería CS A106 Gr.B 6" SCH40', "certificado", "m", 62, undefined],
  ["art-21", "VAL-GA4", 'Válvula de compuerta 4" 150#', "certificado", "und", 480, undefined],
  ["art-22", "BRI-WN6", 'Brida weld neck 6" 150#', "certificado", "und", 74, undefined],
  ["art-23", "COD-904", 'Codo 90° 4" SCH40', "certificado", "und", 38, undefined],
];

const ARTICULOS: Articulo[] = FILAS.map(
  ([id, codigo, descripcion, clase, unidadBase, costoPromedioUsd, equivalencias]) => ({
    id,
    codigo,
    descripcion,
    clase,
    unidadBase,
    costoPromedioUsd,
    equivalencias,
    activo: true,
  }),
);

const PORID = new Map(ARTICULOS.map((a) => [a.id, a]));

// ---------------------------------------------------------------------------
// Guion de movimientos
// ---------------------------------------------------------------------------

/** [artículo, ubicación, recibido, despachado a obra, retornado, mermado] */
type Guion = [string, string, number, number?, string?, number?, number?];

const GUION: Guion[] = [
  ["art-01", "ubi-a1", 480, 120, "obr-2401", 0, 6],
  ["art-02", "ubi-a1", 360, 90, "obr-2402", 0, 0],
  ["art-03", "ubi-a2", 5000, 1800, "obr-2401", 0, 40],
  ["art-04", "ubi-a2", 6000, 1800, "obr-2401", 0, 0],
  ["art-05", "ubi-a2", 750, 300, "obr-2403", 0, 12],
  ["art-06", "ubi-b1", 140, 45, "obr-2404", 0, 0],
  ["art-07", "ubi-a2", 900, 250, "obr-2402", 0, 0],
  ["art-08", "ubi-b1", 480, 168, "obr-2403", 0, 24],
  ["art-09", "ubi-p1", 21250, 8500, "obr-2404", 0, 0],
  ["art-10", "ubi-p1", 180, 60, "obr-2404", 0, 0],
  ["art-11", "ubi-b2", 2400, 700, "obr-2401", 0, 0],
  ["art-12", "ubi-p2", 320, 110, "obr-2402", 0, 0],

  ["art-13", "ubi-b1", 60, 24, "obr-2401", 14, 0],
  ["art-14", "ubi-b1", 12, 6, "obr-2402", 2, 0],
  ["art-15", "ubi-b1", 18, 9, "obr-2401", 4, 0],
  ["art-16", "ubi-b1", 14, 7, "obr-2403", 3, 0],
  ["art-17", "ubi-p1", 420, 180, "obr-2404", 60, 0],
  ["art-18", "ubi-b2", 8, 4, "obr-2402", 1, 0],
  ["art-19", "ubi-p2", 6, 3, "obr-2401", 1, 0],

  ["art-20", "ubi-p1", 900, 320, "obr-2402", 0, 0],
  ["art-21", "ubi-b2", 24, 8, "obr-2402", 0, 0],
  ["art-22", "ubi-b2", 96, 32, "obr-2402", 0, 0],
  ["art-23", "ubi-o1", 150, 40, "obr-2403", 0, 0],
];

const USUARIO = "demo-owner";

function ubicacion(ubicacionId: string): ClaveSaldo {
  const u = UBICACIONES.find((x) => x.id === ubicacionId);
  if (!u) throw new Error(`Ubicación inexistente en la semilla: ${ubicacionId}`);
  return { articuloId: "", almacenId: u.almacenId, ubicacionId: u.id };
}

/** Aplica una operación y revienta si el dominio la rechaza. */
function paso(
  estado: EstadoInventario,
  op: Operacion,
  articuloId: string,
): EstadoInventario {
  const articulo = PORID.get(articuloId);
  if (!articulo) throw new Error(`Artículo inexistente en la semilla: ${articuloId}`);
  const r = aplicar(estado, op, articulo);
  if (!r.ok) {
    throw new Error(
      `Semilla inconsistente en ${articulo.codigo} (${op.tipo}): ${r.error.codigo} — ${r.error.detalle}`,
    );
  }
  return r.valor.estado;
}

function diasAtras(ahora: Date, dias: number): string {
  return new Date(ahora.getTime() - dias * 86_400_000).toISOString();
}

// ---------------------------------------------------------------------------
// Construcción
// ---------------------------------------------------------------------------

export function construirSemilla(ahora: Date = new Date()): EstadoApolo {
  let inv = ESTADO_VACIO;

  GUION.forEach(([articuloId, ubiId, recibido, despachado, obraId, retornado, mermado], i) => {
    const clave = { ...ubicacion(ubiId), articuloId };
    const base = { ...clave, usuarioId: USUARIO };

    inv = paso(
      inv,
      { tipo: "recepcion", cantidad: recibido, fecha: diasAtras(ahora, 45 - (i % 12)), ...base },
      articuloId,
    );

    if (despachado && obraId) {
      const f = 30 - (i % 20);
      inv = paso(inv, { tipo: "reserva", cantidad: despachado, obraId, fecha: diasAtras(ahora, f + 2), ...base }, articuloId);
      inv = paso(inv, { tipo: "despacho", cantidad: despachado, obraId, fecha: diasAtras(ahora, f + 1), ...base }, articuloId);
      inv = paso(inv, { tipo: "entrega", cantidad: despachado, obraId, fecha: diasAtras(ahora, f), ...base }, articuloId);
    }

    // Solo los retornables vuelven; el dominio rechaza el resto y por eso el
    // guion no puede pedirlo por error.
    if (retornado && obraId) {
      inv = paso(
        inv,
        { tipo: "retorno", cantidad: retornado, obraId, condicion: "bueno", fecha: diasAtras(ahora, 5 + (i % 4)), ...base },
        articuloId,
      );
    }

    if (mermado) {
      inv = paso(
        inv,
        { tipo: "ajuste", signo: -1, cantidad: mermado, motivo: "merma", fecha: diasAtras(ahora, 3 + (i % 5)), ...base },
        articuloId,
      );
    }
  });

  // Un par de herramientas vuelven averiadas: es lo que hace visible la
  // diferencia entre "retornó" y "retornó sirviendo".
  inv = paso(
    inv,
    {
      tipo: "retorno",
      cantidad: 2,
      obraId: "obr-2401",
      condicion: "averiado",
      fecha: diasAtras(ahora, 2),
      usuarioId: USUARIO,
      ...ubicacion("ubi-b1"),
      articuloId: "art-13",
    },
    "art-13",
  );

  return {
    articulos: ARTICULOS,
    almacenes: ALMACENES,
    ubicaciones: UBICACIONES,
    obras: OBRAS,
    solicitudes: solicitudes(ahora),
    inventario: inv,
  };
}

function solicitudes(ahora: Date): Solicitud[] {
  const crudas: [string, string, Solicitud["estado"], [string, number, number][]][] = [
    ["SOL-0148", "obr-2401", "solicitada", [["art-03", 1200, 0], ["art-04", 1200, 0]]],
    ["SOL-0149", "obr-2402", "solicitada", [["art-20", 240, 0], ["art-22", 16, 0]]],
    ["SOL-0150", "obr-2403", "solicitada", [["art-05", 150, 0]]],
    ["SOL-0151", "obr-2401", "aprobada", [["art-01", 80, 0], ["art-02", 40, 0]]],
    ["SOL-0152", "obr-2402", "en_preparacion", [["art-11", 400, 120]]],
    ["SOL-0153", "obr-2403", "despachada", [["art-08", 96, 96]]],
    ["SOL-0154", "obr-2401", "entregada", [["art-15", 6, 6]]],
    ["SOL-0155", "obr-2404", "rechazada", [["art-09", 4250, 0]]],
  ];

  return crudas.map(([codigo, obraId, estado, lineas], i) => ({
    id: `sol-${codigo}`,
    codigo,
    obraId,
    estado,
    creadaPor: USUARIO,
    aprobadaPor: estado === "solicitada" ? undefined : USUARIO,
    fecha: diasAtras(ahora, 12 - i),
    lineas: lineas.map(([articuloId, cantidadSolicitada, cantidadDespachada]) => ({
      articuloId,
      cantidadSolicitada,
      cantidadDespachada,
    })),
  }));
}
