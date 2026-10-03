import { useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { groupCollection, type CollectionDensity, type CollectionGroup, type PlaceItem } from '../lib/collection';

interface Props { items: PlaceItem[]; grouping: CollectionGroup; density: CollectionDensity; renderItem: (item: PlaceItem) => ReactNode }

export default function PlaceCollection({ items, grouping, density, renderItem }: Props) {
  const groups = useMemo(() => groupCollection(items, grouping), [items, grouping]);
  const [collapsed, setCollapsed] = useState(new Set<string>());
  const groupRefs = useRef(new Map<string, HTMLElement>());
  const allCollapsed = groups.length > 0 && groups.every(group => collapsed.has(group.label));
  const toggleGroup = (label: string) => setCollapsed(current => { const next = new Set(current); if (next.has(label)) next.delete(label); else next.add(label); return next; });
  const jumpTo = (label: string) => {
    setCollapsed(current => { const next = new Set(current); next.delete(label); return next; });
    requestAnimationFrame(() => groupRefs.current.get(label)?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
  };
  return (
    <div className="place-collection">
      {grouping !== 'none' && <div className="group-navigation"><select aria-label="Jump to group" defaultValue="" onChange={event => { jumpTo(event.target.value); event.target.value = ''; }}><option value="" disabled>Jump to {grouping === 'alphabet' ? 'letter' : grouping}…</option>{groups.map(group => <option key={group.label} value={group.label}>{group.label} ({group.items.length})</option>)}</select><button type="button" onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(groups.map(group => group.label)))}>{allCollapsed ? 'Expand all' : 'Collapse all'}</button></div>}
      {groups.map((group, index) => <section key={group.label} className="place-group" ref={element => { if (element) groupRefs.current.set(group.label, element); else groupRefs.current.delete(group.label); }}>
        {group.label && <h3 className="collection-group-heading"><button type="button" aria-expanded={!collapsed.has(group.label)} aria-controls={`collection-group-${index}`} onClick={() => toggleGroup(group.label)}><ChevronDown size={16} className={collapsed.has(group.label) ? 'is-collapsed' : ''} /><span>{group.label}</span><span className="collection-group-count">{group.items.length}</span></button></h3>}
        {!collapsed.has(group.label) && <div id={`collection-group-${index}`} className={density === 'rows' ? 'place-rows' : 'place-list'} role="list" aria-label={group.label ? `${group.label} places` : 'Saved places'}>{group.items.map(item => <div key={`${item.type}:${item.id}`} role="listitem">{renderItem(item)}</div>)}</div>}
      </section>)}
    </div>
  );
}
