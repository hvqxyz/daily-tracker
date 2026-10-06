import { Select } from '../inputs/Select.jsx';
import { Checkbox } from '../inputs/Checkbox.jsx';
import { describeRule, repeatToRule, WEEKDAY_SHORT } from '../../common/recurrence.js';
import { formatDateDMY } from '../../common/time.js';
import '../settings/settings-shared.css';
import './RepeatPicker.css';

const MODES = [
  { value: 'never', label: 'Never' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom…' },
];

function Weekdays({ value, onChange }) {
  const toggle = (i) => onChange(value.includes(i) ? value.filter((d) => d !== i) : [...value, i].sort());
  return (
    <div className="weekday-picker">
      {WEEKDAY_SHORT.map((label, i) => (
        <button type="button" key={label} className={`weekday-chip${value.includes(i) ? ' selected' : ''}`} aria-pressed={value.includes(i)} onClick={() => toggle(i)}>
          {label}
        </button>
      ))}
    </div>
  );
}

/**
 * Progressive "Repeat" control: only the options that matter for the chosen
 * mode are shown. `value` is the form state from common/recurrence.js.
 */
export function RepeatPicker({ value, onChange, dateKey, allowNever = true }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const modes = allowNever ? MODES : MODES.filter((m) => m.value !== 'never');
  const rule = value.mode === 'never' ? null : repeatToRule(value, dateKey);

  return (
    <div className="field-group repeat-picker">
      <label className="field-label" htmlFor="activity-repeat">Repeat</label>
      <Select id="activity-repeat" value={value.mode} onChange={(mode) => set({ mode })} options={modes} />

      {value.mode === 'weekly' && (
        <div className="repeat-block"><Weekdays value={value.weekdays} onChange={(weekdays) => set({ weekdays })} /></div>
      )}

      {value.mode === 'monthly' && (
        <div className="repeat-block repeat-inline">
          <span>On day</span>
          <input type="number" className="number-input repeat-num" min={1} max={31} disabled={value.monthLast} value={value.monthDay} onChange={(e) => set({ monthDay: e.target.value })} />
          <Checkbox checked={value.monthLast} onChange={(monthLast) => set({ monthLast })} label="Last day" />
        </div>
      )}

      {value.mode === 'custom' && (
        <div className="repeat-block">
          <div className="repeat-inline">
            <span>Every</span>
            <input type="number" className="number-input repeat-num" min={1} max={365} value={value.interval} onChange={(e) => set({ interval: e.target.value })} />
            <Select value={value.unit} onChange={(unit) => set({ unit })} options={[{ value: 'days', label: 'days' }, { value: 'weeks', label: 'weeks' }, { value: 'months', label: 'months' }]} />
          </div>
          {value.unit === 'weeks' && <Weekdays value={value.weekdays} onChange={(weekdays) => set({ weekdays })} />}
          {value.unit === 'months' && (
            <div className="repeat-inline">
              <span>On day</span>
              <input type="number" className="number-input repeat-num" min={1} max={31} disabled={value.monthLast} value={value.monthDay} onChange={(e) => set({ monthDay: e.target.value })} />
              <Checkbox checked={value.monthLast} onChange={(monthLast) => set({ monthLast })} label="Last day" />
            </div>
          )}
        </div>
      )}

      {value.mode !== 'never' && (
        <div className="repeat-block repeat-inline">
          <span>Ends</span>
          <Select
            value={value.endMode}
            onChange={(endMode) => set({ endMode })}
            options={[{ value: 'never', label: 'Never' }, { value: 'date', label: 'On date' }, { value: 'count', label: 'After' }]}
          />
          {value.endMode === 'date' && <input type="date" className="time-input repeat-date" value={value.endDate} onChange={(e) => set({ endDate: e.target.value })} />}
          {value.endMode === 'count' && (
            <>
              <input type="number" className="number-input repeat-num" min={1} max={999} value={value.count} onChange={(e) => set({ count: e.target.value })} />
              <span>times</span>
            </>
          )}
        </div>
      )}

      {rule && <span className="repeat-summary">🔁 {describeRule(rule, formatDateDMY)}</span>}
    </div>
  );
}
