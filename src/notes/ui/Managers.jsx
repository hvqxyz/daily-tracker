import { useState } from 'react';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { Modal } from '../../components/Modal.jsx';
import { Button } from '../../components/buttons/Button.jsx';
import { BlockEditor } from './BlockEditor.jsx';
import {
  addCollection, addNoteTemplate, deleteCollection, deleteNoteTemplate, deleteTag, moveCollection, renameTag, setStatuses, updateCollection, updateNoteTemplate,
} from '../notes-store.js';
import { newId } from '../../trackers/engine/ids.js';
import { OPTION_COLORS } from '../../trackers/engine/fieldTypes.js';

function Shell({ title, hint, onClose, children }) {
  return (
    <Modal open onClose={onClose} className="nt-modal wide">
      <h3>{title}</h3>
      {hint && <p className="nt-muted">{hint}</p>}
      {children}
      <div className="app-modal-actions"><Button type="button" variant="primary" onClick={onClose}>Done</Button></div>
    </Modal>
  );
}

const rowInput = 'text-input nt-manage-input';

/** Knowledge statuses are configurable; "needs review" is what the Home screen surfaces. */
export function StatusManager({ state, onClose }) {
  const statuses = state.noteConfig.statuses;
  const patch = (id, p) => setStatuses(statuses.map((s) => (s.id === id ? { ...s, ...p } : s)));
  const move = (i, d) => {
    const list = [...statuses];
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    setStatuses(list);
  };
  return (
    <Shell title="Knowledge statuses" hint="How well do you know it? Rename, reorder or add your own. Tick “review” for statuses that should appear under Need Review." onClose={onClose}>
      <div className="nt-manage-list">
        {statuses.map((s, i) => (
          <div className="nt-manage-row" key={s.id}>
            <input className={`${rowInput} icon`} value={s.icon} maxLength={4} aria-label="Icon" onChange={(e) => patch(s.id, { icon: e.target.value })} />
            <input className={rowInput} value={s.label} aria-label="Name" onChange={(e) => patch(s.id, { label: e.target.value })} />
            <input type="color" className="trk-color" value={s.color || '#898781'} aria-label="Colour" onChange={(e) => patch(s.id, { color: e.target.value })} />
            <label className="nt-check-label"><input type="checkbox" checked={Boolean(s.review)} onChange={(e) => patch(s.id, { review: e.target.checked })} /> review</label>
            <button type="button" className="nt-icon-btn" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={14} /></button>
            <button type="button" className="nt-icon-btn" aria-label="Move down" disabled={i === statuses.length - 1} onClick={() => move(i, 1)}><ArrowDown size={14} /></button>
            <button type="button" className="nt-icon-btn danger" aria-label="Delete status" onClick={() => { if (window.confirm(`Delete “${s.label}”? Notes with it will have no status.`)) setStatuses(statuses.filter((x) => x.id !== s.id)); }}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
      <button type="button" className="nt-btn" onClick={() => setStatuses([...statuses, { id: newId('st'), label: 'New status', icon: '🔵', color: OPTION_COLORS[statuses.length % OPTION_COLORS.length], review: false }])}>+ Add status</button>
    </Shell>
  );
}

export function CollectionManager({ state, onClose }) {
  const list = state.noteCollections;
  const counts = new Map();
  for (const n of state.notes) for (const id of n.collectionIds) counts.set(id, (counts.get(id) || 0) + 1);
  return (
    <Shell title="Collections" hint="Collections group notes broadly. A note can be in several, or none." onClose={onClose}>
      <div className="nt-manage-list">
        {list.map((c, i) => (
          <div className="nt-manage-row" key={c.id}>
            <input className={`${rowInput} icon`} value={c.icon} maxLength={4} aria-label="Icon" onChange={(e) => updateCollection(c.id, { icon: e.target.value })} />
            <input className={rowInput} value={c.name} aria-label="Name" onChange={(e) => updateCollection(c.id, { name: e.target.value })} />
            <span className="nt-muted">{counts.get(c.id) || 0}</span>
            <button type="button" className="nt-icon-btn" aria-label="Move up" disabled={i === 0} onClick={() => moveCollection(c.id, -1)}><ArrowUp size={14} /></button>
            <button type="button" className="nt-icon-btn" aria-label="Move down" disabled={i === list.length - 1} onClick={() => moveCollection(c.id, 1)}><ArrowDown size={14} /></button>
            <button type="button" className="nt-icon-btn danger" aria-label="Delete collection" onClick={() => { if (window.confirm(`Delete the collection “${c.name}”? Its notes are kept.`)) deleteCollection(c.id); }}><Trash2 size={14} /></button>
          </div>
        ))}
        {list.length === 0 && <p className="nt-muted">No collections yet.</p>}
      </div>
      <button type="button" className="nt-btn" onClick={() => addCollection({ name: 'New collection', icon: '📁' })}>+ Add collection</button>
    </Shell>
  );
}

export function TagManager({ state, onClose }) {
  const counts = new Map();
  for (const n of state.notes) for (const id of n.tagIds) counts.set(id, (counts.get(id) || 0) + 1);
  const [names, setNames] = useState({});
  return (
    <Shell title="Tags" hint="Rename a tag to change it everywhere. Renaming onto an existing tag merges them." onClose={onClose}>
      <div className="nt-manage-list">
        {state.noteTags.map((t) => (
          <div className="nt-manage-row" key={t.id}>
            <span className="nt-hash">#</span>
            <input
              className={rowInput}
              value={names[t.id] ?? t.name}
              aria-label="Tag name"
              onChange={(e) => setNames((n) => ({ ...n, [t.id]: e.target.value }))}
              onBlur={() => { if (names[t.id] !== undefined && names[t.id].trim() && names[t.id] !== t.name) renameTag(t.id, names[t.id]); setNames((n) => { const c = { ...n }; delete c[t.id]; return c; }); }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
            />
            <span className="nt-muted">{counts.get(t.id) || 0}</span>
            <button type="button" className="nt-icon-btn danger" aria-label="Delete tag" onClick={() => { if (window.confirm(`Remove #${t.name} from all notes?`)) deleteTag(t.id); }}><Trash2 size={14} /></button>
          </div>
        ))}
        {state.noteTags.length === 0 && <p className="nt-muted">No tags yet — add them from a note.</p>}
      </div>
    </Shell>
  );
}

/** Templates are just saved block lists: edit them with the same editor as notes. */
export function TemplateManager({ state, onClose }) {
  const [editing, setEditing] = useState(null);
  const tpl = state.noteTemplates.find((t) => t.id === editing);

  if (tpl) {
    return (
      <Modal open onClose={onClose} className="nt-modal wide">
        <h3>Edit template</h3>
        <div className="nt-manage-row">
          <input className={`${rowInput} icon`} value={tpl.icon} maxLength={4} aria-label="Icon" onChange={(e) => updateNoteTemplate(tpl.id, { icon: e.target.value })} />
          <input className={rowInput} value={tpl.name} aria-label="Template name" onChange={(e) => updateNoteTemplate(tpl.id, { name: e.target.value })} />
        </div>
        <BlockEditor blocks={tpl.blocks} onChange={(blocks) => updateNoteTemplate(tpl.id, { blocks })} resolveNote={() => null} searchNotes={() => []} />
        <div className="app-modal-actions"><Button type="button" variant="primary" onClick={() => setEditing(null)}>Back to templates</Button></div>
      </Modal>
    );
  }
  return (
    <Shell title="Note templates" hint="Starting structures only — every note made from a template is a normal, fully editable note." onClose={onClose}>
      <div className="nt-manage-list">
        {state.noteTemplates.map((t) => (
          <div className="nt-manage-row" key={t.id}>
            <span className="nt-picker-icon">{t.icon}</span>
            <button type="button" className="nt-rel-link" onClick={() => setEditing(t.id)}>{t.name}</button>
            <span className="nt-muted">{t.blocks.filter((b) => b.type.startsWith('h')).length} sections</span>
            <button type="button" className="nt-icon-btn danger" aria-label="Delete template" onClick={() => { if (window.confirm(`Delete the template “${t.name}”?`)) deleteNoteTemplate(t.id); }}><Trash2 size={14} /></button>
          </div>
        ))}
        {state.noteTemplates.length === 0 && <p className="nt-muted">No templates. You can also save any note as a template from its menu.</p>}
      </div>
      <button type="button" className="nt-btn" onClick={() => setEditing(addNoteTemplate({}).id)}>+ New template</button>
    </Shell>
  );
}
