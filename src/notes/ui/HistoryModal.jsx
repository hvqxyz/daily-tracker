import { useState } from 'react';
import { Modal } from '../../components/Modal.jsx';
import { Button } from '../../components/buttons/Button.jsx';
import { BlockEditor } from './BlockEditor.jsx';
import { restoreVersion } from '../notes-store.js';

function stamp(ms) {
  return new Date(ms).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Simple version snapshots: browse an earlier state of the note and restore it. */
export function HistoryModal({ note, resolveNote, onClose }) {
  const versions = [...(note.versions || [])].reverse();
  const [selected, setSelected] = useState(versions[0]?.id || null);
  const v = versions.find((x) => x.id === selected);

  return (
    <Modal open onClose={onClose} className="nt-modal wide">
      <h3>Version history</h3>
      <p className="nt-muted">Updated {stamp(note.updatedAt)}. Earlier versions are saved automatically while you edit.</p>
      {versions.length === 0 ? <p className="nt-muted">No earlier versions yet.</p> : (
        <div className="nt-history">
          <div className="nt-history-list">
            {versions.map((x) => (
              <button type="button" key={x.id} className={`nt-picker-row${x.id === selected ? ' on' : ''}`} onClick={() => setSelected(x.id)}>{stamp(x.at)}</button>
            ))}
          </div>
          {v && (
            <div className="nt-history-preview">
              <h4>{v.title || 'Untitled note'}</h4>
              <BlockEditor blocks={v.blocks} readOnly resolveNote={resolveNote} onChange={() => {}} />
            </div>
          )}
        </div>
      )}
      <div className="app-modal-actions">
        <Button type="button" variant="subtle" onClick={onClose}>Close</Button>
        {v && <Button type="button" variant="primary" onClick={() => { restoreVersion(note.id, v.id); onClose(); }}>Restore this version</Button>}
      </div>
    </Modal>
  );
}
