/**
 * Genera los dos entregables fuera del navegador, para inspeccionarlos.
 *
 * No sustituye a la verificación en la pantalla: sirve para MIRAR las hojas
 * —que es la única forma de ver que una columna se sale o que un texto pisa
 * otro— sin tener que pulsar botones y abrir el visor a mano en cada cambio.
 */
import { writeFileSync } from "node:fs";

import { generarApu } from "../lib/licitaciones/apu-pdf.ts";
import { computoSimulado, HISTORICO_DEMO } from "../lib/licitaciones/ingesta.ts";
import { generarInforme } from "../lib/licitaciones/informe-pdf.ts";
import { estimar } from "../lib/licitaciones/motor.ts";
import { PARAMETROS_INICIALES } from "../lib/licitaciones/tipos.ts";

const salida = process.argv[2] ?? ".";

const ingesta = computoSimulado("plataforma-fase1.rvt", "revit");
const estimacion = estimar(ingesta.renglones, PARAMETROS_INICIALES);

const comun = {
  proyecto: "Plataforma de procesamiento y módulos civiles · Fase 1",
  cliente: "Multiservicios y Construcciones Global XXI, C.A.",
  simulado: ingesta.simulado,
  preparadoPor: "Departamento de Estimaciones y Costos",
};

const informe = generarInforme({
  ...comun,
  origen: "Autodesk Revit",
  archivo: ingesta.archivo,
  estimacion,
  parametros: PARAMETROS_INICIALES,
  historico: HISTORICO_DEMO,
});

const detallados = estimacion.apus.filter((a) => a.desglose.detallado);
const apu = generarApu({
  ...comun,
  apus: detallados,
  parametros: PARAMETROS_INICIALES,
});

const escribir = (doc, nombre) => {
  const bytes = Buffer.from(doc.output("arraybuffer"));
  writeFileSync(`${salida}/${nombre}`, bytes);
  console.log(`${nombre.padEnd(14)} ${doc.getNumberOfPages()} pág · ${(bytes.length / 1024).toFixed(0)} KB`);
};

escribir(informe, "informe.pdf");
escribir(apu, "apu.pdf");

console.log(`\nRenglones con composición: ${detallados.length} de ${estimacion.apus.length}`);
console.log(`Total ofertado: USD ${estimacion.totalUsd.toFixed(2)}`);
console.log(`Plazo: ${Math.ceil(estimacion.diasEstimados)} días · HH: ${estimacion.horasHombre.toFixed(0)}`);
