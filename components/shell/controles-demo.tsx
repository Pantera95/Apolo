"use client";

import { construirSemilla } from "@/lib/datos/semilla";
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

  const conDatos = estado.inventario.asientos.length > 0;

  // No se pinta nada hasta hidratar: si no, el botón parpadea al cargar.
  if (!listo) return <div className="h-11" aria-hidden="true" />;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {conDatos ? (
        <>
          <span className="text-xs font-semibold text-texto-3">
            {t("demo.ficticios")}
          </span>
          <Boton compacto variante="suave" onClick={() => reiniciarACero()}>
            {t("demo.reiniciar")}
          </Boton>
        </>
      ) : (
        <Boton
          compacto
          variante="luz"
          onClick={() => setEstado(construirSemilla())}
        >
          {t("demo.cargar")}
        </Boton>
      )}
    </div>
  );
}
