import './Select.css';

/** options entries are either a plain value or { value, label }. */
export function Select({ value, onChange, options = [], placeholder, id, required, disabled, className }) {
  return (
    <select
      id={id}
      className={`select-input ${className || ''}`.trim()}
      required={required}
      disabled={disabled}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((option) => {
        const { value: optValue, label } = typeof option === 'object' ? option : { value: option, label: option };
        return (
          <option key={optValue} value={optValue}>{label}</option>
        );
      })}
    </select>
  );
}
