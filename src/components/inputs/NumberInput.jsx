import './NumberInput.css';

export function NumberInput({ value, onChange, placeholder, id, min, max, step, required, disabled, className }) {
  return (
    <input
      type="number"
      id={id}
      className={`number-input ${className || ''}`.trim()}
      placeholder={placeholder}
      min={min}
      max={max}
      step={step}
      required={required}
      disabled={disabled}
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
    />
  );
}
