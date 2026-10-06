import { Archive, BookOpen, Clock, FileText, Plus, Settings2, Star } from 'lucide-react';
import { Menu } from '../../trackers/ui/Menu.jsx';
import { activeNotes, collectionCounts, tagCounts } from '../knowledge.js';

function Item({ active, icon, label, count, onClick }) {
  return (
    <button type="button" className={`nt-side-item${active ? ' active' : ''}`} onClick={onClick}>
      <span className="nt-side-icon">{icon}</span>
      <span className="nt-side-label">{label}</span>
      {count !== undefined && count !== null && <span className="nt-count">{count}</span>}
    </button>
  );
}

/** Knowledge navigation: built-in lists, collections and tags. */
export function Sidebar({ state, view, onSelect, onManage, onAddCollection }) {
  const notes = activeNotes(state.notes);
  const counts = collectionCounts(state);
  const tCounts = tagCounts(state);
  const is = (kind, id) => view.kind === 'list' && view.filter === kind && (id === undefined || view.id === id);
  const tags = [...state.noteTags].filter((t) => tCounts.get(t.id)).sort((a, b) => a.name.localeCompare(b.name));
  const archivedCount = state.notes.length - notes.length;

  return (
    <nav className="nt-side" aria-label="Knowledge navigation">
      <div className="nt-side-group">
        <Item active={view.kind === 'home'} icon={<BookOpen size={15} />} label="Home" onClick={() => onSelect({ kind: 'home' })} />
        <Item active={is('favorites')} icon={<Star size={15} />} label="Favorites" count={notes.filter((n) => n.favorite).length} onClick={() => onSelect({ kind: 'list', filter: 'favorites' })} />
        <Item active={is('recent')} icon={<Clock size={15} />} label="Recent" onClick={() => onSelect({ kind: 'list', filter: 'recent' })} />
        <Item active={is('all')} icon={<FileText size={15} />} label="All notes" count={notes.length} onClick={() => onSelect({ kind: 'list', filter: 'all' })} />
      </div>

      <div className="nt-side-group">
        <div className="nt-side-head">
          <span>Collections</span>
          <button type="button" className="nt-icon-btn" aria-label="New collection" onClick={onAddCollection}><Plus size={14} /></button>
        </div>
        {state.noteCollections.map((c) => (
          <Item key={c.id} active={is('collection', c.id)} icon={c.icon || '📁'} label={c.name} count={counts.get(c.id) || 0} onClick={() => onSelect({ kind: 'list', filter: 'collection', id: c.id })} />
        ))}
        {state.noteCollections.length === 0 && <p className="nt-side-empty">Group notes into collections.</p>}
        <Item active={is('uncategorized')} icon="·" label="No collection" count={notes.filter((n) => n.collectionIds.length === 0).length} onClick={() => onSelect({ kind: 'list', filter: 'uncategorized' })} />
      </div>

      <div className="nt-side-group">
        <div className="nt-side-head"><span>Tags</span></div>
        <div className="nt-side-tags">
          {tags.map((t) => (
            <button type="button" key={t.id} className={`nt-tag-pill${is('tag', t.id) ? ' active' : ''}`} onClick={() => onSelect({ kind: 'list', filter: 'tag', id: t.id })}>
              #{t.name} <span className="nt-count">{tCounts.get(t.id)}</span>
            </button>
          ))}
          {tags.length === 0 && <p className="nt-side-empty">Tags you add to notes appear here.</p>}
        </div>
      </div>

      <div className="nt-side-group">
        <Item active={is('archived')} icon={<Archive size={15} />} label="Archived" count={archivedCount || null} onClick={() => onSelect({ kind: 'list', filter: 'archived' })} />
        <Menu
          label="Manage knowledge"
          align="left"
          className="nt-side-manage"
          items={[
            { label: 'Statuses…', icon: '🟡', onClick: () => onManage('statuses') },
            { label: 'Collections…', icon: '📁', onClick: () => onManage('collections') },
            { label: 'Tags…', icon: '#', onClick: () => onManage('tags') },
            { label: 'Templates…', icon: '🧩', onClick: () => onManage('templates') },
          ]}
        >
          <span className="nt-side-item"><span className="nt-side-icon"><Settings2 size={15} /></span><span className="nt-side-label">Manage</span></span>
        </Menu>
      </div>
    </nav>
  );
}
