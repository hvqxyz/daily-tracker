import { collectionCounts, notesNeedingReview, recentNotes, noteTitle, activeNotes } from '../knowledge.js';
import { NoteRow } from './NoteList.jsx';
import { Button } from '../../components/buttons/Button.jsx';

function Block({ title, action, children }) {
  return (
    <section className="nt-home-block">
      <header><h3>{title}</h3>{action}</header>
      {children}
    </section>
  );
}

/** Landing page: what needs attention, what was recent, and the shape of your knowledge. */
export function Home({ state, onOpen, onNew, onSelect, onTemplates, onLoadSamples }) {
  const notes = activeNotes(state.notes);
  const review = notesNeedingReview(state);
  const recent = recentNotes(state.notes, 6);
  const favorites = notes.filter((n) => n.favorite).slice(0, 5);
  const counts = collectionCounts(state);
  const statusOf = (n) => state.noteConfig.statuses.find((s) => s.id === n.statusId);

  if (notes.length === 0) {
    return (
      <div className="nt-empty-home">
        <h2>Your knowledge base is empty</h2>
        <p className="nt-muted">Capture something you want to remember, understand or connect. Nothing to set up first.</p>
        <div className="nt-empty-actions">
          <Button onClick={() => onNew()}>+ New note</Button>
          <Button variant="subtle" onClick={onTemplates}>Start from a template</Button>
          <Button variant="subtle" onClick={onLoadSamples}>Load example notes</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="nt-home">
      {review.length > 0 && (
        <Block title="Need review" action={<span className="nt-count">{review.length}</span>}>
          <div className="nt-simple-list">
            {review.slice(0, 6).map((n) => (
              <button type="button" key={n.id} className="nt-simple-row" onClick={() => onOpen(n.id)}>
                <span>{statusOf(n)?.icon}</span> {noteTitle(n)}
              </button>
            ))}
            {review.length > 6 && <button type="button" className="nt-link-btn" onClick={() => onSelect({ kind: 'search', statusId: state.noteConfig.statuses.find((s) => s.review)?.id })}>See all {review.length}</button>}
          </div>
        </Block>
      )}

      {favorites.length > 0 && (
        <Block title="Favorites">
          <div className="nt-simple-list">
            {favorites.map((n) => <button type="button" key={n.id} className="nt-simple-row" onClick={() => onOpen(n.id)}>{n.icon || '⭐'} {noteTitle(n)}</button>)}
          </div>
        </Block>
      )}

      <Block title="Recent" action={<button type="button" className="nt-link-btn" onClick={() => onSelect({ kind: 'list', filter: 'recent' })}>All recent</button>}>
        <div className="nt-rows flat">
          {recent.map((n) => <NoteRow key={n.id} note={n} state={state} onOpen={onOpen} />)}
        </div>
      </Block>

      <Block title="Collections">
        <div className="nt-collections">
          {state.noteCollections.map((c) => (
            <button type="button" key={c.id} className="nt-coll-card" onClick={() => onSelect({ kind: 'list', filter: 'collection', id: c.id })}>
              <span className="nt-coll-icon">{c.icon}</span>
              <span className="nt-coll-name">{c.name}</span>
              <span className="nt-muted">{counts.get(c.id) || 0} note{(counts.get(c.id) || 0) === 1 ? '' : 's'}</span>
            </button>
          ))}
          {state.noteCollections.length === 0 && <p className="nt-muted">Collections you create show up here.</p>}
        </div>
      </Block>
    </div>
  );
}
