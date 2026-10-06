// Markdown <-> blocks. Used for pasting, quick capture, templates and export.

import { newBlock } from './model.js';
import { inlineToText } from './inline.js';

const HEADING = /^(#{1,6})\s+(.*)$/;
const TODO = /^(\s*)[-*+]\s+\[( |x|X)\]\s?(.*)$/;
const BULLET = /^(\s*)[-*+]\s+(.*)$/;
const NUMBER = /^(\s*)\d+[.)]\s+(.*)$/;
const IMAGE = /^!\[([^\]]*)\]\((\S+?)\)\s*$/;

const indentOf = (ws) => Math.min(3, Math.floor(ws.replace(/\t/g, '  ').length / 2));

export function parseMarkdown(text) {
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let para = [];
  const flushPara = () => {
    if (para.length) { blocks.push(newBlock('p', para.join('\n'))); para = []; }
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const fence = /^\s*```\s*([\w+-]*)\s*$/.exec(line);
    if (fence) {
      flushPara();
      const code = [];
      i += 1;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) { code.push(lines[i]); i += 1; }
      blocks.push(newBlock('code', code.join('\n'), { lang: fence[1] || 'text' }));
      continue;
    }
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) { flushPara(); blocks.push(newBlock('divider')); continue; }
    let m;
    if ((m = HEADING.exec(line))) { flushPara(); blocks.push(newBlock(`h${Math.min(3, m[1].length)}`, m[2].trim())); continue; }
    if ((m = TODO.exec(line))) { flushPara(); blocks.push(newBlock('todo', m[3], { checked: m[2] !== ' ', indent: indentOf(m[1]) })); continue; }
    if ((m = BULLET.exec(line))) { flushPara(); blocks.push(newBlock('bullet', m[2], { indent: indentOf(m[1]) })); continue; }
    if ((m = NUMBER.exec(line))) { flushPara(); blocks.push(newBlock('number', m[2], { indent: indentOf(m[1]) })); continue; }
    if (/^\s*>/.test(line)) {
      flushPara();
      const quote = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) { quote.push(lines[i].replace(/^\s*>\s?/, '')); i += 1; }
      i -= 1;
      blocks.push(newBlock('quote', quote.join('\n')));
      continue;
    }
    if ((m = IMAGE.exec(line))) { flushPara(); blocks.push(newBlock('image', '', { url: m[2], caption: m[1] })); continue; }
    if (!line.trim()) { flushPara(); continue; }
    para.push(line);
  }
  flushPara();
  return blocks;
}

export function blocksToMarkdown(blocks, resolveNote) {
  const inline = (s) => String(s || '').replace(/\[\[([^\]|]+)\|([^\]]*)\]\]/g, (_, id, title) => `[[${resolveNote?.(id)?.title ?? title}]]`);
  const out = [];
  let numbering = [];
  for (const b of blocks) {
    const indent = '  '.repeat(b.config?.indent || 0);
    if (b.type !== 'number') numbering = [];
    switch (b.type) {
      case 'h1': out.push(`# ${inline(b.content)}`); break;
      case 'h2': out.push(`## ${inline(b.content)}`); break;
      case 'h3': out.push(`### ${inline(b.content)}`); break;
      case 'bullet': out.push(`${indent}- ${inline(b.content)}`); break;
      case 'todo': out.push(`${indent}- [${b.config?.checked ? 'x' : ' '}] ${inline(b.content)}`); break;
      case 'number': {
        const level = b.config?.indent || 0;
        numbering.length = level + 1;
        numbering[level] = (numbering[level] || 0) + 1;
        out.push(`${indent}${numbering[level]}. ${inline(b.content)}`);
        break;
      }
      case 'quote': out.push(inline(b.content).split('\n').map((l) => `> ${l}`).join('\n')); break;
      case 'callout': out.push(inline(b.content).split('\n').map((l, i) => `> ${i === 0 ? `${b.config?.variant === 'warn' ? '⚠️' : '💡'} ` : ''}${l}`).join('\n')); break;
      case 'code': out.push(`\`\`\`${b.config?.lang && b.config.lang !== 'text' ? b.config.lang : ''}\n${b.content}\n\`\`\``); break;
      case 'divider': out.push('---'); break;
      case 'embed': out.push(b.config?.url ? `[${b.config.title || b.config.url}](${b.config.url})` : ''); break;
      case 'image': out.push(b.config?.url && !String(b.config.url).startsWith('data:') ? `![${b.config?.caption || ''}](${b.config.url})` : `![${b.config?.name || b.config?.caption || 'image'}]`); break;
      case 'file': out.push(`📎 ${b.config?.name || 'attachment'}`); break;
      default: out.push(inline(b.content));
    }
  }
  return out.join('\n\n').replace(/\n\n(?=\s*(?:- |\d+\. ))/g, (m, offset, whole) => {
    // keep list items tight: no blank line between consecutive list lines
    const prev = whole.slice(0, offset).split('\n').pop();
    return /^\s*(?:- |\d+\. )/.test(prev) ? '\n' : m;
  });
}

/** Searchable plain text of a block list. */
export function blocksToText(blocks, resolveNote) {
  return blocks
    .map((b) => {
      if (b.type === 'code') return b.content;
      if (b.type === 'embed') return [b.config?.title, b.config?.url].filter(Boolean).join(' ');
      if (b.type === 'image' || b.type === 'file') return [b.config?.caption, b.config?.name].filter(Boolean).join(' ');
      if (b.type === 'divider') return '';
      return inlineToText(b.content, resolveNote);
    })
    .filter(Boolean)
    .join('\n');
}
