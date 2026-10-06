import { useMemo, useState } from 'react';
import { Star } from 'lucide-react';
import { Select } from '../../components/inputs/Select.jsx';
import { SegmentedControl } from '../../components/inputs/SegmentedControl.jsx';
import { noteTitle, highlightSegments, treeOrder } from '../knowledge.js';
import { blocksToText } from '../markdown.js';
import { toggleFavorite, setArchived, deleteNote } from '../notes-store.js';

const PAGE = 60;

export function relativeTime(ms) {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} d ago`;
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: d > 300 ? 'numeric' : undefined });
}

function Highlight({ text, terms }) {
  return highlightSegments(text, terms || []).map((s, i) => (s.hit ? <mark key={i}>{s.text}</mark> : <span key={i}>{s.text}</span>));
}

/** One row in any list of notes. */
export function NoteRow({ note, state, onOpen, terms, snippet, depth = 0, archivedActions }) {
  const status = state.noteConfig.statuses.find((s) => s.id === note.statusId);
  const collections = note.collectionIds.map((id) => state.noteCollections.find((c) => c.id === id)).filter(Boolean);
  const tags = note.tagIds.map((id) => state.noteTags.find((t) => t.id === id)).filter(Boolean);
  const preview = snippet ?? blocksToText(note.blocks.slice(0, 4)).replace(/\s+/g, ' ').slice(0, 140);

  return (
    <div className="nt-row" style={{ paddingLeft: `${0.7 + depth * 1.1}rem` }} role="button" tabIndex={0} onClick={() => onOpen(note.id)} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(note.id); }}>
      <span className="nt-row-icon">{note.icon || '📄'}</span>
      <div className="nt-row-main">
        <div className="nt-row-title">
          <span><Highlight text={noteTitle(note)} terms={terms} /></span>
          {status && <span className="nt-row-status" style={{ '--chip': status.color }} title={status.label}>{status.icon}</span>}
        </div>
        {preview && <div className="nt-row-snippet"><Highlight text={preview} terms={terms} /></div>}
        {(collections.length > 0 || tags.length > 0) && (
          <div className="nt-row-meta">
            {collections.map((c) => <span key={c.id} className="nt-mini">{c.icon} {c.name}</span>)}
            {tags.map((t) => <span key={t.id} className="nt-mini tag">#{t.name}</span>)}
          </div>
        )}
      </div>
      <div className="nt-row-side" onClick={(e) => e.stopPropagation()}>
        <span className="nt-muted">{relativeTime(note.updatedAt)}</span>
        {archivedActions ? (
          <div className="nt-row-actions">
            <button type="button" className="nt-btn small" onClick={() => setArchived(note.id, false)}>Restore</button>
            <button type="button" className="nt-btn small danger" onClick={() => { if (window.confirm('Delete this note permanently?')) deleteNote(note.id); }}>Delete</button>
          </div>
        ) : (
          <button type="button" className={`nt-icon-btn${note.favorite ? ' on' : ''}`} aria-label={note.favorite ? 'Unfavorite' : 'Favorite'} onClick={() => toggleFavorite(note.id)}><Star size={15} fill={note.favorite ? 'currentColor' : 'none'} /></button>
        )}
      </div>
    </div>
  );
}

/** A titled list of notes with sorting and an optional tree (parent/child) layout. */
export function NoteList({ title, subtitle, notes, state, onOpen, allowTree = true, defaultSort = 'updated', archived = false, emptyText = 'No notes here yet.' }) {
  const [sort, setSort] = useState(defaultSort);
  const [layout, setLayout] = useState('list');
  const [limit, setLimit] = useState(PAGE);

  const rows = useMemo(() => {
    if (layout === 'tree' && allowTree) return treeOrder(notes);
    const by = {
      updated: (a, b) => b.updatedAt - a.updatedAt,
      created: (a, b) => b.createdAt - a.createdAt,
      title: (a, b) => noteTitle(a).localeCompare(noteTitle(b), undefined, { numeric: true }),
    }[sort];
    return [...notes].sort(by).map((note) => ({ note, depth: 0 }));
  }, [notes, sort, layout, allowTree]);

  return (
    <section className="nt-list">
      <header className="nt-list-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <span className="nt-muted">{subtitle}</span>}
        </div>
        <div className="nt-list-tools">
          {allowTree && <SegmentedControl value={layout} onChange={setLayout} options={[{ value: 'list', label: 'List' }, { value: 'tree', label: 'Tree' }]} />}
          {layout === 'list' && <Select value={sort} onChange={setSort} options={[{ value: 'updated', label: 'Recently updated' }, { value: 'created', label: 'Newest' }, { value: 'title', label: 'Title A–Z' }]} />}
        </div>
      </header>
      <div className="nt-rows">
        {rows.slice(0, limit).map(({ note, depth }) => <NoteRow key={note.id} note={note} state={state} onOpen={onOpen} depth={depth} archivedActions={archived} />)}
        {rows.length === 0 && <div className="empty-state">{emptyText}</div>}
      </div>
      {rows.length > limit && <button type="button" className="nt-btn" onClick={() => setLimit((l) => l + PAGE)}>Show more ({rows.length - limit})</button>}
    </section>
  );
}
