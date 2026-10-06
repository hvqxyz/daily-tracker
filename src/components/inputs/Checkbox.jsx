import './Checkbox.css';

export function Checkbox({ checked, onChange, label, id, disabled, className }) {
  return (
    <label className={`checkbox-field ${className || ''}`.trim()}>
      <input
        type="checkbox"
        id={id}
        disabled={disabled}
        checked={checked}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      <span className="checkbox-field-ui">
        <svg viewBox="0 0 20 20" fill="none">
          <path d="M5 10.5L8.5 14L15 6.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {label && <span className="checkbox-field-label">{label}</span>}
    </label>
  );
}
