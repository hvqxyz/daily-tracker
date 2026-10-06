import { useEffect, useMemo, useState } from 'react';
import { Filter, Group, Plus, Search, Settings, SortAsc, Columns3 } from 'lucide-react';
import { Button } from '../../components/buttons/Button.jsx';
import { Modal } from '../../components/Modal.jsx';
import { Select } from '../../components/inputs/Select.jsx';
import { SegmentedControl } from '../../components/inputs/SegmentedControl.jsx';
import { Menu } from './Menu.jsx';
import { ItemEditor } from './ItemEditor.jsx';
import { ItemPreview } from './ItemPreview.jsx';
import { ViewEditor } from './ViewEditor.jsx';
import { Dashboard } from './Dashboard.jsx';
import { CreateActivityModal, addItemToToday } from './ActivityModals.jsx';
import { ColumnsPanel, FilterPanel, GroupPanel, SortPanel } from './ViewPanels.jsx';
import { TableView } from './views/TableView.jsx';
import { ListView } from './views/ListView.jsx';
import { BoardView } from './views/BoardView.jsx';
import { HierarchyView } from './views/HierarchyView.jsx';
import { CalendarView } from './views/CalendarView.jsx';
import { TimelineView } from './views/TimelineView.jsx';
import { NotePickerModal } from '../../notes/ui/pickers.jsx';
import { createNote, linkTrackerItem } from '../../notes/notes-store.js';
import { requestNav } from '../../common/nav.js';
import { runView } from '../engine/query.js';
import { itemLabel } from '../engine/data.js';
import { VIEW_TYPES } from '../engine/schema.js';
import { addView, deleteItem, deleteView, duplicateItem, duplicateView, moveItemToTracker, setItemArchived, updateTracker, updateView } from '../tracker-store.js';

const VIEW_COMPONENTS = { table: TableView, list: ListView, board: BoardView, hierarchy: HierarchyView, calendar: CalendarView, timeline: TimelineView };
const HAS_COLUMNS = ['table', 'list', 'board', 'hierarchy'];
const HAS_GROUP = ['table', 'list'];

function MoveItemModal({ item, tracker, trackers, ctx, onClose }) {
  const others = trackers.filter((t) => t.id !== tracker.id);
  const [target, setTarget] = useState(others[0]?.id || '');
  return (
    <Modal open onClose={onClose} className="trk-modal">
      <h3>Move "{ctx.itemLabel(item.id)}"</h3>
      <p className="trk-hint">Values are kept for fields with the same name and type. Other values are dropped.</p>
      {others.length ? (
        <Select value={target} onChange={setTarget} options={others.map((t) => ({ value: t.id, label: `${t.icon} ${t.name}` }))} />
      ) : (
        <p className="trk-hint">Create another tracker to move items to.</p>
      )}
      <div className="app-modal-actions">
        <Button type="button" variant="subtle" onClick={onClose}>Cancel</Button>
        <Button type="button" variant="primary" disabled={!target} onClick={() => { moveItemToTracker(item.id, target); onClose(); }}>Move</Button>
      </div>
    </Modal>
  );
}

export function TrackerScreen({ tracker, state, ctx, onOpenSettings, openItemId, onItemOpened }) {
  const [mode, setMode] = useState('items'); // items | dashboard | archive
  const [viewId, setViewId] = useState(tracker.settings.defaultViewId);
  const [search, setSearch] = useState('');
  const [panel, setPanel] = useState(null);
  const [editor, setEditor] = useState(null); // { item, initialValues, parentId, key }
  const [viewEditor, setViewEditor] = useState(null); // { view } | { view: null }
  const [activityFor, setActivityFor] = useState(null);
  const [moveFor, setMoveFor] = useState(null);
  const [notePicker, setNotePicker] = useState(null); // item being linked to a note
  const [previewId, setPreviewId] = useState(null); // item shown in the compact preview
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!openItemId) return;
    const item = state.trackerItems.find((i) => i.id === openItemId && i.trackerId === tracker.id);
    if (item) setPreviewId(item.id);
    onItemOpened?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openItemId]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const view = tracker.views.find((v) => v.id === viewId) || tracker.views.find((v) => v.id === tracker.settings.defaultViewId) || tracker.views[0];
  const { rows, groups } = useMemo(
    () => runView({ tracker, items: state.trackerItems, view, search, ctx, archived: mode === 'archive' }),
    [tracker, state.trackerItems, view, search, ctx, mode]
  );
  const archivedCount = useMemo(() => state.trackerItems.filter((i) => i.trackerId === tracker.id && i.archived).length, [state.trackerItems, tracker.id]);

  const cfg = view.config || {};
  const patchView = (p) => updateView(tracker.id, view.id, { config: p });
  const filterCount = (cfg.filters || []).length;

  function openAdd(values = {}, parentId = null) {
    // Items created inside a filtered view start with the values that filter asks for.
    const seeded = { ...values };
    for (const f of cfg.filters || []) {
      const field = tracker.fields.find((x) => x.id === f.fieldId);
      if (!field || seeded[f.fieldId] !== undefined || !f.value) continue;
      if (f.op === 'is' && field.type === 'select') seeded[f.fieldId] = field.config.multiple ? [f.value] : f.value;
      if (f.op === 'is' && field.type === 'multiselect') seeded[f.fieldId] = [f.value];
    }
    setEditor({ item: null, initialValues: seeded, parentId, key: `new-${Date.now()}` });
  }

  const openItem = (item) => setPreviewId(item.id);
  const editItem = (item) => { setPreviewId(null); setEditor({ item, key: item.id }); };
  const previewItem = previewId ? state.trackerItems.find((i) => i.id === previewId) : null;

  const itemMenu = (item) => (
    <Menu
      items={
        mode === 'archive'
          ? [
              { label: 'Restore', icon: '↩', onClick: () => setItemArchived(item.id, false) },
              { label: 'Delete permanently', icon: '🗑', danger: true, onClick: () => { if (window.confirm(`Permanently delete "${itemLabel(tracker, item, ctx)}"?`)) deleteItem(item.id); } },
            ]
          : [
              { label: 'Edit', icon: '✎', onClick: () => editItem(item) },
              { label: "Add to today's plan", icon: '📅', onClick: () => { addItemToToday(state, item); setToast("Added to today's plan"); } },
              { label: 'Create activity…', icon: '⏱', onClick: () => setActivityFor(item) },
              { divider: true },
              { label: 'Duplicate', icon: '⧉', onClick: () => duplicateItem(item.id) },
              { label: 'Move to tracker…', icon: '➜', onClick: () => setMoveFor(item) },
              { label: 'Archive', icon: '🗄', onClick: () => setItemArchived(item.id, true) },
            ]
      }
    />
  );

  const ViewComponent = VIEW_COMPONENTS[view.type] || TableView;
  const viewProps = {
    tracker, view, rows, groups, ctx, onOpen: openItem, itemMenu, onUpdateView: patchView, onAdd: openAdd,
    onEditField: (fieldId) => onOpenSettings(fieldId),
  };

  const togglePanel = (name) => setPanel((p) => (p === name ? null : name));

  return (
    <div className="trk-screen">
      <div className="trk-screen-head">
        <div className="trk-screen-title">
          <span className="trk-screen-icon">{tracker.icon}</span>
          <div>
            <h2>{tracker.name}</h2>
            {tracker.description && <span className="trk-hint">{tracker.description}</span>}
          </div>
        </div>
        <button type="button" className="trk-icon-btn big" aria-label="Tracker settings" onClick={() => onOpenSettings(null)}><Settings size={18} /></button>
      </div>

      <SegmentedControl
        value={mode}
        onChange={(m) => { setMode(m); setPanel(null); }}
        options={[{ value: 'items', label: 'Items' }, { value: 'dashboard', label: 'Dashboard' }, { value: 'archive', label: `Archive${archivedCount ? ` (${archivedCount})` : ''}` }]}
      />

      {mode === 'dashboard' && (
        <Dashboard tracker={tracker} items={state.trackerItems} ctx={ctx} onOpenItem={(id) => { const it = ctx.itemById(id); if (it) openItem(it); }} />
      )}

      {mode !== 'dashboard' && (
        <>
          {mode === 'items' && (
            <div className="trk-view-tabs">
              {tracker.views.map((v) => (
                <button type="button" key={v.id} className={`trk-view-tab${v.id === view.id ? ' active' : ''}`} onClick={() => { setViewId(v.id); setPanel(null); }}>
                  <span>{VIEW_TYPES.find((t) => t.value === v.type)?.icon}</span> {v.name}
                </button>
              ))}
              <button type="button" className="trk-view-tab add" aria-label="New view" onClick={() => setViewEditor({ view: null })}><Plus size={14} /></button>
              <Menu
                label="View options"
                items={[
                  { label: 'Edit view…', icon: '✎', onClick: () => setViewEditor({ view }) },
                  { label: 'Duplicate view', icon: '⧉', onClick: () => { const c = duplicateView(tracker.id, view.id); if (c) setViewId(c.id); } },
                  { label: 'Make default', icon: '★', disabled: tracker.settings.defaultViewId === view.id, onClick: () => updateTracker(tracker.id, (t) => ({ ...t, settings: { ...t.settings, defaultViewId: view.id } })) },
                  { divider: true },
                  { label: 'Delete view', icon: '🗑', danger: true, disabled: tracker.views.length <= 1, onClick: () => { if (window.confirm(`Delete the view "${view.name}"?`)) { deleteView(tracker.id, view.id); setViewId(null); } } },
                ]}
              />
            </div>
          )}

          <div className="trk-toolbar">
            <div className="trk-search">
              <Search size={15} />
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" aria-label="Search items" />
            </div>
            {mode === 'items' && (
              <Button size="small" onClick={() => openAdd()}><Plus size={15} /> Add</Button>
            )}
          </div>

          {mode === 'items' && (
            <div className="trk-tools">
              <button type="button" className={`trk-tool${panel === 'filter' ? ' on' : ''}${filterCount ? ' active' : ''}`} onClick={() => togglePanel('filter')}><Filter size={14} /> Filter{filterCount ? ` (${filterCount})` : ''}</button>
              <button type="button" className={`trk-tool${panel === 'sort' ? ' on' : ''}${(cfg.sorts || []).length ? ' active' : ''}`} onClick={() => togglePanel('sort')}><SortAsc size={14} /> Sort</button>
              {HAS_GROUP.includes(view.type) && <button type="button" className={`trk-tool${panel === 'group' ? ' on' : ''}${cfg.groupBy ? ' active' : ''}`} onClick={() => togglePanel('group')}><Group size={14} /> Group</button>}
              {HAS_COLUMNS.includes(view.type) && <button type="button" className={`trk-tool${panel === 'columns' ? ' on' : ''}`} onClick={() => togglePanel('columns')}><Columns3 size={14} /> Columns</button>}
              <button type="button" className="trk-tool" onClick={() => setViewEditor({ view })}>⚙ View</button>
            </div>
          )}

          {panel === 'filter' && <FilterPanel tracker={tracker} filters={cfg.filters || []} onChange={(filters) => patchView({ filters })} ctx={ctx} />}
          {panel === 'sort' && <SortPanel tracker={tracker} sorts={cfg.sorts || []} onChange={(sorts) => patchView({ sorts })} />}
          {panel === 'group' && <GroupPanel tracker={tracker} groupBy={cfg.groupBy} onChange={(groupBy) => patchView({ groupBy })} />}
          {panel === 'columns' && <ColumnsPanel tracker={tracker} view={view} onChange={(columns) => patchView({ columns })} />}

          {mode === 'archive' ? (
            rows.length === 0 ? <div className="empty-state">Nothing archived.</div> : (
              <ListView {...viewProps} view={{ ...view, config: { ...view.config, columns: view.config.columns } }} groups={[{ key: '__all', label: null, items: rows }]} />
            )
          ) : (
            state.trackerItems.every((i) => i.trackerId !== tracker.id || i.archived) && view.type !== 'calendar' && view.type !== 'timeline'
              ? <div className="empty-state">No items yet — tap Add to create the first one.</div>
              : <ViewComponent {...viewProps} />
          )}
        </>
      )}

      {previewItem && (
        <ItemPreview
          key={previewItem.id}
          tracker={tracker}
          item={previewItem}
          ctx={ctx}
          notes={state.notes.filter((n) => !n.archived && n.trackerItemIds.includes(previewItem.id))}
          onClose={() => setPreviewId(null)}
          onEdit={() => editItem(previewItem)}
          onAddToday={() => { addItemToToday(state, previewItem); setToast("Added to today's plan"); setPreviewId(null); }}
          onCreateActivity={() => { setActivityFor(previewItem); setPreviewId(null); }}
          onArchive={() => { setItemArchived(previewItem.id, true); setPreviewId(null); }}
          onRestore={() => { setItemArchived(previewItem.id, false); setPreviewId(null); }}
          onDelete={() => { if (window.confirm(`Permanently delete "${itemLabel(tracker, previewItem, ctx)}"?`)) { deleteItem(previewItem.id); setPreviewId(null); } }}
          onOpenNote={(id) => { setPreviewId(null); requestNav({ page: 'notes', noteId: id }); }}
          onNewNote={() => { const n = createNote({ title: ctx.itemLabel(previewItem.id), statusId: state.noteConfig.statuses[0]?.id ?? null, trackerItemIds: [previewItem.id] }); setPreviewId(null); requestNav({ page: 'notes', noteId: n.id }); }}
          onLinkNote={() => { setNotePicker(previewItem); setPreviewId(null); }}
        />
      )}

      {editor && (
        <ItemEditor
          key={editor.key}
          tracker={tracker}
          item={editor.item}
          initialValues={editor.initialValues}
          parentId={editor.parentId}
          ctx={ctx}
          allItems={state.trackerItems}
          onClose={() => setEditor(null)}
          extraActions={editor.item && (
            <div className="trk-row-actions">
              <Button type="button" variant="subtle" size="small" onClick={() => { addItemToToday(state, editor.item); setToast("Added to today's plan"); setEditor(null); }}>📅 Add to today</Button>
              <Button type="button" variant="subtle" size="small" onClick={() => { setActivityFor(editor.item); setEditor(null); }}>⏱ Create activity</Button>
              <Button type="button" variant="subtle" size="small" onClick={() => { setItemArchived(editor.item.id, !editor.item.archived); setEditor(null); }}>{editor.item.archived ? '↩ Restore' : '🗄 Archive'}</Button>
              <Button type="button" variant="subtle" size="small" onClick={() => { const n = createNote({ title: ctx.itemLabel(editor.item.id), statusId: state.noteConfig.statuses[0]?.id ?? null, trackerItemIds: [editor.item.id] }); setEditor(null); requestNav({ page: 'notes', noteId: n.id }); }}>📝 New note</Button>
              <Button type="button" variant="subtle" size="small" onClick={() => setNotePicker(editor.item)}>🔗 Link note</Button>
              {state.notes.filter((n) => !n.archived && n.trackerItemIds.includes(editor.item.id)).map((n) => (
                <Button key={n.id} type="button" variant="secondary" size="small" onClick={() => { setEditor(null); requestNav({ page: 'notes', noteId: n.id }); }}>{n.icon || '📄'} {n.title || 'Untitled note'}</Button>
              ))}
            </div>
          )}
        />
      )}

      {viewEditor && (
        <ViewEditor
          key={viewEditor.view?.id || 'new'}
          tracker={tracker}
          view={viewEditor.view}
          onClose={() => setViewEditor(null)}
          onSubmit={({ name, type, config }) => {
            if (type === 'hierarchy' && !tracker.settings.allowHierarchy) updateTracker(tracker.id, (t) => ({ ...t, settings: { ...t.settings, allowHierarchy: true } }));
            if (viewEditor.view) updateView(tracker.id, viewEditor.view.id, { name, type, config });
            else {
              const created = addView(tracker.id, type, name);
              updateView(tracker.id, created.id, { config });
              setViewId(created.id);
            }
            setViewEditor(null);
          }}
        />
      )}

      {notePicker && <NotePickerModal state={state} title="Link a note to this item" exclude={state.notes.filter((n) => n.trackerItemIds.includes(notePicker.id)).map((n) => n.id)} onPick={(n) => { linkTrackerItem(n.id, notePicker.id); setToast('Note linked'); }} onClose={() => setNotePicker(null)} />}
      {activityFor && <CreateActivityModal state={state} item={activityFor} onClose={() => setActivityFor(null)} onCreated={() => setToast('Activity added to the plan')} />}
      {moveFor && <MoveItemModal item={moveFor} tracker={tracker} trackers={state.trackers} ctx={ctx} onClose={() => setMoveFor(null)} />}
      {toast && <div className="trk-toast" role="status">{toast}</div>}
    </div>
  );
}
