/* turtle.js — Dynamic two-canvas turtle graphics renderer */

const Turtle = (() => {

  let W = 800, H = 600;
  let drawingCanvas, drawingCtx;
  let turtleCanvas, turtleCtx;
  let canvasPane;

  const state = {
    x: 0, y: 0,
    heading: 0,
    penDown: true,
    penColor: '#000000',
    penWidth: 1,
    visible: true,
    bgColor: '#ffffff',
    shouldStop: false,
    callDepth: 0,
  };

  function toCanvas(lx, ly) {
    return { cx: W / 2 + lx, cy: H / 2 - ly };
  }

  // ── Init & resize ─────────────────────────────────────────────────
  function init() {
    drawingCanvas = document.getElementById('canvas-drawing');
    turtleCanvas  = document.getElementById('canvas-turtle');
    canvasPane    = document.getElementById('canvas-pane');

    drawingCtx = drawingCanvas.getContext('2d');
    turtleCtx  = turtleCanvas.getContext('2d');

    syncCanvasSize();
    clearScreen();

    // Resize observer keeps the canvas matched to pane size
    const ro = new ResizeObserver(syncCanvasSize);
    ro.observe(canvasPane);
  }

  function syncCanvasSize() {
    if (!canvasPane) return;
    const rect = canvasPane.getBoundingClientRect();
    const newW = Math.max(200, Math.floor(rect.width));
    const newH = Math.max(200, Math.floor(rect.height));
    if (newW === W && newH === H && drawingCanvas.width === newW) return;

    // Preserve current drawing by snapshotting
    let snapshot = null;
    if (drawingCanvas.width > 0 && drawingCanvas.height > 0) {
      snapshot = document.createElement('canvas');
      snapshot.width = drawingCanvas.width;
      snapshot.height = drawingCanvas.height;
      snapshot.getContext('2d').drawImage(drawingCanvas, 0, 0);
    }
    const oldW = W, oldH = H;
    W = newW; H = newH;
    drawingCanvas.width  = W;
    drawingCanvas.height = H;
    turtleCanvas.width   = W;
    turtleCanvas.height  = H;

    // Repaint background
    drawingCtx.fillStyle = state.bgColor;
    drawingCtx.fillRect(0, 0, W, H);

    // Re-center previous drawing (preserve content during pane resize)
    if (snapshot) {
      const dx = Math.floor((W - oldW) / 2);
      const dy = Math.floor((H - oldH) / 2);
      drawingCtx.drawImage(snapshot, dx, dy);
    }
    redrawTurtle();
  }

  // ── Drawing ────────────────────────────────────────────────────────
  function drawLine(x1, y1, x2, y2) {
    const from = toCanvas(x1, y1);
    const to   = toCanvas(x2, y2);
    drawingCtx.beginPath();
    drawingCtx.strokeStyle = state.penColor;
    drawingCtx.lineWidth   = state.penWidth;
    drawingCtx.lineCap     = 'round';
    drawingCtx.lineJoin    = 'round';
    drawingCtx.moveTo(from.cx, from.cy);
    drawingCtx.lineTo(to.cx,   to.cy);
    drawingCtx.stroke();
  }

  function redrawTurtle() {
    turtleCtx.clearRect(0, 0, W, H);
    if (!state.visible) return;
    const { cx, cy } = toCanvas(state.x, state.y);
    // Triangle naturally points UP (heading 0 = north). Rotate clockwise by heading.
    const angleRad = state.heading * Math.PI / 180;
    turtleCtx.save();
    turtleCtx.translate(cx, cy);
    turtleCtx.rotate(angleRad);
    turtleCtx.beginPath();
    turtleCtx.moveTo(0, -13);
    turtleCtx.lineTo(-9, 10);
    turtleCtx.quadraticCurveTo(0, 5, 9, 10);
    turtleCtx.closePath();
    turtleCtx.fillStyle = '#2d9e52';
    turtleCtx.fill();
    turtleCtx.strokeStyle = '#1a6535';
    turtleCtx.lineWidth = 1.5;
    turtleCtx.stroke();
    turtleCtx.beginPath();
    turtleCtx.arc(0, -7, 2, 0, Math.PI * 2);
    turtleCtx.fillStyle = '#ffffff';
    turtleCtx.fill();
    turtleCtx.restore();
  }

  // ── Commands ───────────────────────────────────────────────────────
  function forward(dist) {
    const rad = state.heading * Math.PI / 180;
    const nx = state.x + dist * Math.sin(rad);
    const ny = state.y + dist * Math.cos(rad);
    if (state.penDown) drawLine(state.x, state.y, nx, ny);
    state.x = nx; state.y = ny;
    redrawTurtle();
  }

  function right(deg) {
    state.heading = ((state.heading + deg) % 360 + 360) % 360;
    redrawTurtle();
  }

  function left(deg) { right(-deg); }
  function back(dist) { forward(-dist); }

  function home() {
    state.x = 0; state.y = 0; state.heading = 0;
    redrawTurtle();
  }

  function setX(x) {
    if (state.penDown) drawLine(state.x, state.y, x, state.y);
    state.x = x; redrawTurtle();
  }
  function setY(y) {
    if (state.penDown) drawLine(state.x, state.y, state.x, y);
    state.y = y; redrawTurtle();
  }
  function setXY(x, y) {
    if (state.penDown) drawLine(state.x, state.y, x, y);
    state.x = x; state.y = y; redrawTurtle();
  }
  function setHeading(deg) {
    state.heading = ((deg % 360) + 360) % 360;
    redrawTurtle();
  }

  function penUp()   { state.penDown = false; }
  function penDown() { state.penDown = true;  }
  function showTurtle() { state.visible = true;  redrawTurtle(); }
  function hideTurtle() { state.visible = false; redrawTurtle(); }

  function clearScreen() {
    drawingCtx.fillStyle = state.bgColor;
    drawingCtx.fillRect(0, 0, W, H);
    state.x = 0; state.y = 0; state.heading = 0;
    state.penDown = true;
    redrawTurtle();
  }

  function setBackground(color) {
    state.bgColor = color;
    drawingCtx.fillStyle = color;
    drawingCtx.fillRect(0, 0, W, H);
    redrawTurtle();
  }

  function setPenColor(color) { state.penColor = color; }
  function setPenWidth(w)     { state.penWidth = Math.max(0.5, w); }

  // Draws `text` on the drawing canvas at the turtle's current position,
  // rotated to match the turtle's heading.  Pen color used for text.
  function label(text) {
    if (text === undefined || text === null) return;
    const str = Array.isArray(text) ? text.join(' ') : String(text);
    const { cx, cy } = toCanvas(state.x, state.y);
    const angle = state.heading * Math.PI / 180;
    drawingCtx.save();
    drawingCtx.translate(cx, cy);
    drawingCtx.rotate(angle);
    drawingCtx.fillStyle = state.penColor;
    drawingCtx.font = `${Math.max(12, state.penWidth * 8)}px "Fira Code", monospace`;
    drawingCtx.textBaseline = 'alphabetic';
    drawingCtx.textAlign = 'left';
    drawingCtx.fillText(str, 4, -4);
    drawingCtx.restore();
  }

  function fill() {
    const { cx, cy } = toCanvas(state.x, state.y);
    const sx = Math.round(cx), sy = Math.round(cy);
    if (sx < 0 || sx >= W || sy < 0 || sy >= H) return;

    const imgData = drawingCtx.getImageData(0, 0, W, H);
    const data    = imgData.data;
    const idx     = (x, y) => (y * W + x) * 4;

    const si = idx(sx, sy);
    const seedR = data[si], seedG = data[si+1], seedB = data[si+2];

    const tmp = document.createElement('canvas');
    tmp.width = tmp.height = 1;
    const tmpCtx = tmp.getContext('2d');
    tmpCtx.fillStyle = state.penColor;
    tmpCtx.fillRect(0, 0, 1, 1);
    const fc = tmpCtx.getImageData(0, 0, 1, 1).data;
    const [fr, fg, fb] = [fc[0], fc[1], fc[2]];

    const matches = i =>
      Math.abs(data[i]-seedR)+Math.abs(data[i+1]-seedG)+Math.abs(data[i+2]-seedB) < 45;
    const setPx = i => { data[i]=fr; data[i+1]=fg; data[i+2]=fb; data[i+3]=255; };

    const visited = new Uint8Array(W * H);
    const queue = [[sx, sy]];
    while (queue.length) {
      const [qx, qy] = queue.shift();
      if (qx<0||qx>=W||qy<0||qy>=H||visited[qy*W+qx]||!matches(idx(qx,qy))) continue;
      let lx = qx, rx = qx;
      while (lx>0     && !visited[qy*W+(lx-1)] && matches(idx(lx-1,qy))) lx--;
      while (rx<W-1   && !visited[qy*W+(rx+1)] && matches(idx(rx+1,qy))) rx++;
      for (let x=lx; x<=rx; x++) {
        visited[qy*W+x] = 1;
        setPx(idx(x, qy));
        if (qy>0   && !visited[(qy-1)*W+x]) queue.push([x, qy-1]);
        if (qy<H-1 && !visited[(qy+1)*W+x]) queue.push([x, qy+1]);
      }
    }
    drawingCtx.putImageData(imgData, 0, 0);
  }

  const LOGO_COLORS = [
    '#000000','#0000aa','#00aa00','#00aaaa',
    '#aa0000','#aa00aa','#aa5500','#aaaaaa',
    '#555555','#5555ff','#55ff55','#55ffff',
    '#ff5555','#ff55ff','#ffff55','#ffffff',
  ];

  function colorFromValue(val) {
    if (typeof val === 'number') {
      const i = Math.round(val);
      return LOGO_COLORS[((i % 16) + 16) % 16];
    }
    if (Array.isArray(val) && val.length >= 3) {
      return `rgb(${Math.round(val[0])},${Math.round(val[1])},${Math.round(val[2])})`;
    }
    if (typeof val === 'string') return val;
    return '#000000';
  }

  function getDrawingCanvas() { return drawingCanvas; }
  function getDimensions() { return { W, H }; }

  return {
    state,
    init,
    forward, back, right, left,
    home, setX, setY, setXY, setHeading,
    penUp, penDown,
    showTurtle, hideTurtle,
    clearScreen, setBackground,
    setPenColor, setPenWidth,
    fill, label, colorFromValue,
    getDrawingCanvas, getDimensions, syncCanvasSize,
  };
})();
