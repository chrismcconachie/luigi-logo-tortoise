/* app.js — UI wiring, runner, print, divider drag, shortcuts */

const App = (() => {

  let running = false;
  let currentGen = null;
  let outputEl;

  // ── Console ───────────────────────────────────────────────────────
  function print(msg, cls = 'console-info') {
    const line = document.createElement('div');
    line.className = `console-line ${cls}`;
    line.textContent = msg;
    outputEl.appendChild(line);
    outputEl.scrollTop = outputEl.scrollHeight;
  }

  function printInline(msg) {
    let last = outputEl.lastElementChild;
    if (!last || !last.classList.contains('console-inline')) {
      last = document.createElement('div');
      last.className = 'console-line console-inline console-info';
      outputEl.appendChild(last);
    }
    last.textContent += msg;
    outputEl.scrollTop = outputEl.scrollHeight;
  }

  function clearConsole() { outputEl.innerHTML = ''; }
  function printError(msg) { print('Error: ' + msg, 'console-error'); }
  function printDim(msg)   { print(msg, 'console-dim'); }

  // ── Speed mapping ──────────────────────────────────────────────────
  // slider 1..3  → very slow (ms delay between single steps via setTimeout)
  // slider 4..10 → fast (steps per RAF frame)
  function speedToTiming(speed) {
    if (speed <= 3) {
      const stepDelay = [500, 200, 60][speed - 1]; // ms between single steps
      return { mode: 'slow', stepDelay };
    }
    const stepsPerFrame = Math.round(Math.pow(2.5, speed - 4));
    return { mode: 'fast', stepsPerFrame };
  }

  function setRunning(yes) {
    running = yes;
    document.getElementById('btn-run').disabled  = yes;
    document.getElementById('btn-stop').disabled = !yes;
    if (typeof Editor !== 'undefined' && Editor.cm) Editor.cm.setOption('readOnly', yes);
  }

  function onDone() {
    setRunning(false);
    currentGen = null;
    Turtle.state.shouldStop = false;
    Turtle.state.callDepth  = 0;
  }

  function runProgram(src) {
    if (running) return;
    clearConsole();
    Turtle.state.shouldStop = false;
    Turtle.state.callDepth  = 0;

    // Prepend the shared helper library so prebuilts and user code can
    // always call BOX / CIRCLE_AT / DISK / FBOX / CIRC_ARC without
    // redefining them locally.
    const lib = (typeof Macros !== 'undefined' && Macros.SHARED_LIB) ? Macros.SHARED_LIB : '';
    const fullSrc = lib ? lib + '\n\n' + src : src;

    let gen;
    try {
      gen = Logo.run(fullSrc);
    } catch (e) {
      printError(e.logoMsg || e.message);
      return;
    }

    currentGen = gen;
    setRunning(true);
    printDim('Running…');

    const speedSlider = document.getElementById('speed-slider');

    async function tick() {
      if (Turtle.state.shouldStop || !currentGen) { onDone(); return; }
      const speed = +speedSlider.value;
      const t = speedToTiming(speed);

      if (t.mode === 'slow') {
        // Take exactly one step, then setTimeout for next
        let result;
        try { result = await currentGen.next(); }
        catch (e) { printError(e.logoMsg || e.message); onDone(); return; }
        if (result.done) { onDone(); printDim('Done.'); return; }
        if (result.value && result.value.type === 'WAIT') {
          setTimeout(tick, result.value.ms * (1000 / 60));
          return;
        }
        setTimeout(tick, t.stepDelay);
        return;
      }

      // Fast mode — batch steps per RAF
      for (let i = 0; i < t.stepsPerFrame; i++) {
        if (Turtle.state.shouldStop) { onDone(); return; }
        let result;
        try { result = await currentGen.next(); }
        catch (e) { printError(e.logoMsg || e.message); onDone(); return; }
        if (result.done) { onDone(); printDim('Done.'); return; }
        if (result.value && result.value.type === 'WAIT') {
          setTimeout(tick, result.value.ms * (1000 / 60));
          return;
        }
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function stopProgram() {
    Turtle.state.shouldStop = true;
    setTimeout(() => { onDone(); printDim('Stopped.'); }, 50);
  }

  // ── Print ──────────────────────────────────────────────────────────
  function printDocument() {
    const srcCanvas = Turtle.getDrawingCanvas();

    // Composite the drawing onto a NEW canvas with an explicit white
    // background.  Without this step any transparent/alpha pixels would
    // print as black bands.
    const printCanvas = document.createElement('canvas');
    printCanvas.width = srcCanvas.width;
    printCanvas.height = srcCanvas.height;
    const pctx = printCanvas.getContext('2d');
    pctx.fillStyle = '#ffffff';
    pctx.fillRect(0, 0, printCanvas.width, printCanvas.height);
    pctx.drawImage(srcCanvas, 0, 0);
    const dataURL = printCanvas.toDataURL('image/png');

    const code = Editor.cm ? Editor.cm.getValue() : '';
    const stamp = new Date().toLocaleString();

    const area = document.getElementById('print-area');
    area.innerHTML = `
      <header class="print-header">
        <h1>🐢 Luigi Logo Tortoise</h1>
        <p class="print-stamp">Printed ${escapeHtml(stamp)}</p>
      </header>
      <figure class="print-figure">
        <img class="print-image" src="${dataURL}" alt="Canvas drawing">
      </figure>
      <h2 class="print-section-heading">Code</h2>
      <pre class="print-code">${escapeHtml(code)}</pre>
      <footer class="print-footer">Made with 🐢 by Mars McConachie &amp; Chris McConachie</footer>
    `;
    // Give the <img> a tick to decode the dataURL before opening the dialog.
    setTimeout(() => window.print(), 50);
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, c =>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // ── Resize divider drag (pointer events for mouse + touch) ─────────
  function initDividerDrag() {
    const divider = document.getElementById('resize-divider');
    const codePane = document.getElementById('code-pane');
    if (!divider || !codePane) return;

    let dragging = false;

    function onDown(e) {
      dragging = true;
      divider.classList.add('dragging');
      divider.setPointerCapture(e.pointerId);
      e.preventDefault();
    }
    function onMove(e) {
      if (!dragging) return;
      const total = window.innerWidth;
      const newCodeW = Math.max(220, Math.min(total - 250, total - e.clientX));
      codePane.style.width = newCodeW + 'px';
    }
    function onUp(e) {
      if (!dragging) return;
      dragging = false;
      divider.classList.remove('dragging');
      try { divider.releasePointerCapture(e.pointerId); } catch (_) {}
      // Trigger canvas resize after drag ends
      if (Turtle.syncCanvasSize) Turtle.syncCanvasSize();
    }

    divider.addEventListener('pointerdown', onDown);
    divider.addEventListener('pointermove', onMove);
    divider.addEventListener('pointerup', onUp);
    divider.addEventListener('pointercancel', onUp);

    // Dbl-click to reset
    divider.addEventListener('dblclick', () => {
      codePane.style.width = '420px';
      if (Turtle.syncCanvasSize) Turtle.syncCanvasSize();
    });
  }

  // ── Global keyboard shortcuts (Shift+Enter, Shift+C) ───────────────
  function initShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Shift+Enter → Run (anywhere on the page, including in the editor)
      if (e.key === 'Enter' && e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const src = Editor.cm ? Editor.cm.getValue() : '';
        if (src.trim()) runProgram(src);
        return;
      }
      // Shift+C → Clear canvas
      // Only fire when the editor doesn't have focus, OR when it's not a printable letter context
      if ((e.key === 'C' || e.key === 'c') && e.shiftKey && !e.ctrlKey && !e.metaKey) {
        const tag = (document.activeElement?.tagName || '').toLowerCase();
        const inEditor = !!document.activeElement?.closest('.CodeMirror');
        // Only intercept if NOT editing text
        if (!inEditor && tag !== 'input' && tag !== 'textarea') {
          e.preventDefault();
          Turtle.clearScreen();
          clearConsole();
        }
      }
    });
  }

  // ── About modal ────────────────────────────────────────────────────
  function initAbout() {
    const btn = document.getElementById('btn-about');
    const modal = document.getElementById('about-modal');
    const backdrop = document.getElementById('about-backdrop');
    const close = document.getElementById('about-close');
    if (!btn || !modal || !backdrop) return;

    function openAbout() {
      modal.classList.add('open');
      backdrop.classList.add('open');
    }
    function closeAbout() {
      modal.classList.remove('open');
      backdrop.classList.remove('open');
    }

    btn.addEventListener('click', openAbout);
    backdrop.addEventListener('click', closeAbout);
    close.addEventListener('click', closeAbout);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('open')) closeAbout();
    });
  }

  // ── Splash screen ──────────────────────────────────────────────────
  function initSplash() {
    const splash = document.getElementById('splash');
    if (!splash) return;
    function dismiss() {
      splash.classList.add('fade-out');
      setTimeout(() => splash.classList.add('hidden'), 700);
    }
    splash.addEventListener('click', dismiss);
    setTimeout(dismiss, 2000);
  }

  // ── Init ──────────────────────────────────────────────────────────
  function init() {
    outputEl = document.getElementById('console-output');

    initSplash();
    initAbout();
    Turtle.init();

    document.getElementById('btn-run').addEventListener('click', () => {
      const src = Editor.cm ? Editor.cm.getValue() : '';
      if (src.trim()) runProgram(src);
    });

    document.getElementById('btn-stop').addEventListener('click', stopProgram);

    document.getElementById('btn-clear').addEventListener('click', () => {
      Turtle.clearScreen();
      clearConsole();
    });

    document.getElementById('btn-clear-code').addEventListener('click', () => {
      if (Editor.cm) {
        Editor.cm.setValue('');
        Editor.cm.focus();
      }
    });

    document.getElementById('btn-print').addEventListener('click', printDocument);

    document.getElementById('console-clear-btn').addEventListener('click', clearConsole);

    initDividerDrag();
    initShortcuts();

    printDim('Ready. Press ▶ Run or Shift+Enter to execute. 🐢');
  }

  return { init, print, printInline, printError, clearConsole, runProgram };
})();

window.addEventListener('DOMContentLoaded', () => App.init());
