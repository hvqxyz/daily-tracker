import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../components/buttons/Button.jsx';
import { TrackerScreen } from '../trackers/ui/TrackerScreen.jsx';
import { TrackerBuilder } from '../trackers/ui/TrackerBuilder.jsx';
import { useTrackerData } from '../trackers/ui/useTrackerData.js';
import { moveTracker } from '../trackers/tracker-store.js';
import { TRACKER_TEMPLATES } from '../trackers/templates.js';
import { useNavRequests } from '../common/nav.js';
import { RecurringTodos } from '../components/todos/RecurringTodos.jsx';
import '../trackers/ui/trackers.css';

const SELECTED_KEY = 'daily-planner-selected-tracker';
const RECURRING = '__recurring'; // the Recurring to-dos tab (not a tracker)

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
  const [drag, setDrag] = useState(null); // { id, overId?, after? } while a tab is being dragged

  useNavRequests('activity', (t) => {
    if (t.view === 'recurring') setSelectedId(RECURRING);
    if (t.trackerId) setSelectedId(t.trackerId);
    if (t.itemId) setOpenItemId(t.itemId);
  });

  const showRecurring = selectedId === RECURRING;
  const tracker = showRecurring ? null : state.trackers.find((t) => t.id === selectedId) || state.trackers[0];

  useEffect(() => {
    try {
      if (showRecurring) localStorage.setItem(SELECTED_KEY, RECURRING);
      else if (tracker) localStorage.setItem(SELECTED_KEY, tracker.id);
    } catch {
      // storage unavailable — selection just won't be remembered
    }
  }, [tracker, showRecurring]);

  return (
    <div className="trk-page">
      <div className="trk-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={showRecurring}
          className={`trk-tab${showRecurring ? ' active' : ''}`}
          onClick={() => setSelectedId(RECURRING)}
        >
          <span className="icon-emoji">🔁</span> Recurring to-dos
        </button>
        {state.trackers.map((t) => (
          <button
            type="button"
            role="tab"
            aria-selected={tracker?.id === t.id}
            key={t.id}
            className={`trk-tab${tracker?.id === t.id ? ' active' : ''}${drag?.id === t.id ? ' dragging' : ''}${drag?.overId === t.id && drag.id !== t.id ? (drag.after ? ' drop-after' : ' drop-before') : ''}`}
            onClick={() => setSelectedId(t.id)}
            draggable
            onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', t.id); setDrag({ id: t.id }); }}
            onDragOver={(e) => {
              if (!drag) return;
              e.preventDefault();
              const r = e.currentTarget.getBoundingClientRect();
              const after = e.clientX > r.left + r.width / 2;
              if (drag.overId !== t.id || drag.after !== after) setDrag({ ...drag, overId: t.id, after });
            }}
            onDrop={(e) => { e.preventDefault(); if (drag && drag.id !== t.id) moveTracker(drag.id, t.id, drag.after); setDrag(null); }}
            onDragEnd={() => setDrag(null)}
          >
            <span className="icon-emoji">{t.icon}</span> {t.name}
          </button>
        ))}
        <button type="button" className="trk-tab new" onClick={() => setBuilder({ mode: 'create' })}><Plus size={14} /> New tracker</button>
      </div>

      {showRecurring ? (
        <RecurringTodos state={state} ctx={ctx} />
      ) : tracker ? (
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
