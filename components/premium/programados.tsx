"use client";

import { useEffect, useState } from "react";

import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { useEstadosFinancieros } from "@/lib/dashboard/estados-store";
import { calcularFinanzas } from "@/lib/dashboard/finanzas";
import { PLANTILLAS, componer, type IdPlantilla } from "@/lib/dashboard/plantillas";
import {
  agregarProgramacion,
  alternarProgramacion,
  borrarProgramacion,
  marcarEnviada,
  useProgramaciones,
} from "@/lib/dashboard/programacion";
import type { DatosPanel, Filtros } from "@/lib/dashboard/tipos";
import { proximaEjecucion, toca } from "@/lib/dashboard/vencimiento";
import { usePreferencias } from "@/lib/preferencias";

const DIAS = ["D", "L", "M", "X", "J", "V", "S"];

/**
 * Informes programados.
 *
 * LÍMITE QUE LA PANTALLA DECLARA: hoy la comprobación corre en el navegador, así
 * que solo dispara con Apolo abierto. No es pereza — los datos del demo viven en
 * localStorage y un cron del servidor no tendría nada que leer. La configuración
 * guardada (hora, días, plantilla, chat) es exactamente la que consumirá la
 * Vercel Cron cuando entre Supabase.
 *
 * Decirlo es la diferencia entre una función honesta y una promesa que revienta
 * el primer lunes que nadie abrió la aplicación.
 */
export function InformesProgramados({
  datos,
  filtros,
  ahora,
  nombreObra,
  nombreAlmacen,
}: {
  datos: DatosPanel;
  filtros: Filtros;
  ahora: number;
  nombreObra: (id: string) => string;
  nombreAlmacen: (id: string) => string;
}) {
  const { t, idioma } = usePreferencias();
  const guardado = useEstadosFinancieros();
  const programaciones = useProgramaciones();

  const [plantilla, setPlantilla] = useState<IdPlantilla>("resumen_direccion");
  const [hora, setHora] = useState(7);
  const [minuto, setMinuto] = useState(0);
  const [dias, setDias] = useState<number[]>([1, 2, 3, 4, 5]);
  const [chatId, setChatId] = useState("");
  const [ultimoDisparo, setUltimoDisparo] = useState<string | null>(null);

  const indicadores = calcularFinanzas(guardado.estados, datos.finanzasDerivadas, idioma);

  /**
   * Comprobación de vencimiento.
   *
   * El envío va DENTRO del efecto y no durante el render: disparar una petición
   * de red al pintar duplicaría el mensaje en cada re-render de React.
   */
  useEffect(() => {
    if (ahora === 0) return;
    let cancelado = false;

    for (const p of programaciones) {
      const v = toca(p, ahora);
      if (!v.debe) continue;

      const texto = componer(p.plantilla, {
        datos,
        filtros,
        indicadores,
        nombreObra,
        nombreAlmacen,
        enlaceBase: window.location.origin,
        demo: guardado.demo,
      });

      // Se marca ANTES de que responda la red: si el envío falla, se reintenta
      // mañana. Marcarlo después dejaría la puerta abierta a un bucle de
      // reenvíos si la red va lenta y el componente se vuelve a montar.
      marcarEnviada(p.id, new Date(ahora).toISOString());

      void fetch("/api/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto, chatId: p.chatId || undefined, clave: p.id }),
      })
        .then((r) => r.json())
        .then((d: { enviado?: boolean; motivo?: string }) => {
          if (cancelado) return;
          setUltimoDisparo(
            `${p.etiqueta}: ${d.enviado ? t("tg.enviado") : d.motivo ?? t("tg.noEnviado")}`,
          );
        })
        .catch(() => {
          if (!cancelado) setUltimoDisparo(`${p.etiqueta}: ${t("tg.noEnviado")}`);
        });
    }

    return () => {
      cancelado = true;
    };
    // `datos` cambia en cada recálculo del panel; la guarda de "ya se envió hoy"
    // es lo que impide que eso provoque envíos repetidos.
  }, [programaciones, ahora, datos, filtros, indicadores, nombreObra, nombreAlmacen, guardado.demo, t]);

  const fmt = (d: Date) =>
    d.toLocaleString(idioma === "es" ? "es-VE" : "en-US", {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <section className="min-w-0 rounded-tarjeta border border-borde-fuerte bg-superficie p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Insignia tono="marca">Premium</Insignia>
          <h2 className="text-sm font-extrabold uppercase tracking-[0.06em]">
            {t("prog.titulo")}
          </h2>
        </div>
        <span className="mono text-[11px] text-texto-3">
          {programaciones.filter((p) => p.activa).length} {t("prog.activas")}
        </span>
      </div>

      <div className="mt-3">
        <Alerta tono="info" titulo={t("prog.limite")}>
          {t("prog.limiteDetalle")}
        </Alerta>
      </div>

      {ultimoDisparo && (
        <div className="mt-3">
          <Alerta tono="luz" titulo={t("prog.disparo")}>
            {ultimoDisparo}
          </Alerta>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3">
          <label className="text-xs">
            <span className="mb-1.5 block font-extrabold uppercase tracking-[0.08em] text-texto-2">
              {t("tg.plantilla")}
            </span>
            <select
              value={plantilla}
              onChange={(e) => setPlantilla(e.target.value as IdPlantilla)}
              className="min-h-12 w-full rounded-control border border-borde-fuerte bg-superficie px-3 text-sm text-texto"
            >
              {PLANTILLAS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs">
              <span className="mb-1.5 block font-extrabold uppercase tracking-[0.08em] text-texto-2">
                {t("prog.hora")}
              </span>
              <input
                type="number"
                min={0}
                max={23}
                value={hora}
                onChange={(e) => setHora(Math.min(23, Math.max(0, Number(e.target.value) || 0)))}
                className="min-h-12 w-full rounded-control border border-borde-fuerte bg-superficie px-3 text-sm text-texto"
              />
            </label>
            <label className="text-xs">
              <span className="mb-1.5 block font-extrabold uppercase tracking-[0.08em] text-texto-2">
                {t("prog.minuto")}
              </span>
              <input
                type="number"
                min={0}
                max={59}
                value={minuto}
                onChange={(e) => setMinuto(Math.min(59, Math.max(0, Number(e.target.value) || 0)))}
                className="min-h-12 w-full rounded-control border border-borde-fuerte bg-superficie px-3 text-sm text-texto"
              />
            </label>
          </div>

          <div>
            <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.08em] text-texto-2">
              {t("prog.dias")}
            </span>
            <div className="flex flex-wrap gap-1">
              {DIAS.map((d, i) => (
                <button
                  key={i}
                  type="button"
                  aria-pressed={dias.includes(i)}
                  onClick={() =>
                    setDias((prev) =>
                      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i].sort(),
                    )
                  }
                  className={`flex h-11 w-11 items-center justify-center rounded-control border text-xs font-bold transition-colors ${
                    dias.includes(i)
                      ? "border-marca bg-marca-tenue text-marca"
                      : "border-borde bg-superficie-2 text-texto-3"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <label className="text-xs">
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

          <Boton
            variante="primario"
            onClick={() =>
              agregarProgramacion({
                activa: true,
                plantilla,
                hora,
                minuto,
                dias,
                chatId: chatId.trim(),
                etiqueta:
                  PLANTILLAS.find((p) => p.id === plantilla)?.nombre ?? plantilla,
              })
            }
          >
            {t("prog.crear")}
          </Boton>
        </div>

        <div className="min-w-0">
          <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.08em] text-texto-2">
            {t("prog.programadas")}
          </p>
          {programaciones.length === 0 ? (
            <p className="text-sm text-texto-3">{t("prog.ninguna")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {programaciones.map((p) => (
                <li
                  key={p.id}
                  className="rounded-control border border-borde bg-superficie-2 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold">{p.etiqueta}</span>
                    <Insignia tono={p.activa ? "ok" : "neutro"} punto>
                      {p.activa ? t("prog.activa") : t("prog.pausada")}
                    </Insignia>
                  </div>
                  <p className="mono mt-1 text-[11px] text-texto-3">
                    {String(p.hora).padStart(2, "0")}:{String(p.minuto).padStart(2, "0")} ·{" "}
                    {p.dias.length === 0
                      ? t("prog.todosDias")
                      : p.dias.map((d) => DIAS[d]).join(" ")}
                  </p>
                  {ahora > 0 && p.activa && (
                    <p className="mt-0.5 text-[11px] text-texto-3">
                      {t("prog.proxima")}: {fmt(proximaEjecucion(p, ahora))}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Boton compacto variante="suave" onClick={() => alternarProgramacion(p.id)}>
                      {p.activa ? t("prog.pausar") : t("prog.reanudar")}
                    </Boton>
                    <Boton compacto variante="peligro" onClick={() => borrarProgramacion(p.id)}>
                      {t("prog.borrar")}
                    </Boton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
