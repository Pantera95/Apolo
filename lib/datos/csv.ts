/**
 * Exportación a CSV.
 *
 * Dos decisiones que parecen menores y no lo son, porque el archivo se abre en
 * el Excel del cliente y si sale mal el reporte no sirve:
 *
 * 1. SEPARADOR ";" — Excel en configuración regional española espera punto y
 *    coma. Con coma mete toda la fila en una sola celda.
 * 2. BOM al inicio — sin él, Excel lee el archivo como Latin-1 y "Anaco",
 *    "galón" o "Rondón" aparecen como "AnacÃ³".
 */

export interface ColumnaCsv<T> {
  clave: string;
  titulo: string;
  valor: (fila: T) => string | number | undefined | null;
}

export const BOM = "﻿";

/**
 * Escapa un valor. Se entrecomilla si contiene el separador, comillas o un
 * salto de línea; las comillas internas se duplican, que es como lo espera el
 * formato.
 */
export function escaparCsv(valor: unknown, separador: string): string {
  if (valor === null || valor === undefined) return "";
  const texto = String(valor);
  const necesitaComillas =
    texto.includes(separador) ||
    texto.includes('"') ||
    texto.includes("\n") ||
    texto.includes("\r");
  return necesitaComillas ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function aCSV<T>(
  columnas: ColumnaCsv<T>[],
  filas: T[],
  separador = ";",
): string {
  const cabecera = columnas
    .map((c) => escaparCsv(c.titulo, separador))
    .join(separador);

  const cuerpo = filas.map((fila) =>
    columnas.map((c) => escaparCsv(c.valor(fila), separador)).join(separador),
  );

  // CRLF: es lo que espera Excel y lo que dice el RFC del formato.
  return [cabecera, ...cuerpo].join("\r\n");
}

/** Nombre de archivo con fecha, para que no se pisen dos descargas. */
export function nombreArchivo(base: string, fecha: Date = new Date()): string {
  const iso = fecha.toISOString().slice(0, 10);
  const limpio = base
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `apolo-${limpio}-${iso}.csv`;
}
