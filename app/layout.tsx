import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Manrope } from "next/font/google";
import Script from "next/script";

import { AppShell } from "@/components/shell/app-shell";
import { ProveedorPreferencias } from "@/lib/preferencias";
import "./globals.css";

/** Manrope para todo el texto; JetBrains Mono para códigos, series y coladas. */
const manrope = Manrope({
  subsets: ["latin"],
  variable: "--fuente-sans",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--fuente-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Apolo — Control de almacén y obra",
  description:
    "Inventario, obras, despacho y trazabilidad de herramienta para operaciones de construcción industrial.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6fa" },
    { media: "(prefers-color-scheme: dark)", color: "#101016" },
  ],
};

/**
 * Aplica el tema guardado ANTES del primer pintado. Sin esto, quien tenga el
 * tema oscuro ve un destello blanco en cada carga.
 */
const SIN_PARPADEO = `
try {
  var t = localStorage.getItem("apolo:tema");
  if (t === "oscuro") document.documentElement.classList.add("dark");
  var i = localStorage.getItem("apolo:idioma");
  if (i === "en" || i === "es") document.documentElement.lang = i;
} catch (e) {}
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className="h-full" suppressHydrationWarning>
      <body className={`${manrope.variable} ${jetbrains.variable} min-h-full`}>
        {/* beforeInteractive lo inyecta el servidor en el HTML inicial, así que
            corre antes de la hidratación. Un <script> suelto también acaba en
            el HTML, pero React 19 avisa de que nunca se ejecutaría en un
            render de cliente. */}
        <Script id="apolo-tema" strategy="beforeInteractive">
          {SIN_PARPADEO}
        </Script>
        <ProveedorPreferencias>
          <AppShell>{children}</AppShell>
        </ProveedorPreferencias>
      </body>
    </html>
  );
}
