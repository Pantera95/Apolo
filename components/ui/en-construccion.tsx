"use client";

import { EncabezadoPagina } from "./encabezado-pagina";
import { EstadoVacio } from "./estado-vacio";
import { Tarjeta } from "./tarjeta";
import { Insignia } from "./insignia";
import { usePreferencias } from "@/lib/preferencias";
import type { ClaveTexto } from "@/lib/i18n/textos";
import type { NombreIcono } from "./icono";

/**
 * Marcador de módulo pendiente.
 *
 * Existe para que la navegación del demo no lleve a un 404 — una ruta rota se
 * lee como producto roto. Dice claramente que el módulo aún no está construido
 * en vez de fingir una pantalla vacía.
 */
export function EnConstruccion({
  clave,
  icono,
  fase,
}: {
  clave: ClaveTexto;
  icono: NombreIcono;
  fase: string;
}) {
  const { t, idioma } = usePreferencias();
  const titulo = t(clave);

  return (
    <>
      <EncabezadoPagina
        titulo={titulo}
        acciones={<Insignia tono="neutro">{fase}</Insignia>}
      />
      <Tarjeta>
        <EstadoVacio
          icono={icono}
          titulo={
            idioma === "es" ? "Módulo aún no construido" : "Module not built yet"
          }
          detalle={
            idioma === "es"
              ? `"${titulo}" está planificado para la ${fase}. La navegación ya existe para poder recorrer el producto completo durante la presentación.`
              : `"${titulo}" is planned for ${fase}. Navigation already exists so the full product can be walked through during the presentation.`
          }
        />
      </Tarjeta>
    </>
  );
}
