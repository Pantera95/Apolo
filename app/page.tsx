"use client";

import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Insignia } from "@/components/ui/insignia";
import { Tarjeta, TarjetaKpi } from "@/components/ui/tarjeta";
import { usePreferencias } from "@/lib/preferencias";

/**
 * Panel de operación.
 *
 * Composición tipo bento con un bloque protagonista, no una fila de cuatro
 * tarjetas iguales: en esta empresa los indicadores NO valen lo mismo. El
 * material inmovilizado en obra y la herramienta que no volvió son el problema
 * que trajo al cliente; el resto es contexto, y la jerarquía visual lo dice.
 *
 * Los indicadores están en cero porque todavía no hay datos cargados, y eso se
 * declara en pantalla en vez de disfrazarlo con cifras de ejemplo.
 */
export default function Panel() {
  const { t, listo } = usePreferencias();

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 pt-4">
        <div className="min-w-0">
          <Insignia tono="luz">Demo</Insignia>
          <h1 className="mt-3 text-4xl leading-[0.95] tracking-[-0.035em] sm:text-5xl">
            {t("panel.titulo")}
          </h1>
          <p className="mt-3 max-w-xl text-base text-texto-2">
            {t("panel.subtitulo")}
          </p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <TarjetaKpi
          etiqueta={t("panel.kpi.enObra")}
          valor="$0"
          pie={t("panel.kpi.pieEnObra")}
          variante="marca"
          destacada
          listo={listo}
          className="md:col-span-2 xl:row-span-2"
        />
        <TarjetaKpi
          etiqueta={t("panel.kpi.herramientaFuera")}
          valor="0"
          pie={t("panel.kpi.pieHerramienta")}
          variante="luz"
          listo={listo}
        />
        <TarjetaKpi
          etiqueta={t("panel.kpi.porAprobar")}
          valor="0"
          pie={t("panel.kpi.piePorAprobar")}
          variante="contorno"
          listo={listo}
        />
        <TarjetaKpi
          etiqueta={t("panel.kpi.disponible")}
          valor="$0"
          pie={t("panel.kpi.pieDisponible")}
          variante="contorno"
          listo={listo}
          className="md:col-span-2"
        />
      </div>

      <p className="mb-6 text-sm font-semibold text-texto-3">{t("demo.aviso")}</p>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Tarjeta titulo={t("panel.actividad")} className="xl:col-span-2">
          <EstadoVacio
            icono="inventario"
            titulo={t("panel.sinDatos.titulo")}
            detalle={t("panel.sinDatos.detalle")}
          />
        </Tarjeta>

        <Tarjeta titulo={t("panel.alertas")}>
          <EstadoVacio icono="alerta" titulo={t("panel.sinDatos.titulo")} />
        </Tarjeta>
      </div>
    </>
  );
}
