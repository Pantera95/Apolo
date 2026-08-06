"use client";

import { useEffect, useState } from "react";

import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";
import { Dialogo } from "@/components/ui/dialogo";
import { Insignia } from "@/components/ui/insignia";
import { useEstadosFinancieros } from "@/lib/dashboard/estados-store";
import { calcularFinanzas } from "@/lib/dashboard/finanzas";
import {
  PLANTILLAS,
  aTextoPlano,
  componer,
  type IdPlantilla,
} from "@/lib/dashboard/plantillas";
import type { DatosPanel, Filtros } from "@/lib/dashboard/tipos";
import { usePreferencias } from "@/lib/preferencias";

type Estado =
  | { fase: "inactivo" }
  | { fase: "enviando" }
  | { fase: "hecho"; enviado: boolean; motivo?: string; modo?: string };

/**
 * Enviar por Telegram el informe de lo que está en pantalla.
 *
 * LA REGLA QUE LO GOBIERNA: el mensaje se compone del mismo `DatosPanel` que
 * pintó el panel, con los mismos filtros. Recalcular por separado abriría la
 * puerta a que el mensaje dijera cifras distintas de las que el gerente acaba
 * de mirar, y eso destruiría la confianza en las dos cosas a la vez. Por eso la
 * cabecera del mensaje repite periodo, obra y almacén: sin ellos, "USD 60.638
 * en obra" no se puede interpretar.
 *
 * El envío ocurre en `/api/telegram`, en el servidor. El token nunca llega al
 * navegador: quien lo tiene puede leer y escribir en todos los chats del bot.
 */
export function InformeTelegram({
  datos,
  filtros,
  nombreObra,
  nombreAlmacen,
  compacto = true,
}: {
  datos: DatosPanel;
  filtros: Filtros;
  nombreObra: (id: string) => string;
  nombreAlmacen: (id: string) => string;
  compacto?: boolean;
}) {
  const { t, idioma } = usePreferencias();
  const guardado = useEstadosFinancieros();
  const [abierto, setAbierto] = useState(false);
  const [plantilla, setPlantilla] = useState<IdPlantilla>("resumen_direccion");
  const [chatId, setChatId] = useState("");
  const [estado, setEstado] = useState<Estado>({ fase: "inactivo" });
  const [configurado, setConfigurado] = useState<boolean | null>(null);

  // Se consulta al servidor si hay token, sin pedirlo ni recibirlo.
  useEffect(() => {
    if (!abierto || configurado !== null) return;
    let vivo = true;
    fetch("/api/telegram")
      .then((r) => r.json())
      .then((d: { configurado?: boolean }) => {
        if (vivo) setConfigurado(Boolean(d.configurado));
      })
      .catch(() => vivo && setConfigurado(false));
    return () => {
      vivo = false;
    };
  }, [abierto, configurado]);

  const indicadores = calcularFinanzas(guardado.estados, datos.finanzasDerivadas, idioma);

  const html = componer(plantilla, {
    datos,
    filtros,
    indicadores,
    nombreObra,
    nombreAlmacen,
    enlaceBase:
      typeof window === "undefined" ? "https://apolo-swift.vercel.app" : window.location.origin,
    demo: guardado.demo,
  });

  async function enviar() {
    setEstado({ fase: "enviando" });
    try {
      const r = await fetch("/api/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texto: html,
          chatId: chatId.trim() || undefined,
          clave: `${plantilla}|${datos.generadoEn}`,
        }),
      });
      const d = (await r.json()) as { enviado?: boolean; motivo?: string; modo?: string };
      setEstado({
        fase: "hecho",
        enviado: Boolean(d.enviado),
        motivo: d.motivo,
        modo: d.modo,
      });
    } catch (e) {
      setEstado({
        fase: "hecho",
        enviado: false,
        motivo: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return (
    <>
      <Boton compacto={compacto} variante="suave" onClick={() => setAbierto(true)}>
        <span aria-hidden="true" className="mr-1.5">
          ✈
        </span>
        {t("tg.enviar")}
      </Boton>

      <Dialogo
        abierto={abierto}
        titulo={t("tg.titulo")}
        onCerrar={() => {
          setAbierto(false);
          setEstado({ fase: "inactivo" });
        }}
      >
        <div className="flex flex-col gap-4">
          {configurado === false && (
            <Alerta tono="advertencia" titulo={t("tg.noConfigurado")}>
              {t("tg.noConfiguradoDetalle")}
            </Alerta>
          )}
          {configurado === true && (
            <Alerta tono="luz" titulo={t("tg.configurado")}>
              {t("tg.configuradoDetalle")}
            </Alerta>
          )}

          <div>
            <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.08em] text-texto-2">
              {t("tg.plantilla")}
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PLANTILLAS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={p.id === plantilla}
                  onClick={() => {
                    setPlantilla(p.id);
                    setEstado({ fase: "inactivo" });
                  }}
                  className={`min-h-11 rounded-control border p-3 text-left transition-colors ${
                    p.id === plantilla
                      ? "border-marca bg-marca-tenue"
                      : "border-borde bg-superficie hover:border-borde-fuerte"
                  }`}
                >
                  <span className="block text-xs font-bold">{p.nombre}</span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-texto-3">
                    {p.descripcion}
                  </span>
                  <Insignia tono="neutro">{p.destinatario}</Insignia>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="tg-chat"
              className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.08em] text-texto-2"
            >
              {t("tg.chatId")}
            </label>
            <input
              id="tg-chat"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder={t("tg.chatIdAyuda")}
              className="min-h-12 w-full rounded-control border border-borde-fuerte bg-superficie px-3 text-sm text-texto"
            />
          </div>

          <div>
            <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.08em] text-texto-2">
              {t("tg.vistaPrevia")}
            </p>
            {/* Se enseña el mensaje EXACTO que va a salir. Un botón de envío
                sin vista previa manda a ciegas a un grupo de la empresa. */}
            <pre className="mono max-h-64 overflow-auto whitespace-pre-wrap rounded-control border border-borde bg-superficie-2 p-3 text-[11px] leading-relaxed text-texto-2">
              {aTextoPlano(html)}
            </pre>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Boton
              variante="primario"
              onClick={enviar}
              disabled={estado.fase === "enviando"}
            >
              {estado.fase === "enviando" ? t("tg.enviando") : t("tg.enviarAhora")}
            </Boton>
            <Boton
              variante="suave"
              onClick={() => void navigator.clipboard?.writeText(aTextoPlano(html))}
            >
              {t("tg.copiar")}
            </Boton>
          </div>

          {estado.fase === "hecho" && (
            <Alerta
              tono={estado.enviado ? "luz" : "advertencia"}
              titulo={estado.enviado ? t("tg.enviado") : t("tg.noEnviado")}
            >
              {estado.motivo ?? t("tg.enviadoDetalle")}
            </Alerta>
          )}
        </div>
      </Dialogo>
    </>
  );
}
