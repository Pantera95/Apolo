import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { agruparRfq, promedioIndice } from "@/lib/licitaciones/motor";
import {
  AZUL,
  ESTILO_CABEZA,
  ESTILO_CELDA,
  ESTILO_PIE,
  GRIS,
  GRIS_CLARO,
  MARGEN,
  ROJO,
  TINTA,
  cabecera,
  capitulo,
  espacio,
  finalY,
  num,
  pct,
  pie,
  usd,
  type Membrete,
} from "@/lib/licitaciones/pdf-base";
import type { Estimacion, ObraHistorica, Parametros } from "@/lib/licitaciones/tipos";
import { DISCIPLINAS } from "@/lib/licitaciones/tipos";

/**
 * Informe consolidado de estimación.
 *
 * SE GENERA CON jsPDF Y NO CON `window.print()`, y la razón no es estética:
 * para enviarlo por Telegram hacen falta los BYTES del archivo, y el diálogo
 * de impresión del navegador no los entrega — solo abre una ventana que el
 * usuario tendría que guardar a mano.
 *
 * Son seis capítulos que resumen el proyecto entero. El detalle renglón por
 * renglón vive en el otro entregable, el APU, porque son dos lecturas
 * distintas: este lo lee quien decide si se oferta, y el APU lo lee quien
 * audita cómo se llegó al número.
 */

export interface DatosInforme {
  proyecto: string;
  cliente: string;
  origen: string;
  archivo: string;
  estimacion: Estimacion;
  parametros: Parametros;
  historico: ObraHistorica[];
  simulado: boolean;
  preparadoPor: string;
}

function membrete(d: DatosInforme): Membrete {
  return {
    empresa: d.cliente,
    documento: "Panel de control · Estimación y cálculo EPC",
    proyecto: d.proyecto,
    simulado: d.simulado,
  };
}

/** Volúmenes de material, para el resumen y para el benchmark. */
function volumenes(e: Estimacion) {
  const acero = e.apus.filter((a) => a.renglon.unidad === "kg").reduce((s, a) => s + a.cantidadFinal, 0);
  const concreto = e.apus
    .filter((a) => a.renglon.unidad === "m³" || a.renglon.unidad === "m3")
    .reduce((s, a) => s + a.cantidadFinal, 0);
  return { acero, concreto, toneladas: acero / 1000 };
}

export function generarInforme(d: DatosInforme): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const m = membrete(d);
  const ancho = doc.internal.pageSize.getWidth();
  const util = ancho - MARGEN * 2;
  const e = d.estimacion;
  const v = volumenes(e);

  doc.setProperties({
    title: `Estimación EPC · ${d.proyecto}`,
    subject: "Cómputo métrico, precios unitarios y análisis de desempeño",
    author: d.cliente,
    creator: "Apolo",
  });

  cabecera(doc, m);
  let y = 30;

  // --- 1 · Resumen ejecutivo -----------------------------------------------
  y = capitulo(doc, "1", "Resumen ejecutivo del proyecto", y);

  autoTable(doc, {
    startY: y,
    margin: { left: MARGEN, right: MARGEN },
    theme: "plain",
    styles: { ...ESTILO_CELDA, cellPadding: { top: 1.2, bottom: 1.2, left: 0, right: 2 } },
    columnStyles: {
      0: { cellWidth: 44, textColor: GRIS },
      1: { textColor: TINTA, fontStyle: "bold" },
    },
    body: [
      ["Proyecto evaluado", d.proyecto],
      ["Origen de datos", `${d.origen} · ${d.archivo}`],
      [
        "Duración estimada",
        `${Math.ceil(e.diasEstimados)} días · ${d.parametros.cuadrillas} cuadrillas de ${d.parametros.personasPorCuadrilla} personas`,
      ],
      ["Renglones computados", `${e.apus.length} en ${e.porDisciplina.length} disciplinas`],
      ["Preparado por", d.preparadoPor],
    ],
  });

  y = finalY(doc) + 6;

  // Cifras clave en banda, sin cajas: la retícula ya las separa.
  const cifras: [string, string][] = [
    ["COSTO TOTAL OFERTADO", `USD ${usd(e.totalUsd)}`],
    ["HORAS-HOMBRE", num(e.horasHombre, 0)],
    ["ACERO", `${num(v.toneladas, 1)} t`],
    ["CONCRETO", `${num(v.concreto, 0)} m³`],
  ];
  const paso = util / cifras.length;
  doc.setDrawColor(...GRIS_CLARO);
  doc.setLineWidth(0.3);
  doc.line(MARGEN, y - 2, ancho - MARGEN, y - 2);

  cifras.forEach(([k, val], i) => {
    const x = MARGEN + paso * i;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...GRIS);
    doc.text(k, x, y + 3);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...AZUL);
    doc.text(val, x, y + 9);
  });

  doc.line(MARGEN, y + 12.5, ancho - MARGEN, y + 12.5);
  y += 20;

  // --- 2 · MTO / BOM --------------------------------------------------------
  y = capitulo(doc, "2", "Consolidado MTO / BOM y estimación de materiales", y);

  autoTable(doc, {
    startY: y,
    margin: { left: MARGEN, right: MARGEN },
    theme: "plain",
    headStyles: ESTILO_CABEZA,
    styles: { ...ESTILO_CELDA, fontSize: 7, cellPadding: { top: 1.3, bottom: 1.3, left: 1, right: 1 } },
    columnStyles: {
      0: { cellWidth: 21 },
      1: { cellWidth: 48 },
      2: { cellWidth: 11, halign: "center" },
      3: { halign: "right" },
      4: { halign: "right", cellWidth: 13 },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right", cellWidth: 24 },
    },
    head: [["Ítem", "Familia / insumo", "Unid.", "Cant. base", "% desp.", "Cant. final", "P. unit.", "Total (USD)"]],
    body: e.apus.map((a) => [
      a.renglon.codigo,
      a.renglon.descripcion,
      a.renglon.unidad,
      num(a.renglon.cantidadBase),
      a.renglon.cantidadBase > 0 ? pct(a.cantidadFinal / a.renglon.cantidadBase - 1, 1) : "—",
      num(a.cantidadFinal),
      num(a.precioUnitarioUsd),
      usd(a.totalUsd),
    ]),
    foot: [
      [
        {
          content: "TOTAL OFERTADO (INCLUYE MERMAS, INDIRECTOS, CONTINGENCIA Y UTILIDAD)",
          colSpan: 7,
          styles: { halign: "right" },
        },
        `USD ${usd(e.totalUsd)}`,
      ],
    ],
    footStyles: { ...ESTILO_PIE, halign: "right" },
    didDrawPage: () => cabecera(doc, m),
  });

  y = finalY(doc) + 8;

  // --- 3 · Tiempos y mano de obra ------------------------------------------
  y = espacio(doc, y, 62, m);
  y = capitulo(doc, "3", "Análisis de tiempos y mano de obra", y);

  const cuadrillasPorFrente = Math.max(
    1,
    Math.floor(d.parametros.cuadrillas / Math.max(1, e.porDisciplina.length)),
  );

  autoTable(doc, {
    startY: y,
    margin: { left: MARGEN, right: MARGEN },
    theme: "plain",
    headStyles: ESTILO_CABEZA,
    styles: { ...ESTILO_CELDA, cellPadding: { top: 1.7, bottom: 1.7, left: 1, right: 1 } },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
    head: [["Disciplina", "Renglones", "HH totales", "Costo total (USD)", `Días (${cuadrillasPorFrente} cuad.)`]],
    body: e.porDisciplina.map((p) => [
      DISCIPLINAS.find((x) => x.id === p.disciplina)?.nombre ?? p.disciplina,
      String(p.renglones),
      num(p.horasHombre, 0),
      usd(p.totalUsd),
      `${Math.ceil(p.dias)}`,
    ]),
    foot: [["RUTA CRÍTICA DEL PROYECTO", "", num(e.horasHombre, 0), usd(e.totalUsd), `${Math.ceil(e.diasEstimados)}`]],
    footStyles: { ...ESTILO_PIE, fontSize: 7.5 },
    didDrawPage: () => cabecera(doc, m),
  });

  y = finalY(doc) + 4;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(6.5);
  doc.setTextColor(...GRIS);
  doc.text(
    "El plazo del proyecto es el de la disciplina más larga, no la suma: los frentes avanzan en paralelo.",
    MARGEN,
    y,
  );
  y += 9;

  // --- 4 · Estructura del precio -------------------------------------------
  y = espacio(doc, y, 66, m);
  y = capitulo(doc, "4", "Estructura del precio ofertado", y);

  const negrita = { fontStyle: "bold" as const };

  autoTable(doc, {
    startY: y,
    margin: { left: MARGEN, right: MARGEN },
    theme: "plain",
    headStyles: ESTILO_CABEZA,
    styles: { ...ESTILO_CELDA, cellPadding: { top: 1.7, bottom: 1.7, left: 1, right: 1 } },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right", cellWidth: 24 } },
    head: [["Componente", "Monto (USD)", "% del total"]],
    body: [
      ["Materiales", usd(e.totalMaterialesUsd), pct(e.totalMaterialesUsd / e.totalUsd)],
      [
        `Mano de obra cargada (FAS @ ${pct(d.parametros.fas - 1, 0)})`,
        usd(e.totalManoObraUsd),
        pct(e.totalManoObraUsd / e.totalUsd),
      ],
      ["Equipos y herramientas", usd(e.totalEquiposUsd), pct(e.totalEquiposUsd / e.totalUsd)],
      [
        { content: "COSTO DIRECTO", styles: negrita },
        { content: usd(e.totalDirectoUsd), styles: negrita },
        { content: pct(e.totalDirectoUsd / e.totalUsd), styles: negrita },
      ],
      [
        `Indirectos de campo y oficina (${pct(d.parametros.overhead, 0)})`,
        usd(e.totalIndirectosUsd),
        pct(e.totalIndirectosUsd / e.totalUsd),
      ],
      [
        `Imprevistos y contingencia (${pct(d.parametros.imprevistos, 0)})`,
        usd(e.totalImprevistosUsd),
        pct(e.totalImprevistosUsd / e.totalUsd),
      ],
      [
        `Utilidad / fee del contratista (${pct(d.parametros.utilidad, 0)})`,
        usd(e.totalUtilidadUsd),
        pct(e.totalUtilidadUsd / e.totalUsd),
      ],
    ],
    foot: [["PRECIO TOTAL OFERTADO", usd(e.totalUsd), "100,0%"]],
    footStyles: ESTILO_PIE,
    didDrawPage: () => cabecera(doc, m),
  });

  y = finalY(doc) + 4;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(6.5);
  doc.setTextColor(...GRIS);
  doc.text(
    d.parametros.modoMarkup === "cascada"
      ? "Recargos en cascada: cada uno sobre el subtotal anterior. El FAS carga únicamente la mano de obra."
      : "Recargos sobre el costo directo, según planilla del cliente. El FAS carga únicamente la mano de obra.",
    MARGEN,
    y,
  );
  y += 9;

  // --- 5 · KPIs y benchmarking ---------------------------------------------
  y = espacio(doc, y, 72, m);
  y = capitulo(doc, "5", "KPIs y comparación con obras anteriores", y);

  const hhPorTon = v.toneladas > 0 ? e.horasHombre / v.toneladas : 0;
  const hhPorTonHist = promedioIndice(d.historico, (x) => x.hhPorTonelada);
  const spi = promedioIndice(d.historico, (x) => x.spi);
  const cpi = promedioIndice(d.historico, (x) => x.cpi);
  const ratioAcero = v.concreto > 0 ? v.acero / v.concreto : 0;
  const concretoHist = d.historico.reduce((s, o) => s + o.m3Concreto, 0);
  const ratioHist =
    concretoHist > 0 ? (d.historico.reduce((s, o) => s + o.toneladasAcero, 0) * 1000) / concretoHist : null;
  const costoPorM3 = v.concreto > 0 ? e.totalUsd / v.concreto : 0;

  const variacion = (act: number, hist: number | null) =>
    hist === null || hist === 0 ? "—" : `${act > hist ? "+" : ""}${num(((act - hist) / hist) * 100, 1)}%`;

  autoTable(doc, {
    startY: y,
    margin: { left: MARGEN, right: MARGEN },
    theme: "plain",
    headStyles: ESTILO_CABEZA,
    styles: { ...ESTILO_CELDA, cellPadding: { top: 1.7, bottom: 1.7, left: 1, right: 1 } },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right", cellWidth: 48 } },
    head: [["Métrica / KPI", "Proyecto actual", "Histórico obras", "Variación / estado"]],
    body: [
      [
        "Ratio acero / concreto",
        `${num(ratioAcero, 1)} kg/m³`,
        ratioHist === null ? "—" : `${num(ratioHist, 1)} kg/m³`,
        variacion(ratioAcero, ratioHist),
      ],
      ["Costo total / m³ construido", `${usd(costoPorM3)} /m³`, "—", "sin base comparable"],
      [
        "Rendimiento mano de obra",
        `${num(hhPorTon, 1)} HH/t`,
        hhPorTonHist === null ? "—" : `${num(hhPorTonHist, 1)} HH/t`,
        hhPorTonHist === null
          ? "sin histórico"
          : `${variacion(hhPorTon, hhPorTonHist)} · ${hhPorTon < hhPorTonHist ? "más optimista" : "conservador"}`,
      ],
      [
        "SPI histórico (plazo)",
        "—",
        spi === null ? "—" : num(spi, 2),
        spi === null ? "—" : spi < 1 ? "obras cerraron con atraso" : "obras cerraron en plazo",
      ],
      [
        "CPI histórico (costo)",
        "—",
        cpi === null ? "—" : num(cpi, 2),
        cpi === null ? "—" : cpi < 1 ? "obras cerraron con sobrecosto" : "obras cerraron en costo",
      ],
    ],
    didDrawPage: () => cabecera(doc, m),
  });

  y = finalY(doc) + 6;

  // La advertencia que justifica el capítulo entero.
  if (hhPorTonHist !== null && hhPorTon > 0 && hhPorTon < hhPorTonHist * 0.85) {
    const p = Math.round(((hhPorTonHist - hhPorTon) / hhPorTonHist) * 100);
    y = espacio(doc, y, 22, m);
    doc.setFillColor(253, 240, 236);
    doc.setDrawColor(...ROJO);
    doc.setLineWidth(0.3);
    doc.rect(MARGEN, y, util, 14, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...ROJO);
    doc.text("ADVERTENCIA DE RENDIMIENTO", MARGEN + 3, y + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(
      `La estimación promete ${num(hhPorTon, 0)} HH/t cuando la empresa históricamente ha logrado ${num(hhPorTonHist, 0)}:`,
      MARGEN + 3,
      y + 9,
    );
    doc.text(
      `un ${p}% más optimista de lo conseguido nunca. Requiere justificación técnica antes de ofertar.`,
      MARGEN + 3,
      y + 12,
    );
    y += 19;
  }

  // --- 6 · Matriz RFQ -------------------------------------------------------
  const familias = agruparRfq(e.apus);
  if (familias.length > 0) {
    y = espacio(doc, y, 60, m);
    y = capitulo(doc, "6", "Matriz de solicitudes de cotización", y);

    autoTable(doc, {
      startY: y,
      margin: { left: MARGEN, right: MARGEN },
      theme: "plain",
      headStyles: ESTILO_CABEZA,
      styles: ESTILO_CELDA,
      columnStyles: {
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right", cellWidth: 32 },
      },
      head: [["Familia", "Disciplina", "Renglones", "Cant. total", "Monto material (USD)"]],
      body: familias.map((f) => [
        f.familia,
        DISCIPLINAS.find((x) => x.id === f.disciplina)?.nombre ?? f.disciplina,
        String(f.renglones),
        num(f.cantidadTotal, 0),
        usd(f.montoEstimadoUsd),
      ]),
      foot: [["TOTAL A COTIZAR", "", "", "", usd(e.totalMaterialesUsd)]],
      footStyles: ESTILO_PIE,
      didDrawPage: () => cabecera(doc, m),
    });

    y = finalY(doc) + 4;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6.5);
    doc.setTextColor(...GRIS);
    doc.text(
      "Solo material: a un proveedor no se le pide que cotice la mano de obra ni la utilidad de la contratista.",
      MARGEN,
      y,
    );
  }

  pie(doc, m);
  return doc;
}

export function informeBlob(d: DatosInforme): Blob {
  return generarInforme(d).output("blob");
}
