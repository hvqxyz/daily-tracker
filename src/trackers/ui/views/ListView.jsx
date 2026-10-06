import { FieldValue } from '../FieldValue.jsx';
import { itemLabel, isItemDone } from '../../engine/data.js';
import { viewColumns } from '../../engine/query.js';

export function ListView({ tracker, view, groups, ctx, onOpen, itemMenu }) {
  const columns = viewColumns(tracker, view).filter((c) => c.fieldId !== (tracker.settings.titleFieldId));
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  if (total === 0) return <div className="empty-state">No items match this view.</div>;

  return (
    <div className="trk-list">
      {groups.map((g) => (
        <div key={g.key}>
          {g.label !== null && <div className="trk-group-heading">{g.meta?.icon} {g.label} <span className="trk-count">{g.items.length}</span></div>}
          {g.items.map((item) => (
            <div className="trk-list-row" key={`${g.key}:${item.id}`} role="button" tabIndex={0} onClick={() => onOpen(item)} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(item); }}>
              <div className="trk-list-main">
                <span className={`trk-list-title${isItemDone(item, tracker) ? ' done' : ''}`}>{itemLabel(tracker, item, ctx)}</span>
                <div className="trk-list-meta">
                  {columns.map((c) => (
                    <span className="trk-list-cell" key={c.fieldId} title={c.field.name}><FieldValue field={c.field} item={item} ctx={ctx} /></span>
                  ))}
                </div>
              </div>
              {itemMenu(item)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
