import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { FieldValue } from '../FieldValue.jsx';
import { Button } from '../../../components/buttons/Button.jsx';
import { itemLabel } from '../../engine/data.js';
import { viewColumns } from '../../engine/query.js';
import { updateTracker } from '../../tracker-store.js';

export function HierarchyView({ tracker, view, rows, ctx, onOpen, itemMenu, onAdd }) {
  const [collapsed, setCollapsed] = useState(() => new Set());
  const columns = viewColumns(tracker, view).filter((c) => c.fieldId !== tracker.settings.titleFieldId);

  const { roots, childrenOf } = useMemo(() => {
    const ids = new Set(rows.map((r) => r.id));
    const byParent = new Map();
    const top = [];
    for (const item of rows) {
      if (item.parentId && ids.has(item.parentId)) {
        if (!byParent.has(item.parentId)) byParent.set(item.parentId, []);
        byParent.get(item.parentId).push(item);
      } else top.push(item);
    }
    return { roots: top, childrenOf: byParent };
  }, [rows]);

  if (!tracker.settings.allowHierarchy) {
    return (
      <div className="empty-state">
        Hierarchy is off for this tracker.
        <div><Button size="small" onClick={() => updateTracker(tracker.id, (t) => ({ ...t, settings: { ...t.settings, allowHierarchy: true } }))}>Turn on hierarchy</Button></div>
      </div>
    );
  }
  if (rows.length === 0) return <div className="empty-state">No items match this view.</div>;

  const toggle = (id) => setCollapsed((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  function Node({ item, depth }) {
    const kids = childrenOf.get(item.id) || [];
    const closed = collapsed.has(item.id);
    return (
      <>
        <div className="trk-tree-row" style={{ paddingLeft: `${depth * 1.1 + 0.2}rem` }} onClick={() => onOpen(item)}>
          <button type="button" className="trk-icon-btn" aria-label={closed ? 'Expand' : 'Collapse'} style={{ visibility: kids.length ? 'visible' : 'hidden' }} onClick={(e) => { e.stopPropagation(); toggle(item.id); }}>
            {closed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
          </button>
          <span className="trk-tree-title">{itemLabel(tracker, item, ctx)}</span>
          <span className="trk-tree-cols">
            {columns.map((c) => <span key={c.fieldId} className="trk-list-cell"><FieldValue field={c.field} item={item} ctx={ctx} /></span>)}
          </span>
          <button type="button" className="trk-icon-btn" aria-label="Add child" onClick={(e) => { e.stopPropagation(); onAdd({}, item.id); }}><Plus size={14} /></button>
          {itemMenu(item)}
        </div>
        {!closed && kids.map((k) => <Node key={k.id} item={k} depth={depth + 1} />)}
      </>
    );
  }

  return <div className="trk-tree">{roots.map((r) => <Node key={r.id} item={r} depth={0} />)}</div>;
}
