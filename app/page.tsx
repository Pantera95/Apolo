"use client";

import { ControlesDemo } from "@/components/shell/controles-demo";
import { Alerta } from "@/components/ui/alerta";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Insignia } from "@/components/ui/insignia";
import { Tabla, type Columna } from "@/components/ui/tabla";
import { Tarjeta, TarjetaKpi } from "@/components/ui/tarjeta";
import {
  bajoMinimo,
  dinero,
  herramientaAveriada,
  herramientaSinRetornar,
  movimientosRecientes,
  numero,
  solicitudesPorAprobar,
  valorDisponible,
  valorEnObra,
} from "@/lib/datos/indicadores";
import { construirSemilla } from "@/lib/datos/semilla";
import { setEstado, useEstado, useListo } from "@/lib/db/almacen";
import type { Asiento } from "@/lib/dominio/tipos";
import { usePreferencias } from "@/lib/preferencias";
import { Boton } from "@/components/ui/boton";

/**
 * Panel de operación.
 *
 * Composición tipo bento con un bloque protagonista, no una fila de tarjetas
 * iguales: en esta empresa los indicadores NO valen lo mismo. El material
 * inmovilizado en obra y la herramienta que no volvió son el problema que trajo
 * al cliente; el resto es contexto, y la jerarquía visual lo dice.
 */
export default function Panel() {
  const { t, idioma } = usePreferencias();
  const estado = useEstado();
  const listo = useListo();

  const hayDatos = estado.inventario.asientos.length > 0;
  const deuda = herramientaSinRetornar(estado);
  const averiada = herramientaAveriada(estado);
  const porAprobar = solicitudesPorAprobar(estado);
  const escasos = bajoMinimo(estado);
  const movimientos = movimientosRecientes(estado, 12);

  const articulos = new Map(estado.articulos.map((a) => [a.id, a]));
  const obras = new Map(estado.obras.map((o) => [o.id, o]));

  const columnas: Columna<Asiento>[] = [
    {
      clave: "tipo",
      titulo: t("panel.movimiento"),
      ordenable: true,
      valorOrden: (a) => a.tipo,
      render: (a) => (
        <Insignia tono={tonoMovimiento(a.tipo)} punto>
          {t(`mov.${a.tipo}` as never)}
        </Insignia>
      ),
    },
    {
      clave: "articulo",
      titulo: t("panel.articulo"),
      ordenable: true,
      valorOrden: (a) => articulos.get(a.articuloId)?.codigo ?? "",
      render: (a) => {
        const art = articulos.get(a.articuloId);
        return (
          <div className="min-w-0">
            <span className="codigo text-xs font-bold">{art?.codigo}</span>
            <p className="truncate text-xs text-texto-2">{art?.descripcion}</p>
          </div>
        );
      },
    },
    {
      clave: "obra",
      titulo: t("nav.obras"),
      ordenable: true,
      valorOrden: (a) => (a.obraId ? (obras.get(a.obraId)?.codigo ?? "") : ""),
      render: (a) =>
        a.obraId ? (
          <span className="codigo text-xs">{obras.get(a.obraId)?.codigo}</span>
        ) : (
          <span className="text-texto-3">—</span>
        ),
    },
    {
      clave: "cantidad",
      titulo: t("panel.cantidad"),
      numerica: true,
      ordenable: true,
      valorOrden: (a) => cantidadDe(a),
      render: (a) => {
        const art = articulos.get(a.articuloId);
        return (
          <span className="whitespace-nowrap text-sm font-bold">
            {numero(cantidadDe(a), idioma)}{" "}
            <span className="font-semibold text-texto-3">{art?.unidadBase}</span>
          </span>
        );
      },
    },
    {
      clave: "fecha",
      titulo: t("panel.fecha"),
      numerica: true,
      ordenable: true,
      valorOrden: (a) => a.fecha,
      render: (a) => (
        <span className="whitespace-nowrap text-xs text-texto-2">
          {new Date(a.fecha).toLocaleDateString(idioma === "es" ? "es-VE" : "en-US")}
        </span>
      ),
    },
  ];

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
        <ControlesDemo />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <TarjetaKpi
          etiqueta={t("panel.kpi.enObra")}
          valor={dinero(valorEnObra(estado), idioma)}
          pie={t("panel.kpi.pieEnObra")}
          variante="marca"
          destacada
          listo={listo}
          className="md:col-span-2 xl:row-span-2"
        />
        <TarjetaKpi
          etiqueta={t("panel.kpi.herramientaFuera")}
          valor={numero(deuda.unidades, idioma)}
          pie={t("panel.kpi.pieHerramienta")}
          variante="luz"
          listo={listo}
        />
        <TarjetaKpi
          etiqueta={t("panel.kpi.porAprobar")}
          valor={numero(porAprobar.length, idioma)}
          pie={t("panel.kpi.piePorAprobar")}
          variante="contorno"
          listo={listo}
        />
        <TarjetaKpi
          etiqueta={t("panel.kpi.disponible")}
          valor={dinero(valorDisponible(estado), idioma)}
          pie={t("panel.kpi.pieDisponible")}
          variante="contorno"
          listo={listo}
          className="md:col-span-2"
        />
      </div>

      <p className="mb-6 text-sm font-semibold text-texto-3">{t("demo.aviso")}</p>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Tarjeta titulo={t("panel.actividad")} className="xl:col-span-2">
          {hayDatos ? (
            <Tabla
              columnas={columnas}
              filas={movimientos}
              claveFila={(a) => a.id}
              porPagina={6}
            />
          ) : (
            <EstadoVacio
              icono="inventario"
              titulo={t("panel.sinDatos.titulo")}
              detalle={t("panel.sinDatos.detalle")}
              accion={
                <Boton variante="luz" onClick={() => setEstado(construirSemilla())}>
                  {t("panel.sinDatos.accion")}
                </Boton>
              }
            />
          )}
        </Tarjeta>

        <Tarjeta titulo={t("panel.alertas")}>
          {hayDatos ? (
            <div className="flex flex-col gap-3">
              {deuda.unidades > 0 && (
                <Alerta tono="advertencia" titulo={t("panel.kpi.herramientaFuera")}>
                  {numero(deuda.unidades, idioma)} {t("panel.unidades")} ·{" "}
                  {dinero(deuda.valorUsd, idioma)}
                </Alerta>
              )}
              {averiada.unidades > 0 && (
                <Alerta tono="peligro" titulo={t("panel.averiada")}>
                  {numero(averiada.unidades, idioma)} {t("panel.unidades")} ·{" "}
                  {dinero(averiada.valorUsd, idioma)}
                </Alerta>
              )}
              {escasos.slice(0, 4).map((e) => (
                <Alerta key={e.articulo.id} tono="info" titulo={e.articulo.codigo}>
                  {numero(e.disponible, idioma)} {t("panel.disponibleDe")}{" "}
                  {numero(e.recibido, idioma)}
                </Alerta>
              ))}
            </div>
          ) : (
            <EstadoVacio icono="alerta" titulo={t("panel.sinAlertas")} />
          )}
        </Tarjeta>
      </div>
    </>
  );
}

/** Cantidad significativa del asiento: el campo que realmente se movió. */
function cantidadDe(a: Asiento): number {
  const campos = [a.delta.fisico, a.delta.enObra, a.delta.reservado, a.delta.enTransito, a.delta.averiado];
  const mayor = campos.reduce((max, v) => (Math.abs(v) > Math.abs(max) ? v : max), 0);
  return Math.abs(mayor);
}

function tonoMovimiento(tipo: Asiento["tipo"]) {
  switch (tipo) {
    case "recepcion":
    case "transferencia_entrada":
      return "ok" as const;
    case "retorno":
      return "luz" as const;
    case "ajuste":
    case "conteo":
      return "advertencia" as const;
    case "despacho":
    case "transferencia_salida":
      return "info" as const;
    default:
      return "neutro" as const;
  }
}
