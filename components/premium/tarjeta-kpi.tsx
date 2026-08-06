"use client";

import Link from "next/link";

import { definicion, estadoUmbral } from "@/lib/dashboard/catalogo";
import { tendencia, variacion } from "@/lib/dashboard/kpis";
import type { UnidadKpi, ValorKpi } from "@/lib/dashboard/tipos";
import { dinero, numero } from "@/lib/datos/indicadores";
import { usePreferencias } from "@/lib/preferencias";

/**
 * Tarjeta de indicador.
 *
 * Un número solo no informa: 92% es excelente en entregas completas y pésimo
 * en exactitud de inventario. Por eso cada tarjeta trae umbral, dirección y
 * comparación contra el periodo anterior, todo leído del catálogo.
 *
 * El estado se codifica con color Y con texto. Un semáforo que solo cambia de
 * color deja fuera a quien no distingue rojo de verde, que en una constructora
 * es aproximadamente uno de cada doce hombres en plantilla.
 */
export function TarjetaKpiPremium({
  valor,
  enlace,
  destacada = false,
  className = "",
}: {
  valor: ValorKpi;
  enlace?: string;
  destacada?: boolean;
  className?: string;
}) {
  const { t, idioma } = usePreferencias();
  const def = definicion(valor.id);
  if (!def) return null;

  const estado = estadoUmbral(def, valor.valor);
  const v = variacion(valor.valor, valor.anterior);
  const dir = tendencia(valor.valor, valor.anterior);

  const cuerpo = (
    <>
      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
        <p className="min-w-0 text-[11px] font-bold uppercase tracking-[0.1em] text-texto-3">
          {def.nombre}
        </p>
        <Semaforo estado={estado} />
      </div>

      <p
        className={`cifra mt-3 min-w-0 break-words font-extrabold leading-[0.95] tracking-[-0.03em] ${
          // Cuerpo fluido: con un tamano fijo, "USD 125.174" se partia a la
          // mitad dentro de la tarjeta y se leia "USD 125." en una linea.
          destacada
            ? "text-[clamp(1.6rem,3.4vw,2.75rem)]"
            : "text-[clamp(1.25rem,2vw,1.75rem)]"
        }`}
      >
        {valor.valor === null ? (
          <span className="text-base font-bold text-texto-3">
            {t("premium.sinDatos")}
          </span>
        ) : (
          formatear(valor.valor, def.unidad, idioma)
        )}
      </p>

      {valor.valor === null && def.faltaDato ? (
        <p className="mt-2 text-xs leading-relaxed text-texto-3">{def.faltaDato}</p>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {v !== null && (
            <span
              className={`mono text-[11px] font-bold ${
                dir === "plano" ? "text-texto-3" : esBueno(dir, def.direccion) ? "text-luz" : "text-peligro"
              }`}
            >
              {dir === "sube" ? "▲" : dir === "baja" ? "▼" : "—"}{" "}
              {numero(Math.abs(v), idioma)}%
            </span>
          )}
          <span className="text-[11px] text-texto-3">
            {v === null ? def.descripcion.slice(0, 64) : t("premium.vsAnterior")}
          </span>
        </div>
      )}
    </>
  );

  const clases = [
    "flex min-w-0 flex-col rounded-tarjeta border p-4 transition-colors",
    estado === "critico"
      ? "border-peligro/50 bg-peligro-tenue"
      : estado === "advertencia"
        ? "border-advertencia/50 bg-advertencia-tenue"
        : "border-borde-fuerte bg-superficie",
    enlace ? "hover:border-marca" : "",
    className,
  ].join(" ");

  // El tooltip nativo lleva la definición completa: qué mide y con qué fórmula.
  const explicacion = `${def.descripcion}\n\nFórmula: ${def.formula}`;

  if (!enlace) {
    return (
      <div className={clases} title={explicacion}>
        {cuerpo}
      </div>
    );
  }

  return (
    <Link href={enlace} className={clases} title={explicacion}>
      {cuerpo}
    </Link>
  );
}

function esBueno(dir: "sube" | "baja" | "plano", direccion: string): boolean {
  if (dir === "plano") return true;
  if (direccion === "mas-es-mejor") return dir === "sube";
  if (direccion === "menos-es-mejor") return dir === "baja";
  return true;
}

function Semaforo({
  estado,
}: {
  estado: "normal" | "advertencia" | "critico" | "sin-datos";
}) {
  const mapa = {
    normal: { txt: "OK", cls: "text-luz" },
    advertencia: { txt: "REVISAR", cls: "text-advertencia" },
    critico: { txt: "CRÍTICO", cls: "text-peligro" },
    "sin-datos": { txt: "S/D", cls: "text-texto-3" },
  } as const;
  const { txt, cls } = mapa[estado];
  // Texto además del color: un semáforo solo cromático excluye a quien no
  // distingue rojo de verde.
  return (
    <span className={`mono shrink-0 text-[10px] font-bold tracking-[0.1em] ${cls}`}>
      {txt}
    </span>
  );
}

function formatear(valor: number, unidad: UnidadKpi, idioma: "es" | "en"): string {
  switch (unidad) {
    case "usd":
      return dinero(valor, idioma);
    case "porcentaje":
      return `${numero(valor, idioma)}%`;
    case "dias":
      return `${numero(valor, idioma)} d`;
    case "horas":
      return `${numero(valor, idioma)} h`;
    case "veces":
      return `${numero(valor, idioma)}×`;
    default:
      return numero(valor, idioma);
  }
}
