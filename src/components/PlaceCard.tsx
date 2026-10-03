import { MapPin, Utensils, Wine, ShoppingBag, Trophy, Calendar, Bed, Compass, Check, ChevronRight, Camera, RotateCcw, Star } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { Place } from '../types';
import { photoCount } from '../lib/collection';

interface Props {
  item: Place;
  isOwner: boolean;
  showTracker: boolean;
  distance?: string;
  eventDates?: string;
  onLocate: () => void;
  onOpen: () => void;
  onHover: (hovered: boolean) => void;
  onUpdate: (updates: Partial<Place>) => void;
  onPhotos: () => void;
}

const categoryIcons = { Food: Utensils, Drinks: Wine, Activities: Compass, Shopping: ShoppingBag, Sport: Trophy, Events: Calendar, Hotels: Bed };

export default function PlaceCard({ item, isOwner, showTracker, distance, eventDates, onLocate, onOpen, onHover, onUpdate, onPhotos }: Props) {
  const CategoryIcon = categoryIcons[item.category as keyof typeof categoryIcons] || MapPin;
  const visited = item.status === 'Visited';
  const wouldReturn = item.return === true || item.return === 'TRUE';
  const photos = photoCount(item);

  return (
    <article className="place-card" data-place-id={`${item.type}:${item.id}`} onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)}>
      <div className="place-card-header">
        <div className="place-category"><CategoryIcon size={15} /><span>{item.category || 'Other'}{showTracker ? ` · ${item.scope}` : ''}</span>{distance && <span className="distance-badge">{distance}</span>}</div>
        {isOwner ? <button type="button" className={`visit-toggle ${visited ? 'is-visited' : ''}`} aria-label={`Mark ${item.name} as ${visited ? 'to do' : 'visited'}`} aria-pressed={visited} onClick={() => onUpdate({ status: visited ? 'To Do' : 'Visited' })}>{visited ? <Check size={17} /> : <span className="visit-circle" />}</button> : <span className={`visit-label ${visited ? 'is-visited' : ''}`}>{visited ? 'Visited' : 'To do'}</span>}
      </div>
      <button type="button" className="place-name" onClick={onOpen} aria-label={`View details for ${item.name}`}>{item.name}</button>
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
        <div className="card-detail-actions"><button type="button" className="icon-button" onClick={onLocate} aria-label={`Show ${item.name} on map`}><MapPin size={16} /></button><button type="button" className="details-toggle" onClick={onOpen}>Details<ChevronRight size={16} /></button></div>
      </div>
    </article>
  );
}
