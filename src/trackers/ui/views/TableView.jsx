import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { FieldValue } from '../FieldValue.jsx';
import { Menu } from '../Menu.jsx';
import { viewColumns } from '../../engine/query.js';
import { updateTracker } from '../../tracker-store.js';

const DEFAULT_WIDTH = 150;
const MIN_WIDTH = 70;

function ColumnHeader({ column, tracker, view, onUpdateView, onEditField, onResize }) {
  const { field } = column;
  const sort = (view.config.sorts || [])[0];
  const sorted = sort?.fieldId === field.id ? sort.dir : null;

  const rename = () => {
    const name = window.prompt('Rename field', field.name);
    if (name && name.trim()) updateTracker(tracker.id, (t) => ({ ...t, fields: t.fields.map((f) => (f.id === field.id ? { ...f, name: name.trim() } : f)) }));
  };

  return (
    <th style={{ width: column.width || DEFAULT_WIDTH }}>
      <div className="trk-th">
        <Menu
          label={`${field.name} options`}
          align="left"
          className="trk-th-menu"
          items={[
            { label: 'Sort ascending', icon: '↑', onClick: () => onUpdateView({ sorts: [{ fieldId: field.id, dir: 'asc' }] }) },
            { label: 'Sort descending', icon: '↓', onClick: () => onUpdateView({ sorts: [{ fieldId: field.id, dir: 'desc' }] }) },
            sorted && { label: 'Clear sort', onClick: () => onUpdateView({ sorts: [] }) },
            { label: 'Group by this field', icon: '▤', onClick: () => onUpdateView({ groupBy: field.id }) },
            { divider: true },
            { label: 'Rename', icon: '✎', onClick: rename },
            { label: 'Edit field…', icon: '⚙', onClick: () => onEditField(field.id) },
            { label: 'Hide column', icon: '🙈', onClick: () => onUpdateView({ columns: viewColumns(tracker, view).filter((c) => c.fieldId !== field.id).map(({ fieldId, width }) => ({ fieldId, width })) }) },
          ]}
        >
          <span className="trk-th-label">
            {field.name}
            {sorted === 'asc' && <ArrowUp size={12} />}
            {sorted === 'desc' && <ArrowDown size={12} />}
          </span>
        </Menu>
        <span
          className="trk-resizer"
          role="separator"
          aria-label={`Resize ${field.name}`}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onResize(column, e);
          }}
        />
      </div>
    </th>
  );
}

export function TableView({ tracker, view, groups, ctx, onOpen, itemMenu, onUpdateView, onEditField }) {
  const columns = viewColumns(tracker, view);
  const [liveWidths, setLiveWidths] = useState({});
  const dragRef = useRef(null);

  const widthOf = (c) => liveWidths[c.fieldId] ?? c.width ?? DEFAULT_WIDTH;

  function startResize(column, e) {
    const startX = e.clientX;
    const startWidth = widthOf(column);
    const move = (ev) => setLiveWidths((w) => ({ ...w, [column.fieldId]: Math.max(MIN_WIDTH, Math.round(startWidth + ev.clientX - startX)) }));
    const up = (ev) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const width = Math.max(MIN_WIDTH, Math.round(startWidth + ev.clientX - startX));
      setLiveWidths({});
      onUpdateView({ columns: columns.map((c) => ({ fieldId: c.fieldId, width: c.fieldId === column.fieldId ? width : c.width ?? null })) });
    };
    dragRef.current = { move, up };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  if (columns.length === 0) return <div className="empty-state">No columns are visible — turn some on under Columns.</div>;

  const total = groups.reduce((n, g) => n + g.items.length, 0);
  if (total === 0) return <div className="empty-state">No items match this view.</div>;

  return (
    <div className="trk-table-wrap">
      <table className="trk-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <ColumnHeader key={c.fieldId} column={{ ...c, width: widthOf(c) }} tracker={tracker} view={view} onUpdateView={onUpdateView} onEditField={onEditField} onResize={startResize} />
            ))}
            <th className="trk-th-actions" />
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <GroupRows key={g.key} group={g} columns={columns} widthOf={widthOf} ctx={ctx} onOpen={onOpen} itemMenu={itemMenu} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GroupRows({ group, columns, ctx, onOpen, itemMenu }) {
  return (
    <>
      {group.label !== null && (
        <tr className="trk-group-row">
          <td colSpan={columns.length + 1}>
            {group.meta?.icon} {group.label} <span className="trk-count">{group.items.length}</span>
          </td>
        </tr>
      )}
      {group.items.map((item) => (
        <tr key={`${group.key}:${item.id}`} className="trk-row" onClick={() => onOpen(item)}>
          {columns.map((c) => (
            <td key={c.fieldId}><FieldValue field={c.field} item={item} ctx={ctx} /></td>
          ))}
          <td className="trk-td-actions">{itemMenu(item)}</td>
        </tr>
      ))}
    </>
  );
}
