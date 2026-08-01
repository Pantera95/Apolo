"use client";

import { useState } from "react";

import { Boton } from "@/components/ui/boton";
import { Campo, Segmentado, Selector } from "@/components/ui/campo";
import { Dialogo } from "@/components/ui/dialogo";
import { numero } from "@/lib/datos/indicadores";
import type { DeudaObra } from "@/lib/datos/obras";
import { registrarRetornoObra } from "@/lib/db/operaciones";
import type { Obra } from "@/lib/dominio/tipos";
import type { ClaveTexto } from "@/lib/i18n/textos";
import { usePreferencias } from "@/lib/preferencias";

/**
 * Retorno de herramienta: el paso que cierra el ciclo.
 *
 * Vuelve a la ubicación de donde salió, no a una cualquiera. Y si viene rota
 * entra como averiada: sigue siendo del inventario pero no cuenta como
 * disponible, que es exactamente la diferencia que hoy nadie registra.
 */
export function DialogoRetorno({
  obra,
  deuda,
  onCerrar,
}: {
  obra: Obra;
  deuda: DeudaObra[];
  onCerrar: () => void;
}) {
  const { t, idioma } = usePreferencias();
  const [articuloId, setArticuloId] = useState(deuda[0]?.articulo.id ?? "");
  const [cantidad, setCantidad] = useState("");
  const [condicion, setCondicion] = useState<"bueno" | "averiado">("bueno");
  const [error, setError] = useState<string | null>(null);

  const seleccionada = deuda.find((d) => d.articulo.id === articuloId);

  function confirmar() {
    setError(null);
    if (!seleccionada) return;

    const r = registrarRetornoObra(
      obra.id,
      seleccionada.articulo.id,
      seleccionada.almacenId,
      seleccionada.ubicacionId,
      Number(cantidad.replace(",", ".")),
      condicion,
    );

    if (!r.ok) {
      setError(t(`err.${r.error.codigo}` as ClaveTexto));
      return;
    }
    setCantidad("");
    onCerrar();
  }

  return (
    <Dialogo
      abierto
      titulo={t("obr.retornoTitulo")}
      descripcion={`${obra.codigo} · ${obra.nombre}`}
      onCerrar={onCerrar}
      pie={
        <>
          <Boton variante="fantasma" onClick={onCerrar}>
            {t("aj.cancelar")}
          </Boton>
          <Boton
            variante="primario"
            disabled={!seleccionada || cantidad.trim() === ""}
            onClick={confirmar}
          >
            {t("obr.retornar")}
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Selector
          etiqueta={t("obr.eligeHerramienta")}
          value={articuloId}
          onChange={(e) => setArticuloId(e.target.value)}
        >
          {deuda.map((d) => (
            <option key={d.articulo.id} value={d.articulo.id}>
              {d.articulo.codigo} · {numero(d.unidades, idioma)}{" "}
              {t("obr.pendientes")}
            </option>
          ))}
        </Selector>

        <Campo
          etiqueta={t("aj.cantidad")}
          type="number"
          inputMode="decimal"
          min={0}
          max={seleccionada?.unidades}
          step="any"
          value={cantidad}
          ayuda={
            seleccionada
              ? `${numero(seleccionada.unidades, idioma)} ${t("obr.pendientes")} · ${seleccionada.articulo.unidadBase}`
              : undefined
          }
          error={error ?? undefined}
          sufijo={seleccionada?.articulo.unidadBase}
          onChange={(e) => setCantidad(e.target.value)}
        />

        <Segmentado
          etiqueta={t("obr.condicion")}
          valor={condicion}
          onCambio={setCondicion}
          opciones={[
            { valor: "bueno", texto: t("obr.bueno") },
            { valor: "averiado", texto: t("obr.averiado") },
          ]}
        />

        <p className="text-xs text-texto-3">{t("obr.retornoAyuda")}</p>
      </div>
    </Dialogo>
  );
}
