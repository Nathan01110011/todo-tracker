import { useId, useState } from 'react';
import { Search, X, Plus, Map as MapIcon, List, Columns2, SlidersHorizontal, ChevronDown, LocateFixed, LayoutGrid } from 'lucide-react';
import { sortLabels, type CollectionSort, type CollectionGroup, type CollectionDensity } from '../lib/collection';

interface Props {
  search: string; onSearch: (query: string) => void;
  status: string; onStatus: (status: string) => void;
  counts: { all: number; todo: number; visited: number };
  category: string; onCategory: (category: string) => void;
  categories: string[]; categoryCounts: Record<string, number>;
  sort: CollectionSort; onSort: (sort: CollectionSort) => void;
  grouping: CollectionGroup; onGroup: (grouping: CollectionGroup) => void;
  density: CollectionDensity; onDensity: (density: CollectionDensity) => void;
  view: string; onView: (view: string) => void;
  mobile: boolean; nearby: boolean; isOwner: boolean;
  includeVisited: boolean; onIncludeVisited: (include: boolean) => void;
  resultCount: number; isLoading: boolean;
  locationReady: boolean; isLocating: boolean; onLocate: () => void;
  onAdd: () => void; onReset: () => void;
}

export default function CollectionToolbar(props: Props) {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const optionsId = useId();
  const categoryId = useId();
  const categoryTotal = Object.values(props.categoryCounts).reduce((total, count) => total + count, 0);
  const needsLocation = props.sort === 'distance' && !props.locationReady && !props.nearby;
  const hasFilters = props.search.trim() || props.category !== 'All' || (!props.nearby && props.status !== 'All');
  const mobileMap = props.view === 'map';
  return (
    <div className="browse-toolbar">
      <div className="browse-search-row">
        <label className="collection-search"><Search size={18} /><input type="search" value={props.search} onChange={event => props.onSearch(event.target.value)} aria-label={props.nearby ? 'Search nearby' : 'Search places'} placeholder="Name, area, category or notes…" />{props.search && <button type="button" onClick={() => props.onSearch('')} aria-label="Clear search"><X size={16} /></button>}</label>
        <div className="browse-main-actions">
          {props.mobile ? <button type="button" className="secondary-button browse-map-toggle" onClick={() => props.onView(mobileMap ? 'list' : 'map')} aria-label={mobileMap ? 'List view' : 'Map view'}>{mobileMap ? <List size={18} /> : <MapIcon size={18} />}</button> : <div className="view-switch" role="group" aria-label="Layout">{[{ id: 'list', icon: List, label: 'List' }, { id: 'split', icon: Columns2, label: 'Split' }, { id: 'map', icon: MapIcon, label: 'Map' }].map(({ id, icon: Icon, label }) => <button key={id} type="button" onClick={() => props.onView(id)} className={props.view === id ? 'is-active' : ''} aria-label={`${label} view`} aria-pressed={props.view === id}><Icon size={17} /><span>{label}</span></button>)}</div>}
          {props.isOwner && <button type="button" className="primary-button browse-add" onClick={props.onAdd} aria-label="Add place"><Plus size={18} /><span>Add place</span></button>}
        </div>
      </div>
      <div className="browse-filters">
        {props.nearby ? <label className="nearby-visited-filter"><input type="checkbox" checked={props.includeVisited} onChange={event => props.onIncludeVisited(event.target.checked)} />Show visited</label> : <div className="status-switch" role="group" aria-label="Visit status">{[{ id: 'All', label: 'All', count: props.counts.all }, { id: 'TODO', label: 'To do', count: props.counts.todo }, { id: 'Visited', label: 'Visited', count: props.counts.visited }].map(option => <button key={option.id} type="button" onClick={() => props.onStatus(option.id)} className={props.status === option.id ? 'is-active' : ''} aria-pressed={props.status === option.id}>{option.label}<span>{option.count}</span></button>)}</div>}
      </div>
      <div className="browse-categories" role="group" aria-labelledby={categoryId}>
        <span id={categoryId} className="browse-category-label">Filter by category</span>
        <div className="browse-category-options">
          {props.categories.map(category => {
            const label = category === 'All' ? 'All categories' : category;
            const count = category === 'All' ? categoryTotal : props.categoryCounts[category] || 0;
            return (
              <button
                key={category}
                type="button"
                className={`browse-category-chip ${props.category === category ? 'is-active' : ''}`}
                aria-label={`${label}, ${count} ${count === 1 ? 'place' : 'places'}`}
                aria-pressed={props.category === category}
                onClick={() => props.onCategory(category)}
              >
                <span>{category === 'All' && props.mobile ? 'All' : label}</span>
                <span className="browse-category-count" aria-hidden="true">{props.isLoading ? '–' : count}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="browse-results">
        <p role="status" aria-live="polite">{props.isLoading ? 'Loading…' : `${props.resultCount} ${props.resultCount === 1 ? 'place' : 'places'}`}<span> · {props.nearby ? 'Nearest' : needsLocation ? 'Location needed' : sortLabels[props.sort]}</span></p>
        <div>{hasFilters && <button type="button" onClick={props.onReset} className="browse-reset">Reset</button>}<button type="button" className={`browse-options-toggle ${optionsOpen ? 'is-active' : ''}`} aria-expanded={optionsOpen} aria-controls={optionsId} onClick={() => setOptionsOpen(open => !open)}><SlidersHorizontal size={15} />Options<ChevronDown size={14} /></button></div>
      </div>
      {optionsOpen && <div className="browse-options" id={optionsId}>
        {!props.nearby && <label><span>Sort by</span><select aria-label="Sort places" value={props.sort} onChange={event => props.onSort(event.target.value as CollectionSort)}>{Object.entries(sortLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
        <label><span>Group by</span><select aria-label="Group places" value={props.grouping} onChange={event => props.onGroup(event.target.value as CollectionGroup)}><option value="none">No grouping</option><option value="category">Category</option><option value="tracker">Tracker</option><option value="alphabet">A–Z</option></select></label>
        <div className="browse-density"><span>Display</span><div className="view-switch" role="group" aria-label="List appearance"><button type="button" className={props.density === 'rows' ? 'is-active' : ''} aria-pressed={props.density === 'rows'} onClick={() => props.onDensity('rows')}><List size={16} />Rows</button><button type="button" className={props.density === 'cards' ? 'is-active' : ''} aria-pressed={props.density === 'cards'} onClick={() => props.onDensity('cards')}><LayoutGrid size={16} />Cards</button></div></div>
      </div>}
      {needsLocation && <div className="browse-location"><span>Use your location to sort by distance.</span><button type="button" onClick={props.onLocate} disabled={props.isLocating}><LocateFixed size={15} />{props.isLocating ? 'Locating…' : 'Locate'}</button></div>}
    </div>
  );
}
