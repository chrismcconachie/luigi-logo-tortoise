# 🐢 Luigi Logo Tortoise

A browser-based Logo programming environment with a full interpreter, modern GUI, autocomplete, pre-built macros, and a draggable resizable layout. Runs entirely in the browser — just open `index.html`.

Made by **Mars McConachie** & **Chris McConachie**.

## Features

- **Full Logo interpreter** — `FORWARD/FD`, `BACK/BK`, `RIGHT/RT`, `LEFT/LT`, `REPEAT`, `TO…END` user procedures, `MAKE`/`:varname` variables, `IF/IFELSE`, math (`SIN`, `COS`, `SQRT`, `RANDOM`, `POWER`, …), recursion with a 500-level guard, `FILL` flood fill
- **CodeMirror 5 editor** with custom Logo syntax highlighting, bracket matching, and per-keystroke autocomplete showing command syntax + descriptions
- **Searchable command reference drawer** — all built-in commands grouped by category with examples
- **Pre-built drawer** with 5 categories: Shapes, Stars & Spirals, Patterns, Scene, and Advanced (Spirograph, Heart, Dragon Curve, Hilbert Curve, Fractal Fern, Koch Snowflake, Sierpinski Triangle, and more)
- **Edge-to-edge canvas** with a draggable resize divider between drawing and code panes
- **Adjustable drawing speed** from very slow (watch each step) to instant
- **Print** the canvas + code as a multi-page document
- **iPad / Safari touch support** with pointer events and larger tap targets on coarse-pointer devices
- **Keyboard shortcuts**: `Shift+Enter` to run, `Shift+C` to clear canvas

## Run it

Just open `index.html` in Chrome or Safari — no build step needed. For local development with a server:

```bash
python3 -m http.server 8094 --directory .
```

Then open <http://localhost:8094>.

## File structure

```
luigi-logo-tortoise/
├── index.html
├── assets/                 — logo images
├── css/style.css
├── js/
│   ├── turtle.js           — two-canvas renderer + flood fill
│   ├── interpreter.js      — Logo tokenizer, parser, async-generator evaluator
│   ├── macros.js           — drawer wiring + consumes prebuilts/registry.js
│   ├── editor.js           — CodeMirror setup, Logo mode, autocomplete, help panel
│   └── app.js              — UI wiring, run/stop/clear, print, divider drag, shortcuts
├── prebuilts/
│   ├── _lib.logo           — shared helpers auto-prepended to every program
│   ├── index.json          — manifest (categories + per-prebuilt metadata)
│   ├── registry.js         — generated bundle (committed; loaded via <script>)
│   ├── shapes/   *.logo    — one file per prebuilt
│   ├── stars/    *.logo
│   ├── patterns/ *.logo
│   ├── scene/    *.logo
│   └── advanced/ *.logo
└── tools/
    └── build-prebuilts.py  — regenerates prebuilts/registry.js
```

## Adding a new pre-built

1. Create a new `.logo` file under `prebuilts/<category>/<name>.logo`. Use the helpers in `prebuilts/_lib.logo` (`BOX`, `CIRCLE_AT`, `DISK`, `FBOX`, `CIRC_ARC`) — they're auto-loaded.
2. Add a metadata entry to the matching category in `prebuilts/index.json`:
   ```json
   { "id": "myshape", "label": "My Shape", "icon": "✨", "file": "shapes/myshape.logo" }
   ```
3. Regenerate the bundle:
   ```bash
   python3 tools/build-prebuilts.py
   ```
4. Reload the app — your prebuilt appears in the drawer.

The `prebuilts/registry.js` bundle is checked into git so the app works equally well via `file://` (just open `index.html`) and from any web server.
