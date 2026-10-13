import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

interface CustomSelectProps {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  getOptionLabel?: (value: string) => string;
  placeholder?: string;
  disabled?: boolean;
}

export default function CustomSelect({ label, value, options, onChange, getOptionLabel = option => option, placeholder, disabled = false }: CustomSelectProps) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const search = useRef({ text: '', time: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 0, maxHeight: 240 });

  useLayoutEffect(() => {
    if (!open) return;
    const reposition = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const below = window.innerHeight - rect.bottom - 16;
      const above = rect.top - 16;
      const upward = below < Math.min(240, options.length * 44 + 10) && above > below;
      const maxHeight = Math.max(44, Math.min(240, upward ? above : below));
      const height = Math.min(maxHeight, menu.current?.scrollHeight ?? maxHeight);
      const width = Math.min(Math.max(rect.width, 220), window.innerWidth - 24);
      setPosition({
        left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        top: upward ? rect.top - height - 8 : rect.bottom + 8,
        width,
        maxHeight,
      });
    };
    reposition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!trigger.current?.contains(target) && !menu.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);

  useEffect(() => {
    if (open) menu.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const show = () => {
    setActive(Math.max(0, options.indexOf(value)));
    search.current = { text: '', time: 0 };
    setOpen(true);
  };
  const choose = (option: string) => {
    onChange(option);
    setOpen(false);
    trigger.current?.focus();
  };

  return <>
    <button
      ref={trigger}
      type="button"
      disabled={disabled || options.length === 0}
      role="combobox"
      aria-label={label}
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-controls={open ? id : undefined}
      aria-activedescendant={open ? `${id}-${active}` : undefined}
      onBlur={() => setOpen(false)}
      onClick={() => open ? setOpen(false) : show()}
      onKeyDown={event => {
        if (event.key === 'Escape' && open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          if (!open) show();
          else setActive(index => (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
        } else if (event.key === 'Home' || event.key === 'End') {
          event.preventDefault();
          setOpen(true);
          setActive(event.key === 'Home' ? 0 : options.length - 1);
        } else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          if (open) choose(options[active]);
          else show();
        } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault();
          if (!open) show();
          const now = Date.now();
          const text = (now - search.current.time < 700 ? search.current.text : '') + event.key.toLowerCase();
          search.current = { text, time: now };
          const index = options.findIndex(option => getOptionLabel(option).toLowerCase().startsWith(text));
          if (index >= 0) setActive(index);
        }
      }}
      className="custom-select-trigger"
    >
      <span>{options.includes(value) ? getOptionLabel(value) : placeholder || value}</span>
      <ChevronDown size={16} className={open ? 'is-open' : ''} />
    </button>
    {open && createPortal(
      <div ref={menu} id={id} role="listbox" aria-label={label}
        className="custom-select-menu"
        style={position}
        onMouseDown={event => event.preventDefault()}
      >
        {options.map((option, index) => <div
          key={option} id={`${id}-${index}`} role="option" aria-selected={option === value}
          onPointerMove={() => setActive(index)}
          onClick={event => { event.stopPropagation(); choose(option); }}
          className={`custom-select-option ${index === active ? 'is-active' : ''} ${option === value ? 'is-selected' : ''}`}
        >
          {getOptionLabel(option)}{option === value && <Check size={16} />}
        </div>)}
      </div>, document.body
    )}
  </>;
}
