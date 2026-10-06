import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../components/buttons/Button.jsx';
import { TrackerScreen } from '../trackers/ui/TrackerScreen.jsx';
import { TrackerBuilder } from '../trackers/ui/TrackerBuilder.jsx';
import { useTrackerData } from '../trackers/ui/useTrackerData.js';
import { TRACKER_TEMPLATES } from '../trackers/templates.js';
import { useNavRequests } from '../common/nav.js';
import '../trackers/ui/trackers.css';

const SELECTED_KEY = 'daily-planner-selected-tracker';

function loadSelected() {
  try {
    return localStorage.getItem(SELECTED_KEY);
  } catch {
    return null;
  }
}

/** The Activity tab: a row of user-made trackers, each rendered entirely from its own schema. */
export function ActivityPage() {
  const { state, ctx } = useTrackerData();
  const [selectedId, setSelectedId] = useState(loadSelected);
  const [builder, setBuilder] = useState(null); // { mode, fieldId? }
  const [openItemId, setOpenItemId] = useState(null);

  useNavRequests('activity', (t) => {
    if (t.trackerId) setSelectedId(t.trackerId);
    if (t.itemId) setOpenItemId(t.itemId);
  });

  const tracker = state.trackers.find((t) => t.id === selectedId) || state.trackers[0];

  useEffect(() => {
    try {
      if (tracker) localStorage.setItem(SELECTED_KEY, tracker.id);
    } catch {
      // storage unavailable — selection just won't be remembered
    }
  }, [tracker]);

  return (
    <div className="trk-page">
      <div className="trk-tabs" role="tablist">
        {state.trackers.map((t) => (
          <button type="button" role="tab" aria-selected={tracker?.id === t.id} key={t.id} className={`trk-tab${tracker?.id === t.id ? ' active' : ''}`} onClick={() => setSelectedId(t.id)}>
            <span className="icon-emoji">{t.icon}</span> {t.name}
          </button>
        ))}
        <button type="button" className="trk-tab new" onClick={() => setBuilder({ mode: 'create' })}><Plus size={14} /> New tracker</button>
      </div>

      {tracker ? (
        <TrackerScreen key={tracker.id} tracker={tracker} state={state} ctx={ctx} openItemId={openItemId} onItemOpened={() => setOpenItemId(null)} onOpenSettings={(fieldId) => setBuilder({ mode: 'edit', fieldId })} />
      ) : (
        <div className="empty-state trk-welcome">
          <p><strong>Track anything.</strong> Build a tracker with the fields, statuses and views you need — books, courses, finances, cars, habits.</p>
          <Button onClick={() => setBuilder({ mode: 'create' })}><Plus size={16} /> Create your first tracker</Button>
        </div>
      )}

      {builder && (
        <TrackerBuilder
          key={`${builder.mode}-${tracker?.id}-${builder.fieldId || ''}`}
          mode={builder.mode}
          tracker={builder.mode === 'edit' ? tracker : null}
          trackers={state.trackers}
          allItems={state.trackerItems}
          state={state}
          userTemplates={state.trackerTemplates || []}
          builtinTemplates={TRACKER_TEMPLATES}
          initialFieldId={builder.fieldId || null}
          onClose={() => setBuilder(null)}
          onSaved={(id) => { if (builder.mode === 'create' && id) setSelectedId(id); if (id === null) setSelectedId(null); }}
        />
      )}
    </div>
  );
}
