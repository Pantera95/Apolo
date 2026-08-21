"use client";

import { useMemo, useRef, useState } from "react";

import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";
import { Selector } from "@/components/ui/campo";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Insignia } from "@/components/ui/insignia";
import { Pestanas } from "@/components/ui/pestanas";
import { Tabla, type Columna } from "@/components/ui/tabla";
import { Tarjeta, TarjetaKpi } from "@/components/ui/tarjeta";
import { BOM } from "@/lib/datos/csv";
import { numero } from "@/lib/datos/indicadores";
import { filasInventario } from "@/lib/datos/inventario";
import { useEstado, type ArchivoImportado } from "@/lib/db/almacen";
import {
  aplicarImportacion,
  clavesCargadas,
  revertirArchivo,
} from "@/lib/db/operaciones";
import {
  analizar,
  conciliar,
  detectarDuplicados,
  type Analisis,
  type DiferenciaConciliacion,
  type Duplicado,
  type ErrorFila,
  type FilaImportada,
} from "@/lib/dominio/importacion";
import type { ClaveTexto } from "@/lib/i18n/textos";
import { usePreferencias } from "@/lib/preferencias";

type Vista = "cargar" | "archivos" | "conciliacion";

export default function Importacion() {
  const { t, idioma } = usePreferencias();
  const estado = useEstado();

  const [vista, setVista] = useState<Vista>("cargar");
  const [perfilId, setPerfilId] = useState("");
  const [ubicacionId, setUbicacionId] = useState("");
  const [nombre, setNombre] = useState("");
  const [analisis, setAnalisis] = useState<Analisis | null>(null);
  const [duplicados, setDuplicados] = useState<Duplicado[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [difs, setDifs] = useState<DiferenciaConciliacion[] | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  const num = (v: number) => numero(v, idioma);
  const perfil = estado.perfiles.find((p) => p.id === perfilId);
  const movimientos = estado.perfiles.filter((p) => p.tipo === "movimientos");
  const deExistencias = estado.perfiles.filter((p) => p.tipo === "existencias");

  /**
   * Se excluye por LÍNEA, no por huella.
   *
   * Cuando la repetición está dentro del mismo archivo, el duplicado comparte
   * huella con su original: filtrar por huella tiraba las dos filas y se
   * dejaba de importar la buena.
   */
  const lineasDuplicadas = useMemo(
    () => new Set(duplicados.map((d) => d.linea)),
    [duplicados],
  );
  const listas = (analisis?.filas ?? []).filter(
    (f) => !lineasDuplicadas.has(f.linea),
  );

  function limpiar() {
    setAnalisis(null);
    setDuplicados([]);
    setError(null);
    setAviso(null);
    setNombre("");
    if (entrada.current) entrada.current.value = "";
  }

  async function alElegirArchivo(archivo: File | undefined) {
    setError(null);
    setAviso(null);
    if (!archivo || !perfil) return;

    const r = analizar(await archivo.text(), perfil);
    if (!r.ok) {
      // Formato distinto al declarado: error explícito, no importar a medias.
      setAnalisis(null);
      setError(r.error.detalle);
      return;
    }

    setNombre(archivo.name);
    setAnalisis(r.valor);
    setDuplicados(detectarDuplicados(r.valor.filas, clavesCargadas(estado)));
  }

  function importar() {
    if (!perfil || listas.length === 0) return;
    const ubicacion = estado.ubicaciones.find((u) => u.id === ubicacionId);
    if (!ubicacion) return;

    const r = aplicarImportacion(
      nombre,
      perfil,
      listas,
      ubicacion.almacenId,
      ubicacion.id,
    );
    if (!r.ok) {
      setError(t(`err.${r.error.codigo}` as ClaveTexto));
      return;
    }

    const omitidas = r.valor.omitidas.length;
    setAviso(
      `${num(r.valor.importadas)} ${t("imp.filas")}` +
        (omitidas > 0 ? ` · ${num(omitidas)} ${t("imp.omitidas")}` : ""),
    );
    setAnalisis(null);
    setDuplicados([]);
    if (entrada.current) entrada.current.value = "";
    setVista("archivos");
  }

  function revertir(archivo: ArchivoImportado) {
    setError(null);
    const r = revertirArchivo(archivo.id);
    if (!r.ok) setError(t(`err.${r.error.codigo}` as ClaveTexto));
  }

  /** Plantilla con las columnas del perfil, para poder probar sin el ERP. */
  function descargarPlantilla() {
    if (!perfil) return;
    const cabecera = Object.values(perfil.columnas).filter(Boolean) as string[];
    const ejemplo = estado.articulos
      .slice(0, 3)
      .map((a) =>
        [a.codigo, "10", "01/08/2026", "FC-DEMO"].slice(0, cabecera.length),
      );
    const texto = [
      cabecera.join(perfil.separador),
      ...ejemplo.map((f) => f.join(perfil.separador)),
    ].join("\r\n");

    const url = URL.createObjectURL(
      new Blob([BOM + texto], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `plantilla-${perfil.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function conciliarArchivo(archivo: File | undefined) {
    setError(null);
    const perfilExistencias = deExistencias[0];
    if (!archivo || !perfilExistencias) return;

    const r = analizar(await archivo.text(), perfilExistencias);
    if (!r.ok) {
      setError(r.error.detalle);
      setDifs(null);
      return;
    }

    const deApolo = new Map(
      filasInventario(estado).map((f) => [
        f.articulo.codigo.toUpperCase(),
        { descripcion: f.articulo.descripcion, cantidad: f.disponible },
      ]),
    );
    setDifs(
      conciliar(
        r.valor.filas.map((f) => ({ codigo: f.codigo, cantidad: f.cantidad })),
        deApolo,
      ),
    );
  }

  const columnasPrevia: Columna<FilaImportada>[] = [
    {
      clave: "linea",
      titulo: t("imp.linea"),
      numerica: true,
      ordenable: true,
      valorOrden: (f) => f.linea,
      render: (f) => <span className="cifra text-xs text-texto-3">{f.linea}</span>,
    },
    {
      clave: "codigo",
      titulo: t("imp.codigo"),
      ordenable: true,
      valorOrden: (f) => f.codigo,
      render: (f) => <span className="codigo text-xs font-bold">{f.codigo}</span>,
    },
    {
      clave: "cantidad",
      titulo: t("imp.cantidad"),
      numerica: true,
      ordenable: true,
      valorOrden: (f) => f.cantidad,
      render: (f) => <span className="font-bold">{num(f.cantidad)}</span>,
    },
    {
      clave: "fecha",
      titulo: t("imp.fecha"),
      ordenable: true,
      valorOrden: (f) => f.fecha,
      render: (f) => <span className="text-xs text-texto-2">{f.fecha || "—"}</span>,
    },
    {
      clave: "documento",
      titulo: t("imp.documento"),
      ordenable: true,
      valorOrden: (f) => f.documento,
      render: (f) => <span className="codigo text-xs">{f.documento || "—"}</span>,
    },
    {
      clave: "estado",
      titulo: "",
      render: (f) =>
        lineasDuplicadas.has(f.linea) ? (
          <Insignia tono="advertencia" punto>
            {t("imp.duplicadas")}
          </Insignia>
        ) : (
          <Insignia tono="ok" punto>
            {t("imp.listas")}
          </Insignia>
        ),
    },
  ];

  const columnasConciliacion: Columna<DiferenciaConciliacion>[] = [
    {
      clave: "codigo",
      titulo: t("imp.codigo"),
      ordenable: true,
      valorOrden: (d) => d.codigo,
      render: (d) => (
        <div className="min-w-0">
          <span className="codigo text-xs font-bold">{d.codigo}</span>
          <p className="truncate text-xs text-texto-2">{d.descripcion}</p>
        </div>
      ),
    },
    {
      clave: "erp",
      titulo: t("imp.segunErp"),
      numerica: true,
      ordenable: true,
      valorOrden: (d) => d.segunErp,
      render: (d) => num(d.segunErp),
    },
    {
      clave: "apolo",
      titulo: t("imp.segunApolo"),
      numerica: true,
      ordenable: true,
      valorOrden: (d) => d.segunApolo,
      render: (d) => num(d.segunApolo),
    },
    {
      clave: "dif",
      titulo: t("imp.diferencia"),
      numerica: true,
      ordenable: true,
      valorOrden: (d) => Math.abs(d.diferencia),
      render: (d) => (
        <span
          className={`font-bold ${d.diferencia > 0 ? "text-info" : "text-peligro"}`}
        >
          {d.diferencia > 0 ? "+" : "−"}
          {num(Math.abs(d.diferencia))}
        </span>
      ),
    },
  ];

  return (
    <>
      <div className="mb-6 pt-4">
        <h1 className="text-4xl leading-[0.95] tracking-[-0.035em] sm:text-5xl">
          {t("imp.titulo")}
        </h1>
        <p className="mt-3 text-base text-texto-2">{t("imp.subtitulo")}</p>
        <p className="mt-2 text-sm font-semibold text-texto-3">
          {t("imp.nuncaEscribe")}
        </p>
      </div>

      <div className="mb-4">
        <Pestanas
          etiqueta={t("imp.titulo")}
          valor={vista}
          onCambio={setVista}
          opciones={[
            { valor: "cargar", texto: t("imp.cargar") },
            {
              valor: "archivos",
              texto: t("imp.archivos"),
              contador: estado.archivos.length,
            },
            { valor: "conciliacion", texto: t("imp.conciliacion") },
          ]}
        />
      </div>

      {error && (
        <div className="mb-4">
          <Alerta tono="peligro">{error}</Alerta>
        </div>
      )}
      {aviso && (
        <div className="mb-4">
          <Alerta tono="info">{aviso}</Alerta>
        </div>
      )}

      {vista === "cargar" && (
        <Tarjeta>
          <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2">
            <Selector
              etiqueta={t("imp.perfil")}
              ayuda={t("imp.perfilAyuda")}
              value={perfilId}
              onChange={(e) => {
                setPerfilId(e.target.value);
                limpiar();
              }}
            >
              <option value="">—</option>
              {movimientos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </Selector>
            <Selector
              etiqueta={t("imp.destino")}
              value={ubicacionId}
              onChange={(e) => setUbicacionId(e.target.value)}
            >
              <option value="">—</option>
              {estado.ubicaciones.map((u) => {
                const alm = estado.almacenes.find((a) => a.id === u.almacenId);
                return (
                  <option key={u.id} value={u.id}>
                    {alm?.nombre} · {u.pasillo}-{u.rack}
                  </option>
                );
              })}
            </Selector>
          </div>

          <div className="mb-5 flex flex-wrap items-center gap-3">
            <input
              ref={entrada}
              type="file"
              accept=".csv,text/csv"
              disabled={!perfil}
              onChange={(e) => alElegirArchivo(e.target.files?.[0])}
              className="min-h-11 rounded-control border-2 border-borde-fuerte bg-superficie px-3 py-2 text-sm font-semibold file:mr-3 file:min-h-8 file:rounded-pildora file:border-0 file:bg-superficie-2 file:px-3 file:font-bold file:text-texto disabled:opacity-45"
              aria-label={t("imp.archivo")}
            />
            <Boton variante="suave" disabled={!perfil} onClick={descargarPlantilla}>
              {t("imp.plantilla")}
            </Boton>
          </div>

          {!analisis ? (
            <EstadoVacio icono="importacion" titulo={t("imp.sinAnalisis")} />
          ) : (
            <>
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <TarjetaKpi
                  etiqueta={t("imp.listas")}
                  valor={num(listas.length)}
                  variante="luz"
                />
                <TarjetaKpi
                  etiqueta={t("imp.duplicadas")}
                  valor={num(duplicados.length)}
                  variante="contorno"
                />
                <TarjetaKpi
                  etiqueta={t("imp.conError")}
                  valor={num(analisis.errores.length)}
                  variante="contorno"
                />
              </div>

              {duplicados.length > 0 && (
                <div className="mb-4">
                  <Alerta tono="advertencia" titulo={t("imp.duplicadas")}>
                    <ul className="mt-1 flex flex-col gap-0.5">
                      {duplicados.slice(0, 5).map((d) => (
                        <li key={`${d.linea}-${d.clave}`} className="text-xs">
                          {t("imp.linea")} {d.linea} ·{" "}
                          <span className="codigo font-bold">{d.codigo}</span> ·{" "}
                          {t("imp.duplicadaDe")}{" "}
                          <span className="font-bold">{d.archivoPrevio}</span>
                        </li>
                      ))}
                    </ul>
                  </Alerta>
                </div>
              )}

              {analisis.errores.length > 0 && (
                <div className="mb-4">
                  <Alerta tono="peligro" titulo={t("imp.conError")}>
                    <ul className="mt-1 flex flex-col gap-0.5">
                      {analisis.errores.slice(0, 5).map((e: ErrorFila) => (
                        <li key={e.linea} className="text-xs">
                          {t("imp.linea")} {e.linea} ·{" "}
                          {e.motivo === "codigo"
                            ? t("imp.errorCodigo")
                            : e.motivo === "cantidad"
                              ? t("imp.errorCantidad")
                              : t("imp.errorFecha")}
                          {e.valor && ` ("${e.valor}")`}
                        </li>
                      ))}
                    </ul>
                  </Alerta>
                </div>
              )}

              <Tabla
                columnas={columnasPrevia}
                filas={analisis.filas}
                claveFila={(f) => `${f.linea}`}
                porPagina={10}
              />

              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <Boton variante="fantasma" onClick={limpiar}>
                  {t("aj.cancelar")}
                </Boton>
                <Boton
                  variante="primario"
                  disabled={listas.length === 0 || !ubicacionId}
                  onClick={importar}
                >
                  {t("imp.importar")} ({num(listas.length)})
                </Boton>
              </div>
            </>
          )}
        </Tarjeta>
      )}

      {vista === "archivos" && (
        <Tarjeta>
          <div className="mb-4">
            <Alerta tono="info">{t("imp.reversionAviso")}</Alerta>
          </div>
          {estado.archivos.length === 0 ? (
            <EstadoVacio icono="importacion" titulo={t("imp.sinArchivos")} />
          ) : (
            <ul className="flex flex-col gap-3">
              {estado.archivos.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center gap-3 rounded-control border-2 border-borde p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="codigo truncate text-xs font-bold">{a.nombre}</p>
                    <p className="text-xs text-texto-2">
                      {a.perfilNombre} · {num(a.filasImportadas)} {t("imp.filas")}
                      {a.filasOmitidas > 0 &&
                        ` · ${num(a.filasOmitidas)} ${t("imp.omitidas")}`}
                      {" · "}
                      {new Date(a.fecha).toLocaleDateString(
                        idioma === "es" ? "es-VE" : "en-US",
                      )}
                    </p>
                  </div>
                  {a.revertido ? (
                    <Insignia tono="neutro" punto>
                      {t("imp.revertido")}
                    </Insignia>
                  ) : (
                    <Boton compacto variante="peligro" onClick={() => revertir(a)}>
                      {t("imp.revertir")}
                    </Boton>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      )}

      {vista === "conciliacion" && (
        <Tarjeta>
          <p className="mb-4 text-sm text-texto-2">{t("imp.conciliarAyuda")}</p>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => conciliarArchivo(e.target.files?.[0])}
            className="mb-5 min-h-11 rounded-control border-2 border-borde-fuerte bg-superficie px-3 py-2 text-sm font-semibold file:mr-3 file:min-h-8 file:rounded-pildora file:border-0 file:bg-superficie-2 file:px-3 file:font-bold file:text-texto"
            aria-label={t("imp.archivo")}
          />

          {difs === null ? (
            <EstadoVacio icono="importacion" titulo={t("imp.sinAnalisis")} />
          ) : difs.length === 0 ? (
            <EstadoVacio icono="reportes" titulo={t("imp.sinDiferencias")} />
          ) : (
            <Tabla
              columnas={columnasConciliacion}
              filas={difs}
              claveFila={(d) => d.codigo}
              porPagina={12}
            />
          )}
        </Tarjeta>
      )}
    </>
  );
}
