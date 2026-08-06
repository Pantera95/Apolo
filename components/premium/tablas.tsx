"use client";

import Link from "next/link";

import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Insignia, type TonoInsignia } from "@/components/ui/insignia";
import { Tabla, type Columna } from "@/components/ui/tabla";
import type {
  Alerta,
  FilaObraCritica,
  FilaStockCritico,
  Severidad,
} from "@/lib/dashboard/tipos";
import { dinero, numero } from "@/lib/datos/indicadores";
import { usePreferencias } from "@/lib/preferencias";

const TONO: Record<Severidad, TonoInsignia> = {
  critica: "peligro",
  alta: "advertencia",
  advertencia: "info",
  informativa: "neutro",
};

const ETIQUETA: Record<Severidad, { es: string; en: string }> = {
  critica: { es: "Crítica", en: "Critical" },
  alta: { es: "Alta", en: "High" },
  advertencia: { es: "Media", en: "Medium" },
  informativa: { es: "Info", en: "Info" },
};

/**
 * Centro de alertas.
 *
 * Cada fila termina en un enlace al módulo donde se resuelve. Una alerta que
 * solo informa obliga a buscar dónde actuar, y en ese salto se pierde la mitad
 * de ellas.
 */
export function TablaAlertas({ alertas }: { alertas: Alerta[] }) {
  const { t, idioma } = usePreferencias();

  if (alertas.length === 0) {
    return (
      <Marco titulo={t("premium.alertas")}>
        <EstadoVacio icono="reportes" titulo={t("premium.sinAlertas")} />
      </Marco>
    );
  }

  const columnas: Columna<Alerta>[] = [
    {
      clave: "severidad",
      titulo: t("premium.severidad"),
      render: (a) => (
        <Insignia tono={TONO[a.severidad]} punto>
          {ETIQUETA[a.severidad][idioma]}
        </Insignia>
      ),
    },
    {
      clave: "titulo",
      titulo: "—",
      render: (a) => (
        <div className="min-w-0">
          <p className="text-xs font-bold">{a.titulo}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-texto-3">{a.detalle}</p>
        </div>
      ),
    },
    {
      clave: "accion",
      titulo: t("premium.accion"),
      render: (a) => (
        <Link
          href={a.enlace}
          className="inline-flex min-h-11 items-center whitespace-nowrap text-xs font-bold text-marca hover:underline"
        >
          {a.accion} →
        </Link>
      ),
    },
  ];

  return (
    <Marco titulo={`${t("premium.alertas")} (${alertas.length})`}>
      <Tabla columnas={columnas} filas={alertas} claveFila={(a) => a.id} />
    </Marco>
  );
}

export function TablaObrasCriticas({ filas }: { filas: FilaObraCritica[] }) {
  const { t, idioma } = usePreferencias();

  if (filas.length === 0) {
    return (
      <Marco titulo={t("premium.obrasCriticas")}>
        <EstadoVacio icono="obras" titulo={t("premium.sinAlertas")} />
      </Marco>
    );
  }

  const columnas: Columna<FilaObraCritica>[] = [
    {
      clave: "obra",
      titulo: t("premium.obra"),
      ordenable: true,
      valorOrden: (o) => o.codigo,
      render: (o) => (
        <Link href={`/obras/${o.obraId}`} className="min-w-0 hover:underline">
          <span className="codigo text-xs font-bold">{o.codigo}</span>
          <p className="truncate text-xs text-texto-2">{o.nombre}</p>
        </Link>
      ),
    },
    {
      clave: "avance",
      titulo: t("premium.avanceMaterial"),
      numerica: true,
      ordenable: true,
      valorOrden: (o) => o.avanceMaterial ?? -1,
      render: (o) =>
        o.avanceMaterial === null ? (
          <span className="text-xs text-texto-3">{t("premium.sinDatos")}</span>
        ) : (
          <Avance fraccion={o.avanceMaterial} idioma={idioma} />
        ),
    },
    {
      clave: "bloqueadas",
      titulo: "⏸",
      numerica: true,
      ordenable: true,
      valorOrden: (o) => o.solicitudesBloqueadas,
      render: (o) => numero(o.solicitudesBloqueadas, idioma),
    },
    {
      clave: "criticos",
      titulo: "⚠",
      numerica: true,
      ordenable: true,
      valorOrden: (o) => o.materialesCriticos,
      render: (o) => numero(o.materialesCriticos, idioma),
    },
    {
      clave: "valor",
      titulo: t("premium.obra"),
      numerica: true,
      ordenable: true,
      valorOrden: (o) => o.valorEnObraUsd,
      render: (o) => (
        <span className="whitespace-nowrap font-bold">{dinero(o.valorEnObraUsd, idioma)}</span>
      ),
    },
  ];

  return (
    <Marco titulo={t("premium.obrasCriticas")}>
      <Tabla columnas={columnas} filas={filas} claveFila={(o) => o.obraId} />
    </Marco>
  );
}

export function TablaStockCritico({ filas }: { filas: FilaStockCritico[] }) {
  const { t, idioma } = usePreferencias();

  if (filas.length === 0) {
    return (
      <Marco titulo={t("premium.stockCritico")}>
        <EstadoVacio icono="inventario" titulo={t("premium.sinAlertas")} />
      </Marco>
    );
  }

  const columnas: Columna<FilaStockCritico>[] = [
    {
      clave: "articulo",
      titulo: "—",
      ordenable: true,
      valorOrden: (a) => a.codigo,
      render: (a) => (
        <Link href={`/inventario/${a.articuloId}`} className="min-w-0 hover:underline">
          <span className="codigo text-xs font-bold">{a.codigo}</span>
          <p className="truncate text-xs text-texto-2">{a.descripcion}</p>
        </Link>
      ),
    },
    {
      clave: "disponible",
      titulo: t("premium.stockCritico"),
      numerica: true,
      ordenable: true,
      valorOrden: (a) => a.disponible,
      render: (a) => numero(Math.round(a.disponible), idioma),
    },
    {
      clave: "cobertura",
      titulo: t("premium.cobertura"),
      numerica: true,
      ordenable: true,
      valorOrden: (a) => a.cobertura ?? 9999,
      render: (a) =>
        a.cobertura === null ? (
          <span className="text-xs text-texto-3">{t("premium.sinDatos")}</span>
        ) : (
          <Insignia tono={a.cobertura < 3 ? "peligro" : "advertencia"}>
            {numero(Math.floor(a.cobertura), idioma)} {t("premium.dias")}
          </Insignia>
        ),
    },
  ];

  return (
    <Marco titulo={t("premium.stockCritico")}>
      <Tabla columnas={columnas} filas={filas} claveFila={(a) => a.articuloId} />
    </Marco>
  );
}

/** Barra de avance con el número al lado: una barra sola no se puede leer. */
function Avance({ fraccion, idioma }: { fraccion: number; idioma: "es" | "en" }) {
  const pct = Math.round(Math.min(1, Math.max(0, fraccion)) * 100);
  return (
    <div className="flex items-center justify-end gap-2">
      <span className="cifra text-xs font-bold">{numero(pct, idioma)}%</span>
      <span
        aria-hidden="true"
        className="h-1.5 w-16 overflow-hidden rounded-pildora bg-superficie-2"
      >
        <span
          className="block h-full rounded-pildora bg-marca"
          style={{ width: `${pct}%` }}
        />
      </span>
    </div>
  );
}

function Marco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-tarjeta border border-borde-fuerte bg-superficie p-4">
      <h2 className="text-sm font-extrabold uppercase tracking-[0.06em]">{titulo}</h2>
      <div className="mt-4 min-w-0">{children}</div>
    </section>
  );
}
