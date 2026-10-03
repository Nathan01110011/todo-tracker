import { MapPin, Utensils, Wine, ShoppingBag, Trophy, Calendar, Bed, Compass, Check, Camera, Star, ChevronRight } from 'lucide-react';
import type { PlaceItem } from '../lib/collection';
import { photoCount } from '../lib/collection';

const categoryIcons = { Food: Utensils, Drinks: Wine, Activities: Compass, Shopping: ShoppingBag, Sport: Trophy, Events: Calendar, Hotels: Bed };

interface Props {
  item: PlaceItem;
  isOwner: boolean;
  showTracker: boolean;
  distance?: string;
  onOpen: () => void;
  onHover: (hovered: boolean) => void;
  onUpdate: (updates: Partial<PlaceItem>) => void;
  onPhotos: () => void;
}

export default function PlaceRow({ item, isOwner, showTracker, distance, onOpen, onHover, onUpdate, onPhotos }: Props) {
  const Icon = categoryIcons[item.category as keyof typeof categoryIcons] || MapPin;
  const visited = item.status === 'Visited';
  const photos = photoCount(item);
  return (
    <article className="place-row" data-place-id={`${item.type}:${item.id}`} onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)}>
      <button type="button" className="place-row-main" onClick={onOpen} aria-label={`View details for ${item.name}`}>
        <span className="place-row-icon" aria-hidden="true"><Icon size={18} /></span>
        <span className="place-row-copy">
          <strong>{item.name}</strong>
          <span className="place-row-meta"><span>{item.category || 'Other'}{showTracker ? ` · ${item.scope}` : ''}</span>{item.address && <span className="place-row-address" title={item.address}>{item.address}</span>}</span>
        </span>
        {distance ? <span className="row-distance">{distance}</span> : visited && Number(item.rating) > 0 ? <span className="row-rating" aria-label={`Rated ${item.rating} out of 5`}><Star size={13} fill="currentColor" />{item.rating}</span> : Number(item.priority) > 0 ? <span className="row-priority priority-bars" aria-label={`Priority ${item.priority} out of 5`}>{[1, 2, 3, 4, 5].map(level => <i key={level} className={Number(item.priority) >= level ? 'is-filled' : ''} />)}</span> : null}
        <ChevronRight size={16} className="row-chevron" aria-hidden="true" />
      </button>
      <div className="place-row-actions">
        {photos > 0 && <button type="button" className="row-photos" aria-label={`${photos} photos of ${item.name}`} onClick={onPhotos}><Camera size={16} /><span>{photos}</span></button>}
        {isOwner ? <button type="button" className={`row-visit ${visited ? 'is-visited' : ''}`} aria-label={`Mark ${item.name} as ${visited ? 'to do' : 'visited'}`} aria-pressed={visited} onClick={() => onUpdate({ status: visited ? 'To Do' : 'Visited' })}>{visited ? <Check size={17} /> : <span className="visit-circle" />}</button> : <span className={`row-visit readonly ${visited ? 'is-visited' : ''}`} aria-label={visited ? 'Visited' : 'To do'}>{visited ? <Check size={17} /> : <span className="visit-circle" />}</span>}
      </div>
    </article>
  );
}
