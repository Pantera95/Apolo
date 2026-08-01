"use client";

import { useState } from "react";

import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { Dialogo } from "@/components/ui/dialogo";
import { Insignia } from "@/components/ui/insignia";
import { entregar, prepararLinea } from "@/lib/db/operaciones";
import { useEstado } from "@/lib/db/almacen";
import {
  pendienteDePreparar,
  rutaDePreparacion,
  type Despacho,
} from "@/lib/dominio/entrega";
import type { ClaveTexto } from "@/lib/i18n/textos";
import { usePreferencias } from "@/lib/preferencias";
import { numero } from "@/lib/datos/indicadores";

/**
 * Preparación: la lista se recorre en el orden físico del almacén.
 * Un picker que va y vuelve por el mismo pasillo pierde el turno entero.
 */
export function DialogoPreparacion({
  despacho,
  onCerrar,
}: {
  despacho: Despacho | null;
  onCerrar: () => void;
}) {
  const { t, idioma } = usePreferencias();
  const estado = useEstado();
  const [error, setError] = useState<string | null>(null);

  if (!despacho) return null;

  const articulos = new Map(estado.articulos.map((a) => [a.id, a]));
  const ubicaciones = new Map(estado.ubicaciones.map((u) => [u.id, u]));
  const orden = new Map(
    estado.ubicaciones.map((u) => [u.id, u.ordenRecorrido]),
  );
  const ruta = rutaDePreparacion(despacho, orden);

  function recoger(articuloId: string, ubicacionId: string, cantidad: number) {
    setError(null);
    const r = prepararLinea(despacho!.id, articuloId, ubicacionId, cantidad);
    if (!r.ok) setError(t(`err.${r.error.codigo}` as ClaveTexto));
  }

  return (
    <Dialogo
      abierto
      titulo={`${t("des.rutaPicking")} · ${despacho.codigo}`}
      descripcion={t("des.rutaAyuda")}
      onCerrar={onCerrar}
      pie={
        <Boton variante="suave" onClick={onCerrar}>
          {t("aj.cancelar")}
        </Boton>
      }
    >
      <ol className="flex flex-col gap-3">
        {ruta.map((linea, i) => {
          const articulo = articulos.get(linea.articuloId);
          const ubicacion = ubicaciones.get(linea.ubicacionId);
          const pendiente = pendienteDePreparar(linea);
          return (
            <li
              key={`${linea.articuloId}-${linea.ubicacionId}`}
              className="flex flex-wrap items-center gap-3 rounded-control border-2 border-borde p-3"
            >
              <span className="cifra flex h-8 w-8 shrink-0 items-center justify-center rounded-pildora bg-superficie-2 text-xs font-extrabold">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="codigo text-xs font-bold">{articulo?.codigo}</p>
                <p className="truncate text-xs text-texto-2">
                  {ubicacion?.pasillo}-{ubicacion?.rack} ·{" "}
                  {numero(linea.cantidad, idioma)} {articulo?.unidadBase}
                </p>
              </div>
              {pendiente === 0 ? (
                <Insignia tono="ok" punto>
                  {t("des.preparado")}
                </Insignia>
              ) : (
                <Boton
                  compacto
                  variante="luz"
                  onClick={() =>
                    recoger(linea.articuloId, linea.ubicacionId, pendiente)
                  }
                >
                  {t("des.marcarRecogido")}
                </Boton>
              )}
            </li>
          );
        })}
      </ol>
      {error && <p className="mt-3 text-sm font-bold text-peligro">{error}</p>}
    </Dialogo>
  );
}

/**
 * Entrega con verificación.
 *
 * El operario escribe el número que trae el receptor; la coincidencia la
 * calcula el dominio. No hay casilla de "conforme" que alguien pueda marcar
 * sin mirar.
 */
export function DialogoEntrega({
  despacho,
  onCerrar,
}: {
  despacho: Despacho | null;
  onCerrar: () => void;
}) {
  const { t } = usePreferencias();
  const [receptor, setReceptor] = useState("");
  const [orden, setOrden] = useState("");
  const [observacion, setObservacion] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!despacho) return null;

  function confirmar() {
    setError(null);
    const r = entregar(despacho!.id, {
      receptor,
      ordenReceptor: orden,
      observacion: observacion || undefined,
      evidencia: "firma",
    });
    if (!r.ok) {
      setError(t(`err.${r.error.codigo}` as ClaveTexto));
      return;
    }
    setReceptor("");
    setOrden("");
    setObservacion("");
    onCerrar();
  }

  return (
    <Dialogo
      abierto
      titulo={`${t("des.entregar")} · ${despacho.codigo}`}
      onCerrar={onCerrar}
      pie={
        <>
          <Boton variante="fantasma" onClick={onCerrar}>
            {t("aj.cancelar")}
          </Boton>
          <Boton
            variante="primario"
            disabled={!receptor.trim() || !orden.trim()}
            onClick={confirmar}
          >
            {t("des.entregar")}
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Campo
          etiqueta={t("des.receptor")}
          value={receptor}
          placeholder="Ing. Carmen Rondón"
          onChange={(e) => setReceptor(e.target.value)}
        />
        <Campo
          etiqueta={t("des.ordenReceptor")}
          ayuda={t("des.ordenAyuda")}
          error={error ?? undefined}
          value={orden}
          placeholder={despacho.codigo}
          onChange={(e) => setOrden(e.target.value)}
        />
        <Campo
          etiqueta={t("des.observacion")}
          value={observacion}
          onChange={(e) => setObservacion(e.target.value)}
        />
      </div>
    </Dialogo>
  );
}
