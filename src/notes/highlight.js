// A small dependency-free syntax highlighter. It is deliberately approximate:
// comments, strings, numbers, keywords and (for data languages) keys.

const KW = (s) => new Set(s.split(/\s+/).filter(Boolean));

const C_LIKE_COMMENTS = { line: '//', block: ['/*', '*/'] };

const LANGS = {
  java: { comments: C_LIKE_COMMENTS, strings: ['"', "'"], kw: KW('abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for if implements import instanceof int interface long native new null package private protected public return short static super switch synchronized this throw throws transient try void volatile while var record true false'), annot: true },
  kotlin: { comments: C_LIKE_COMMENTS, strings: ['"', "'"], kw: KW('as break class continue do else false for fun if in interface is null object package return super this throw true try typealias typeof val var when while data sealed override private public protected internal suspend companion init'), annot: true },
  javascript: { comments: C_LIKE_COMMENTS, strings: ['"', "'", '`'], kw: KW('async await break case catch class const continue default delete do else export extends false finally for from function if import in instanceof let new null of return static super switch this throw true try typeof undefined var void while yield') },
  typescript: { comments: C_LIKE_COMMENTS, strings: ['"', "'", '`'], kw: KW('abstract any as async await boolean break case catch class const continue declare default delete do else enum export extends false finally for from function if implements import in instanceof interface let namespace new null number of private protected public readonly return static string super switch this throw true try type typeof undefined var void while yield') },
  go: { comments: C_LIKE_COMMENTS, strings: ['"', '`', "'"], kw: KW('break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var true false nil') },
  python: { comments: { line: '#' }, strings: ['"""', "'''", '"', "'"], kw: KW('and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield self') },
  sql: { comments: { line: '--', block: ['/*', '*/'] }, strings: ["'"], ci: true, kw: KW('select from where and or not in is null as join left right inner outer full on group by order having limit offset insert into values update set delete create table alter drop index primary key foreign references default distinct union all case when then else end count sum avg min max like between exists') },
  bash: { comments: { line: '#' }, strings: ['"', "'"], kw: KW('if then else elif fi for while do done case esac function return export local echo cd exit set unset source in') },
  hcl: { comments: { line: '#', block: ['/*', '*/'] }, strings: ['"'], kw: KW('resource variable output module data provider locals terraform true false null for in if') },
  yaml: { comments: { line: '#' }, strings: ['"', "'"], kw: KW('true false null yes no'), keys: true },
  json: { comments: {}, strings: ['"'], kw: KW('true false null'), keys: true },
  xml: { comments: { block: ['<!--', '-->'] }, strings: ['"', "'"], kw: KW(''), tags: true },
};

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const cache = new Map();

function regexFor(lang) {
  if (cache.has(lang)) return cache.get(lang);
  const cfg = LANGS[lang];
  const parts = [];
  if (cfg.comments.block) parts.push(`(?<bc>${escapeRe(cfg.comments.block[0])}[\\s\\S]*?(?:${escapeRe(cfg.comments.block[1])}|$))`);
  if (cfg.comments.line) parts.push(`(?<lc>${escapeRe(cfg.comments.line)}[^\\n]*)`);
  const strs = cfg.strings.map((q) => `${escapeRe(q)}(?:\\\\[\\s\\S]|(?!${escapeRe(q)})[^\\\\${q.length === 1 && q !== '`' ? '\\n' : ''}])*(?:${escapeRe(q)}|$)`);
  if (strs.length) parts.push(`(?<st>${strs.join('|')})`);
  if (cfg.tags) parts.push('(?<tg></?[A-Za-z][\\w:-]*|/?>)');
  if (cfg.annot) parts.push('(?<an>@[A-Za-z_]\\w*)');
  if (cfg.keys) parts.push('(?<ky>[A-Za-z_][\\w.\\-/]*(?=[ \\t]*:(?:[ \\t]|$)))');
  parts.push('(?<nu>\\b\\d+(?:\\.\\d+)?\\b)');
  parts.push('(?<wd>[A-Za-z_$][\\w$]*)');
  const re = new RegExp(parts.join('|'), 'g');
  cache.set(lang, re);
  return re;
}

/** Returns [{ t, v }] where t is 'kw' | 'str' | 'com' | 'num' | 'key' | 'ann' | 'tag' | 'plain'. */
export function highlight(code, language = 'text') {
  const lang = LANGS[language] ? language : null;
  if (!lang) return [{ t: 'plain', v: code }];
  const cfg = LANGS[lang];
  const re = new RegExp(regexFor(lang));
  const out = [];
  let last = 0;
  let m;
  const push = (t, v) => {
    if (!v) return;
    const prev = out[out.length - 1];
    if (prev && prev.t === t) prev.v += v;
    else out.push({ t, v });
  };

  while ((m = re.exec(code))) {
    if (m[0] === '') { re.lastIndex += 1; continue; }
    push('plain', code.slice(last, m.index));
    const g = m.groups;
    let type = 'plain';
    if (g.bc || g.lc) type = 'com';
    else if (g.st) {
      const after = code.slice(m.index + m[0].length);
      type = cfg.keys && /^\s*:/.test(after) ? 'key' : 'str';
    } else if (g.ky) type = 'key';
    else if (g.tg) type = 'tag';
    else if (g.an) type = 'ann';
    else if (g.nu) type = 'num';
    else if (g.wd) {
      const word = cfg.ci ? m[0].toLowerCase() : m[0];
      if (cfg.kw.has(word)) type = 'kw';
      else if (cfg.keys && !cfg.kw.has(word) && lang === 'json' && /^\s*:/.test(code.slice(m.index + m[0].length))) type = 'key';
    }
    push(type, m[0]);
    last = m.index + m[0].length;
  }
  push('plain', code.slice(last));
  return out;
}
