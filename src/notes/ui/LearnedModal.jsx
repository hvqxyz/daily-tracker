import { useState } from 'react';
import { Modal } from '../../components/Modal.jsx';
import { Button } from '../../components/buttons/Button.jsx';
import { Select } from '../../components/inputs/Select.jsx';
import { appendLearning, createNote, linkTrackerItem } from '../notes-store.js';
import { parseMarkdown } from '../markdown.js';
import { noteTitle } from '../knowledge.js';

/**
 * Shown after completing an activity that is linked to knowledge: capture what
 * was learned and it is appended to the linked note (or becomes a new one).
 * `notes` = candidate notes; `item` = optional tracker item the activity was linked to.
 */
export function LearnedModal({ state, ctx, activity, notes, item, onClose }) {
  const [text, setText] = useState('');
  const [target, setTarget] = useState(notes[0]?.id || '__new');

  function save() {
    if (!text.trim()) { onClose(); return; }
    if (target === '__new') {
      const title = activity.title || (item ? ctx.itemLabel(item.id) : 'Learning note');
      const note = createNote({ title, statusId: state.noteConfig.statuses[0]?.id ?? null, blocks: parseMarkdown(text) });
      if (item) linkTrackerItem(note.id, item.id);
    } else {
      appendLearning(target, text);
    }
    onClose(true);
  }

  return (
    <Modal open onClose={() => onClose(false)} className="nt-modal">
      <h3>✓ Completed — what did you learn?</h3>
      <p className="nt-muted">{activity.icon} {activity.title}</p>
      <div className="field-group">
        <textarea className="field-input nt-quick-text" rows={5} autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Write it in your own words… (markdown works)" />
      </div>
      <div className="field-group">
        <label className="field-label">Save to</label>
        <Select
          value={target}
          onChange={setTarget}
          options={[
            ...notes.map((n) => ({ value: n.id, label: `Append to “${noteTitle(n)}”` })),
            { value: '__new', label: 'A new note' },
          ]}
        />
      </div>
      <div className="app-modal-actions">
        <Button type="button" variant="subtle" onClick={() => onClose(false)}>Skip</Button>
        <Button type="button" variant="primary" onClick={save}>Save</Button>
      </div>
    </Modal>
  );
}
