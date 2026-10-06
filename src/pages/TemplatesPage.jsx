import { useState } from 'react';
import { Plus, Pencil, Trash2, Copy } from 'lucide-react';
import {
  useStore,
  addTemplate,
  duplicateTemplate,
  deleteTemplate,
  applyTemplateToDay,
} from '../common/store.js';
import { todayKey, shiftDateKey, formatDuration } from '../common/time.js';
import { Card } from '../components/Card.jsx';
import { Button } from '../components/buttons/Button.jsx';
import { TemplateEditor } from '../components/templates/TemplateEditor.jsx';
import './TemplatesPage.css';

export function TemplatesPage({ onOpenDay }) {
  const state = useStore();
  const [editingId, setEditingId] = useState(null);

  function handleCreate() {
    const t = addTemplate({ name: 'New template', icon: '📋', items: [] });
    setEditingId(t.id);
  }

  function handleApply(templateId, dateKey) {
    applyTemplateToDay(dateKey, templateId);
    onOpenDay(dateKey);
  }

  return (
    <div className="templates-page">
      <div className="templates-header-row">
        <span className="section-title">My templates</span>
        <Button size="small" onClick={handleCreate}><Plus size={16} /> New</Button>
      </div>

      <div className="templates-grid">
        {state.templates.map((t) => {
          const totalMinutes = t.items.reduce((s, it) => s + it.duration, 0);
          return (
            <Card key={t.id} className="template-card">
              <div className="template-card-top">
                <span className="template-card-icon">{t.icon}</span>
                <div className="template-card-tools">
                  <button type="button" className="template-icon-btn" onClick={() => duplicateTemplate(t.id)} aria-label="Duplicate template" title="Duplicate">
                    <Copy size={15} />
                  </button>
                  <button type="button" className="template-icon-btn" onClick={() => setEditingId(t.id)} aria-label="Edit template" title="Edit">
                    <Pencil size={15} />
                  </button>
                </div>
              </div>
              <h3 className="template-card-name">{t.name}</h3>
              <p className="template-card-sub">{t.items.length} activities · {formatDuration(totalMinutes)}</p>
              <div className="template-card-chips">
                {t.items.slice(0, 6).map((it) => (
                  <span key={it.id} className="template-mini-chip" title={it.title}>{it.icon}</span>
                ))}
                {t.items.length > 6 && <span className="template-mini-chip more">+{t.items.length - 6}</span>}
              </div>
              <div className="template-card-actions">
                <Button size="small" variant="secondary" onClick={() => handleApply(t.id, todayKey())}>Today</Button>
                <Button size="small" variant="secondary" onClick={() => handleApply(t.id, shiftDateKey(todayKey(), 1))}>Tomorrow</Button>
                <button type="button" className="template-delete-btn" onClick={() => deleteTemplate(t.id)} aria-label="Delete template">
                  <Trash2 size={15} />
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      {editingId && (
        <TemplateEditor
          templateId={editingId}
          categories={state.categories}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
}
