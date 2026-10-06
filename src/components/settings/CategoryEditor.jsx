import { useState } from 'react';
import { Modal } from '../Modal.jsx';
import { Button } from '../buttons/Button.jsx';
import { TextInput } from '../inputs/TextInput.jsx';
import { IconPicker } from '../inputs/IconPicker.jsx';
import './settings-shared.css';

export function CategoryEditor({ open, onClose, category, onSubmit, onDelete }) {
  const [name, setName] = useState(category?.name || '');
  const [icon, setIcon] = useState(category?.icon || '📌');
  const [color, setColor] = useState(category?.color || '#3682e0');

  if (!open) return null;

  return (
    <Modal open onClose={onClose}>
      <h3>{category ? 'Edit category' : 'New category'}</h3>
      <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSubmit({ name: name.trim(), icon, color }); }}>
        <div className="field-group">
          <label className="field-label">Icon</label>
          <IconPicker value={icon} onChange={setIcon} />
        </div>
        <div className="field-group">
          <label className="field-label">Name</label>
          <TextInput value={name} onChange={setName} autoFocus required />
        </div>
        <div className="field-group">
          <label className="field-label">Accent color</label>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="color-swatch-input" />
        </div>
        <div className="app-modal-actions">
          {category && <Button type="button" variant="danger" size="small" onClick={onDelete}>Delete</Button>}
          <Button type="button" variant="subtle" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">Save</Button>
        </div>
      </form>
    </Modal>
  );
}
