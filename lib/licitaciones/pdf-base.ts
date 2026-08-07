import { jsPDF } from "jspdf";

import { LOGO_GLOBAL_XXI, LOGO_RATIO } from "@/lib/licitaciones/logo";

/**
 * Base tipográfica de los documentos que salen de Apolo.
 *
 * DECISIONES DE COMPOSICIÓN, y todas van contra el impulso de decorar:
 *
 *   Sin cajas redondeadas, sin sombras, sin degradados, sin emoji. Un documento
 *   que entra a una licitación se parece a un plano, no a un panel web. Lo que
 *   da autoridad es la retícula y la jerarquía, no el adorno.
 *
 *   Reglas de 0,3 pt y separadores solo donde cambia el sentido. Una tabla con
 *   borde en cada celda se lee como una hoja de cálculo exportada de prisa.
 *
 *   Todas las cifras a la derecha. En una columna de dinero la alineación es
 *   lo que permite comparar magnitudes sin leer los dígitos.
 *
 *   Cabecera y pie en todas las páginas, con "n de N". Un juego de ocho hojas
 *   sin numerar se desordena en la primera reunión.
 */

// Colores del logotipo de Global XXI. Se declaran una vez.
export const AZUL: [number, number, number] = [27, 46, 90];
export const AZUL_CLARO: [number, number, number] = [27, 117, 188];
export const GRIS: [number, number, number] = [110, 118, 130];
export const GRIS_CLARO: [number, number, number] = [222, 227, 233];
export const TINTA: [number, number, number] = [17, 24, 34];
export const ROJO: [number, number, number] = [166, 43, 22];

export const MARGEN = 14;

export interface Membrete {
  empresa: string;
  documento: string;
  proyecto: string;
  /** Se estampa en TODAS las páginas cuando el cómputo es de demostración. */
  simulado: boolean;
}

const fmt = (dec: number) =>
  new Intl.NumberFormat("es-VE", { minimumFractionDigits: dec, maximumFractionDigits: dec });

export const usd = (n: number) => fmt(2).format(n);
export const num = (n: number, dec = 2) => fmt(dec).format(n);
export const pct = (n: number, dec = 1) => `${fmt(dec).format(n * 100)}%`;

export function fecha(d = new Date()): string {
  return d.toLocaleDateString("es-VE", { day: "2-digit", month: "long", year: "numeric" });
}

/** Ancho impreso del logotipo, en mm. Fija los 310 DPI del PNG incrustado. */
const LOGO_ANCHO = 36;

/**
 * Membrete: el logotipo real de la empresa.
 *
 * `alias` NO ES OPCIONAL en la práctica. jsPDF, sin él, vuelve a incrustar los
 * bytes de la imagen en CADA página: un APU de veinte hojas pesaría veinte
 * veces el logo. Con alias se almacena una vez y las demás páginas lo
 * referencian.
 *
 * Si por lo que sea la imagen no se puede pintar —un dato corrupto, un jsPDF
 * futuro más estricto—, se cae a la marca tipográfica en vez de dejar la
 * esquina vacía: un documento sin membrete parece de nadie.
 */
export function marca(doc: jsPDF, x: number, y: number, ancho = LOGO_ANCHO) {
  try {
    // `y` es la línea base del texto; la imagen se sitúa por su borde
    // superior, así que se sube el alto completo para que ambas coincidan.
    const alto = ancho / LOGO_RATIO;
    doc.addImage(LOGO_GLOBAL_XXI, "PNG", x, y - alto, ancho, alto, "logoGlobalXXI", "FAST");
  } catch {
    marcaTipografica(doc, x, y);
  }
}

/** Respaldo en vectores, con los colores del logotipo. */
function marcaTipografica(doc: jsPDF, x: number, y: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.setTextColor(...AZUL);
  doc.text("GLOBAL", x, y);

  const ancho = doc.getTextWidth("GLOBAL");

  doc.setFontSize(9);
  doc.setTextColor(...AZUL_CLARO);
  doc.text("XXI, C.A.", x + ancho + 2, y);

  doc.setDrawColor(...AZUL_CLARO);
  doc.setLineWidth(1.4);
  doc.line(x, y + 2.2, x + ancho + 16, y + 2.2);
}

export function cabecera(doc: jsPDF, m: Membrete) {
  const ancho = doc.internal.pageSize.getWidth();
  marca(doc, MARGEN, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...GRIS);
  doc.text(m.documento.toUpperCase(), ancho - MARGEN, 13, { align: "right" });
  doc.text(fecha(), ancho - MARGEN, 17.5, { align: "right" });

  doc.setDrawColor(...GRIS_CLARO);
  doc.setLineWidth(0.3);
  doc.line(MARGEN, 21, ancho - MARGEN, 21);
}

export function pie(doc: jsPDF, m: Membrete) {
  const paginas = doc.getNumberOfPages();
  const ancho = doc.internal.pageSize.getWidth();
  const alto = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    doc.setDrawColor(...GRIS_CLARO);
    doc.setLineWidth(0.3);
    doc.line(MARGEN, alto - 16, ancho - MARGEN, alto - 16);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);

    if (m.simulado) {
      // El aviso va en TODAS las páginas y no solo en la portada: una hoja
      // suelta fotocopiada perdería la advertencia.
      //
      // Y va en su PROPIA LÍNEA. Centrado a la misma altura que el membrete se
      // solapaba con él en cuanto el nombre del proyecto pasaba de corto, que
      // es siempre: los proyectos EPC se llaman "Plataforma de procesamiento y
      // módulos civiles · Fase 1".
      doc.setTextColor(...ROJO);
      doc.text("CÓMPUTO DE DEMOSTRACIÓN · no procede de un modelo real", ancho / 2, alto - 11.5, {
        align: "center",
      });
    }

    doc.setTextColor(...GRIS);
    // El membrete se recorta si no cabe, en vez de invadir la numeración.
    const anchoMembrete = ancho - MARGEN * 2 - 26;
    const membrete = `${m.proyecto} · ${m.empresa}`;
    const recortado =
      doc.getTextWidth(membrete) > anchoMembrete
        ? (doc.splitTextToSize(membrete, anchoMembrete)[0] as string)
        : membrete;
    doc.text(recortado, MARGEN, alto - 7.5);
    doc.text(`Página ${i} de ${paginas}`, ancho - MARGEN, alto - 7.5, { align: "right" });
  }
}

/** Título de capítulo, numerado, con su regla corta debajo. */
export function capitulo(doc: jsPDF, n: string, texto: string, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...AZUL);
  doc.text(`${n}.  ${texto.toUpperCase()}`, MARGEN, y);
  doc.setDrawColor(...AZUL);
  doc.setLineWidth(0.6);
  doc.line(MARGEN, y + 1.6, MARGEN + 40, y + 1.6);
  return y + 6.5;
}

/** Estilos de tabla compartidos: una sola definición para todos los cuadros. */
export const ESTILO_CABEZA = {
  fontSize: 7,
  fontStyle: "bold" as const,
  textColor: AZUL,
  fillColor: false as const,
  lineWidth: { bottom: 0.4 },
  lineColor: AZUL,
};

export const ESTILO_CELDA = {
  fontSize: 7.5,
  cellPadding: { top: 1.5, bottom: 1.5, left: 1, right: 1 },
  textColor: TINTA,
};

export const ESTILO_PIE = {
  fontSize: 8,
  fontStyle: "bold" as const,
  textColor: AZUL,
  fillColor: false as const,
  lineWidth: { top: 0.4 },
  lineColor: AZUL,
};

/** `lastAutoTable.finalY` sin castear en cada llamada. */
export function finalY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

/** Salta de página si no queda sitio, y devuelve la Y donde seguir. */
export function espacio(doc: jsPDF, y: number, necesario: number, m: Membrete): number {
  if (y + necesario < doc.internal.pageSize.getHeight() - 20) return y;
  doc.addPage();
  cabecera(doc, m);
  return 30;
}

export function nombreArchivoPdf(prefijo: string, proyecto: string): string {
  const limpio = proyecto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `${prefijo}-${limpio}-${new Date().toISOString().slice(0, 10)}.pdf`;
}
