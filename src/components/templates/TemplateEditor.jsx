import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from '../Modal.jsx';
import { Button } from '../buttons/Button.jsx';
import { TextInput } from '../inputs/TextInput.jsx';
import { IconPicker } from '../inputs/IconPicker.jsx';
import { ActivityEditor } from '../timeline/ActivityEditor.jsx';
import {
  useStore,
  updateTemplate,
  addTemplateItem,
  updateTemplateItem,
  deleteTemplateItem,
} from '../../common/store.js';
import { categoryInfo } from '../../common/model.js';
import { minutesToClock, formatDuration } from '../../common/time.js';
import './TemplateEditor.css';

export function TemplateEditor({ templateId, categories, onClose }) {
  const state = useStore();
  const template = state.templates.find((t) => t.id === templateId);
  const [itemEditor, setItemEditor] = useState(null); // { item, key } | null

  if (!template) return null;

  function handleSubmitItem(patch) {
    const { notes, ...rest } = patch;
    if (itemEditor.item) {
      updateTemplateItem(templateId, itemEditor.item.id, rest);
    } else {
      addTemplateItem(templateId, rest);
    }
    setItemEditor(null);
  }

  return (
    <>
      <Modal open onClose={onClose} className="template-editor-modal">
        <h3>Edit template</h3>

        <div className="field-row">
          <div className="field-group" style={{ flex: '0 0 auto' }}>
            <IconPicker value={template.icon} onChange={(icon) => updateTemplate(templateId, { icon })} />
          </div>
        </div>
        <div className="field-group">
          <label className="field-label">Name</label>
          <TextInput value={template.name} onChange={(name) => updateTemplate(templateId, { name })} />
        </div>

        <div className="template-items-list">
          {template.items.length === 0 && <div className="empty-state">No activities yet.</div>}
          {template.items.map((item) => {
            const cat = categoryInfo(categories, item.categoryId);
            return (
              <div key={item.id} className="template-item-row" onClick={() => setItemEditor({ item, key: item.id })}>
                <span className="icon-emoji">{item.icon}</span>
                <div className="template-item-info">
                  <span className="template-item-title">{item.title}</span>
                  <span className="template-item-meta">
                    {item.start != null ? minutesToClock(item.start) : 'Flexible'} · {formatDuration(item.duration)} · {cat?.icon} {cat?.name}
                  </span>
                </div>
                <button
                  type="button"
                  className="template-item-delete"
                  onClick={(e) => { e.stopPropagation(); deleteTemplateItem(templateId, item.id); }}
                  aria-label="Delete item"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>

        <Button variant="subtle" onClick={() => setItemEditor({ item: null, key: `new-${Date.now()}` })}>
          <Plus size={16} /> Add activity
        </Button>

        <div className="app-modal-actions">
          <Button variant="primary" onClick={onClose}>Done</Button>
        </div>
      </Modal>

      {itemEditor && (
        <ActivityEditor
          key={itemEditor.key}
          open
          title={itemEditor.item ? 'Edit template item' : 'Add template item'}
          onClose={() => setItemEditor(null)}
          activity={itemEditor.item}
          categories={categories}
          dictionary={state.activityDictionary}
          onSubmit={handleSubmitItem}
          onDelete={() => { deleteTemplateItem(templateId, itemEditor.item.id); setItemEditor(null); }}
          allowStatusActions={false}
          allowMoveToDay={false}
        />
      )}
    </>
  );
}
