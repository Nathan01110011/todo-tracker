import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { CalendarDays, CheckCircle2, ChevronDown, ExternalLink, MapPin, Plus, Search, Sparkles } from 'lucide-react';
import { austinToday, austinTimestamp, austinDateParts, experienceCategories, filterExperiences, interests, isUpcomingSession, offeringStatuses, priceLabel, safeUrl, sessionDisplayStatus, sessionStatuses, type ExperienceFilters, type ExperienceKind, type ExperienceRecord, type Experiences, type Offering, type Session } from '../lib/experiences';
import '../experiences.css';

type Mutation = { action: 'save' | 'delete' | 'import' | 'linkDiary'; kind?: ExperienceKind; record?: Partial<ExperienceRecord>; diaryEntryId?: string };
interface Props { data: Experiences; password: string | null; isOwner: boolean; loading: boolean; diaryEntries: Array<{ id: string; title: string; date: string }>; onChange: (data: Experiences) => void; onDiary: (id: string) => void }
type Editor = { kind: ExperienceKind; record: Partial<ExperienceRecord>; remove?: boolean; link?: boolean };
type Field = { key: string; label: string; type?: string; options?: readonly string[]; required?: boolean; min?: number; max?: number; hint?: string };
const fields: Record<ExperienceKind, Field[]> = {
  organisers: [
    { key:'name', label:'Venue or organiser name', required:true }, { key:'website', label:'Website', type:'url' },
    { key:'location', label:'Location / address (optional)' }, { key:'area', label:'Area', hint:'For example East Austin or Travelling / excursions.' },
    { key:'lat', label:'Latitude (optional)', type:'number', min:-90, max:90 }, { key:'lng', label:'Longitude (optional)', type:'number', min:-180, max:180 },
    { key:'categories', label:'Categories', hint:'Separate multiple categories with commas.' }, { key:'interest', label:'Interest', options:interests },
    { key:'sourceUrl', label:'Source link', type:'url' }, { key:'notes', label:'Notes', type:'textarea' },
  ],
  offerings: [
    { key:'title', label:'Offering title', required:true }, { key:'category', label:'Category', options:experienceCategories },
    { key:'description', label:'Description', type:'textarea' }, { key:'priceMin', label:'Typical minimum price (USD)', type:'number', min:0 },
    { key:'priceMax', label:'Typical maximum price (USD)', type:'number', min:0 }, { key:'status', label:'Offering status', options:offeringStatuses },
    { key:'completionCount', label:'Times completed', type:'number', min:0 }, { key:'lastCompletedDate', label:'Last completed date', type:'date' },
  ],
  sessions: [
    { key:'title', label:'Session title (optional)' }, { key:'startDate', label:'Start date (optional)', type:'date' }, { key:'startTime', label:'Start time (optional, Austin)', type:'time' },
    { key:'endDate', label:'End date (optional)', type:'date' }, { key:'endTime', label:'End time (optional, Austin)', type:'time' }, { key:'price', label:'Actual price (USD)', type:'number', min:0 },
    { key:'bookingUrl', label:'Booking / organiser URL', type:'url' }, { key:'status', label:'Session status', options:sessionStatuses },
    { key:'lastVerifiedAt', label:'Last checked (optional)', type:'date', hint:'Only set this after checking the session’s current details.' }, { key:'notes', label:'Session notes', type:'textarea' },
  ],
};
const blankRecord = (kind: ExperienceKind, parentId = ''): Partial<ExperienceRecord> => kind === 'organisers'
  ? { name:'', website:'', location:'', area:'', lat:null, lng:null, categories:[], interest:'Interested', notes:'', sourceUrl:'' }
  : kind === 'offerings' ? { organiserId:parentId, title:'', category:experienceCategories[0], description:'', priceMin:null, priceMax:null, status:'Want to try', completionCount:0, lastCompletedDate:'' }
  : { offeringId:parentId, title:'', start:'', end:'', price:null, bookingUrl:'', status:'Interested', lastVerifiedAt:'', notes:'', diaryEntryId:'' };
const labels: Record<ExperienceKind, string> = { organisers:'venue / organiser', offerings:'offering', sessions:'session' };
const dateLabel = (value: string) => !value ? 'Date to be arranged' : new Intl.DateTimeFormat('en-US', { timeZone:'America/Chicago', month:'short', day:'numeric', year:'numeric', ...(value.length > 10 ? { hour:'numeric', minute:'2-digit', timeZoneName:'short' } as const : {}) }).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value));
function External({ url, children }: { url: string; children: React.ReactNode }) { const href = safeUrl(url); return href ? <a href={href} target="_blank" rel="noopener noreferrer">{children}<ExternalLink size={13} /></a> : null; }

export default function ExperiencesPanel({ data, password, isOwner, loading, diaryEntries, onChange, onDiary }: Props) {
  const defaults: ExperienceFilters = { search:'', category:'', area:'', interest:'', maxPrice:'', upcoming:false, completed:false, radius:'', origin:null };
  const [filters, setFilters] = useState(defaults);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [locating, setLocating] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const results = useMemo(() => filterExperiences(data, filters), [data, filters]);
  const allCategories = Array.from(new Set([...experienceCategories, ...data.offerings.map(o => o.category)])).sort();
  const allAreas = Array.from(new Set(data.organisers.map(o => o.area).filter(Boolean))).sort();
  useEffect(() => {
    if (editor && isOwner) dialog.current?.showModal();
    else dialog.current?.close();
    return () => { dialog.current?.close(); };
  }, [editor, isOwner]);
  useEffect(() => { if (!isOwner) setEditor(null); }, [isOwner]);
  const edit = (next: Editor) => {
    trigger.current = document.activeElement as HTMLElement;
    setDraft({ ...next.record, categories: 'categories' in next.record ? next.record.categories?.join(', ') : '', diaryEntryId: 'diaryEntryId' in next.record ? next.record.diaryEntryId : '' });
    if (next.kind === 'sessions') {
      const session = next.record as Partial<Session>;
      const start = austinDateParts(session.start || ''), end = austinDateParts(session.end || '');
      setDraft(d => ({ ...d, startDate:start.date, startTime:start.time, endDate:end.date, endTime:end.time }));
    }
    setError(''); setEditor(next);
  };
  const close = () => { setEditor(null); setError(''); requestAnimationFrame(() => trigger.current?.focus()); };
  const mutate = async (mutation: Mutation) => {
    if (!isOwner || !password || busy) return false;
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/places', { method:'POST', headers: { 'Content-Type':'application/json', Authorization:password }, body:JSON.stringify({ type:'experience', ...mutation }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save experiences.');
      onChange(result.experiences);
      setMessage(mutation.action === 'import' ? `${result.imported} new records imported. Existing records kept.` : mutation.action === 'delete' ? 'Record removed.' : 'Saved.');
      return true;
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not save experiences.'); return false; }
    finally { setBusy(false); }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!editor) return;
    const record = { ...draft };
    delete record.categories;
    if (editor.kind === 'organisers') record.categories = String(draft.categories || '').split(',').map(s => s.trim()).filter(Boolean);
    if (editor.kind === 'sessions' && !editor.link && !editor.remove) {
      try {
        if (draft.startTime && !draft.startDate || draft.endTime && !draft.endDate) throw new Error('Add a date for each time.');
        record.start = austinTimestamp(draft.startDate || '',draft.startTime || '');
        record.end = austinTimestamp(draft.endDate || '',draft.endTime || '');
      } catch (error) { setError(error instanceof Error ? error.message : 'Invalid session dates.'); return; }
    }
    const ok = await mutate({ action:editor.remove ? 'delete' : editor.link ? 'linkDiary' : 'save', kind:editor.kind, record, ...(editor.link ? { diaryEntryId:draft.diaryEntryId } : {}) });
    if (ok) close();
  };
  const locate = () => {
    if (!navigator.geolocation) { setError('Location is not available in this browser. Use the area filter.'); return; }
    setLocating(true); setError('');
    navigator.geolocation.getCurrentPosition(position => { setFilters(f => ({ ...f, origin:{ lat:position.coords.latitude, lng:position.coords.longitude }, radius:f.radius || '10' })); setLocating(false); }, () => { setError('Could not get your location. Use the area filter or allow location access.'); setLocating(false); }, { timeout:15000 });
  };
  const filter = <K extends keyof ExperienceFilters>(key: K, value: ExperienceFilters[K]) => setFilters(current => ({ ...current, [key]:value }));
  const logCompletion = (offering: Offering) => edit({ kind:'offerings', record:{ ...offering, completionCount:offering.completionCount+1, lastCompletedDate:austinToday(), status:offering.status === 'Want to try' ? 'Tried' : offering.status } });
  const upcomingCount = data.sessions.filter(s => isUpcomingSession(s)).length;
  const nextSession = (offerings: Offering[]) => data.sessions.filter(s => offerings.some(o => o.id === s.offeringId) && isUpcomingSession(s)).sort((a,b) => a.start.localeCompare(b.start))[0];

  return <section className="experiences-panel" aria-label="Austin Experiences">
    <div className="experiences-intro">
      <div><p className="experience-eyebrow"><Sparkles size={15} /> Austin experiences</p><h2>Save the place. Try something new.</h2><p>Your venues stay on the wishlist, even when a date passes.</p></div>
      {isOwner && <div className="experience-actions"><button type="button" disabled={busy || loading} className="secondary-button" onClick={() => void mutate({ action:'import' })}>Import Austin leads</button><button type="button" disabled={busy || loading} className="primary-button" onClick={() => edit({ kind:'organisers', record:blankRecord('organisers') })}><Plus size={16} />Add venue</button></div>}
    </div>
    <p className="experience-summary">{data.organisers.length} venues · {data.offerings.length} offerings · {upcomingCount} upcoming session leads · {data.offerings.filter(o => o.completionCount > 0).length} offerings tried</p>
    <div className="experience-search"><Search size={18}/><input aria-label="Search experiences" type="search" placeholder="Search venues, offerings and sessions…" value={filters.search} onChange={e => filter('search',e.target.value)} /></div>
    <details className="experience-filters"><summary>Filter experiences<ChevronDown size={16}/></summary><div className="experience-filter-grid">
      <label>Category<select value={filters.category} onChange={e => filter('category',e.target.value)}><option value="">All categories</option>{allCategories.map(c => <option key={c}>{c}</option>)}</select></label>
      <label>Area<select value={filters.area} onChange={e => filter('area',e.target.value)}><option value="">All areas</option>{allAreas.map(a => <option key={a}>{a}</option>)}</select></label>
      <label>Interest<select value={filters.interest} onChange={e => filter('interest',e.target.value)}><option value="">All interests</option>{interests.map(s => <option key={s}>{s}</option>)}</select></label>
      <label>Maximum price (USD)<input type="number" min="0" placeholder="Any price" value={filters.maxPrice} onChange={e => filter('maxPrice',e.target.value)} /></label>
      <label>Distance from you<select value={filters.radius} onChange={e => filter('radius',e.target.value)}><option value="">Any distance</option>{[5,10,25,50,100].map(m => <option value={m} key={m}>Within {m} miles</option>)}</select></label>
      <button type="button" className="secondary-button" disabled={locating} onClick={locate}><MapPin size={15}/>{locating ? 'Locating…' : filters.origin ? 'Refresh location' : 'Use my location'}</button>
      <label className="experience-checkbox"><input type="checkbox" checked={filters.upcoming} onChange={e => filter('upcoming',e.target.checked)} />Upcoming sessions</label>
      <label className="experience-checkbox"><input type="checkbox" checked={filters.completed} onChange={e => filter('completed',e.target.checked)} />Completed offerings</label>
    </div></details>
    {filters.radius && <p className="experience-notice">{filters.origin ? 'Distance uses saved venue coordinates. Venues without coordinates are excluded.' : 'Use my location to apply a distance filter, or choose an area.'}</p>}
    <div className="experience-results"><span>{results.length} venues shown</span><button type="button" onClick={() => setFilters(defaults)}>Reset filters</button></div>
    <p className="experience-notice">Imported dates are leads. Confirm dates, price, eligibility and availability with the organiser before booking. Times use Austin time.</p>
    {message && <p role="status" className="experience-notice">{message}</p>}
    {error && !editor && <p role="alert" className="experience-error">{error}</p>}
    {loading ? <p role="status">Loading experiences…</p> : !results.length ? <div className="experience-empty"><Sparkles size={30}/><h3>{data.organisers.length ? 'No venues match these filters' : 'Your next experience starts here'}</h3><p>{data.organisers.length ? 'Try another category or reset the filters.' : isOwner ? 'Import the Austin shortlist or add a venue to start your wishlist.' : 'No experiences have been saved yet.'}</p></div> : <div className="experience-venues">{results.map(({ organiser, offerings, miles }) => {
      const next = nextSession(offerings);
      return <details className="experience-venue" key={organiser.id}>
        <summary><span className="experience-venue-icon"><MapPin size={21}/></span><span className="experience-venue-heading"><strong>{organiser.name}</strong><span>{organiser.area || 'Area to check'}{miles !== null ? ` · ${miles.toFixed(1)} mi` : ''} · {offerings.length} offerings</span>{next && <span className="experience-next"><CalendarDays size={13}/>Next: {dateLabel(next.start)}{!next.lastVerifiedAt && ' · Unverified lead'}</span>}</span><span className="experience-tag">{organiser.interest}</span><ChevronDown size={18}/></summary>
        <div className="experience-venue-body">
          <p className="experience-meta">{organiser.categories.join(' · ')}{organiser.location && ` · ${organiser.location}`}</p>
          {organiser.notes && <p className="experience-notes">{organiser.notes}</p>}
          <div className="experience-actions"><External url={organiser.website}>Organiser website</External><External url={organiser.sourceUrl}>Source</External>{isOwner && <><button type="button" className="secondary-button" onClick={() => edit({ kind:'organisers', record:organiser })}>Edit venue</button><button type="button" className="secondary-button" onClick={() => edit({ kind:'offerings', record:blankRecord('offerings',organiser.id) })}><Plus size={14}/>Add offering</button><button type="button" className="experience-delete" onClick={() => edit({ kind:'organisers', record:organiser, remove:true })}>Remove venue</button></>}</div>
          {!offerings.length && <p className="experience-meta">No offerings yet. Add something you would like to try here.</p>}
          {offerings.map(offering => {
            const sessions = data.sessions.filter(s => s.offeringId === offering.id).sort((a,b) => Number(!isUpcomingSession(a))-Number(!isUpcomingSession(b)) || (a.start || '9999').localeCompare(b.start || '9999'));
            return <details className="experience-offering" key={offering.id}>
              <summary><span className="experience-venue-heading"><strong>{offering.title}</strong><span>{offering.category} · {priceLabel(offering.priceMin, offering.priceMax)} · {sessions.length} sessions</span></span><span className="experience-tag">{offering.status}</span><ChevronDown size={16}/></summary>
              <div className="experience-offering-body">
                {offering.description && <p className="experience-notes">{offering.description}</p>}
                <p className="experience-completion"><CheckCircle2 size={15}/>{offering.completionCount ? `Completed ${offering.completionCount} time${offering.completionCount === 1 ? '' : 's'} · Last: ${dateLabel(offering.lastCompletedDate)}` : 'Not tried yet'}</p>
                {isOwner && <div className="experience-actions"><button type="button" className="secondary-button" onClick={() => logCompletion(offering)}>Log completion</button><button type="button" className="secondary-button" onClick={() => edit({ kind:'offerings', record:offering })}>Edit offering</button><button type="button" className="secondary-button" onClick={() => edit({ kind:'sessions', record:blankRecord('sessions',offering.id) })}><Plus size={14}/>Add session</button><button type="button" className="experience-delete" onClick={() => edit({ kind:'offerings', record:offering, remove:true })}>Remove offering</button></div>}
                {!sessions.length && <p className="experience-meta">No dates saved. Check the organiser for book-on-demand or future sessions.</p>}
                <div className="experience-sessions">{sessions.map(session => {
                  const linked = diaryEntries.find(d => d.id === session.diaryEntryId);
                  return <article className="experience-session" key={session.id}>
                    <div className="experience-session-head"><strong>{session.title || offering.title}</strong><span className="experience-tag">{sessionDisplayStatus(session)}</span></div>
                    <p><CalendarDays size={14}/>{dateLabel(session.start)}{session.end && ` – ${dateLabel(session.end)}`}</p>
                    <p>{priceLabel(session.price)} · {session.lastVerifiedAt ? `Last checked ${dateLabel(session.lastVerifiedAt)}` : 'Unverified lead — check details'}</p>
                    {session.notes && <p className="experience-notes">{session.notes}</p>}
                    <div className="experience-actions"><External url={session.bookingUrl}>Check session / booking</External>{isOwner && <><button type="button" className="secondary-button" onClick={() => edit({ kind:'sessions', record:session })}>Edit session</button><button type="button" className="experience-delete" onClick={() => edit({ kind:'sessions', record:session, remove:true })}>Remove session</button>{session.status === 'Attended' && <button type="button" className="secondary-button" onClick={() => edit({ kind:'sessions', record:session, link:true })}>{linked ? 'Change Diary link' : 'Link Diary entry'}</button>}</>}{linked ? <button type="button" className="secondary-button" onClick={() => onDiary(linked.id)}>Diary: {linked.title}</button> : session.diaryEntryId && <span className="experience-meta">Linked Diary entry was removed.</span>}</div>
                  </article>;
                })}</div>
              </div>
            </details>;
          })}
        </div>
      </details>;
    })}</div>}
    <dialog ref={dialog} className="experience-dialog" aria-labelledby="experience-dialog-title" onCancel={event => { if (busy) event.preventDefault(); else close(); }}>
      {editor && <form onSubmit={submit}>
        <div className="experience-dialog-heading"><h2 id="experience-dialog-title">{editor.remove ? 'Remove' : editor.link ? 'Link Diary entry to' : editor.record.id ? 'Edit' : 'Add'} {labels[editor.kind]}</h2><button type="button" className="secondary-button" disabled={busy} onClick={close}>Close</button></div>
        {editor.remove ? <p>Remove this {labels[editor.kind]}? {editor.kind !== 'sessions' && 'Remove its child records first.'} Your other records will stay saved.</p> : editor.link ? <label>Diary entry<select aria-label="Diary entry" value={draft.diaryEntryId || ''} onChange={e => setDraft(d => ({ ...d, diaryEntryId:e.target.value }))}><option value="">No linked entry</option>{diaryEntries.slice().sort((a,b) => b.date.localeCompare(a.date)).map(d => <option value={d.id} key={d.id}>{d.date} — {d.title}</option>)}</select><small>Save an entry in Diary first, then choose it here.</small></label> : <>
          <p className="experience-meta">{editor.kind === 'offerings' ? 'Completion is tracked here, separately from session attendance. Leave unknown prices blank.' : editor.kind === 'sessions' ? 'Sessions can be undated. Attended records attendance; use Log completion on the offering to record trying it. Leave unknown prices blank.' : 'Keep this venue on your wishlist across future sessions.'}</p>
          <div className="experience-editor-fields">{fields[editor.kind].map(field => <label key={field.key}>{field.label}{field.options ? <select aria-label={field.label} required value={draft[field.key] ?? field.options[0]} onChange={e => setDraft(d => ({ ...d, [field.key]:e.target.value }))}>{Array.from(new Set([...field.options, ...(draft[field.key] ? [draft[field.key]] : [])])).map(option => <option key={option}>{option}</option>)}</select> : field.type === 'textarea' ? <textarea aria-label={field.label} maxLength={6000} value={draft[field.key] || ''} onChange={e => setDraft(d => ({ ...d, [field.key]:e.target.value }))}/> : <input aria-label={field.label} required={field.required} maxLength={6000} type={field.type || 'text'} min={field.min} max={field.max ?? (['lastCompletedDate','lastVerifiedAt'].includes(field.key) ? austinToday() : undefined)} step={field.key === 'completionCount' ? 1 : 'any'} value={field.key === 'lastVerifiedAt' ? (draft[field.key] || '').slice(0,10) : draft[field.key] ?? ''} onChange={e => setDraft(d => ({ ...d, [field.key]:e.target.value }))}/>} {field.hint && <small>{field.hint}</small>}</label>)}</div>
        </>}
        {error && <p role="alert" className="experience-error">{error}</p>}
        <div className="experience-dialog-footer"><button type="button" disabled={busy} className="secondary-button" onClick={close}>Cancel</button><button type="submit" disabled={busy} className="primary-button">{busy ? 'Saving…' : editor.remove ? 'Remove record' : 'Save'}</button></div>
      </form>}
    </dialog>
  </section>;
}
