import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { useStore, selectDay, applyTemplateToDay } from '../common/store.js';
import { todayKey, dateToKey, formatShortDay } from '../common/time.js';
import { PRIORITIES, categoryInfo } from '../common/model.js';
import { Card } from '../components/Card.jsx';
import { Button } from '../components/buttons/Button.jsx';
import { Select } from '../components/inputs/Select.jsx';
import './CalendarPage.css';

function buildMonthGrid(viewDate) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const leading = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - leading);

  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    return { date, key: dateToKey(date), outside: date.getMonth() !== month };
  });
}

const WEEKDAY_LABELS = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(2024, 0, 1 + i);
  return d.toLocaleDateString(undefined, { weekday: 'narrow' });
});

function dayIndicator(state, key, today) {
  const day = selectDay(state, key);
  const count = day.activities.length;
  if (count === 0) return 'empty';
  if (key > today) return 'draft';
  if (key === today) return 'live';
  const required = day.activities.filter((a) => a.priority === 'required');
  const allDone = required.length === 0 || required.every((a) => a.status === 'completed');
  return allDone ? 'completed' : 'partial';
}

export function CalendarPage({ selectedDate, onOpenDay }) {
  const state = useStore();
  const today = todayKey();
  const [viewDate, setViewDate] = useState(() => new Date(`${selectedDate}T00:00:00`));
  const [previewKey, setPreviewKey] = useState(selectedDate);
  const [templateChoice, setTemplateChoice] = useState(state.templates[0]?.id || '');

  const grid = useMemo(() => buildMonthGrid(viewDate), [viewDate]);
  const monthLabel = viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const previewDay = selectDay(state, previewKey);

  const byPriority = PRIORITIES.map((p) => ({
    ...p,
    items: previewDay.activities.filter((a) => a.priority === p.id),
  }));

  return (
    <div className="calendar-page">
      <Card>
        <div className="calendar-month-header">
          <button type="button" className="calendar-nav-btn" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}>
            <ChevronLeft size={18} />
          </button>
          <span className="calendar-month-label">{monthLabel}</span>
          <button type="button" className="calendar-nav-btn" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}>
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="calendar-weekdays">
          {WEEKDAY_LABELS.map((l, i) => <span key={i}>{l}</span>)}
        </div>

        <div className="calendar-grid">
          {grid.map(({ date, key, outside }) => {
            const indicator = dayIndicator(state, key, today);
            return (
              <button
                type="button"
                key={key}
                className={`calendar-cell${outside ? ' outside' : ''}${key === previewKey ? ' selected' : ''}${key === today ? ' today' : ''}`}
                onClick={() => setPreviewKey(key)}
                onDoubleClick={() => onOpenDay(key)}
              >
                <span className="calendar-cell-day">{date.getDate()}</span>
                <span className={`calendar-dot ${indicator}`} />
              </button>
            );
          })}
        </div>

        <div className="calendar-legend">
          <span><span className="calendar-dot empty" /> Empty</span>
          <span><span className="calendar-dot draft" /> Draft</span>
          <span><span className="calendar-dot live" /> Today</span>
          <span><span className="calendar-dot completed" /> Completed</span>
          <span><span className="calendar-dot partial" /> Partial</span>
        </div>
      </Card>

      <Card
        title={formatShortDay(previewKey)}
        headerAction={
          <Button size="small" variant="secondary" onClick={() => onOpenDay(previewKey)}>
            Open <ArrowRight size={14} />
          </Button>
        }
      >
        {previewDay.activities.length === 0 ? (
          <div className="empty-state">Nothing planned yet.</div>
        ) : (
          <div className="preview-priority-groups">
            {byPriority.filter((p) => p.items.length > 0).map((p) => (
              <div key={p.id} className="preview-priority-group">
                <span className={`priority-label ${p.id}`}>{p.icon} {p.label.toUpperCase()}</span>
                <div className="preview-items">
                  {p.items.map((item) => {
                    const cat = categoryInfo(state.categories, item.categoryId);
                    return (
                      <span key={item.id} className="preview-item-chip">
                        {item.icon} {item.title} <span className="preview-item-cat">{cat?.icon}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {state.templates.length > 0 && (
          <div className="apply-template-row">
            <Select
              value={templateChoice}
              onChange={setTemplateChoice}
              options={state.templates.map((t) => ({ value: t.id, label: `${t.icon} ${t.name}` }))}
            />
            <Button
              size="small"
              variant="subtle"
              onClick={() => templateChoice && applyTemplateToDay(previewKey, templateChoice)}
            >
              Apply
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
