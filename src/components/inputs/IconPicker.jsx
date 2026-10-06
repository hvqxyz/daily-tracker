import './IconPicker.css';

const CURATED_ICONS = [
  '☀️', '😴', '💻', '💼', '🏋️', '🏃', '🚶', '🧘', '🍝', '🍲', '🍳', '☕',
  '🧠', '📚', '🎮', '🚗', '⚽', '❤️', '📞', '🧹', '🛒', '💰', '✈️', '🧭',
  '🏨', '🎬', '🎯', '📝', '🎵', '🎨', '🌱', '🐶', '📌',
];

export function IconPicker({ value, onChange }) {
  return (
    <div className="icon-picker">
      <div className="icon-picker-current">{value || '📌'}</div>
      <div className="icon-picker-grid">
        {CURATED_ICONS.map((icon) => (
          <button
            key={icon}
            type="button"
            className={`icon-picker-option${icon === value ? ' selected' : ''}`}
            onClick={() => onChange(icon)}
          >
            {icon}
          </button>
        ))}
      </div>
    </div>
  );
}
