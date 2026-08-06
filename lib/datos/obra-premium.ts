import { aNumero, leerCsv, normalizarEncabezado } from "@/lib/dominio/importacion";
import { estaAbierta } from "@/lib/dominio/compras";
import type { Articulo, Obra } from "@/lib/dominio/tipos";
import type { EstadoApolo } from "@/lib/db/almacen";
import { deudaDeObra, despachosDeObra, solicitudesDeObra } from "@/lib/datos/obras";

/**
 * Funciones Premium del módulo de Obras.
 *
 * Todo aquí es puro: sin React, sin almacén, sin red. Es donde viven las tres
 * reglas que el cliente pidió y que no pueden estar dentro de un componente:
 * el control de presupuesto, el bloqueo de cierre y el escalado de deuda.
 */

// ---------------------------------------------------------------------------
// 1 · Presupuesto de material contra consumo real
// ---------------------------------------------------------------------------

/**
 * Una línea de presupuesto: cuánto material se previó para una obra.
 *
 * Se presupuesta por ARTÍCULO y no un monto global por obra porque es lo que un
 * cómputo métrico produce, y porque un total suelto no permite ver que la
 * desviación viene del cemento y no del acero — que es justo la pregunta.
 */
export interface LineaPresupuesto {
  obraCodigo: string;
  articuloCodigo: string;
  cantidad: number;
  costoUnitarioUsd: number;
}

export interface Presupuesto {
  lineas: LineaPresupuesto[];
  importadoEn: string;
  archivo: string;
}

/** Cómo va una obra frente a lo presupuestado, artículo por artículo. */
export interface RenglonAvance {
  articulo: Articulo | null;
  articuloCodigo: string;
  presupuestadoUsd: number;
  /** Ya entregado a la obra y no devuelto: gastado de verdad. */
  consumidoUsd: number;
  /** Aprobado y pendiente de despachar: comprometido, aún no gastado. */
  comprometidoUsd: number;
  /** consumido + comprometido − presupuestado. Positivo = sobrepasa. */
  desviacionUsd: number;
  /** Fracción 0..n de lo presupuestado que ya está gastado o comprometido. */
  consumo: number | null;
}

export interface AvanceObra {
  obra: Obra;
  presupuestadoUsd: number;
  consumidoUsd: number;
  comprometidoUsd: number;
  desviacionUsd: number;
  /** `null` cuando la obra no tiene presupuesto cargado. */
  consumo: number | null;
  renglones: RenglonAvance[];
  /** Renglones que superan lo presupuestado, del peor al menos malo. */
  excedidos: RenglonAvance[];
}

/**
 * Estado de la obra frente a su presupuesto.
 *
 * COMPROMETIDO NO ES CONSUMIDO, y separarlos es la razón de ser de esto: lo
 * comprometido todavía se puede parar —una solicitud aprobada sin despachar se
 * anula—, y lo consumido ya no. Sumarlos en una sola cifra quitaría al gerente
 * la única ventana en la que puede actuar.
 *
 * Las órdenes de compra NO entran: en Apolo una orden no lleva obra, así que
 * atribuirle su importe a una obra concreta sería inventar.
 */
export function avanceContraPresupuesto(
  estado: EstadoApolo,
  obra: Obra,
  presupuesto: Presupuesto | null,
): AvanceObra {
  const porCodigo = new Map(estado.articulos.map((a) => [a.codigo, a]));
  const lineas = (presupuesto?.lineas ?? []).filter((l) => l.obraCodigo === obra.codigo);

  // Consumido: lo que salió a la obra y no volvió, valorizado del kardex.
  const consumido = new Map<string, number>();
  for (const a of estado.inventario.asientos) {
    if (a.obraId !== obra.id || a.delta.enObra <= 0) continue;
    const art = estado.articulos.find((x) => x.id === a.articuloId);
    if (!art) continue;
    consumido.set(
      art.codigo,
      (consumido.get(art.codigo) ?? 0) + a.delta.enObra * art.costoPromedioUsd,
    );
  }

  // Comprometido: aprobado y pendiente de despachar. Todavía se puede parar.
  const comprometido = new Map<string, number>();
  for (const s of solicitudesDeObra(estado, obra.id)) {
    if (s.estado !== "aprobada" && s.estado !== "en_preparacion") continue;
    for (const l of s.lineas) {
      const art = estado.articulos.find((x) => x.id === l.articuloId);
      if (!art) continue;
      const pendiente = Math.max(0, l.cantidadSolicitada - l.cantidadDespachada);
      if (pendiente <= 0) continue;
      comprometido.set(
        art.codigo,
        (comprometido.get(art.codigo) ?? 0) + pendiente * art.costoPromedioUsd,
      );
    }
  }

  // Se recorren TODOS los códigos vistos, no solo los presupuestados: un
  // artículo consumido que nadie previó es exactamente la desviación que hay
  // que enseñar, y omitirlo la escondería.
  const codigos = new Set<string>([
    ...lineas.map((l) => l.articuloCodigo),
    ...consumido.keys(),
    ...comprometido.keys(),
  ]);

  const renglones: RenglonAvance[] = [...codigos].map((codigo) => {
    const presupuestadoUsd = lineas
      .filter((l) => l.articuloCodigo === codigo)
      .reduce((s, l) => s + l.cantidad * l.costoUnitarioUsd, 0);
    const consumidoUsd = consumido.get(codigo) ?? 0;
    const comprometidoUsd = comprometido.get(codigo) ?? 0;
    return {
      articulo: porCodigo.get(codigo) ?? null,
      articuloCodigo: codigo,
      presupuestadoUsd,
      consumidoUsd,
      comprometidoUsd,
      desviacionUsd: consumidoUsd + comprometidoUsd - presupuestadoUsd,
      consumo:
        presupuestadoUsd > 0 ? (consumidoUsd + comprometidoUsd) / presupuestadoUsd : null,
    };
  });

  const presupuestadoUsd = renglones.reduce((s, r) => s + r.presupuestadoUsd, 0);
  const consumidoUsd = renglones.reduce((s, r) => s + r.consumidoUsd, 0);
  const comprometidoUsd = renglones.reduce((s, r) => s + r.comprometidoUsd, 0);

  return {
    obra,
    presupuestadoUsd,
    consumidoUsd,
    comprometidoUsd,
    desviacionUsd: consumidoUsd + comprometidoUsd - presupuestadoUsd,
    consumo: presupuestadoUsd > 0 ? (consumidoUsd + comprometidoUsd) / presupuestadoUsd : null,
    renglones: renglones.sort((a, b) => b.consumidoUsd - a.consumidoUsd),
    excedidos: renglones
      .filter((r) => r.presupuestadoUsd > 0 && r.desviacionUsd > 0)
      .sort((a, b) => b.desviacionUsd - a.desviacionUsd),
  };
}

/** Umbral a partir del cual la obra entra en aviso. */
export const AVISO_CONSUMO = 0.85;
export const CRITICO_CONSUMO = 1;

export function estadoPresupuesto(
  consumo: number | null,
): "sin-presupuesto" | "normal" | "aviso" | "excedido" {
  if (consumo === null) return "sin-presupuesto";
  if (consumo >= CRITICO_CONSUMO) return "excedido";
  if (consumo >= AVISO_CONSUMO) return "aviso";
  return "normal";
}

// ---------------------------------------------------------------------------
// Importación del presupuesto
// ---------------------------------------------------------------------------

export interface ResultadoPresupuesto {
  lineas: LineaPresupuesto[];
  errores: string[];
  /** Códigos de artículo que no existen en el catálogo. Se informan. */
  desconocidos: string[];
}

/**
 * Lee el presupuesto de material.
 *
 * Formato: `obra;articulo;cantidad;costo_unitario`, con cabecera.
 *
 * Los artículos que no están en el catálogo se DEVUELVEN en vez de aceptarse en
 * silencio: un código mal escrito produciría una línea de presupuesto que nunca
 * se cruzaría con ningún consumo, y la obra parecería estar gastando de menos.
 */
export function importarPresupuesto(
  texto: string,
  codigosValidos: Set<string>,
): ResultadoPresupuesto {
  const lineas: LineaPresupuesto[] = [];
  const errores: string[] = [];
  const desconocidos = new Set<string>();

  const separador = detectarSeparador(texto);
  const filas = leerCsv(texto, separador);
  if (filas.length === 0) {
    return { lineas, errores: ["El archivo está vacío."], desconocidos: [] };
  }

  for (const [i, fila] of filas.entries()) {
    if (fila.length < 4) continue;
    const primera = normalizarEncabezado(fila[0] ?? "");
    if (primera === "obra" || primera === "codigo obra") continue;

    const obraCodigo = (fila[0] ?? "").trim();
    const articuloCodigo = (fila[1] ?? "").trim();
    if (!obraCodigo || !articuloCodigo) continue;

    const cantidad = aNumero(fila[2] ?? "");
    const costo = aNumero(fila[3] ?? "");
    if (cantidad === null || costo === null) {
      errores.push(`Fila ${i + 1}: cantidad o costo no son números.`);
      continue;
    }
    if (cantidad < 0 || costo < 0) {
      // Un presupuesto negativo no existe; casi siempre es una columna corrida.
      errores.push(`Fila ${i + 1}: cantidad o costo negativos.`);
      continue;
    }
    if (!codigosValidos.has(articuloCodigo)) desconocidos.add(articuloCodigo);

    lineas.push({ obraCodigo, articuloCodigo, cantidad, costoUnitarioUsd: costo });
  }

  return { lineas, errores, desconocidos: [...desconocidos] };
}

function detectarSeparador(texto: string): string {
  const primera = texto.split(/\r?\n/, 1)[0] ?? "";
  const pyc = (primera.match(/;/g) ?? []).length;
  const coma = (primera.match(/,/g) ?? []).length;
  const tab = (primera.match(/\t/g) ?? []).length;
  if (tab > pyc && tab > coma) return "\t";
  return pyc >= coma ? ";" : ",";
}

export function plantillaPresupuestoCsv(): string {
  return [
    ["Obra", "Articulo", "Cantidad", "Costo unitario"],
    ["OBR-2401", "CEM-42R", "1200", "8.40"],
    ["OBR-2401", "ACE-12MM", "3400", "1.15"],
  ]
    .map((f) => f.join(";"))
    .join("\r\n");
}

// ---------------------------------------------------------------------------
// 3 · Cierre de obra con lista bloqueante
// ---------------------------------------------------------------------------

export type GravedadBloqueo = "bloqueante" | "advertencia";

export interface Bloqueo {
  id: string;
  gravedad: GravedadBloqueo;
  titulo: string;
  detalle: string;
  /** Módulo donde se resuelve. */
  enlace: string;
  cantidad: number;
}

export interface Cierre {
  puedeCerrar: boolean;
  bloqueos: Bloqueo[];
  advertencias: Bloqueo[];
}

/**
 * Lista de verificación de cierre.
 *
 * BLOQUEANTE frente a ADVERTENCIA no es un matiz: lo bloqueante deja saldo o
 * responsabilidad viva —material que alguien tiene que devolver, dinero que no
 * cuadra—, y cerrar la obra con eso encima lo hace desaparecer del panel sin
 * que se haya resuelto. Lo demás molesta pero no falsea nada.
 *
 * Es la misma lógica que el resto del producto: el sistema no OFRECE el paso,
 * en vez de dejar hacerlo y avisar después.
 */
export function verificarCierre(
  estado: EstadoApolo,
  obra: Obra,
  ahoraMs: number,
): Cierre {
  const bloqueos: Bloqueo[] = [];
  const advertencias: Bloqueo[] = [];

  const deuda = deudaDeObra(estado, obra.id, ahoraMs);
  const unidadesDeuda = deuda.reduce((s, d) => s + d.unidades, 0);
  if (unidadesDeuda > 0) {
    const valor = deuda.reduce((s, d) => s + d.valorUsd, 0);
    bloqueos.push({
      id: "herramienta",
      gravedad: "bloqueante",
      titulo: "Herramienta sin retornar",
      detalle: `${Math.round(unidadesDeuda)} unidades en ${deuda.length} renglones, por USD ${Math.round(valor)}. Alguien tiene que devolverlas.`,
      enlace: "/herramientas",
      cantidad: Math.round(unidadesDeuda),
    });
  }

  const material = estado.inventario.asientos
    .filter((a) => a.obraId === obra.id)
    .reduce((s, a) => s + a.delta.enObra, 0);
  const consumibleVivo = Math.round(material - unidadesDeuda);
  if (consumibleVivo > 0) {
    advertencias.push({
      id: "material",
      gravedad: "advertencia",
      titulo: "Material entregado sin consumir",
      detalle: `${consumibleVivo} unidades siguen contabilizadas en la obra. Conviene registrar el consumo o devolverlas antes de cerrar.`,
      enlace: `/obras/${obra.id}`,
      cantidad: consumibleVivo,
    });
  }

  const abiertas = solicitudesDeObra(estado, obra.id).filter(
    (s) => !["cerrada", "anulada", "rechazada", "entregada"].includes(s.estado),
  );
  if (abiertas.length > 0) {
    bloqueos.push({
      id: "solicitudes",
      gravedad: "bloqueante",
      titulo: "Solicitudes abiertas",
      detalle: `${abiertas.length} solicitudes sin cerrar. Cerrar la obra las dejaría huérfanas.`,
      enlace: "/solicitudes",
      cantidad: abiertas.length,
    });
  }

  const discrepancias = despachosDeObra(estado, obra.id).filter(
    (d) => d.estado === "con_discrepancia",
  );
  if (discrepancias.length > 0) {
    bloqueos.push({
      id: "discrepancias",
      gravedad: "bloqueante",
      titulo: "Entregas con discrepancia",
      detalle: `${discrepancias.length} entregas donde lo recibido no coincidió con lo despachado. Es dinero que no cuadra.`,
      enlace: "/despacho",
      cantidad: discrepancias.length,
    });
  }

  const enRuta = despachosDeObra(estado, obra.id).filter(
    (d) => d.estado === "en_ruta" || d.estado === "listo",
  );
  if (enRuta.length > 0) {
    bloqueos.push({
      id: "en_ruta",
      gravedad: "bloqueante",
      titulo: "Despachos en camino",
      detalle: `${enRuta.length} despachos todavía no han llegado. Cerrar ahora dejaría material sin destino.`,
      enlace: "/despacho",
      cantidad: enRuta.length,
    });
  }

  const compras = estado.ordenes.filter(estaAbierta).length;
  if (compras > 0) {
    // Advertencia y no bloqueo: la orden no lleva obra, así que no se puede
    // afirmar que sea de ESTA. Se informa para que alguien lo compruebe.
    advertencias.push({
      id: "compras",
      gravedad: "advertencia",
      titulo: "Órdenes de compra abiertas en el sistema",
      detalle: `${compras} órdenes sin recibir. Apolo no asocia órdenes a obras, así que conviene revisar si alguna es de esta.`,
      enlace: "/compras",
      cantidad: compras,
    });
  }

  return { puedeCerrar: bloqueos.length === 0, bloqueos, advertencias };
}

// ---------------------------------------------------------------------------
// 5 · Deuda de herramienta con responsable y escalado
// ---------------------------------------------------------------------------

export type Tramo = "reciente" | "30" | "60" | "90";

export interface DeudaEscalada {
  articuloCodigo: string;
  descripcion: string;
  unidades: number;
  valorUsd: number;
  diasMax: number;
  tramo: Tramo;
  /** Quién registró la salida. Es el rastro que Apolo sí tiene. */
  responsable: string;
  /** ISO de la salida más antigua sin devolver. */
  desde: string;
}

/** Días a partir de los cuales sube el tramo. */
export const TRAMOS: { tramo: Tramo; dias: number }[] = [
  { tramo: "90", dias: 90 },
  { tramo: "60", dias: 60 },
  { tramo: "30", dias: 30 },
  { tramo: "reciente", dias: 0 },
];

export function tramoDe(dias: number): Tramo {
  return TRAMOS.find((t) => dias >= t.dias)?.tramo ?? "reciente";
}

/**
 * Deuda con responsable y tramo de antigüedad.
 *
 * El responsable sale de `usuarioId` del asiento de salida: es quien registró
 * el movimiento, que es el único rastro de persona que Apolo guarda hoy. NO es
 * necesariamente quien tiene la herramienta en la mano — para eso haría falta
 * un campo de custodio en el préstamo, y llamarlo "responsable" sin decir esto
 * atribuiría a alguien una responsabilidad que quizá no tiene.
 */
export function deudaEscalada(
  estado: EstadoApolo,
  obraId: string,
  ahoraMs: number,
): DeudaEscalada[] {
  const deuda = deudaDeObra(estado, obraId, ahoraMs);

  return deuda
    .map((d) => {
      // Salida más antigua sin devolver de este artículo en esta obra.
      const salidas = estado.inventario.asientos
        .filter(
          (a) =>
            a.obraId === obraId &&
            a.articuloId === d.articulo.id &&
            a.delta.enObra > 0,
        )
        .sort((a, b) => Date.parse(a.fecha) - Date.parse(b.fecha));

      const primera = salidas[0];
      return {
        articuloCodigo: d.articulo.codigo,
        descripcion: d.articulo.descripcion,
        unidades: d.unidades,
        valorUsd: d.valorUsd,
        diasMax: d.diasMax,
        tramo: tramoDe(d.diasMax),
        responsable: primera?.usuarioId ?? "—",
        desde: primera?.fecha ?? new Date(ahoraMs).toISOString(),
      };
    })
    .sort((a, b) => b.diasMax - a.diasMax);
}

export interface ResumenEscalado {
  porTramo: Record<Tramo, { unidades: number; valorUsd: number; renglones: number }>;
  /** Valor en riesgo: lo que lleva más de 60 días fuera. */
  enRiesgoUsd: number;
  vencidas: DeudaEscalada[];
}

/**
 * Agrupa la deuda por tramo y calcula el valor en riesgo.
 *
 * El corte del riesgo está en 60 días y no en 90 porque a los tres meses una
 * herramienta ya no se recupera casi nunca: para cuando entra en el tramo de 90
 * la conversación ya no es de recuperarla, es de darla de baja.
 */
export function resumirEscalado(deudas: DeudaEscalada[]): ResumenEscalado {
  const vacio = () => ({ unidades: 0, valorUsd: 0, renglones: 0 });
  const porTramo: Record<Tramo, { unidades: number; valorUsd: number; renglones: number }> = {
    reciente: vacio(),
    "30": vacio(),
    "60": vacio(),
    "90": vacio(),
  };

  for (const d of deudas) {
    const t = porTramo[d.tramo];
    t.unidades += d.unidades;
    t.valorUsd += d.valorUsd;
    t.renglones += 1;
  }

  return {
    porTramo,
    enRiesgoUsd: porTramo["60"].valorUsd + porTramo["90"].valorUsd,
    vencidas: deudas.filter((d) => d.tramo === "60" || d.tramo === "90"),
  };
}

/** Días que lleva fuera la deuda más antigua. Para el aviso automático. */
export function diasVencidos(deudas: DeudaEscalada[]): number {
  return deudas.reduce((m, d) => Math.max(m, d.diasMax), 0);
}
