"use client";

import { useState } from "react";

import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";
import type { DatosApu } from "@/lib/licitaciones/apu-pdf";
import type { DatosLeyenda, Entregable, Respuesta } from "@/lib/licitaciones/envio";
import type { DatosInforme } from "@/lib/licitaciones/informe-pdf";

/**
 * Los dos entregables: descargarlos o mandarlos por Telegram.
 *
 * EL MÓDULO DE PDF SE CARGA CON `import()` DINÁMICO, y las importaciones de
 * arriba son solo de tipos —que desaparecen al compilar—. jsPDF y su plugin de
 * tablas pesan cerca de 400 KB: traerlos de forma estática se los cobraría a
 * todo el que entra a Compras nada más que a mirar órdenes de compra, que es
 * la mayoría. Así llegan la primera vez que alguien pulsa un botón.
 */

/** Carga perezosa del módulo de generación y envío. */
const cargarEnvio = () => import("@/lib/licitaciones/envio");

interface Props {
  informe: DatosInforme;
  apu: DatosApu;
  leyendaDatos: DatosLeyenda;
}

type Estado =
  | { fase: "quieto" }
  | { fase: "generando"; que: Entregable }
  | { fase: "enviando"; que: Entregable }
  | { fase: "hecho"; respuesta: Respuesta };

export function Entregables({ informe, apu, leyendaDatos }: Props) {
  const [estado, setEstado] = useState<Estado>({ fase: "quieto" });

  const ocupado = estado.fase === "generando" || estado.fase === "enviando";

  async function bajar(que: Entregable) {
    setEstado({ fase: "generando", que });
    try {
      const { construir, descargar } = await cargarEnvio();
      // Ceder un fotograma: componer las hojas bloquea el hilo principal, y sin
      // esto el botón nunca llega a pintarse en su estado de carga.
      await new Promise((r) => setTimeout(r, 30));
      const { blob, nombre } = construir(que, informe, apu);
      descargar(blob, nombre);
      setEstado({ fase: "quieto" });
    } catch (e) {
      setEstado({
        fase: "hecho",
        respuesta: {
          enviado: false,
          modo: "error-generacion",
          motivo: e instanceof Error ? e.message : "No se pudo generar el PDF.",
        },
      });
    }
  }

  async function enviar(que: Entregable) {
    setEstado({ fase: "generando", que });
    try {
      const { construir, enviarPorTelegram, leyenda } = await cargarEnvio();
      await new Promise((r) => setTimeout(r, 30));
      const { blob, nombre } = construir(que, informe, apu);
      setEstado({ fase: "enviando", que });
      const respuesta = await enviarPorTelegram(blob, nombre, leyenda(que, leyendaDatos));
      setEstado({ fase: "hecho", respuesta });
    } catch (e) {
      setEstado({
        fase: "hecho",
        respuesta: {
          enviado: false,
          modo: "error-generacion",
          motivo: e instanceof Error ? e.message : "No se pudo generar el PDF.",
        },
      });
    }
  }

  const etiqueta = (que: Entregable, base: string) => {
    if (estado.fase === "generando" && estado.que === que) return "Generando…";
    if (estado.fase === "enviando" && estado.que === que) return "Enviando…";
    return base;
  };

  return (
    <div className="flex flex-col gap-3 rounded-tarjeta border border-borde bg-superficie-2 p-4">
      <div>
        <h3 className="text-xs font-extrabold uppercase tracking-[0.06em]">Entregables</h3>
        <p className="mt-0.5 text-xs text-texto-3">
          Se generan con los datos y parámetros que hay ahora en pantalla.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Documento
          titulo="Informe consolidado"
          detalle="Resumen, MTO, tiempos, estructura de precio, KPIs y matriz RFQ."
          onBajar={() => bajar("informe")}
          onEnviar={() => enviar("informe")}
          textoBajar={etiqueta("informe", "Descargar PDF")}
          textoEnviar={etiqueta("informe", "Enviar por Telegram")}
          ocupado={ocupado}
        />
        <Documento
          titulo="Análisis de precios unitarios"
          detalle={`${apu.apus.length} hojas de APU, una por renglón, en el formato de planilla del cliente.`}
          onBajar={() => bajar("apu")}
          onEnviar={() => enviar("apu")}
          textoBajar={etiqueta("apu", "Descargar PDF")}
          textoEnviar={etiqueta("apu", "Enviar por Telegram")}
          ocupado={ocupado}
        />
      </div>

      {estado.fase === "hecho" && <Resultado respuesta={estado.respuesta} />}
    </div>
  );
}

function Documento({
  titulo,
  detalle,
  onBajar,
  onEnviar,
  textoBajar,
  textoEnviar,
  ocupado,
}: {
  titulo: string;
  detalle: string;
  onBajar: () => void;
  onEnviar: () => void;
  textoBajar: string;
  textoEnviar: string;
  ocupado: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-tarjeta border border-borde bg-superficie p-3">
      <div className="min-w-0">
        <p className="text-xs font-bold">{titulo}</p>
        <p className="mt-0.5 text-[0.7rem] leading-snug text-texto-3">{detalle}</p>
      </div>
      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        <Boton compacto variante="suave" onClick={onBajar} disabled={ocupado}>
          {textoBajar}
        </Boton>
        <Boton compacto onClick={onEnviar} disabled={ocupado}>
          {textoEnviar}
        </Boton>
      </div>
    </div>
  );
}

function Resultado({ respuesta }: { respuesta: Respuesta }) {
  if (respuesta.enviado) {
    const kb = respuesta.bytes ? ` · ${Math.round(respuesta.bytes / 1024)} KB` : "";
    return (
      <Alerta tono="luz" titulo="Enviado">
        {respuesta.archivo}
        {kb} llegó al canal de Telegram.
      </Alerta>
    );
  }

  // "No configurado" no es una avería: es el estado normal de un demo sin
  // credenciales, y se distingue en el tono para no alarmar en una demostración.
  const esAviso = respuesta.modo === "no-configurado";
  return (
    <Alerta
      tono={esAviso ? "advertencia" : "peligro"}
      titulo={esAviso ? "Telegram no está configurado" : "No se pudo enviar"}
    >
      {respuesta.motivo}
    </Alerta>
  );
}
