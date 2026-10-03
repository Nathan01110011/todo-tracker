import { ArrowLeft, MapPin, Camera, Pencil, Trash2, Calendar, Check } from 'lucide-react';
import type { Place } from '../types';
import { photoCount } from '../lib/collection';
import PlaceFields from './PlaceFields';

interface Props {
  item: Place;
  isOwner: boolean;
  eventDates?: string;
  error?: string | null;
  onClose: () => void;
  onLocate: () => void;
  onUpdate: (updates: Partial<Place>) => void;
  onEdit: () => void;
  onDelete: () => void;
  onPhotos: () => void;
}

export default function PlaceDetailsPanel({ item, isOwner, eventDates, error, onClose, onLocate, onUpdate, onEdit, onDelete, onPhotos }: Props) {
  const photos = photoCount(item);
  const visited = item.status === 'Visited';
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="place-panel-heading" className="place-panel-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="place-panel">
        <header className="place-panel-header"><button type="button" onClick={onClose}><ArrowLeft size={18} />Back to list</button><span>{item.scope}</span></header>
        <div className="place-panel-body">
          {error && <p role="alert" className="place-panel-error">{error}</p>}
          <div className="place-panel-category"><span>{item.category || (item.type === 'hotel' ? 'Hotels' : 'Other')}</span>{isOwner ? <button type="button" className={visited ? 'is-visited' : ''} aria-label={`Mark ${item.name} as ${visited ? 'to do' : 'visited'}`} aria-pressed={visited} onClick={() => onUpdate({ status: visited ? 'To Do' : 'Visited' })}>{visited && <Check size={15} />}{visited ? 'Visited' : 'To do'}</button> : <span>{visited ? 'Visited' : 'To do'}</span>}</div>
          <h2 id="place-panel-heading">{item.name}</h2>
          <p className="place-panel-address">{item.address || 'No address recorded'}</p>
          {item.details && <p className="place-panel-description">{item.details}</p>}
          {eventDates && <p className="place-event"><Calendar size={15} />{eventDates}</p>}
          <PlaceFields item={item} isOwner={isOwner} onUpdate={onUpdate} />
          {isOwner && <div className="place-actions"><button type="button" onClick={onEdit}><Pencil size={16} />Edit place</button><button type="button" className="delete-action" onClick={onDelete}><Trash2 size={16} />Delete place</button></div>}
        </div>
        <footer className="place-panel-footer"><button type="button" className="secondary-button" onClick={onLocate}><MapPin size={17} />Show on map</button>{(isOwner || photos > 0) && <button type="button" className="primary-button" onClick={onPhotos}><Camera size={17} />{photos > 0 ? `Photos (${photos})` : 'Add photos'}</button>}</footer>
      </section>
    </div>
  );
}
