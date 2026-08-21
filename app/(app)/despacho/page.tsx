"use client";

import { useState, type ReactNode } from "react";

import { DialogoEntrega, DialogoPreparacion } from "@/components/despacho/dialogos";
import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Icono } from "@/components/ui/icono";
import { Insignia } from "@/components/ui/insignia";
import { Tarjeta, TarjetaKpi } from "@/components/ui/tarjeta";
import { numero } from "@/lib/datos/indicadores";
import { useEstado, useListo } from "@/lib/db/almacen";
import { sacarARuta } from "@/lib/db/operaciones";
import {
  pendienteDePreparar,
  totalUnidades,
  type Despacho,
  type EstadoDespacho,
} from "@/lib/dominio/entrega";
import type { ClaveTexto } from "@/lib/i18n/textos";
import { usePreferencias } from "@/lib/preferencias";

/**
 * Tablero de despacho.
 *
 * Se muestra el flujo completo de una vez, en columnas, en lugar de una tabla
 * con filtros: el jefe de almacén necesita ver DÓNDE se está atascando la
 * operación, y eso es una forma, no una lista.
 */
const ETAPAS: { estado: EstadoDespacho; clave: ClaveTexto }[] = [
  { estado: "en_preparacion", clave: "des.en_preparacion" },
  { estado: "listo", clave: "des.listo" },
  { estado: "en_ruta", clave: "des.en_ruta" },
];

export default function TableroDespacho() {
  const { t, idioma } = usePreferencias();
  const estado = useEstado();
  const listo = useListo();

  const [preparando, setPreparando] = useState<Despacho | null>(null);
  const [entregando, setEntregando] = useState<Despacho | null>(null);
  const [error, setError] = useState<string | null>(null);

  const num = (v: number) => numero(v, idioma);
  const porEtapa = (e: EstadoDespacho) =>
    estado.despachos.filter((d) => d.estado === e);
  const cerrados = estado.despachos.filter(
    (d) => d.estado === "entregado" || d.estado === "con_discrepancia",
  );
  const conProblema = estado.despachos.filter(
    (d) => d.estado === "con_discrepancia",
  );

  // El diálogo lee del estado vivo: tras preparar un renglón hay que refrescar
  // la referencia o la lista se quedaría congelada.
  const preparandoVivo = preparando
    ? (estado.despachos.find((d) => d.id === preparando.id) ?? null)
    : null;

  function salir(despacho: Despacho) {
    setError(null);
    const r = sacarARuta(despacho.id);
    if (!r.ok) setError(t(`err.${r.error.codigo}` as ClaveTexto));
  }

  return (
    <>
      <div className="mb-8 pt-4">
        <h1 className="text-4xl leading-[0.95] tracking-[-0.035em] sm:text-5xl">
          {t("des.titulo")}
        </h1>
        <p className="mt-3 text-base text-texto-2">{t("des.subtitulo")}</p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <TarjetaKpi
          etiqueta={t("des.en_preparacion")}
          valor={num(porEtapa("en_preparacion").length)}
          variante="contorno"
          listo={listo}
        />
        <TarjetaKpi
          etiqueta={t("des.listo")}
          valor={num(porEtapa("listo").length)}
          variante="luz"
          listo={listo}
        />
        <TarjetaKpi
          etiqueta={t("des.en_ruta")}
          valor={num(porEtapa("en_ruta").length)}
          variante="marca"
          listo={listo}
        />
        <TarjetaKpi
          etiqueta={t("des.con_discrepancia")}
          valor={num(conProblema.length)}
          variante="contorno"
          listo={listo}
        />
      </div>

      {error && (
        <div className="mb-4">
          <Alerta tono="peligro">{error}</Alerta>
        </div>
      )}

      <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        {ETAPAS.map(({ estado: etapa, clave }) => {
          const lista = porEtapa(etapa);
          return (
            <Tarjeta key={etapa} titulo={t(clave)}>
              {lista.length === 0 ? (
                <EstadoVacio icono="despacho" titulo={t("des.sinDespachos")} />
              ) : (
                <ul className="flex flex-col gap-3">
                  {lista.map((d) => (
                    <li key={d.id}>
                      <TarjetaDespacho
                        despacho={d}
                        accion={
                          etapa === "en_preparacion" ? (
                            <Boton
                              compacto
                              variante="suave"
                              onClick={() => setPreparando(d)}
                            >
                              {t("des.preparar")}
                            </Boton>
                          ) : etapa === "listo" ? (
                            <Boton compacto variante="luz" onClick={() => salir(d)}>
                              {t("des.sacarARuta")}
                            </Boton>
                          ) : (
                            <Boton
                              compacto
                              variante="primario"
                              onClick={() => setEntregando(d)}
                            >
                              {t("des.entregar")}
                            </Boton>
                          )
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
            </Tarjeta>
          );
        })}
      </div>

      <Tarjeta titulo={t("des.cerrados")}>
        {cerrados.length === 0 ? (
          <EstadoVacio icono="despacho" titulo={t("des.sinDespachos")} />
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {cerrados.map((d) => (
              <li key={d.id}>
                <TarjetaDespacho despacho={d} />
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      <DialogoPreparacion
        despacho={preparandoVivo}
        onCerrar={() => setPreparando(null)}
      />
      <DialogoEntrega despacho={entregando} onCerrar={() => setEntregando(null)} />
    </>
  );
}

// ---------------------------------------------------------------------------

function TarjetaDespacho({
  despacho,
  accion,
}: {
  despacho: Despacho;
  accion?: ReactNode;
}) {
  const { t, idioma } = usePreferencias();
  const estado = useEstado();

  const obra = estado.obras.find((o) => o.id === despacho.obraId);
  const chofer = estado.choferes.find((c) => c.id === despacho.choferId);
  const vehiculo = estado.vehiculos.find((v) => v.id === despacho.vehiculoId);
  const preparado = despacho.lineas.reduce((s, l) => s + l.preparado, 0);
  const total = totalUnidades(despacho);
  const pendientes = despacho.lineas.filter(
    (l) => pendienteDePreparar(l) > 0,
  ).length;

  return (
    <article className="rounded-control border-2 border-borde bg-superficie p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="codigo text-xs font-extrabold">{despacho.codigo}</span>
          <p className="truncate text-xs text-texto-2">
            {obra?.codigo} · {obra?.nombre}
          </p>
        </div>
        {despacho.estado === "con_discrepancia" ? (
          <Insignia tono="peligro" punto>
            {t("des.con_discrepancia")}
          </Insignia>
        ) : despacho.estado === "entregado" ? (
          <Insignia tono="ok" punto>
            {t("des.entregado")}
          </Insignia>
        ) : null}
      </div>

      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-texto-2">
        <span className="cifra font-bold text-texto">
          {numero(total, idioma)} {t("des.unidades")}
        </span>
        <span>
          {despacho.lineas.length} {t("des.lineas")}
        </span>
        {despacho.estado === "en_preparacion" && (
          <span className="font-bold text-advertencia">
            {t("des.pendiente")}: {pendientes} / {despacho.lineas.length}
            {preparado > 0 &&
              ` (${numero(preparado, idioma)} ${t("des.preparado").toLowerCase()})`}
          </span>
        )}
      </p>

      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-texto-3">
        <span className="text-texto-2">
          {despacho.transporte === "flota" ? t("des.flota") : t("des.externo")}
        </span>
        {despacho.transporte === "flota" ? (
          <>
            {chofer && <span>· {chofer.nombre}</span>}
            {vehiculo && <span className="codigo">· {vehiculo.placa}</span>}
          </>
        ) : (
          <>
            <span>· {despacho.transportistaExterno}</span>
            <span className="codigo">
              · {t("des.guia")} {despacho.guiaExterna}
            </span>
          </>
        )}
      </p>

      {despacho.pod && (
        <div
          className={`mt-3 rounded-control border-2 px-3 py-2 ${
            despacho.pod.coincide
              ? "border-transparent bg-ok-tenue"
              : "border-peligro/40 bg-peligro-tenue"
          }`}
        >
          <p
            className={`flex items-center gap-1.5 text-xs font-extrabold ${
              despacho.pod.coincide ? "text-ok" : "text-peligro"
            }`}
          >
            <Icono nombre={despacho.pod.coincide ? "panel" : "alerta"} tam={14} />
            {despacho.pod.coincide ? t("des.coincide") : t("des.noCoincide")}
          </p>
          <p className="mt-1 text-xs text-texto-2">
            {t("des.recibio")}: {despacho.pod.receptor}
          </p>
          {!despacho.pod.coincide && (
            <p className="mt-0.5 text-xs text-texto-2">
              {t("des.trajo")}:{" "}
              <span className="codigo font-bold">{despacho.pod.ordenReceptor}</span>
            </p>
          )}
        </div>
      )}

      {accion && <div className="mt-3 flex justify-end">{accion}</div>}
    </article>
  );
}
