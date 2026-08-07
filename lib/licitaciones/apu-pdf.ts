import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import {
  AZUL,
  ESTILO_CABEZA,
  ESTILO_CELDA,
  GRIS,
  GRIS_CLARO,
  MARGEN,
  ROJO,
  TINTA,
  avisoDemo,
  cabecera,
  capitulo,
  fecha,
  finalY,
  num,
  pct,
  pie,
  usd,
  type Membrete,
} from "@/lib/licitaciones/pdf-base";
import type { Apu, LineaApu, Parametros } from "@/lib/licitaciones/tipos";
import { DISCIPLINAS } from "@/lib/licitaciones/tipos";

/**
 * Análisis de Precio Unitario, en el formato de planilla del cliente.
 *
 * La estructura NO es una elección estética: es la que audita la operadora.
 * Tres capítulos numerados —materiales, equipos, mano de obra—, cada uno con
 * su subtotal, luego el costo directo y luego los recargos uno debajo de otro.
 * Un APU que presenta el mismo número por otro camino se devuelve sin leer.
 *
 * UN ÍTEM POR PÁGINA. Un APU se revisa, se firma y se archiva por separado:
 * partirlo entre dos hojas obliga a fotocopiar dos veces para archivar una.
 */

export interface DatosApu {
  proyecto: string;
  cliente: string;
  apus: Apu[];
  parametros: Parametros;
  simulado: boolean;
  /** Cierto para los schedules de muestra: se leen de verdad, con datos ficticios. */
  muestra?: boolean;
  preparadoPor: string;
}

function membrete(d: DatosApu): Membrete {
  return {
    empresa: d.cliente,
    documento: "Análisis de Precios Unitarios",
    proyecto: d.proyecto,
    avisoDemo: avisoDemo(d.simulado, d.muestra),
  };
}

/** Filas de un capítulo, con la columna de coeficiente que le corresponde. */
function filas(lineas: LineaApu[]): (string | number)[][] {
  return lineas.map((l) => [
    l.descripcion,
    l.unidad,
    l.esPorcentaje ? pct(l.coeficiente, 2) : num(l.coeficiente, 4),
    l.esPorcentaje ? "—" : num(l.precioUnitarioUsd, 2),
    num(l.costoUsd, 2),
  ]);
}

/**
 * Retícula del APU, más apretada que la del informe.
 *
 * NO ES CAPRICHO: una hoja de APU tiene que caber ENTERA con su bloque de
 * firmas, y con el interlineado del informe los renglones de más insumos
 * —piping y estructural, cuatro categorías de cuadrilla y cuatro equipos—
 * se desbordaban 25 mm, llevándose las firmas a una segunda hoja en blanco.
 * Un APU partido en dos obliga a fotocopiar dos veces para archivar uno.
 */
const CELDA_APU = {
  ...ESTILO_CELDA,
  cellPadding: { top: 1.1, bottom: 1.1, left: 1, right: 1 },
};

const COLUMNAS = {
  0: { cellWidth: 74 },
  1: { cellWidth: 16, halign: "center" as const },
  2: { halign: "right" as const },
  3: { halign: "right" as const },
  4: { halign: "right" as const, cellWidth: 24 },
};

function subtotal(doc: jsPDF, etiqueta: string, valor: number, y: number): number {
  const ancho = doc.internal.pageSize.getWidth();
  doc.setDrawColor(...GRIS_CLARO);
  doc.setLineWidth(0.3);
  doc.line(MARGEN, y, ancho - MARGEN, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...TINTA);
  doc.text(etiqueta.toUpperCase(), MARGEN, y + 4);
  doc.text(`USD ${usd(valor)}`, ancho - MARGEN, y + 4, { align: "right" });
  return y + 7.5;
}

function capituloTabla(
  doc: jsPDF,
  n: string,
  titulo: string,
  cabeza: string[],
  lineas: LineaApu[],
  etiquetaSubtotal: string,
  m: Membrete,
  y: number,
): number {
  let cursor = capitulo(doc, n, titulo, y);

  autoTable(doc, {
    startY: cursor,
    margin: { left: MARGEN, right: MARGEN },
    theme: "plain",
    headStyles: ESTILO_CABEZA,
    styles: CELDA_APU,
    columnStyles: COLUMNAS,
    head: [cabeza],
    body: filas(lineas),
    didDrawPage: () => cabecera(doc, m),
  });

  cursor = finalY(doc) + 1;
  // El +3 separa el subtotal del título del capítulo siguiente. Sin nada de
  // aire el documento se lee como una lista corrida en vez de como tres
  // capítulos que se suman.
  return subtotal(doc, etiquetaSubtotal, lineas.reduce((s, l) => s + l.costoUsd, 0), cursor) + 3;
}

/** Una hoja de APU. */
function hoja(doc: jsPDF, apu: Apu, d: DatosApu, m: Membrete) {
  const ancho = doc.internal.pageSize.getWidth();
  const util = ancho - MARGEN * 2;
  const g = apu.desglose;
  const r = apu.renglon;

  cabecera(doc, m);

  // --- Encabezado del ítem, en dos columnas ---
  let y = 26;
  doc.setDrawColor(...AZUL);
  doc.setLineWidth(0.6);
  doc.line(MARGEN, y, ancho - MARGEN, y);
  y += 5;

  const campo = (etiqueta: string, valor: string, x: number, anchoCampo: number, yy: number) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...GRIS);
    doc.text(etiqueta.toUpperCase(), x, yy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...TINTA);
    doc.text(doc.splitTextToSize(valor, anchoCampo), x, yy + 4);
  };

  campo("Código ítem", r.codigo, MARGEN, util / 2 - 4, y);
  campo("Fecha", fecha(), MARGEN + util / 2, util / 2, y);
  y += 9.5;

  campo("Descripción", r.descripcion, MARGEN, util, y);
  // Una descripción larga se parte en dos líneas: se mide para no pisar.
  const lineasDesc = doc.splitTextToSize(r.descripcion, util).length as number;
  y += 5 + lineasDesc * 4;

  campo("Unidad de medida", r.unidad, MARGEN, util / 4, y);
  campo("Cantidad base", num(r.cantidadBase, 2), MARGEN + util / 4, util / 4, y);
  campo("Cantidad final", num(apu.cantidadFinal, 2), MARGEN + util / 2, util / 4, y);
  campo(
    "Disciplina",
    DISCIPLINAS.find((x) => x.id === r.disciplina)?.nombre ?? r.disciplina,
    MARGEN + (util * 3) / 4,
    util / 4,
    y,
  );
  y += 8.5;

  if (r.especificacion) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...GRIS);
    doc.text(`Especificación: ${r.especificacion}`, MARGEN, y);
    y += 4;
  }

  doc.setDrawColor(...AZUL);
  doc.setLineWidth(0.6);
  doc.line(MARGEN, y, ancho - MARGEN, y);
  y += 6;

  // Cuando no hubo composición cargada, se dice aquí y no en letra pequeña al
  // final: quien firma el APU tiene que saber que el desglose es agregado.
  if (!g.detallado) {
    doc.setFillColor(253, 245, 235);
    doc.setDrawColor(...ROJO);
    doc.setLineWidth(0.3);
    doc.rect(MARGEN, y, util, 10, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...ROJO);
    doc.text("DESGLOSE AGREGADO", MARGEN + 3, y + 4);
    doc.setFont("helvetica", "normal");
    doc.text(
      "El origen no aportó composición de insumos. Los capítulos se emiten con una línea agregada.",
      MARGEN + 3,
      y + 7.5,
    );
    y += 15;
  }

  // --- 1 · Materiales ---
  y = capituloTabla(
    doc,
    "1",
    "Materiales",
    ["Descripción", "Unidad", "Cant./unid.", "P. unitario (USD)", "Costo (USD)"],
    g.materiales,
    "Subtotal materiales",
    m,
    y,
  );

  // --- 2 · Equipos ---
  y = capituloTabla(
    doc,
    "2",
    "Equipos y herramientas",
    ["Descripción", "Unidad", "Rendim./unid.", "P. unitario (USD)", "Costo (USD)"],
    g.equipos,
    "Subtotal equipos",
    m,
    y,
  );

  // --- 3 · Mano de obra ---
  let cursor = capitulo(doc, "3", "Mano de obra (cuadrilla tipo)", y + 1);

  autoTable(doc, {
    startY: cursor,
    margin: { left: MARGEN, right: MARGEN },
    theme: "plain",
    headStyles: ESTILO_CABEZA,
    styles: CELDA_APU,
    columnStyles: COLUMNAS,
    head: [["Categoría", "Unidad", `HH/${r.unidad}`, "Tarifa/HH (USD)", "Costo (USD)"]],
    body: filas(g.manoObra),
    didDrawPage: () => cabecera(doc, m),
  });

  // El cierre de mano de obra son TRES líneas encadenadas —directa, FAS,
  // cargada— y no tres subtotales sueltos: cada una se apoya en la anterior.
  // Por eso llevan una sola regla arriba, y no una por línea. Dibujando el
  // subtotal completo tres veces y restando altura para juntarlas, las reglas
  // acababan cruzando el texto de la fila de encima.
  cursor = finalY(doc) + 1;
  doc.setDrawColor(...GRIS_CLARO);
  doc.setLineWidth(0.3);
  doc.line(MARGEN, cursor, ancho - MARGEN, cursor);
  cursor += 4;

  const cierreMo: [string, number][] = [
    ["Subtotal mano de obra directa", g.manoObraDirectaUsd],
    // El FAS se enuncia como recargo porque así lo pide la planilla: "@ 110%".
    [`Factor de costos sociales (FAS) @ ${pct(d.parametros.fas - 1, 0)}`, g.fasUsd],
    ["Total mano de obra cargada", g.manoObraCargadaUsd],
  ];

  cierreMo.forEach(([etiqueta, valor], i) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...TINTA);
    doc.text(etiqueta.toUpperCase(), MARGEN, cursor);
    doc.text(`USD ${usd(valor)}`, ancho - MARGEN, cursor, { align: "right" });
    // Regla fina solo antes del total, que es donde se cierra la suma.
    if (i === cierreMo.length - 2) {
      doc.setDrawColor(...GRIS_CLARO);
      doc.setLineWidth(0.3);
      doc.line(MARGEN, cursor + 1.6, ancho - MARGEN, cursor + 1.6);
    }
    cursor += 4.6;
  });

  // --- Cierre ---
  y = cursor + 1;
  doc.setDrawColor(...AZUL);
  doc.setLineWidth(0.6);
  doc.line(MARGEN, y, ancho - MARGEN, y);
  y += 4.5;

  const unit = (n: number) => (apu.cantidadFinal > 0 ? n / apu.cantidadFinal : 0);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...AZUL);
  doc.text("COSTO DIRECTO TOTAL  (1 + 2 + 3)", MARGEN, y);
  doc.text(`USD ${usd(unit(apu.costoDirectoUsd))}`, ancho - MARGEN, y, { align: "right" });
  y += 5.5;

  const recargo = (etiqueta: string, valor: number) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...TINTA);
    doc.text(etiqueta, MARGEN + 3, y);
    doc.text(`USD ${usd(unit(valor))}`, ancho - MARGEN, y, { align: "right" });
    y += 4.2;
  };

  const base = d.parametros.modoMarkup === "cascada" ? "sobre el subtotal anterior" : "sobre el directo";
  recargo(`+ Costos indirectos de campo y oficina (${pct(d.parametros.overhead, 0)} ${base})`, apu.indirectosUsd);
  recargo(`+ Imprevistos y contingencia (${pct(d.parametros.imprevistos, 0)} ${base})`, apu.imprevistosUsd);
  recargo(`+ Utilidad / fee del contratista (${pct(d.parametros.utilidad, 0)} ${base})`, apu.utilidadUsd);

  y += 1;
  doc.setDrawColor(...AZUL);
  doc.setLineWidth(0.6);
  doc.line(MARGEN, y, ancho - MARGEN, y);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...AZUL);
  doc.text("PRECIO UNITARIO FINAL (OFERTA)", MARGEN, y);
  doc.text(`USD ${usd(apu.precioUnitarioUsd)} / ${r.unidad}`, ancho - MARGEN, y, { align: "right" });
  y += 5;

  doc.setDrawColor(...AZUL);
  doc.setLineWidth(1.2);
  doc.line(MARGEN, y, ancho - MARGEN, y);
  y += 6;

  // Total del renglón: el precio unitario multiplicado, que es lo que entra en
  // la planilla de oferta. Se imprime aquí para no obligar a calcularlo a mano.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...GRIS);
  doc.text(
    `Total del renglón: ${num(apu.cantidadFinal, 2)} ${r.unidad} × USD ${usd(apu.precioUnitarioUsd)} = USD ${usd(apu.totalUsd)}   ·   ${num(apu.horasHombre, 0)} HH`,
    MARGEN,
    y,
  );
  y += 6;

  // Firmas. Un APU sin espacio para firmar se imprime y se vuelve a imprimir.
  //
  // Van ANCLADAS AL PIE, que es donde se buscan, pero solo si el desglose ha
  // dejado sitio. Un renglón con muchos insumos llega hasta abajo, y clavar
  // las firmas a una altura fija hacía que el total del renglón les cayera
  // encima. Cuando no cabe, las firmas se llevan a una hoja nueva.
  const alto = doc.internal.pageSize.getHeight();
  // Suelo del pie de página: por debajo de aquí empieza la numeración.
  const suelo = alto - 20;
  let yFirmas: number;

  if (y + 10 <= alto - 30) {
    // Cabe de sobra: se anclan abajo, que es donde se buscan al firmar.
    yFirmas = alto - 30;
  } else if (y + 10 <= suelo) {
    // Justo: siguen al contenido en vez de dejar un hueco raro.
    yFirmas = y + 10;
  } else {
    doc.addPage();
    cabecera(doc, m);
    yFirmas = alto - 30;
  }

  const anchoFirma = (util - 12) / 3;
  ["Elaborado por", "Revisado por", "Aprobado por"].forEach((rol, i) => {
    const x = MARGEN + (anchoFirma + 6) * i;
    doc.setDrawColor(...GRIS);
    doc.setLineWidth(0.3);
    doc.line(x, yFirmas, x + anchoFirma, yFirmas);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...GRIS);
    doc.text(rol.toUpperCase(), x, yFirmas + 3.5);
    if (i === 0) {
      doc.setFontSize(7);
      doc.setTextColor(...TINTA);
      doc.text(d.preparadoPor, x, yFirmas - 1.5);
    }
  });
}

/** Hoja única cuando ningún renglón tiene composición cargada. */
function hojaVacia(doc: jsPDF, m: Membrete) {
  const ancho = doc.internal.pageSize.getWidth();
  cabecera(doc, m);
  let y = capitulo(doc, "1", "Sin análisis de precios que emitir", 34);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TINTA);
  for (const linea of [
    "Ningún renglón del cómputo tiene composición de insumos cargada en la",
    "base de precios de la empresa.",
    "",
    "El cómputo métrico y el informe consolidado sí se emiten: lo que falta",
    "es el desglose por insumo, equipo y cuadrilla de cada precio unitario,",
    "que no viene del modelo de diseño sino de la base de la empresa.",
  ]) {
    doc.text(linea, MARGEN, y);
    y += 5;
  }
  void ancho;
}

export function generarApu(d: DatosApu): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const m = membrete(d);

  doc.setProperties({
    title: `APU · ${d.proyecto}`,
    subject: "Análisis de precios unitarios",
    author: d.cliente,
    creator: "Apolo",
  });

  if (d.apus.length === 0) {
    // Sin renglones con composición no hay APU que emitir. Se dice en una hoja
    // en vez de devolver un PDF en blanco, que se leería como un fallo del
    // sistema cuando en realidad falta cargar la base de precios.
    hojaVacia(doc, m);
  } else {
    d.apus.forEach((apu, i) => {
      if (i > 0) doc.addPage();
      hoja(doc, apu, d, m);
    });
  }

  pie(doc, m);
  return doc;
}

export function apuBlob(d: DatosApu): Blob {
  return generarApu(d).output("blob");
}
