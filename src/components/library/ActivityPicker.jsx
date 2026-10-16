import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { categoryInfo } from '../../common/model.js';
import { formatDuration } from '../../common/time.js';
import { FilterRow } from './FilterRow.jsx';
import './library.css';

/** One activity row: icon, title, category and duration. */
export function ActivityRow({ activity, categories, onClick, trailing, selected = false }) {
  const cat = activity.categoryId ? categoryInfo(categories, activity.categoryId) : null;
  return (
    <button type="button" className={`lib-row${selected ? ' selected' : ''}`} onClick={onClick}>
      <span className="lib-row-icon icon-emoji">{activity.icon}</span>
      <span className="lib-row-info">
        <span className="lib-row-title">{activity.title}</span>
        {cat && <span className="lib-row-meta">{cat.icon} {cat.name}</span>}
      </span>
      {activity.duration > 0 && <span className="lib-row-duration">{formatDuration(activity.duration)}</span>}
      {trailing}
    </button>
  );
}

/**
 * Search + browse the Activity Library. Recent activities come first (when
 * given and nothing is being searched); templates can narrow the list to the
 * library activities they use. Every pick resolves to a library definition,
 * except a recent one-off (which `onPickRecent` receives as is).
 */
export function ActivityPicker({
  library,
  categories,
  templates = [],
  recent = [],
  onPick,
  onPickRecent,
  onCreate,
  createLabel = 'Create new activity',
  autoFocus = true,
  filters, // optional controlled { query, categoryId, templateId } — lets a parent keep the search across steps
  onFiltersChange,
}) {
  const [ownFilters, setOwnFilters] = useState({ query: '', categoryId: '', templateId: '' });
  const { query, categoryId, templateId } = filters || ownFilters;
  const update = (patch) => (onFiltersChange ? onFiltersChange(patch) : setOwnFilters((f) => ({ ...f, ...patch })));
  const setQuery = (v) => update({ query: v });
  const setCategoryId = (v) => update({ categoryId: v });
  const setTemplateId = (v) => update({ templateId: v });

  const usedCategories = useMemo(() => categories.filter((c) => library.some((a) => a.categoryId === c.id)), [categories, library]);
  const templatesWithItems = templates.filter((t) => t.items.some((it) => it.activityId));
  const q = query.trim().toLowerCase();
  const inTemplate = templateId ? new Set(templates.find((t) => t.id === templateId)?.items.map((it) => it.activityId)) : null;
  const filtered = library.filter((a) => (!q || a.title.toLowerCase().includes(q))
    && (!categoryId || a.categoryId === categoryId)
    && (!inTemplate || inTemplate.has(a.id)));
  const browsing = !q && !categoryId && !templateId;

  return (
    <div className="lib-picker">
      <div className="lib-search">
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          className="lib-search-input"
          placeholder="Search activities"
          aria-label="Search activities"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            if (filtered.length === 1) onPick(filtered[0]);
            else if (filtered.length === 0 && q && onCreate) onCreate(query);
          }}
          autoFocus={autoFocus}
        />
      </div>

      {(usedCategories.length > 1 || templatesWithItems.length > 0) && (
        <FilterRow role="group" aria-label="Filter activities">
          <button type="button" className={`lib-filter${!categoryId ? ' selected' : ''}`} aria-pressed={!categoryId} onClick={() => setCategoryId('')}>All</button>
          {usedCategories.map((c) => (
            <button type="button" key={c.id} className={`lib-filter${categoryId === c.id ? ' selected' : ''}`} aria-pressed={categoryId === c.id} onClick={() => setCategoryId(categoryId === c.id ? '' : c.id)}>
              {c.icon} {c.name}
            </button>
          ))}
          {templatesWithItems.length > 0 && (
            <select className="lib-filter lib-filter-select" aria-label="Activities in a template" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              <option value="">Any template</option>
              {templatesWithItems.map((t) => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
            </select>
          )}
        </FilterRow>
      )}

      <div className="lib-picker-scroll">
        {browsing && recent.length > 0 && (
          <section aria-label="Recent activities">
            <h4 className="lib-section-title">Recent</h4>
            {recent.map((entry) => (
              <ActivityRow
                key={entry.sourceId || entry.key}
                activity={entry}
                categories={categories}
                onClick={() => (entry.sourceId ? onPick(library.find((a) => a.id === entry.sourceId) || entry) : onPickRecent?.(entry))}
              />
            ))}
          </section>
        )}

        <section aria-label="Activity Library">
          <h4 className="lib-section-title">Activity Library</h4>
          {filtered.map((a) => <ActivityRow key={a.id} activity={a} categories={categories} onClick={() => onPick(a)} />)}
          {filtered.length === 0 && (
            <p className="lib-empty">
              {library.length === 0 ? 'Your Activity Library is empty.' : q ? `No activity matches “${query.trim()}”.` : 'No activities match these filters.'}
            </p>
          )}
        </section>
      </div>

      {onCreate && (
        <button type="button" className="lib-create" onClick={() => onCreate(filtered.length === 0 ? query : '')}>
          <Plus size={16} /> {filtered.length === 0 && q ? `Create “${query.trim()}”` : createLabel}
        </button>
      )}
    </div>
  );
}
