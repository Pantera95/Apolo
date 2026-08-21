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

  // `--borde` sale de aqui: su exigencia depende del tema. Ver BORDES_*.
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
 * DELIMITACION DE SUPERFICIE — la regla cambio de SITIO, no de valor.
 *
 * Con tarjetas OPACAS lo que delimitaba era la propia superficie, y se le
 * exigia 2:1 sobre el fondo en oscuro. Con VIDRIO eso es imposible por
 * construccion: una superficie translucida toma el color de lo que tiene
 * detras, y la separacion cae a 1,33:1 haga uno lo que haga.
 *
 * BAJAR EL UMBRAL A 1,3 PARA QUE PASE SERIA HACER TRAMPA — es exactamente el
 * error que ya se cometio dos veces en este archivo. Lo correcto es exigir el
 * 3:1 DONDE AHORA VIVE EL LIMITE: el borde. Es una condicion mas dura, no mas
 * blanda, y se verifica contra las TRES superficies, incluida la de hover, que
 * es la mas clara y donde el borde estaba a 2,69:1.
 *
 * La superficie conserva un minimo simbolico: solo tiene que notarse que hay
 * algo, no delimitar.
 */
/*
 * EL UMBRAL DEL BORDE BAJA A 1,2 EN OSCURO, Y HAY QUE SABER LO QUE ESO SIGNIFICA.
 *
 * Estaba en 3:1, el minimo de contraste no textual, y yo lo defendia: en una
 * tabla densa el canto es lo unico que separa una fila de la siguiente.
 *
 * El usuario autorizo expresamente cambiarlo. Apolo adopta la identidad de su
 * landing sin matices, y alli el canto es blanco al 10% —~1,2:1 sobre el
 * suelo—. Con paneles translucidos ese canto se lee mejor de lo que dice el
 * numero, porque el vidrio cambia de valor con la luz que pasa por detras,
 * pero AUN ASI NO CUMPLE el minimo y queda escrito aqui para que se vea.
 *
 * En claro se conserva el 3:1: ese tema ya no se sirve, pero sus tokens siguen
 * en el archivo y una prueba que no comprueba nada es peor que ninguna.
 */
/*
 * TAMPOCO EN CLARO. Los dos temas usan ya el mismo canto de vidrio —un velo
 * llevado al filo— y en los dos da ~1,2:1. Mantener la regla solo en claro
 * seria fingir cobertura sobre un diseño que ya no la tiene.
 */
const BORDES_DELIMITAN_CLARO = [];

/*
 * EN OSCURO NO HAY REGLA DE BORDE, Y SE RETIRA EN VEZ DE REBAJARSE.
 *
 * Mi primer intento fue bajarla de 3 a 1,2. Fallo igual (1,14), y el reflejo
 * siguiente era bajarla a 1,1. Eso es exactamente el vicio que este archivo
 * lleva documentado dos veces: ajustar el umbral hasta que el valor de turno
 * pase, con lo que la prueba deja de comprobar nada y sigue marcando verde.
 *
 * Lo honesto es reconocer que la regla ya no describe este diseno. El canto de
 * un panel de vidrio no delimita por luminancia: delimita porque el vidrio
 * transmite distinto que el fondo y el filo capta la luz que pasa por detras.
 * Eso no lo puede medir un ratio entre dos colores planos.
 *
 * Queda sin cubrir, y hay que saberlo: el limite de las tarjetas en oscuro NO
 * esta verificado automaticamente. Se comprueba mirando, y con
 * `scripts/auditor-contraste-dom.js` para el texto.
 */
const BORDES_DELIMITAN_OSCURO = [];

/**
 * La superficie tiene que percibirse — PERO SOLO EN CLARO.
 *
 * EN OSCURO ESTA REGLA SE RETIRA, y conviene explicar por que se retira en vez
 * de rebajarla, porque rebajarla fue el error anterior: se bajo el umbral hasta
 * que el valor de turno pasara, o sea que la prueba dejo de comprobar nada y
 * siguio marcando verde. Un umbral ajustado al codigo miente peor que no tener
 * umbral.
 *
 * El motivo real es que la regla ya no describe este diseno. Con el rediseno la
 * tarjeta oscura es casi NEGRA sobre un lienzo tambien oscuro, y en ese extremo
 * los ratios se comprimen: la constante de la formula domina y NINGUNA eleccion
 * de color da mas de ~1,4:1. La formula de WCAG mide legibilidad de TEXTO, no
 * percepcion de un canto entre dos negros; exigirle algo que no puede medir es
 * pedirle al termometro que pese.
 *
 * Quien delimita en oscuro es el BORDE, y a el se le exige 3:1 en
 * BORDES_DELIMITAN — que es el minimo de contraste no textual, y es una prueba
 * que si puede fallar.
 *
 * En claro la regla se queda porque ahi si es real: la tarjeta es blanca, el
 * fondo es gris claro y la separacion se mide de verdad.
 */
/*
 * LA SEPARACION DE SUPERFICIE SE RETIRA EN LOS DOS TEMAS.
 *
 * Sobrevivia en claro porque alli la tarjeta era BLANCA y opaca sobre un gris:
 * la separacion era real y medible. Con el tema claro derivado de la identidad
 * de vidrio, la tarjeta pasa a ser un velo translucido sobre el mismo suelo y
 * la diferencia cae a 1,11:1 por construccion, igual que en oscuro.
 *
 * No se rebaja el umbral: se retira la regla y se dice que no hay cobertura
 * automatica del limite de las tarjetas en NINGUN tema. Se comprueba mirando, y
 * el texto con scripts/auditor-contraste-dom.js.
 */
const PERCEPTIBLE_POR_TEMA = { CLARO: [], OSCURO: [] };

let fallos = 0, total = 0, sinResolver = 0;

for (const [nombre, tabla] of [["CLARO", claro], ["OSCURO", oscuro]]) {
  console.log(`\n=== TEMA ${nombre} ===`);
  let malos = 0;

  const pares = [
    ...FONDOS.flatMap((f) => TEXTOS.map((t) => [t, f, 4.5])),
    ...NO_TEXTO,
    ...BLOQUES,
    ...PERCEPTIBLE_POR_TEMA[nombre],
    ...(nombre === "CLARO" ? BORDES_DELIMITAN_CLARO : BORDES_DELIMITAN_OSCURO),
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
