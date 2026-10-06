import { forwardRef, useCallback, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Bold, Code2, Italic, Link2, Redo2, Strikethrough, Undo2, GripVertical, Plus, StickyNote } from 'lucide-react';
import { Menu } from '../../trackers/ui/Menu.jsx';
import { InlineText } from './InlineText.jsx';
import { BLOCK_TYPES, CALLOUT_VARIANTS, CODE_LANGUAGES, isListType, isTextType, newBlock } from '../model.js';
import { toggleWrap } from '../inline.js';
import { parseMarkdown } from '../markdown.js';
import { highlight } from '../highlight.js';
import { isHttpUrl, readAttachment, youtubeEmbedUrl } from './attachments.js';

const MARKDOWN_SHORTCUTS = [
  [/^#{1} $/, 'h1'], [/^#{2} $/, 'h2'], [/^#{3} $/, 'h3'],
  [/^[-*] $/, 'bullet'], [/^\d+\. $/, 'number'], [/^\[ ?\] $/, 'todo'], [/^> $/, 'quote'],
];
const FOCUSABLE = (b) => isTextType(b.type) || b.type === 'code';

function AutoTextarea({ value, onChange, onKeyDown, onPaste, taRef, placeholder, className = '' }) {
  const local = useRef(null);
  useLayoutEffect(() => {
    const el = local.current;
    if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; }
  }, [value]);
  return (
    <textarea
      ref={(el) => { local.current = el; taRef(el); }}
      className={`nt-textarea ${className}`}
      rows={1}
      value={value}
      placeholder={placeholder}
      spellCheck
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
    />
  );
}

function CodeBlock({ block, active, readOnly, onActivate, onChange, onConfig, onExit, taRef }) {
  const lang = block.config.lang || 'text';
  const tokens = useMemo(() => highlight(block.content, lang), [block.content, lang]);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try { await navigator.clipboard.writeText(block.content); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { /* clipboard unavailable */ }
  };

  const onKey = (e) => {
    const ta = e.target;
    if (e.key === 'Tab') {
      e.preventDefault();
      const { selectionStart: s, selectionEnd: en, value } = ta;
      onChange(`${value.slice(0, s)}  ${value.slice(en)}`);
      requestAnimationFrame(() => ta.setSelectionRange(s + 2, s + 2));
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onExit();
    } else if (e.key === 'Backspace' && !block.content && ta.selectionStart === 0) {
      e.preventDefault();
      onExit('convert');
    }
  };

  return (
    <div className={`nt-code-block${active ? ' active' : ''}`}>
      <div className="nt-code-head">
        {readOnly ? <span>{lang}</span> : (
          <select value={lang} onChange={(e) => onConfig({ lang: e.target.value })} aria-label="Language">
            {CODE_LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        )}
        <button type="button" className="nt-code-copy" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
      </div>
      {active && !readOnly ? (
        <AutoTextarea value={block.content} onChange={onChange} onKeyDown={onKey} taRef={taRef} className="nt-code-input" placeholder="Paste or type code…  (Ctrl+Enter to leave)" />
      ) : (
        <pre className="nt-code" onClick={readOnly ? undefined : onActivate}>
          <code>
            {block.content ? tokens.map((t, i) => <span key={i} className={`hl-${t.t}`}>{t.v}</span>) : <span className="nt-placeholder">Empty code block</span>}
          </code>
        </pre>
      )}
    </div>
  );
}

function EmbedBlock({ block, readOnly, onConfig }) {
  const [draft, setDraft] = useState('');
  const url = block.config.url;
  const yt = url && youtubeEmbedUrl(url);
  if (!url) {
    if (readOnly) return null;
    return (
      <form className="nt-attach-empty" onSubmit={(e) => { e.preventDefault(); if (isHttpUrl(draft)) onConfig({ url: draft.trim(), title: '' }); }}>
        <input className="nt-attach-input" placeholder="Paste a link or YouTube URL and press Enter…" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button type="submit" className="nt-btn">Embed</button>
      </form>
    );
  }
  if (yt) {
    return (
      <div className="nt-embed-video">
        <iframe src={yt} title="Embedded video" loading="lazy" sandbox="allow-scripts allow-same-origin allow-presentation" allowFullScreen />
      </div>
    );
  }
  let host = url;
  try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { /* keep raw */ }
  return (
    <a className="nt-bookmark" href={url} target="_blank" rel="noopener noreferrer">
      <span className="nt-bookmark-host">🔗 {host}</span>
      <span className="nt-bookmark-url">{url}</span>
    </a>
  );
}

function AttachmentPicker({ image, onPicked, readOnly }) {
  const [error, setError] = useState('');
  const [url, setUrl] = useState('');
  if (readOnly) return null;
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const res = await readAttachment(file, { image });
    if (res.ok) onPicked(res); else setError(res.error);
  };
  return (
    <div className="nt-attach-empty">
      <label className="nt-btn">
        {image ? 'Upload image' : 'Attach file'}
        <input type="file" accept={image ? 'image/*' : undefined} onChange={pick} hidden />
      </label>
      {image && (
        <form onSubmit={(e) => { e.preventDefault(); if (isHttpUrl(url)) onPicked({ url: url.trim() }); }} className="nt-attach-url">
          <input className="nt-attach-input" placeholder="…or paste an image URL" value={url} onChange={(e) => setUrl(e.target.value)} />
        </form>
      )}
      {error && <span className="nt-error">{error}</span>}
    </div>
  );
}

function ImageBlock({ block, readOnly, onConfig }) {
  const src = block.config.data || block.config.url;
  if (!src) return <AttachmentPicker image readOnly={readOnly} onPicked={(r) => onConfig(r.data ? { data: r.data, name: r.name, size: r.size, url: undefined } : { url: r.url })} />;
  return (
    <figure className="nt-image">
      <img src={src} alt={block.config.caption || block.config.name || ''} loading="lazy" />
      {(!readOnly || block.config.caption) && (
        readOnly
          ? <figcaption>{block.config.caption}</figcaption>
          : <input className="nt-caption" placeholder="Add a caption…" value={block.config.caption || ''} onChange={(e) => onConfig({ caption: e.target.value })} />
      )}
    </figure>
  );
}

function FileBlock({ block, readOnly, onConfig }) {
  const { data, name, size } = block.config;
  if (!data && !name) return <AttachmentPicker readOnly={readOnly} onPicked={(r) => onConfig({ data: r.data, name: r.name, size: r.size, mime: r.type })} />;
  return (
    <div className="nt-file">
      <span>📎</span>
      {data ? <a href={data} download={name} className="nt-a">{name}</a> : <span>{name}</span>}
      <span className="nt-muted">{Math.max(1, Math.round((size || 0) / 1024))} KB{data ? '' : ' · file not on this device'}</span>
    </div>
  );
}

/**
 * Block-based rich text editor. Blocks hold an inline-markdown string; the
 * block being edited shows its raw text (a textarea), every other block is
 * rendered. Slash menu, markdown shortcuts and [[ note links are built in.
 */
export const BlockEditor = forwardRef(function BlockEditor(
  { blocks, onChange, readOnly = false, resolveNote, onOpenNote, searchNotes, onCreateNote, placeholder = 'Start writing…  Type / for blocks, [[ to link a note' },
  ref
) {
  const [active, setActive] = useState(null);
  const [menu, setMenu] = useState(null); // { kind, blockId, query, index }
  const [dragOver, setDragOver] = useState(null);
  const taRefs = useRef(new Map());
  const focusReq = useRef(null);
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const rootRef = useRef(null);
  const menuItemsRef = useRef([]);
  const menuRef = useRef(null);
  menuRef.current = menu;

  useLayoutEffect(() => {
    const req = focusReq.current;
    if (!req) return;
    const el = taRefs.current.get(req.id);
    if (!el) return;
    el.focus({ preventScroll: false });
    const len = el.value.length;
    const start = req.start === 'end' ? len : req.start === 'start' ? 0 : req.start ?? len;
    el.setSelectionRange(start, req.end ?? start);
    focusReq.current = null;
  });

  const setTa = (id) => (el) => { if (el) taRefs.current.set(id, el); else taRefs.current.delete(id); };

  const push = (next, { structural = false, focus = null } = {}) => {
    if (structural) { undoStack.current.push(blocksRef.current); if (undoStack.current.length > 60) undoStack.current.shift(); redoStack.current = []; }
    if (focus) { focusReq.current = focus; setActive(focus.id); }
    onChange(next);
  };

  const setContent = (id, content) => push(blocksRef.current.map((b) => (b.id === id ? { ...b, content } : b)));
  const setConfig = (id, patch) => push(blocksRef.current.map((b) => (b.id === id ? { ...b, config: { ...b.config, ...patch } } : b)));
  const indexOf = (id) => blocksRef.current.findIndex((b) => b.id === id);

  const undo = () => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push(blocksRef.current);
    onChange(prev);
    setActive(null);
  };
  const redo = () => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(blocksRef.current);
    onChange(next);
  };

  useImperativeHandle(ref, () => ({
    focusStart() {
      const first = blocksRef.current.find(FOCUSABLE);
      if (first) push(blocksRef.current, { focus: { id: first.id, start: 'end' } });
    },
  }));

  // ---- block conversion & structure ----------------------------------------

  const withDefaults = (block, type) => {
    const config = {};
    if (isListType(type)) config.indent = block.config?.indent || 0;
    if (type === 'todo') config.checked = Boolean(block.config?.checked);
    if (type === 'code') config.lang = block.config?.lang || 'text';
    if (type === 'callout') config.variant = block.config?.variant || 'info';
    return config;
  };

  const turnInto = (id, type, { clear = false } = {}) => {
    const list = blocksRef.current;
    const i = indexOf(id);
    const b = list[i];
    if (!b) return;
    if (type === 'divider') {
      const p = newBlock('p');
      const next = [...list];
      next.splice(i, 1, { ...b, type: 'divider', content: '', config: {} }, p);
      push(next, { structural: true, focus: { id: p.id, start: 'start' } });
      return;
    }
    const converted = { ...b, type, content: clear ? '' : b.content, config: withDefaults(b, type) };
    const next = list.map((x) => (x.id === id ? converted : x));
    push(next, { structural: true, focus: FOCUSABLE(converted) ? { id, start: 'end' } : null });
    if (!FOCUSABLE(converted)) setActive(null);
  };

  const insertAfter = (id, newBlocks, focusFirst = true) => {
    const list = blocksRef.current;
    const i = indexOf(id);
    const next = [...list.slice(0, i + 1), ...newBlocks, ...list.slice(i + 1)];
    const target = newBlocks.find(FOCUSABLE);
    push(next, { structural: true, focus: focusFirst && target ? { id: target.id, start: 'start' } : null });
  };

  const removeBlock = (id, focusPrev = true) => {
    const list = blocksRef.current;
    const i = indexOf(id);
    let next = list.filter((b) => b.id !== id);
    if (next.length === 0) next = [newBlock('p')];
    const prev = [...list.slice(0, i)].reverse().find(FOCUSABLE) || next.find(FOCUSABLE);
    push(next, { structural: true, focus: focusPrev && prev ? { id: prev.id, start: 'end' } : null });
  };

  const moveBlock = (id, delta) => {
    const list = [...blocksRef.current];
    const i = indexOf(id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    push(list, { structural: true });
  };

  const duplicateBlock = (id) => {
    const b = blocksRef.current[indexOf(id)];
    if (b) insertAfter(id, [{ ...b, id: newBlock().id, config: { ...b.config } }], false);
  };

  const split = (id, s, e) => {
    const list = blocksRef.current;
    const i = indexOf(id);
    const b = list[i];
    const left = b.content.slice(0, s);
    const right = b.content.slice(e);

    if (b.type === 'p' && /^-{3,}$/.test(b.content.trim()) && s === b.content.length) {
      turnInto(id, 'divider', { clear: true });
      return;
    }
    if (isListType(b.type) && !b.content) {
      if ((b.config.indent || 0) > 0) setConfig(id, { indent: b.config.indent - 1 });
      else turnInto(id, 'p');
      return;
    }
    if ((b.type === 'quote' || b.type === 'callout')) {
      if (left.endsWith('\n') && !right) {
        const p = newBlock('p');
        const next = [...list];
        next.splice(i, 1, { ...b, content: left.slice(0, -1) }, p);
        push(next, { structural: true, focus: { id: p.id, start: 'start' } });
        return;
      }
      const v = `${left}\n${right}`;
      push(list.map((x) => (x.id === id ? { ...x, content: v } : x)), { focus: { id, start: left.length + 1 } });
      return;
    }
    const nextType = isListType(b.type) ? b.type : 'p';
    const created = newBlock(nextType, right, isListType(b.type) ? { indent: b.config.indent || 0, ...(b.type === 'todo' ? { checked: false } : {}) } : {});
    const next = [...list];
    next.splice(i, 1, { ...b, content: left }, created);
    push(next, { structural: true, focus: { id: created.id, start: 'start' } });
  };

  const backspaceAtStart = (id) => {
    const list = blocksRef.current;
    const i = indexOf(id);
    const b = list[i];
    if (b.type !== 'p') {
      if (isListType(b.type) && (b.config.indent || 0) > 0) setConfig(id, { indent: b.config.indent - 1 });
      else turnInto(id, 'p');
      return;
    }
    if (i === 0) return;
    const prev = list[i - 1];
    if (isTextType(prev.type)) {
      const joined = prev.content + b.content;
      const next = list.filter((x) => x.id !== id).map((x) => (x.id === prev.id ? { ...x, content: joined } : x));
      push(next, { structural: true, focus: { id: prev.id, start: prev.content.length } });
    } else if (prev.type === 'divider') {
      push(list.filter((x) => x.id !== prev.id), { structural: true, focus: { id, start: 'start' } });
    } else if (!b.content) {
      removeBlock(id);
    }
  };

  // ---- slash / link menus ----------------------------------------------------

  const slashItems = (query) => {
    const q = query.toLowerCase();
    return BLOCK_TYPES.filter((t) => !q || t.label.toLowerCase().includes(q) || t.keys.includes(q)).map((t) => ({ key: t.type, label: t.label, hint: t.hint, run: (id) => turnInto(id, t.type, { clear: true }) }));
  };

  const linkItems = (query) => {
    const found = (searchNotes?.(query) || []).slice(0, 6).map((n) => ({ key: n.id, label: `${n.icon ? `${n.icon} ` : ''}${n.title || 'Untitled note'}`, note: n }));
    const items = found.map((f) => ({ ...f, run: (id) => insertNoteLink(id, f.note) }));
    if (query.trim() && onCreateNote && !found.some((f) => f.note.title.toLowerCase() === query.trim().toLowerCase())) {
      items.push({ key: '__new', label: `Create note “${query.trim()}”`, hint: 'new', run: (id) => { const n = onCreateNote(query.trim()); if (n) insertNoteLink(id, n); } });
    }
    return items;
  };

  const insertNoteLink = (id, note) => {
    const ta = taRefs.current.get(id);
    const b = blocksRef.current[indexOf(id)];
    if (!ta || !b) return;
    const caret = ta.selectionStart;
    const open = b.content.lastIndexOf('[[', caret);
    if (open === -1) return;
    const token = `[[${note.id}|${note.title || 'Untitled note'}]]`;
    const content = `${b.content.slice(0, open)}${token}${b.content.slice(caret)}`;
    setMenu(null);
    push(blocksRef.current.map((x) => (x.id === id ? { ...x, content } : x)), { focus: { id, start: open + token.length } });
  };

  const updateMenu = (block, value, caret) => {
    if (block.type === 'p' && /^\/[\w ]{0,20}$/.test(value) && !value.includes('  ')) {
      setMenu((m) => ({ kind: 'slash', blockId: block.id, query: value.slice(1), index: m?.kind === 'slash' && m.blockId === block.id ? m.index : 0 }));
      return;
    }
    const before = value.slice(0, caret);
    const open = before.lastIndexOf('[[');
    if (open !== -1 && !before.slice(open).includes(']]') && !before.slice(open).includes('\n')) {
      setMenu((m) => ({ kind: 'link', blockId: block.id, query: before.slice(open + 2), index: m?.kind === 'link' && m.blockId === block.id ? m.index : 0 }));
      return;
    }
    setMenu(null);
  };

  const handleChange = (block, value, caret) => {
    if (block.type === 'p' || isListType(block.type) || block.type === 'quote') {
      for (const [re, type] of MARKDOWN_SHORTCUTS) {
        if (block.type === 'p' && re.test(value)) { turnInto(block.id, type, { clear: true }); setMenu(null); return; }
      }
      if (block.type === 'p' && value === '```') { turnInto(block.id, 'code', { clear: true }); setMenu(null); return; }
    }
    setContent(block.id, value);
    updateMenu(block, value, caret);
  };

  // ---- keyboard --------------------------------------------------------------

  const formatActive = (marker) => {
    const id = active;
    const ta = id && taRefs.current.get(id);
    if (!ta) return;
    const r = toggleWrap(ta.value, ta.selectionStart, ta.selectionEnd, marker);
    setContent(id, r.text);
    focusReq.current = { id, start: r.start, end: r.end };
  };

  const linkActive = () => {
    const id = active;
    const ta = id && taRefs.current.get(id);
    if (!ta) return;
    const url = window.prompt('Link address (https://…)', 'https://');
    if (!url || !isHttpUrl(url)) return;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const label = value.slice(s, e) || url;
    const text = `${value.slice(0, s)}[${label}](${url.trim()})${value.slice(e)}`;
    setContent(id, text);
    focusReq.current = { id, start: s + label.length + url.trim().length + 4 };
  };

  const noteLinkActive = () => {
    const id = active;
    const ta = id && taRefs.current.get(id);
    if (!ta) return;
    const { selectionStart: s, value } = ta;
    const text = `${value.slice(0, s)}[[${value.slice(s)}`;
    setContent(id, text);
    focusReq.current = { id, start: s + 2 };
    setMenu({ kind: 'link', blockId: id, query: '', index: 0 });
  };

  const focusNeighbour = (id, dir) => {
    const list = blocksRef.current;
    let i = indexOf(id) + dir;
    while (i >= 0 && i < list.length && !FOCUSABLE(list[i])) i += dir;
    if (i < 0 || i >= list.length) return false;
    push(list, { focus: { id: list[i].id, start: dir < 0 ? 'end' : 'start' } });
    return true;
  };

  const onKeyDown = (block) => (e) => {
    const ta = e.target;
    const { selectionStart: s, selectionEnd: en, value } = ta;
    const m = menuRef.current;

    if (m && m.blockId === block.id) {
      const items = menuItemsRef.current;
      if (e.key === 'ArrowDown') { e.preventDefault(); setMenu({ ...m, index: (m.index + 1) % Math.max(1, items.length) }); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMenu({ ...m, index: (m.index - 1 + items.length) % Math.max(1, items.length) }); return; }
      if ((e.key === 'Enter' || e.key === 'Tab') && items.length) { e.preventDefault(); items[Math.min(m.index, items.length - 1)].run(block.id); setMenu(null); return; }
      if (e.key === 'Escape') { e.preventDefault(); setMenu(null); return; }
    }

    const mod = e.metaKey || e.ctrlKey;
    if (mod && !e.shiftKey) {
      const key = e.key.toLowerCase();
      if (key === 'b') { e.preventDefault(); formatActive('**'); return; }
      if (key === 'i') { e.preventDefault(); formatActive('*'); return; }
      if (key === 'e') { e.preventDefault(); formatActive('`'); return; }
      if (key === 'k') { e.preventDefault(); linkActive(); return; }
    }
    if (mod && e.shiftKey && e.key.toLowerCase() === 's') { e.preventDefault(); formatActive('~~'); return; }

    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      split(block.id, s, en);
      return;
    }
    if (e.key === 'Backspace' && s === 0 && en === 0) { e.preventDefault(); backspaceAtStart(block.id); return; }
    if (e.key === 'ArrowUp' && s === en && value.lastIndexOf('\n', s - 1) === -1) { if (focusNeighbour(block.id, -1)) e.preventDefault(); return; }
    if (e.key === 'ArrowDown' && s === en && value.indexOf('\n', s) === -1) { if (focusNeighbour(block.id, 1)) e.preventDefault(); return; }
    if (e.key === 'Tab' && isListType(block.type)) {
      e.preventDefault();
      const cur = block.config.indent || 0;
      const next = Math.max(0, Math.min(3, cur + (e.shiftKey ? -1 : 1)));
      if (next !== cur) setConfig(block.id, { indent: next });
      return;
    }
    if (e.key === 'Escape') setActive(null);
  };

  const onPaste = (block) => async (e) => {
    const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'));
    if (files.length) {
      e.preventDefault();
      const created = [];
      for (const f of files) {
        const res = await readAttachment(f, { image: true });
        if (res.ok) created.push(newBlock('image', '', { data: res.data, name: res.name, size: res.size }));
      }
      if (created.length) insertAfter(block.id, created, false);
      return;
    }
    const text = e.clipboardData?.getData('text/plain') || '';
    const ta = e.target;
    if (isHttpUrl(text) && ta.selectionStart !== ta.selectionEnd) {
      e.preventDefault();
      const { selectionStart: s, selectionEnd: en, value } = ta;
      setContent(block.id, `${value.slice(0, s)}[${value.slice(s, en)}](${text.trim()})${value.slice(en)}`);
      return;
    }
    if (text.includes('\n')) {
      const parsed = parseMarkdown(text);
      if (parsed.length > 1 || (parsed[0] && parsed[0].type !== 'p')) {
        e.preventDefault();
        const list = blocksRef.current;
        const i = indexOf(block.id);
        const replace = block.type === 'p' && !block.content;
        const next = replace ? [...list.slice(0, i), ...parsed, ...list.slice(i + 1)] : [...list.slice(0, i + 1), ...parsed, ...list.slice(i + 1)];
        const last = [...parsed].reverse().find(FOCUSABLE);
        push(next, { structural: true, focus: last ? { id: last.id, start: 'end' } : null });
      }
    }
  };

  // ---- rendering -------------------------------------------------------------

  const numberLabels = useMemo(() => {
    const labels = new Map();
    const counters = [];
    for (const b of blocks) {
      if (b.type === 'number') {
        const lvl = b.config.indent || 0;
        counters.length = lvl + 1;
        counters[lvl] = (counters[lvl] || 0) + 1;
        labels.set(b.id, counters[lvl]);
      } else counters.length = 0;
    }
    return labels;
  }, [blocks]);

  const menuItems = useMemo(() => {
    if (!menu) return [];
    return menu.kind === 'slash' ? slashItems(menu.query) : linkItems(menu.query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu, searchNotes, onCreateNote]);
  menuItemsRef.current = menuItems;

  const rowMenuItems = (b) => [
    { label: 'Move up', icon: '↑', onClick: () => moveBlock(b.id, -1) },
    { label: 'Move down', icon: '↓', onClick: () => moveBlock(b.id, 1) },
    { label: 'Duplicate', icon: '⧉', onClick: () => duplicateBlock(b.id) },
    { divider: true },
    ...BLOCK_TYPES.filter((t) => isTextType(t.type) || t.type === 'code').filter((t) => isTextType(b.type) || b.type === 'code').map((t) => ({ label: `Turn into ${t.label.toLowerCase()}`, onClick: () => turnInto(b.id, t.type) })),
    { divider: true },
    { label: 'Delete block', icon: '🗑', danger: true, onClick: () => removeBlock(b.id) },
  ];

  const renderText = (b) => {
    const isActive = active === b.id && !readOnly;
    const inline = <InlineText text={b.content} resolveNote={resolveNote} onOpenNote={onOpenNote} />;
    const ph = blocks.length === 1 && !b.content ? placeholder : '';
    const content = isActive ? (
      <AutoTextarea
        value={b.content}
        onChange={(v) => handleChange(b, v, taRefs.current.get(b.id)?.selectionStart ?? v.length)}
        onKeyDown={onKeyDown(b)}
        onPaste={onPaste(b)}
        taRef={setTa(b.id)}
        placeholder={ph || (b.type === 'p' ? "Type '/' for blocks" : '')}
        className={`nt-input-${b.type}`}
      />
    ) : (
      <div className={`nt-rendered nt-r-${b.type}`} onClick={readOnly ? undefined : () => { focusReq.current = { id: b.id, start: 'end' }; setActive(b.id); }}>
        {b.content ? inline : <span className="nt-placeholder">{ph}</span>}
      </div>
    );

    switch (b.type) {
      case 'h1': case 'h2': case 'h3':
        return <div className={`nt-heading ${b.type}`}>{content}</div>;
      case 'bullet':
        return <div className="nt-li"><span className="nt-marker">•</span>{content}</div>;
      case 'number':
        return <div className="nt-li"><span className="nt-marker nt-num">{numberLabels.get(b.id)}.</span>{content}</div>;
      case 'todo':
        return (
          <div className={`nt-li nt-todo${b.config.checked ? ' checked' : ''}`}>
            <button type="button" className="nt-check" role="checkbox" aria-checked={Boolean(b.config.checked)} disabled={readOnly} onClick={() => setConfig(b.id, { checked: !b.config.checked })}>{b.config.checked ? '✓' : ''}</button>
            {content}
          </div>
        );
      case 'quote':
        return <blockquote className="nt-quote">{content}</blockquote>;
      case 'callout': {
        const v = CALLOUT_VARIANTS.find((c) => c.value === (b.config.variant || 'info')) || CALLOUT_VARIANTS[0];
        return (
          <div className={`nt-callout ${v.value}`}>
            <button type="button" className="nt-callout-icon" title="Change style" disabled={readOnly} onClick={() => setConfig(b.id, { variant: CALLOUT_VARIANTS[(CALLOUT_VARIANTS.indexOf(v) + 1) % CALLOUT_VARIANTS.length].value })}>{v.icon}</button>
            <div className="nt-callout-body">{content}</div>
          </div>
        );
      }
      default:
        return content;
    }
  };

  const renderBlock = (b) => {
    if (isTextType(b.type)) return renderText(b);
    switch (b.type) {
      case 'code':
        return (
          <CodeBlock
            block={b}
            active={active === b.id}
            readOnly={readOnly}
            taRef={setTa(b.id)}
            onActivate={() => { focusReq.current = { id: b.id, start: 'end' }; setActive(b.id); }}
            onChange={(v) => setContent(b.id, v)}
            onConfig={(patch) => setConfig(b.id, patch)}
            onExit={(mode) => (mode === 'convert' ? turnInto(b.id, 'p') : insertAfter(b.id, [newBlock('p')]))}
          />
        );
      case 'divider': return <hr className="nt-divider" />;
      case 'embed': return <EmbedBlock block={b} readOnly={readOnly} onConfig={(patch) => setConfig(b.id, patch)} />;
      case 'image': return <ImageBlock block={b} readOnly={readOnly} onConfig={(patch) => setConfig(b.id, patch)} />;
      case 'file': return <FileBlock block={b} readOnly={readOnly} onConfig={(patch) => setConfig(b.id, patch)} />;
      default: return null;
    }
  };

  const onDrop = (targetId, e) => {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData('text/x-block');
    if (!id || id === targetId) return;
    const list = [...blocksRef.current];
    const from = list.findIndex((b) => b.id === id);
    const to = list.findIndex((b) => b.id === targetId);
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved); // lands after the target when dragging down, before it when dragging up
    push(list, { structural: true });
  };

  const onRootBlur = (e) => {
    if (!rootRef.current?.contains(e.relatedTarget)) { setActive(null); setMenu(null); }
  };

  const activeBlock = blocks.find((b) => b.id === active);

  return (
    <div className="nt-editor" ref={rootRef} onBlur={onRootBlur}>
      {!readOnly && (
        <div className="nt-toolbar" onMouseDown={(e) => { if (e.target.tagName !== 'SELECT') e.preventDefault(); }}>
          <button type="button" className="nt-tool" onClick={undo} disabled={!undoStack.current.length} title="Undo structure change"><Undo2 size={15} /></button>
          <button type="button" className="nt-tool" onClick={redo} disabled={!redoStack.current.length} title="Redo"><Redo2 size={15} /></button>
          <span className="nt-tool-sep" />
          <button type="button" className="nt-tool" onClick={() => formatActive('**')} disabled={!activeBlock || !isTextType(activeBlock.type)} title="Bold (Ctrl+B)"><Bold size={15} /></button>
          <button type="button" className="nt-tool" onClick={() => formatActive('*')} disabled={!activeBlock || !isTextType(activeBlock.type)} title="Italic (Ctrl+I)"><Italic size={15} /></button>
          <button type="button" className="nt-tool" onClick={() => formatActive('~~')} disabled={!activeBlock || !isTextType(activeBlock.type)} title="Strikethrough"><Strikethrough size={15} /></button>
          <button type="button" className="nt-tool" onClick={() => formatActive('`')} disabled={!activeBlock || !isTextType(activeBlock.type)} title="Inline code (Ctrl+E)"><Code2 size={15} /></button>
          <button type="button" className="nt-tool" onClick={linkActive} disabled={!activeBlock || !isTextType(activeBlock.type)} title="Link (Ctrl+K)"><Link2 size={15} /></button>
          <button type="button" className="nt-tool" onClick={noteLinkActive} disabled={!activeBlock || !isTextType(activeBlock.type)} title="Link a note ([[)"><StickyNote size={15} /></button>
          <span className="nt-tool-sep" />
          <select
            className="nt-tool-select"
            aria-label="Turn block into"
            value={activeBlock && (isTextType(activeBlock.type) || activeBlock.type === 'code') ? activeBlock.type : ''}
            disabled={!activeBlock || !(isTextType(activeBlock.type) || activeBlock.type === 'code')}
            onChange={(e) => e.target.value && activeBlock && turnInto(activeBlock.id, e.target.value)}
          >
            <option value="" disabled>Block…</option>
            {BLOCK_TYPES.filter((t) => isTextType(t.type) || t.type === 'code').map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
          </select>
        </div>
      )}

      <div className="nt-blocks">
        {blocks.map((b) => (
          <div
            key={b.id}
            className={`nt-block indent-${b.config.indent || 0}${dragOver === b.id ? ' drag-over' : ''}${active === b.id ? ' is-active' : ''}`}
            onDragOver={readOnly ? undefined : (e) => { if (e.dataTransfer.types.includes('text/x-block')) { e.preventDefault(); setDragOver(b.id); } }}
            onDragLeave={() => setDragOver((d) => (d === b.id ? null : d))}
            onDrop={readOnly ? undefined : (e) => onDrop(b.id, e)}
          >
            {!readOnly && (
              <div className="nt-gutter">
                <Menu items={rowMenuItems(b)} label="Block actions" align="left" className="nt-block-menu">
                  <span
                    className="nt-grip"
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData('text/x-block', b.id); e.dataTransfer.effectAllowed = 'move'; }}
                  >
                    <GripVertical size={14} />
                  </span>
                </Menu>
              </div>
            )}
            <div className="nt-block-body">
              {renderBlock(b)}
              {menu && menu.blockId === b.id && (
                <div className="nt-popup" onMouseDown={(e) => e.preventDefault()}>
                  {menu.kind === 'link' && <div className="nt-popup-title">Link a note</div>}
                  {menuItems.length === 0 && <div className="nt-popup-empty">{menu.kind === 'link' ? 'No matching notes — keep typing to create one' : 'No matching blocks'}</div>}
                  {menuItems.map((it, i) => (
                    <button
                      type="button"
                      key={it.key}
                      className={`nt-popup-item${i === Math.min(menu.index, menuItems.length - 1) ? ' on' : ''}`}
                      onMouseEnter={() => setMenu((m) => (m ? { ...m, index: i } : m))}
                      onClick={() => { it.run(b.id); setMenu(null); }}
                    >
                      <span>{it.label}</span>
                      {it.hint && <span className="nt-muted">{it.hint}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {!readOnly && (
          <button type="button" className="nt-add-block" onClick={() => { const last = blocks[blocks.length - 1]; const p = newBlock('p'); if (last && last.type === 'p' && !last.content) { push(blocks, { focus: { id: last.id, start: 'end' } }); return; } push([...blocks, p], { structural: true, focus: { id: p.id, start: 'start' } }); }}>
            <Plus size={14} /> Add a block
          </button>
        )}
      </div>
    </div>
  );
});
