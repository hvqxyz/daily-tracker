import { useState } from 'react';
import { Plus, Pencil, Trash2, Copy, X } from 'lucide-react';
import {
  useStore,
  duplicateTemplate,
  deleteTemplate,
  applyTemplateToDay,
  dismissLibraryNotice,
} from '../common/store.js';
import { resolveTemplateItems } from '../common/library.js';
import { todayKey, shiftDateKey, formatDuration } from '../common/time.js';
import { Card } from '../components/Card.jsx';
import { Button } from '../components/buttons/Button.jsx';
import { TemplateEditor } from '../components/templates/TemplateEditor.jsx';
import './TemplatesPage.css';
import '../components/library/library.css';

export function TemplatesPage({ onOpenDay }) {
  const state = useStore();
  const [editing, setEditing] = useState(null); // { id } (null id = a new template) | null

  function handleApply(templateId, dateKey) {
    const { skipped } = applyTemplateToDay(dateKey, templateId);
    if (skipped > 0) window.alert(`${skipped} ${skipped === 1 ? 'activity was' : 'activities were'} skipped: no longer in the Activity Library.`);
    onOpenDay(dateKey);
  }

  return (
    <div className="templates-page">
      <div className="templates-header-row">
        <span className="section-title">My templates</span>
        <Button size="small" onClick={() => setEditing({ id: null })}><Plus size={16} /> New</Button>
      </div>

      {state.libraryNotice && <LibraryNotice notice={state.libraryNotice} />}

      <div className="templates-grid">
        {state.templates.map((t) => {
          const items = resolveTemplateItems(t, state.activityDictionary);
          const totalMinutes = items.reduce((s, it) => s + (Number(it.duration) || 0), 0);
          return (
            <Card key={t.id} className="template-card">
              <div className="template-card-top">
                <span className="template-card-icon">{t.icon}</span>
                <div className="template-card-tools">
                  <button type="button" className="template-icon-btn" onClick={() => duplicateTemplate(t.id)} aria-label="Duplicate template" title="Duplicate">
                    <Copy size={15} />
                  </button>
                  <button type="button" className="template-icon-btn" onClick={() => setEditing({ id: t.id })} aria-label="Edit template" title="Edit">
                    <Pencil size={15} />
                  </button>
                </div>
              </div>
              <h3 className="template-card-name">{t.name}</h3>
              <p className="template-card-sub">{t.items.length} activities · {formatDuration(totalMinutes)}</p>
              <div className="template-card-chips">
                {items.slice(0, 6).map((it) => (
                  <span key={it.id} className="template-mini-chip" title={it.title}>{it.icon}</span>
                ))}
                {t.items.length > 6 && <span className="template-mini-chip more">+{t.items.length - 6}</span>}
              </div>
              <div className="template-card-actions">
                <Button size="small" variant="secondary" onClick={() => handleApply(t.id, todayKey())}>Today</Button>
                <Button size="small" variant="secondary" onClick={() => handleApply(t.id, shiftDateKey(todayKey(), 1))}>Tomorrow</Button>
                <button type="button" className="template-delete-btn" onClick={() => { if (window.confirm(`Delete the template "${t.name}"? Its activities stay in your Activity Library.`)) deleteTemplate(t.id); }} aria-label="Delete template">
                  <Trash2 size={15} />
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      {editing && (
        <TemplateEditor
          key={editing.id || 'new'}
          templateId={editing.id}
          categories={state.categories}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

/** One-time summary of what moving template activities into the library did. */
function LibraryNotice({ notice }) {
  const { created = [], ambiguous = [], unresolved = [] } = notice;
  return (
    <div className="lib-notice" role="status">
      <div style={{ flex: 1 }}>
        <p>
          <strong>Templates now use your Activity Library.</strong>{' '}
          {created.length > 0 && `${created.length} ${created.length === 1 ? 'activity that only existed in templates was' : 'activities that only existed in templates were'} added to the library. `}
          Template times and durations are unchanged.
        </p>
        {(created.length > 0 || ambiguous.length > 0 || unresolved.length > 0) && (
          <details>
            <summary>Details</summary>
            <ul>
              {created.map((c) => <li key={c.id}>{c.icon} {c.title} — from {c.templates.join(', ')}</li>)}
              {ambiguous.map((a) => <li key={`amb-${a.createdId}`}>{a.icon} {a.title}: several library activities looked the same, so a separate one was created instead of guessing. Review them in Settings → Activity Library.</li>)}
              {unresolved.map((u) => <li key={`un-${u.itemId}`}>An activity in {u.templateName} couldn't be identified and is marked “Not in library”.</li>)}
            </ul>
          </details>
        )}
      </div>
      <button type="button" className="tpl-icon-btn tall" aria-label="Dismiss" onClick={dismissLibraryNotice}><X size={16} /></button>
    </div>
  );
}
