import { useEffect, useState } from 'react';
import { RotateCcw, Star } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { Place } from '../types';

interface Props { item: Place; isOwner: boolean; onUpdate: (updates: Partial<Place>) => void }

export default function PlaceFields({ item, isOwner, onUpdate }: Props) {
  const visited = item.status === 'Visited';
  const wouldReturn = item.return === true || item.return === 'TRUE';
  const [notes, setNotes] = useState(item.notes || '');
  useEffect(() => { setNotes(item.notes || ''); }, [item.notes]);
  return (
    <div className="place-details">
      <div className="place-fields">
        <label className="place-field"><span>Priority</span><select aria-label={`Priority for ${item.name}`} value={item.priority || ''} disabled={!isOwner} onChange={event => onUpdate({ priority: event.target.value })}><option value="">Not set</option>{[1, 2, 3, 4, 5].map(level => <option key={level} value={level}>{level} / 5{level === 1 ? ' · Low' : level === 5 ? ' · High' : ''}</option>)}</select></label>
        {visited && <div className="place-field"><span>Rating</span><div className="place-rating">{[1, 2, 3, 4, 5].map(level => <button key={level} type="button" disabled={!isOwner} aria-label={`Rate ${item.name} ${level} out of 5`} aria-pressed={Number(item.rating) === level} onClick={() => onUpdate({ rating: String(level) })}><Star size={19} fill={Number(item.rating) >= level ? 'currentColor' : 'none'} className={Number(item.rating) >= level ? 'is-rated' : ''} /></button>)}</div></div>}
        {visited && <label className="place-field"><span>Date visited</span>{isOwner ? <input type="date" aria-label={`Date visited for ${item.name}`} value={item.date || ''} onChange={event => onUpdate({ date: event.target.value })} /> : <span className="readonly-date">{item.date ? format(parseISO(item.date), 'd MMM yyyy') : 'Not recorded'}</span>}</label>}
      </div>
      {(isOwner || item.notes) && <label className="place-field"><span>Notes{isOwner && <small>Saved when you leave this field</small>}</span><textarea aria-label={`Notes for ${item.name}`} readOnly={!isOwner} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Anything worth remembering…" onBlur={() => { if (isOwner && notes !== (item.notes || '')) onUpdate({ notes }); }} /></label>}
      {visited && <button type="button" className={`return-toggle ${wouldReturn ? 'is-active' : ''}`} disabled={!isOwner} aria-pressed={wouldReturn} onClick={() => onUpdate({ return: !wouldReturn })}><RotateCcw size={16} />{wouldReturn ? 'Would return' : 'Would you return?'}</button>}
    </div>
  );
}
