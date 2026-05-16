/* macros.js — Pre-built macros library, tabs, preview, drawer wiring */

const Macros = (() => {

  const CATEGORIES = [
    {
      id: 'shapes', label: 'Shapes',
      macros: [
        { id:'square', icon:'⬛', label:'Square',
          code:`TO SQUARE :SIZE\n  REPEAT 4 [FD :SIZE RT 90]\nEND\nCS\nSQUARE 200` },
        { id:'triangle', icon:'🔺', label:'Triangle',
          code:`TO TRIANGLE :SIZE\n  REPEAT 3 [FD :SIZE RT 120]\nEND\nCS\nTRIANGLE 180` },
        { id:'circle', icon:'⭕', label:'Circle',
          code:`TO CIRCLE :R\n  REPEAT 60 [FD :R * 0.1047 RT 6]\nEND\nCS\nCIRCLE 150` },
        { id:'rectangle', icon:'▬', label:'Rectangle',
          code:`TO RECT :W :H\n  REPEAT 2 [FD :H RT 90 FD :W RT 90]\nEND\nCS\nRECT 240 120` },
        { id:'pentagon', icon:'⬠', label:'Pentagon',
          code:`TO PENTAGON :SIZE\n  REPEAT 5 [FD :SIZE RT 72]\nEND\nCS\nPENTAGON 140` },
        { id:'hexagon', icon:'⬡', label:'Hexagon',
          code:`TO HEXAGON :SIZE\n  REPEAT 6 [FD :SIZE RT 60]\nEND\nCS\nHEXAGON 130` },
        { id:'octagon', icon:'🛑', label:'Octagon',
          code:`TO OCTAGON :SIZE\n  REPEAT 8 [FD :SIZE RT 45]\nEND\nCS\nOCTAGON 100` },
        { id:'polygon', icon:'🔷', label:'N-gon',
          code:`; Regular polygon with N sides\nTO POLYGON :N :SIZE\n  REPEAT :N [FD :SIZE RT 360 / :N]\nEND\nCS\nPOLYGON 12 60` },
      ],
    },
    {
      id: 'stars', label: 'Stars & Spirals',
      macros: [
        { id:'star5', icon:'⭐', label:'5-Point Star',
          code:`TO STAR5 :SIZE\n  REPEAT 5 [FD :SIZE RT 144]\nEND\nCS\nSTAR5 200` },
        { id:'star6', icon:'✡', label:'6-Point Star',
          code:`TO STAR6 :SIZE\n  REPEAT 6 [\n    FD :SIZE RT 60\n    FD :SIZE RT 120\n  ]\nEND\nCS\nSTAR6 100` },
        { id:'star8', icon:'✴', label:'8-Point Star',
          code:`TO STAR8 :SIZE\n  REPEAT 8 [FD :SIZE RT 135]\nEND\nCS\nSTAR8 150` },
        { id:'sqspiral', icon:'🌀', label:'Square Spiral',
          code:`CS\nMAKE "S 5\nREPEAT 80 [\n  FD :S RT 90\n  MAKE "S :S + 3\n]` },
        { id:'trispiral', icon:'🔁', label:'Triangle Spiral',
          code:`CS\nMAKE "S 5\nREPEAT 80 [\n  FD :S RT 120\n  MAKE "S :S + 2\n]` },
        { id:'logspiral', icon:'🌊', label:'Log Spiral',
          code:`CS\nMAKE "S 1\nREPEAT 100 [\n  FD :S RT 15\n  MAKE "S :S * 1.05\n]` },
        { id:'rainbow', icon:'🌈', label:'Rainbow Burst',
          code:`CS HT\nMAKE "I 0\nREPEAT 36 [\n  SETPC REMAINDER :I 16\n  REPEAT 5 [FD 120 RT 144]\n  RT 10\n  MAKE "I :I + 1\n]` },
        { id:'rosette', icon:'🏵', label:'Rosette',
          code:`CS HT\nREPEAT 12 [\n  SETPC REPCOUNT\n  REPEAT 6 [FD 80 RT 60]\n  RT 30\n]` },
      ],
    },
    {
      id: 'patterns', label: 'Patterns',
      macros: [
        { id:'snowflake', icon:'❄️', label:'Snowflake',
          code:`TO BRANCH :LEN\n  IF :LEN < 8 [STOP]\n  FD :LEN\n  LT 30 BRANCH :LEN * 0.65 RT 30\n  RT 30 BRANCH :LEN * 0.65 LT 30\n  BK :LEN\nEND\nCS HT\nSETPC 11\nREPEAT 6 [BRANCH 100 RT 60]` },
        { id:'tree', icon:'🌲', label:'Fractal Tree',
          code:`TO TREE :LEN\n  IF :LEN < 5 [STOP]\n  FD :LEN\n  LT 25 TREE :LEN * 0.7\n  RT 50 TREE :LEN * 0.7\n  LT 25 BK :LEN\nEND\nCS HT\nSETH 0 PU BK 200 PD\nSETPC 2\nTREE 120` },
        { id:'kochflake', icon:'🔷', label:'Koch Snowflake',
          code:`TO KSIDE :L :D\n  IF :D = 0 [FD :L STOP]\n  KSIDE :L / 3 :D - 1\n  LT 60\n  KSIDE :L / 3 :D - 1\n  RT 120\n  KSIDE :L / 3 :D - 1\n  LT 60\n  KSIDE :L / 3 :D - 1\nEND\nTO KOCHFLAKE :D\n  REPEAT 3 [KSIDE 300 :D RT 120]\nEND\nCS HT\nPU SETXY -150 90 PD\nSETPC 9\nKOCHFLAKE 4` },
        { id:'sierpinski', icon:'🔺', label:'Sierpinski',
          code:`TO TRI :SIZE :DEPTH\n  IF :DEPTH = 0 [\n    REPEAT 3 [FD :SIZE RT 120]\n    STOP\n  ]\n  TRI :SIZE / 2 :DEPTH - 1\n  FD :SIZE / 2\n  TRI :SIZE / 2 :DEPTH - 1\n  BK :SIZE / 2 RT 60 FD :SIZE / 2 LT 60\n  TRI :SIZE / 2 :DEPTH - 1\n  RT 60 BK :SIZE / 2 LT 60\nEND\nCS HT\nPU SETXY -200 -150 PD\nSETPC 12\nTRI 400 5` },
        { id:'dragon', icon:'🐉', label:'Dragon Curve',
          code:`TO DRAGON :LEN :DEPTH :DIR\n  IF :DEPTH = 0 [FD :LEN STOP]\n  DRAGON :LEN :DEPTH - 1 1\n  RT :DIR * 90\n  DRAGON :LEN :DEPTH - 1 -1\nEND\nCS HT\nPU SETXY -50 50 PD\nSETPC 13\nSETPENWIDTH 1\nDRAGON 5 12 1` },
        { id:'hilbert', icon:'⬛', label:'Hilbert Curve',
          code:`TO HILBERT :SIZE :LEVEL :DIR\n  IF :LEVEL = 0 [STOP]\n  LT :DIR\n  HILBERT :SIZE :LEVEL - 1 (-:DIR)\n  FD :SIZE\n  RT :DIR\n  HILBERT :SIZE :LEVEL - 1 :DIR\n  FD :SIZE\n  HILBERT :SIZE :LEVEL - 1 :DIR\n  RT :DIR\n  FD :SIZE\n  HILBERT :SIZE :LEVEL - 1 (-:DIR)\n  LT :DIR\nEND\nCS HT\nPU SETXY -150 -150 PD\nSETPC 10\nHILBERT 10 5 90` },
        { id:'spiroflower', icon:'🌸', label:'Spiroflower',
          code:`TO PETAL\n  REPEAT 2 [\n    REPEAT 60 [FD 2 RT 3]\n    RT 60\n  ]\nEND\nCS HT\nMAKE "C 1\nREPEAT 18 [\n  SETPC REMAINDER :C 16\n  PETAL\n  RT 20\n  MAKE "C :C + 1\n]` },
        { id:'mandala', icon:'🕸', label:'Mandala',
          code:`TO RING :R :SIDES\n  REPEAT :SIDES [FD :R RT 360 / :SIDES]\nEND\nCS HT\nREPEAT 12 [\n  SETPC REMAINDER REPCOUNT 16\n  RING 40 6\n  RT 30\n]\nRT 15\nREPEAT 12 [\n  SETPC REMAINDER REPCOUNT 8 + 4\n  RING 25 4\n  RT 30\n]` },
      ],
    },
    {
      id: 'scene', label: 'Scene',
      macros: [
        { id:'house', icon:'🏠', label:'Modern 3D House',
          code:`; ────────────────────────────────────────────────\n; Modern 3D-isometric house\n; ────────────────────────────────────────────────\n\nTO BOX :W :H\n  REPEAT 2 [FD :H RT 90 FD :W RT 90]\nEND\n\nTO HOUSE\n  ; ── Front face (light grey) — 200 wide × 130 tall\n  PU SETXY -110 -100 SETH 0 PD\n  SETPENWIDTH 2\n  SETPC 7\n  BOX 200 130\n\n  ; ── Right side face (darker, isometric — depth=80 at 30° angle)\n  ; corners: (90,-100) → (90+69.3, -100+40) → (90+69.3, 30+40) → (90, 30)\n  SETPC 8\n  PU SETXY 90 -100 PD\n  SETH 60 FD 80\n  SETH 0  FD 130\n  SETH 240 FD 80\n\n  ; ── Flat roof (white parallelogram on top)\n  SETPC 15\n  PU SETXY -110 30 PD\n  SETH 60  FD 80\n  SETH 90  FD 200\n  SETH 240 FD 80\n  SETH 270 FD 200\n\n  ; ── Roof front edge highlight\n  SETPENWIDTH 3\n  SETPC 0\n  PU SETXY -110 30 SETH 90 PD\n  FD 200\n\n  ; ── Door (brown, centered)\n  SETPENWIDTH 2\n  SETPC 4\n  PU SETXY -20 -100 SETH 0 PD\n  BOX 40 65\n  ; Door knob\n  SETPC 14\n  PU SETXY 12 -72 SETH 0 PD\n  REPEAT 12 [FD 1 RT 30]\n\n  ; ── Two windows (blue with frames)\n  SETPC 9\n  SETPENWIDTH 2\n  PU SETXY -85 -25 SETH 0 PD\n  BOX 45 40\n  PU SETXY 40 -25 SETH 0 PD\n  BOX 45 40\n  ; Window cross-bars\n  SETPC 7\n  SETPENWIDTH 1\n  PU SETXY -62 -25 SETH 0 PD FD 40\n  PU SETXY -85 -5  SETH 90 PD FD 45\n  PU SETXY 62 -25 SETH 0 PD FD 40\n  PU SETXY 40 -5  SETH 90 PD FD 45\n\n  ; ── Chimney on the roof\n  SETPC 4\n  SETPENWIDTH 2\n  PU SETXY 30 75 SETH 0 PD\n  BOX 18 35\nEND\n\nCS HT\nHOUSE` },
        { id:'sun', icon:'☀️', label:'Sun',
          code:`TO RAY :LEN\n  FD :LEN BK :LEN\nEND\nTO CIRCLE_APPROX :R\n  REPEAT 36 [FD :R * 0.1745 RT 10]\nEND\nTO SUN :R\n  SETPC 14\n  SETPENWIDTH 3\n  CIRCLE_APPROX :R\n  SETPC 6\n  REPEAT 12 [RT 30 RAY :R * 1.8]\nEND\nCS HT\nSUN 50` },
        { id:'car', icon:'🚗', label:'Car',
          code:`TO BOX :W :H\n  REPEAT 2 [FD :H RT 90 FD :W RT 90]\nEND\nTO WHEEL\n  REPEAT 36 [FD 2.5 RT 10]\nEND\nTO CAR\n  PU SETXY -130 -25 SETH 0 PD\n  SETPC 4 SETPENWIDTH 2\n  BOX 260 50\n  PU SETXY -80 25 SETH 0 PD\n  BOX 140 45\n  SETPC 0\n  PU SETXY -75 -30 SETH 0 PD\n  WHEEL\n  PU SETXY 75 -30 SETH 0 PD\n  WHEEL\nEND\nCS HT\nCAR` },
        { id:'stickfigure', icon:'🧍', label:'Stick Figure',
          code:`TO HEAD :R\n  REPEAT 36 [FD :R * 0.1745 RT 10]\nEND\nTO STICK\n  ; Head\n  PU SETXY 0 80 PD\n  SETPENWIDTH 2\n  HEAD 25\n  ; Body\n  PU SETXY 0 80 SETH 180 PD\n  FD 100\n  ; Arms\n  PU SETXY 0 40 SETH 240 PD FD 50\n  PU SETXY 0 40 SETH 120 PD FD 50\n  ; Legs\n  PU SETXY 0 -20 SETH 200 PD FD 80\n  PU SETXY 0 -20 SETH 160 PD FD 80\nEND\nCS HT\nSETPC 0\nSTICK` },
        { id:'mountain', icon:'🏔', label:'Mountains',
          code:`TO PEAK :S\n  LT 60 FD :S RT 120 FD :S LT 60\nEND\nCS HT\nSETPENWIDTH 2\nPU SETXY -350 -100 SETH 90 PD\n; Far range (blue)\nSETPC 9\nREPEAT 5 [PEAK 80]\nPU SETXY -350 -100 SETH 90 PD\n; Front range (darker)\nSETPC 1\nPU FD 60 PD\nREPEAT 4 [PEAK 100]\n; Ground\nPU SETXY -380 -100 SETH 90 PD\nSETPC 2\nFD 760` },
        { id:'flower', icon:'🌷', label:'Flower',
          code:`TO PETAL :LEN\n  REPEAT 2 [\n    REPEAT 60 [FD :LEN / 60 RT 3]\n    RT 60\n  ]\nEND\nTO FLOWER\n  ; petals\n  SETPC 13\n  REPEAT 8 [PETAL 100 RT 45]\n  ; stem\n  PU SETH 180 FD 30 PD\n  SETPC 2 SETPENWIDTH 4\n  FD 150\nEND\nCS HT\nFLOWER` },
      ],
    },
    {
      id: 'advanced', label: 'Advanced',
      macros: [
        { id:'colorwheel', icon:'🎨', label:'Color Wheel',
          code:`; All 16 Logo colors arranged in a wheel\nCS HT\nSETPENWIDTH 6\nREPEAT 16 [\n  SETPC REPCOUNT - 1\n  FD 120 BK 120\n  RT 22.5\n]` },
        { id:'spirograph', icon:'🌀', label:'Spirograph',
          code:`; 36 rotated squares — classic spirograph pattern\nCS HT\nSETPENWIDTH 1\nREPEAT 36 [\n  SETPC REMAINDER REPCOUNT 16\n  REPEAT 4 [FD 120 RT 90]\n  RT 10\n]` },
        { id:'pinwheel', icon:'🌬', label:'Pinwheel',
          code:`TO BLADE :SIZE\n  REPEAT 3 [FD :SIZE RT 120]\nEND\nCS HT\nSETPENWIDTH 2\nREPEAT 8 [\n  SETPC REMAINDER REPCOUNT 8 + 1\n  BLADE 100\n  RT 45\n]` },
        { id:'heart', icon:'❤️', label:'Heart',
          code:`; Heart shape: 2 semicircle bumps + V at bottom\nCS HT\nSETPC 4 SETPENWIDTH 3\nPU SETXY -80 -40 SETH 45 PD\n; Left side up\nFD 100\n; Left bump (semicircle)\nREPEAT 180 [FD 1.2 RT 1]\n; Right bump (semicircle)\nREPEAT 180 [FD 1.2 RT 1]\n; Right side down to bottom point\nFD 100` },
        { id:'cube', icon:'🧊', label:'3D Cube',
          code:`; Isometric-looking cube using offset squares\nTO SQ :S\n  REPEAT 4 [FD :S RT 90]\nEND\nCS HT\nSETPENWIDTH 2\nSETPC 12\n; Front face\nPU SETXY -50 -50 SETH 0 PD\nSQ 100\n; Back face (offset)\nPU SETXY 0 0 SETH 0 PD\nSETPC 9\nSQ 100\n; Connecting lines\nSETPC 14\nPU SETXY -50 -50 PD SETXY 0 0\nPU SETXY 50 -50 PD SETXY 100 0\nPU SETXY 50 50 PD SETXY 100 100\nPU SETXY -50 50 PD SETXY 0 100` },
        { id:'web', icon:'🕷', label:'Spider Web',
          code:`TO RADIAL :LEN\n  FD :LEN BK :LEN\nEND\nCS HT\nSETPC 7 SETPENWIDTH 1\n; 12 radial spokes\nREPEAT 12 [RADIAL 200 RT 30]\n; Spiral webbing\nMAKE "R 20\nREPEAT 60 [\n  FD :R / 6 RT 6\n  MAKE "R :R + 3\n]` },
        { id:'fern', icon:'🌿', label:'Fractal Fern',
          code:`TO FERN :SIZE :SIGN\n  IF :SIZE < 1 [STOP]\n  FD :SIZE\n  RT 70 * :SIGN\n  FERN :SIZE * 0.5 (-:SIGN)\n  LT 70 * :SIGN\n  FD :SIZE\n  LT 70 * :SIGN\n  FERN :SIZE * 0.5 :SIGN\n  RT 70 * :SIGN\n  FERN :SIZE * 0.85 :SIGN\n  BK :SIZE * 2\nEND\nCS HT\nSETPC 2 SETPENWIDTH 1\nSETH 0 PU BK 250 PD\nFERN 30 1` },
        { id:'galaxy', icon:'🌌', label:'Spiral Galaxy',
          code:`; Multi-arm spiral galaxy\nCS HT\nSETBG 0\nSETPENWIDTH 1\nREPEAT 4 [\n  SETPC REMAINDER REPCOUNT 16 + 9\n  PU HOME PD\n  MAKE "R 1\n  REPEAT 200 [\n    FD :R / 4 RT 7\n    MAKE "R :R + 0.5\n  ]\n  PU HOME RT REPCOUNT * 90 PD\n]` },
        { id:'tilemaze', icon:'🔳', label:'10-PRINT Maze',
          code:`; Classic random diagonals — like Commodore 64 10 PRINT\nTO TILE :S\n  IFELSE (RANDOM 2) = 0 [\n    ; "/" diagonal\n    PU LT 90 FD :S RT 90 PD\n    RT 45 FD :S * 1.414 LT 45\n    PU FD :S LT 90 FD :S RT 90 PD\n  ] [\n    ; "\\\\" diagonal\n    RT 45 FD :S * 1.414 LT 45\n    PU FD :S PD\n  ]\nEND\nCS HT\nSETPC 5 SETPENWIDTH 1\nMAKE "ROW 0\nPU SETXY -300 -200 SETH 0 PD\nREPEAT 10 [\n  REPEAT 18 [TILE 35]\n  PU SETX -300 SETH 0 FD 35 PD\n]` },
        { id:'wave', icon:'🌊', label:'Wave Pattern',
          code:`; Stacked sine waves\nCS HT\nSETPENWIDTH 2\nREPEAT 8 [\n  SETPC REMAINDER REPCOUNT 16 + 8\n  PU SETXY -350 -100 + (REPCOUNT * 25) SETH 90 PD\n  REPEAT 360 [\n    FD 2\n    SETH 90 + 30 * SIN REPCOUNT\n  ]\n]` },
      ],
    },
  ];

  let selectedMacro = null;
  let activeCat = 'shapes';

  function setSelected(macro, btn) {
    selectedMacro = macro;
    document.querySelectorAll('.macro-btn.selected').forEach(b => b.classList.remove('selected'));
    if (btn) btn.classList.add('selected');
    document.getElementById('macro-preview-code').textContent = macro.code;
    document.getElementById('macro-insert-btn').disabled = false;
  }

  function renderMacroGrid(catId) {
    const grid = document.getElementById('macro-grid');
    grid.innerHTML = '';
    const cat = CATEGORIES.find(c => c.id === catId);
    if (!cat) return;

    cat.macros.forEach(macro => {
      const btn = document.createElement('button');
      btn.className = 'macro-btn';
      btn.innerHTML = `<span class="icon">${macro.icon}</span><span class="label">${macro.label}</span>`;
      btn.title = `Preview ${macro.label}`;
      btn.addEventListener('click', () => setSelected(macro, btn));
      grid.appendChild(btn);
    });

    // Auto-select first
    if (cat.macros.length > 0) {
      setSelected(cat.macros[0], grid.firstChild);
    }
  }

  function insertSelected() {
    if (!selectedMacro || !Editor.cm) return;
    Editor.cm.setValue(selectedMacro.code);
    Editor.cm.focus();
    Editor.cm.execCommand('goDocEnd');
    Drawer.close();
  }

  function init() {
    document.querySelectorAll('.macro-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.macro-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        activeCat = tab.dataset.cat;
        renderMacroGrid(activeCat);
      });
    });

    document.getElementById('macro-insert-btn').addEventListener('click', insertSelected);

    renderMacroGrid(activeCat);
  }

  return { init, CATEGORIES };
})();

/* ─── Drawer module ─────────────────────────────────────────────────── */
const Drawer = (() => {

  let currentPanel = null; // 'macros' | 'help' | null

  function open(panel) {
    currentPanel = panel;
    document.getElementById('drawer-title').textContent =
      panel === 'macros' ? 'Pre-built Programs' : 'Command Reference';
    document.getElementById('drawer-macros').hidden = panel !== 'macros';
    document.getElementById('drawer-help').hidden   = panel !== 'help';
    document.getElementById('drawer').classList.add('open');
    document.getElementById('drawer-backdrop').classList.add('open');

    document.getElementById('btn-macros').classList.toggle('active', panel === 'macros');
    document.getElementById('btn-help').classList.toggle('active', panel === 'help');
  }

  function close() {
    currentPanel = null;
    document.getElementById('drawer').classList.remove('open');
    document.getElementById('drawer-backdrop').classList.remove('open');
    document.getElementById('btn-macros').classList.remove('active');
    document.getElementById('btn-help').classList.remove('active');
  }

  function toggle(panel) {
    if (currentPanel === panel) close();
    else open(panel);
  }

  function init() {
    document.getElementById('btn-macros').addEventListener('click', () => toggle('macros'));
    document.getElementById('btn-help').addEventListener('click', () => toggle('help'));
    document.getElementById('drawer-close').addEventListener('click', close);
    document.getElementById('drawer-backdrop').addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && currentPanel) close();
    });
  }

  return { init, open, close, toggle };
})();

window.addEventListener('DOMContentLoaded', () => {
  Macros.init();
  Drawer.init();
});
