import { SegmentedControl } from '../inputs/SegmentedControl.jsx';
import { Checkbox } from '../inputs/Checkbox.jsx';
import { PRIORITIES } from '../../common/model.js';
import { formatDuration } from '../../common/time.js';
import { MAX_DURATION, MIN_DURATION } from '../../common/activity-draft.js';
import '../library/library.css';

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];

export function FieldError({ id, children }) {
  if (!children) return null;
  return <p className="field-error" id={id} role="alert">{children}</p>;
}

export function PriorityField({ value, onChange, label = 'Priority' }) {
  return (
    <div className="field-group">
      <span className="field-label">{label}</span>
      <SegmentedControl value={value} onChange={onChange} options={PRIORITIES.map((p) => ({ value: p.id, label: p.label, icon: p.icon }))} />
    </div>
  );
}

/** Preset chips plus a minutes box for anything else. */
export function DurationField({ value, onChange, error, label = 'Duration', id = 'activity-duration' }) {
  return (
    <div className="field-group">
      <label className="field-label" htmlFor={id}>{label}</label>
      <div className="duration-field">
        {DURATION_PRESETS.map((d) => (
          <button type="button" key={d} className={`duration-chip${Number(value) === d ? ' selected' : ''}`} aria-pressed={Number(value) === d} onClick={() => onChange(d)}>
            {formatDuration(d)}
          </button>
        ))}
        <span className="duration-custom">
          <input
            id={id}
            type="number"
            className="number-input"
            min={MIN_DURATION}
            max={MAX_DURATION}
            step={5}
            value={value}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(e) => onChange(e.target.value)}
          />
          min
        </span>
      </div>
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  );
}

export function TimeFields({ hasTime, time, onHasTime, onTime, error, checkboxLabel = 'Set a time' }) {
  return (
    <div className="field-row">
      <div className="field-group">
        <Checkbox checked={hasTime} onChange={onHasTime} label={checkboxLabel} />
      </div>
      {hasTime && (
        <div className="field-group">
          <input type="time" className="time-input" aria-label="Start time" value={time} onChange={(e) => onTime(e.target.value)} aria-invalid={Boolean(error)} />
          <FieldError>{error}</FieldError>
        </div>
      )}
    </div>
  );
}
