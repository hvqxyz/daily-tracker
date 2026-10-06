import './TextInput.css';

export function TextInput({ value, onChange, placeholder, id, type = 'text', required, disabled, autoFocus, className }) {
  return (
    <input
      type={type}
      id={id}
      className={`text-input ${className || ''}`.trim()}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      autoFocus={autoFocus}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
    />
  );
}
