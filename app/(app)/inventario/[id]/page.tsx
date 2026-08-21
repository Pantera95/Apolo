"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

import { DialogoAjuste } from "@/components/inventario/dialogo-ajuste";
import { Boton } from "@/components/ui/boton";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Icono } from "@/components/ui/icono";
import { Insignia } from "@/components/ui/insignia";
import { Tabla, type Columna } from "@/components/ui/tabla";
import { Tarjeta, TarjetaKpi } from "@/components/ui/tarjeta";
import { dinero, numero } from "@/lib/datos/indicadores";
import { kardexDe, saldosPorUbicacion, type SaldoUbicado } from "@/lib/datos/inventario";
import { useEstado, useListo } from "@/lib/db/almacen";
import type { Asiento, ClaseArticulo } from "@/lib/dominio/tipos";
import { disponible } from "@/lib/dominio/tipos";
import type { ClaveTexto } from "@/lib/i18n/textos";
import { usePreferencias } from "@/lib/preferencias";

function tonoClase(clase: ClaseArticulo) {
  if (clase === "retornable") return "luz" as const;
  if (clase === "certificado") return "info" as const;
  return "neutro" as const;
}

export default function DetalleArticulo() {
  const { t, idioma } = usePreferencias();
  const { id } = useParams<{ id: string }>();
  const estado = useEstado();
  const listo = useListo();
  const [ajustando, setAjustando] = useState(false);

  const articulo = estado.articulos.find((a) => a.id === id);
  const ubicaciones = useMemo(
    () => (articulo ? saldosPorUbicacion(estado, articulo.id) : []),
    [estado, articulo],
  );
  const kardex = useMemo(
    () => (articulo ? kardexDe(estado, articulo.id) : []),
    [estado, articulo],
  );

  const usd = (v: number) => dinero(v, idioma);
  const num = (v: number) => numero(v, idioma);

  if (!articulo) {
    return (
      <div className="pt-4">
        <Volver />
        <Tarjeta>
          <EstadoVacio
            icono="inventario"
            titulo={listo ? t("inv.noEncontrado") : t("panel.sinDatos.titulo")}
            detalle={listo ? undefined : t("panel.sinDatos.detalle")}
          />
        </Tarjeta>
      </div>
    );
  }

  const total = ubicaciones.reduce(
    (acc, u) => ({
      fisico: acc.fisico + u.saldo.fisico,
      reservado: acc.reservado + u.saldo.reservado,
      averiado: acc.averiado + u.saldo.averiado,
      enTransito: acc.enTransito + u.saldo.enTransito,
      enObra: acc.enObra + u.saldo.enObra,
    }),
    { fisico: 0, reservado: 0, averiado: 0, enTransito: 0, enObra: 0 },
  );

  const columnasUbicacion: Columna<SaldoUbicado>[] = [
    {
      clave: "ubicacion",
      titulo: t("inv.ubicacion"),
      ordenable: true,
      valorOrden: (u) => u.ubicacion?.ordenRecorrido ?? 0,
      render: (u) => (
        <div className="min-w-0">
          <span className="text-xs font-bold">{u.almacen?.nombre}</span>
          <p className="codigo text-xs text-texto-2">
            {u.ubicacion?.pasillo}-{u.ubicacion?.rack}
          </p>
        </div>
      ),
    },
    {
      clave: "fisico",
      titulo: t("inv.fisico"),
      numerica: true,
      ordenable: true,
      valorOrden: (u) => u.saldo.fisico,
      render: (u) => num(u.saldo.fisico),
    },
    {
      clave: "reservado",
      titulo: t("inv.reservado"),
      numerica: true,
      ordenable: true,
      valorOrden: (u) => u.saldo.reservado,
      render: (u) =>
        u.saldo.reservado > 0 ? num(u.saldo.reservado) : <span className="text-texto-3">—</span>,
    },
    {
      clave: "disponible",
      titulo: t("inv.disponible"),
      numerica: true,
      ordenable: true,
      valorOrden: (u) => u.disponible,
      render: (u) => <span className="font-bold">{num(u.disponible)}</span>,
    },
  ];

  const columnasKardex: Columna<Asiento>[] = [
    {
      clave: "fecha",
      titulo: t("panel.fecha"),
      ordenable: true,
      valorOrden: (a) => a.fecha,
      render: (a) => (
        <span className="whitespace-nowrap text-xs text-texto-2">
          {new Date(a.fecha).toLocaleDateString(idioma === "es" ? "es-VE" : "en-US")}
        </span>
      ),
    },
    {
      clave: "tipo",
      titulo: t("panel.movimiento"),
      ordenable: true,
      valorOrden: (a) => a.tipo,
      render: (a) => (
        <Insignia tono="neutro" punto>
          {t(`mov.${a.tipo}` as ClaveTexto)}
        </Insignia>
      ),
    },
    {
      clave: "motivo",
      titulo: t("aj.motivo"),
      ordenable: true,
      valorOrden: (a) => a.motivo ?? "",
      render: (a) =>
        a.motivo ? (
          <span className="text-xs font-semibold text-advertencia">
            {t(`motivo.${a.motivo}` as ClaveTexto)}
          </span>
        ) : (
          <span className="text-texto-3">—</span>
        ),
    },
    {
      clave: "fisicoDelta",
      titulo: t("inv.fisico"),
      numerica: true,
      ordenable: true,
      valorOrden: (a) => a.delta.fisico,
      render: (a) => <Delta valor={a.delta.fisico} formato={num} />,
    },
    {
      clave: "enObraDelta",
      titulo: t("inv.enObra"),
      numerica: true,
      ordenable: true,
      valorOrden: (a) => a.delta.enObra,
      render: (a) => <Delta valor={a.delta.enObra} formato={num} />,
    },
  ];

  return (
    <div className="pt-4">
      <Volver />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="codigo text-sm font-bold text-marca">
              {articulo.codigo}
            </span>
            <Insignia tono={tonoClase(articulo.clase)} punto>
              {t(`clase.${articulo.clase}` as ClaveTexto)}
            </Insignia>
          </div>
          <h1 className="mt-2 text-3xl leading-[1] tracking-[-0.03em] sm:text-4xl">
            {articulo.descripcion}
          </h1>
          <p className="mt-3 text-sm text-texto-2">
            {t("inv.costo")}:{" "}
            <span className="cifra font-bold text-texto">
              {usd(articulo.costoPromedioUsd)}
            </span>{" "}
            / {articulo.unidadBase}
            {articulo.equivalencias && (
              <>
                {" · "}
                {t("inv.equivalencias")}:{" "}
                <span className="codigo text-texto">
                  {Object.entries(articulo.equivalencias)
                    .map(([u, f]) => `1 ${u} = ${f} ${articulo.unidadBase}`)
                    .join(" · ")}
                </span>
              </>
            )}
          </p>
        </div>

        <Boton
          variante="primario"
          disabled={ubicaciones.length === 0}
          onClick={() => setAjustando(true)}
        >
          {t("aj.abrir")}
        </Boton>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TarjetaKpi
          etiqueta={t("inv.disponible")}
          valor={num(disponible(total))}
          pie={articulo.unidadBase}
          variante="marca"
          listo={listo}
        />
        <TarjetaKpi
          etiqueta={t("inv.reservado")}
          valor={num(total.reservado)}
          variante="contorno"
          listo={listo}
        />
        <TarjetaKpi
          etiqueta={t("inv.enObra")}
          valor={num(total.enObra)}
          variante={articulo.clase === "retornable" ? "luz" : "contorno"}
          listo={listo}
        />
        <TarjetaKpi
          etiqueta={t("inv.averiado")}
          valor={num(total.averiado)}
          variante="contorno"
          listo={listo}
        />
      </div>

      <div className="grid grid-cols-1 gap-4">
        <Tarjeta titulo={t("inv.ubicaciones")}>
          <Tabla
            columnas={columnasUbicacion}
            filas={ubicaciones}
            claveFila={(u) => `${u.almacen?.id}-${u.ubicacion?.id}`}
            porPagina={8}
            vacio={<EstadoVacio icono="inventario" titulo={t("inv.sinExistencia")} />}
          />
        </Tarjeta>

        <Tarjeta titulo={t("inv.kardex")}>
          <Tabla
            columnas={columnasKardex}
            filas={kardex}
            claveFila={(a) => a.id}
            porPagina={10}
            vacio={<EstadoVacio icono="reportes" titulo={t("inv.sinMovimientos")} />}
          />
        </Tarjeta>
      </div>

      <DialogoAjuste
        abierto={ajustando}
        articulo={articulo}
        ubicaciones={ubicaciones}
        onCerrar={() => setAjustando(false)}
        onHecho={() => setAjustando(false)}
      />
    </div>
  );
}

function Volver() {
  const { t } = usePreferencias();
  return (
    <Link
      href="/inventario"
      className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-texto-2 hover:text-texto"
    >
      <span className="rotate-180">
        <Icono nombre="flecha" tam={16} />
      </span>
      {t("inv.volver")}
    </Link>
  );
}

/** El signo se comunica con símbolo y color, nunca solo con color. */
function Delta({
  valor,
  formato,
}: {
  valor: number;
  formato: (v: number) => string;
}) {
  if (valor === 0) return <span className="text-texto-3">—</span>;
  return (
    <span className={`font-bold ${valor > 0 ? "text-ok" : "text-peligro"}`}>
      {valor > 0 ? "+" : "−"}
      {formato(Math.abs(valor))}
    </span>
  );
}
