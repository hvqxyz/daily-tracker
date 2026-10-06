import { Modal } from '../Modal.jsx';
import { Button } from '../buttons/Button.jsx';
import './SeriesScopeModal.css';

const COPY = {
  edit: {
    title: 'Edit recurring activity',
    question: 'Apply your changes to…',
    options: [
      { id: 'occurrence', label: 'This occurrence', hint: 'Only this day changes' },
      { id: 'following', label: 'This and following occurrences', hint: 'Earlier days stay as they were' },
      { id: 'series', label: 'Entire series', hint: 'Every occurrence, except ones you changed yourself' },
    ],
  },
  delete: {
    title: 'Delete recurring activity',
    question: 'Delete…',
    options: [
      { id: 'occurrence', label: 'This occurrence', hint: 'The rest of the series continues' },
      { id: 'following', label: 'This and following occurrences', hint: 'The series ends the day before' },
      { id: 'series', label: 'Entire series', hint: 'Removes it from today onward; past days stay' },
    ],
  },
};

/** "This occurrence, this and following, or the entire series?" */
export function SeriesScopeModal({ kind, onChoose, onClose }) {
  const c = COPY[kind];
  return (
    <Modal open onClose={onClose}>
      <h3>{c.title}</h3>
      <p className="scope-question">{c.question}</p>
      <div className="scope-options">
        {c.options.map((o) => (
          <button type="button" key={o.id} className={`scope-option${kind === 'delete' && o.id !== 'occurrence' ? ' danger' : ''}`} onClick={() => onChoose(o.id)}>
            <strong>{o.label}</strong>
            <span>{o.hint}</span>
          </button>
        ))}
      </div>
      <div className="app-modal-actions">
        <Button type="button" variant="subtle" onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}
