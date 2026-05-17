/* interpreter.js — Luigi Logo Tortoise tokenizer, parser, evaluator */

const Logo = (() => {

  // ══════════════════════════════════════════════════════════════════
  // TOKENIZER
  // ══════════════════════════════════════════════════════════════════

  const TT = { WORD:'WORD', NUMBER:'NUMBER', LBRAK:'LBRAK', RBRAK:'RBRAK',
               LPAREN:'LPAREN', RPAREN:'RPAREN', NEWLINE:'NEWLINE', EOF:'EOF' };

  function tokenize(src) {
    const tokens = [];
    let i = 0, line = 1, col = 1;
    let prevWasSpace = true; // start-of-input counts as whitespace

    function peek()  { return src[i]; }
    function next()  { const c = src[i++]; if(c==='\n'){line++;col=1;}else col++; return c; }
    function done()  { return i >= src.length; }
    function tok(type, value) { return { type, value, line, col }; }

    while (!done()) {
      const c = peek();

      // Whitespace (not newline)
      if (c === ' ' || c === '\t' || c === '\r') { next(); prevWasSpace = true; continue; }

      // Newline
      if (c === '\n') { next(); tokens.push(tok(TT.NEWLINE, '\n')); prevWasSpace = true; continue; }

      // Comment
      if (c === ';') {
        while (!done() && peek() !== '\n') next();
        prevWasSpace = true;
        continue;
      }

      // Brackets / parens
      if (c === '[') { next(); tokens.push(tok(TT.LBRAK, '[')); prevWasSpace = true; continue; }
      if (c === ']') { next(); tokens.push(tok(TT.RBRAK, ']')); prevWasSpace = false; continue; }
      if (c === '(') { next(); tokens.push(tok(TT.LPAREN, '(')); prevWasSpace = true; continue; }
      if (c === ')') { next(); tokens.push(tok(TT.RPAREN, ')')); prevWasSpace = false; continue; }

      // Quoted word  "abc
      if (c === '"') {
        next(); // consume "
        let w = '"';
        while (!done() && !/[\s\[\]()]/.test(peek())) w += next();
        tokens.push(tok(TT.WORD, w));
        prevWasSpace = false;
        continue;
      }

      // Variable :name
      if (c === ':') {
        next();
        let w = ':';
        while (!done() && /[\w?.]/.test(peek())) w += next();
        tokens.push(tok(TT.WORD, w));
        prevWasSpace = false;
        continue;
      }

      // Negative number literal: whitespace-before + no-whitespace-after + digit
      // This is Logo's standard rule for distinguishing negation from subtraction.
      if (c === '-' && prevWasSpace && i + 1 < src.length && /[\d.]/.test(src[i + 1])) {
        next();
        let n = '-';
        while (!done() && /[\d.]/.test(peek())) n += next();
        tokens.push(tok(TT.NUMBER, parseFloat(n)));
        prevWasSpace = false;
        continue;
      }

      // Number
      if (/\d/.test(c) || (c === '.' && /\d/.test(src[i+1]||''))) {
        let n = '';
        while (!done() && /[\d.]/.test(peek())) n += next();
        tokens.push(tok(TT.NUMBER, parseFloat(n)));
        prevWasSpace = false;
        continue;
      }

      // Operator / punctuation (single char)
      if ('+-*/=<>'.includes(c)) {
        next();
        tokens.push(tok(TT.WORD, c));
        prevWasSpace = true; // operator implicitly creates a "value-needed" context
        continue;
      }

      // Bare word (command or user proc name)
      if (/[A-Za-z_?.]/.test(c)) {
        let w = '';
        while (!done() && /[A-Za-z0-9_?.+\-]/.test(peek())) w += next();
        tokens.push(tok(TT.WORD, w.toUpperCase()));
        prevWasSpace = false;
        continue;
      }

      // Unknown char — skip
      next();
    }

    tokens.push(tok(TT.EOF, ''));
    return tokens;
  }

  // ══════════════════════════════════════════════════════════════════
  // PARSER
  // ══════════════════════════════════════════════════════════════════

  // Built-in arity table (0 = no args, N = fixed args, -1 = special)
  const BUILTIN_ARITY = {
    FORWARD:1,FD:1,BACK:1,BK:1,
    RIGHT:1,RT:1,LEFT:1,LT:1,
    SETX:1,SETY:1,SETXY:2,SETHEADING:1,SETH:1,
    HOME:0,CLEARSCREEN:0,CS:0,CLEARTEXT:0,CT:0,
    PENUP:0,PU:0,PENDOWN:0,PD:0,PENERASE:0,PE:0,
    SETPENCOLOR:1,SETPC:1,PENCOLOR:0,PC:0,
    SETPENWIDTH:1,PENWIDTH:0,
    SETBACKGROUND:1,SETBG:1,
    SHOWTURTLE:0,ST:0,HIDETURTLE:0,HT:0,
    FILL:0,
    PRINT:1,SHOW:1,TYPE:1,
    LABEL:1,TT:1,
    WAIT:1,STOP:0,OUTPUT:1,
    MAKE:2,LOCAL:1,
    IF:-1,IFELSE:3,     // IF handled specially
    REPEAT:2,
    TO:-1,END:-1,       // handled specially
    SQRT:1,ABS:1,INT:1,ROUND:1,
    SIN:1,COS:1,TAN:1,ARCTAN:1,ARCSIN:1,ARCCOS:1,
    RANDOM:1,REMAINDER:2,MODULO:2,POWER:2,
    AND:2,OR:2,NOT:1,
    EQUALP:2,NOTEQUALP:2,LESSP:2,GREATERP:2,LESSEQUALP:2,GREATEREQUALP:2,
    XCOR:0,YCOR:0,HEADING:0,PENDOWNP:0,PENUPSTATE:0,
    REPCOUNT:0,TURTLESTATE:0,
    ITEM:2,COUNT:1,FIRST:1,LAST:1,BUTFIRST:1,BUTLAST:1,
    LIST:2,SENTENCE:2,SE:2,WORD:2,
    NUMBERP:1,WORDP:1,LISTP:1,EMPTYP:1,MEMBERP:2,
    MINUS:1,
  };

  // User-defined procedure arities (populated by pre-pass)
  let userArity = {};

  function getArity(name) {
    if (name in userArity)    return userArity[name];
    if (name in BUILTIN_ARITY) return BUILTIN_ARITY[name];
    return null;
  }

  // Pre-pass: register TO proc arities so forward calls parse correctly
  function prePass(tokens) {
    userArity = {};
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type === TT.WORD && tokens[i].value === 'TO') {
        i++;
        if (i >= tokens.length || tokens[i].type !== TT.WORD) continue;
        const name = tokens[i].value;
        i++;
        let count = 0;
        while (i < tokens.length && tokens[i].type === TT.WORD &&
               tokens[i].value.startsWith(':')) {
          count++; i++;
        }
        userArity[name] = count;
      }
    }
  }

  class LogoError extends Error {
    constructor(msg, token) {
      super(msg);
      this.logoMsg = msg;
      this.token = token;
    }
  }

  class StopSignal  extends Error { constructor() { super('STOP'); } }
  class OutputSignal extends Error { constructor(val) { super('OUTPUT'); this.value = val; } }

  function parse(src) {
    const tokens = tokenize(src);
    prePass(tokens);

    let pos = 0;

    function peek(offset=0) { return tokens[Math.min(pos+offset, tokens.length-1)]; }
    function advance() { return tokens[pos++]; }
    function atEnd() { return peek().type === TT.EOF; }

    function skipNewlines() {
      while (peek().type === TT.NEWLINE) advance();
    }

    function expect(type, val) {
      const t = advance();
      if (t.type !== type || (val !== undefined && t.value !== val)) {
        throw new LogoError(`Expected ${val || type}, got '${t.value}'`, t);
      }
      return t;
    }

    // ── Expression parsing ────────────────────────────────────────
    // Returns an AST node for an expression

    function parseExpr() {
      return parseInfix(0);
    }

    const INFIX_PREC = { '+':1, '-':1, '*':2, '/':2, '=':0, '<':0, '>':0 };

    function parseInfix(minPrec) {
      let left = parsePrimary();
      while (true) {
        const t = peek();
        if (t.type !== TT.WORD) break;
        const prec = INFIX_PREC[t.value];
        if (prec === undefined || prec < minPrec) break;
        advance();
        const right = parseInfix(prec + 1);
        left = { type:'InfixOp', op:t.value, left, right, line:t.line };
      }
      return left;
    }

    function parsePrimary() {
      skipNewlines();
      const t = peek();

      if (t.type === TT.NUMBER) {
        advance();
        return { type:'NumberLit', value:t.value };
      }

      if (t.type === TT.LBRAK) {
        return parseListLiteral();
      }

      if (t.type === TT.LPAREN) {
        advance();
        const e = parseExpr();
        if (peek().type === TT.RPAREN) advance();
        return e;
      }

      if (t.type === TT.WORD) {
        // :varname
        if (t.value.startsWith(':')) {
          advance();
          return { type:'VarRef', name:t.value.slice(1).toUpperCase(), line:t.line };
        }
        // "string literal
        if (t.value.startsWith('"')) {
          advance();
          return { type:'StringLit', value:t.value.slice(1), line:t.line };
        }
        // Operator as primary (e.g. unary minus — handled by MINUS command)
        if (t.value === '-') {
          advance();
          const operand = parsePrimary();
          return { type:'InfixOp', op:'-', left:{type:'NumberLit',value:0}, right:operand };
        }
        // Function/command call in expression position
        const name = t.value;
        const arity = getArity(name);
        if (arity !== null && arity !== -1 && arity >= 0) {
          advance();
          return parseCall(name, arity, t);
        }
        // Unknown word — treat as string
        advance();
        return { type:'StringLit', value:t.value, line:t.line };
      }

      throw new LogoError(`Unexpected token '${t.value}' at line ${t.line}`, t);
    }

    function parseListLiteral() {
      const t = peek();
      advance(); // [
      const items = [];
      while (peek().type !== TT.RBRAK && !atEnd()) {
        if (peek().type === TT.NEWLINE) { advance(); continue; }
        if (peek().type === TT.LBRAK) {
          items.push(parseListLiteral());
          continue;
        }
        // Inside a list literal, every word/number is a *literal value*.
        // We must NOT call parseExpr here — that would treat words like
        // `LIST`, `FIRST`, etc. as built-in function calls and consume
        // following items as their arguments.  Logo lists are pure data.
        const tok = advance();
        if (tok.type === TT.NUMBER) {
          items.push({ type:'NumberLit', value: tok.value, line: tok.line });
        } else if (tok.type === TT.WORD) {
          let v = tok.value;
          if (v.startsWith('"') || v.startsWith(':')) v = v.slice(1);
          items.push({ type:'StringLit', value: v, line: tok.line });
        }
        // Other token types are silently skipped (e.g. stray operators)
      }
      if (peek().type === TT.RBRAK) advance();
      return { type:'ListLit', items, line:t.line };
    }

    // Parse a block [...] as a list of statements
    function parseBlock() {
      expect(TT.LBRAK);
      const body = [];
      while (peek().type !== TT.RBRAK && !atEnd()) {
        skipNewlines();
        if (peek().type === TT.RBRAK) break;
        const stmt = parseStatement();
        if (stmt) body.push(stmt);
      }
      if (peek().type === TT.RBRAK) advance();
      return { type:'Block', body };
    }

    function parseCall(name, arity, tok) {
      const args = [];
      for (let i = 0; i < arity; i++) {
        // `[...]` in an argument slot is always a LIST literal here.
        // REPEAT / IF / IFELSE are handled by their own parser branches
        // above (which explicitly call parseBlock), so we never reach
        // this point needing to parse a code block.
        args.push(parseExpr());
      }
      return { type:'Call', name, args, line:tok.line };
    }

    // ── Statement parsing ─────────────────────────────────────────
    function parseStatements(stopWords = []) {
      const stmts = [];
      while (!atEnd()) {
        skipNewlines();
        if (atEnd()) break;
        const t = peek();
        if (t.type === TT.RBRAK) break;
        if (stopWords.includes(t.value)) break;
        const stmt = parseStatement();
        if (stmt) stmts.push(stmt);
      }
      return stmts;
    }

    function parseStatement() {
      skipNewlines();
      const t = peek();

      if (t.type === TT.NEWLINE || t.type === TT.EOF) return null;

      if (t.type !== TT.WORD) {
        // Could be an expression used as a statement (unusual but allow)
        const e = parseExpr();
        return { type:'ExprStmt', expr:e };
      }

      const name = t.value;

      // ── TO procedure definition ──────────────────────────────
      if (name === 'TO') {
        advance();
        const nameTok = advance();
        const procName = nameTok.value;
        const params = [];
        while (peek().type === TT.WORD && peek().value.startsWith(':')) {
          params.push(advance().value.slice(1).toUpperCase());
        }
        // skip newline after header
        while (peek().type === TT.NEWLINE) advance();
        const body = parseStatements(['END']);
        if (peek().value === 'END') advance();
        // Register arity
        userArity[procName] = params.length;
        return { type:'ProcDef', name:procName, params, body, line:nameTok.line };
      }

      if (name === 'END') { advance(); return null; }

      // ── REPEAT ───────────────────────────────────────────────
      if (name === 'REPEAT') {
        advance();
        const count = parseExpr();
        const block = parseBlock();
        return { type:'Repeat', count, block, line:t.line };
      }

      // ── IF / IFELSE ──────────────────────────────────────────
      if (name === 'IF' || name === 'IFELSE') {
        advance();
        const cond = parseExpr();
        const then = parseBlock();
        let els = null;
        // peek for optional else block (IF) or required (IFELSE)
        const next = peek();
        if (next.type === TT.LBRAK || name === 'IFELSE') {
          els = parseBlock();
        }
        return { type:'If', cond, then, els, line:t.line };
      }

      // ── MAKE ─────────────────────────────────────────────────
      if (name === 'MAKE') {
        advance();
        const varTok = advance(); // should be "name
        let varName = varTok.value;
        if (varName.startsWith('"')) varName = varName.slice(1);
        varName = varName.toUpperCase();
        const value = parseExpr();
        return { type:'Make', varName, value, line:t.line };
      }

      // ── LOCAL ────────────────────────────────────────────────
      if (name === 'LOCAL') {
        advance();
        const varTok = advance();
        let varName = varTok.value;
        if (varName.startsWith('"')) varName = varName.slice(1);
        return { type:'Local', varName:varName.toUpperCase(), line:t.line };
      }

      // ── STOP ─────────────────────────────────────────────────
      if (name === 'STOP') { advance(); return { type:'Stop', line:t.line }; }

      // ── OUTPUT ───────────────────────────────────────────────
      if (name === 'OUTPUT') {
        advance();
        const val = parseExpr();
        return { type:'Output', value:val, line:t.line };
      }

      // ── Known command or user proc ────────────────────────────
      const arity = getArity(name);
      if (arity !== null && arity !== -1 && arity >= 0) {
        advance();
        return parseCall(name, arity, t);
      }

      // Unknown — try as zero-arg call (may fail at eval time)
      advance();
      return { type:'Call', name, args:[], line:t.line };
    }

    return parseStatements();
  }

  // ══════════════════════════════════════════════════════════════════
  // ENVIRONMENT
  // ══════════════════════════════════════════════════════════════════

  class Env {
    constructor(parent = null) {
      this.vars = Object.create(null);
      this.parent = parent;
    }

    get(name) {
      if (name in this.vars) return this.vars[name];
      if (this.parent) return this.parent.get(name);
      throw new LogoError(`I don't know the value of :${name}`);
    }

    set(name, value) {
      // Dynamic scope: find existing binding up the chain; else create in global
      let env = this;
      while (env) {
        if (name in env.vars) { env.vars[name] = value; return; }
        env = env.parent;
      }
      // Not found — set in global (walk to root)
      let root = this;
      while (root.parent) root = root.parent;
      root.vars[name] = value;
    }

    setLocal(name, value) { this.vars[name] = value; }

    has(name) {
      if (name in this.vars) return true;
      if (this.parent) return this.parent.has(name);
      return false;
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // EVALUATOR  (async generator)
  // ══════════════════════════════════════════════════════════════════

  const DEG = Math.PI / 180;

  function* evalNodes(nodes, env) {
    for (const node of nodes) {
      if (Turtle.state.shouldStop) return;
      yield* evalNode(node, env);
    }
  }

  function* evalNode(node, env) {
    if (Turtle.state.shouldStop) return;

    switch (node.type) {

      case 'ProcDef':
        env.setLocal(node.name, { __proc__:true, params:node.params, body:node.body });
        break;

      case 'Repeat': {
        const count = Math.round(evalExpr(node.count, env));
        env.setLocal('REPCOUNT_STACK', (env.has('REPCOUNT_STACK') ? env.get('REPCOUNT_STACK') : 0));
        for (let i = 1; i <= count; i++) {
          if (Turtle.state.shouldStop) return;
          env.setLocal('REPCOUNT', i);
          yield* evalNodes(node.block.body, env);
        }
        break;
      }

      case 'If': {
        const cond = evalExpr(node.cond, env);
        const branch = isTruthy(cond) ? node.then : node.els;
        if (branch) yield* evalNodes(branch.body, env);
        break;
      }

      case 'Make':
        env.set(node.varName, evalExpr(node.value, env));
        break;

      case 'Local':
        env.setLocal(node.varName, 0);
        break;

      case 'Stop':
        throw new StopSignal();

      case 'Output':
        throw new OutputSignal(evalExpr(node.value, env));

      case 'ExprStmt':
        evalExpr(node.expr, env);
        break;

      case 'Call':
        yield* evalCall(node.name, node.args, env, node.line);
        break;

      default:
        // Treat top-level expression nodes as calls too
        if (node.type === 'InfixOp' || node.type === 'VarRef') {
          evalExpr(node, env); // discard result
        }
        break;
    }
  }

  function isTruthy(v) {
    if (v === true  || v === 'TRUE'  || v === 1)  return true;
    if (v === false || v === 'FALSE' || v === 0)   return false;
    if (typeof v === 'string') return v.toUpperCase() === 'TRUE';
    return !!v;
  }

  function* evalCall(name, argNodes, env, lineNum) {
    // ── User-defined procedure ────────────────────────────────────
    const procDef = env.has(name) ? env.get(name) : null;
    if (procDef && procDef.__proc__) {
      if (Turtle.state.callDepth > 500) {
        throw new LogoError('Recursion limit (500) exceeded');
      }
      Turtle.state.callDepth++;
      const localEnv = new Env(env);
      const args = argNodes.map(a => evalExpr(a, env));
      procDef.params.forEach((p, i) => localEnv.setLocal(p, args[i] !== undefined ? args[i] : 0));
      try {
        yield* evalNodes(procDef.body, localEnv);
      } catch(e) {
        if (!(e instanceof StopSignal)) throw e;
      } finally {
        Turtle.state.callDepth--;
      }
      return;
    }

    // ── Built-in commands ─────────────────────────────────────────
    const args = argNodes.map(a => evalExpr(a, env));

    switch (name) {
      // Movement
      case 'FORWARD': case 'FD':
        Turtle.forward(+args[0]); yield { type:'DRAW' }; break;
      case 'BACK': case 'BK':
        Turtle.back(+args[0]); yield { type:'DRAW' }; break;
      case 'RIGHT': case 'RT':
        Turtle.right(+args[0]); yield { type:'DRAW' }; break;
      case 'LEFT': case 'LT':
        Turtle.left(+args[0]); yield { type:'DRAW' }; break;
      case 'HOME':
        Turtle.home(); yield { type:'DRAW' }; break;
      case 'SETX':
        Turtle.setX(+args[0]); yield { type:'DRAW' }; break;
      case 'SETY':
        Turtle.setY(+args[0]); yield { type:'DRAW' }; break;
      case 'SETXY':
        Turtle.setXY(+args[0], +args[1]); yield { type:'DRAW' }; break;
      case 'SETHEADING': case 'SETH':
        Turtle.setHeading(+args[0]); yield { type:'DRAW' }; break;

      // Pen
      case 'PENUP':   case 'PU': Turtle.penUp();   break;
      case 'PENDOWN': case 'PD': Turtle.penDown();  break;
      case 'PENERASE':case 'PE':
        Turtle.penDown();
        Turtle.setPenColor(Turtle.state.bgColor);
        break;
      case 'SETPENCOLOR': case 'SETPC':
        Turtle.setPenColor(Turtle.colorFromValue(args[0])); break;
      case 'SETPENWIDTH':
        Turtle.setPenWidth(+args[0]); break;
      case 'SETBACKGROUND': case 'SETBG':
        Turtle.setBackground(Turtle.colorFromValue(args[0])); break;
      case 'FILL':
        Turtle.fill(); break;

      // Turtle visibility
      case 'SHOWTURTLE': case 'ST':
        Turtle.showTurtle(); break;
      case 'HIDETURTLE': case 'HT':
        Turtle.hideTurtle(); break;

      // Screen
      case 'CLEARSCREEN': case 'CS':
        Turtle.clearScreen(); yield { type:'DRAW' }; break;
      case 'CLEARTEXT': case 'CT':
        App.clearConsole(); break;

      // I/O
      case 'PRINT':
        App.print(logoToString(args[0])); break;
      case 'SHOW':
        App.print(logoToString(args[0])); break;
      case 'TYPE':
        App.printInline(logoToString(args[0])); break;

      // Draw text on the canvas at turtle's current position.
      // Accepts either a quoted word (`TT "hello`) or a list of words
      // (`TT [hello world]`).  Lists are joined with spaces, no brackets.
      case 'LABEL': case 'TT':
        Turtle.label(labelText(args[0]));
        yield { type:'DRAW' };
        break;

      // Wait
      case 'WAIT':
        yield { type:'WAIT', ms: +args[0] }; break;

      // Control
      case 'STOP':   throw new StopSignal();
      case 'OUTPUT': throw new OutputSignal(args[0]);

      // Unknown command
      default:
        throw new LogoError(`I don't know how to ${name}`, { line: lineNum });
    }
  }

  // ── Expression evaluator (synchronous) ───────────────────────────
  function evalExpr(node, env) {
    switch (node.type) {
      case 'NumberLit': return node.value;
      case 'StringLit': return node.value;
      case 'VarRef':    return env.get(node.name);

      case 'ListLit':
        return node.items.map(item => evalExpr(item, env));

      case 'Block':
        // A block used as a value returns array of evaluated items
        return node.body.map(item => evalExpr(item, env));

      case 'InfixOp': {
        const l = evalExpr(node.left,  env);
        const r = evalExpr(node.right, env);
        switch (node.op) {
          case '+': return (+l) + (+r);
          case '-': return (+l) - (+r);
          case '*': return (+l) * (+r);
          case '/': if (+r === 0) throw new LogoError('Division by zero'); return (+l) / (+r);
          case '=': return l == r;   // intentional loose ==
          case '<': return (+l) < (+r);
          case '>': return (+l) > (+r);
        }
        break;
      }

      case 'Call':
        return evalExprCall(node.name, node.args, env, node.line);

      default:
        throw new LogoError(`Cannot evaluate ${node.type} as expression`);
    }
  }

  function evalExprCall(name, argNodes, env, lineNum) {
    // Check user proc that returns value
    const procDef = env.has(name) ? env.get(name) : null;
    if (procDef && procDef.__proc__) {
      const localEnv = new Env(env);
      const args = argNodes.map(a => evalExpr(a, env));
      procDef.params.forEach((p, i) => localEnv.setLocal(p, args[i] !== undefined ? args[i] : 0));
      // Run synchronously (no DRAW yields) for expression-position calls
      try {
        for (const n of procDef.body) {
          const result = evalExprNodeSync(n, localEnv);
          if (result !== undefined) return result;
        }
      } catch(e) {
        if (e instanceof OutputSignal) return e.value;
        if (e instanceof StopSignal) return 0;
        throw e;
      }
      return 0;
    }

    const args = argNodes.map(a => evalExpr(a, env));

    switch (name) {
      // Math
      case 'SQRT':      return Math.sqrt(Math.abs(+args[0]));
      case 'ABS':       return Math.abs(+args[0]);
      case 'INT':       return Math.trunc(+args[0]);
      case 'ROUND':     return Math.round(+args[0]);
      case 'SIN':       return Math.sin(+args[0] * DEG);
      case 'COS':       return Math.cos(+args[0] * DEG);
      case 'TAN':       return Math.tan(+args[0] * DEG);
      case 'ARCTAN':    return Math.atan(+args[0]) / DEG;
      case 'ARCSIN':    return Math.asin(Math.max(-1,Math.min(1,+args[0]))) / DEG;
      case 'ARCCOS':    return Math.acos(Math.max(-1,Math.min(1,+args[0]))) / DEG;
      case 'RANDOM':    return Math.floor(Math.random() * Math.abs(+args[0]));
      case 'REMAINDER': case 'MODULO': return (+args[0]) % (+args[1]);
      case 'POWER':     return Math.pow(+args[0], +args[1]);
      case 'MINUS':     return -(+args[0]);

      // Predicates
      case 'EQUALP':        return args[0] == args[1];
      case 'NOTEQUALP':     return args[0] != args[1];
      case 'LESSP':         return (+args[0]) < (+args[1]);
      case 'GREATERP':      return (+args[0]) > (+args[1]);
      case 'LESSEQUALP':    return (+args[0]) <= (+args[1]);
      case 'GREATEREQUALP': return (+args[0]) >= (+args[1]);
      case 'AND':           return isTruthy(args[0]) && isTruthy(args[1]);
      case 'OR':            return isTruthy(args[0]) || isTruthy(args[1]);
      case 'NOT':           return !isTruthy(args[0]);
      case 'NUMBERP':       return typeof args[0] === 'number' || !isNaN(+args[0]);
      case 'WORDP':         return typeof args[0] === 'string';
      case 'LISTP':         return Array.isArray(args[0]);
      case 'EMPTYP':        return !args[0] || (Array.isArray(args[0]) && args[0].length === 0);
      case 'MEMBERP':       return Array.isArray(args[1]) ? args[1].includes(args[0]) : String(args[1]).includes(String(args[0]));

      // Turtle state queries
      case 'XCOR':      return Turtle.state.x;
      case 'YCOR':      return Turtle.state.y;
      case 'HEADING':   return Turtle.state.heading;
      case 'PENDOWNP':  return Turtle.state.penDown;
      case 'PENCOLOR':  case 'PC': return Turtle.state.penColor;
      case 'PENWIDTH':  return Turtle.state.penWidth;
      case 'REPCOUNT':  return env.has('REPCOUNT') ? env.get('REPCOUNT') : -1;
      case 'TURTLESTATE': return Turtle.state.visible ? 1 : 0;

      // List / word operations
      case 'COUNT':     return Array.isArray(args[0]) ? args[0].length : String(args[0]).length;
      case 'FIRST':     return Array.isArray(args[0]) ? args[0][0] : String(args[0])[0];
      case 'LAST':      { const a = Array.isArray(args[0]) ? args[0] : String(args[0]); return a[a.length-1]; }
      case 'BUTFIRST':  return Array.isArray(args[0]) ? args[0].slice(1) : String(args[0]).slice(1);
      case 'BUTLAST':   return Array.isArray(args[0]) ? args[0].slice(0,-1) : String(args[0]).slice(0,-1);
      case 'ITEM':      { const a = Array.isArray(args[1]) ? args[1] : String(args[1]); return a[+args[0]-1]; }
      case 'LIST':      return [args[0], args[1]];
      case 'SENTENCE': case 'SE':
        return [].concat(args[0], args[1]);
      case 'WORD':      return String(args[0]) + String(args[1]);

      // Type conversion
      case 'PRINT': case 'SHOW': case 'TYPE':
        App.print(logoToString(args[0])); return undefined;

      default:
        throw new LogoError(`I don't know how to ${name}`, { line: lineNum });
    }
  }

  // Synchronous single-node eval (for user proc called in expr position)
  function evalExprNodeSync(node, env) {
    if (node.type === 'Output') throw new OutputSignal(evalExpr(node.value, env));
    if (node.type === 'Stop')   throw new StopSignal();
    if (node.type === 'Make')   { env.set(node.varName, evalExpr(node.value, env)); }
    if (node.type === 'If') {
      const cond = evalExpr(node.cond, env);
      const branch = isTruthy(cond) ? node.then : node.els;
      if (branch) {
        for (const n of branch.body) {
          const r = evalExprNodeSync(n, env);
          if (r !== undefined) return r;
        }
      }
    }
    if (node.type === 'Call') {
      return evalExprCall(node.name, node.args, env, node.line);
    }
    return undefined;
  }

  function logoToString(val) {
    if (Array.isArray(val)) return '[' + val.map(logoToString).join(' ') + ']';
    if (val === true)  return 'TRUE';
    if (val === false) return 'FALSE';
    if (val === undefined || val === null) return '';
    return String(val);
  }

  // labelText is like logoToString, but for canvas LABEL / TT output:
  // arrays are joined with spaces and no surrounding brackets — so that
  //   TT [type something here]
  // renders as "type something here" on the canvas.
  function labelText(val) {
    if (Array.isArray(val)) return val.map(labelText).join(' ');
    if (val === true)  return 'TRUE';
    if (val === false) return 'FALSE';
    if (val === undefined || val === null) return '';
    return String(val);
  }

  // ══════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════════════

  function* run(src) {
    const ast = parse(src);
    const globalEnv = new Env();
    // Pre-register all proc defs so they're available immediately
    for (const node of ast) {
      if (node.type === 'ProcDef') {
        globalEnv.setLocal(node.name, { __proc__:true, params:node.params, body:node.body });
      }
    }
    yield* evalNodes(ast, globalEnv);
  }

  return { run, LogoError, tokenize, parse };
})();
