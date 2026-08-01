"use client";

import Link from "next/link";
import { useMemo } from "react";

import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Insignia, type TonoInsignia } from "@/components/ui/insignia";
import { Tabla, type Columna } from "@/components/ui/tabla";
import { Tarjeta, TarjetaKpi } from "@/components/ui/tarjeta";
import { dinero, numero } from "@/lib/datos/indicadores";
import { resumenObras, type ResumenObra } from "@/lib/datos/obras";
import { useEstado, useListo } from "@/lib/db/almacen";
import type { Obra } from "@/lib/dominio/tipos";
import type { ClaveTexto } from "@/lib/i18n/textos";
import { usePreferencias } from "@/lib/preferencias";
import { useAhora } from "@/lib/tiempo";

export function tonoObra(estado: Obra["estado"]): TonoInsignia {
  if (estado === "activa") return "ok";
  if (estado === "suspendida") return "advertencia";
  return "neutro";
}

export default function Obras() {
  const { t, idioma } = usePreferencias();
  const estado = useEstado();
  const listo = useListo();
  const ahora = useAhora();

  const usd = (v: number) => dinero(v, idioma);
  const num = (v: number) => numero(v, idioma);

  const filas = useMemo(() => resumenObras(estado, ahora), [estado, ahora]);

  const totalEnObra = filas.reduce((s, f) => s + f.valorEnObra, 0);
  const totalDeuda = filas.reduce((s, f) => s + f.deudaValorUsd, 0);
  const unidadesDeuda = filas.reduce((s, f) => s + f.deudaUnidades, 0);

  const columnas: Columna<ResumenObra>[] = [
    {
      clave: "obra",
      titulo: t("obr.nombre"),
      ordenable: true,
      valorOrden: (f) => f.obra.codigo,
      render: (f) => (
        <Link
          href={`/obras/${f.obra.id}`}
          className="flex min-h-11 min-w-0 flex-col justify-center hover:underline"
        >
          <span className="codigo text-xs font-bold text-marca">
            {f.obra.codigo}
          </span>
          <p className="truncate text-xs text-texto-2">
            {f.obra.nombre} · {f.obra.ubicacionGeografica}
          </p>
        </Link>
      ),
    },
    {
      clave: "estado",
      titulo: t("obr.estado"),
      ordenable: true,
      valorOrden: (f) => f.obra.estado,
      render: (f) => (
        <Insignia tono={tonoObra(f.obra.estado)} punto>
          {t(`obr.${f.obra.estado}` as ClaveTexto)}
        </Insignia>
      ),
    },
    {
      clave: "material",
      titulo: t("obr.material"),
      numerica: true,
      ordenable: true,
      valorOrden: (f) => f.valorEnObra,
      render: (f) => (
        <span className="whitespace-nowrap font-bold">{usd(f.valorEnObra)}</span>
      ),
    },
    {
      clave: "deuda",
      titulo: t("obr.deuda"),
      numerica: true,
      ordenable: true,
      valorOrden: (f) => f.deudaUnidades,
      render: (f) =>
        f.deudaUnidades > 0 ? (
          <span className="whitespace-nowrap font-bold text-advertencia">
            {num(f.deudaUnidades)}
          </span>
        ) : (
          <span className="text-texto-3">—</span>
        ),
    },
    {
      clave: "antiguedad",
      titulo: t("obr.antiguedad"),
      numerica: true,
      ordenable: true,
      valorOrden: (f) => f.deudaDiasMax,
      render: (f) =>
        f.deudaDiasMax > 0 ? (
          // El riesgo no se comunica solo con color: lleva el número de días.
          <span
            className={`whitespace-nowrap font-bold ${
              f.deudaDiasMax > 60 ? "text-peligro" : "text-texto"
            }`}
          >
            {num(f.deudaDiasMax)} {t("obr.dias")}
          </span>
        ) : (
          <span className="text-texto-3">—</span>
        ),
    },
    {
      clave: "solicitudes",
      titulo: t("obr.solicitudes"),
      numerica: true,
      ordenable: true,
      valorOrden: (f) => f.solicitudesAbiertas,
      render: (f) =>
        f.solicitudesAbiertas > 0 ? (
          num(f.solicitudesAbiertas)
        ) : (
          <span className="text-texto-3">—</span>
        ),
    },
  ];

  return (
    <>
      <div className="mb-8 pt-4">
        <h1 className="text-4xl leading-[0.95] tracking-[-0.035em] sm:text-5xl">
          {t("obr.titulo")}
        </h1>
        <p className="mt-3 text-base text-texto-2">{t("obr.subtitulo")}</p>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TarjetaKpi
          etiqueta={t("obr.valorTotal")}
          valor={usd(totalEnObra)}
          pie={t("panel.kpi.pieEnObra")}
          variante="marca"
          listo={listo}
        />
        <TarjetaKpi
          etiqueta={t("obr.deuda")}
          valor={num(unidadesDeuda)}
          pie={usd(totalDeuda)}
          variante="luz"
          listo={listo}
        />
        <TarjetaKpi
          etiqueta={t("nav.obras")}
          valor={num(filas.filter((f) => f.obra.estado === "activa").length)}
          pie={t("obr.activa")}
          variante="contorno"
          listo={listo}
        />
      </div>

      <Tarjeta>
        <Tabla
          columnas={columnas}
          filas={filas}
          claveFila={(f) => f.obra.id}
          porPagina={10}
          vacio={
            <EstadoVacio
              icono="obras"
              titulo={t("panel.sinDatos.titulo")}
              detalle={t("panel.sinDatos.detalle")}
            />
          }
        />
      </Tarjeta>
    </>
  );
}
