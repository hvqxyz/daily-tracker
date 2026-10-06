import { useMemo, useRef, useState } from 'react';
import { Modal } from '../../components/Modal.jsx';
import { Button } from '../../components/buttons/Button.jsx';
import { TextInput } from '../../components/inputs/TextInput.jsx';
import { Select } from '../../components/inputs/Select.jsx';
import { TagInput } from './TagInput.jsx';
import { createNoteFromText, getOrCreateTag } from '../notes-store.js';

/** Global quick capture — usable from any tab. Content is plain text / markdown. */
export function QuickNoteModal({ state, initial = {}, onClose, onSaved }) {
  const [title, setTitle] = useState(initial.title || '');
  const [text, setText] = useState(initial.text || '');
  const [collectionId, setCollectionId] = useState(initial.collectionId || '');
  const [tagNames, setTagNames] = useState([]);
  const [tagging, setTagging] = useState(false);
  const contentRef = useRef(null);
  const canSave = title.trim() || text.trim();
  const tagObjs = useMemo(() => tagNames.map((n) => state.noteTags.find((t) => t.name.toLowerCase() === n.toLowerCase()) || { id: n, name: n }), [tagNames, state.noteTags]);

  function save(e) {
    e?.preventDefault();
    if (!canSave) return;
    const tagIds = tagNames.map((n) => getOrCreateTag(n)?.id).filter(Boolean);
    const note = createNoteFromText({
      title,
      text,
      collectionIds: collectionId ? [collectionId] : [],
      tagIds,
      statusId: state.noteConfig.statuses[0]?.id ?? null,
      ...(initial.extra || {}),
    });
    onSaved?.(note);
    onClose();
  }

  return (
    <Modal open onClose={onClose} className="nt-modal">
      <h3>Quick note</h3>
      <form onSubmit={save} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save(e); }}>
        <div className="field-group">
          <label className="field-label" htmlFor="qn-title">Title</label>
          <TextInput id="qn-title" value={title} onChange={setTitle} placeholder="Static Kafka Consumer" autoFocus />
        </div>
        <div className="field-group">
          <label className="field-label" htmlFor="qn-text">Content</label>
          <textarea id="qn-text" ref={contentRef} className="field-input nt-quick-text" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={'A static consumer keeps the same identity across restarts using group.instance.id.\n\nMarkdown works: # heading, - list, ```code```'} />
        </div>
        <div className="field-row">
          <div className="field-group">
            <label className="field-label">Collection</label>
            <Select value={collectionId} onChange={setCollectionId} options={state.noteCollections.map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` }))} placeholder="None" />
          </div>
        </div>
        <div className="field-group">
          <label className="field-label">Tags</label>
          <div className="nt-meta-row">
            {tagObjs.map((t) => (
              <span className="nt-chip tag" key={t.id}>#{t.name}<button type="button" className="nt-chip-x" aria-label="Remove" onClick={() => setTagNames((n) => n.filter((x) => x.toLowerCase() !== t.name.toLowerCase()))}>×</button></span>
            ))}
            {tagging ? (
              <TagInput tags={state.noteTags} chosenIds={tagObjs.map((t) => t.id)} onAdd={(name) => setTagNames((n) => (n.some((x) => x.toLowerCase() === name.toLowerCase()) ? n : [...n, name]))} onDone={() => setTagging(false)} />
            ) : (
              <button type="button" className="nt-chip ghost" onClick={() => setTagging(true)}>+ Tag</button>
            )}
          </div>
        </div>
        <div className="app-modal-actions">
          <Button type="button" variant="subtle" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!canSave}>Save note</Button>
        </div>
        <p className="nt-muted nt-hint-line">Ctrl/⌘ + Enter saves.</p>
      </form>
    </Modal>
  );
}
