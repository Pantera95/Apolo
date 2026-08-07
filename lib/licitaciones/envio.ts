import { apuBlob, type DatosApu } from "@/lib/licitaciones/apu-pdf";
import { informeBlob, type DatosInforme } from "@/lib/licitaciones/informe-pdf";
import { nombreArchivoPdf, num, usd } from "@/lib/licitaciones/pdf-base";
import { promedioIndice } from "@/lib/licitaciones/motor";
import type { Estimacion, ObraHistorica, Parametros } from "@/lib/licitaciones/tipos";

/**
 * Generación y envío de los dos entregables.
 *
 * El PDF se arma en el NAVEGADOR y se sube al servidor, que solo lo reenvía a
 * Telegram. Podría generarse en el servidor, pero entonces habría que mandarle
 * la estimación entera por JSON y volver a calcularla allí: el mismo trabajo
 * dos veces y dos sitios donde el número puede salir distinto.
 */

export type Entregable = "informe" | "apu";

export interface Respuesta {
  enviado: boolean;
  modo?: string;
  motivo?: string;
  archivo?: string;
  bytes?: number;
}

/** Escapa lo que va dentro del HTML de Telegram. */
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export interface DatosLeyenda {
  proyecto: string;
  cliente: string;
  origen: string;
  estimacion: Estimacion;
  parametros: Parametros;
  historico: ObraHistorica[];
  simulado: boolean;
  preparadoPor: string;
}

/**
 * Leyenda del documento, genérica y rellenada con los datos del cómputo.
 *
 * SE MANTIENE POR DEBAJO DE 1024 CARACTERES porque ese es el límite de una
 * leyenda de documento en Telegram — un tercio del de un mensaje suelto. Pasarse
 * no trunca: hace que Telegram rechace el envío entero.
 *
 * Lleva las cifras que permiten decidir sin abrir el PDF, y nada más. Una
 * leyenda que repite el informe completo obliga a leerlo dos veces.
 */
export function leyenda(tipo: Entregable, d: DatosLeyenda): string {
  const e = d.estimacion;
  const acero = e.apus.filter((a) => a.renglon.unidad === "kg").reduce((s, a) => s + a.cantidadFinal, 0);
  const hhPorTon = acero > 0 ? e.horasHombre / (acero / 1000) : 0;
  const hist = promedioIndice(d.historico, (x) => x.hhPorTonelada);

  const titulo =
    tipo === "informe"
      ? "INFORME CONSOLIDADO DE ESTIMACIÓN"
      : "ANÁLISIS DE PRECIOS UNITARIOS (APU)";

  const lineas = [
    `<b>${esc(titulo)}</b>`,
    `${esc(d.cliente)}`,
    "",
    `<b>Proyecto:</b> ${esc(d.proyecto)}`,
    `<b>Origen:</b> ${esc(d.origen)}`,
    "",
    `<b>Total ofertado:</b> USD ${usd(e.totalUsd)}`,
    `<b>Plazo:</b> ${Math.ceil(e.diasEstimados)} días · ${d.parametros.cuadrillas} cuadrillas`,
    `<b>Horas-hombre:</b> ${num(e.horasHombre, 0)}`,
    `<b>Renglones:</b> ${e.apus.length} en ${e.porDisciplina.length} disciplinas`,
  ];

  // La advertencia va en la leyenda y no solo dentro del PDF: es lo único que
  // se lee en el teléfono antes de decidir si se abre el archivo.
  if (hist !== null && hhPorTon > 0 && hhPorTon < hist * 0.85) {
    const p = Math.round(((hist - hhPorTon) / hist) * 100);
    lineas.push("", `⚠️ <b>Rendimiento ${p}% más optimista que el histórico.</b>`);
  }

  if (d.simulado) {
    lineas.push("", "<i>Cómputo de demostración: no procede de un modelo real.</i>");
  }

  lineas.push("", `<i>Preparado por ${esc(d.preparadoPor)} · Apolo</i>`);

  const texto = lineas.join("\n");
  return texto.length > 1000 ? `${texto.slice(0, 990)}…` : texto;
}

/** Descarga el PDF al disco del usuario. */
export function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  // Sin esto el Blob queda retenido hasta que se cierre la pestaña.
  URL.revokeObjectURL(url);
}

export function construir(
  tipo: Entregable,
  informe: DatosInforme,
  apu: DatosApu,
): { blob: Blob; nombre: string } {
  if (tipo === "apu") {
    return { blob: apuBlob(apu), nombre: nombreArchivoPdf("apu", apu.proyecto) };
  }
  return { blob: informeBlob(informe), nombre: nombreArchivoPdf("informe", informe.proyecto) };
}

/** Sube el PDF a la ruta del servidor, que lo reenvía a Telegram. */
export async function enviarPorTelegram(
  blob: Blob,
  nombre: string,
  textoLeyenda: string,
  chatId?: string,
): Promise<Respuesta> {
  const cuerpo = new FormData();
  cuerpo.append("archivo", new File([blob], nombre, { type: "application/pdf" }));
  cuerpo.append("leyenda", textoLeyenda);
  if (chatId) cuerpo.append("chatId", chatId);

  try {
    const r = await fetch("/api/telegram/documento", { method: "POST", body: cuerpo });
    return (await r.json()) as Respuesta;
  } catch (e) {
    return {
      enviado: false,
      modo: "error-red",
      motivo: e instanceof Error ? e.message : "No se pudo contactar con el servidor.",
    };
  }
}
