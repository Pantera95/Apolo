"use client";

import { useState } from "react";

import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";
import { Campo, Selector } from "@/components/ui/campo";
import { Dialogo } from "@/components/ui/dialogo";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Insignia, type TonoInsignia } from "@/components/ui/insignia";
import { Pestanas } from "@/components/ui/pestanas";
import { Tabla, type Columna } from "@/components/ui/tabla";
import { Tarjeta, TarjetaKpi } from "@/components/ui/tarjeta";
import { dinero, numero } from "@/lib/datos/indicadores";
import { useEstado, useListo } from "@/lib/db/almacen";
import { cambiarEstadoOrden, recibirLineaCompra } from "@/lib/db/operaciones";
import {
  diasDeAtraso,
  estaAbierta,
  pendientePorRecibir,
  totalOrden,
  totalRecibido,
  type EstadoOrden,
  type OrdenCompra,
  type Proveedor,
} from "@/lib/dominio/compras";
import type { ClaveTexto } from "@/lib/i18n/textos";
import { usePreferencias } from "@/lib/preferencias";
import { useAhora } from "@/lib/tiempo";

type Vista = "ordenes" | "proveedores";

function tonoOrden(estado: EstadoOrden): TonoInsignia {
  switch (estado) {
    case "enviada":
      return "info";
    case "parcial":
      return "advertencia";
    case "recibida":
      return "ok";
    case "cancelada":
      return "peligro";
    default:
      return "neutro";
  }
}

export default function Compras() {
  const { t, idioma } = usePreferencias();
  const estado = useEstado();
  const listo = useListo();
  const ahora = useAhora();

  const [vista, setVista] = useState<Vista>("ordenes");
  const [recibiendo, setRecibiendo] = useState<OrdenCompra | null>(null);
  const [error, setError] = useState<string | null>(null);

  const usd = (v: number) => dinero(v, idioma);
  const num = (v: number) => numero(v, idioma);
  const fecha = (iso: string) =>
    new Date(iso).toLocaleDateString(idioma === "es" ? "es-VE" : "en-US");

  const proveedores = new Map(estado.proveedores.map((p) => [p.id, p]));

  const abiertas = estado.ordenes.filter(estaAbierta);
  const atrasadas = abiertas.filter((o) => diasDeAtraso(o, ahora) > 0);
  const porLlegar = abiertas.reduce(
    (s, o) =>
      s +
      o.lineas.reduce(
        (x, l) => x + pendientePorRecibir(l) * l.costoUnitarioUsd,
        0,
      ),
    0,
  );

  // La orden viva del diálogo: tras recibir una línea hay que refrescarla.
  const recibiendoVivo = recibiendo
    ? (estado.ordenes.find((o) => o.id === recibiendo.id) ?? null)
    : null;

  function mover(orden: OrdenCompra, hasta: EstadoOrden) {
    setError(null);
    const r = cambiarEstadoOrden(orden.id, hasta);
    if (!r.ok) setError(t(`err.${r.error.codigo}` as ClaveTexto));
  }

  const columnasOrdenes: Columna<OrdenCompra>[] = [
    {
      clave: "codigo",
      titulo: t("com.codigo"),
      ordenable: true,
      valorOrden: (o) => o.codigo,
      render: (o) => (
        <div className="min-w-0">
          <span className="codigo text-xs font-bold">{o.codigo}</span>
          <p className="truncate text-xs text-texto-2">
            {proveedores.get(o.proveedorId)?.nombre}
          </p>
        </div>
      ),
    },
    {
      clave: "estado",
      titulo: t("com.estado"),
      ordenable: true,
      valorOrden: (o) => o.estado,
      render: (o) => {
        const atraso = diasDeAtraso(o, ahora);
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            <Insignia tono={tonoOrden(o.estado)} punto>
              {t(`com.${o.estado}` as ClaveTexto)}
            </Insignia>
            {atraso > 0 && (
              <Insignia tono="peligro" punto>
                {t("com.atrasada")} {num(atraso)} {t("com.dias")}
              </Insignia>
            )}
          </div>
        );
      },
    },
    {
      clave: "esperada",
      titulo: t("com.esperada"),
      numerica: true,
      ordenable: true,
      valorOrden: (o) => o.fechaEsperada,
      render: (o) => (
        <span className="whitespace-nowrap text-xs text-texto-2">
          {fecha(o.fechaEsperada)}
        </span>
      ),
    },
    {
      clave: "recibido",
      titulo: t("com.recibido"),
      numerica: true,
      ordenable: true,
      valorOrden: (o) => (totalOrden(o) > 0 ? totalRecibido(o) / totalOrden(o) : 0),
      render: (o) => {
        const total = totalOrden(o);
        const pct = total > 0 ? Math.round((totalRecibido(o) / total) * 100) : 0;
        return (
          // El avance lleva número además de la barra: una barra sola no se
          // puede leer de un vistazo ni imprimir en blanco y negro.
          <div className="flex items-center justify-end gap-2">
            <span className="cifra text-xs font-bold">{pct}%</span>
            <span
              aria-hidden="true"
              className="h-1.5 w-14 overflow-hidden rounded-pildora bg-superficie-2"
            >
              <span
                className="block h-full rounded-pildora bg-marca"
                style={{ width: `${pct}%` }}
              />
            </span>
          </div>
        );
      },
    },
    {
      clave: "total",
      titulo: t("com.total"),
      numerica: true,
      ordenable: true,
      valorOrden: (o) => totalOrden(o),
      render: (o) => (
        <span className="whitespace-nowrap font-bold">{usd(totalOrden(o))}</span>
      ),
    },
    {
      clave: "acciones",
      titulo: "",
      render: (o) => (
        <div className="flex flex-wrap justify-end gap-2">
          {o.estado === "borrador" && (
            <Boton compacto variante="luz" onClick={() => mover(o, "enviada")}>
              {t("com.enviar")}
            </Boton>
          )}
          {estaAbierta(o) && (
            <Boton compacto variante="primario" onClick={() => setRecibiendo(o)}>
              {t("com.recibir")}
            </Boton>
          )}
          {(o.estado === "recibida" || o.estado === "cancelada") && (
            <span className="text-texto-3">—</span>
          )}
        </div>
      ),
    },
  ];

  const columnasProveedores: Columna<Proveedor>[] = [
    {
      clave: "nombre",
      titulo: t("com.proveedor"),
      ordenable: true,
      valorOrden: (p) => p.nombre,
      render: (p) => (
        <div className="min-w-0">
          <span className="text-xs font-bold">{p.nombre}</span>
          <p className="truncate text-xs text-texto-2">{p.contacto}</p>
        </div>
      ),
    },
    {
      clave: "telefono",
      titulo: t("com.telefono"),
      render: (p) =>
        p.telefono ? (
          <span className="codigo text-xs">{p.telefono}</span>
        ) : (
          <span className="text-texto-3">—</span>
        ),
    },
    {
      clave: "lead",
      titulo: t("com.leadTime"),
      numerica: true,
      ordenable: true,
      valorOrden: (p) => p.leadTimeDias,
      render: (p) => (
        <span className="whitespace-nowrap">
          {num(p.leadTimeDias)} {t("com.dias")}
        </span>
      ),
    },
    {
      clave: "ordenes",
      titulo: t("com.ordenesDe"),
      numerica: true,
      ordenable: true,
      valorOrden: (p) => estado.ordenes.filter((o) => o.proveedorId === p.id).length,
      render: (p) => num(estado.ordenes.filter((o) => o.proveedorId === p.id).length),
    },
  ];

  return (
    <>
      <div className="mb-6 pt-4">
        <h1 className="text-4xl leading-[0.95] tracking-[-0.035em] sm:text-5xl">
          {t("com.titulo")}
        </h1>
        <p className="mt-3 text-base text-texto-2">{t("com.subtitulo")}</p>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TarjetaKpi
          etiqueta={t("com.porLlegar")}
          valor={usd(porLlegar)}
          pie={`${num(abiertas.length)} ${t("com.abiertas").toLowerCase()}`}
          variante="marca"
          listo={listo}
        />
        <TarjetaKpi
          etiqueta={t("com.atrasadas")}
          valor={num(atrasadas.length)}
          variante={atrasadas.length > 0 ? "luz" : "contorno"}
          listo={listo}
        />
        <TarjetaKpi
          etiqueta={t("com.proveedores")}
          valor={num(estado.proveedores.length)}
          variante="contorno"
          listo={listo}
        />
      </div>

      {atrasadas.length > 0 && (
        <div className="mb-4">
          <Alerta tono="advertencia" titulo={t("com.atrasadas")}>
            {atrasadas
              .map((o) => `${o.codigo} (${num(diasDeAtraso(o, ahora))} ${t("com.dias")})`)
              .join(" · ")}
          </Alerta>
        </div>
      )}

      {error && (
        <div className="mb-4">
          <Alerta tono="peligro">{error}</Alerta>
        </div>
      )}

      <div className="mb-4">
        <Pestanas
          etiqueta={t("com.titulo")}
          valor={vista}
          onCambio={setVista}
          opciones={[
            { valor: "ordenes", texto: t("com.ordenes"), contador: estado.ordenes.length },
            {
              valor: "proveedores",
              texto: t("com.proveedores"),
              contador: estado.proveedores.length,
            },
          ]}
        />
      </div>

      <Tarjeta>
        {vista === "ordenes" ? (
          <Tabla
            columnas={columnasOrdenes}
            filas={estado.ordenes}
            claveFila={(o) => o.id}
            porPagina={10}
            vacio={<EstadoVacio icono="compras" titulo={t("com.sinOrdenes")} />}
          />
        ) : (
          <Tabla
            columnas={columnasProveedores}
            filas={estado.proveedores}
            claveFila={(p) => p.id}
            porPagina={10}
            vacio={<EstadoVacio icono="compras" titulo={t("com.sinProveedores")} />}
          />
        )}
      </Tarjeta>

      {recibiendoVivo && (
        <DialogoRecepcion
          orden={recibiendoVivo}
          onCerrar={() => setRecibiendo(null)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

function DialogoRecepcion({
  orden,
  onCerrar,
}: {
  orden: OrdenCompra;
  onCerrar: () => void;
}) {
  const { t, idioma } = usePreferencias();
  const estado = useEstado();
  const [ubicacionId, setUbicacionId] = useState("");
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const articulos = new Map(estado.articulos.map((a) => [a.id, a]));
  const num = (v: number) => numero(v, idioma);
  const usd = (v: number) => dinero(v, idioma);

  function recibir(articuloId: string, pendiente: number) {
    setError(null);
    const cruda = cantidades[articuloId] ?? "";
    const cantidad = cruda.trim() === "" ? pendiente : Number(cruda.replace(",", "."));

    const r = recibirLineaCompra(orden.id, articuloId, cantidad, ubicacionId);
    if (!r.ok) {
      setError(t(`err.${r.error.codigo}` as ClaveTexto));
      return;
    }
    setCantidades((prev) => ({ ...prev, [articuloId]: "" }));
  }

  return (
    <Dialogo
      abierto
      titulo={`${t("com.recepcionTitulo")} · ${orden.codigo}`}
      descripcion={t("com.recepcionAyuda")}
      onCerrar={onCerrar}
      pie={
        <Boton variante="suave" onClick={onCerrar}>
          {t("aj.cancelar")}
        </Boton>
      }
    >
      <div className="flex flex-col gap-4">
        <Selector
          etiqueta={t("com.destino")}
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

        <ul className="flex flex-col gap-3">
          {orden.lineas.map((linea) => {
            const articulo = articulos.get(linea.articuloId);
            const pendiente = pendientePorRecibir(linea);
            return (
              <li
                key={linea.articuloId}
                className="rounded-control border-2 border-borde p-3"
              >
                <div className="mb-2 min-w-0">
                  <span className="codigo text-xs font-bold">{articulo?.codigo}</span>
                  <p className="truncate text-xs text-texto-2">
                    {articulo?.descripcion}
                  </p>
                  <p className="mt-1 text-xs text-texto-3">
                    {num(linea.cantidadRecibida)} / {num(linea.cantidadPedida)}{" "}
                    {articulo?.unidadBase} · {t("com.costoUnitario")}{" "}
                    {usd(linea.costoUnitarioUsd)}
                  </p>
                </div>

                {pendiente === 0 ? (
                  <Insignia tono="ok" punto>
                    {t("com.recibida")}
                  </Insignia>
                ) : (
                  <div className="flex flex-wrap items-end gap-2">
                    <Campo
                      etiqueta={t("com.cantidadRecibir")}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={pendiente}
                      step="any"
                      placeholder={String(pendiente)}
                      value={cantidades[linea.articuloId] ?? ""}
                      onChange={(e) =>
                        setCantidades((prev) => ({
                          ...prev,
                          [linea.articuloId]: e.target.value,
                        }))
                      }
                      className="flex-1"
                    />
                    <Boton
                      variante="primario"
                      disabled={!ubicacionId}
                      onClick={() => recibir(linea.articuloId, pendiente)}
                    >
                      {t("com.registrar")}
                    </Boton>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <p className="text-xs text-texto-3">{t("com.recepcionAviso")}</p>
        {error && <p className="text-sm font-bold text-peligro">{error}</p>}
      </div>
    </Dialogo>
  );
}
