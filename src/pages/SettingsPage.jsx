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
import { ActivityEditor } from '../components/timeline/ActivityEditor.jsx';
import { categoryInfo } from '../common/model.js';
import { formatDuration, formatDateDMY, minutesToClock, todayKey } from '../common/time.js';
import { describeRule, repeatToRule } from '../common/recurrence.js';
import './SettingsPage.css';

export function SettingsPage() {
  const state = useStore();
  const [editingCategory, setEditingCategory] = useState(null); // { category } | { new: true } | null
  const [editingRule, setEditingRule] = useState(null);
  const [editingDictItem, setEditingDictItem] = useState(null); // { item, key } | null

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
        title="Activity dictionary"
        headerAction={<Button size="small" variant="subtle" onClick={() => setEditingDictItem({ item: null, key: `new-${Date.now()}` })}><Plus size={15} /></Button>}
      >
        {state.activityDictionary.length === 0 ? (
          <div className="empty-state">No saved activities yet — add ones you plan often, to pick from without a template.</div>
        ) : (
          <div className="settings-list">
            {state.activityDictionary.map((item) => {
              const cat = categoryInfo(state.categories, item.categoryId);
              return (
                <button type="button" key={item.id} className="settings-list-row" onClick={() => setEditingDictItem({ item, key: item.id })}>
                  <span className="icon-emoji">{item.icon}</span>
                  <div className="settings-row-info">
                    <span className="settings-row-title">{item.title}</span>
                    <span className="settings-row-sub">
                      {item.start != null ? minutesToClock(item.start) : 'Flexible'} · {formatDuration(item.duration)} · {cat?.icon} {cat?.name}
                    </span>
                  </div>
                  <Pencil size={14} className="settings-row-edit-icon" />
                </button>
              );
            })}
          </div>
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
        <ActivityEditor
          key={editingDictItem.key}
          open
          onClose={() => setEditingDictItem(null)}
          activity={editingDictItem.item}
          categories={state.categories}
          onSubmit={(patch) => {
            const { notes, ...rest } = patch; // dictionary entries are presets, not one-off notes
            if (editingDictItem.item) updateDictionaryItem(editingDictItem.item.id, rest);
            else addDictionaryItem(rest);
            setEditingDictItem(null);
          }}
          onDelete={editingDictItem.item ? () => { deleteDictionaryItem(editingDictItem.item.id); setEditingDictItem(null); } : undefined}
          allowStatusActions={false}
          allowMoveToDay={false}
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
