import { useMemo, useState } from 'react';

/** Text input with autocomplete over existing tags; Enter creates a new one. */
export function TagInput({ tags, chosenIds, onAdd, onDone, placeholder = 'Add tag…' }) {
  const [value, setValue] = useState('');
  const clean = value.trim().replace(/^#+/, '');
  const suggestions = useMemo(
    () => tags.filter((t) => !chosenIds.includes(t.id) && t.name.toLowerCase().includes(clean.toLowerCase())).slice(0, 6),
    [tags, chosenIds, clean]
  );
  const exact = tags.find((t) => t.name.toLowerCase() === clean.toLowerCase());

  return (
    <div className="nt-taginput">
      <input
        className="nt-tag-field"
        autoFocus
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); if (clean) { onAdd(exact ? exact.name : clean); setValue(''); } }
          if (e.key === 'Escape') onDone();
          if (e.key === 'Backspace' && !value) onDone();
        }}
        onBlur={() => setTimeout(onDone, 120)}
      />
      {(suggestions.length > 0 || (clean && !exact)) && (
        <div className="nt-popup nt-tag-popup" onMouseDown={(e) => e.preventDefault()}>
          {suggestions.map((t) => (
            <button type="button" key={t.id} className="nt-popup-item" onClick={() => { onAdd(t.name); setValue(''); }}>#{t.name}</button>
          ))}
          {clean && !exact && <button type="button" className="nt-popup-item" onClick={() => { onAdd(clean); setValue(''); }}>Create #{clean}</button>}
        </div>
      )}
    </div>
  );
}
