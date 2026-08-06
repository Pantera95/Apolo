"use client";

import { construirSemilla } from "@/lib/datos/semilla";
import { guardarEstados, limpiarEstados } from "@/lib/dashboard/estados-store";
import { setPremium, usePremium } from "@/lib/dashboard/premium";
import { serieFinancieraDemo } from "@/lib/dashboard/semilla-finanzas";
import { reiniciarACero, setEstado, useEstado, useListo } from "@/lib/db/almacen";
import { usePreferencias } from "@/lib/preferencias";
import { Boton } from "@/components/ui/boton";

/**
 * Conmutador de la demostración.
 *
 * Se pueden enseñar los dos estados en vivo: el sistema recién instalado
 * (todo en cero, que es lo que verá el cliente el primer día) y el sistema en
 * operación. Sin este botón habría que elegir uno de los dos y la presentación
 * pierde la mitad de la historia.
 */
export function ControlesDemo() {
  const { t } = usePreferencias();
  const estado = useEstado();
  const listo = useListo();
  const premium = usePremium();

  const conDatos = estado.inventario.asientos.length > 0;

  // No se pinta nada hasta hidratar: si no, el botón parpadea al cargar.
  if (!listo) return <div className="h-11" aria-hidden="true" />;

  return (
    <div className="flex min-w-0 items-center justify-end gap-2">
      {/*
        El Premium se enseña siempre, con datos o sin ellos: parte de lo que
        vende es precisamente cómo se comporta un panel vacío.
      */}
      <Boton
        compacto
        variante={premium ? "primario" : "suave"}
        onClick={() => setPremium(!premium)}
        aria-pressed={premium}
      >
        <span aria-hidden="true" className="mr-1.5">
          ◆
        </span>
        {premium ? t("premium.activo") : t("premium.activar")}
      </Boton>

      {conDatos ? (
        <>
          {/* El recordatorio de que son datos ficticios cede primero: en
              pantalla estrecha vale más el botón que el texto. */}
          <span className="hidden text-xs font-semibold text-texto-3 xl:inline">
            {t("demo.ficticios")}
          </span>
          <Boton
            compacto
            variante="suave"
            onClick={() => {
              reiniciarACero();
              // Reiniciar borra TODO lo ficticio, también el balance: dejarlo
              // haría que el panel enseñara ratios sobre una operación vacía.
              limpiarEstados();
            }}
          >
            {t("demo.reiniciar")}
          </Boton>
        </>
      ) : (
        <Boton
          compacto
          variante="luz"
          onClick={() => {
            setEstado(construirSemilla());
            // Los estados financieros entran CON el resto: sin ellos trece de
            // los diecisiete indicadores quedan vacíos y el panel financiero no
            // enseña nada. Se marcan como demo para que la pantalla lo diga.
            const serie = serieFinancieraDemo(Date.now());
            guardarEstados(
              serie[serie.length - 1],
              "demostración",
              serie,
              true,
            );
          }}
        >
          {t("demo.cargar")}
        </Boton>
      )}
    </div>
  );
}
