import { useMemo } from 'react';
import { Select } from '../../components/inputs/Select.jsx';
import { NoteRow } from './NoteList.jsx';
import { searchNotes, tokenize } from '../knowledge.js';

/** Results for the global search box, with collection / status / tag filters. */
export function SearchView({ state, ctx, search, onChange, onOpen }) {
  const { query, collectionId, statusId, tagId } = search;
  const results = useMemo(
    () => searchNotes(state, { query, collectionId: collectionId || null, statusId: statusId || null, tagId: tagId || null, itemLabel: (id) => ctx.itemLabel(id) }),
    [state, ctx, query, collectionId, statusId, tagId]
  );
  const terms = tokenize(query);
  const set = (patch) => onChange({ ...search, ...patch });

  return (
    <section className="nt-list">
      <header className="nt-list-head">
        <div>
          <h2>{query.trim() ? `Search: ${query.trim()}` : 'Filter notes'}</h2>
          <span className="nt-muted">{results.length} result{results.length === 1 ? '' : 's'}</span>
        </div>
      </header>
      <div className="nt-filters">
        <Select value={collectionId || ''} onChange={(v) => set({ collectionId: v })} options={state.noteCollections.map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` }))} placeholder="Any collection" />
        <Select value={statusId || ''} onChange={(v) => set({ statusId: v })} options={state.noteConfig.statuses.map((s) => ({ value: s.id, label: `${s.icon} ${s.label}` }))} placeholder="Any status" />
        <Select value={tagId || ''} onChange={(v) => set({ tagId: v })} options={state.noteTags.map((t) => ({ value: t.id, label: `#${t.name}` }))} placeholder="Any tag" />
      </div>
      <div className="nt-rows">
        {results.slice(0, 80).map((r) => <NoteRow key={r.note.id} note={r.note} state={state} onOpen={onOpen} terms={r.terms.length ? terms : []} snippet={r.terms.length ? r.snippet : undefined} />)}
        {results.length === 0 && <div className="empty-state">Nothing matches. Try fewer words or clear a filter.</div>}
      </div>
    </section>
  );
}
