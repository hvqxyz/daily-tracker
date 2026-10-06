// A small, safe expression language for formula fields. It is parsed into an
// AST and interpreted — there is no eval/Function anywhere, so a formula can
// only ever compute a value from the fields and functions exposed below.
//
//   {Field name}            reference to a field (braces allow spaces)
//   Started                 bare single-word field reference
//   today  now  true  false built-in constants
//   + - * / %  == = != < <= > >=  && || !   arithmetic, comparison, logic
//   date - date             difference in days;  date + number   shifts days
//   if(cond, a, b)  round(x, digits)  floor  ceil  abs  min  max  sum  avg
//   count  days(a, b)  addDays(d, n)  year  month  upper  lower  len  concat
//   contains(text, part)  empty(x)  text(x)  number(x)  percent(part, whole)
//   rollup({Relation}, "Field name", "sum"|"avg"|"min"|"max"|"count")
//   children()  childrenDone()  isDone()   (hierarchy / completion helpers)

export class FormulaError extends Error {}

const DATE_RE = /^\d{4}-\d{2}-\d{2}/;
const isDateStr = (v) => typeof v === 'string' && DATE_RE.test(v);

function toDays(str) {
  const [y, m, d] = str.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
}

function fromDays(days) {
  const d = new Date(days * 86400000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Tokenizer

const TWO_CHAR = ['==', '!=', '>=', '<=', '&&', '||'];
const ONE_CHAR = '+-*/%()<>,=!';

function tokenize(src) {
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i += 1; continue; }

    if (ch === '{') {
      const end = src.indexOf('}', i);
      if (end === -1) throw new FormulaError('Missing "}"');
      tokens.push({ t: 'field', v: src.slice(i + 1, end).trim() });
      i = end + 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      let out = '';
      while (j < src.length && src[j] !== ch) { out += src[j]; j += 1; }
      if (j >= src.length) throw new FormulaError('Unterminated text');
      tokens.push({ t: 'str', v: out });
      i = j + 1;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j += 1;
      const n = Number(src.slice(i, j));
      if (!Number.isFinite(n)) throw new FormulaError(`Bad number "${src.slice(i, j)}"`);
      tokens.push({ t: 'num', v: n });
      i = j;
      continue;
    }
    if (/[A-Za-z_À-ɏ]/.test(ch)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_À-ɏ]/.test(src[j])) j += 1;
      tokens.push({ t: 'id', v: src.slice(i, j) });
      i = j;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (TWO_CHAR.includes(two)) { tokens.push({ t: 'op', v: two }); i += 2; continue; }
    if (ONE_CHAR.includes(ch)) { tokens.push({ t: 'op', v: ch }); i += 1; continue; }
    throw new FormulaError(`Unexpected "${ch}"`);
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// Parser (precedence climbing)

function parse(src) {
  const tokens = tokenize(src);
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  const isOp = (v) => peek() && peek().t === 'op' && peek().v === v;

  function expect(v) {
    if (!isOp(v)) throw new FormulaError(`Expected "${v}"`);
    pos += 1;
  }

  function binary(nextLevel, ops) {
    let left = nextLevel();
    while (peek() && peek().t === 'op' && ops.includes(peek().v)) {
      const op = next().v;
      left = { n: 'bin', op, l: left, r: nextLevel() };
    }
    return left;
  }

  const or = () => binary(and, ['||']);
  const and = () => binary(equality, ['&&']);
  const equality = () => binary(comparison, ['==', '=', '!=']);
  const comparison = () => binary(additive, ['<', '<=', '>', '>=']);
  const additive = () => binary(multiplicative, ['+', '-']);
  const multiplicative = () => binary(unary, ['*', '/', '%']);

  function unary() {
    if (isOp('-')) { pos += 1; return { n: 'neg', e: unary() }; }
    if (isOp('!')) { pos += 1; return { n: 'not', e: unary() }; }
    return primary();
  }

  function primary() {
    const tok = next();
    if (!tok) throw new FormulaError('Unexpected end of formula');
    if (tok.t === 'num') return { n: 'lit', v: tok.v };
    if (tok.t === 'str') return { n: 'lit', v: tok.v };
    if (tok.t === 'field') return { n: 'field', name: tok.v };
    if (tok.t === 'op' && tok.v === '(') {
      const e = or();
      expect(')');
      return e;
    }
    if (tok.t === 'id') {
      if (isOp('(')) {
        pos += 1;
        const args = [];
        if (!isOp(')')) {
          args.push(or());
          while (isOp(',')) { pos += 1; args.push(or()); }
        }
        expect(')');
        return { n: 'call', name: tok.v.toLowerCase(), args };
      }
      return { n: 'id', name: tok.v };
    }
    throw new FormulaError(`Unexpected "${tok.v}"`);
  }

  const ast = or();
  if (pos < tokens.length) throw new FormulaError(`Unexpected "${tokens[pos].v}"`);
  return ast;
}

const parseCache = new Map();

export function compileFormula(src) {
  if (parseCache.has(src)) return parseCache.get(src);
  const ast = parse(src);
  if (parseCache.size > 500) parseCache.clear();
  parseCache.set(src, ast);
  return ast;
}

// ---------------------------------------------------------------------------
// Evaluation

const truthy = (v) => !(v === null || v === undefined || v === '' || v === 0 || v === false || (Array.isArray(v) && v.length === 0));
const num = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const flat = (args) => args.flat(Infinity).filter((v) => v !== null && v !== undefined && v !== '');
const nums = (args) => flat(args).map(Number).filter((n) => Number.isFinite(n));

function looseEquals(a, b) {
  const blank = (v) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
  if (blank(a) || blank(b)) return blank(a) && blank(b);
  if (typeof a === 'number' || typeof b === 'number') return Number(a) === Number(b);
  return String(a) === String(b);
}

function compare(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (a === null || a === undefined || a === '') a = typeof b === 'number' ? 0 : '';
  if (b === null || b === undefined || b === '') b = typeof a === 'number' ? 0 : '';
  if (typeof a === 'number' || typeof b === 'number') return num(a) - num(b);
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

function roundTo(x, digits = 0) {
  const f = 10 ** digits;
  return Math.round((num(x) + Number.EPSILON) * f) / f;
}

const FUNCTIONS = {
  round: ([x, d]) => roundTo(x, d === undefined ? 0 : num(d)),
  floor: ([x]) => Math.floor(num(x)),
  ceil: ([x]) => Math.ceil(num(x)),
  abs: ([x]) => Math.abs(num(x)),
  min: (args) => { const n = nums(args); return n.length ? Math.min(...n) : null; },
  max: (args) => { const n = nums(args); return n.length ? Math.max(...n) : null; },
  sum: (args) => nums(args).reduce((s, n) => s + n, 0),
  avg: (args) => { const n = nums(args); return n.length ? n.reduce((s, x) => s + x, 0) / n.length : null; },
  count: (args) => flat(args).length,
  percent: ([part, whole]) => (num(whole) === 0 ? null : (num(part) / num(whole)) * 100),
  days: ([a, b]) => (isDateStr(a) && isDateStr(b) ? toDays(b) - toDays(a) : null),
  adddays: ([d, n]) => (isDateStr(d) ? fromDays(toDays(d) + num(n)) : null),
  year: ([d]) => (isDateStr(d) ? Number(d.slice(0, 4)) : null),
  month: ([d]) => (isDateStr(d) ? Number(d.slice(5, 7)) : null),
  upper: ([s]) => String(s ?? '').toUpperCase(),
  lower: ([s]) => String(s ?? '').toLowerCase(),
  len: ([s]) => (Array.isArray(s) ? s.length : String(s ?? '').length),
  concat: (args) => args.map((a) => (Array.isArray(a) ? a.join(', ') : a ?? '')).join(''),
  contains: ([s, part]) => (Array.isArray(s) ? s.map(String).includes(String(part)) : String(s ?? '').toLowerCase().includes(String(part ?? '').toLowerCase())),
  empty: ([v]) => !truthy(v) && v !== 0 && v !== false,
  text: ([v]) => (Array.isArray(v) ? v.join(', ') : v === null || v === undefined ? '' : String(v)),
  number: ([v]) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v)),
};

function evalNode(node, scope, depth = 0) {
  if (depth > 60) throw new FormulaError('Formula too deeply nested');
  const ev = (n) => evalNode(n, scope, depth + 1);

  switch (node.n) {
    case 'lit':
      return node.v;
    case 'field': {
      const v = scope.field(node.name);
      if (v === undefined) throw new FormulaError(`Unknown field "${node.name}"`);
      return v;
    }
    case 'id': {
      const lower = node.name.toLowerCase();
      if (lower === 'true') return true;
      if (lower === 'false') return false;
      if (lower === 'null') return null;
      if (lower === 'today') return scope.today();
      if (lower === 'now') return scope.now();
      const v = scope.field(node.name);
      if (v === undefined) throw new FormulaError(`Unknown name "${node.name}"`);
      return v;
    }
    case 'neg':
      return -num(ev(node.e));
    case 'not':
      return !truthy(ev(node.e));
    case 'call': {
      if (node.name === 'if') {
        const [c, a, b] = node.args;
        if (!c || !a) throw new FormulaError('if() needs a condition and a value');
        return truthy(ev(c)) ? ev(a) : b ? ev(b) : null;
      }
      const args = node.args.map(ev);
      const fn = FUNCTIONS[node.name] || scope.fns?.[node.name];
      if (!fn) throw new FormulaError(`Unknown function ${node.name}()`);
      return fn(args);
    }
    case 'bin': {
      if (node.op === '&&') { const l = ev(node.l); return truthy(l) ? ev(node.r) : l; }
      if (node.op === '||') { const l = ev(node.l); return truthy(l) ? l : ev(node.r); }
      const a = ev(node.l);
      const b = ev(node.r);
      const blankish = (v) => v === null || v === undefined || v === '';
      // date arithmetic with a missing date has no meaningful answer
      if ((node.op === '-' || node.op === '+') && ((isDateStr(a) && blankish(b)) || (isDateStr(b) && blankish(a)))) return null;
      switch (node.op) {
        case '+':
          if (isDateStr(a) && !isDateStr(b) && typeof b !== 'string') return fromDays(toDays(a) + num(b));
          if (typeof a === 'string' || typeof b === 'string' || Array.isArray(a) || Array.isArray(b)) {
            return FUNCTIONS.concat([a, b]);
          }
          return num(a) + num(b);
        case '-':
          if (isDateStr(a) && isDateStr(b)) return toDays(a) - toDays(b);
          if (isDateStr(a) && typeof b === 'number') return fromDays(toDays(a) - b);
          return num(a) - num(b);
        case '*': return num(a) * num(b);
        case '/': return num(b) === 0 ? null : num(a) / num(b);
        case '%': return num(b) === 0 ? null : num(a) % num(b);
        case '==': case '=': return looseEquals(a, b);
        case '!=': return !looseEquals(a, b);
        case '<': return compare(a, b) < 0;
        case '<=': return compare(a, b) <= 0;
        case '>': return compare(a, b) > 0;
        case '>=': return compare(a, b) >= 0;
        default: throw new FormulaError(`Unknown operator ${node.op}`);
      }
    }
    default:
      throw new FormulaError('Bad formula');
  }
}

/** Returns { value } or { error }. Never throws. */
export function evaluateFormula(src, scope) {
  if (!src || !String(src).trim()) return { value: null };
  try {
    const ast = compileFormula(src);
    let value = evalNode(ast, scope);
    if (typeof value === 'number' && !Number.isFinite(value)) value = null;
    return { value };
  } catch (err) {
    return { error: err instanceof FormulaError ? err.message : 'Formula failed' };
  }
}

/** Syntax-only check, for live feedback in the field editor. */
export function checkFormulaSyntax(src) {
  if (!src || !String(src).trim()) return null;
  try {
    compileFormula(src);
    return null;
  } catch (err) {
    return err instanceof FormulaError ? err.message : 'Invalid formula';
  }
}

export { isDateStr, toDays, fromDays };
