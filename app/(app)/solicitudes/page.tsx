"use client";

import { useMemo, useState } from "react";

import {
  DialogoGenerarDespacho,
  DialogoNuevaSolicitud,
} from "@/components/solicitudes/dialogos";
import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";
import { Selector } from "@/components/ui/campo";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Insignia, type TonoInsignia } from "@/components/ui/insignia";
import { Tabla, type Columna } from "@/components/ui/tabla";
import { Tarjeta, TarjetaKpi } from "@/components/ui/tarjeta";
import { numero } from "@/lib/datos/indicadores";
import { useEstado, useListo } from "@/lib/db/almacen";
import { cambiarEstadoSolicitud } from "@/lib/db/operaciones";
import {
  esTerminal,
  pendientePorDespachar,
  type EstadoSolicitud,
  type Solicitud,
} from "@/lib/dominio/despacho";
import type { ClaveTexto } from "@/lib/i18n/textos";
import { usePreferencias } from "@/lib/preferencias";
import { diasDesde, useAhora } from "@/lib/tiempo";

const ESTADOS: EstadoSolicitud[] = [
  "borrador",
  "solicitada",
  "aprobada",
  "en_preparacion",
  "despachada",
  "entregada",
  "cerrada",
  "rechazada",
  "anulada",
];

function tonoEstado(estado: EstadoSolicitud): TonoInsignia {
  switch (estado) {
    case "solicitada":
      return "advertencia";
    case "aprobada":
      return "luz";
    case "rechazada":
    case "anulada":
      return "peligro";
    case "entregada":
    case "cerrada":
      return "ok";
    case "en_preparacion":
    case "despachada":
      return "info";
    default:
      return "neutro";
  }
}

export default function Solicitudes() {
  const { t, idioma } = usePreferencias();
  const estado = useEstado();
  const listo = useListo();
  const ahora = useAhora();

  const [creando, setCreando] = useState(false);
  const [despachando, setDespachando] = useState<Solicitud | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<EstadoSolicitud | "todos">("todos");
  const [filtroObra, setFiltroObra] = useState<string>("todas");
  const [error, setError] = useState<string | null>(null);

  const num = (v: number) => numero(v, idioma);
  const obras = new Map(estado.obras.map((o) => [o.id, o]));

  const filas = useMemo(
    () =>
      estado.solicitudes.filter((s) => {
        if (filtroEstado !== "todos" && s.estado !== filtroEstado) return false;
        if (filtroObra !== "todas" && s.obraId !== filtroObra) return false;
        return true;
      }),
    [estado.solicitudes, filtroEstado, filtroObra],
  );

  const esperando = estado.solicitudes.filter((s) => s.estado === "solicitada");
  const diasEsperando = esperando.reduce(
    (max, s) => Math.max(max, diasDesde(s.fecha, ahora) ?? 0),
    0,
  );

  function mover(solicitud: Solicitud, hasta: EstadoSolicitud) {
    setError(null);
    const r = cambiarEstadoSolicitud(solicitud.id, hasta, "owner");
    if (!r.ok) setError(t(`err.${r.error.codigo}` as ClaveTexto));
  }

  const columnas: Columna<Solicitud>[] = [
    {
      clave: "codigo",
      titulo: t("sol.codigo"),
      ordenable: true,
      valorOrden: (s) => s.codigo,
      render: (s) => {
        const obra = obras.get(s.obraId);
        return (
          <div className="min-w-0">
            <span className="codigo text-xs font-bold">{s.codigo}</span>
            <p className="truncate text-xs text-texto-2">
              {obra?.codigo} · {obra?.nombre}
            </p>
          </div>
        );
      },
    },
    {
      clave: "estado",
      titulo: t("sol.estado"),
      ordenable: true,
      valorOrden: (s) => s.estado,
      render: (s) => (
        <Insignia tono={tonoEstado(s.estado)} punto>
          {t(`estado.${s.estado}` as ClaveTexto)}
        </Insignia>
      ),
    },
    {
      clave: "lineas",
      titulo: t("sol.lineas"),
      numerica: true,
      ordenable: true,
      valorOrden: (s) => s.lineas.length,
      render: (s) => num(s.lineas.length),
    },
    {
      clave: "pendiente",
      titulo: t("sol.pendiente"),
      numerica: true,
      ordenable: true,
      valorOrden: (s) => s.lineas.reduce((a, l) => a + pendientePorDespachar(l), 0),
      render: (s) => {
        const pendiente = s.lineas.reduce((a, l) => a + pendientePorDespachar(l), 0);
        const total = s.lineas.reduce((a, l) => a + l.cantidadSolicitada, 0);
        return (
          <span className="whitespace-nowrap">
            <span className="font-bold">{num(pendiente)}</span>
            <span className="text-texto-3"> / {num(total)}</span>
          </span>
        );
      },
    },
    {
      clave: "fecha",
      titulo: t("sol.fecha"),
      numerica: true,
      ordenable: true,
      valorOrden: (s) => s.fecha,
      render: (s) => (
        <span className="whitespace-nowrap text-xs text-texto-2">
          {new Date(s.fecha).toLocaleDateString(idioma === "es" ? "es-VE" : "en-US")}
        </span>
      ),
    },
    {
      clave: "acciones",
      titulo: "",
      render: (s) => (
        <div className="flex flex-wrap justify-end gap-2">
          {s.estado === "solicitada" && (
            <>
              <Boton
                compacto
                variante="peligro"
                onClick={() => mover(s, "rechazada")}
              >
                {t("sol.rechazar")}
              </Boton>
              <Boton compacto variante="luz" onClick={() => mover(s, "aprobada")}>
                {t("sol.aprobar")}
              </Boton>
            </>
          )}
          {s.estado === "aprobada" && (
            <Boton compacto variante="primario" onClick={() => setDespachando(s)}>
              {t("sol.generarDespacho")}
            </Boton>
          )}
          {esTerminal(s.estado) && <span className="text-texto-3">—</span>}
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 pt-4">
        <div className="min-w-0">
          <h1 className="text-4xl leading-[0.95] tracking-[-0.035em] sm:text-5xl">
            {t("sol.titulo")}
          </h1>
          <p className="mt-3 text-base text-texto-2">{t("sol.subtitulo")}</p>
        </div>
        <Boton variante="primario" onClick={() => setCreando(true)}>
          {t("sol.nueva")}
        </Boton>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <TarjetaKpi
          etiqueta={t("sol.esperando")}
          valor={num(esperando.length)}
          pie={
            esperando.length && diasEsperando > 0
              ? `${t("sol.desde")} ${num(diasEsperando)} ${t("sol.dias")}`
              : undefined
          }
          variante="marca"
          listo={listo}
        />
        <TarjetaKpi
          etiqueta={t("estado.aprobada")}
          valor={num(estado.solicitudes.filter((s) => s.estado === "aprobada").length)}
          variante="luz"
          listo={listo}
        />
        <TarjetaKpi
          etiqueta={t("estado.en_preparacion")}
          valor={num(
            estado.solicitudes.filter((s) => s.estado === "en_preparacion").length,
          )}
          variante="contorno"
          listo={listo}
        />
        <TarjetaKpi
          etiqueta={t("estado.rechazada")}
          valor={num(estado.solicitudes.filter((s) => s.estado === "rechazada").length)}
          variante="contorno"
          listo={listo}
        />
      </div>

      {esperando.length > 0 && (
        <div className="mb-4">
          <Alerta tono="advertencia" titulo={t("sol.bloqueada")}>
            {t("sol.bloqueadaAyuda")}
          </Alerta>
        </div>
      )}

      {error && (
        <div className="mb-4">
          <Alerta tono="peligro">{error}</Alerta>
        </div>
      )}

      <Tarjeta>
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Selector
            etiqueta={t("sol.estado")}
            value={filtroEstado}
            onChange={(e) =>
              setFiltroEstado(e.target.value as EstadoSolicitud | "todos")
            }
          >
            <option value="todos">{t("sol.todosEstados")}</option>
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {t(`estado.${e}` as ClaveTexto)}
              </option>
            ))}
          </Selector>
          <Selector
            etiqueta={t("sol.obra")}
            value={filtroObra}
            onChange={(e) => setFiltroObra(e.target.value)}
          >
            <option value="todas">{t("sol.todasObras")}</option>
            {estado.obras.map((o) => (
              <option key={o.id} value={o.id}>
                {o.codigo} · {o.nombre}
              </option>
            ))}
          </Selector>
        </div>

        <Tabla
          columnas={columnas}
          filas={filas}
          claveFila={(s) => s.id}
          porPagina={10}
          vacio={<EstadoVacio icono="solicitudes" titulo={t("sol.sinSolicitudes")} />}
        />
      </Tarjeta>

      <DialogoNuevaSolicitud abierto={creando} onCerrar={() => setCreando(false)} />
      <DialogoGenerarDespacho
        solicitud={despachando}
        onCerrar={() => setDespachando(null)}
      />
    </>
  );
}
