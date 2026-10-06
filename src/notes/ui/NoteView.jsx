import { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import { ArrowLeft, PanelRight, Star } from 'lucide-react';
import { Menu } from '../../trackers/ui/Menu.jsx';
import { Select } from '../../components/inputs/Select.jsx';
import { IconPicker } from '../../components/inputs/IconPicker.jsx';
import { BlockEditor } from './BlockEditor.jsx';
import { RelatedPanel } from './RelatedPanel.jsx';
import { TagInput } from './TagInput.jsx';
import { HistoryModal } from './HistoryModal.jsx';
import {
  addCollection, createNote, deleteNote, getOrCreateTag, patchNote, planNoteToday, saveNoteAsTemplate, setArchived, toggleFavorite, touchNote, updateNoteContent,
} from '../notes-store.js';
import { noteTitle, wouldCycle } from '../knowledge.js';
import { blocksToMarkdown } from '../markdown.js';
import { todayKey } from '../../common/time.js';

const fmt = (ms) => new Date(ms).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function MetaBar({ note, data, onManage }) {
  const { state } = data;
  const [tagging, setTagging] = useState(false);
  const [details, setDetails] = useState(false);
  const statuses = state.noteConfig.statuses;
  const status = statuses.find((s) => s.id === note.statusId);
  const collections = note.collectionIds.map((id) => state.noteCollections.find((c) => c.id === id)).filter(Boolean);
  const tags = note.tagIds.map((id) => state.noteTags.find((t) => t.id === id)).filter(Boolean);
  const free = state.noteCollections.filter((c) => !note.collectionIds.includes(c.id));

  const parentChoices = state.notes
    .filter((n) => !n.archived && n.id !== note.id && !wouldCycle(state.notes, note.id, n.id))
    .map((n) => ({ value: n.id, label: noteTitle(n) }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="nt-meta">
      <div className="nt-meta-row">
        <Menu
          label="Status"
          align="left"
          className="nt-meta-menu"
          items={[
            ...statuses.map((s) => ({ label: `${s.icon} ${s.label}`, onClick: () => patchNote(note.id, { statusId: s.id }) })),
            { label: 'No status', onClick: () => patchNote(note.id, { statusId: null }) },
            { divider: true },
            { label: '⚙ Manage statuses…', onClick: () => onManage('statuses') },
          ]}
        >
          <span className="nt-status" style={{ '--chip': status?.color || '#898781' }}>{status ? `${status.icon} ${status.label}` : 'No status'}</span>
        </Menu>

        {collections.map((c) => (
          <span className="nt-chip" key={c.id}>
            {c.icon} {c.name}
            <button type="button" className="nt-chip-x" aria-label={`Remove from ${c.name}`} onClick={() => patchNote(note.id, { collectionIds: note.collectionIds.filter((x) => x !== c.id) })}>×</button>
          </span>
        ))}
        <Menu
          label="Add to collection"
          align="left"
          className="nt-meta-menu"
          items={[
            ...free.map((c) => ({ label: `${c.icon} ${c.name}`, onClick: () => patchNote(note.id, { collectionIds: [...note.collectionIds, c.id] }) })),
            free.length ? { divider: true } : null,
            { label: '＋ New collection…', onClick: () => { const name = window.prompt('Collection name'); if (name?.trim()) { const c = addCollection({ name }); patchNote(note.id, { collectionIds: [...note.collectionIds, c.id] }); } } },
          ]}
        >
          <span className="nt-chip ghost">+ Collection</span>
        </Menu>

        {tags.map((t) => (
          <span className="nt-chip tag" key={t.id}>
            #{t.name}
            <button type="button" className="nt-chip-x" aria-label={`Remove #${t.name}`} onClick={() => patchNote(note.id, { tagIds: note.tagIds.filter((x) => x !== t.id) })}>×</button>
          </span>
        ))}
        {tagging ? (
          <TagInput
            tags={state.noteTags}
            chosenIds={note.tagIds}
            onAdd={(name) => { const tag = getOrCreateTag(name); if (tag && !note.tagIds.includes(tag.id)) patchNote(note.id, { tagIds: [...note.tagIds, tag.id] }); }}
            onDone={() => setTagging(false)}
          />
        ) : (
          <button type="button" className="nt-chip ghost" onClick={() => setTagging(true)}>+ Tag</button>
        )}
        <button type="button" className="nt-meta-more" onClick={() => setDetails((d) => !d)} aria-expanded={details}>{details ? 'Less' : 'Details'}</button>
      </div>

      {details && (
        <div className="nt-details">
          <div className="nt-details-dates">
            <span>Created {fmt(note.createdAt)}</span>
            <span>Updated {fmt(note.updatedAt)}</span>
          </div>
          <div className="field-group">
            <label className="field-label">Parent note</label>
            <Select value={note.parentId || ''} onChange={(v) => patchNote(note.id, { parentId: v || null })} options={parentChoices} placeholder="None (top level)" />
          </div>
          <div className="field-group">
            <label className="field-label">Icon</label>
            <IconPicker value={note.icon || '📄'} onChange={(icon) => patchNote(note.id, { icon })} />
            {note.icon && <button type="button" className="nt-link-btn" onClick={() => patchNote(note.id, { icon: '' })}>Remove icon</button>}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * One note: title, subtle metadata, the block editor and (optionally inline) related items.
 * Edits are kept in a local draft and saved shortly after you stop typing.
 */
export const NoteView = forwardRef(function NoteView(
  { note, data, backLabel = 'Knowledge', onBack, onOpenNote, onOpenItem, sidePanel, onToggleSide, canSide, onManage, onNewChild, onCreateActivity, notify, autoFocusTitle },
  ref
) {
  const { state, resolveNote, searchForEditor, index } = data;
  const [draft, setDraft] = useState({ title: note.title, blocks: note.blocks });
  const draftRef = useRef(draft);
  const timer = useRef(null);
  const editor = useRef(null);
  const titleRef = useRef(null);
  const [history, setHistory] = useState(false);

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    updateNoteContent(note.id, draftRef.current);
  }, [note.id]);

  const change = (patch) => {
    draftRef.current = { ...draftRef.current, ...patch };
    setDraft(draftRef.current);
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 500);
  };

  useImperativeHandle(ref, () => ({ flush }), [flush]);

  useEffect(() => {
    const onHide = () => flush();
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onHide);
      flush();
    };
  }, [flush]);

  useEffect(() => { touchNote(note.id); }, [note.id]);

  useEffect(() => {
    if (autoFocusTitle) titleRef.current?.focus();
  }, [autoFocusTitle]);

  useEffect(() => {
    const el = titleRef.current;
    if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; }
  }, [draft.title]);

  const ancestors = index.ancestors(note);
  const copyMarkdown = async () => {
    const md = `# ${draftRef.current.title || 'Untitled note'}\n\n${blocksToMarkdown(draftRef.current.blocks, resolveNote)}`;
    try { await navigator.clipboard.writeText(md); notify('Copied as Markdown'); } catch { notify('Could not copy'); }
  };
  const openParent = (id) => { flush(); onOpenNote(id); };

  return (
    <article className="nt-note">
      <div className="nt-note-bar">
        <button type="button" className="nt-back" onClick={() => { flush(); onBack(); }}><ArrowLeft size={16} /> {backLabel}</button>
        <div className="nt-note-actions">
          <button type="button" className={`nt-icon-btn big${note.favorite ? ' on' : ''}`} aria-label={note.favorite ? 'Remove from favorites' : 'Add to favorites'} onClick={() => toggleFavorite(note.id)}>
            <Star size={17} fill={note.favorite ? 'currentColor' : 'none'} />
          </button>
          {canSide && <button type="button" className={`nt-icon-btn big${sidePanel ? ' on' : ''}`} aria-label="Toggle related panel" onClick={onToggleSide}><PanelRight size={17} /></button>}
          <Menu
            label="Note actions"
            items={[
              { label: "Add to today's plan", icon: '📅', onClick: () => { flush(); planNoteToday(state.notes.find((n) => n.id === note.id) || note, todayKey()); notify("Added to today's plan"); } },
              { label: 'Create activity…', icon: '⏱', onClick: () => { flush(); onCreateActivity(note); } },
              { label: 'New sub-note', icon: '↳', onClick: () => { flush(); onNewChild(); } },
              { divider: true },
              { label: 'Version history…', icon: '🕘', onClick: () => { flush(); setHistory(true); } },
              { label: 'Copy as Markdown', icon: '⧉', onClick: copyMarkdown },
              { label: 'Save as template', icon: '🧩', onClick: () => { flush(); saveNoteAsTemplate(note.id); notify('Saved as a note template'); } },
              { label: 'Duplicate', icon: '⎘', onClick: () => { flush(); const n = createNote({ title: `${draftRef.current.title} (copy)`, blocks: draftRef.current.blocks.map((b) => ({ ...b, id: `${b.id}_c${Math.random().toString(36).slice(2, 5)}` })), collectionIds: note.collectionIds, tagIds: note.tagIds, statusId: note.statusId, parentId: note.parentId }); onOpenNote(n.id); } },
              { divider: true },
              note.archived
                ? { label: 'Restore from archive', icon: '↩', onClick: () => setArchived(note.id, false) }
                : { label: 'Archive', icon: '🗄', onClick: () => { flush(); setArchived(note.id, true); onBack(); notify('Archived'); } },
              note.archived && { label: 'Delete permanently', icon: '🗑', danger: true, onClick: () => { if (window.confirm('Delete this note permanently?')) { deleteNote(note.id); onBack(); } } },
            ]}
          />
        </div>
      </div>

      {ancestors.length > 0 && (
        <nav className="nt-crumbs" aria-label="Parent notes">
          {ancestors.map((a, i) => (
            <span key={a.id}>
              <button type="button" className="nt-crumb" onClick={() => openParent(a.id)}>{a.icon} {noteTitle(a)}</button>
              {i < ancestors.length - 1 && <span className="nt-sep"> › </span>}
            </span>
          ))}
        </nav>
      )}
      {note.archived && <div className="nt-archived-banner">Archived — <button type="button" className="nt-link-btn" onClick={() => setArchived(note.id, false)}>restore</button></div>}

      <div className="nt-doc">
        <div className="nt-title-row">
          {note.icon && <span className="nt-title-icon">{note.icon}</span>}
          <textarea
            ref={titleRef}
            className="nt-title"
            rows={1}
            placeholder="Untitled note"
            value={draft.title}
            onChange={(e) => change({ title: e.target.value.replace(/\n/g, ' ') })}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); editor.current?.focusStart(); } }}
          />
        </div>

        <MetaBar note={note} data={data} onManage={onManage} />

        <BlockEditor
          ref={editor}
          blocks={draft.blocks}
          onChange={(blocks) => change({ blocks })}
          resolveNote={resolveNote}
          onOpenNote={(id) => { flush(); onOpenNote(id); }}
          searchNotes={searchForEditor}
          onCreateNote={(title) => createNote({ title, statusId: state.noteConfig.statuses[0]?.id ?? null })}
        />

        {!sidePanel && (
          <div className="nt-inline-related">
            <RelatedPanel note={note} data={data} onOpen={(id) => { flush(); onOpenNote(id); }} onOpenItem={onOpenItem} onNewChild={() => { flush(); onNewChild(); }} />
          </div>
        )}
      </div>

      {history && <HistoryModal note={note} resolveNote={resolveNote} onClose={() => setHistory(false)} />}
    </article>
  );
});
