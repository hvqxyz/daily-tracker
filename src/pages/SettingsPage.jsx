import { useState } from 'react';
import { Plus, Pencil } from 'lucide-react';
import {
  useStore,
  addCategory,
  updateCategory,
  deleteCategory,
  addRecurrence,
  deleteRecurrence,
  pauseSeries,
  resumeSeries,
  updateSeries,
  updateSettings,
  addDictionaryItem,
  updateDictionaryItem,
  deleteDictionaryItem,
} from '../common/store.js';
import { Card } from '../components/Card.jsx';
import { Button } from '../components/buttons/Button.jsx';
import { NumberInput } from '../components/inputs/NumberInput.jsx';
import { CategoryEditor } from '../components/settings/CategoryEditor.jsx';
import { RecurrenceEditor } from '../components/settings/RecurrenceEditor.jsx';
import { SyncCard } from '../components/settings/SyncCard.jsx';
import { LibraryActivityEditor, DeleteActivityDialog } from '../components/library/LibraryActivityEditor.jsx';
import { categoryInfo } from '../common/model.js';
import { libraryReferences } from '../common/library.js';
import { FilterRow } from '../components/library/FilterRow.jsx';
import { formatDuration, formatDateDMY, minutesToClock, todayKey } from '../common/time.js';
import '../components/library/library.css';
import { describeRule, repeatToRule } from '../common/recurrence.js';
import './SettingsPage.css';

export function SettingsPage() {
  const state = useStore();
  const [editingCategory, setEditingCategory] = useState(null); // { category } | { new: true } | null
  const [editingRule, setEditingRule] = useState(null);
  const [editingDictItem, setEditingDictItem] = useState(null); // { item, key } | null
  const [deletingDictItem, setDeletingDictItem] = useState(null); // definition | null
  const [libQuery, setLibQuery] = useState('');
  const [libCategory, setLibCategory] = useState('');
  const q = libQuery.trim().toLowerCase();
  const libraryRows = state.activityDictionary.filter((it) => (!q || it.title.toLowerCase().includes(q)) && (!libCategory || it.categoryId === libCategory));
  const templateUses = (id) => state.templates.filter((t) => t.items.some((it) => it.activityId === id)).length;

  return (
    <div className="settings-page">
      <SyncCard />

      <Card
        title="Life categories"
        headerAction={<Button size="small" variant="subtle" onClick={() => setEditingCategory({ category: null })}><Plus size={15} /></Button>}
      >
        <div className="settings-list">
          {state.categories.map((c) => (
            <button type="button" key={c.id} className="settings-list-row" onClick={() => setEditingCategory({ category: c })}>
              <span className="category-color-dot" style={{ background: c.color }} />
              <span className="icon-emoji">{c.icon}</span>
              <span className="settings-row-title">{c.name}</span>
              <Pencil size={14} className="settings-row-edit-icon" />
            </button>
          ))}
        </div>
      </Card>

      <Card
        title="Activity Library"
        headerAction={<Button size="small" variant="subtle" aria-label="New library activity" onClick={() => setEditingDictItem({ item: null, key: `new-${Date.now()}` })}><Plus size={15} /></Button>}
      >
        {state.activityDictionary.length === 0 ? (
          <div className="empty-state">No activities yet — add the ones you plan often. Templates are built from them.</div>
        ) : (
          <>
            <div className="lib-manage-tools">
              <div className="lib-search">
                <input type="search" className="lib-search-input" placeholder="Search the library" aria-label="Search the library" value={libQuery} onChange={(e) => setLibQuery(e.target.value)} />
              </div>
              <FilterRow role="group" aria-label="Filter by category">
                <button type="button" className={`lib-filter${!libCategory ? ' selected' : ''}`} aria-pressed={!libCategory} onClick={() => setLibCategory('')}>All</button>
                {state.categories.filter((c) => state.activityDictionary.some((it) => it.categoryId === c.id)).map((c) => (
                  <button type="button" key={c.id} className={`lib-filter${libCategory === c.id ? ' selected' : ''}`} aria-pressed={libCategory === c.id} onClick={() => setLibCategory(libCategory === c.id ? '' : c.id)}>{c.icon} {c.name}</button>
                ))}
              </FilterRow>
            </div>
            <div className="settings-list">
              {libraryRows.map((item) => {
                const cat = categoryInfo(state.categories, item.categoryId);
                const uses = templateUses(item.id);
                return (
                  <button type="button" key={item.id} className="settings-list-row" onClick={() => setEditingDictItem({ item, key: item.id })}>
                    <span className="icon-emoji">{item.icon}</span>
                    <div className="settings-row-info">
                      <span className="settings-row-title">{item.title}</span>
                      <span className="settings-row-sub">
                        {cat?.icon} {cat?.name} · {formatDuration(item.duration)}{item.start != null ? ` · ${minutesToClock(item.start)}` : ''}
                      </span>
                    </div>
                    {uses > 0 && <span className="lib-row-uses">{uses} {uses === 1 ? 'template' : 'templates'}</span>}
                    <Pencil size={14} className="settings-row-edit-icon" />
                  </button>
                );
              })}
              {libraryRows.length === 0 && <div className="empty-state">No activity matches.</div>}
            </div>
          </>
        )}
      </Card>

      <Card title="Planning">
        <div className="field-group waking-hours-field">
          <label className="field-label">Waking hours per day (used for Available time)</label>
          <NumberInput
            value={Math.round(state.settings.wakingHoursMinutes / 60)}
            onChange={(v) => updateSettings({ wakingHoursMinutes: (Number(v) || 0) * 60 })}
            min={1}
            max={24}
          />
        </div>
      </Card>

      <Card
        title="Recurring activities"
        headerAction={<Button size="small" variant="subtle" onClick={() => setEditingRule({ rule: null })}><Plus size={15} /></Button>}
      >
        {state.recurrences.length === 0 ? (
          <div className="empty-state">No recurring activities yet.</div>
        ) : (
          <div className="settings-list">
            {state.recurrences.map((r) => (
              <button type="button" key={r.id} className="settings-list-row" onClick={() => setEditingRule({ rule: r })}>
                <span className="icon-emoji">{r.icon}</span>
                <div className="settings-row-info">
                  <span className="settings-row-title">{r.title}</span>
                  <span className="settings-row-sub">{describeRule(r, formatDateDMY)} · {formatDuration(r.duration)}</span>
                </div>
                <Pencil size={14} className="settings-row-edit-icon" />
              </button>
            ))}
          </div>
        )}
      </Card>

      {editingCategory && (
        <CategoryEditor
          open
          category={editingCategory.category}
          onClose={() => setEditingCategory(null)}
          onSubmit={(data) => {
            if (editingCategory.category) updateCategory(editingCategory.category.id, data);
            else addCategory(data);
            setEditingCategory(null);
          }}
          onDelete={() => { deleteCategory(editingCategory.category.id); setEditingCategory(null); }}
        />
      )}

      {editingDictItem && (
        <LibraryActivityEditor
          key={editingDictItem.key}
          definition={editingDictItem.item}
          categories={state.categories}
          usage={editingDictItem.item ? libraryReferences(state, editingDictItem.item.id) : null}
          onClose={() => setEditingDictItem(null)}
          onSubmit={(fields) => {
            if (editingDictItem.item) updateDictionaryItem(editingDictItem.item.id, fields);
            else addDictionaryItem(fields);
            setEditingDictItem(null);
          }}
          onDelete={editingDictItem.item ? () => { setDeletingDictItem(editingDictItem.item); setEditingDictItem(null); } : undefined}
        />
      )}

      {deletingDictItem && (
        <DeleteActivityDialog
          definition={deletingDictItem}
          usage={libraryReferences(state, deletingDictItem.id)}
          onClose={() => setDeletingDictItem(null)}
          onConfirm={() => { deleteDictionaryItem(deletingDictItem.id); setDeletingDictItem(null); }}
        />
      )}

      {editingRule && (
        <RecurrenceEditor
          open
          rule={editingRule.rule}
          categories={state.categories}
          onClose={() => setEditingRule(null)}
          onSubmit={({ fields, repeat }) => {
            if (editingRule.rule) updateSeries(editingRule.rule.id, fields, repeat);
            else addRecurrence({ ...fields, ...repeatToRule(repeat, todayKey()) });
            setEditingRule(null);
          }}
          onTogglePause={editingRule.rule ? () => { if (editingRule.rule.pausedFrom) resumeSeries(editingRule.rule.id); else pauseSeries(editingRule.rule.id, todayKey()); setEditingRule(null); } : null}
          onDelete={() => { deleteRecurrence(editingRule.rule.id); setEditingRule(null); }}
        />
      )}
    </div>
  );
}
