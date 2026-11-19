import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { addDays, addMonths, format, isValid, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import './SiteControls.css';

type Change = (event: { target: { value: string } }) => void;
type Common = { value?: string | number; defaultValue?: string | number; onChange?: Change; disabled?: boolean; required?: boolean; className?: string; 'aria-label'?: string; name?: string; id?: string };
type Option = { value: string; label: React.ReactNode; disabled?: boolean };

function Popup({ children, label, display, icon, disabled, className, wide = false, id }: {
  children: (close: () => void) => React.ReactNode; label: string; display: React.ReactNode; icon: React.ReactNode; disabled?: boolean; className?: string; wide?: boolean; id?: string;
}) {
  const uid = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 8, top: 8, width: 260, maxHeight: 300 });
  const close = () => { setOpen(false); trigger.current?.focus(); };
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(window.innerWidth - 16, Math.max(rect.width, wide ? 310 : 200));
      const below = window.innerHeight - rect.bottom - 8;
      const above = rect.top - 8;
      const height = Math.min(panel.current?.scrollHeight || 320, 420);
      const upward = below < Math.min(height, 240) && above > below;
      const maxHeight = Math.max(60, Math.min(420, upward ? above - 6 : below - 6));
      setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)), top: upward ? Math.max(8, rect.top - Math.min(height, maxHeight) - 6) : rect.bottom + 6, width, maxHeight });
    };
    place();
    panel.current?.querySelector<HTMLElement>('[data-initial-focus], button:not(:disabled), input')?.focus({ preventScroll: true });
    const onPointer = (e: PointerEvent) => {
      if (!trigger.current?.contains(e.target as Node) && !panel.current?.contains(e.target as Node)) setOpen(false);
    };
    const onScroll = (e: Event) => { if (!panel.current?.contains(e.target as Node)) place(); };
    document.addEventListener('pointerdown', onPointer);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', onScroll, true);
    return () => { document.removeEventListener('pointerdown', onPointer); window.removeEventListener('resize', place); window.removeEventListener('scroll', onScroll, true); };
  }, [open, wide]);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  return <span className="site-control">
    <button id={id} ref={trigger} type="button" className={'site-control-trigger ' + (className || '')} disabled={disabled} aria-label={label + ': ' + (typeof display === 'string' ? display : '')} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? uid : undefined} onClick={() => setOpen(v => !v)}><span>{display}</span>{icon}</button>
    {open && createPortal(<div id={uid} ref={panel} role="dialog" aria-label={label} className="site-control-popover" style={position} onKeyDown={e => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
      if (e.key === 'Tab') {
        // Keep the temporary dialog keyboard-accessible; Escape returns to the trigger.
        const nodes = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]') || []);
        if (nodes.length && ((e.shiftKey && document.activeElement === nodes[0]) || (!e.shiftKey && document.activeElement === nodes[nodes.length - 1]))) { e.preventDefault(); (e.shiftKey ? nodes[nodes.length - 1] : nodes[0]).focus(); }
      }
    }}>{children(close)}</div>, document.body)}
  </span>;
}

function optionsFrom(children: React.ReactNode): Option[] {
  return React.Children.toArray(children).flatMap(child => {
    if (!React.isValidElement(child)) return [];
    const props = child.props as { value?: string | number; children?: React.ReactNode; disabled?: boolean };
    if (child.type !== 'option') return optionsFrom(props.children);
    return [{ value: String(props.value ?? props.children ?? ''), label: props.children, disabled: props.disabled }];
  });
}

export function SiteSelect({ children, value, defaultValue, onChange, disabled, required, className, name, id, 'aria-label': ariaLabel }: Common & { children?: React.ReactNode }) {
  const opts = optionsFrom(children);
  const selected = String(value ?? defaultValue ?? opts[0]?.value ?? '');
  const [query, setQuery] = useState('');
  const label = ariaLabel || 'Choose option';
  return <Popup label={label} id={id} disabled={disabled} className={className} display={opts.find(o => o.value === selected)?.label ?? selected ?? 'Choose'} icon={<ChevronDown size={16} />}>
    {close => <div className="site-options">
      {opts.length > 12 && <input type="search" aria-label={'Search ' + label} placeholder="Filter options…" value={query} onChange={e => setQuery(e.target.value)} data-initial-focus />}
      <div role="group" aria-label="Options" onKeyDown={e => {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        if (!buttons.length) return;
        e.preventDefault(); buttons[(index + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
      }}>
      {opts.filter(o => !query || (String(o.label) + ' ' + o.value).toLowerCase().includes(query.toLowerCase())).map(o => <button key={o.value} type="button" disabled={o.disabled} aria-pressed={o.value === selected} className={o.value === selected ? 'is-selected' : ''} onClick={() => { onChange?.({ target: { value: o.value } }); setQuery(''); close(); }}><span>{o.label}</span>{o.value === selected && <Check size={16} />}</button>)}
      </div>
    </div>}
  </Popup>;
}

type DateProps = Common & { min?: string | number; max?: string | number };
function CalendarBody({ value, min, max, choose, close, required }: {value: string; min?: string; max?: string; choose: (date: string) => void; close: () => void; required?: boolean}) {
  const parsed = parseISO(value);
  const [month, setMonth] = useState(() => startOfMonth(isValid(parsed) ? parsed : new Date()));
  const [jump, setJump] = useState(false);
  const first = startOfWeek(month, { weekStartsOn: 1 });
  const today = format(new Date(), 'yyyy-MM-dd');
  const valid = (date: string) => (!min || date >= min) && (!max || date <= max);
  function pick(date: string) { choose(date); close(); }
  return <div className="site-calendar">
    <div className="site-calendar-head"><button type="button" aria-label="Previous month" onClick={() => setMonth(m => addMonths(m,-1))}><ChevronLeft size={19}/></button><button type="button" className="site-calendar-month" onClick={() => setJump(v => !v)} aria-expanded={jump}>{format(month,'MMMM yyyy')} <ChevronDown size={14}/></button><button type="button" aria-label="Next month" onClick={() => setMonth(m => addMonths(m,1))}><ChevronRight size={19}/></button></div>
    {jump ? <div><div className="site-calendar-head"><button type="button" aria-label="Previous year" onClick={() => setMonth(m=>addMonths(m,-12))}><ChevronLeft size={18}/></button><strong>{format(month,'yyyy')}</strong><button type="button" aria-label="Next year" onClick={() => setMonth(m=>addMonths(m,12))}><ChevronRight size={18}/></button></div><div className="site-month-grid">{Array.from({length:12},(_,i)=>{const day = addMonths(month,i-month.getMonth());return <button type="button" key={i} className={i===month.getMonth()?'is-selected':''} onClick={()=>{setMonth(day);setJump(false);}}>{format(day,'MMM')}</button>;})}</div></div> :
    <><div className="site-calendar-grid site-calendar-week">{['Mo','Tu','We','Th','Fr','Sa','Su'].map(d=><span key={d}>{d}</span>)}</div><div className="site-calendar-grid">{Array.from({length:42},(_,i)=>{ const day=addDays(first,i);const iso=format(day,'yyyy-MM-dd');return <button type="button" key={iso} aria-label={format(day,'EEEE, d MMMM yyyy')} aria-pressed={iso===value} aria-current={iso===today?'date':undefined} disabled={!valid(iso)} className={[day.getMonth()!==month.getMonth()?'is-outside':'',iso===value?'is-selected':'',iso===today?'is-today':''].join(' ')} onClick={()=>pick(iso)}>{day.getDate()}</button>; })}</div></>}
    <div className="site-calendar-footer">{!required && <button type="button" onClick={()=>pick('')}>Clear</button>}<button type="button" disabled={!valid(today)} onClick={()=>pick(today)}>Today</button></div>
  </div>;
}

export function SiteDate({ value, onChange, min, max, required, disabled, className, id, 'aria-label': ariaLabel }: DateProps) {
  const date = String(value || '');
  const parsed = parseISO(date);
  return <Popup label={ariaLabel || 'Choose date'} id={id} disabled={disabled} className={className} display={isValid(parsed) ? format(parsed,'d MMM yyyy') : 'Choose date'} icon={<CalendarDays size={17}/>} wide>{close=><CalendarBody value={date} min={min == null ? undefined : String(min)} max={max == null ? undefined : String(max)} required={required} choose={v=>onChange?.({target:{value:v}})} close={close}/>}</Popup>;
}

function TimeBody({ value, choose, close, required }: {value:string;choose:(v:string)=>void;close:()=>void;required?:boolean}) {
  const [hour,setHour]=useState(value.slice(0,2)||'12');
  const [minute,setMinute]=useState(value.slice(3,5)||'00');
  return <div className="site-time"><div className="site-time-columns"><div><strong>Hour (24h)</strong><div>{Array.from({length:24},(_,i)=>String(i).padStart(2,'0')).map(v=><button key={v} type="button" aria-pressed={hour===v} className={hour===v?'is-selected':''} onClick={()=>setHour(v)}>{v}</button>)}</div></div><div><strong>Minute</strong><div>{Array.from({length:60},(_,i)=>String(i).padStart(2,'0')).map(v=><button key={v} type="button" aria-pressed={minute===v} className={minute===v?'is-selected':''} onClick={()=>setMinute(v)}>{v}</button>)}</div></div></div><div className="site-calendar-footer">{!required&&<button type="button" onClick={()=>{choose('');close();}}>Clear</button>}<button type="button" className="site-time-save" onClick={()=>{choose(hour+':'+minute);close();}}>Set {hour}:{minute}</button></div></div>;
}

export function SiteInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const {type,value,onChange,min,max,required,disabled,className,id,'aria-label':label}=props;
  const emit: Change = e => onChange?.(e as unknown as React.ChangeEvent<HTMLInputElement>);
  if(type==='date') return <SiteDate value={String(value||'')} onChange={emit} min={min} max={max} required={required} disabled={disabled} className={className} id={id} aria-label={label}/>;
  if(type==='time') return <Popup label={label||'Choose time'} display={String(value||'Choose time')} icon={<Clock size={17}/>} disabled={disabled} className={className} id={id} wide>{close=><TimeBody value={String(value||'')} choose={v=>emit({target:{value:v}})} close={close} required={required}/>}</Popup>;
  return <input {...props}/>;
}
