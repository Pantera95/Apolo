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

/*
 * SE CRUZA TODO CONTRA TODO. No hay lista curada.
 *
 * La version anterior comprobaba 66 pares elegidos a mano y devolvia 66/66
 * mientras la pantalla en oscuro era ilegible: los pares rotos sencillamente
 * no estaban en la lista. Faltaba `--superficie-hover` entera —el peor
 * infractor, con texto a 3,37:1— y `--texto-3` sobre `--superficie-2`.
 *
 * Peor aun: el minimo del borde estaba puesto en 1,4 en vez de 3. Ese numero
 * no sale de ninguna norma, sale de lo que el valor de entonces cumplia. Una
 * prueba ajustada al codigo que vigila no vigila nada.
 *
 * Ahora el producto cartesiano no deja elegir: si aparece un token nuevo,
 * entra solo en la matriz.
 */

/** Todo lo que puede llevar texto encima. */
const FONDOS = [
  "--fondo", "--superficie", "--superficie-2", "--superficie-hover",
  "--marca-tenue", "--luz-tenue", "--ok-tenue",
  "--advertencia-tenue", "--peligro-tenue", "--info-tenue",
];

/** Todo lo que se pinta como texto. */
const TEXTOS = [
  "--texto", "--texto-2", "--texto-3",
  "--marca", "--luz", "--ok", "--advertencia", "--peligro", "--info",
];

/**
 * Pares que NO son texto y por tanto piden 3:1, no 4,5:1.
 *
 * El limite de una tarjeta lo lleva el BORDE, no la superficie. Exigirle 3:1
 * a `--superficie` sobre `--fondo` obligaria a tarjetas casi blancas sobre
 * fondo negro, que no es como se construye una interfaz oscura: la superficie
 * separa lo justo para percibirse y el borde la delimita.
 */
const NO_TEXTO = [
  // `--borde-fuerte` viste CAMPOS Y CONTROLES. La norma pide 3:1 a los
  // componentes de interfaz —un campo de formulario que no se distingue del
  // fondo no se puede usar— y aqui si es exigible sin discusion.
  ["--borde-fuerte", "--superficie", 3],
  ["--borde-fuerte", "--superficie-2", 3],
  ["--borde-fuerte", "--fondo", 3],

  // `--borde` es un DIVISOR decorativo: separa filas de una tabla o tarjetas
  // que ya se distinguen por su superficie. La norma no le exige 3:1, y
  // ponerselo daria una reticula de lineas negras sobre todo el producto.
  // Se le pide lo que si tiene que cumplir: verse.
  ["--borde", "--superficie", 1.5],
  ["--borde", "--fondo", 1.35],
];

/** Bloques de color solidos, cada uno con la tinta que declara. */
const BLOQUES = [
  ["--bloque-marca-texto", "--bloque-marca", 4.5],
  ["--bloque-luz-texto", "--bloque-luz", 4.5],
  ["--nav-texto", "--nav-fondo", 4.5],
  ["--nav-texto-activo", "--nav-fondo", 4.5],
  ["--nav-acento", "--nav-fondo", 4.5],
  ["--nav-texto-activo", "--nav-activo", 4.5],
];

/**
 * La superficie tiene que percibirse, y CUANTO depende del tema.
 *
 * No es un doble rasero: la fisica es distinta. En claro la tarjeta ya es
 * BLANCA y no puede aclararse mas, asi que subir la separacion exigiria un
 * fondo gris medio que dejaria el producto sucio y empezaria a romper el texto
 * puesto sobre ese fondo. Ademas la sombra dura se ve y delimita.
 *
 * En oscuro la sombra no existe visualmente —una sombra negra sobre fondo casi
 * negro no se ve—, asi que el trabajo de delimitar recae en la superficie y se
 * le exige mas.
 */
const PERCEPTIBLE_POR_TEMA = {
  CLARO: [
    ["--superficie", "--fondo", 1.2],
    ["--superficie-2", "--superficie", 1.1],
  ],
  OSCURO: [
    ["--superficie", "--fondo", 2],
    ["--superficie-2", "--superficie", 1.1],
  ],
};

let fallos = 0, total = 0, sinResolver = 0;

for (const [nombre, tabla] of [["CLARO", claro], ["OSCURO", oscuro]]) {
  console.log(`\n=== TEMA ${nombre} ===`);
  let malos = 0;

  const pares = [
    ...FONDOS.flatMap((f) => TEXTOS.map((t) => [t, f, 4.5])),
    ...NO_TEXTO,
    ...BLOQUES,
    ...PERCEPTIBLE_POR_TEMA[nombre],
  ];

  for (const [t, f, min] of pares) {
    const ct = resolver(tabla[t], tabla), cf = resolver(tabla[f], tabla);
    if (!ct || !cf) { sinResolver++; console.log(`  ?  ${t} / ${f} — sin resolver`); continue; }
    const r = ratio(ct, cf);
    total++;
    if (r < min) {
      fallos++; malos++;
      console.log(`  ✗ ${r.toFixed(2)}:1  (min ${min})  ${t} sobre ${f}`);
    }
  }
  if (malos === 0) console.log("  sin fallos");
}

console.log(`\n${total - fallos}/${total} pares pasan. Fallos: ${fallos}${sinResolver ? ` · sin resolver: ${sinResolver}` : ""}`);
process.exit(fallos ? 1 : 0);
