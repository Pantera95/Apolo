/**
 * Genera los entregables de los cuatro modelos de muestra, fuera del navegador.
 *
 * No sustituye a la verificación en la pantalla: sirve para MIRAR las hojas
 * —que es la única forma de ver que una columna se sale o que un texto pisa
 * otro— sin pulsar botones y abrir el visor a mano en cada cambio.
 *
 *   node scripts/pdf-muestra.mjs [carpeta de salida]
 */
import { mkdirSync, writeFileSync } from "node:fs";

import { generarApu } from "../lib/licitaciones/apu-pdf.ts";
import { HISTORICO_DEMO, leerScheduleCsv } from "../lib/licitaciones/ingesta.ts";
import { generarInforme } from "../lib/licitaciones/informe-pdf.ts";
import { csvDeModelo, MODELOS_DEMO } from "../lib/licitaciones/modelos-demo.ts";
import { estimar } from "../lib/licitaciones/motor.ts";
import { PARAMETROS_INICIALES } from "../lib/licitaciones/tipos.ts";

const salida = process.argv[2] ?? ".";
mkdirSync(salida, { recursive: true });

const CLIENTE = "Multiservicios y Construcciones Global XXI, C.A.";
const PREPARADO_POR = "Departamento de Estimaciones y Costos";

const usd = (n) =>
  new Intl.NumberFormat("es-VE", { maximumFractionDigits: 0 }).format(n);

for (const modelo of MODELOS_DEMO) {
  const csv = csvDeModelo(modelo);
  const ingesta = leerScheduleCsv(csv, modelo.archivo);
  const estimacion = estimar(ingesta.renglones, PARAMETROS_INICIALES);

  // El CSV también se escribe: sirve para arrastrarlo a la pantalla y para
  // enseñar de qué se partió.
  writeFileSync(`${salida}/${modelo.archivo}`, "﻿" + csv);

  const comun = {
    proyecto: modelo.nombre,
    cliente: CLIENTE,
    simulado: false,
    muestra: true,
    preparadoPor: PREPARADO_POR,
    parametros: PARAMETROS_INICIALES,
  };

  const informe = generarInforme({
    ...comun,
    origen: "Schedule en CSV",
    archivo: modelo.archivo,
    estimacion,
    historico: HISTORICO_DEMO,
  });

  const detallados = estimacion.apus.filter((a) => a.desglose.detallado);
  const apu = generarApu({ ...comun, apus: detallados });

  const escribir = (doc, sufijo) => {
    const bytes = Buffer.from(doc.output("arraybuffer"));
    const nombre = `${modelo.id}-${sufijo}.pdf`;
    writeFileSync(`${salida}/${nombre}`, bytes);
    return `${nombre} (${doc.getNumberOfPages()} pág · ${Math.round(bytes.length / 1024)} KB)`;
  };

  console.log(`\n${modelo.nombre}`);
  console.log(`  ${ingesta.renglones.length} renglones · ${estimacion.porDisciplina.length} disciplinas`);
  console.log(`  USD ${usd(estimacion.totalUsd)} · ${Math.ceil(estimacion.diasEstimados)} días · ${usd(estimacion.horasHombre)} HH`);
  console.log(`  ${escribir(informe, "informe")}`);
  console.log(`  ${escribir(apu, "apu")}  — ${detallados.length} de ${estimacion.apus.length} renglones con composición`);
}
