"use client";

import { useMemo, useState, type ReactNode } from "react";

import { useT } from "@/lib/preferencias";
import { Boton } from "./boton";

/**
 * Tabla de Apolo: SIEMPRE con orden y paginación.
 *
 * Nunca se muestra un subconjunto sin forma de llegar al resto. Un "mostrando
 * 100 de 1703" sin paginador es el error que hace que el almacén deje de confiar
 * en el sistema y vuelva al Excel.
 *
 * El orden se indica con aria-sort Y con una flecha visible: el color por sí
 * solo no comunica estado.
 */

export interface Columna<T> {
  clave: string;
  titulo: string;
  /** Cifras a la derecha y con ancho fijo, o las columnas bailan al paginar. */
  numerica?: boolean;
  ordenable?: boolean;
  render: (fila: T) => ReactNode;
  valorOrden?: (fila: T) => string | number;
}

type Direccion = "asc" | "desc";

export function Tabla<T>({
  columnas,
  filas,
  claveFila,
  porPagina = 25,
  vacio,
}: {
  columnas: Columna<T>[];
  filas: T[];
  claveFila: (fila: T) => string;
  porPagina?: number;
  vacio?: ReactNode;
}) {
  const t = useT();
  const [orden, setOrden] = useState<{ clave: string; dir: Direccion } | null>(null);
  const [pagina, setPagina] = useState(0);

  const ordenadas = useMemo(() => {
    if (!orden) return filas;
    const col = columnas.find((c) => c.clave === orden.clave);
    if (!col?.valorOrden) return filas;
    const factor = orden.dir === "asc" ? 1 : -1;
    return [...filas].sort((a, b) => {
      const va = col.valorOrden!(a);
      const vb = col.valorOrden!(b);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * factor;
      return String(va).localeCompare(String(vb), "es") * factor;
    });
  }, [filas, orden, columnas]);

  const totalPaginas = Math.max(1, Math.ceil(ordenadas.length / porPagina));
  const paginaActual = Math.min(pagina, totalPaginas - 1);
  const visibles = ordenadas.slice(
    paginaActual * porPagina,
    paginaActual * porPagina + porPagina,
  );

  function alternar(clave: string) {
    setPagina(0);
    setOrden((prev) =>
      prev?.clave === clave
        ? { clave, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { clave, dir: "asc" },
    );
  }

  if (filas.length === 0 && vacio) return <>{vacio}</>;

  return (
    <div className="min-w-0">
      {/* El desbordamiento se contiene aquí: el cuerpo de la página nunca debe
          desplazarse horizontalmente. */}
      <div className="-mx-5 overflow-x-auto px-5">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-borde">
              {columnas.map((col) => {
                const activa = orden?.clave === col.clave;
                return (
                  <th
                    key={col.clave}
                    scope="col"
                    aria-sort={
                      activa
                        ? orden.dir === "asc"
                          ? "ascending"
                          : "descending"
                        : col.ordenable
                          ? "none"
                          : undefined
                    }
                    className={`px-3 py-2.5 text-xs font-bold uppercase tracking-[0.06em] text-texto-3 ${
                      col.numerica ? "text-right" : "text-left"
                    }`}
                  >
                    {col.ordenable ? (
                      <button
                        type="button"
                        onClick={() => alternar(col.clave)}
                        className={`inline-flex min-h-11 items-center gap-1 rounded-control px-1 hover:text-texto ${
                          activa ? "text-marca" : ""
                        }`}
                      >
                        {col.titulo}
                        <span aria-hidden="true" className="text-[10px]">
                          {activa ? (orden.dir === "asc" ? "▲" : "▼") : "↕"}
                        </span>
                      </button>
                    ) : (
                      col.titulo
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibles.map((fila) => (
              <tr
                key={claveFila(fila)}
                className="border-b border-borde last:border-0 hover:bg-superficie-2"
              >
                {columnas.map((col) => (
                  <td
                    key={col.clave}
                    className={`px-3 py-3 align-middle ${
                      col.numerica ? "cifra text-right" : "text-left"
                    }`}
                  >
                    {col.render(fila)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="cifra text-sm text-texto-2">
          {t("tabla.mostrando")} {visibles.length} / {ordenadas.length}{" "}
          {t("tabla.registros")}
        </p>
        <div className="flex items-center gap-2">
          {/* Sin `compacto`: el paginador es el control que más se toca en un
              almacén y necesita sus 44px reales. */}
          <Boton
            variante="suave"
            disabled={paginaActual === 0}
            onClick={() => setPagina((p) => Math.max(0, p - 1))}
          >
            {t("tabla.anterior")}
          </Boton>
          <span className="cifra px-1 text-sm text-texto-2">
            {t("tabla.pagina")} {paginaActual + 1} {t("tabla.de")} {totalPaginas}
          </span>
          <Boton
            variante="suave"
            disabled={paginaActual >= totalPaginas - 1}
            onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))}
          >
            {t("tabla.siguiente")}
          </Boton>
        </div>
      </div>
    </div>
  );
}
