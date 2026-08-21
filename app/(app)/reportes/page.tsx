"use client";

import { useMemo, useState } from "react";

import { Boton } from "@/components/ui/boton";
import { Campo, Selector } from "@/components/ui/campo";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Insignia } from "@/components/ui/insignia";
import { Pestanas } from "@/components/ui/pestanas";
import { Tabla, type Columna } from "@/components/ui/tabla";
import { Tarjeta } from "@/components/ui/tarjeta";
import { aCSV, BOM, nombreArchivo, type ColumnaCsv } from "@/lib/datos/csv";
import { dinero, numero } from "@/lib/datos/indicadores";
import {
  filasDespachos,
  filasDeuda,
  filasExistencia,
  filasKardex,
  type FilaDespacho,
  type FilaDeuda,
  type FilaExistencia,
  type FilaKardex,
} from "@/lib/datos/reportes";
import { useEstado } from "@/lib/db/almacen";
import type { TipoMovimiento } from "@/lib/dominio/tipos";
import type { ClaveTexto } from "@/lib/i18n/textos";
import { usePreferencias } from "@/lib/preferencias";
import { useAhora } from "@/lib/tiempo";

type Reporte = "kardex" | "existencia" | "deuda" | "despachos";

const TIPOS: TipoMovimiento[] = [
  "recepcion",
  "ajuste",
  "reserva",
  "despacho",
  "entrega",
  "retorno",
  "conteo",
  "transferencia_salida",
  "transferencia_entrada",
];

/**
 * Descarga el CSV.
 *
 * El BOM va delante del contenido para que Excel reconozca UTF-8; sin él,
 * "Rondón" se lee como "RondÃ³n".
 */
function descargar<T>(titulo: string, columnas: ColumnaCsv<T>[], filas: T[]) {
  const blob = new Blob([BOM + aCSV(columnas, filas)], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreArchivo(titulo);
  enlace.click();
  URL.revokeObjectURL(url);
}

export default function Reportes() {
  const { t, idioma } = usePreferencias();
  const estado = useEstado();
  const ahora = useAhora();

  const [reporte, setReporte] = useState<Reporte>("kardex");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [tipo, setTipo] = useState<TipoMovimiento | "todos">("todos");
  const [articuloId, setArticuloId] = useState<string>("todos");

  const usd = (v: number) => dinero(v, idioma);
  const num = (v: number) => numero(v, idioma);
  const fecha = (iso: string) =>
    iso ? new Date(iso).toLocaleDateString(idioma === "es" ? "es-VE" : "en-US") : "";

  const kardex = useMemo(
    () => filasKardex(estado, { desde, hasta, tipo, articuloId }),
    [estado, desde, hasta, tipo, articuloId],
  );
  const existencia = useMemo(() => filasExistencia(estado), [estado]);
  const deuda = useMemo(() => filasDeuda(estado, ahora), [estado, ahora]);
  const despachos = useMemo(() => filasDespachos(estado), [estado]);

  // Las mismas definiciones alimentan la tabla y el CSV: lo que se ve es lo que
  // se exporta, sin una segunda lista que se desincronice con el tiempo.
  const csvKardex: ColumnaCsv<FilaKardex>[] = [
    { clave: "fecha", titulo: t("panel.fecha"), valor: (f) => f.fecha.slice(0, 10) },
    { clave: "tipo", titulo: t("panel.movimiento"), valor: (f) => t(`mov.${f.tipo}` as ClaveTexto) },
    { clave: "codigo", titulo: t("inv.codigo"), valor: (f) => f.codigoArticulo },
    { clave: "descripcion", titulo: t("inv.descripcion"), valor: (f) => f.descripcion },
    { clave: "unidad", titulo: t("inv.unidad"), valor: (f) => f.unidad },
    { clave: "almacen", titulo: t("inv.almacen"), valor: (f) => f.almacen },
    { clave: "ubicacion", titulo: t("inv.ubicacion"), valor: (f) => f.ubicacion },
    { clave: "obra", titulo: t("sol.obra"), valor: (f) => f.obra },
    { clave: "motivo", titulo: t("aj.motivo"), valor: (f) => (f.motivo ? t(`motivo.${f.motivo}` as ClaveTexto) : "") },
    { clave: "documento", titulo: t("rep.documento"), valor: (f) => f.documento },
    { clave: "usuario", titulo: t("rep.usuario"), valor: (f) => f.usuario },
    { clave: "fisico", titulo: t("inv.fisico"), valor: (f) => f.fisico },
    { clave: "reservado", titulo: t("inv.reservado"), valor: (f) => f.reservado },
    { clave: "enObra", titulo: t("inv.enObra"), valor: (f) => f.enObra },
    { clave: "averiado", titulo: t("inv.averiado"), valor: (f) => f.averiado },
  ];

  const csvExistencia: ColumnaCsv<FilaExistencia>[] = [
    { clave: "codigo", titulo: t("inv.codigo"), valor: (f) => f.codigo },
    { clave: "descripcion", titulo: t("inv.descripcion"), valor: (f) => f.descripcion },
    { clave: "clase", titulo: t("inv.clase"), valor: (f) => t(`clase.${f.clase}` as ClaveTexto) },
    { clave: "unidad", titulo: t("inv.unidad"), valor: (f) => f.unidad },
    { clave: "almacen", titulo: t("inv.almacen"), valor: (f) => f.almacen },
    { clave: "ubicacion", titulo: t("inv.ubicacion"), valor: (f) => f.ubicacion },
    { clave: "fisico", titulo: t("inv.fisico"), valor: (f) => f.fisico },
    { clave: "reservado", titulo: t("inv.reservado"), valor: (f) => f.reservado },
    { clave: "disponible", titulo: t("inv.disponible"), valor: (f) => f.disponible },
    { clave: "enObra", titulo: t("inv.enObra"), valor: (f) => f.enObra },
    { clave: "averiado", titulo: t("inv.averiado"), valor: (f) => f.averiado },
    { clave: "costo", titulo: t("rep.costo"), valor: (f) => f.costoUnitario },
    { clave: "valor", titulo: t("inv.valor"), valor: (f) => f.valorUsd },
  ];

  const csvDeuda: ColumnaCsv<FilaDeuda>[] = [
    { clave: "obra", titulo: t("sol.obra"), valor: (f) => f.obra },
    { clave: "nombreObra", titulo: t("obr.nombre"), valor: (f) => f.nombreObra },
    { clave: "codigo", titulo: t("inv.codigo"), valor: (f) => f.codigo },
    { clave: "descripcion", titulo: t("inv.descripcion"), valor: (f) => f.descripcion },
    { clave: "unidades", titulo: t("obr.pendientes"), valor: (f) => f.unidades },
    { clave: "unidad", titulo: t("inv.unidad"), valor: (f) => f.unidad },
    { clave: "dias", titulo: t("obr.dias"), valor: (f) => f.dias },
    { clave: "valor", titulo: t("inv.valor"), valor: (f) => f.valorUsd },
  ];

  const csvDespachos: ColumnaCsv<FilaDespacho>[] = [
    { clave: "codigo", titulo: t("sol.codigo"), valor: (f) => f.codigo },
    { clave: "obra", titulo: t("sol.obra"), valor: (f) => f.obra },
    { clave: "estado", titulo: t("sol.estado"), valor: (f) => t(`des.${f.estado}` as ClaveTexto) },
    { clave: "transporte", titulo: t("des.transporte"), valor: (f) => t(`des.${f.transporte}` as ClaveTexto) },
    { clave: "responsable", titulo: t("rep.responsable"), valor: (f) => f.responsable },
    { clave: "renglones", titulo: t("sol.lineas"), valor: (f) => f.renglones },
    { clave: "unidades", titulo: t("des.unidades"), valor: (f) => f.unidades },
    { clave: "creado", titulo: t("rep.creado"), valor: (f) => f.creado.slice(0, 10) },
    { clave: "salida", titulo: t("rep.salida"), valor: (f) => f.salida.slice(0, 10) },
    { clave: "entrega", titulo: t("rep.entrega"), valor: (f) => f.entrega.slice(0, 10) },
    { clave: "receptor", titulo: t("rep.receptor"), valor: (f) => f.receptor },
    { clave: "orden", titulo: t("des.ordenReceptor"), valor: (f) => f.ordenReceptor },
    { clave: "verificada", titulo: t("rep.verificada"), valor: (f) => f.verificada },
  ];

  const cuantas =
    reporte === "kardex"
      ? kardex.length
      : reporte === "existencia"
        ? existencia.length
        : reporte === "deuda"
          ? deuda.length
          : despachos.length;

  function exportar() {
    switch (reporte) {
      case "kardex":
        return descargar(t("rep.kardex"), csvKardex, kardex);
      case "existencia":
        return descargar(t("rep.existencia"), csvExistencia, existencia);
      case "deuda":
        return descargar(t("rep.deuda"), csvDeuda, deuda);
      case "despachos":
        return descargar(t("rep.despachos"), csvDespachos, despachos);
    }
  }

  const columnasKardex: Columna<FilaKardex>[] = [
    {
      clave: "fecha",
      titulo: t("panel.fecha"),
      ordenable: true,
      valorOrden: (f) => f.fecha,
      render: (f) => (
        <span className="whitespace-nowrap text-xs text-texto-2">{fecha(f.fecha)}</span>
      ),
    },
    {
      clave: "tipo",
      titulo: t("panel.movimiento"),
      ordenable: true,
      valorOrden: (f) => f.tipo,
      render: (f) => (
        <Insignia tono="neutro" punto>
          {t(`mov.${f.tipo}` as ClaveTexto)}
        </Insignia>
      ),
    },
    {
      clave: "articulo",
      titulo: t("sol.articulo"),
      ordenable: true,
      valorOrden: (f) => f.codigoArticulo,
      render: (f) => (
        <div className="min-w-0">
          <span className="codigo text-xs font-bold">{f.codigoArticulo}</span>
          <p className="truncate text-xs text-texto-2">{f.descripcion}</p>
        </div>
      ),
    },
    {
      clave: "obra",
      titulo: t("sol.obra"),
      ordenable: true,
      valorOrden: (f) => f.obra,
      render: (f) =>
        f.obra ? (
          <span className="codigo text-xs">{f.obra}</span>
        ) : (
          <span className="text-texto-3">—</span>
        ),
    },
    {
      clave: "motivo",
      titulo: t("aj.motivo"),
      ordenable: true,
      valorOrden: (f) => f.motivo,
      render: (f) =>
        f.motivo ? (
          <span className="text-xs font-semibold text-advertencia">
            {t(`motivo.${f.motivo}` as ClaveTexto)}
          </span>
        ) : (
          <span className="text-texto-3">—</span>
        ),
    },
    {
      clave: "fisico",
      titulo: t("inv.fisico"),
      numerica: true,
      ordenable: true,
      valorOrden: (f) => f.fisico,
      render: (f) => <Delta valor={f.fisico} formato={num} />,
    },
  ];

  const columnasExistencia: Columna<FilaExistencia>[] = [
    {
      clave: "articulo",
      titulo: t("sol.articulo"),
      ordenable: true,
      valorOrden: (f) => f.codigo,
      render: (f) => (
        <div className="min-w-0">
          <span className="codigo text-xs font-bold">{f.codigo}</span>
          <p className="truncate text-xs text-texto-2">{f.descripcion}</p>
        </div>
      ),
    },
    {
      clave: "ubicacion",
      titulo: t("inv.ubicacion"),
      ordenable: true,
      valorOrden: (f) => `${f.almacen}${f.ubicacion}`,
      render: (f) => (
        <div className="min-w-0">
          <span className="text-xs">{f.almacen}</span>
          <p className="codigo text-xs text-texto-2">{f.ubicacion}</p>
        </div>
      ),
    },
    {
      clave: "disponible",
      titulo: t("inv.disponible"),
      numerica: true,
      ordenable: true,
      valorOrden: (f) => f.disponible,
      render: (f) => <span className="font-bold">{num(f.disponible)}</span>,
    },
    {
      clave: "valor",
      titulo: t("inv.valor"),
      numerica: true,
      ordenable: true,
      valorOrden: (f) => f.valorUsd,
      render: (f) => <span className="whitespace-nowrap">{usd(f.valorUsd)}</span>,
    },
  ];

  const columnasDeuda: Columna<FilaDeuda>[] = [
    {
      clave: "obra",
      titulo: t("sol.obra"),
      ordenable: true,
      valorOrden: (f) => f.obra,
      render: (f) => (
        <div className="min-w-0">
          <span className="codigo text-xs font-bold">{f.obra}</span>
          <p className="truncate text-xs text-texto-2">{f.nombreObra}</p>
        </div>
      ),
    },
    {
      clave: "articulo",
      titulo: t("sol.articulo"),
      ordenable: true,
      valorOrden: (f) => f.codigo,
      render: (f) => <span className="codigo text-xs font-bold">{f.codigo}</span>,
    },
    {
      clave: "unidades",
      titulo: t("obr.pendientes"),
      numerica: true,
      ordenable: true,
      valorOrden: (f) => f.unidades,
      render: (f) => <span className="font-bold">{num(f.unidades)}</span>,
    },
    {
      clave: "dias",
      titulo: t("obr.dias"),
      numerica: true,
      ordenable: true,
      valorOrden: (f) => f.dias,
      render: (f) => (
        <span
          className={`whitespace-nowrap font-bold ${
            f.dias > 60 ? "text-peligro" : f.dias > 30 ? "text-advertencia" : ""
          }`}
        >
          {num(f.dias)}
        </span>
      ),
    },
    {
      clave: "valor",
      titulo: t("inv.valor"),
      numerica: true,
      ordenable: true,
      valorOrden: (f) => f.valorUsd,
      render: (f) => <span className="whitespace-nowrap">{usd(f.valorUsd)}</span>,
    },
  ];

  const columnasDespachos: Columna<FilaDespacho>[] = [
    {
      clave: "codigo",
      titulo: t("sol.codigo"),
      ordenable: true,
      valorOrden: (f) => f.codigo,
      render: (f) => (
        <div className="min-w-0">
          <span className="codigo text-xs font-bold">{f.codigo}</span>
          <p className="codigo truncate text-xs text-texto-2">{f.obra}</p>
        </div>
      ),
    },
    {
      clave: "estado",
      titulo: t("sol.estado"),
      ordenable: true,
      valorOrden: (f) => f.estado,
      render: (f) => (
        <Insignia tono={f.estado === "con_discrepancia" ? "peligro" : "neutro"} punto>
          {t(`des.${f.estado}` as ClaveTexto)}
        </Insignia>
      ),
    },
    {
      clave: "responsable",
      titulo: t("rep.responsable"),
      ordenable: true,
      valorOrden: (f) => f.responsable,
      render: (f) => <span className="text-xs">{f.responsable}</span>,
    },
    {
      clave: "receptor",
      titulo: t("rep.receptor"),
      ordenable: true,
      valorOrden: (f) => f.receptor,
      render: (f) =>
        f.receptor ? (
          <span className="text-xs">{f.receptor}</span>
        ) : (
          <span className="text-texto-3">—</span>
        ),
    },
    {
      clave: "verificada",
      titulo: t("rep.verificada"),
      ordenable: true,
      valorOrden: (f) => f.verificada,
      render: (f) =>
        f.verificada === "" ? (
          <span className="text-texto-3">—</span>
        ) : (
          <Insignia tono={f.verificada === "Sí" ? "ok" : "peligro"} punto>
            {f.verificada}
          </Insignia>
        ),
    },
  ];

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 pt-4">
        <div className="min-w-0">
          <h1 className="text-4xl leading-[0.95] tracking-[-0.035em] sm:text-5xl">
            {t("rep.titulo")}
          </h1>
          <p className="mt-3 text-base text-texto-2">{t("rep.subtitulo")}</p>
        </div>
        <Boton variante="primario" disabled={cuantas === 0} onClick={exportar}>
          {t("rep.exportar")}
        </Boton>
      </div>

      <div className="mb-4">
        <Pestanas
          etiqueta={t("rep.titulo")}
          valor={reporte}
          onCambio={setReporte}
          opciones={[
            { valor: "kardex", texto: t("rep.kardex"), contador: kardex.length },
            { valor: "existencia", texto: t("rep.existencia"), contador: existencia.length },
            { valor: "deuda", texto: t("rep.deuda"), contador: deuda.length },
            { valor: "despachos", texto: t("rep.despachos"), contador: despachos.length },
          ]}
        />
      </div>

      <Tarjeta>
        {reporte === "kardex" && (
          <>
            <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4">
              <Campo
                etiqueta={t("rep.desde")}
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
              />
              <Campo
                etiqueta={t("rep.hasta")}
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
              />
              <Selector
                etiqueta={t("rep.tipo")}
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoMovimiento | "todos")}
              >
                <option value="todos">{t("rep.todosTipos")}</option>
                {TIPOS.map((x) => (
                  <option key={x} value={x}>
                    {t(`mov.${x}` as ClaveTexto)}
                  </option>
                ))}
              </Selector>
              <Selector
                etiqueta={t("sol.articulo")}
                value={articuloId}
                onChange={(e) => setArticuloId(e.target.value)}
              >
                <option value="todos">{t("rep.todosArticulos")}</option>
                {estado.articulos.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.codigo}
                  </option>
                ))}
              </Selector>
            </div>
            <Tabla
              columnas={columnasKardex}
              filas={kardex}
              claveFila={(f) => f.id}
              porPagina={12}
              vacio={<EstadoVacio icono="reportes" titulo={t("rep.sinFilas")} />}
            />
          </>
        )}

        {reporte === "existencia" && (
          <Tabla
            columnas={columnasExistencia}
            filas={existencia}
            claveFila={(f) => f.id}
            porPagina={12}
            vacio={<EstadoVacio icono="reportes" titulo={t("rep.sinFilas")} />}
          />
        )}

        {reporte === "deuda" && (
          <Tabla
            columnas={columnasDeuda}
            filas={deuda}
            claveFila={(f) => f.id}
            porPagina={12}
            vacio={<EstadoVacio icono="herramientas" titulo={t("obr.sinDeuda")} />}
          />
        )}

        {reporte === "despachos" && (
          <Tabla
            columnas={columnasDespachos}
            filas={despachos}
            claveFila={(f) => f.id}
            porPagina={12}
            vacio={<EstadoVacio icono="despacho" titulo={t("rep.sinFilas")} />}
          />
        )}

        <p className="mt-4 text-xs text-texto-3">{t("rep.nota")}</p>
      </Tarjeta>
    </>
  );
}

/** El signo se comunica con símbolo y color, nunca solo con color. */
function Delta({ valor, formato }: { valor: number; formato: (v: number) => string }) {
  if (valor === 0) return <span className="text-texto-3">—</span>;
  return (
    <span className={`font-bold ${valor > 0 ? "text-ok" : "text-peligro"}`}>
      {valor > 0 ? "+" : "−"}
      {formato(Math.abs(valor))}
    </span>
  );
}
