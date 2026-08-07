"use client";

import { useEffect, useState } from "react";

import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import type { DatosApu } from "@/lib/licitaciones/apu-pdf";
import type { DatosInforme } from "@/lib/licitaciones/informe-pdf";
import {
  componer,
  PLANTILLAS_EST,
  textoPlano,
  type CtxPlantilla,
  type IdPlantillaEst,
} from "@/lib/licitaciones/plantillas";
import { debeEnviar, type EnvioRegistrado } from "@/lib/logistica/nucleo";
import { useAhora } from "@/lib/tiempo";

/**
 * Envío de la estimación por Telegram — Premium.
 *
 * Es el último eslabón del flujo: modelo → motor → MTO/RFQ/APU → KPIs →
 * documento → aquí. Replica el panel de Centro de Control porque el operador
 * ya sabe usarlo, y una segunda forma de mandar avisos en la misma aplicación
 * solo sirve para que nadie recuerde cuál hace qué.
 *
 * REUSA EL ANTI-SPAM DE LOGÍSTICA (`debeEnviar`) en vez de duplicarlo. El
 * enfriamiento por severidad no es una regla de rutas: es una regla de
 * notificaciones, y vale igual para "camión detenido" que para "estimación
 * lista". Duplicarla garantizaría que un día se arreglen distinto.
 *
 * TODA PLANTILLA ENSEÑA SU MENSAJE EXACTO ANTES DE ENVIAR. Un botón sin vista
 * previa manda a ciegas a un grupo de la empresa, y de ahí no se vuelve.
 */

/** A qué se suscribe cada destino. Demo: en producción vendría de la ficha. */
const SUSCRIPCIONES = [
  { id: "s1", chatId: "-100••••4821", etiqueta: "Gerencia de Licitaciones", minima: "informativa", activa: true },
  { id: "s2", chatId: "••••7734", etiqueta: "Compras y Procura", minima: "advertencia", activa: true },
  { id: "s3", chatId: "••••2190", etiqueta: "Dirección — aprobación de ofertas", minima: "alta", activa: true },
  { id: "s4", chatId: "••••5512", etiqueta: "Ingeniería de campo", minima: "alta", activa: false },
] as const;

type Adjunto = "ninguno" | "informe" | "apu";

interface Props {
  ctx: CtxPlantilla;
  informe: DatosInforme;
  apu: DatosApu;
}

export function PanelTelegramEstimacion({ ctx, informe, apu }: Props) {
  const [plantilla, setPlantilla] = useState<IdPlantillaEst>("resumen");
  const [adjunto, setAdjunto] = useState<Adjunto>("informe");
  const [chatId, setChatId] = useState("");
  const [configurado, setConfigurado] = useState<boolean | null>(null);
  const [fase, setFase] = useState<"quieto" | "generando" | "enviando">("quieto");
  const [resultado, setResultado] = useState<{ ok: boolean; motivo: string } | null>(null);
  const [historial, setHistorial] = useState<EnvioRegistrado[]>([]);
  // `Date.now()` en render es impuro y React lo prohíbe: el reloj del proyecto
  // entrega un instante estable durante el pintado.
  const ahora = useAhora();

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

  const def = PLANTILLAS_EST.find((p) => p.id === plantilla)!;
  const html = componer(plantilla, ctx);
  const plano = textoPlano(html);
  const ocupado = fase !== "quieto";

  // El anti-spam se consulta ANTES de enviar y se enseña el veredicto: así se
  // entiende por qué un mensaje no saldría, en vez de pulsar tres veces.
  const veredicto = debeEnviar(
    {
      clave: `${ctx.archivo}|${plantilla}`,
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
    setResultado(null);
    try {
      if (adjunto === "ninguno") {
        setFase("enviando");
        const r = await fetch("/api/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texto: html, chatId: chatId.trim() || undefined }),
        });
        const d = (await r.json()) as { enviado?: boolean; motivo?: string };
        setResultado({ ok: Boolean(d.enviado), motivo: d.motivo ?? "Telegram aceptó el mensaje." });
        if (d.enviado) registrar();
        return;
      }

      setFase("generando");
      // El módulo de PDF pesa ~400 KB: se trae solo cuando hace falta.
      const { construir, enviarPorTelegram } = await import("@/lib/licitaciones/envio");
      await new Promise((r) => setTimeout(r, 30));
      const { blob, nombre } = construir(adjunto, informe, apu);

      setFase("enviando");
      // El mensaje compuesto viaja como LEYENDA del documento, no como un
      // mensaje aparte: dos avisos seguidos obligan a leer el segundo para
      // entender el primero, y en un grupo activo se separan solos.
      const resp = await enviarPorTelegram(blob, nombre, html, chatId.trim() || undefined);
      setResultado({
        ok: Boolean(resp.enviado),
        motivo: resp.enviado
          ? `${resp.archivo} · ${Math.round((resp.bytes ?? 0) / 1024)} KB llegó al canal.`
          : (resp.motivo ?? "No se pudo enviar."),
      });
      if (resp.enviado) registrar();
    } catch (e) {
      setResultado({ ok: false, motivo: e instanceof Error ? e.message : String(e) });
    } finally {
      setFase("quieto");
    }
  }

  function registrar() {
    setHistorial((h) => [
      ...h,
      { clave: `${ctx.archivo}|${plantilla}`, severidad: def.severidad, enviadoEnMs: Date.now() },
    ]);
  }

  async function descargar(que: "informe" | "apu") {
    setFase("generando");
    try {
      const { construir, descargar: bajar } = await import("@/lib/licitaciones/envio");
      await new Promise((r) => setTimeout(r, 30));
      const { blob, nombre } = construir(que, informe, apu);
      bajar(blob, nombre);
    } finally {
      setFase("quieto");
    }
  }

  return (
    <section className="min-w-0 rounded-tarjeta border border-borde-fuerte bg-superficie p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Insignia tono="marca">Premium</Insignia>
            <h2 className="text-sm font-extrabold uppercase tracking-[0.06em]">
              Envío de la estimación por Telegram
            </h2>
          </div>
          <p className="mt-1 text-xs text-texto-3">
            Plantillas, documento adjunto y estado del canal.
          </p>
        </div>
        <Insignia tono={configurado ? "ok" : "advertencia"} punto>
          {configurado === null ? "…" : configurado ? "Bot configurado" : "Bot sin configurar"}
        </Insignia>
      </div>

      {configurado === false && (
        <div className="mt-3">
          <Alerta tono="advertencia" titulo="Bot sin configurar">
            Falta `TELEGRAM_BOT_TOKEN` en el servidor. El mensaje y el PDF se
            componen igual, pero no salen.
          </Alerta>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3">
          <div>
            <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.08em] text-texto-2">
              Plantilla
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PLANTILLAS_EST.map((p) => (
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

          <div>
            <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.08em] text-texto-2">
              Documento adjunto
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["informe", "Informe consolidado"],
                  ["apu", `APU · ${apu.apus.length} hojas`],
                  ["ninguno", "Solo el mensaje"],
                ] as const
              ).map(([id, nombre]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={id === adjunto}
                  onClick={() => {
                    setAdjunto(id);
                    setResultado(null);
                  }}
                  className={`flex min-h-11 items-center rounded-pildora border px-3 text-[11px] font-bold transition-colors ${
                    id === adjunto
                      ? "border-marca bg-marca-tenue text-marca"
                      : "border-borde bg-superficie-2 text-texto-2 hover:text-texto"
                  }`}
                >
                  {nombre}
                </button>
              ))}
            </div>
          </div>

          <label className="min-w-0 text-xs">
            <span className="mb-1.5 block font-extrabold uppercase tracking-[0.08em] text-texto-2">
              Chat de destino
            </span>
            <input
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="Vacío = chat por defecto del servidor"
              className="min-h-12 w-full rounded-control border border-borde-fuerte bg-superficie px-3 text-sm text-texto"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <Boton variante="primario" onClick={enviar} disabled={ocupado}>
              {fase === "generando" ? "Generando PDF…" : fase === "enviando" ? "Enviando…" : "Enviar ahora"}
            </Boton>
            <Boton
              variante="suave"
              onClick={() => void navigator.clipboard?.writeText(plano)}
              disabled={ocupado}
            >
              Copiar texto
            </Boton>
          </div>

          {/*
            Descargar antes de enviar. Revisar el PDF después de mandarlo a
            veinte personas ya no sirve de nada.
          */}
          <div className="rounded-control border border-borde bg-superficie-2 p-3">
            <p className="mono mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-texto-3">
              Revisar antes de enviar
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void descargar("informe")}
                disabled={ocupado}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-control border border-borde-fuerte px-3 text-xs font-bold text-texto hover:border-marca hover:text-marca disabled:opacity-50"
              >
                📄 Informe consolidado
              </button>
              <button
                type="button"
                onClick={() => void descargar("apu")}
                disabled={ocupado}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-control border border-borde-fuerte px-3 text-xs font-bold text-texto hover:border-marca hover:text-marca disabled:opacity-50"
              >
                📐 APU ({apu.apus.length} hojas)
              </button>
            </div>
            {apu.apus.length < ctx.estimacion.apus.length && (
              <p className="mt-2 text-[11px] text-texto-3">
                {ctx.estimacion.apus.length - apu.apus.length} renglones no
                llevan composición cargada y no generan hoja de APU.
              </p>
            )}
          </div>

          {!veredicto.enviar && (
            <p className="text-[11px] text-advertencia">
              Anti-spam: {veredicto.motivo}. Se enviaría igual si la severidad subiera.
            </p>
          )}

          {resultado && (
            <Alerta
              tono={resultado.ok ? "luz" : "advertencia"}
              titulo={resultado.ok ? "Enviado" : "No enviado"}
            >
              {resultado.motivo}
            </Alerta>
          )}

          <div>
            <p className="mono mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-texto-3">
              Suscripciones
            </p>
            <ul className="flex flex-col gap-1.5">
              {SUSCRIPCIONES.map((s) => (
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
                    {s.activa ? `≥ ${s.minima}` : "silenciada"}
                  </Insignia>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-texto-2">
              Vista previa del mensaje
            </p>
            <Insignia tono={def.severidad === "alta" ? "advertencia" : "neutro"}>
              {def.severidad}
            </Insignia>
          </div>
          <pre className="mono max-h-[26rem] overflow-auto whitespace-pre-wrap rounded-control border border-borde bg-superficie-2 p-3 text-[11px] leading-relaxed text-texto-2">
            {plano}
          </pre>
          {adjunto !== "ninguno" && (
            <p className="mt-2 text-[11px] text-texto-3">
              Este texto viaja como leyenda del PDF adjunto ({plano.length}/1024
              caracteres).
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
