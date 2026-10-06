import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { NotePickerModal, TrackerItemPickerModal } from './pickers.jsx';
import { addRelation, createNote, linkTrackerItem, removeRelation, unlinkTrackerItem } from '../notes-store.js';
import { noteTitle } from '../knowledge.js';
import { formatDateDMY } from '../../common/time.js';

function Section({ title, count, action, children }) {
  return (
    <section className="nt-rel-section">
      <header>
        <h4>{title}{count ? <span className="nt-count">{count}</span> : null}</h4>
        {action}
      </header>
      {children}
    </section>
  );
}

function NoteRow({ note, onOpen, onRemove, prefix = '' }) {
  return (
    <div className="nt-rel-row">
      <button type="button" className="nt-rel-link" onClick={() => onOpen(note.id)}>{prefix}{note.icon || '📄'} {noteTitle(note)}</button>
      {onRemove && <button type="button" className="nt-icon-btn" aria-label="Remove" onClick={onRemove}><X size={13} /></button>}
    </div>
  );
}

/** Sub-notes, related notes, backlinks, tracker items and planned activities of one note. */
export function RelatedPanel({ note, data, onOpen, onOpenItem, onNewChild }) {
  const { state, ctx, index } = data;
  const [picker, setPicker] = useState(null); // 'note' | 'item' | null

  const children = index.childrenOf(note.id);
  const explicit = (note.relations || []).map((r) => index.byId.get(r.targetId)).filter(Boolean);
  const explicitIds = new Set(explicit.map((n) => n.id));
  const inline = index.outlinksOf(note.id).filter((n) => !explicitIds.has(n.id));
  const backlinks = index.backlinksOf(note.id);
  const activities = useMemo(
    () => Object.entries(state.days)
      .flatMap(([date, day]) => day.activities.filter((a) => a.noteId === note.id).map((a) => ({ date, a })))
      .sort((x, y) => y.date.localeCompare(x.date))
      .slice(0, 5),
    [state.days, note.id]
  );

  return (
    <div className="nt-related">
      <Section title="Sub-notes" count={children.length} action={<button type="button" className="nt-btn small" onClick={onNewChild}><Plus size={13} /> Add</button>}>
        {children.map((c) => <NoteRow key={c.id} note={c} onOpen={onOpen} />)}
        {children.length === 0 && <p className="nt-muted">Optional. Break a big topic into smaller notes.</p>}
      </Section>

      <Section title="Related notes" count={explicit.length + inline.length} action={<button type="button" className="nt-btn small" onClick={() => setPicker('note')}><Plus size={13} /> Link</button>}>
        {explicit.map((n) => <NoteRow key={n.id} note={n} onOpen={onOpen} prefix="→ " onRemove={() => removeRelation(note.id, n.id)} />)}
        {inline.map((n) => <NoteRow key={n.id} note={n} onOpen={onOpen} prefix="→ " />)}
        {explicit.length + inline.length === 0 && <p className="nt-muted">Type [[ in the note to link another note.</p>}
      </Section>

      <Section title="Backlinks" count={backlinks.length}>
        {backlinks.map((n) => <NoteRow key={n.id} note={n} onOpen={onOpen} prefix="← " />)}
        {backlinks.length === 0 && <p className="nt-muted">Notes that link here appear automatically.</p>}
      </Section>

      <Section title="Tracker items" count={note.trackerItemIds.length} action={<button type="button" className="nt-btn small" onClick={() => setPicker('item')}><Plus size={13} /> Link</button>}>
        {note.trackerItemIds.map((id) => {
          const item = ctx.itemById(id);
          const tracker = item && ctx.trackerById(item.trackerId);
          return (
            <div className="nt-rel-row" key={id}>
              {item ? (
                <button type="button" className="nt-rel-link" onClick={() => onOpenItem(tracker.id, item.id)}>{tracker.icon} {tracker.name} → {ctx.itemLabel(id)}</button>
              ) : <span className="nt-muted">Missing item</span>}
              <button type="button" className="nt-icon-btn" aria-label="Unlink" onClick={() => unlinkTrackerItem(note.id, id)}><X size={13} /></button>
            </div>
          );
        })}
        {note.trackerItemIds.length === 0 && <p className="nt-muted">Connect this knowledge to anything you track.</p>}
      </Section>

      {activities.length > 0 && (
        <Section title="Planned & done" count={activities.length}>
          {activities.map(({ date, a }) => (
            <div className="nt-rel-row" key={a.id}>
              <span className="nt-rel-static">{a.icon} {a.title}</span>
              <span className="nt-muted">{formatDateDMY(date)}{a.status === 'completed' ? ' ✓' : ''}</span>
            </div>
          ))}
        </Section>
      )}

      {picker === 'note' && (
        <NotePickerModal
          state={state}
          title="Link a note"
          exclude={[note.id, ...explicit.map((n) => n.id)]}
          allowCreate
          onCreate={(title) => { const n = createNote({ title, statusId: state.noteConfig.statuses[0]?.id ?? null }); addRelation(note.id, n.id); }}
          onPick={(n) => addRelation(note.id, n.id)}
          onClose={() => setPicker(null)}
        />
      )}
      {picker === 'item' && (
        <TrackerItemPickerModal state={state} ctx={ctx} exclude={note.trackerItemIds} onPick={(id) => linkTrackerItem(note.id, id)} onClose={() => setPicker(null)} />
      )}
    </div>
  );
}

