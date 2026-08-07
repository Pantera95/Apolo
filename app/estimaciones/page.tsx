"use client";

import { PanelEstimacion } from "@/components/estimaciones/panel-estimacion";
import { Alerta } from "@/components/ui/alerta";
import { usePremium } from "@/lib/dashboard/premium";
import { usePreferencias } from "@/lib/preferencias";

/**
 * Estimaciones — módulo propio, dentro de Almacén.
 *
 * ESTUVO DENTRO DE COMPRAS Y AHÍ ESTABA MAL. El argumento para meterlo era que
 * el cómputo termina en solicitudes de cotización, pero eso solo describe la
 * SALIDA. El trabajo es otro: se parte de un modelo de diseño, se calculan
 * cantidades, rendimientos y precios unitarios, y se decide si se oferta. Quien
 * lo hace es el departamento de estimaciones, no el de compras, y lo hace antes
 * de que exista orden alguna. Como pestaña de un listado de órdenes quedaba
 * escondido detrás de un módulo que no es el suyo.
 *
 * TODO EL MÓDULO ES PREMIUM, no una pestaña dentro de otra cosa: es la función
 * que se vende aparte, y con ruta propia eso se ve desde la barra lateral.
 */
export default function Estimaciones() {
  const { t } = usePreferencias();
  const premium = usePremium();

  return (
    <>
      <div className="mb-6 pt-4">
        <h1 className="text-4xl leading-[0.95] tracking-[-0.035em] sm:text-5xl">
          {t("est.titulo")}
        </h1>
        <p className="mt-3 text-base text-texto-2">{t("est.subtitulo")}</p>
      </div>

      {premium ? (
        <PanelEstimacion />
      ) : (
        // El módulo no se esconde: se enseña qué hace y que hace falta Premium.
        // Un elemento de menú que lleva a una pantalla en blanco parece averiado.
        <Alerta tono="info" titulo={t("est.premiumTitulo")}>
          {t("est.premiumDetalle")}
        </Alerta>
      )}
    </>
  );
}
