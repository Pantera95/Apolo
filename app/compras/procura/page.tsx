"use client";

import Link from "next/link";

import { TableroProcura } from "@/components/procura/tablero";
import { Alerta } from "@/components/ui/alerta";
import { usePremium } from "@/lib/dashboard/premium";
import { usePreferencias } from "@/lib/preferencias";

/**
 * Procura Dashboard — Premium, dentro de Compras.
 *
 * Va bajo `/compras` y no en una ruta suelta porque es el mismo trabajo que
 * Compras, una etapa antes: Compras lleva las órdenes ya emitidas y su
 * recepción; Procura lleva cómo se decidió a quién comprarle.
 *
 * EL BLOQUEO PREMIUM NO ES SEGURIDAD, y conviene decirlo sin rodeos: Apolo no
 * tiene autenticación todavía, así que `usePremium()` es un conmutador que vive
 * en el navegador de quien mira la demostración. Un middleware que leyera ese
 * mismo conmutador daría apariencia de control de acceso sin serlo, que es peor
 * que no tenerlo. Cuando entre la sesión de servidor, el guard va ahí.
 */
export default function Procura() {
  const { t } = usePreferencias();
  const premium = usePremium();

  return (
    <>
      <div className="mb-6 pt-4">
        <nav className="mb-2 text-xs text-texto-3">
          <Link href="/compras" className="hover:text-marca">
            {t("nav.compras")}
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-texto-2">{t("proc.titulo")}</span>
        </nav>
        <h1 className="text-4xl leading-[0.95] tracking-[-0.035em] sm:text-5xl">
          {t("proc.titulo")}
        </h1>
        <p className="mt-3 text-base text-texto-2">{t("proc.subtitulo")}</p>
      </div>

      {premium ? (
        <TableroProcura />
      ) : (
        <Alerta tono="info" titulo={t("proc.premiumTitulo")}>
          {t("proc.premiumDetalle")}
        </Alerta>
      )}
    </>
  );
}
