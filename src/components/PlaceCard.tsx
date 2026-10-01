import { useState, type ReactNode } from 'react';
import { MapPin, Utensils, Wine, ShoppingBag, Trophy, Calendar, Bed, Compass, Check, ChevronDown, Camera, Pencil, Trash2, RotateCcw, Star } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { Place } from '../types';

interface Props {
  item: Place;
  isOwner: boolean;
  distance?: string;
  eventDates?: string;
  onLocate: () => void;
  onHover: (hovered: boolean) => void;
  onUpdate: (updates: Partial<Place>) => void;
  onEdit: () => void;
  onDelete: () => void;
  onPhotos: () => void;
  visitDatePicker: ReactNode;
}

const categoryIcons = { Food: Utensils, Drinks: Wine, Activities: Compass, Shopping: ShoppingBag, Sport: Trophy, Events: Calendar, Hotels: Bed };

export default function PlaceCard({ item, isOwner, distance, eventDates, onLocate, onHover, onUpdate, onEdit, onDelete, onPhotos, visitDatePicker }: Props) {
  const [expanded, setExpanded] = useState(false);
  const CategoryIcon = categoryIcons[item.category as keyof typeof categoryIcons] || MapPin;
  const visited = item.status === 'Visited';
  const wouldReturn = item.return === true || item.return === 'TRUE';
  const photos = item.photoDetails?.length || (item.photos || '').split(',').filter(Boolean).length;
  const detailsId = `details-${item.type || 'place'}-${item.id}`;

  return (
    <article className={`place-card ${expanded ? 'is-expanded' : ''}`} onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)}>
      <div className="place-card-header">
        <div className="place-category"><CategoryIcon size={15} /><span>{item.category || 'Other'}</span>{distance && <span className="distance-badge">{distance}</span>}</div>
        {isOwner ? <button type="button" className={`visit-toggle ${visited ? 'is-visited' : ''}`} aria-label={`Mark ${item.name} as ${visited ? 'to do' : 'visited'}`} aria-pressed={visited} onClick={() => onUpdate({ status: visited ? 'To Do' : 'Visited' })}>{visited ? <Check size={17} /> : <span className="visit-circle" />}</button> : <span className={`visit-label ${visited ? 'is-visited' : ''}`}>{visited ? 'Visited' : 'To do'}</span>}
      </div>
      <button type="button" className="place-name" onClick={onLocate} aria-label={`Show ${item.name} on map`}>{item.name}</button>
      {item.details && <p className="place-description">{item.details}</p>}
      <p className="place-address">{item.address}</p>
      {eventDates && <p className="place-event"><Calendar size={15} />{eventDates}</p>}
      <div className="place-card-footer">
        <div className="place-summary">
          {visited && Number(item.rating) > 0 ? <span className="rating-summary"><Star size={14} fill="currentColor" />{item.rating}/5</span> : <span className="priority-summary" aria-label={`Priority ${item.priority || 0} out of 5`}><span className="priority-bars" aria-hidden="true">{[1, 2, 3, 4, 5].map(level => <i key={level} className={Number(item.priority) >= level ? 'is-filled' : ''} />)}</span><span>Priority</span></span>}
          {visited && item.date && <span>{format(parseISO(item.date), 'd MMM yyyy')}</span>}
          {photos > 0 && <button type="button" onClick={onPhotos} className="photo-summary" aria-label={`${photos} photos of ${item.name}`}><Camera size={15} />{photos}</button>}
          {wouldReturn && <RotateCcw size={14} aria-label="Would return" />}
        </div>
        <button type="button" className="details-toggle" aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpanded(current => !current)}>Details<ChevronDown size={16} /></button>
      </div>
      {expanded && <div id={detailsId} className="place-details">
        <div className="place-fields">
          <label className="place-field"><span>Priority</span><select aria-label={`Priority for ${item.name}`} value={item.priority || ''} disabled={!isOwner} onChange={event => onUpdate({ priority: event.target.value })}><option value="">Not set</option>{[1, 2, 3, 4, 5].map(level => <option key={level} value={level}>{level} / 5{level === 1 ? ' · Low' : level === 5 ? ' · High' : ''}</option>)}</select></label>
          {visited && <div className="place-field"><span>Rating</span><div className="place-rating">{[1, 2, 3, 4, 5].map(level => <button key={level} type="button" disabled={!isOwner} aria-label={`Rate ${item.name} ${level} out of 5`} aria-pressed={Number(item.rating) === level} onClick={() => onUpdate({ rating: String(level) })}><Star size={19} fill={Number(item.rating) >= level ? 'currentColor' : 'none'} className={Number(item.rating) >= level ? 'is-rated' : ''} /></button>)}</div></div>}
          {visited && <div className="place-field"><span>Date visited</span>{isOwner ? visitDatePicker : <span className="readonly-date">{item.date ? format(parseISO(item.date), 'd MMM yyyy') : 'Not recorded'}</span>}</div>}
        </div>
        {(isOwner || item.notes) && <label className="place-field"><span>Notes</span><textarea aria-label={`Notes for ${item.name}`} readOnly={!isOwner} defaultValue={item.notes} placeholder="Anything worth remembering…" onBlur={event => { if (isOwner && event.target.value !== item.notes) onUpdate({ notes: event.target.value }); }} /></label>}
        {visited && <button type="button" className={`return-toggle ${wouldReturn ? 'is-active' : ''}`} disabled={!isOwner} aria-pressed={wouldReturn} onClick={() => onUpdate({ return: !wouldReturn })}><RotateCcw size={16} />{wouldReturn ? 'Would return' : 'Would you return?'}</button>}
        <div className="place-actions">{(isOwner || photos > 0) && <button type="button" onClick={onPhotos}><Camera size={16} />Photos{photos > 0 ? ` (${photos})` : ''}</button>}{isOwner && <><button type="button" onClick={onEdit}><Pencil size={16} />Edit</button><button type="button" className="delete-action" onClick={onDelete}><Trash2 size={16} />Delete</button></>}</div>
      </div>}
    </article>
  );
}
