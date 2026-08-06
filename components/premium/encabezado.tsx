"use client";

import { Boton } from "@/components/ui/boton";
import { Selector } from "@/components/ui/campo";
import { Insignia } from "@/components/ui/insignia";
import type { Filtros, Periodo } from "@/lib/dashboard/tipos";
import { usePreferencias } from "@/lib/preferencias";
import type { Almacen, Obra } from "@/lib/dominio/tipos";

const PERIODOS: { valor: Periodo; es: string; en: string }[] = [
  { valor: "hoy", es: "Hoy", en: "Today" },
  { valor: "7d", es: "Últimos 7 días", en: "Last 7 days" },
  { valor: "30d", es: "Últimos 30 días", en: "Last 30 days" },
  { valor: "mes", es: "Mes actual", en: "This month" },
  { valor: "trimestre", es: "Trimestre", en: "Quarter" },
  { valor: "anio", es: "Año", en: "Year" },
  { valor: "personalizado", es: "Rango personalizado", en: "Custom range" },
];

/**
 * Encabezado ejecutivo.
 *
 * Los filtros mandan sobre TODO el panel, no sobre un widget. Un tablero donde
 * cada gráfica se filtra por su cuenta hace que dos números de la misma
 * pantalla hablen de periodos distintos, y a partir de ahí nadie se fía.
 */
export function EncabezadoPremium({
  filtros,
  onCambio,
  obras,
  almacenes,
  generadoEn,
  onExportar,
}: {
  filtros: Filtros;
  onCambio: (f: Filtros) => void;
  obras: Obra[];
  almacenes: Almacen[];
  generadoEn: string;
  onExportar: () => void;
}) {
  const { t, idioma } = usePreferencias();

  return (
    <header className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Insignia tono="marca">{t("premium.etiqueta")}</Insignia>
            <span className="mono text-[11px] text-texto-3">
              {t("premium.actualizado")}{" "}
              {new Date(generadoEn).toLocaleTimeString(
                idioma === "es" ? "es-VE" : "en-US",
                { hour: "2-digit", minute: "2-digit" },
              )}
            </span>
          </div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.02em] sm:text-4xl">
            {t("premium.titulo")}
          </h1>
          <p className="mt-1 text-sm text-texto-2">{t("premium.sub")}</p>
        </div>

        <Boton compacto variante="suave" onClick={onExportar}>
          {t("premium.exportar")}
        </Boton>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Selector
          etiqueta={t("premium.periodo")}
          value={filtros.periodo}
          onChange={(e) =>
            onCambio({ ...filtros, periodo: e.target.value as Periodo })
          }
        >
          {PERIODOS.map((p) => (
            <option key={p.valor} value={p.valor}>
              {idioma === "es" ? p.es : p.en}
            </option>
          ))}
        </Selector>

        <Selector
          etiqueta={t("premium.obra")}
          value={filtros.obraId ?? ""}
          onChange={(e) =>
            onCambio({ ...filtros, obraId: e.target.value || null })
          }
        >
          <option value="">{t("premium.todas")}</option>
          {obras.map((o) => (
            <option key={o.id} value={o.id}>
              {o.codigo} — {o.nombre}
            </option>
          ))}
        </Selector>

        <Selector
          etiqueta={t("premium.almacen")}
          value={filtros.almacenId ?? ""}
          onChange={(e) =>
            onCambio({ ...filtros, almacenId: e.target.value || null })
          }
        >
          <option value="">{t("premium.todos")}</option>
          {almacenes.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </Selector>
      </div>
    </header>
  );
}
