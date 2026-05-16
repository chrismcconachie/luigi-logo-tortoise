/* editor.js — CodeMirror 5 setup, Logo mode, autocomplete, help panel */

const Editor = (() => {

  let cm;

  // ══════════════════════════════════════════════════════════════════
  // LOGO CODEMIRROR MODE
  // ══════════════════════════════════════════════════════════════════

  const KEYWORDS = new Set([
    'FORWARD','FD','BACK','BK','RIGHT','RT','LEFT','LT',
    'HOME','SETX','SETY','SETXY','SETHEADING','SETH',
    'PENUP','PU','PENDOWN','PD','PENERASE','PE',
    'SETPENCOLOR','SETPC','PENCOLOR','PC','SETPENWIDTH','PENWIDTH',
    'SETBACKGROUND','SETBG','FILL',
    'SHOWTURTLE','ST','HIDETURTLE','HT',
    'CLEARSCREEN','CS','CLEARTEXT','CT',
    'REPEAT','IF','IFELSE','TO','END',
    'MAKE','LOCAL','OUTPUT','STOP','WAIT',
    'PRINT','SHOW','TYPE',
    'SQRT','ABS','INT','ROUND','SIN','COS','TAN','ARCTAN','ARCSIN','ARCCOS',
    'RANDOM','REMAINDER','MODULO','POWER','MINUS',
    'AND','OR','NOT',
    'EQUALP','NOTEQUALP','LESSP','GREATERP','LESSEQUALP','GREATEREQUALP',
    'XCOR','YCOR','HEADING','PENDOWNP','REPCOUNT',
    'COUNT','FIRST','LAST','BUTFIRST','BUTLAST','ITEM',
    'LIST','SENTENCE','SE','WORD',
    'NUMBERP','WORDP','LISTP','EMPTYP','MEMBERP',
  ]);

  CodeMirror.defineMode('logo', function() {
    return {
      startState: () => ({ needProcName: false }),

      token(stream, state) {
        if (stream.eatSpace()) return null;

        // Comment
        if (stream.eat(';')) { stream.skipToEnd(); return 'comment'; }

        // Brackets
        if (stream.eat('[') || stream.eat(']')) return 'bracket';
        if (stream.eat('(') || stream.eat(')')) return 'bracket';

        // Quoted word  "hello
        if (stream.eat('"')) {
          stream.eatWhile(/[^\s\[\]()]/);
          return 'string';
        }

        // Variable  :name
        if (stream.eat(':')) {
          stream.eatWhile(/[\w?.]/);
          return 'variable-2';
        }

        // Number (including negative)
        if (stream.match(/^-?\d+\.?\d*/)) return 'number';

        // Operators
        if (stream.match(/^[+\-*\/=<>]/)) return 'operator';

        // Word
        if (stream.match(/^[A-Za-z_][A-Za-z0-9_?.+\-]*/)) {
          const word = stream.current().toUpperCase();
          if (word === 'TO')  { state.needProcName = true; return 'keyword'; }
          if (word === 'END') { state.needProcName = false; return 'keyword'; }
          if (state.needProcName) {
            state.needProcName = false;
            return 'def';
          }
          if (KEYWORDS.has(word)) return 'keyword';
          return 'variable';
        }

        stream.next();
        return null;
      },
    };
  });

  // ══════════════════════════════════════════════════════════════════
  // AUTOCOMPLETE DATA
  // ══════════════════════════════════════════════════════════════════

  const COMPLETIONS = [
    { text:'FORWARD',  hint:'FORWARD dist',           desc:'Move forward N steps' },
    { text:'FD',       hint:'FD dist',                desc:'Alias for FORWARD' },
    { text:'BACK',     hint:'BACK dist',              desc:'Move backward N steps' },
    { text:'BK',       hint:'BK dist',                desc:'Alias for BACK' },
    { text:'RIGHT',    hint:'RIGHT angle',            desc:'Turn right (clockwise) by angle°' },
    { text:'RT',       hint:'RT angle',               desc:'Alias for RIGHT' },
    { text:'LEFT',     hint:'LEFT angle',             desc:'Turn left (counter-clockwise) by angle°' },
    { text:'LT',       hint:'LT angle',               desc:'Alias for LEFT' },
    { text:'HOME',     hint:'HOME',                   desc:'Move turtle to center, heading north' },
    { text:'SETX',     hint:'SETX x',                 desc:'Set X position (Logo coords)' },
    { text:'SETY',     hint:'SETY y',                 desc:'Set Y position (Logo coords)' },
    { text:'SETXY',    hint:'SETXY x y',              desc:'Move to absolute (x, y) position' },
    { text:'SETHEADING',hint:'SETHEADING angle',      desc:'Set heading (0=north, clockwise)' },
    { text:'SETH',     hint:'SETH angle',             desc:'Alias for SETHEADING' },
    { text:'PENUP',    hint:'PENUP',                  desc:'Lift pen — move without drawing' },
    { text:'PU',       hint:'PU',                     desc:'Alias for PENUP' },
    { text:'PENDOWN',  hint:'PENDOWN',                desc:'Lower pen — draw while moving' },
    { text:'PD',       hint:'PD',                     desc:'Alias for PENDOWN' },
    { text:'SETPENCOLOR',hint:'SETPENCOLOR color',    desc:'Set pen color (number 0-15 or [R G B])' },
    { text:'SETPC',    hint:'SETPC color',            desc:'Alias for SETPENCOLOR' },
    { text:'SETPENWIDTH',hint:'SETPENWIDTH width',    desc:'Set pen line width in pixels' },
    { text:'FILL',     hint:'FILL',                   desc:'Flood-fill from turtle position' },
    { text:'SETBACKGROUND',hint:'SETBACKGROUND color',desc:'Set canvas background color' },
    { text:'SETBG',    hint:'SETBG color',            desc:'Alias for SETBACKGROUND' },
    { text:'SHOWTURTLE',hint:'SHOWTURTLE',            desc:'Make turtle visible' },
    { text:'ST',       hint:'ST',                     desc:'Alias for SHOWTURTLE' },
    { text:'HIDETURTLE',hint:'HIDETURTLE',            desc:'Hide the turtle icon' },
    { text:'HT',       hint:'HT',                     desc:'Alias for HIDETURTLE' },
    { text:'CLEARSCREEN',hint:'CLEARSCREEN',          desc:'Clear canvas, reset turtle to home' },
    { text:'CS',       hint:'CS',                     desc:'Alias for CLEARSCREEN' },
    { text:'CLEARTEXT',hint:'CLEARTEXT',              desc:'Clear the console output' },
    { text:'CT',       hint:'CT',                     desc:'Alias for CLEARTEXT' },
    { text:'REPEAT',   hint:'REPEAT count [commands]',desc:'Repeat commands N times' },
    { text:'IF',       hint:'IF cond [then]',         desc:'Execute commands if condition is true' },
    { text:'IFELSE',   hint:'IFELSE cond [then] [else]',desc:'If-else branching' },
    { text:'TO',       hint:'TO name :params',        desc:'Define a new procedure' },
    { text:'END',      hint:'END',                    desc:'End a procedure definition' },
    { text:'MAKE',     hint:'MAKE "name value',       desc:'Create or set a variable' },
    { text:'LOCAL',    hint:'LOCAL "name',            desc:'Declare a local variable' },
    { text:'OUTPUT',   hint:'OUTPUT value',           desc:'Return a value from a procedure' },
    { text:'STOP',     hint:'STOP',                   desc:'Exit the current procedure' },
    { text:'WAIT',     hint:'WAIT ticks',             desc:'Pause (1 tick ≈ 1/60 second)' },
    { text:'PRINT',    hint:'PRINT value',            desc:'Print value to console' },
    { text:'SHOW',     hint:'SHOW value',             desc:'Print value (with brackets for lists)' },
    { text:'SQRT',     hint:'SQRT number',            desc:'Square root' },
    { text:'ABS',      hint:'ABS number',             desc:'Absolute value' },
    { text:'INT',      hint:'INT number',             desc:'Truncate to integer' },
    { text:'ROUND',    hint:'ROUND number',           desc:'Round to nearest integer' },
    { text:'SIN',      hint:'SIN degrees',            desc:'Sine (input in degrees)' },
    { text:'COS',      hint:'COS degrees',            desc:'Cosine (input in degrees)' },
    { text:'TAN',      hint:'TAN degrees',            desc:'Tangent (input in degrees)' },
    { text:'ARCTAN',   hint:'ARCTAN ratio',           desc:'Arctangent (returns degrees)' },
    { text:'RANDOM',   hint:'RANDOM n',               desc:'Random integer 0 to n-1' },
    { text:'REMAINDER',hint:'REMAINDER a b',          desc:'Remainder of a divided by b' },
    { text:'POWER',    hint:'POWER base exp',         desc:'base raised to exp' },
    { text:'AND',      hint:'AND a b',                desc:'Logical AND of two values' },
    { text:'OR',       hint:'OR a b',                 desc:'Logical OR of two values' },
    { text:'NOT',      hint:'NOT value',              desc:'Logical NOT' },
    { text:'REPCOUNT', hint:'REPCOUNT',               desc:'Current iteration count in REPEAT' },
    { text:'XCOR',     hint:'XCOR',                   desc:'Turtle X coordinate' },
    { text:'YCOR',     hint:'YCOR',                   desc:'Turtle Y coordinate' },
    { text:'HEADING',  hint:'HEADING',                desc:'Turtle heading in degrees' },
    { text:'PENDOWNP', hint:'PENDOWNP',               desc:'TRUE if pen is down' },
    { text:'COUNT',    hint:'COUNT list',             desc:'Number of items in list or word' },
    { text:'FIRST',    hint:'FIRST list',             desc:'First item of list or character of word' },
    { text:'LAST',     hint:'LAST list',              desc:'Last item of list or character' },
    { text:'BUTFIRST', hint:'BUTFIRST list',          desc:'List without first item' },
    { text:'BUTLAST',  hint:'BUTLAST list',           desc:'List without last item' },
    { text:'LIST',     hint:'LIST a b',               desc:'Create a two-element list' },
    { text:'SENTENCE', hint:'SENTENCE a b',           desc:'Join two lists or items' },
    { text:'SE',       hint:'SE a b',                 desc:'Alias for SENTENCE' },
  ];

  function logoHint(cm) {
    const cursor = cm.getCursor();
    const token  = cm.getTokenAt(cursor);

    // Suppress in comments / strings / variables
    if (!token.string || token.type === 'comment') return null;
    if (token.string.startsWith(':') || token.string.startsWith('"')) return null;

    const word = token.string.toUpperCase();
    if (word.length < 1) return null;

    const matches = COMPLETIONS.filter(c => c.text.startsWith(word));
    if (matches.length === 0) return null;

    return {
      list: matches.map(m => ({
        text: m.text,
        displayText: m.hint,
        render(el) {
          const nameSpan = document.createElement('span');
          nameSpan.className = 'logo-hint-name';
          nameSpan.textContent = m.hint;
          el.appendChild(nameSpan);
          const descSpan = document.createElement('span');
          descSpan.className = 'logo-hint-desc';
          descSpan.textContent = m.desc;
          el.appendChild(descSpan);
        },
      })),
      from: CodeMirror.Pos(cursor.line, token.start),
      to:   CodeMirror.Pos(cursor.line, token.end),
    };
  }

  // ══════════════════════════════════════════════════════════════════
  // HELP PANEL DATA
  // ══════════════════════════════════════════════════════════════════

  const HELP_DATA = [
    { cat:'Movement', cmds:[
      { name:'FORWARD', aliases:['FD'], syntax:'FORWARD dist', params:[{n:'dist',d:'Number of steps to move'}], desc:'Moves the turtle forward in the direction it is facing.', ex:'FD 100\nFORWARD 50' },
      { name:'BACK',    aliases:['BK'], syntax:'BACK dist',    params:[{n:'dist',d:'Steps to move backward'}],  desc:'Moves the turtle backward.',                              ex:'BK 100' },
      { name:'RIGHT',   aliases:['RT'], syntax:'RIGHT angle',  params:[{n:'angle',d:'Degrees to turn clockwise'}], desc:'Turns the turtle right (clockwise).', ex:'RT 90\nRIGHT 45' },
      { name:'LEFT',    aliases:['LT'], syntax:'LEFT angle',   params:[{n:'angle',d:'Degrees to turn left'}],   desc:'Turns the turtle left (counter-clockwise).', ex:'LT 90' },
      { name:'HOME',    aliases:[],     syntax:'HOME',         params:[], desc:'Moves turtle to center (0,0), resets heading to north (0°).', ex:'HOME' },
      { name:'SETXY',   aliases:[],     syntax:'SETXY x y',   params:[{n:'x',d:'Horizontal position'},{n:'y',d:'Vertical position'}], desc:'Moves turtle to an absolute position.', ex:'SETXY 100 50' },
      { name:'SETHEADING', aliases:['SETH'], syntax:'SETHEADING angle', params:[{n:'angle',d:'0=north, 90=east, 180=south'}], desc:'Sets the turtle\'s heading (direction).', ex:'SETH 45' },
    ]},
    { cat:'Pen', cmds:[
      { name:'PENUP',   aliases:['PU'],    syntax:'PENUP',   params:[], desc:'Lifts the pen — turtle moves without drawing.', ex:'PU\nFD 50\nPD' },
      { name:'PENDOWN', aliases:['PD'],    syntax:'PENDOWN', params:[], desc:'Lowers the pen — turtle draws as it moves.',    ex:'PD' },
      { name:'SETPENCOLOR', aliases:['SETPC'], syntax:'SETPENCOLOR color', params:[{n:'color',d:'0-15 for palette, or [R G B] list'}], desc:'Sets the drawing color.', ex:'SETPC 4\nSETPC [255 0 128]' },
      { name:'SETPENWIDTH', aliases:[],  syntax:'SETPENWIDTH width', params:[{n:'width',d:'Line width in pixels'}], desc:'Sets pen line thickness.', ex:'SETPENWIDTH 3' },
      { name:'FILL',    aliases:[],       syntax:'FILL',    params:[], desc:'Flood-fills from turtle\'s position using current pen color.', ex:'REPEAT 4 [FD 80 RT 90]\nFILL' },
      { name:'SETBACKGROUND', aliases:['SETBG'], syntax:'SETBG color', params:[{n:'color',d:'Color number or [R G B]'}], desc:'Sets the canvas background color.', ex:'SETBG 1' },
    ]},
    { cat:'Turtle', cmds:[
      { name:'SHOWTURTLE', aliases:['ST'], syntax:'SHOWTURTLE', params:[], desc:'Makes the turtle icon visible.', ex:'ST' },
      { name:'HIDETURTLE', aliases:['HT'], syntax:'HIDETURTLE', params:[], desc:'Hides the turtle icon (drawing continues).', ex:'HT' },
      { name:'CLEARSCREEN', aliases:['CS'], syntax:'CLEARSCREEN', params:[], desc:'Clears the canvas and resets turtle to home.', ex:'CS' },
    ]},
    { cat:'Control', cmds:[
      { name:'REPEAT', aliases:[], syntax:'REPEAT count [commands]', params:[{n:'count',d:'Number of repetitions'},{n:'[commands]',d:'Commands to repeat'}], desc:'Repeats a block of commands N times. Use REPCOUNT for iteration number.', ex:'REPEAT 4 [FD 100 RT 90]\nREPEAT 36 [FD 5 RT 10]' },
      { name:'IF',     aliases:[], syntax:'IF condition [then]',     params:[{n:'condition',d:'Expression that evaluates to TRUE or FALSE'},{n:'[then]',d:'Commands to run if true'}], desc:'Executes commands if condition is true. Optionally add [else] block.', ex:'IF XCOR > 50 [PRINT "Too far!]' },
      { name:'IFELSE', aliases:[], syntax:'IFELSE cond [then] [else]', params:[{n:'cond',d:'Condition'},{n:'[then]',d:'If true'},{n:'[else]',d:'If false'}], desc:'Executes one of two blocks depending on condition.', ex:'IFELSE REPCOUNT = 1 [SETPC 4] [SETPC 1]' },
      { name:'WAIT',   aliases:[], syntax:'WAIT ticks',              params:[{n:'ticks',d:'Duration (1 tick ≈ 1/60 second)'}], desc:'Pauses execution.', ex:'WAIT 30' },
    ]},
    { cat:'Procedures', cmds:[
      { name:'TO',     aliases:[], syntax:'TO name :param1 :param2 ...\n  commands\nEND', params:[{n:'name',d:'Procedure name'},{n:':params',d:'Input variables'}], desc:'Defines a reusable procedure (like a function).', ex:'TO SQUARE :SIZE\n  REPEAT 4 [FD :SIZE RT 90]\nEND\nSQUARE 100' },
      { name:'OUTPUT', aliases:[], syntax:'OUTPUT value', params:[{n:'value',d:'Value to return'}], desc:'Returns a value from a procedure and stops it.', ex:'TO DOUBLE :N\n  OUTPUT :N * 2\nEND\nPRINT DOUBLE 5' },
      { name:'STOP',   aliases:[], syntax:'STOP', params:[], desc:'Exits the current procedure immediately.', ex:'TO SAFE :N\n  IF :N < 0 [STOP]\n  FD :N\nEND' },
      { name:'MAKE',   aliases:[], syntax:'MAKE "name value', params:[{n:'"name',d:'Variable name (quoted)'},{n:'value',d:'Value to store'}], desc:'Creates or sets a variable.', ex:'MAKE "SIZE 100\nFD :SIZE' },
      { name:'LOCAL',  aliases:[], syntax:'LOCAL "name', params:[{n:'"name',d:'Variable name'}], desc:'Declares a variable local to the current procedure.', ex:'LOCAL "COUNTER\nMAKE "COUNTER 0' },
    ]},
    { cat:'Math', cmds:[
      { name:'SQRT',  aliases:[], syntax:'SQRT n',    params:[{n:'n',d:'Non-negative number'}], desc:'Square root.', ex:'PRINT SQRT 16' },
      { name:'ABS',   aliases:[], syntax:'ABS n',     params:[{n:'n',d:'Number'}], desc:'Absolute value.', ex:'PRINT ABS -5' },
      { name:'RANDOM',aliases:[], syntax:'RANDOM n',  params:[{n:'n',d:'Upper bound (exclusive)'}], desc:'Random integer from 0 to n-1.', ex:'SETPC RANDOM 16' },
      { name:'SIN',   aliases:[], syntax:'SIN deg',   params:[{n:'deg',d:'Angle in degrees'}], desc:'Sine (returns value between -1 and 1).', ex:'PRINT SIN 30' },
      { name:'COS',   aliases:[], syntax:'COS deg',   params:[{n:'deg',d:'Angle in degrees'}], desc:'Cosine.',  ex:'PRINT COS 60' },
      { name:'POWER', aliases:[], syntax:'POWER b e', params:[{n:'b',d:'Base'},{n:'e',d:'Exponent'}], desc:'b raised to the power e.', ex:'PRINT POWER 2 8' },
    ]},
    { cat:'Query', cmds:[
      { name:'XCOR',     aliases:[], syntax:'XCOR',     params:[], desc:'Current X coordinate of turtle.', ex:'PRINT XCOR' },
      { name:'YCOR',     aliases:[], syntax:'YCOR',     params:[], desc:'Current Y coordinate of turtle.', ex:'PRINT YCOR' },
      { name:'HEADING',  aliases:[], syntax:'HEADING',  params:[], desc:'Current heading in degrees.', ex:'PRINT HEADING' },
      { name:'REPCOUNT', aliases:[], syntax:'REPCOUNT', params:[], desc:'Current iteration number inside REPEAT (starts at 1).', ex:'REPEAT 5 [PRINT REPCOUNT]' },
      { name:'PENDOWNP', aliases:[], syntax:'PENDOWNP', params:[], desc:'TRUE if pen is currently down.', ex:'IF PENDOWNP [PRINT "Drawing]' },
    ]},
  ];

  // ── Build help list ───────────────────────────────────────────────
  function buildHelpList(filter = '') {
    const listEl = document.getElementById('help-list');
    listEl.innerHTML = '';
    const q = filter.toLowerCase();

    HELP_DATA.forEach(({ cat, cmds }) => {
      const visible = cmds.filter(c =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.aliases.some(a => a.toLowerCase().includes(q)) ||
        c.desc.toLowerCase().includes(q)
      );
      if (visible.length === 0) return;

      const label = document.createElement('div');
      label.className = 'help-category-label';
      label.textContent = cat;
      listEl.appendChild(label);

      visible.forEach(cmd => {
        const row = document.createElement('div');
        row.className = 'help-cmd-row';
        row.dataset.name = cmd.name;

        const nameEl = document.createElement('span');
        nameEl.className = 'help-cmd-name';
        nameEl.textContent = cmd.name;

        const aliasEl = document.createElement('span');
        aliasEl.className = 'help-cmd-aliases';
        aliasEl.textContent = cmd.aliases.length ? `(${cmd.aliases.join(', ')})` : '';

        row.appendChild(nameEl);
        row.appendChild(aliasEl);
        row.addEventListener('click', () => showHelpDetail(cmd));
        listEl.appendChild(row);
      });
    });
  }

  function showHelpDetail(cmd) {
    // Deactivate previous
    document.querySelectorAll('.help-cmd-row.active').forEach(r => r.classList.remove('active'));
    const row = document.querySelector(`.help-cmd-row[data-name="${cmd.name}"]`);
    if (row) row.classList.add('active');

    const detailEl = document.getElementById('help-detail');
    detailEl.innerHTML = '';
    detailEl.classList.add('visible');

    const nameEl = document.createElement('div');
    nameEl.className = 'help-detail-name';
    nameEl.textContent = cmd.name + (cmd.aliases.length ? `  (${cmd.aliases.join(', ')})` : '');
    detailEl.appendChild(nameEl);

    const synEl = document.createElement('div');
    synEl.className = 'help-detail-syntax';
    synEl.textContent = cmd.syntax;
    detailEl.appendChild(synEl);

    const descEl = document.createElement('div');
    descEl.className = 'help-detail-desc';
    descEl.textContent = cmd.desc;
    detailEl.appendChild(descEl);

    if (cmd.params.length) {
      const paramsEl = document.createElement('div');
      paramsEl.className = 'help-detail-params';
      cmd.params.forEach(p => {
        const pEl = document.createElement('div');
        pEl.className = 'help-detail-param';
        pEl.innerHTML = `<strong>${p.n}</strong> — ${p.d}`;
        paramsEl.appendChild(pEl);
      });
      detailEl.appendChild(paramsEl);
    }

    if (cmd.ex) {
      const exLabel = document.createElement('div');
      exLabel.className = 'help-detail-example-label';
      exLabel.textContent = 'Example';
      detailEl.appendChild(exLabel);

      const exEl = document.createElement('pre');
      exEl.className = 'help-detail-example';
      exEl.textContent = cmd.ex;
      exEl.title = 'Click to insert into editor';
      exEl.addEventListener('click', () => {
        if (cm) {
          cm.setValue(cmd.ex);
          cm.focus();
        }
      });
      detailEl.appendChild(exEl);

      const hint = document.createElement('div');
      hint.className = 'help-detail-example-hint';
      hint.textContent = 'Click example to load into editor';
      detailEl.appendChild(hint);
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // INIT
  // ══════════════════════════════════════════════════════════════════

  function init() {
    const editorWrap = document.getElementById('editor-wrap');

    cm = CodeMirror(editorWrap, {
      mode:           'logo',
      theme:          'default',
      lineNumbers:    true,
      matchBrackets:  { pairs:'()[]' },
      autoCloseBrackets: { pairs:'()[]', override:true },
      indentUnit:     2,
      tabSize:        2,
      indentWithTabs: false,
      lineWrapping:   false,
      autofocus:      true,
      extraKeys: {
        'Ctrl-Enter': () => {
          const src = cm.getValue();
          if (src.trim()) App.runProgram(src);
        },
        'Shift-Enter': () => {
          const src = cm.getValue();
          if (src.trim()) App.runProgram(src);
        },
        'Cmd-Enter': () => {
          const src = cm.getValue();
          if (src.trim()) App.runProgram(src);
        },
        'Ctrl-Space': (cm) => cm.showHint({ hint: logoHint, completeSingle: false }),
        'Tab': (cm) => cm.replaceSelection('  '),
      },
      value: `; Welcome to Luigi Logo Tortoise!\n; Try: REPEAT 4 [FD 100 RT 90]\n; Press Shift+Enter or click ▶ Run\n\nREPEAT 4 [FD 100 RT 90]\n`,
    });

    // Apply custom color classes
    cm.getWrapperElement().classList.add('cm-s-logo');

    // Trigger autocomplete on keystrokes
    cm.on('inputRead', (instance, change) => {
      if (change.text[0] === '\n') return;
      if (instance.state.completionActive) return;
      const cursor = instance.getCursor();
      const token  = instance.getTokenAt(cursor);
      if (!token.string || token.type === 'comment' || token.type === 'string') return;
      if (token.string.startsWith(':') || token.string.startsWith('"')) return;
      if (token.string.trim().length < 1) return;
      instance.showHint({ hint: logoHint, completeSingle: false, closeOnUnfocus: true });
    });

    // Build help list
    buildHelpList();

    // Help search
    document.getElementById('help-search').addEventListener('input', (e) => {
      buildHelpList(e.target.value);
    });
  }

  return { init, cm: null, get cm() { return cm; } };
})();

// Init after DOM + CodeMirror ready
window.addEventListener('DOMContentLoaded', () => Editor.init());
