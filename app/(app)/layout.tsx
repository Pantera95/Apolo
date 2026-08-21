import type { ReactNode } from "react";

import { AppShell } from "@/components/shell/app-shell";

/**
 * El chasis de la APLICACIÓN, y solo de la aplicación.
 *
 * Estaba en el layout raíz, lo que envolvía absolutamente toda ruta con la
 * barra lateral. Con la landing eso deja de valer: una página de presentación
 * con la navegación interna encima no es una landing, es la aplicación con un
 * texto distinto.
 *
 * El grupo `(app)` no añade ningún segmento a la URL —`/inventario` sigue
 * siendo `/inventario`—, solo marca qué rutas comparten este chasis. El layout
 * raíz se queda con lo que sí es común a las dos superficies: el `html`, las
 * fuentes, el guion anti-parpadeo y el proveedor de preferencias.
 */
export default function LayoutAplicacion({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
