import { useMemo, useState } from 'react';
import { Modal } from '../../components/Modal.jsx';
import { Button } from '../../components/buttons/Button.jsx';
import { TextInput } from '../../components/inputs/TextInput.jsx';
import { Select } from '../../components/inputs/Select.jsx';
import { searchNotes, noteTitle } from '../knowledge.js';

/** Choose an existing note (search as you type). */
export function NotePickerModal({ state, title = 'Choose a note', exclude = [], onPick, onClose, allowCreate, onCreate }) {
  const [query, setQuery] = useState('');
  const results = useMemo(
    () => searchNotes(state, { query }).map((r) => r.note).filter((n) => !exclude.includes(n.id)).slice(0, 30),
    [state, query, exclude]
  );
  return (
    <Modal open onClose={onClose} className="nt-modal">
      <h3>{title}</h3>
      <TextInput value={query} onChange={setQuery} placeholder="Search notes…" autoFocus />
      <div className="nt-picker-list">
        {results.map((n) => (
          <button type="button" key={n.id} className="nt-picker-row" onClick={() => { onPick(n); onClose(); }}>
            <span className="nt-picker-icon">{n.icon || '📄'}</span>
            <span>{noteTitle(n)}</span>
          </button>
        ))}
        {results.length === 0 && <p className="nt-muted">No matching notes.</p>}
      </div>
      <div className="app-modal-actions">
        {allowCreate && query.trim() && <Button type="button" variant="secondary" onClick={() => { onCreate(query.trim()); onClose(); }}>Create “{query.trim()}”</Button>}
        <Button type="button" variant="subtle" onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}

/** Choose any item from any tracker. */
export function TrackerItemPickerModal({ state, ctx, exclude = [], onPick, onClose }) {
  const [trackerId, setTrackerId] = useState(state.trackers[0]?.id || '');
  const [query, setQuery] = useState('');
  const items = useMemo(
    () => state.trackerItems
      .filter((i) => i.trackerId === trackerId && !i.archived && !exclude.includes(i.id))
      .map((i) => ({ id: i.id, label: ctx.itemLabel(i.id) }))
      .filter((i) => i.label.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(0, 40),
    [state.trackerItems, trackerId, query, exclude, ctx]
  );
  return (
    <Modal open onClose={onClose} className="nt-modal">
      <h3>Link a tracker item</h3>
      {state.trackers.length === 0 ? <p className="nt-muted">Create a tracker in the Activity tab first.</p> : (
        <>
          <Select value={trackerId} onChange={setTrackerId} options={state.trackers.map((t) => ({ value: t.id, label: `${t.icon} ${t.name}` }))} />
          <div style={{ height: '0.5rem' }} />
          <TextInput value={query} onChange={setQuery} placeholder="Search items…" autoFocus />
          <div className="nt-picker-list">
            {items.map((i) => (
              <button type="button" key={i.id} className="nt-picker-row" onClick={() => { onPick(i.id); onClose(); }}>{i.label}</button>
            ))}
            {items.length === 0 && <p className="nt-muted">No items.</p>}
          </div>
        </>
      )}
      <div className="app-modal-actions"><Button type="button" variant="subtle" onClick={onClose}>Cancel</Button></div>
    </Modal>
  );
}
