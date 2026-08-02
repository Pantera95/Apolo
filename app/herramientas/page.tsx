"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";
import { Dialogo } from "@/components/ui/dialogo";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Pestanas } from "@/components/ui/pestanas";
import { Tabla, type Columna } from "@/components/ui/tabla";
import { Tarjeta, TarjetaKpi } from "@/components/ui/tarjeta";
import { dinero, numero } from "@/lib/datos/indicadores";
import {
  DIAS_VENCIDO,
  fichasHerramienta,
  prestamosAbiertos,
  resumenHerramientas,
  type FichaHerramienta,
  type PrestamoAbierto,
} from "@/lib/datos/herramientas";
import { useEstado, useListo } from "@/lib/db/almacen";
import { registrarRetornosMultiples, type LineaRetorno } from "@/lib/db/operaciones";
import type { ClaveTexto } from "@/lib/i18n/textos";
import { usePreferencias } from "@/lib/preferencias";
import { useAhora } from "@/lib/tiempo";

type Vista = "prestamos" | "catalogo";

export default function Herramientas() {
  const { t, idioma } = usePreferencias();
  const estado = useEstado();
  const listo = useListo();
  const ahora = useAhora();

  const [vista, setVista] = useState<Vista>("prestamos");
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [devolviendo, setDevolviendo] = useState(false);

  const usd = (v: number) => dinero(v, idioma);
  const num = (v: number) => numero(v, idioma);

  const prestamos = useMemo(() => prestamosAbiertos(estado, ahora), [estado, ahora]);
  const fichas = useMemo(() => fichasHerramienta(estado, ahora), [estado, ahora]);
  const resumen = useMemo(() => resumenHerramientas(estado, ahora), [estado, ahora]);

  const elegidos = prestamos.filter((p) => seleccion.has(p.id));

  function alternar(id: string) {
    setSeleccion((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  }

  const columnasPrestamos: Columna<PrestamoAbierto>[] = [
    {
      clave: "sel",
      titulo: "",
      render: (p) => (
        <label className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center">
          <input
            type="checkbox"
            checked={seleccion.has(p.id)}
            onChange={() => alternar(p.id)}
            aria-label={`${p.articulo.codigo} · ${p.obra.codigo}`}
            className="h-5 w-5 accent-[var(--bloque-marca)]"
          />
        </label>
      ),
    },
    {
      clave: "articulo",
      titulo: t("sol.articulo"),
      ordenable: true,
      valorOrden: (p) => p.articulo.codigo,
      render: (p) => (
        <Link
          href={`/inventario/${p.articulo.id}`}
          className="flex min-h-11 min-w-0 flex-col justify-center hover:underline"
        >
          <span className="codigo text-xs font-bold text-marca">
            {p.articulo.codigo}
          </span>
          <p className="truncate text-xs text-texto-2">{p.articulo.descripcion}</p>
        </Link>
      ),
    },
    {
      clave: "obra",
      titulo: t("sol.obra"),
      ordenable: true,
      valorOrden: (p) => p.obra.codigo,
      render: (p) => (
        <Link
          href={`/obras/${p.obra.id}`}
          className="flex min-h-11 min-w-0 flex-col justify-center hover:underline"
        >
          <span className="codigo text-xs font-bold">{p.obra.codigo}</span>
          <p className="truncate text-xs text-texto-2">{p.obra.ubicacionGeografica}</p>
        </Link>
      ),
    },
    {
      clave: "unidades",
      titulo: t("obr.pendientes"),
      numerica: true,
      ordenable: true,
      valorOrden: (p) => p.unidades,
      render: (p) => (
        <span className="whitespace-nowrap font-bold">
          {num(p.unidades)}{" "}
          <span className="font-semibold text-texto-3">{p.articulo.unidadBase}</span>
        </span>
      ),
    },
    {
      clave: "dias",
      titulo: t("her.antiguedad"),
      numerica: true,
      ordenable: true,
      valorOrden: (p) => p.dias,
      render: (p) => (
        // El riesgo lleva número y etiqueta, no solo color.
        <span className="whitespace-nowrap">
          <span
            className={`font-bold ${
              p.dias > DIAS_VENCIDO
                ? "text-peligro"
                : p.dias > 30
                  ? "text-advertencia"
                  : ""
            }`}
          >
            {num(p.dias)} {t("her.dias")}
          </span>
        </span>
      ),
    },
    {
      clave: "valor",
      titulo: t("inv.valor"),
      numerica: true,
      ordenable: true,
      valorOrden: (p) => p.valorUsd,
      render: (p) => <span className="whitespace-nowrap">{usd(p.valorUsd)}</span>,
    },
  ];

  const columnasCatalogo: Columna<FichaHerramienta>[] = [
    {
      clave: "articulo",
      titulo: t("sol.articulo"),
      ordenable: true,
      valorOrden: (f) => f.articulo.codigo,
      render: (f) => (
        <Link
          href={`/inventario/${f.articulo.id}`}
          className="flex min-h-11 min-w-0 flex-col justify-center hover:underline"
        >
          <span className="codigo text-xs font-bold text-marca">
            {f.articulo.codigo}
          </span>
          <p className="truncate text-xs text-texto-2">{f.articulo.descripcion}</p>
        </Link>
      ),
    },
    {
      clave: "total",
      titulo: t("her.total"),
      numerica: true,
      ordenable: true,
      valorOrden: (f) => f.total,
      render: (f) => <span className="font-bold">{num(f.total)}</span>,
    },
    {
      clave: "enAlmacen",
      titulo: t("her.enAlmacen"),
      numerica: true,
      ordenable: true,
      valorOrden: (f) => f.enAlmacen,
      render: (f) => num(f.enAlmacen),
    },
    {
      clave: "fuera",
      titulo: t("her.fuera"),
      numerica: true,
      ordenable: true,
      valorOrden: (f) => f.fuera,
      render: (f) =>
        f.fuera > 0 ? (
          <span className="font-bold text-advertencia">{num(f.fuera)}</span>
        ) : (
          <span className="text-texto-3">—</span>
        ),
    },
    {
      clave: "averiado",
      titulo: t("her.averiadas"),
      numerica: true,
      ordenable: true,
      valorOrden: (f) => f.averiado,
      render: (f) =>
        f.averiado > 0 ? (
          <span className="font-bold text-peligro">{num(f.averiado)}</span>
        ) : (
          <span className="text-texto-3">—</span>
        ),
    },
    {
      clave: "obras",
      titulo: t("her.obras"),
      numerica: true,
      ordenable: true,
      valorOrden: (f) => f.obras,
      render: (f) =>
        f.obras > 0 ? num(f.obras) : <span className="text-texto-3">—</span>,
    },
  ];

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 pt-4">
        <div className="min-w-0">
          <h1 className="text-4xl leading-[0.95] tracking-[-0.035em] sm:text-5xl">
            {t("her.titulo")}
          </h1>
          <p className="mt-3 text-base text-texto-2">{t("her.subtitulo")}</p>
        </div>
        {vista === "prestamos" && (
          <Boton
            variante="primario"
            disabled={elegidos.length === 0}
            onClick={() => setDevolviendo(true)}
          >
            {t("her.devolver")}
            {elegidos.length > 0 && ` (${elegidos.length})`}
          </Boton>
        )}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TarjetaKpi
          etiqueta={t("her.unidadesFuera")}
          valor={num(resumen.unidadesFuera)}
          pie={`${num(resumen.obrasConDeuda)} ${t("her.obrasConDeuda")}`}
          variante="marca"
          listo={listo}
        />
        <TarjetaKpi
          etiqueta={t("her.valorFuera")}
          valor={usd(resumen.valorFuera)}
          variante="luz"
          listo={listo}
        />
        <TarjetaKpi
          etiqueta={t("her.vencidos")}
          valor={num(resumen.prestamosVencidos)}
          pie={t("her.vencidosPie")}
          variante="contorno"
          listo={listo}
        />
        <TarjetaKpi
          etiqueta={t("her.averiadas")}
          valor={num(resumen.averiadas)}
          variante="contorno"
          listo={listo}
        />
      </div>

      {resumen.prestamosVencidos > 0 && (
        <div className="mb-4">
          <Alerta tono="peligro" titulo={t("her.vencidos")}>
            {num(resumen.prestamosVencidos)} {t("her.vencidosPie").toLowerCase()}
          </Alerta>
        </div>
      )}

      <div className="mb-4">
        <Pestanas
          etiqueta={t("her.titulo")}
          valor={vista}
          onCambio={setVista}
          opciones={[
            { valor: "prestamos", texto: t("her.prestamos"), contador: prestamos.length },
            { valor: "catalogo", texto: t("her.catalogo"), contador: fichas.length },
          ]}
        />
      </div>

      <Tarjeta>
        {vista === "prestamos" ? (
          <Tabla
            columnas={columnasPrestamos}
            filas={prestamos}
            claveFila={(p) => p.id}
            porPagina={10}
            vacio={
              <EstadoVacio icono="herramientas" titulo={t("her.sinPrestamos")} />
            }
          />
        ) : (
          <Tabla
            columnas={columnasCatalogo}
            filas={fichas}
            claveFila={(f) => f.articulo.id}
            porPagina={10}
            vacio={
              <EstadoVacio icono="herramientas" titulo={t("her.sinHerramientas")} />
            }
          />
        )}
      </Tarjeta>

      {devolviendo && (
        <DialogoRetornoMultiple
          prestamos={elegidos}
          onCerrar={() => setDevolviendo(false)}
          onHecho={() => {
            setSeleccion(new Set());
            setDevolviendo(false);
          }}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

/**
 * Retorno múltiple: el caso real es el camión que vuelve con media obra
 * encima. Por defecto todo entra en buen estado y se marca lo averiado, que es
 * lo excepcional; al revés obligaría a tocar todas las filas.
 */
function DialogoRetornoMultiple({
  prestamos,
  onCerrar,
  onHecho,
}: {
  prestamos: PrestamoAbierto[];
  onCerrar: () => void;
  onHecho: () => void;
}) {
  const { t, idioma } = usePreferencias();
  const [averiadas, setAveriadas] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  function confirmar() {
    setError(null);
    const lineas: LineaRetorno[] = prestamos.map((p) => ({
      obraId: p.obra.id,
      articuloId: p.articulo.id,
      almacenId: p.almacenId,
      ubicacionId: p.ubicacionId,
      cantidad: p.unidades,
      condicion: averiadas.has(p.id) ? "averiado" : "bueno",
    }));

    const r = registrarRetornosMultiples(lineas);
    if (!r.ok) {
      setError(t(`err.${r.error.codigo}` as ClaveTexto));
      return;
    }
    onHecho();
  }

  return (
    <Dialogo
      abierto
      titulo={t("her.retornoMultiple")}
      descripcion={t("her.retornoAyuda")}
      onCerrar={onCerrar}
      pie={
        <>
          <Boton variante="fantasma" onClick={onCerrar}>
            {t("aj.cancelar")}
          </Boton>
          <Boton variante="primario" onClick={confirmar}>
            {t("her.devolverTodo")}
          </Boton>
        </>
      }
    >
      <ul className="flex flex-col gap-2">
        {prestamos.map((p) => {
          const rota = averiadas.has(p.id);
          return (
            <li
              key={p.id}
              className="flex flex-wrap items-center gap-3 rounded-control border-2 border-borde p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="codigo text-xs font-bold">{p.articulo.codigo}</p>
                <p className="truncate text-xs text-texto-2">
                  {p.obra.codigo} · {numero(p.unidades, idioma)}{" "}
                  {p.articulo.unidadBase} · {numero(p.dias, idioma)} {t("her.dias")}
                </p>
              </div>
              <Boton
                compacto
                variante={rota ? "peligro" : "suave"}
                onClick={() =>
                  setAveriadas((prev) => {
                    const s = new Set(prev);
                    if (s.has(p.id)) s.delete(p.id);
                    else s.add(p.id);
                    return s;
                  })
                }
              >
                {rota ? t("obr.averiado") : t("her.marcarAveriada")}
              </Boton>
            </li>
          );
        })}
      </ul>
      {error && <p className="mt-3 text-sm font-bold text-peligro">{error}</p>}
    </Dialogo>
  );
}
