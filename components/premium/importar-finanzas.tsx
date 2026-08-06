"use client";

import { useRef, useState } from "react";

import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";
import { Dialogo } from "@/components/ui/dialogo";
import {
  importarEstadosFinancieros,
  plantillaCsv,
  type ResultadoImportacion,
} from "@/lib/dashboard/finanzas";
import {
  guardarEstados,
  limpiarEstados,
  useEstadosFinancieros,
} from "@/lib/dashboard/estados-store";
import { usePreferencias } from "@/lib/preferencias";

/**
 * Importación de estados financieros.
 *
 * Apolo no tiene ventas, ni patrimonio, ni caja: nunca factura, es una regla
 * del producto. Los trece indicadores que dependen del balance y de la cuenta
 * de resultados solo pueden salir de un archivo que aporte el contador.
 *
 * El botón está en el panel básico Y en el Premium, porque la cifra importada
 * es la misma en los dos y obligar a activar Premium para cargarla sería una
 * traba artificial.
 *
 * El formato es PROVISIONAL hasta que el cliente confirme el suyo, y la
 * pantalla lo dice: prometer un formato definitivo que después cambia obliga a
 * reimportar todo.
 */
export function ImportarFinanzas({ compacto = true }: { compacto?: boolean }) {
  const { t } = usePreferencias();
  const guardado = useEstadosFinancieros();
  const [abierto, setAbierto] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  const hayDatos = Object.keys(guardado.estados).length > 0;

  async function alElegir(archivo: File) {
    setAviso(null);
    setResultado(null);

    const texto = await archivo.text();

    // Un .xlsx es un zip: empieza por "PK". Si se intentara leer como texto
    // saldría basura y el usuario vería "0 conceptos reconocidos" sin saber por
    // qué. Mejor decirle exactamente qué hacer.
    if (texto.startsWith("PK")) {
      setAviso(t("fin.xlsxNoSoportado"));
      return;
    }

    const r = importarEstadosFinancieros(texto);
    setResultado(r);
    if (r.reconocidos.length > 0) {
      guardarEstados(r.estados, archivo.name);
    }
  }

  return (
    <>
      <Boton
        compacto={compacto}
        variante={hayDatos ? "suave" : "luz"}
        onClick={() => setAbierto(true)}
      >
        <span aria-hidden="true" className="mr-1.5">
          ↥
        </span>
        {hayDatos ? t("fin.datosCargados") : t("fin.importar")}
      </Boton>

      <Dialogo
        abierto={abierto}
        titulo={t("fin.importarTitulo")}
        onCerrar={() => {
          setAbierto(false);
          setResultado(null);
          setAviso(null);
        }}
      >
          <div className="flex flex-col gap-4">
            <Alerta tono="info" titulo={t("fin.formatoProvisional")}>
              {t("fin.formatoDetalle")}
            </Alerta>

            <div className="rounded-control border border-borde bg-superficie-2 p-3">
              <p className="mono text-[11px] leading-relaxed text-texto-2">
                Concepto;Valor
                <br />
                Activo corriente;180000
                <br />
                Pasivo corriente;120000
                <br />
                Utilidad neta;8000
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                ref={entrada}
                type="file"
                accept=".csv,text/csv,.xlsx,.txt"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void alElegir(f);
                  // Permite volver a elegir el MISMO archivo tras corregirlo.
                  e.target.value = "";
                }}
              />
              <Boton variante="primario" onClick={() => entrada.current?.click()}>
                {t("fin.elegirArchivo")}
              </Boton>
              <Boton variante="suave" onClick={descargarPlantilla}>
                {t("fin.plantilla")}
              </Boton>
              {hayDatos && (
                <Boton
                  variante="peligro"
                  onClick={() => {
                    limpiarEstados();
                    setResultado(null);
                  }}
                >
                  {t("fin.borrar")}
                </Boton>
              )}
            </div>

            {aviso && (
              <Alerta tono="advertencia" titulo={t("fin.noSePudoLeer")}>
                {aviso}
              </Alerta>
            )}

            {resultado && (
              <div className="flex flex-col gap-3">
                {resultado.reconocidos.length > 0 && (
                  <Alerta tono="luz" titulo={t("fin.importado")}>
                    {resultado.reconocidos.length} {t("fin.conceptos")}
                  </Alerta>
                )}

                {resultado.desconocidos.length > 0 && (
                  <Alerta tono="advertencia" titulo={t("fin.noReconocidos")}>
                    {/* Se listan: descartarlos en silencio haría que alguien
                        descubriera el hueco cuando un ratio no cuadra. */}
                    {resultado.desconocidos.join(", ")}
                  </Alerta>
                )}

                {resultado.errores.length > 0 && (
                  <Alerta tono="peligro" titulo={t("fin.errores")}>
                    {resultado.errores.join(" · ")}
                  </Alerta>
                )}
              </div>
            )}

            {hayDatos && guardado.archivo && (
              <p className="text-xs text-texto-3">
                {t("fin.origen")}: <span className="font-bold">{guardado.archivo}</span>
              </p>
            )}
        </div>
      </Dialogo>
    </>
  );
}

function descargarPlantilla() {
  // BOM para que Excel en español no destroce las tildes al abrirlo.
  const blob = new Blob(["﻿" + plantillaCsv()], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "apolo-estados-financieros-plantilla.csv";
  a.click();
  URL.revokeObjectURL(url);
}
