"use client";

import { useState } from "react";

import { Boton } from "@/components/ui/boton";
import { Campo, Segmentado, Selector } from "@/components/ui/campo";
import { Dialogo } from "@/components/ui/dialogo";
import { Icono } from "@/components/ui/icono";
import { useEstado } from "@/lib/db/almacen";
import { crearDespachoDesdeSolicitud, crearSolicitud } from "@/lib/db/operaciones";
import type { Solicitud } from "@/lib/dominio/despacho";
import type { TipoTransporte } from "@/lib/dominio/entrega";
import type { ClaveTexto } from "@/lib/i18n/textos";
import { usePreferencias } from "@/lib/preferencias";

interface LineaBorrador {
  articuloId: string;
  cantidad: string;
}

/**
 * Alta de solicitud interna.
 *
 * Nace SOLICITADA, nunca aprobada: quien pide no autoriza. Ese es el motivo de
 * existir de toda la cadena, así que el formulario ni siquiera ofrece el estado.
 */
export function DialogoNuevaSolicitud({
  abierto,
  onCerrar,
}: {
  abierto: boolean;
  onCerrar: () => void;
}) {
  const { t } = usePreferencias();
  const estado = useEstado();

  const [obraId, setObraId] = useState("");
  const [lineas, setLineas] = useState<LineaBorrador[]>([
    { articuloId: "", cantidad: "" },
  ]);
  const [error, setError] = useState<string | null>(null);

  const obrasActivas = estado.obras.filter((o) => o.estado === "activa");

  function actualizar(i: number, cambio: Partial<LineaBorrador>) {
    setLineas((prev) => prev.map((l, j) => (j === i ? { ...l, ...cambio } : l)));
  }

  function limpiar() {
    setObraId("");
    setLineas([{ articuloId: "", cantidad: "" }]);
    setError(null);
  }

  function guardar() {
    setError(null);
    const utiles = lineas
      .filter((l) => l.articuloId && l.cantidad.trim() !== "")
      .map((l) => ({
        articuloId: l.articuloId,
        cantidad: Number(l.cantidad.replace(",", ".")),
      }));

    if (utiles.length === 0) {
      setError(t("sol.sinLineas"));
      return;
    }

    const r = crearSolicitud(obraId, utiles);
    if (!r.ok) {
      setError(t(`err.${r.error.codigo}` as ClaveTexto));
      return;
    }
    limpiar();
    onCerrar();
  }

  return (
    <Dialogo
      abierto={abierto}
      titulo={t("sol.nueva")}
      descripcion={t("sol.bloqueadaAyuda")}
      onCerrar={() => {
        limpiar();
        onCerrar();
      }}
      pie={
        <>
          <Boton
            variante="fantasma"
            onClick={() => {
              limpiar();
              onCerrar();
            }}
          >
            {t("aj.cancelar")}
          </Boton>
          <Boton variante="primario" disabled={!obraId} onClick={guardar}>
            {t("sol.crear")}
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Selector
          etiqueta={t("sol.obra")}
          value={obraId}
          error={error ?? undefined}
          onChange={(e) => setObraId(e.target.value)}
        >
          <option value="">{t("sol.eligeObra")}</option>
          {obrasActivas.map((o) => (
            <option key={o.id} value={o.id}>
              {o.codigo} · {o.nombre}
            </option>
          ))}
        </Selector>

        <div className="flex flex-col gap-3">
          {lineas.map((linea, i) => (
            <div key={i} className="grid grid-cols-[1fr_6rem_auto] items-end gap-2">
              <Selector
                etiqueta={i === 0 ? t("sol.articulo") : ""}
                value={linea.articuloId}
                onChange={(e) => actualizar(i, { articuloId: e.target.value })}
              >
                <option value="">{t("sol.eligeArticulo")}</option>
                {estado.articulos.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.codigo} · {a.descripcion}
                  </option>
                ))}
              </Selector>
              <Campo
                etiqueta={i === 0 ? t("sol.cantidad") : ""}
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={linea.cantidad}
                onChange={(e) => actualizar(i, { cantidad: e.target.value })}
              />
              <button
                type="button"
                aria-label={t("sol.quitar")}
                disabled={lineas.length === 1}
                onClick={() => setLineas((p) => p.filter((_, j) => j !== i))}
                className="flex h-11 w-11 items-center justify-center rounded-control text-texto-3 hover:bg-superficie-2 hover:text-peligro disabled:opacity-40"
              >
                <Icono nombre="cerrar" tam={18} />
              </button>
            </div>
          ))}
        </div>

        <Boton
          variante="suave"
          onClick={() => setLineas((p) => [...p, { articuloId: "", cantidad: "" }])}
        >
          {t("sol.agregarLinea")}
        </Boton>
      </div>
    </Dialogo>
  );
}

/**
 * Generar el despacho de una solicitud aprobada.
 *
 * Aquí se reserva el material, así que exige saber quién lo va a llevar antes
 * de comprometer existencia.
 */
export function DialogoGenerarDespacho({
  solicitud,
  onCerrar,
}: {
  solicitud: Solicitud | null;
  onCerrar: () => void;
}) {
  const { t } = usePreferencias();
  const estado = useEstado();

  const [transporte, setTransporte] = useState<TipoTransporte>("flota");
  const [choferId, setChoferId] = useState("");
  const [vehiculoId, setVehiculoId] = useState("");
  const [transportista, setTransportista] = useState("");
  const [guia, setGuia] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!solicitud) return null;

  function generar() {
    setError(null);
    const r = crearDespachoDesdeSolicitud(solicitud!.id, transporte, {
      choferId: transporte === "flota" ? choferId || undefined : undefined,
      vehiculoId: transporte === "flota" ? vehiculoId || undefined : undefined,
      transportistaExterno: transporte === "externo" ? transportista : undefined,
      guiaExterna: transporte === "externo" ? guia : undefined,
    });
    if (!r.ok) {
      setError(t(`err.${r.error.codigo}` as ClaveTexto));
      return;
    }
    onCerrar();
  }

  return (
    <Dialogo
      abierto
      titulo={`${t("sol.generarDespacho")} · ${solicitud.codigo}`}
      onCerrar={onCerrar}
      pie={
        <>
          <Boton variante="fantasma" onClick={onCerrar}>
            {t("aj.cancelar")}
          </Boton>
          <Boton variante="primario" onClick={generar}>
            {t("sol.generarDespacho")}
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Segmentado
          etiqueta={t("des.transporte")}
          valor={transporte}
          onCambio={setTransporte}
          opciones={[
            { valor: "flota", texto: t("des.flota") },
            { valor: "externo", texto: t("des.externo") },
          ]}
        />

        {transporte === "flota" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Selector
              etiqueta={t("des.chofer")}
              value={choferId}
              onChange={(e) => setChoferId(e.target.value)}
            >
              <option value="">—</option>
              {estado.choferes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </Selector>
            <Selector
              etiqueta={t("des.vehiculo")}
              value={vehiculoId}
              onChange={(e) => setVehiculoId(e.target.value)}
            >
              <option value="">—</option>
              {estado.vehiculos.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.placa} · {v.descripcion}
                </option>
              ))}
            </Selector>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo
              etiqueta={t("des.externo")}
              value={transportista}
              onChange={(e) => setTransportista(e.target.value)}
            />
            <Campo
              etiqueta={t("des.guia")}
              value={guia}
              onChange={(e) => setGuia(e.target.value)}
            />
          </div>
        )}

        {error && <p className="text-sm font-bold text-peligro">{error}</p>}
      </div>
    </Dialogo>
  );
}
