# yelastforbilibili.github.io

The source of <https://yelastforbilibili.github.io> — a personal page for Yelast.

Hand-written HTML, CSS and GLSL. No framework, no bundler, no build step: every file in
this branch is the file the browser receives.

## What is in here

| Path | |
| --- | --- |
| `index.html` | the page, English and Chinese in one document |
| `assets/css/site.css` | the whole stylesheet, one file, no preprocessor |
| `assets/js/field.js` | the background: a braid of hairlines built in the vertex shader |
| `assets/js/site.js` | clock, scroll readout, language switch, small cursor |
| `assets/fonts/` | Instrument Serif (self-hosted), Instrument Sans, JetBrains Mono |

## The background

`field.js` draws a three-dimensional braid of ~5,000 hairlines in raw WebGL2. Each vertex
carries only `(strand, position along the cable, is-this-the-orange-thread)`; the geometry
that matters is evaluated in the vertex shader, so the JavaScript side is one draw call and
eleven uniform writes.

Four parameter sets — a loose cable behind the hero, a horizontal run above the work rows,
a standing wire behind the manifesto, a collapsing coil under the contact block — are
interpolated against scroll progress. The shape changes as the page moves; it is not a
loop playing behind the text.

It renders on one canvas at the top of the page, ignores the pointer except for a heavily
damped parallax, drops to a still frame when the tab is hidden, and renders once with no
animation loop at all when `prefers-reduced-motion` is set.

## Deploying

Push to `main`. That is the whole process — GitHub Pages serves the branch root, and
`.nojekyll` keeps Jekyll out of the way.
