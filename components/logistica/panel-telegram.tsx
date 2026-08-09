"use client";

import { useEffect, useState } from "react";

import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import {
  enlaceRutaCompleta,
  enlaceSiguienteParada,
} from "@/lib/logistica/enlaces";
import { debeEnviar, type EnvioRegistrado } from "@/lib/logistica/nucleo";
import {
  aptitud,
  componer,
  PLANTILLAS,
  textoPlano,
  type CtxLogistica,
  type IdPlantilla,
} from "@/lib/logistica/plantillas";
import {
  CHOFERES_DEMO,
  LUGARES_DEMO,
  SUSCRIPCIONES_DEMO,
  VEHICULOS_DEMO,
  etaDeRuta,
  eventosDeRuta,
} from "@/lib/logistica/simulado";
import type { PlanRuta, PosicionVehiculo } from "@/lib/logistica/tipos";
import { usePreferencias } from "@/lib/preferencias";

/**
 * Informes logísticos por Telegram — Premium.
 *
 * Compone el aviso a partir del estado REAL del viaje seleccionado y lo envía
 * por `/api/telegram`, que corre en el servidor. El token no llega nunca al
 * navegador.
 *
 * Cada plantilla enseña su mensaje EXACTO antes de enviar. Un botón de envío
 * sin vista previa manda a ciegas a un grupo de la empresa, y de ahí no se
 * vuelve.
 */

export function PanelTelegram({
  rutas,
  posiciones,
  ahora,
}: {
  rutas: PlanRuta[];
  posiciones: Map<string, PosicionVehiculo>;
  ahora: number;
}) {
  const { t, idioma } = usePreferencias();
  const [plantilla, setPlantilla] = useState<IdPlantilla>("en_ruta");
  const [rutaId, setRutaId] = useState(rutas[0]?.id ?? "");
  const [chatId, setChatId] = useState("");
  const [configurado, setConfigurado] = useState<boolean | null>(null);
  const [resultado, setResultado] = useState<{ ok: boolean; motivo: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [historial, setHistorial] = useState<EnvioRegistrado[]>([]);

  useEffect(() => {
    let vivo = true;
    fetch("/api/telegram")
      .then((r) => r.json())
      .then((d: { configurado?: boolean }) => vivo && setConfigurado(Boolean(d.configurado)))
      .catch(() => vivo && setConfigurado(false));
    return () => {
      vivo = false;
    };
  }, []);

  const ruta = rutas.find((r) => r.id === rutaId) ?? rutas[0];
  if (!ruta) return null;

  const pos = posiciones.get(ruta.vehiculoId);
  const vehiculo = VEHICULOS_DEMO.find((v) => v.id === ruta.vehiculoId);
  const info = pos ? etaDeRuta(ruta, pos, ahora) : null;
  const eventos = pos ? eventosDeRuta(ruta, pos, ahora) : [];
  const def = PLANTILLAS.find((p) => p.id === plantilla) as (typeof PLANTILLAS)[number];

  const hora = (iso: string) =>
    new Date(iso).toLocaleTimeString(idioma === "es" ? "es-VE" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

  // Enlaces de navegación: se calculan aquí y se pasan a la plantilla para que
  // el mensaje y los botones de la pantalla usen exactamente la misma URL.
  const rutaMaps = enlaceRutaCompleta(ruta, LUGARES_DEMO);
  const siguienteMaps = enlaceSiguienteParada(ruta, LUGARES_DEMO);

  const nombreLugar = (id: string) =>
    LUGARES_DEMO.find((l) => l.id === id)?.nombre ?? "—";

  const contexto: CtxLogistica = {
    ruta,
    rutas,
    vehiculo: vehiculo?.descripcion ?? ruta.vehiculoId,
    capacidad: vehiculo?.capacidad ?? null,
    chofer: CHOFERES_DEMO[ruta.vehiculoId] ?? "—",
    destino: info ? nombreLugar(info.parada.lugarId) : "—",
    eta: info?.eta ?? null,
    eventos,
    velocidadKmh: pos?.velocidadKmh ?? null,
    hora,
    nombreLugar,
    urlRuta: rutaMaps?.url ?? null,
    urlSiguiente: siguienteMaps?.url ?? null,
    nombreSiguiente: siguienteMaps?.destino.nombre ?? null,
    paradasEnEnlace: rutaMaps?.paradas ?? 0,
    omitidas: rutaMaps?.omitidas ?? [],
  };

  /*
    LA APTITUD SE CONSULTA ANTES DE COMPONER, y el resultado se enseña en
    pantalla. El riesgo de este panel nunca fue que fallara el envío —Telegram
    acepta cualquier texto— sino que enviara algo FALSO delante de un cliente.
  */
  const apta = aptitud(plantilla, contexto);
  const html = apta.apto ? componer(plantilla, contexto) : "";

  // Se comprueba el anti-spam ANTES de enviar y se enseña el veredicto: así el
  // operador entiende por qué un mensaje no sale, en vez de pulsar tres veces.
  const veredicto = debeEnviar(
    {
      clave: `${ruta.id}|${plantilla}`,
      destino: chatId || "por-defecto",
      severidad: def.severidad,
      titulo: def.nombre,
      cuerpo: "",
    },
    "informativa",
    historial,
    ahora,
  );

  async function enviar() {
    setEnviando(true);
    setResultado(null);
    try {
      const r = await fetch("/api/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: html, chatId: chatId.trim() || undefined }),
      });
      const d = (await r.json()) as { enviado?: boolean; motivo?: string };
      setResultado({
        ok: Boolean(d.enviado),
        motivo: d.motivo ?? "Telegram aceptó el mensaje.",
      });
      if (d.enviado) {
        setHistorial((h) => [
          ...h,
          { clave: `${ruta.id}|${plantilla}`, severidad: def.severidad, enviadoEnMs: Date.now() },
        ]);
      }
    } catch (e) {
      setResultado({ ok: false, motivo: e instanceof Error ? e.message : String(e) });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="min-w-0 rounded-tarjeta border border-borde-fuerte bg-superficie p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Insignia tono="marca">Premium</Insignia>
            <h2 className="text-sm font-extrabold uppercase tracking-[0.06em]">
              {t("tg.panel")}
            </h2>
          </div>
          <p className="mt-1 text-xs text-texto-3">{t("tg.panelSub")}</p>
        </div>
        <Insignia tono={configurado ? "ok" : "advertencia"} punto>
          {configurado === null
            ? "…"
            : configurado
              ? t("tg.configurado")
              : t("tg.noConfigurado")}
        </Insignia>
      </div>

      {configurado === false && (
        <div className="mt-3">
          <Alerta tono="advertencia" titulo={t("tg.noConfigurado")}>
            {t("tg.noConfiguradoDetalle")}
          </Alerta>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3">
          <div>
            <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.08em] text-texto-2">
              {t("tg.plantilla")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PLANTILLAS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={p.id === plantilla}
                  onClick={() => {
                    setPlantilla(p.id);
                    setResultado(null);
                  }}
                  className={`flex min-h-11 items-center rounded-pildora border px-3 text-[11px] font-bold transition-colors ${
                    p.id === plantilla
                      ? "border-marca bg-marca-tenue text-marca"
                      : "border-borde bg-superficie-2 text-texto-2 hover:text-texto"
                  }`}
                >
                  {p.nombre}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="min-w-0 text-xs">
              <span className="mb-1.5 block font-extrabold uppercase tracking-[0.08em] text-texto-2">
                Viaje
              </span>
              <select
                value={ruta.id}
                onChange={(e) => setRutaId(e.target.value)}
                className="min-h-12 w-full rounded-control border border-borde-fuerte bg-superficie px-3 text-sm text-texto"
              >
                {rutas.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.codigo}
                  </option>
                ))}
              </select>
            </label>

            <label className="min-w-0 text-xs">
              <span className="mb-1.5 block font-extrabold uppercase tracking-[0.08em] text-texto-2">
                {t("tg.chatId")}
              </span>
              <input
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder={t("tg.chatIdAyuda")}
                className="min-h-12 w-full rounded-control border border-borde-fuerte bg-superficie px-3 text-sm text-texto"
              />
            </label>
          </div>

          {/*
            Por qué esta plantilla no aplica a este viaje. Va ANTES de los
            botones y no como error tras pulsar: en una demostración en vivo,
            enterarse de que el mensaje no procede después de haberlo enviado
            no sirve de nada.
          */}
          {!apta.apto && (
            <div
              data-mov="aviso"
              className="rounded-control border border-advertencia bg-advertencia-tenue p-3 text-xs"
            >
              <p className="font-bold text-advertencia">
                Esta plantilla no aplica a {ruta.codigo}
              </p>
              <p className="mt-1 text-texto-2">{apta.motivo}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Boton
              variante="primario"
              onClick={enviar}
              disabled={enviando || !apta.apto}
            >
              {enviando ? t("tg.enviando") : t("tg.enviarAhora")}
            </Boton>
            <Boton
              variante="suave"
              onClick={() => void navigator.clipboard?.writeText(textoPlano(html))}
              disabled={!apta.apto}
            >
              {t("tg.copiar")}
            </Boton>
          </div>

          {/*
            Los enlaces se abren desde la pantalla ANTES de mandarlos a un
            grupo: comprobar que la ruta es la correcta después de enviarla a
            veinte personas ya no sirve de nada.
          */}
          {(rutaMaps || siguienteMaps) && (
            <div className="rounded-control border border-borde bg-superficie-2 p-3">
              <p className="mono mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-texto-3">
                Navegación · Google Maps
              </p>
              <div className="flex flex-wrap gap-2">
                {siguienteMaps && (
                  <a
                    href={siguienteMaps.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-control border border-borde-fuerte px-3 text-xs font-bold text-texto hover:border-marca hover:text-marca"
                  >
                    🧭 Ir a {siguienteMaps.destino.nombre}
                  </a>
                )}
                {rutaMaps && (
                  <a
                    href={rutaMaps.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-control border border-borde-fuerte px-3 text-xs font-bold text-texto hover:border-marca hover:text-marca"
                  >
                    🗺 Ruta completa ({rutaMaps.paradas})
                  </a>
                )}
              </div>
              {rutaMaps && rutaMaps.omitidas.length > 0 && (
                <p className="mt-2 text-[11px] text-advertencia">
                  No caben en el enlace: {rutaMaps.omitidas.join(", ")}. Google
                  admite 9 paradas por ruta.
                </p>
              )}
            </div>
          )}

          {!veredicto.enviar && (
            <p className="text-[11px] text-advertencia">
              Anti-spam: {veredicto.motivo}. Se enviaría igual si la severidad subiera.
            </p>
          )}

          {resultado && (
            <Alerta
              tono={resultado.ok ? "luz" : "advertencia"}
              titulo={resultado.ok ? t("tg.enviado") : t("tg.noEnviado")}
            >
              {resultado.motivo}
            </Alerta>
          )}

          <div>
            <p className="mono mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-texto-3">
              Suscripciones
            </p>
            <ul className="flex flex-col gap-1.5">
              {SUSCRIPCIONES_DEMO.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-borde pb-1.5 text-xs last:border-0"
                >
                  <span className="min-w-0">
                    <span className="font-bold">{s.etiqueta}</span>
                    {/* Nunca el chat_id completo. */}
                    <span className="mono ml-2 text-texto-3">{s.chatId}</span>
                  </span>
                  <Insignia tono={s.activa ? "ok" : "neutro"}>
                    {s.activa ? `≥ ${s.severidadMinima}` : "silenciada"}
                  </Insignia>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="min-w-0">
          <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.08em] text-texto-2">
            {t("tg.vistaPrevia")}
          </p>
          <pre className="mono max-h-[22rem] overflow-auto whitespace-pre-wrap rounded-control border border-borde bg-superficie-2 p-3 text-[11px] leading-relaxed text-texto-2">
            {apta.apto
              ? textoPlano(html)
              : "— Sin mensaje: esta plantilla no aplica al viaje seleccionado —"}
          </pre>
        </div>
      </div>
    </section>
  );
}
