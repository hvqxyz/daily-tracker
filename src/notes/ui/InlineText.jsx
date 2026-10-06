import { Fragment } from 'react';
import { parseInline } from '../inline.js';

/** Renders the inline markdown dialect as React nodes (no HTML injection possible). */
export function InlineText({ text, resolveNote, onOpenNote }) {
  const render = (nodes) => nodes.map((n, i) => {
    switch (n.t) {
      case 'text': return <Fragment key={i}>{n.v}</Fragment>;
      case 'bold': return <strong key={i}>{render(n.c)}</strong>;
      case 'italic': return <em key={i}>{render(n.c)}</em>;
      case 'strike': return <s key={i}>{render(n.c)}</s>;
      case 'code': return <code key={i} className="nt-inline-code">{n.v}</code>;
      case 'link':
        return (
          <a key={i} className="nt-a" href={n.href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
            {render(n.c)}
          </a>
        );
      case 'note': {
        const target = resolveNote?.(n.id);
        if (!target) return <span key={i} className="nt-link broken" title="This note no longer exists">{n.title}</span>;
        return (
          <button
            type="button"
            key={i}
            className="nt-link"
            onClick={(e) => { e.stopPropagation(); onOpenNote?.(n.id); }}
          >
            {target.icon ? `${target.icon} ` : ''}{target.title || 'Untitled note'}
          </button>
        );
      }
      default: return null;
    }
  });
  return <>{render(parseInline(text || ''))}</>;
}
