import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Menu as MenuIcon, PanelLeft, Plus, Search, X } from 'lucide-react';
import { Menu } from '../trackers/ui/Menu.jsx';
import { Sidebar } from '../notes/ui/Sidebar.jsx';
import { Home } from '../notes/ui/Home.jsx';
import { NoteList } from '../notes/ui/NoteList.jsx';
import { SearchView } from '../notes/ui/SearchView.jsx';
import { NoteView } from '../notes/ui/NoteView.jsx';
import { RelatedPanel } from '../notes/ui/RelatedPanel.jsx';
import { CollectionManager, StatusManager, TagManager, TemplateManager } from '../notes/ui/Managers.jsx';
import { CreateActivityModal } from '../trackers/ui/ActivityModals.jsx';
import { useNotesData } from '../notes/ui/useNotesData.js';
import { useMedia } from '../notes/ui/useMedia.js';
import { activeNotes, recentNotes } from '../notes/knowledge.js';
import { addCollection, addSampleNotes, createNote, createNoteFromTemplate, discardIfBlank } from '../notes/notes-store.js';
import { requestNav, useNavRequests } from '../common/nav.js';
import '../notes/ui/notes.css';

const SIDEBAR_KEY = 'daily-planner-notes-sidebar';
const RELATED_KEY = 'daily-planner-notes-related';
const EMPTY_SEARCH = { query: '', collectionId: '', statusId: '', tagId: '' };

function loadFlag(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}
function saveFlag(key, value) {
  try { localStorage.setItem(key, value ? '1' : '0'); } catch { /* not persisted */ }
}

function listFor(view, state) {
  const notes = activeNotes(state.notes);
  const coll = (id) => state.noteCollections.find((c) => c.id === id);
  switch (view.filter) {
    case 'favorites': return { title: '⭐ Favorites', notes: notes.filter((n) => n.favorite), allowTree: false };
    case 'recent': return { title: '🕐 Recent', notes: recentNotes(state.notes, 50), allowTree: false, defaultSort: 'updated' };
    case 'all': return { title: '📝 All notes', notes };
    case 'uncategorized': return { title: 'No collection', notes: notes.filter((n) => n.collectionIds.length === 0) };
    case 'collection': return { title: `${coll(view.id)?.icon || '📁'} ${coll(view.id)?.name || 'Collection'}`, notes: notes.filter((n) => n.collectionIds.includes(view.id)) };
    case 'tag': return { title: `#${state.noteTags.find((t) => t.id === view.id)?.name || 'tag'}`, notes: notes.filter((n) => n.tagIds.includes(view.id)) };
    case 'archived': return { title: '🗄 Archived notes', notes: state.notes.filter((n) => n.archived), archived: true, allowTree: false, emptyText: 'Nothing archived.' };
    default: return { title: 'Notes', notes };
  }
}

/** The Knowledge workspace: independent notes, organised by collections and tags, connected to trackers and the planner. */
export function NotesPage() {
  const data = useNotesData();
  const { state, ctx, index } = data;
  const [view, setView] = useState({ kind: 'home' });
  const [stack, setStack] = useState([]);
  const [search, setSearch] = useState(EMPTY_SEARCH);
  const [drawer, setDrawer] = useState(false);
  const [sideOpen, setSideOpen] = useState(() => loadFlag(SIDEBAR_KEY, true));
  const [relatedOpen, setRelatedOpen] = useState(() => loadFlag(RELATED_KEY, true));
  const [manage, setManage] = useState(null);
  const [activityFor, setActivityFor] = useState(null);
  const [toast, setToast] = useState('');
  const noteRef = useRef(null);
  const created = useRef(new Set());
  const viewRef = useRef(view);
  viewRef.current = view;

  const mobile = useMedia('(max-width: 759px)');
  const wide = useMedia('(min-width: 1080px)');
  const searching = Boolean(search.query.trim() || search.collectionId || search.statusId || search.tagId);
  const note = view.kind === 'note' ? index.byId.get(view.id) : null;

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  // Leaving the app tab: save the open note and drop it if it was created empty.
  useEffect(() => () => {
    noteRef.current?.flush?.();
    const v = viewRef.current;
    if (v.kind === 'note' && created.current.has(v.id)) discardIfBlank(v.id);
  }, []);

  function leaveCurrent() {
    noteRef.current?.flush?.();
    if (view.kind === 'note' && created.current.has(view.id)) discardIfBlank(view.id);
  }

  function go(next) {
    leaveCurrent();
    setStack((s) => [...s.slice(-19), view]);
    setSearch(EMPTY_SEARCH);
    setView(next);
    setDrawer(false);
  }

  function select(next) {
    if (next.kind === 'search') {
      leaveCurrent();
      setSearch({ ...EMPTY_SEARCH, statusId: next.statusId || '', collectionId: next.collectionId || '', tagId: next.tagId || '' });
      return;
    }
    go(next);
  }

  function back() {
    leaveCurrent();
    const prev = stack[stack.length - 1] || { kind: 'home' };
    setStack((s) => s.slice(0, -1));
    setSearch(EMPTY_SEARCH);
    setView(prev.kind === 'note' && !index.byId.has(prev.id) ? { kind: 'home' } : prev);
  }

  const openNote = (id) => go({ kind: 'note', id });

  function createNew({ parentId = null, templateId = null } = {}) {
    const fields = { parentId };
    if (view.kind === 'list' && view.filter === 'collection' && !parentId) fields.collectionIds = [view.id];
    if (view.kind === 'list' && view.filter === 'tag' && !parentId) fields.tagIds = [view.id];
    const n = templateId ? createNoteFromTemplate(templateId, fields) : createNote({ ...fields, statusId: state.noteConfig.statuses[0]?.id ?? null });
    created.current.add(n.id);
    go({ kind: 'note', id: n.id, fresh: true });
  }

  useNavRequests('notes', (t) => { if (t.noteId) go({ kind: 'note', id: t.noteId }); });

  const showSide = mobile ? drawer : sideOpen;
  const sidePanel = wide && relatedOpen && Boolean(note) && !searching;
  const previous = stack[stack.length - 1];
  const backTarget = previous?.kind === 'note' ? index.byId.get(previous.id) : null;

  const persistSide = (v) => { setSideOpen(v); saveFlag(SIDEBAR_KEY, v); };
  const persistRelated = (v) => { setRelatedOpen(v); saveFlag(RELATED_KEY, v); };

  function renderMain() {
    if (searching) {
      return <SearchView state={state} ctx={ctx} search={search} onChange={setSearch} onOpen={openNote} />;
    }
    if (view.kind === 'note' && note) {
      return (
        <NoteView
          key={`${note.id}:${note.rev}`}
          ref={noteRef}
          note={note}
          data={data}
          backLabel={backTarget ? 'Back' : 'Knowledge'}
          autoFocusTitle={Boolean(view.fresh)}
          onBack={back}
          onOpenNote={openNote}
          onOpenItem={(trackerId, itemId) => requestNav({ page: 'activity', trackerId, itemId })}
          sidePanel={sidePanel}
          canSide={wide}
          onToggleSide={() => persistRelated(!relatedOpen)}
          onManage={setManage}
          onNewChild={() => createNew({ parentId: note.id })}
          onCreateActivity={setActivityFor}
          notify={setToast}
        />
      );
    }
    if (view.kind === 'list') return <NoteList key={`${view.filter}:${view.id || ''}`} state={state} onOpen={openNote} {...listFor(view, state)} />;
    return (
      <Home
        state={state}
        onOpen={openNote}
        onNew={createNew}
        onSelect={select}
        onTemplates={() => setManage('templates')}
        onLoadSamples={addSampleNotes}
      />
    );
  }

  return (
    <div className={`nt-shell${showSide && !mobile ? ' side-open' : ''}${sidePanel ? ' with-related' : ''}`}>
      <div className="nt-topbar">
        <button type="button" className="nt-icon-btn big" aria-label={mobile ? 'Open navigation' : sideOpen ? 'Collapse sidebar' : 'Expand sidebar'} onClick={() => (mobile ? setDrawer(true) : persistSide(!sideOpen))}>
          {mobile ? <MenuIcon size={18} /> : <PanelLeft size={18} />}
        </button>
        <div className="nt-search">
          <Search size={15} />
          <input
            type="search"
            value={search.query}
            onChange={(e) => { if (view.kind === 'note') noteRef.current?.flush?.(); setSearch((s) => ({ ...s, query: e.target.value })); }}
            placeholder="Search notes, tags, collections…"
            aria-label="Search notes"
          />
          {searching && <button type="button" className="nt-icon-btn" aria-label="Clear search" onClick={() => setSearch(EMPTY_SEARCH)}><X size={14} /></button>}
        </div>
        <div className="nt-newgroup">
          <button type="button" className="nt-new" onClick={() => createNew()}><Plus size={16} /> <span>New note</span></button>
          <Menu
            label="New note from template"
            className="nt-new-menu"
            items={[
              ...state.noteTemplates.map((t) => ({ label: `${t.icon} ${t.name}`, onClick: () => createNew({ templateId: t.id }) })),
              state.noteTemplates.length ? { divider: true } : null,
              { label: '🧩 Manage templates…', onClick: () => setManage('templates') },
            ]}
          >
            <ChevronDown size={16} />
          </Menu>
        </div>
      </div>

      <div className="nt-body">
        {mobile && drawer && <div className="nt-scrim" onClick={() => setDrawer(false)} />}
        {showSide && (
          <aside className={`nt-sidebar${mobile ? ' drawer' : ''}`}>
            {mobile && <button type="button" className="nt-icon-btn nt-drawer-close" aria-label="Close navigation" onClick={() => setDrawer(false)}><X size={18} /></button>}
            <Sidebar
              state={state}
              view={searching ? { kind: 'none' } : view}
              onSelect={select}
              onManage={(m) => { setDrawer(false); setManage(m); }}
              onAddCollection={() => { const name = window.prompt('Collection name'); if (name?.trim()) addCollection({ name }); }}
            />
          </aside>
        )}
        <div className="nt-main">{renderMain()}</div>
        {sidePanel && note && (
          <aside className="nt-right">
            <RelatedPanel
              note={note}
              data={data}
              onOpen={openNote}
              onOpenItem={(trackerId, itemId) => requestNav({ page: 'activity', trackerId, itemId })}
              onNewChild={() => createNew({ parentId: note.id })}
            />
          </aside>
        )}
      </div>

      {manage === 'statuses' && <StatusManager state={state} onClose={() => setManage(null)} />}
      {manage === 'collections' && <CollectionManager state={state} onClose={() => setManage(null)} />}
      {manage === 'tags' && <TagManager state={state} onClose={() => setManage(null)} />}
      {manage === 'templates' && <TemplateManager state={state} onClose={() => setManage(null)} />}
      {activityFor && <CreateActivityModal state={state} note={activityFor} onClose={() => setActivityFor(null)} onCreated={() => setToast('Activity added to the plan')} />}
      {toast && <div className="trk-toast" role="status">{toast}</div>}
    </div>
  );
}
