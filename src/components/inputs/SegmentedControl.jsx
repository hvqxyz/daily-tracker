import './SegmentedControl.css';

/** options: [{ value, label, icon? }] */
export function SegmentedControl({ value, onChange, options, className }) {
  return (
    <div className={`segmented-control ${className || ''}`.trim()} role="radiogroup">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          className={`segmented-option${value === opt.value ? ' selected' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.icon && <span className="icon-emoji">{opt.icon}</span>}
          {opt.label}
        </button>
      ))}
    </div>
  );
}
