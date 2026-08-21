"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

import { DialogoRetorno } from "@/components/obras/dialogo-retorno";
import { Boton } from "@/components/ui/boton";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Icono } from "@/components/ui/icono";
import { Insignia } from "@/components/ui/insignia";
import { Tabla, type Columna } from "@/components/ui/tabla";
import { Tarjeta, TarjetaKpi } from "@/components/ui/tarjeta";
import { dinero, numero } from "@/lib/datos/indicadores";
import {
  deudaDeObra,
  despachosDeObra,
  materialDeObra,
  solicitudesDeObra,
  type DeudaObra,
  type RenglonObra,
} from "@/lib/datos/obras";
import { useEstado, useListo } from "@/lib/db/almacen";
import type { Solicitud } from "@/lib/dominio/despacho";
import type { Despacho } from "@/lib/dominio/entrega";
import type { ClaveTexto } from "@/lib/i18n/textos";
import { usePreferencias } from "@/lib/preferencias";
import { ObraPremium } from "@/components/obras/premium";
import { usePremium } from "@/lib/dashboard/premium";
import { useEstadosFinancieros } from "@/lib/dashboard/estados-store";
import { useAhora } from "@/lib/tiempo";
import { tonoObra } from "../page";

export default function DetalleObra() {
  const premium = usePremium();
  const finanzas = useEstadosFinancieros();
  const { t, idioma } = usePreferencias();
  const { id } = useParams<{ id: string }>();
  const estado = useEstado();
  const listo = useListo();
  const ahora = useAhora();
  const [retornando, setRetornando] = useState(false);

  const obra = estado.obras.find((o) => o.id === id);

  const material = useMemo(
    () => (obra ? materialDeObra(estado, obra.id) : []),
    [estado, obra],
  );
  const deuda = useMemo(
    () => (obra ? deudaDeObra(estado, obra.id, ahora) : []),
    [estado, obra, ahora],
  );
  const solicitudes = useMemo(
    () => (obra ? solicitudesDeObra(estado, obra.id) : []),
    [estado, obra],
  );
  const despachos = useMemo(
    () => (obra ? despachosDeObra(estado, obra.id) : []),
    [estado, obra],
  );

  const usd = (v: number) => dinero(v, idioma);
  const num = (v: number) => numero(v, idioma);

  if (!obra) {
    return (
      <div className="pt-4">
        <Volver />
        <Tarjeta>
          <EstadoVacio
            icono="obras"
            titulo={listo ? t("obr.noEncontrada") : t("panel.sinDatos.titulo")}
            detalle={listo ? undefined : t("panel.sinDatos.detalle")}
          />
        </Tarjeta>
      </div>
    );
  }

  const valorEnObra = material.reduce((s, m) => s + m.valorUsd, 0);
  const deudaUnidades = deuda.reduce((s, d) => s + d.unidades, 0);
  const deudaDias = deuda.reduce((m, d) => Math.max(m, d.diasMax), 0);

  const columnasMaterial: Columna<RenglonObra>[] = [
    {
      clave: "articulo",
      titulo: t("sol.articulo"),
      ordenable: true,
      valorOrden: (m) => m.articulo.codigo,
      render: (m) => (
        <Link
          href={`/inventario/${m.articulo.id}`}
          className="flex min-h-11 min-w-0 flex-col justify-center hover:underline"
        >
          <span className="codigo text-xs font-bold text-marca">
            {m.articulo.codigo}
          </span>
          <p className="truncate text-xs text-texto-2">{m.articulo.descripcion}</p>
        </Link>
      ),
    },
    {
      clave: "clase",
      titulo: t("inv.clase"),
      ordenable: true,
      valorOrden: (m) => m.articulo.clase,
      render: (m) => (
        <Insignia
          tono={m.articulo.clase === "retornable" ? "luz" : "neutro"}
          punto={m.articulo.clase === "retornable"}
        >
          {t(`clase.${m.articulo.clase}` as ClaveTexto)}
        </Insignia>
      ),
    },
    {
      clave: "unidades",
      titulo: t("sol.cantidad"),
      numerica: true,
      ordenable: true,
      valorOrden: (m) => m.unidades,
      render: (m) => (
        <span className="whitespace-nowrap font-bold">
          {num(m.unidades)}{" "}
          <span className="font-semibold text-texto-3">{m.articulo.unidadBase}</span>
        </span>
      ),
    },
    {
      clave: "valor",
      titulo: t("inv.valor"),
      numerica: true,
      ordenable: true,
      valorOrden: (m) => m.valorUsd,
      render: (m) => <span className="whitespace-nowrap">{usd(m.valorUsd)}</span>,
    },
  ];

  const columnasDeuda: Columna<DeudaObra>[] = [
    {
      clave: "articulo",
      titulo: t("sol.articulo"),
      ordenable: true,
      valorOrden: (d) => d.articulo.codigo,
      render: (d) => (
        <div className="min-w-0">
          <span className="codigo text-xs font-bold">{d.articulo.codigo}</span>
          <p className="truncate text-xs text-texto-2">{d.articulo.descripcion}</p>
        </div>
      ),
    },
    {
      clave: "unidades",
      titulo: t("obr.pendientes"),
      numerica: true,
      ordenable: true,
      valorOrden: (d) => d.unidades,
      render: (d) => <span className="font-bold">{num(d.unidades)}</span>,
    },
    {
      clave: "dias",
      titulo: t("obr.antiguedad"),
      numerica: true,
      ordenable: true,
      valorOrden: (d) => d.diasMax,
      render: (d) => (
        <span
          className={`whitespace-nowrap font-bold ${
            d.diasMax > 60 ? "text-peligro" : d.diasMax > 30 ? "text-advertencia" : ""
          }`}
        >
          {num(d.diasMax)} {t("obr.dias")}
        </span>
      ),
    },
    {
      clave: "valor",
      titulo: t("inv.valor"),
      numerica: true,
      ordenable: true,
      valorOrden: (d) => d.valorUsd,
      render: (d) => <span className="whitespace-nowrap">{usd(d.valorUsd)}</span>,
    },
  ];

  return (
    <div className="pt-4">
      <Volver />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="codigo text-sm font-bold text-marca">{obra.codigo}</span>
            <Insignia tono={tonoObra(obra.estado)} punto>
              {t(`obr.${obra.estado}` as ClaveTexto)}
            </Insignia>
          </div>
          <h1 className="mt-2 text-3xl leading-[1] tracking-[-0.03em] sm:text-4xl">
            {obra.nombre}
          </h1>
          <p className="mt-2 text-sm text-texto-2">{obra.ubicacionGeografica}</p>
        </div>

        <Boton
          variante="primario"
          disabled={deuda.length === 0}
          onClick={() => setRetornando(true)}
        >
          {t("obr.retornar")}
        </Boton>
      </div>

      {/* El bloque Premium va ARRIBA de los KPI: quien abre la ficha con
          Premium activo viene a decidir —cerrar, aprobar, reclamar— y lo que
          decide está aquí. Las existencias las mira después. */}
      {premium && listo && ahora > 0 && (
        <div className="mb-6">
          <ObraPremium
            estado={estado}
            obra={obra}
            ahora={ahora}
            demo={finanzas.demo}
          />
        </div>
      )}

      {/* Una sola columna en móvil: a 375px dos columnas no dan para una cifra
          en moneda y el número se corta a media palabra. */}
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TarjetaKpi
          etiqueta={t("obr.material")}
          valor={usd(valorEnObra)}
          pie={`${num(material.length)} ${t("obr.renglones").toLowerCase()}`}
          variante="marca"
          listo={listo}
        />
        <TarjetaKpi
          etiqueta={t("obr.deuda")}
          valor={num(deudaUnidades)}
          pie={deudaDias > 0 ? `${num(deudaDias)} ${t("obr.dias")}` : undefined}
          variante="luz"
          listo={listo}
        />
        <TarjetaKpi
          etiqueta={t("obr.solicitudes")}
          valor={num(solicitudes.length)}
          variante="contorno"
          listo={listo}
        />
        <TarjetaKpi
          etiqueta={t("obr.despachos")}
          valor={num(despachos.length)}
          variante="contorno"
          listo={listo}
        />
      </div>

      <div className="grid grid-cols-1 gap-4">
        <Tarjeta titulo={t("obr.deuda")} descripcion={t("obr.deudaPie")}>
          <Tabla
            columnas={columnasDeuda}
            filas={deuda}
            claveFila={(d) => d.articulo.id}
            porPagina={8}
            vacio={<EstadoVacio icono="herramientas" titulo={t("obr.sinDeuda")} />}
          />
        </Tarjeta>

        <Tarjeta titulo={t("obr.material")}>
          <Tabla
            columnas={columnasMaterial}
            filas={material}
            claveFila={(m) => m.articulo.id}
            porPagina={8}
            vacio={<EstadoVacio icono="inventario" titulo={t("obr.sinMaterial")} />}
          />
        </Tarjeta>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Tarjeta titulo={t("nav.solicitudes")}>
            {solicitudes.length === 0 ? (
              <EstadoVacio icono="solicitudes" titulo={t("obr.sinSolicitudes")} />
            ) : (
              <ul className="flex flex-col gap-2">
                {solicitudes.map((s) => (
                  <ResumenSolicitud key={s.id} solicitud={s} />
                ))}
              </ul>
            )}
          </Tarjeta>

          <Tarjeta titulo={t("nav.despacho")}>
            {despachos.length === 0 ? (
              <EstadoVacio icono="despacho" titulo={t("obr.sinDespachos")} />
            ) : (
              <ul className="flex flex-col gap-2">
                {despachos.map((d) => (
                  <ResumenDespacho key={d.id} despacho={d} />
                ))}
              </ul>
            )}
          </Tarjeta>
        </div>
      </div>

      {retornando && (
        <DialogoRetorno
          obra={obra}
          deuda={deuda}
          onCerrar={() => setRetornando(false)}
        />
      )}
    </div>
  );
}

function Volver() {
  const { t } = usePreferencias();
  return (
    <Link
      href="/obras"
      className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-texto-2 hover:text-texto"
    >
      <span className="rotate-180">
        <Icono nombre="flecha" tam={16} />
      </span>
      {t("obr.volver")}
    </Link>
  );
}

function ResumenSolicitud({ solicitud }: { solicitud: Solicitud }) {
  const { t, idioma } = usePreferencias();
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-control border-2 border-borde px-3 py-2">
      <span className="codigo text-xs font-bold">{solicitud.codigo}</span>
      <Insignia tono="neutro" punto>
        {t(`estado.${solicitud.estado}` as ClaveTexto)}
      </Insignia>
      <span className="ml-auto text-xs text-texto-3">
        {new Date(solicitud.fecha).toLocaleDateString(
          idioma === "es" ? "es-VE" : "en-US",
        )}
      </span>
    </li>
  );
}

function ResumenDespacho({ despacho }: { despacho: Despacho }) {
  const { t, idioma } = usePreferencias();
  const conProblema = despacho.estado === "con_discrepancia";
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-control border-2 border-borde px-3 py-2">
      <span className="codigo text-xs font-bold">{despacho.codigo}</span>
      <Insignia tono={conProblema ? "peligro" : "neutro"} punto>
        {t(`des.${despacho.estado}` as ClaveTexto)}
      </Insignia>
      <span className="ml-auto text-xs text-texto-3">
        {new Date(despacho.creadoEn).toLocaleDateString(
          idioma === "es" ? "es-VE" : "en-US",
        )}
      </span>
    </li>
  );
}
