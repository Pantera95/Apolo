/*
 * AUDITOR DE CONTRASTE SOBRE EL DOM REAL.
 *
 * Complementa a `scripts/contraste.mjs`, NO lo sustituye. Los dos hacen falta
 * porque miden cosas distintas:
 *
 *   contraste.mjs        compara PARES DE TOKENS leyendo el CSS. Corre en CI,
 *                        no necesita navegador y es la red de seguridad barata.
 *   este archivo         recorre cada nodo de texto pintado, compone el fondo
 *                        efectivo capa por capa y mide lo que el ojo ve.
 *
 * POR QUÉ HIZO FALTA EL SEGUNDO. La barra de navegación quedó con texto a
 * 2,19:1 en tema claro y `contraste.mjs` seguía dando 210/210. El fallo no
 * estaba en ningún par: `.caja-nav` había pasado a usar `--superficie`, que es
 * blanco en claro, mientras su texto seguía siendo `--nav-texto`, un gris
 * calibrado contra chasis oscuro. Los dos tokens eran correctos; el error era
 * cuál pintaba qué superficie. Un par de tokens no puede detectar eso.
 *
 * CÓMO SE USA
 *
 *   1. Abre la aplicación en el navegador (`npm run dev`).
 *   2. Pega este archivo entero en la consola de las herramientas de desarrollo.
 *   3. Llama a `auditarContraste()` — devuelve los fallos del tema actual.
 *      Para los dos temas de una vez: `auditarContraste({ ambosTemas: true })`.
 *
 * Hay que repetirlo por RUTA: solo puede medir lo que está pintado en pantalla.
 *
 * AUTOMATIZARLO exige un navegador de verdad (Playwright o similar). No se
 * añadió la dependencia para no meter ~300 MB en el proyecto por una
 * comprobación que hoy se corre a mano antes de publicar.
 */

(() => {
  /* ---------------------------------------------------------------------
   * oklab -> sRGB, a mano.
   *
   * NO SE PUEDE DELEGAR EN CANVAS. Tailwind v4 emite `oklab(...)` para las
   * opacidades (`text-nav-texto/60`), y `canvas.fillStyle` no lo entiende: al
   * asignarlo conserva EN SILENCIO el valor anterior. Midiendo así, un rótulo
   * que estaba en 3,83:1 salía como 1,02:1 — el color leído era negro, no el
   * real. Toda la primera tanda de "fallos" fue eso.
   * ------------------------------------------------------------------- */
  const gamma = (v) =>
    v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;

  function oklabASrgb(L, a, b) {
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ].map((v) => Math.max(0, Math.min(255, Math.round(gamma(v) * 255))));
  }

  const lienzo = document
    .createElement("canvas")
    .getContext("2d", { willReadFrequently: true });

  /**
   * Alfa POR CADENA, nunca por canvas.
   *
   * Cuando el canvas no entendía un valor devolvía alfa 0, el recorrido lo
   * tomaba por transparente y seguía subiendo hasta quedarse sin ancestros: el
   * fondo salía blanco por defecto, en pleno tema oscuro. Media docena de
   * fallos fantasma venían de ahí.
   */
  function alfaDe(css) {
    if (!css || css === "transparent") return 0;
    const conBarra = css.match(/\/\s*([\d.]+)\s*\)/);
    if (conBarra) return Number(conBarra[1]);
    const rgb = css.match(/^rgba?\(([^)]+)\)/);
    if (rgb) {
      const n = rgb[1].split(/[,\s/]+/).filter(Boolean).map(Number);
      return n.length > 3 ? n[3] : 1;
    }
    return 1;
  }

  function rgbDe(css) {
    const ok = css.match(/^oklab\(\s*([\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)/);
    if (ok) return oklabASrgb(Number(ok[1]), Number(ok[2]), Number(ok[3]));
    lienzo.fillStyle = "#000";
    lienzo.fillStyle = css;
    const v = lienzo.fillStyle;
    if (v.startsWith("#")) {
      const h = v.slice(1);
      return [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16),
      ];
    }
    const n = v.match(/[\d.]+/g).map(Number);
    return [n[0], n[1], n[2]];
  }

  const componer = (frente, alfa, fondo) =>
    [0, 1, 2].map((i) => alfa * frente[i] + (1 - alfa) * fondo[i]);

  const linealizar = (v) => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const luminancia = (c) =>
    0.2126 * linealizar(c[0]) + 0.7152 * linealizar(c[1]) + 0.0722 * linealizar(c[2]);
  const ratio = (a, b) => {
    const x = luminancia(a);
    const y = luminancia(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };

  /**
   * Apila los fondos translúcidos hasta el primero opaco y los compone.
   *
   * DEVUELVE TAMBIÉN SI HAY UN DEGRADADO POR MEDIO, y eso importa: esta función
   * solo lee `background-color`, que en un elemento pintado con
   * `linear-gradient` vale `transparent`. El recorrido lo atraviesa y acaba
   * midiendo contra el lienzo de la página, no contra el degradado real.
   *
   * Pasó de verdad: la tarjeta de acento del inventario lleva texto blanco sobre
   * un degradado índigo —contraste de sobra— y se reportaba como 1,22:1 contra
   * el gris de la página. Un fallo inventado.
   *
   * Un degradado tiene un color distinto en cada píxel, así que no hay un único
   * ratio que calcular. Lo honesto no es ignorarlo ni darlo por bueno: es
   * declararlo NO VERIFICABLE y que alguien lo mire.
   */
  function fondoEfectivo(el) {
    const capas = [];
    let hayDegradado = false;
    let n = el;
    while (n && n.nodeType === 1) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== "none") hayDegradado = true;
      const css = cs.backgroundColor;
      const a = alfaDe(css);
      if (a > 0) {
        capas.push([rgbDe(css), a]);
        if (a >= 1) break;
      }
      n = n.parentElement;
    }
    let base = [255, 255, 255];
    for (let i = capas.length - 1; i >= 0; i--) {
      base = componer(capas[i][0], capas[i][1], base);
    }
    return { fondo: base, hayDegradado };
  }

  function medirTemaActual() {
    const fallos = [];
    const sinVerificar = [];
    const vistos = new Set();

    for (const el of document.querySelectorAll("body *")) {
      const texto = [...el.childNodes]
        .filter((n) => n.nodeType === 3 && n.textContent.trim())
        .map((n) => n.textContent.trim())
        .join(" ");
      if (!texto) continue;

      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      if (parseFloat(cs.opacity) < 0.15) continue;
      // Sin caja de dibujo no se pinta, así que no se mide.
      if (!el.getClientRects().length) continue;

      const { fondo, hayDegradado } = fondoEfectivo(el);
      const tinta = componer(rgbDe(cs.color), alfaDe(cs.color), fondo);

      const cuerpo = parseFloat(cs.fontSize);
      const peso = parseInt(cs.fontWeight, 10) || 400;
      // "Texto grande" segun WCAG: 24px, o 18,66px si va en negrita.
      const esGrande = cuerpo >= 24 || (cuerpo >= 18.66 && peso >= 700);
      const minimo = esGrande ? 3 : 4.5;

      const r = ratio(tinta, fondo);
      if (r >= minimo) continue;

      // Se agrupa por combinacion, no por nodo: veinte filas de tabla con el
      // mismo defecto son UN defecto, y listarlas veinte veces esconde el resto.
      const clave = `${cs.color}|${fondo.map(Math.round).join()}|${cuerpo}`;
      if (vistos.has(clave)) continue;
      vistos.add(clave);

      const hallazgo = {
        texto: texto.slice(0, 40),
        ratio: Number(r.toFixed(2)),
        minimo,
        px: Math.round(cuerpo),
        color: cs.color,
        fondo: `rgb(${fondo.map(Math.round).join(", ")})`,
      };

      // Con un degradado por medio el fondo calculado no es el que se pinta, así
      // que el ratio no significa nada. Se aparta en vez de contarlo como fallo.
      if (hayDegradado) sinVerificar.push(hallazgo);
      else fallos.push(hallazgo);
    }
    return { fallos, sinVerificar };
  }

  /**
   * Mide con las TRANSICIONES DESACTIVADAS, y esto no es opcional.
   *
   * Las tarjetas llevan `transition-colors`. Al cambiar de tema arrancan una
   * transición de color, y si el navegador no está pintando —pestaña en
   * segundo plano, ventana oculta, `requestAnimationFrame` congelado— la
   * transición NUNCA avanza y el elemento se queda en el color de partida.
   *
   * Midiendo así salieron catorce fallos en tema oscuro de los que once eran
   * fotogramas detenidos a mitad de camino: tarjetas mostrando todavía el color
   * del tema anterior. Con las transiciones apagadas el valor final se aplica de
   * inmediato y quedaron los tres reales.
   */
  function conTransicionesApagadas(fn) {
    const estilo = document.createElement("style");
    estilo.textContent =
      "*,*::before,*::after{transition:none !important;animation-duration:0s !important}";
    document.head.appendChild(estilo);
    // Fuerza un recálculo antes de leer nada.
    void document.body.offsetHeight;
    try {
      return fn();
    } finally {
      estilo.remove();
    }
  }

  globalThis.auditarContraste = function auditarContraste({ ambosTemas = false } = {}) {
    const raiz = document.documentElement;
    const eraOscuro = raiz.classList.contains("dark");

    const resultado = conTransicionesApagadas(() => {
      if (!ambosTemas) {
        return { [eraOscuro ? "oscuro" : "claro"]: medirTemaActual() };
      }
      raiz.classList.add("dark");
      void document.body.offsetHeight;
      const oscuro = medirTemaActual();
      raiz.classList.remove("dark");
      void document.body.offsetHeight;
      const claro = medirTemaActual();
      raiz.classList.toggle("dark", eraOscuro);
      return { oscuro, claro };
    });

    for (const [tema, { fallos, sinVerificar }] of Object.entries(resultado)) {
      if (!fallos.length) {
        console.log(`%c✓ ${tema}: sin fallos`, "color:#4ade9f;font-weight:bold");
      } else {
        console.log(
          `%c✗ ${tema}: ${fallos.length} combinaciones por debajo del mínimo`,
          "color:#ff8f5e;font-weight:bold",
        );
        console.table(fallos);
      }
      if (sinVerificar.length) {
        console.log(
          `%c? ${tema}: ${sinVerificar.length} sobre degradado — hay que mirarlas a ojo`,
          "color:#f5c445;font-weight:bold",
        );
        console.table(sinVerificar);
      }
    }
    return resultado;
  };

  console.log(
    "Auditor cargado. Usa auditarContraste() o auditarContraste({ ambosTemas: true }).",
  );
})();
