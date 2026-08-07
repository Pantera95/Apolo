import {
  INCOTERMS,
  MATRIZ_DOA,
  ORDEN_ETAPA,
  type EtapaProcura,
  type OfertaProveedor,
  type ProcesoProcura,
} from "@/lib/procura/tipos";

/**
 * Reglas de procura. Funciones puras, sin React ni almacenamiento.
 *
 * Aquí vive el error caro del módulo: adjudicar al proveedor equivocado. No se
 * detecta al firmar la orden —los números cuadran—, sino cuando la mercancía
 * llega a puerto y aparece un flete que nadie presupuestó.
 */

// ---------------------------------------------------------------------------
// Comparación de ofertas
// ---------------------------------------------------------------------------

/**
 * Costo desembarcado: lo que de verdad cuesta tener el material en obra.
 *
 * COMPARAR PRECIOS CON INCOTERMS DISTINTOS ES EL ERROR CLÁSICO DE PROCURA. Un
 * FOB de 100.000 y un DDP de 118.000 parecen decir que el primero es mejor,
 * pero el FOB no incluye flete, seguro ni aranceles: sumados pueden ser 25.000
 * y entonces el "barato" cuesta 125.000. Quien compara la columna de precio y
 * se queda con la menor adjudica mal de forma sistemática.
 *
 * Los costos que el incoterm ya cubre NO se suman aunque vengan cargados en la
 * oferta: en un DDP el flete es problema del proveedor y ya está dentro de su
 * precio. Sumarlo otra vez lo penalizaría dos veces.
 */
export function costoDesembarcado(o: OfertaProveedor): number {
  const def = INCOTERMS.find((i) => i.id === o.incoterm);
  if (!def) return o.precioUsd;

  return (
    o.precioUsd +
    (def.faltaFlete ? Math.max(0, o.fleteUsd) : 0) +
    (def.faltaSeguro ? Math.max(0, o.seguroUsd) : 0) +
    (def.faltaAduana ? Math.max(0, o.aduanaUsd) : 0)
  );
}

export interface FilaComparativo {
  oferta: OfertaProveedor;
  costoDesembarcadoUsd: number;
  /** Diferencia contra la oferta desembarcada más barata, en porcentaje. */
  sobreMejorPct: number;
  /** Cierto si pasó el dictamen técnico. Solo estas compiten en precio. */
  elegible: boolean;
}

/**
 * Cuadro comparativo.
 *
 * ORDENA POR COSTO DESEMBARCADO, no por precio de oferta. Y las ofertas
 * rechazadas técnicamente se listan pero NO se descartan de la vista: el
 * expediente tiene que enseñar a quién se dejó fuera y por qué, o la
 * adjudicación no es auditable.
 *
 * El porcentaje de sobreprecio se calcula solo contra ofertas ELEGIBLES: si la
 * más barata está técnicamente rechazada, compararse con ella daría la
 * impresión de que el adjudicado es caro cuando no había alternativa.
 */
export function compararOfertas(ofertas: OfertaProveedor[]): FilaComparativo[] {
  const filas = ofertas.map((oferta) => ({
    oferta,
    costoDesembarcadoUsd: costoDesembarcado(oferta),
    sobreMejorPct: 0,
    elegible: oferta.estado === "aprobada_tecnica" || oferta.estado === "adjudicada",
  }));

  const elegibles = filas.filter((f) => f.elegible);
  const mejor = elegibles.length > 0
    ? Math.min(...elegibles.map((f) => f.costoDesembarcadoUsd))
    : 0;

  for (const f of filas) {
    f.sobreMejorPct =
      mejor > 0 ? ((f.costoDesembarcadoUsd - mejor) / mejor) * 100 : 0;
  }

  // Elegibles primero, y dentro de cada bloque por costo desembarcado.
  return filas.sort((a, b) => {
    if (a.elegible !== b.elegible) return a.elegible ? -1 : 1;
    return a.costoDesembarcadoUsd - b.costoDesembarcadoUsd;
  });
}

/**
 * La oferta recomendada: la más barata DE LAS QUE PASARON lo técnico.
 *
 * Devuelve `null` cuando ninguna pasó. No se recomienda "la menos mala": una
 * oferta que no cumple la norma API o ASME no es una opción más cara, es una
 * opción que no existe, y sugerirla invita a adjudicarla.
 */
export function recomendada(ofertas: OfertaProveedor[]): OfertaProveedor | null {
  const elegibles = ofertas.filter(
    (o) => o.estado === "aprobada_tecnica" || o.estado === "adjudicada",
  );
  if (elegibles.length === 0) return null;
  return elegibles.reduce((mejor, o) =>
    costoDesembarcado(o) < costoDesembarcado(mejor) ? o : mejor,
  );
}

// ---------------------------------------------------------------------------
// Puertas de etapa
// ---------------------------------------------------------------------------

export interface Requisito {
  texto: string;
  cumple: boolean;
}

/**
 * Qué falta para poder salir de la etapa actual.
 *
 * ES UNA PUERTA, NO UN AVISO. Igual que la aprobación bloqueante de las
 * solicitudes: si un requisito no se cumple, el expediente no avanza. Un
 * proceso que puede saltar de licitación a adjudicación sin dictamen técnico
 * produce compras que ningún auditor puede justificar después.
 */
export function requisitos(p: ProcesoProcura): Requisito[] {
  switch (p.etapa) {
    case "requisicion":
      return [
        { texto: "Al menos una partida cargada", cumple: p.partidas.length > 0 },
        {
          texto: "Todas las partidas con norma o especificación",
          cumple: p.partidas.length > 0 && p.partidas.every((i) => i.norma.trim() !== ""),
        },
        {
          texto: "Todas las partidas con ficha técnica adjunta",
          cumple: p.partidas.length > 0 && p.partidas.every((i) => i.fichaTecnicaUrl !== null),
        },
        { texto: "Presupuesto base asignado", cumple: p.presupuestoUsd > 0 },
        {
          texto: "Partida presupuestaria imputada",
          cumple: p.partidaPresupuestaria.trim() !== "",
        },
      ];

    case "licitacion":
      return [
        {
          // Tres invitados es la práctica de la industria. Con menos, el
          // expediente necesita justificación de fuente única.
          texto: "Al menos tres ofertas recibidas",
          cumple: p.ofertas.length >= 3,
        },
        {
          texto: "Sin aclaraciones técnicas abiertas",
          cumple: p.aclaraciones.every((a) => a.respuesta !== null),
        },
      ];

    case "evaluacion":
      return [
        {
          texto: "Dictamen técnico emitido para todas las ofertas",
          cumple:
            p.ofertas.length > 0 &&
            p.ofertas.every(
              (o) => o.estado === "aprobada_tecnica" || o.estado === "rechazada_tecnica" || o.estado === "adjudicada",
            ),
        },
        {
          texto: "Al menos una oferta aprobada técnicamente",
          cumple: p.ofertas.some(
            (o) => o.estado === "aprobada_tecnica" || o.estado === "adjudicada",
          ),
        },
        {
          texto: "Ganador seleccionado",
          cumple: p.ofertas.some((o) => o.estado === "adjudicada"),
        },
        { texto: "Monto adjudicado registrado", cumple: (p.adjudicadoUsd ?? 0) > 0 },
      ];

    case "adjudicacion":
      return [
        { texto: "Orden de compra generada", cumple: p.orden !== null },
        {
          texto: "Todas las firmas de la matriz de autorización",
          cumple: p.orden !== null && p.orden.firmas.every((f) => f.firmadoIso !== null),
        },
        {
          texto: "Acuse de recibo del proveedor",
          cumple: p.orden?.acusadaIso !== null && p.orden?.acusadaIso !== undefined,
        },
      ];

    case "cierre":
      return [
        {
          texto: "Expediente con PDF de la orden firmada",
          cumple: p.orden?.pdfUrl !== null && p.orden?.pdfUrl !== undefined,
        },
        { texto: "Pago ejecutado", cumple: p.orden?.estadoFinanciero === "pagado" },
      ];
  }
}

export interface Veredicto {
  puede: boolean;
  faltan: string[];
  siguiente: EtapaProcura | null;
}

const SECUENCIA: EtapaProcura[] = [
  "requisicion",
  "licitacion",
  "evaluacion",
  "adjudicacion",
  "cierre",
];

/** ¿Puede este expediente pasar a la etapa siguiente? */
export function puedeAvanzar(p: ProcesoProcura): Veredicto {
  const faltan = requisitos(p).filter((r) => !r.cumple).map((r) => r.texto);
  const i = ORDEN_ETAPA[p.etapa];
  const siguiente = i < SECUENCIA.length - 1 ? SECUENCIA[i + 1] : null;
  return { puede: faltan.length === 0 && siguiente !== null, faltan, siguiente };
}

/**
 * Retroceder está permitido y no exige requisitos.
 *
 * Un expediente vuelve a licitación porque llegó una aclaración que cambia el
 * alcance, y eso es sano. Lo que no puede es SALTARSE etapas hacia adelante: se
 * avanza de una en una, con su puerta.
 */
export function puedeMover(p: ProcesoProcura, destino: EtapaProcura): Veredicto {
  const actual = ORDEN_ETAPA[p.etapa];
  const nuevo = ORDEN_ETAPA[destino];

  if (nuevo < actual) return { puede: true, faltan: [], siguiente: destino };
  if (nuevo === actual) return { puede: false, faltan: [], siguiente: null };
  if (nuevo > actual + 1) {
    return {
      puede: false,
      faltan: ["No se pueden saltar etapas: hay que avanzar de una en una."],
      siguiente: null,
    };
  }
  const v = puedeAvanzar(p);
  return { ...v, siguiente: destino };
}

// ---------------------------------------------------------------------------
// Matriz de autorización
// ---------------------------------------------------------------------------

/**
 * Firmas exigidas por el monto, acumulativas.
 *
 * Los tramos SE ACUMULAN: una orden de 800.000 USD la firman el analista, el
 * gerente y la dirección. Tratarlos como excluyentes dejaría las órdenes
 * grandes con menos control que las pequeñas.
 */
export function firmasExigidas(montoUsd: number): string[] {
  if (!Number.isFinite(montoUsd) || montoUsd <= 0) return [];
  const roles: string[] = [];
  for (const tramo of MATRIZ_DOA) {
    roles.push(tramo.rol);
    if (montoUsd <= tramo.hastaUsd) break;
  }
  return roles;
}

// ---------------------------------------------------------------------------
// Indicadores
// ---------------------------------------------------------------------------

const DIA_MS = 86_400_000;

/**
 * Lead time: días desde la requisición hasta la orden aprobada.
 *
 * Solo cuenta los expedientes CERRADOS en ese hito. Incluir los que siguen
 * abiertos daría un promedio que baja cuando entra trabajo nuevo, que es lo
 * contrario de lo que mide el indicador.
 */
export function leadTimeDias(procesos: ProcesoProcura[]): number | null {
  const cerrados = procesos.filter((p) => p.ordenAprobadaIso !== null);
  if (cerrados.length === 0) return null;

  const dias = cerrados.map(
    (p) =>
      (new Date(p.ordenAprobadaIso as string).getTime() -
        new Date(p.creadoIso).getTime()) /
      DIA_MS,
  );
  return dias.reduce((s, d) => s + d, 0) / dias.length;
}

/**
 * Ahorro negociado: presupuesto base menos monto adjudicado.
 *
 * Solo sobre expedientes YA ADJUDICADOS. Contar el presupuesto de los que
 * siguen en licitación inflaría el ahorro con dinero que aún no se ha
 * negociado — y ese número acaba en un informe a dirección.
 *
 * Puede salir NEGATIVO, y se devuelve tal cual: adjudicar por encima del
 * presupuesto es información, no un error que haya que esconder en un cero.
 */
export function ahorroUsd(procesos: ProcesoProcura[]): { montoUsd: number; pct: number } {
  const adjudicados = procesos.filter(
    (p) => p.adjudicadoUsd !== null && p.adjudicadoUsd > 0,
  );
  const base = adjudicados.reduce((s, p) => s + p.presupuestoUsd, 0);
  const real = adjudicados.reduce((s, p) => s + (p.adjudicadoUsd ?? 0), 0);
  return { montoUsd: base - real, pct: base > 0 ? ((base - real) / base) * 100 : 0 };
}

/** Volumen y valor de lo que sigue abierto. */
export function activos(procesos: ProcesoProcura[]): { total: number; valorUsd: number } {
  const abiertos = procesos.filter((p) => p.etapa !== "cierre");
  return {
    total: abiertos.length,
    // Se usa el adjudicado cuando existe, y si no el presupuesto: el valor en
    // juego de un expediente ya adjudicado es lo que se comprometió, no lo que
    // se presupuestó.
    valorUsd: abiertos.reduce((s, p) => s + (p.adjudicadoUsd ?? p.presupuestoUsd), 0),
  };
}

/** Reparto por etapa, para el gráfico de anillo. */
export function porEtapa(procesos: ProcesoProcura[]): { etapa: EtapaProcura; total: number; valorUsd: number }[] {
  return SECUENCIA.map((etapa) => {
    const del = procesos.filter((p) => p.etapa === etapa);
    return {
      etapa,
      total: del.length,
      valorUsd: del.reduce((s, p) => s + (p.adjudicadoUsd ?? p.presupuestoUsd), 0),
    };
  });
}
