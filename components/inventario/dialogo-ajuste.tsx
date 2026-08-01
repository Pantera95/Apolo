"use client";

import { useState } from "react";

import { Boton } from "@/components/ui/boton";
import { Campo, Segmentado, Selector } from "@/components/ui/campo";
import { Dialogo } from "@/components/ui/dialogo";
import { ejecutar } from "@/lib/db/operaciones";
import type { SaldoUbicado } from "@/lib/datos/inventario";
import type { Articulo, CodigoUnidad, MotivoAjuste } from "@/lib/dominio/tipos";
import { aUnidadBase } from "@/lib/dominio/unidades";
import type { ClaveTexto } from "@/lib/i18n/textos";
import { usePreferencias } from "@/lib/preferencias";

const MOTIVOS: MotivoAjuste[] = [
  "merma",
  "rotura",
  "consumo_interno",
  "danado_de_fabrica",
];

/**
 * Ajuste manual de existencia.
 *
 * El motivo es obligatorio y el formulario no deja enviarlo sin él, pero la
 * validación real está en el dominio: aunque alguien manipulara el formulario,
 * `aplicar` rechaza el ajuste sin motivo y no se guarda nada.
 *
 * La cantidad se captura en la unidad que el operario tenga a mano y se
 * convierte a la unidad base antes de tocar el kardex.
 */
export function DialogoAjuste({
  abierto,
  articulo,
  ubicaciones,
  onCerrar,
  onHecho,
}: {
  abierto: boolean;
  articulo: Articulo;
  ubicaciones: SaldoUbicado[];
  onCerrar: () => void;
  onHecho: () => void;
}) {
  const { t } = usePreferencias();

  const porDefecto = ubicaciones[0];
  const [ubicacionId, setUbicacionId] = useState(porDefecto?.ubicacion?.id ?? "");
  const [signo, setSigno] = useState<"1" | "-1">("-1");
  const [cantidad, setCantidad] = useState("");
  const [unidad, setUnidad] = useState<CodigoUnidad>(articulo.unidadBase);
  const [motivo, setMotivo] = useState<MotivoAjuste | "">("");
  const [error, setError] = useState<string | null>(null);

  const unidadesPosibles: CodigoUnidad[] = [
    articulo.unidadBase,
    ...(Object.keys(articulo.equivalencias ?? {}) as CodigoUnidad[]),
  ];

  function limpiar() {
    setCantidad("");
    setMotivo("");
    setError(null);
  }

  function registrar() {
    setError(null);

    const cruda = Number(cantidad.replace(",", "."));
    const convertida = aUnidadBase(articulo, cruda, unidad);
    if (!convertida.ok) {
      setError(t(`err.${convertida.error.codigo}` as ClaveTexto));
      return;
    }

    const destino = ubicaciones.find((u) => u.ubicacion?.id === ubicacionId);
    if (!destino?.ubicacion || !destino.almacen) {
      setError(t("err.CANTIDAD_INVALIDA"));
      return;
    }

    const r = ejecutar({
      tipo: "ajuste",
      signo: signo === "1" ? 1 : -1,
      motivo: motivo as MotivoAjuste,
      cantidad: convertida.valor,
      articuloId: articulo.id,
      almacenId: destino.almacen.id,
      ubicacionId: destino.ubicacion.id,
      usuarioId: "demo-owner",
    });

    if (!r.ok) {
      // El detalle técnico no se le enseña al operario: se le dice qué pasó.
      setError(t(`err.${r.error.codigo}` as ClaveTexto));
      return;
    }

    limpiar();
    onHecho();
  }

  const listoParaEnviar = motivo !== "" && cantidad.trim() !== "" && ubicacionId !== "";

  return (
    <Dialogo
      abierto={abierto}
      titulo={t("aj.titulo")}
      descripcion={`${articulo.codigo} · ${articulo.descripcion}`}
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
          <Boton variante="primario" disabled={!listoParaEnviar} onClick={registrar}>
            {t("aj.confirmar")}
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Selector
          etiqueta={t("inv.ubicacion")}
          value={ubicacionId}
          onChange={(e) => setUbicacionId(e.target.value)}
        >
          {ubicaciones.map((u) => (
            <option key={u.ubicacion?.id} value={u.ubicacion?.id}>
              {u.almacen?.nombre} · {u.ubicacion?.pasillo}-{u.ubicacion?.rack} (
              {u.saldo.fisico} {articulo.unidadBase})
            </option>
          ))}
        </Selector>

        <Segmentado
          etiqueta={t("aj.direccion")}
          valor={signo}
          onCambio={setSigno}
          opciones={[
            { valor: "-1", texto: t("aj.restar") },
            { valor: "1", texto: t("aj.sumar") },
          ]}
        />

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Campo
            etiqueta={t("aj.cantidad")}
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
          />
          <Selector
            etiqueta={t("inv.unidad")}
            value={unidad}
            onChange={(e) => setUnidad(e.target.value as CodigoUnidad)}
            className="w-32"
          >
            {unidadesPosibles.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Selector>
        </div>

        <Selector
          etiqueta={t("aj.motivo")}
          ayuda={t("aj.motivoAyuda")}
          error={error ?? undefined}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value as MotivoAjuste | "")}
        >
          <option value="">{t("aj.eligeMotivo")}</option>
          {MOTIVOS.map((m) => (
            <option key={m} value={m}>
              {t(`motivo.${m}` as ClaveTexto)}
            </option>
          ))}
        </Selector>
      </div>
    </Dialogo>
  );
}
