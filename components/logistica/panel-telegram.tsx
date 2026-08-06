"use client";

import { useEffect, useState } from "react";

import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { debeEnviar, type EnvioRegistrado } from "@/lib/logistica/nucleo";
import {
  CHOFERES_DEMO,
  LUGARES_DEMO,
  SUSCRIPCIONES_DEMO,
  VEHICULOS_DEMO,
  etaDeRuta,
  eventosDeRuta,
} from "@/lib/logistica/simulado";
import type { PlanRuta, PosicionVehiculo, Severidad } from "@/lib/logistica/tipos";
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

type IdPlantilla = "salida" | "en_ruta" | "alerta" | "entrega" | "resumen";

const PLANTILLAS: { id: IdPlantilla; nombre: string; severidad: Severidad }[] = [
  { id: "salida", nombre: "Salida del almacén", severidad: "informativa" },
  { id: "en_ruta", nombre: "En ruta con ETA", severidad: "informativa" },
  { id: "alerta", nombre: "Alerta de retraso o desvío", severidad: "alta" },
  { id: "entrega", nombre: "Entrega completada", severidad: "informativa" },
  { id: "resumen", nombre: "Resumen de la jornada", severidad: "informativa" },
];

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

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

  const html = componer(plantilla, {
    ruta,
    vehiculo: vehiculo?.descripcion ?? ruta.vehiculoId,
    chofer: CHOFERES_DEMO[ruta.vehiculoId] ?? "—",
    destino: info ? (LUGARES_DEMO.find((l) => l.id === info.parada.lugarId)?.nombre ?? "—") : "—",
    eta: info ? hora(info.eta.llegadaEstimada) : "—",
    desvioMin: info ? Math.round(info.eta.desviacionMin) : 0,
    evento: eventos[0]?.detalle ?? "Sin eventos abiertos",
    rutas,
    hora,
  });

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

          <div className="flex flex-wrap items-center gap-2">
            <Boton variante="primario" onClick={enviar} disabled={enviando}>
              {enviando ? t("tg.enviando") : t("tg.enviarAhora")}
            </Boton>
            <Boton
              variante="suave"
              onClick={() => void navigator.clipboard?.writeText(textoPlano(html))}
            >
              {t("tg.copiar")}
            </Boton>
          </div>

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
            {textoPlano(html)}
          </pre>
        </div>
      </div>
    </section>
  );
}

interface Ctx {
  ruta: PlanRuta;
  vehiculo: string;
  chofer: string;
  destino: string;
  eta: string;
  desvioMin: number;
  evento: string;
  rutas: PlanRuta[];
  hora: (iso: string) => string;
}

function componer(id: IdPlantilla, c: Ctx): string {
  const base = [
    `Despacho: ${esc(c.ruta.paradas[0]?.despachoId ?? "—")}`,
    `Vehículo: ${esc(c.vehiculo)}`,
    `Conductor: ${esc(c.chofer)}`,
    `Ruta: ${esc(c.ruta.codigo)}`,
  ].join("\n");

  switch (id) {
    case "salida":
      return [
        `<b>🚚 Vehículo salió del almacén</b>`,
        base,
        `Destino: ${esc(c.destino)}`,
        `ETA: ${esc(c.eta)}`,
      ].join("\n");
    case "en_ruta":
      return [
        `<b>📍 En ruta</b>`,
        base,
        `Destino: ${esc(c.destino)}`,
        `ETA actual: ${esc(c.eta)}`,
        `Estado: ${c.desvioMin > 10 ? `Retraso de ${c.desvioMin} min` : "En tiempo"}`,
      ].join("\n");
    case "alerta":
      return [
        `<b>⚠️ Alerta en el viaje</b>`,
        base,
        `Motivo detectado: ${esc(c.evento)}`,
        `Retraso estimado: ${Math.max(0, c.desvioMin)} min`,
        ``,
        `Acción recomendada:`,
        `Contactar al conductor y avisar a la obra.`,
      ].join("\n");
    case "entrega":
      return [
        `<b>✅ Entrega completada</b>`,
        base,
        `Obra: ${esc(c.destino)}`,
        `Paradas completadas: ${c.ruta.paradas.filter((p) => p.estado === "completada").length} de ${c.ruta.paradas.length}`,
      ].join("\n");
    case "resumen": {
      const filas = c.rutas
        .map(
          (r) =>
            `• ${esc(r.codigo)} — ${r.paradas.filter((p) => p.estado === "completada").length}/${r.paradas.length} paradas · ${esc(r.estado.replace(/_/g, " "))}`,
        )
        .join("\n");
      return [`<b>📋 Resumen de la jornada</b>`, `Viajes activos: ${c.rutas.length}`, ``, filas].join(
        "\n",
      );
    }
  }
}

function textoPlano(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
