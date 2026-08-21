"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Campo, Selector } from "@/components/ui/campo";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Insignia } from "@/components/ui/insignia";
import { Tabla, type Columna } from "@/components/ui/tabla";
import { Tarjeta, TarjetaKpi } from "@/components/ui/tarjeta";
import { dinero, numero } from "@/lib/datos/indicadores";
import {
  filasInventario,
  totalInventario,
  type FilaInventario,
} from "@/lib/datos/inventario";
import { useEstado, useListo } from "@/lib/db/almacen";
import type { ClaseArticulo } from "@/lib/dominio/tipos";
import type { ClaveTexto } from "@/lib/i18n/textos";
import { usePreferencias } from "@/lib/preferencias";

const CLASES: ClaseArticulo[] = ["consumible", "retornable", "certificado"];

export function tonoClase(clase: ClaseArticulo) {
  if (clase === "retornable") return "luz" as const;
  if (clase === "certificado") return "info" as const;
  return "neutro" as const;
}

export default function Inventario() {
  const { t, idioma } = usePreferencias();
  const estado = useEstado();
  const listo = useListo();

  const [texto, setTexto] = useState("");
  const [clase, setClase] = useState<ClaseArticulo | "todas">("todas");
  const [almacenId, setAlmacenId] = useState<string>("todos");

  const filas = useMemo(
    () => filasInventario(estado, { texto, clase, almacenId }),
    [estado, texto, clase, almacenId],
  );

  const usd = (v: number) => dinero(v, idioma);
  const num = (v: number) => numero(v, idioma);

  const columnas: Columna<FilaInventario>[] = [
    {
      clave: "codigo",
      titulo: t("inv.codigo"),
      ordenable: true,
      valorOrden: (f) => f.articulo.codigo,
      render: (f) => (
        <Link
          href={`/inventario/${f.articulo.id}`}
          className="flex min-h-11 min-w-0 flex-col justify-center hover:underline"
        >
          <span className="codigo text-xs font-bold text-marca">
            {f.articulo.codigo}
          </span>
          <p className="truncate text-xs text-texto-2">{f.articulo.descripcion}</p>
        </Link>
      ),
    },
    {
      clave: "clase",
      titulo: t("inv.clase"),
      ordenable: true,
      valorOrden: (f) => f.articulo.clase,
      render: (f) => (
        <Insignia tono={tonoClase(f.articulo.clase)} punto>
          {t(`clase.${f.articulo.clase}` as ClaveTexto)}
        </Insignia>
      ),
    },
    {
      clave: "disponible",
      titulo: t("inv.disponible"),
      numerica: true,
      ordenable: true,
      valorOrden: (f) => f.disponible,
      render: (f) => (
        <span className="whitespace-nowrap font-bold">
          {num(f.disponible)}{" "}
          <span className="font-semibold text-texto-3">{f.articulo.unidadBase}</span>
        </span>
      ),
    },
    {
      clave: "reservado",
      titulo: t("inv.reservado"),
      numerica: true,
      ordenable: true,
      valorOrden: (f) => f.saldo.reservado,
      render: (f) =>
        f.saldo.reservado > 0 ? (
          num(f.saldo.reservado)
        ) : (
          <span className="text-texto-3">—</span>
        ),
    },
    {
      clave: "enObra",
      titulo: t("inv.enObra"),
      numerica: true,
      ordenable: true,
      valorOrden: (f) => f.saldo.enObra,
      render: (f) =>
        f.saldo.enObra > 0 ? (
          <span className="font-bold text-advertencia">{num(f.saldo.enObra)}</span>
        ) : (
          <span className="text-texto-3">—</span>
        ),
    },
    {
      clave: "averiado",
      titulo: t("inv.averiado"),
      numerica: true,
      ordenable: true,
      valorOrden: (f) => f.saldo.averiado,
      render: (f) =>
        f.saldo.averiado > 0 ? (
          <span className="font-bold text-peligro">{num(f.saldo.averiado)}</span>
        ) : (
          <span className="text-texto-3">—</span>
        ),
    },
    {
      clave: "valor",
      titulo: t("inv.valor"),
      numerica: true,
      ordenable: true,
      valorOrden: (f) => f.valorUsd,
      render: (f) => (
        <span className="whitespace-nowrap font-bold">{usd(f.valorUsd)}</span>
      ),
    },
  ];

  return (
    <>
      <div className="mb-8 pt-4">
        <h1 className="text-4xl leading-[0.95] tracking-[-0.035em] sm:text-5xl">
          {t("inv.titulo")}
        </h1>
        <p className="mt-3 text-base text-texto-2">{t("inv.subtitulo")}</p>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TarjetaKpi
          etiqueta={t("inv.valorTotal")}
          valor={usd(totalInventario(filas))}
          pie={t("panel.kpi.pieDisponible")}
          variante="marca"
          listo={listo}
        />
        <TarjetaKpi
          etiqueta={t("inv.articulos")}
          valor={num(filas.length)}
          pie={`${num(filas.filter((f) => f.disponible > 0).length)} ${t(
            "inv.disponible",
          ).toLowerCase()}`}
          variante="contorno"
          listo={listo}
        />
      </div>

      <Tarjeta>
        <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <Campo
            etiqueta={t("inv.buscar")}
            type="search"
            value={texto}
            placeholder="TOR-58, electrodo…"
            onChange={(e) => setTexto(e.target.value)}
          />
          <Selector
            etiqueta={t("inv.clase")}
            value={clase}
            onChange={(e) => setClase(e.target.value as ClaseArticulo | "todas")}
          >
            <option value="todas">{t("inv.todasClases")}</option>
            {CLASES.map((c) => (
              <option key={c} value={c}>
                {t(`clase.${c}` as ClaveTexto)}
              </option>
            ))}
          </Selector>
          <Selector
            etiqueta={t("inv.almacen")}
            value={almacenId}
            onChange={(e) => setAlmacenId(e.target.value)}
          >
            <option value="todos">{t("inv.todosAlmacenes")}</option>
            {estado.almacenes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </Selector>
        </div>

        <Tabla
          columnas={columnas}
          filas={filas}
          claveFila={(f) => f.articulo.id}
          porPagina={12}
          vacio={
            <EstadoVacio
              icono="inventario"
              titulo={
                estado.articulos.length === 0
                  ? t("panel.sinDatos.titulo")
                  : t("tabla.sinResultados")
              }
              detalle={
                estado.articulos.length === 0 ? t("panel.sinDatos.detalle") : undefined
              }
            />
          }
        />
      </Tarjeta>
    </>
  );
}
