// Inline formatting is stored as a small markdown dialect inside each block:
//   **bold**  *italic*  ~~strike~~  `code`  [text](https://url)  [[noteId|Title]]
// and bare URLs are auto-linked. Parsing is a hand-rolled scanner (no eval,
// no HTML injection): the result is a tree the UI renders as React nodes.

const URL_RE = /^https?:\/\/[^\s<>)\]]+/;

function findClose(text, from, marker) {
  let i = from;
  while (i < text.length) {
    const j = text.indexOf(marker, i);
    if (j === -1) return -1;
    if (j > from) return j; // non-empty content
    i = j + 1;
  }
  return -1;
}

export function parseInline(text) {
  const out = [];
  let buf = '';
  const flush = () => { if (buf) { out.push({ t: 'text', v: buf }); buf = ''; } };
  let i = 0;

  while (i < text.length) {
    const ch = text[i];
    const rest = text.slice(i);

    if (ch === '\\' && i + 1 < text.length && '*_`~[]\\'.includes(text[i + 1])) {
      buf += text[i + 1];
      i += 2;
      continue;
    }
    if (ch === '`') {
      const end = text.indexOf('`', i + 1);
      if (end > i + 1) { flush(); out.push({ t: 'code', v: text.slice(i + 1, end) }); i = end + 1; continue; }
    }
    if (rest.startsWith('[[')) {
      const m = /^\[\[([^\]|]+)\|([^\]]*)\]\]/.exec(rest);
      if (m) { flush(); out.push({ t: 'note', id: m[1], title: m[2] }); i += m[0].length; continue; }
    }
    if (ch === '[') {
      const m = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/.exec(rest);
      if (m) { flush(); out.push({ t: 'link', href: m[2], c: parseInline(m[1]) }); i += m[0].length; continue; }
    }
    if (rest.startsWith('**')) {
      const end = findClose(text, i + 2, '**');
      if (end !== -1) { flush(); out.push({ t: 'bold', c: parseInline(text.slice(i + 2, end)) }); i = end + 2; continue; }
    }
    if (rest.startsWith('~~')) {
      const end = findClose(text, i + 2, '~~');
      if (end !== -1) { flush(); out.push({ t: 'strike', c: parseInline(text.slice(i + 2, end)) }); i = end + 2; continue; }
    }
    if (ch === '*' && rest[1] !== ' ' && rest[1] !== '*') {
      const end = findClose(text, i + 1, '*');
      if (end !== -1 && text[end - 1] !== ' ') { flush(); out.push({ t: 'italic', c: parseInline(text.slice(i + 1, end)) }); i = end + 1; continue; }
    }
    if (ch === '_' && (i === 0 || /\W/.test(text[i - 1])) && rest[1] !== ' ' && rest[1] !== '_') {
      const end = findClose(text, i + 1, '_');
      if (end !== -1 && text[end - 1] !== ' ' && (end + 1 >= text.length || /\W/.test(text[end + 1]))) {
        flush(); out.push({ t: 'italic', c: parseInline(text.slice(i + 1, end)) }); i = end + 1; continue;
      }
    }
    if ((ch === 'h') && (i === 0 || /\s|[(\[]/.test(text[i - 1]))) {
      const m = URL_RE.exec(rest);
      if (m) {
        const url = m[0].replace(/[.,;:!?]+$/, '');
        flush(); out.push({ t: 'link', href: url, c: [{ t: 'text', v: url }], auto: true }); i += url.length; continue;
      }
    }
    buf += ch;
    i += 1;
  }
  flush();
  return out;
}

/** Plain text of an inline string (markers removed) — used for search and titles. */
export function inlineToText(text, resolveNote) {
  const walk = (nodes) => nodes.map((n) => {
    if (n.t === 'text' || n.t === 'code') return n.v;
    if (n.t === 'note') return resolveNote?.(n.id)?.title ?? n.title;
    return walk(n.c || []);
  }).join('');
  return walk(parseInline(text || ''));
}

/** Ids of notes referenced inline as [[id|Title]]. */
export function inlineNoteIds(text) {
  if (!text || !text.includes('[[')) return [];
  const ids = [];
  const re = /\[\[([^\]|]+)\|[^\]]*\]\]/g;
  let m;
  while ((m = re.exec(text))) ids.push(m[1]);
  return ids;
}

/** Wraps / unwraps [start, end) of `text` in `marker`, returning the new text and selection. */
export function toggleWrap(text, start, end, marker) {
  const before = text.slice(0, start);
  const sel = text.slice(start, end);
  const after = text.slice(end);
  const m = marker.length;
  if (before.endsWith(marker) && after.startsWith(marker)) {
    return { text: before.slice(0, -m) + sel + after.slice(m), start: start - m, end: end - m };
  }
  if (sel.startsWith(marker) && sel.endsWith(marker) && sel.length >= m * 2) {
    return { text: before + sel.slice(m, -m) + after, start, end: end - m * 2 };
  }
  const inner = sel || '';
  return { text: `${before}${marker}${inner}${marker}${after}`, start: start + m, end: start + m + inner.length };
}
