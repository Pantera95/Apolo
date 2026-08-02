/**
 * Importador universal.
 *
 * La realidad del cliente no es una API: es un Excel que sale de un ERP
 * distinto en cada empresa, con los encabezados que le dio la gana al que lo
 * programó. Por eso el mapeo se guarda como PERFIL y se reutiliza.
 *
 * Reglas duras, todas aprendidas de datos de producción:
 *
 * 1. Las columnas se localizan por NOMBRE NORMALIZADO, nunca por posición. Si
 *    el ERP añade una columna al principio, un importador posicional empieza a
 *    guardar basura sin avisar.
 * 2. Si falta una columna del perfil → ERROR EXPLÍCITO. No se adivina.
 * 3. IDEMPOTENCIA: se detecta el duplicado y se señala CUÁL fila se repite,
 *    no solo "este archivo ya se cargó".
 * 4. Un archivo cargado por error se puede borrar, y eso REVIERTE sus
 *    movimientos.
 */

import type { Resultado } from "./tipos";
import { fallo, ok } from "./tipos";

export type TipoImportacion = "movimientos" | "existencias";

/** Campos que Apolo entiende; el perfil dice cómo se llaman en cada ERP. */
export type CampoApolo =
  | "codigo"
  | "cantidad"
  | "fecha"
  | "documento"
  | "almacen";

export interface PerfilImportacion {
  id: string;
  nombre: string;
  tipo: TipoImportacion;
  separador: string;
  /** campo de Apolo → encabezado tal cual aparece en el archivo del ERP. */
  columnas: Partial<Record<CampoApolo, string>>;
}

/**
 * Normaliza un encabezado para compararlo: sin tildes, sin mayúsculas, sin
 * espacios de más. "Código Artículo", "CODIGO ARTICULO" y "codigo  articulo"
 * son la misma columna.
 */
export function normalizarEncabezado(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Lectura del archivo
// ---------------------------------------------------------------------------

/**
 * Parser de CSV que respeta comillas.
 *
 * Un `split(separador)` parte "Tubería 6"" SCH40; roja" por la mitad. Con
 * descripciones reales de materiales eso pasa el primer día.
 */
export function leerCsv(texto: string, separador: string): string[][] {
  // Se quita el BOM: si el archivo viene de Excel, la primera columna se
  // llamaría "﻿Codigo" y no coincidiría con ningún perfil.
  const limpio = texto.replace(/^﻿/, "");
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let enComillas = false;

  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];

    if (enComillas) {
      if (c === '"') {
        if (limpio[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          enComillas = false;
        }
      } else {
        campo += c;
      }
      continue;
    }

    if (c === '"') {
      enComillas = true;
    } else if (c === separador) {
      fila.push(campo);
      campo = "";
    } else if (c === "\n") {
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = "";
    } else if (c !== "\r") {
      campo += c;
    }
  }

  if (campo !== "" || fila.length > 0) {
    fila.push(campo);
    filas.push(fila);
  }

  return filas.filter((f) => f.some((v) => v.trim() !== ""));
}

// ---------------------------------------------------------------------------
// Análisis
// ---------------------------------------------------------------------------

export interface FilaImportada {
  /** Número de línea en el archivo, contando el encabezado. Para señalarla. */
  linea: number;
  codigo: string;
  cantidad: number;
  fecha: string;
  documento: string;
  almacen: string;
  /** Huella de la fila: sirve para detectar el duplicado exacto. */
  clave: string;
}

export interface ErrorFila {
  linea: number;
  motivo: "cantidad" | "codigo" | "fecha";
  valor: string;
}

export interface Analisis {
  encabezados: string[];
  filas: FilaImportada[];
  errores: ErrorFila[];
}

/**
 * Huella de una fila. Es legible a propósito: cuando el sistema diga "esta
 * fila ya se cargó", el operario tiene que poder ver por qué.
 */
export function claveFila(f: {
  codigo: string;
  cantidad: number;
  fecha: string;
  documento: string;
}): string {
  return [
    f.codigo.trim().toUpperCase(),
    f.cantidad,
    f.fecha,
    f.documento.trim().toUpperCase(),
  ].join("|");
}

/**
 * Convierte una cantidad escrita por un humano o por un ERP.
 * "1.234,56" (formato local) y "1234.56" son el mismo número.
 */
export function aNumero(valor: string): number | null {
  const limpio = valor.trim().replace(/\s/g, "");
  if (limpio === "") return null;

  const tieneComa = limpio.includes(",");
  const tienePunto = limpio.includes(".");

  let normalizado = limpio;
  if (tieneComa && tienePunto) {
    // El último separador que aparece es el decimal.
    normalizado =
      limpio.lastIndexOf(",") > limpio.lastIndexOf(".")
        ? limpio.replace(/\./g, "").replace(",", ".")
        : limpio.replace(/,/g, "");
  } else if (tieneComa) {
    normalizado = limpio.replace(",", ".");
  }

  const n = Number(normalizado);
  return Number.isFinite(n) ? n : null;
}

/** Acepta ISO y d/m/aaaa, que es lo que exporta la mitad de los ERP locales. */
export function aFechaIso(valor: string): string | null {
  const limpio = valor.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(limpio)) return limpio.slice(0, 10);

  const m = limpio.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!m) return null;
  const [, d, mes, a] = m;
  const iso = `${a}-${mes.padStart(2, "0")}-${d.padStart(2, "0")}`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

export function analizar(
  texto: string,
  perfil: PerfilImportacion,
): Resultado<Analisis> {
  const filas = leerCsv(texto, perfil.separador);
  if (filas.length === 0) {
    return fallo("CANTIDAD_INVALIDA", "El archivo está vacío");
  }

  const encabezados = filas[0].map((h) => h.trim());
  const indice = new Map(
    encabezados.map((h, i) => [normalizarEncabezado(h), i]),
  );

  // Formato fijo: si falta una columna declarada, error explícito. No se
  // adivina ni se importa "lo que se pueda".
  const faltantes: string[] = [];
  const posicion: Partial<Record<CampoApolo, number>> = {};
  for (const [campo, encabezado] of Object.entries(perfil.columnas)) {
    if (!encabezado) continue;
    const i = indice.get(normalizarEncabezado(encabezado));
    if (i === undefined) faltantes.push(encabezado);
    else posicion[campo as CampoApolo] = i;
  }

  if (faltantes.length > 0) {
    return fallo(
      "UNIDAD_NO_DECLARADA",
      `El archivo no trae: ${faltantes.join(", ")}`,
    );
  }

  const salida: FilaImportada[] = [];
  const errores: ErrorFila[] = [];

  for (let i = 1; i < filas.length; i++) {
    const cruda = filas[i];
    const leer = (campo: CampoApolo): string => {
      const p = posicion[campo];
      return p === undefined ? "" : (cruda[p] ?? "").trim();
    };

    const linea = i + 1;
    const codigo = leer("codigo");
    if (codigo === "") {
      errores.push({ linea, motivo: "codigo", valor: "" });
      continue;
    }

    const cantidad = aNumero(leer("cantidad"));
    if (cantidad === null || cantidad <= 0) {
      errores.push({ linea, motivo: "cantidad", valor: leer("cantidad") });
      continue;
    }

    const crudaFecha = leer("fecha");
    const fecha = crudaFecha === "" ? "" : aFechaIso(crudaFecha);
    if (fecha === null) {
      errores.push({ linea, motivo: "fecha", valor: crudaFecha });
      continue;
    }

    const documento = leer("documento");
    const almacen = leer("almacen");

    salida.push({
      linea,
      codigo,
      cantidad,
      fecha: fecha || "",
      documento,
      almacen,
      clave: claveFila({ codigo, cantidad, fecha: fecha || "", documento }),
    });
  }

  return ok({ encabezados, filas: salida, errores });
}

// ---------------------------------------------------------------------------
// Idempotencia
// ---------------------------------------------------------------------------

export interface Duplicado {
  linea: number;
  codigo: string;
  clave: string;
  /** Archivo donde ya se había cargado esta misma fila. */
  archivoPrevio: string;
}

/**
 * Señala CUÁL fila se repite y de qué carga anterior viene.
 *
 * Decir solo "este archivo ya se cargó" es inútil cuando el ERP exporta el mes
 * completo cada semana: el 80% del archivo es repetido y el 20% es nuevo.
 */
export function detectarDuplicados(
  filas: FilaImportada[],
  yaCargadas: Map<string, string>,
): Duplicado[] {
  const duplicados: Duplicado[] = [];
  const vistasEnEsteArchivo = new Map<string, number>();

  for (const fila of filas) {
    const previo = yaCargadas.get(fila.clave);
    if (previo) {
      duplicados.push({
        linea: fila.linea,
        codigo: fila.codigo,
        clave: fila.clave,
        archivoPrevio: previo,
      });
      continue;
    }

    // También se repite dentro del propio archivo.
    const antes = vistasEnEsteArchivo.get(fila.clave);
    if (antes !== undefined) {
      duplicados.push({
        linea: fila.linea,
        codigo: fila.codigo,
        clave: fila.clave,
        archivoPrevio: `línea ${antes}`,
      });
      continue;
    }
    vistasEnEsteArchivo.set(fila.clave, fila.linea);
  }

  return duplicados;
}

// ---------------------------------------------------------------------------
// Búsqueda de artículo
// ---------------------------------------------------------------------------

/**
 * Localiza el artículo de una fila importada.
 *
 * *** TRAMPA REAL: los códigos SÍ distinguen mayúsculas. ***
 * "6X8AT" y "6x8AT" pueden ser dos productos DISTINTOS en el catálogo del
 * cliente. Un índice ingenuo en minúsculas devolvería el equivocado y cargaría
 * la mercancía contra el artículo que no es.
 *
 * Por eso: coincidencia EXACTA primero. El respaldo insensible a mayúsculas
 * solo resuelve si hay UN ÚNICO candidato; si hay dos, se rechaza la fila y
 * que lo decida una persona.
 */
export function buscarArticulo<T extends { id: string; codigo: string }>(
  codigo: string,
  articulos: readonly T[],
): T | "ambiguo" | null {
  const buscado = codigo.trim();

  const exacto = articulos.find((a) => a.codigo === buscado);
  if (exacto) return exacto;

  const candidatos = articulos.filter(
    (a) => a.codigo.toLowerCase() === buscado.toLowerCase(),
  );
  if (candidatos.length === 1) return candidatos[0];
  if (candidatos.length > 1) return "ambiguo";
  return null;
}

// ---------------------------------------------------------------------------
// Conciliación con el ERP
// ---------------------------------------------------------------------------

export interface DiferenciaConciliacion {
  codigo: string;
  descripcion: string;
  segunErp: number;
  segunApolo: number;
  diferencia: number;
}

/**
 * Compara la existencia del ERP contra la de Apolo.
 *
 * Esto es lo que hoy nadie mide: el ERP dice 40, el almacén tiene 37, y esos 3
 * llevan meses sin que nadie sepa dónde están.
 */
export function conciliar(
  delErp: { codigo: string; cantidad: number }[],
  deApolo: Map<string, { descripcion: string; cantidad: number }>,
): DiferenciaConciliacion[] {
  const salida: DiferenciaConciliacion[] = [];
  const vistos = new Set<string>();

  for (const fila of delErp) {
    const codigo = fila.codigo.trim().toUpperCase();
    vistos.add(codigo);
    const apolo = deApolo.get(codigo);
    const segunApolo = apolo?.cantidad ?? 0;
    if (Math.abs(fila.cantidad - segunApolo) < 1e-6) continue;

    salida.push({
      codigo,
      descripcion: apolo?.descripcion ?? "",
      segunErp: fila.cantidad,
      segunApolo,
      diferencia: fila.cantidad - segunApolo,
    });
  }

  // Lo que Apolo tiene y el ERP no menciona también es una diferencia.
  for (const [codigo, apolo] of deApolo) {
    if (vistos.has(codigo) || apolo.cantidad === 0) continue;
    salida.push({
      codigo,
      descripcion: apolo.descripcion,
      segunErp: 0,
      segunApolo: apolo.cantidad,
      diferencia: -apolo.cantidad,
    });
  }

  return salida.sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia));
}
