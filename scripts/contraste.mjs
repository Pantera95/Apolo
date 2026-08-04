import { readFileSync } from "node:fs";

const css = readFileSync("app/globals.css", "utf8") + readFileSync("app/marca.css", "utf8");

function bloque(sel) {
  const i = css.indexOf(sel);
  if (i < 0) return {};
  const a = css.indexOf("{", i), b = css.indexOf("}", a);
  const m = {};
  for (const l of css.slice(a + 1, b).split("\n")) {
    const g = l.match(/^\s*(--[\w-]+):\s*([^;]+);/);
    if (g) m[g[1]] = g[2].trim();
  }
  return m;
}

const todas = {};
for (const g of css.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)) todas[g[1]] = g[2].trim();

const claro = { ...todas, ...bloque(":root {") };
const oscuro = { ...claro, ...bloque(".dark {") };
const comun = bloque(":root,\n.dark {");
Object.assign(claro, comun);
Object.assign(oscuro, comun);

function resolver(v, tabla, prof = 0) {
  if (prof > 8 || !v) return null;
  const g = v.match(/var\((--[\w-]+)\)/);
  if (g) return resolver(tabla[g[1]] ?? todas[g[1]], tabla, prof + 1);
  const h = v.trim().match(/^#([0-9a-f]{6})$/i);
  if (!h) return null;
  const n = parseInt(h[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const lum = ([r, g, b]) => {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// [texto, fondo, minimo, descripcion]
const PARES = [
  ["--texto", "--fondo", 4.5], ["--texto", "--superficie", 4.5], ["--texto", "--superficie-2", 4.5],
  ["--texto-2", "--fondo", 4.5], ["--texto-2", "--superficie", 4.5], ["--texto-2", "--superficie-2", 4.5],
  ["--texto-3", "--fondo", 4.5], ["--texto-3", "--superficie", 4.5],
  ["--marca", "--fondo", 4.5], ["--marca", "--superficie", 4.5], ["--marca", "--marca-tenue", 4.5],
  ["--luz", "--fondo", 4.5], ["--luz", "--superficie", 4.5], ["--luz", "--luz-tenue", 4.5],
  ["--ok", "--superficie", 4.5], ["--ok", "--ok-tenue", 4.5],
  ["--advertencia", "--superficie", 4.5], ["--advertencia", "--advertencia-tenue", 4.5],
  ["--peligro", "--superficie", 4.5], ["--peligro", "--peligro-tenue", 4.5],
  ["--info", "--superficie", 4.5], ["--info", "--info-tenue", 4.5],
  // Separacion entre superficies: sin esto una tarjeta invisible pasa la
  // revision entera, que es exactamente lo que ocurrio dos veces.
  ["--borde-fuerte", "--fondo", 3], ["--borde-fuerte", "--superficie", 3], ["--borde", "--superficie", 1.4],
  ["--bloque-marca-texto", "--bloque-marca", 4.5], ["--bloque-luz-texto", "--bloque-luz", 4.5],
  ["--nav-texto", "--nav-fondo", 4.5], ["--nav-texto-activo", "--nav-fondo", 4.5],
  ["--nav-acento", "--nav-fondo", 4.5], ["--nav-texto-activo", "--nav-activo", 4.5],
  ["--texto", "--marca-tenue", 4.5],
];

let fallos = 0, total = 0;
for (const [nombre, tabla] of [["CLARO", claro], ["OSCURO", oscuro]]) {
  console.log(`\n=== TEMA ${nombre} ===`);
  const SOLO_OSCURO = [["--superficie", "--fondo", 1.45], ["--superficie-2", "--superficie", 1.15]];
  for (const [t, f, min] of [...PARES, ...(nombre === "OSCURO" ? SOLO_OSCURO : [])]) {
    const ct = resolver(tabla[t], tabla), cf = resolver(tabla[f], tabla);
    if (!ct || !cf) { console.log(`  ?  ${t} / ${f} — sin resolver`); continue; }
    const r = ratio(ct, cf);
    total++;
    const ok = r >= min;
    if (!ok) fallos++;
    if (!ok) console.log(`  ✗ ${r.toFixed(2)}:1  (min ${min})  ${t} sobre ${f}`);
  }
}
console.log(`\n${total - fallos}/${total} pares pasan. Fallos: ${fallos}`);
process.exit(fallos ? 1 : 0);
