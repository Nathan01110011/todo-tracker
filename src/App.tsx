import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import 'leaflet/dist/leaflet.css';
import TrackerNavigation, { type TrackerSection } from './components/TrackerNavigation';
import PlaceCard from './components/PlaceCard';
import type { Place, PhotoDetails } from './types';
import {
  Check, CheckCircle2, Circle, Map as MapIcon, List, Filter, Home, Briefcase,
  MapPin, Search, Star, X, Plus, Save, Loader2, Bed, RotateCcw,
  Lock, LogIn, LogOut, Eye, Info, Trophy, Camera, Upload, Image as ImageIcon,
  Maximize2, ChevronLeft, ChevronRight, Calendar, Route as RouteIcon,
  Navigation, Trash2, CheckSquare, Pencil, Moon, Sun, BookOpen, LocateFixed, Settings, Columns2, ChevronDown
} from 'lucide-react';
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays,
  parseISO
} from 'date-fns';

// Fix for default marker icons
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Custom Icons for Markers
const createCustomIcon = (IconComponent: any, color: string) => {
  return L.divIcon({
    html: renderToStaticMarkup(
      <div style={{ color }} className="bg-white rounded-full shadow-md border-2 border-current flex items-center justify-center w-[30px] h-[30px]">
        <IconComponent size={18} />
      </div>
    ),
    className: 'custom-leaflet-icon',
    iconSize: [30, 30],
    iconAnchor: [15, 30],
  });
};

const homeIcon = createCustomIcon(Home, '#0f766e'); // Indigo
const officeIcon = createCustomIcon(Briefcase, '#0891b2'); // Cyan
const hotelMarkerIcon = createCustomIcon(Bed, '#2563eb'); // Violet
const defaultPinIcon = createCustomIcon(MapPin, '#64748b'); // Slate

// Types
interface MarkerData {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  type: string;
  notes: string;
  scope: string;
}

interface Route {
  id: string;
  name: string;
  placeIds: string[];
  scope: string;
  tripType: 'ordered' | 'unordered';
  completedPlaceIds: string[];
  status: 'planned' | 'active' | 'completed';
}

interface DiaryEntry {
  id: string;
  date: string;
  title: string;
  notes: string;
  placeId: string;
  placeType: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  scope: string;
  createdAt: string;
}

const SCOPE_CONFIG = {
  Austin: {
    label: 'Austin',
    center: [30.2672, -97.7431] as [number, number],
    zoom: 12,
    searchParams: '&viewbox=-98.3,30.7,-97.2,29.8&bounded=1'
  },
  Texas: {
    label: 'Texas',
    center: [31.0, -99.9018] as [number, number],
    zoom: 6,
    searchParams: '&viewbox=-106.65,36.5,-93.51,25.84&bounded=1'
  },
  USA: {
    label: 'USA',
    center: [37.0902, -95.7129] as [number, number],
    zoom: 4,
    searchParams: ''
  },
  'UK & Ireland': {
    label: 'UK & Ireland',
    center: [54.5, -4.5] as [number, number],
    zoom: 5,
    searchParams: '&viewbox=-11,61.2,2.2,49.8&bounded=1'
  }
};

type ScopeName = keyof typeof SCOPE_CONFIG;
const SCOPE_NAMES = Object.keys(SCOPE_CONFIG) as ScopeName[];

const OPENSTREETMAP_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const cartoApiKey = import.meta.env.VITE_CARTO_API_KEY?.trim();
const DARK_MAP_TILE_URL = cartoApiKey
  ? `https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=${encodeURIComponent(cartoApiKey)}`
  : OPENSTREETMAP_TILE_URL;

// Map Controller Component
const MapController = ({ center, zoom, sidebarWidth, windowWidth, view, bounds }: any) => {
  const map = useMap();
  const lastCenterRef = useRef<string | null>(null);
  const lastBoundsRef = useRef<string | null>(null);

  useEffect(() => {
    if (bounds && Array.isArray(bounds) && bounds.length === 2) {
      const boundsKey = JSON.stringify(bounds);
      if (lastBoundsRef.current === boundsKey) return;
      lastBoundsRef.current = boundsKey;
      try {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16, animate: true });
      } catch (e) {}
      return;
    }

    if (!center || !Array.isArray(center) || center.length !== 2) return;
    const lat = parseFloat(center[0]);
    const lng = parseFloat(center[1]);
    if (isNaN(lat) || isNaN(lng)) return;
    const centerKey = `${lat},${lng}`;
    if (lastCenterRef.current === centerKey) return;
    lastCenterRef.current = centerKey;
    try {
      const size = map.getSize();
      if (size.x === 0 || size.y === 0) {
        map.invalidateSize();
        setTimeout(() => {
          map.flyTo([lat, lng], zoom || map.getZoom() || 12, { duration: 1 });
        }, 100);
      } else {
        map.flyTo([lat, lng], zoom || map.getZoom() || 12, { duration: 1 });
      }
    } catch (e) {
      console.warn("Map movement prevented:", e);
    }
  }, [center, zoom, bounds, map]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        map.invalidateSize({ animate: true });
      } catch (e) {}
    }, 250);
    return () => clearTimeout(timer);
  }, [map, sidebarWidth, windowWidth, view]);

  return null;
};

// Toast Component
const Toast = ({ message, onClose }: { message: string, onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000); // Toast disappears after 3 seconds
    return () => clearTimeout(timer);
  }, [onClose]);

  if (!message) return null;

  return (
    <div role="status" className="tracker-toast fixed left-1/2 -translate-x-1/2 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-lg z-[500] animate-in fade-in slide-in-from-bottom-2 duration-300">
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
};

// Confirmation Dialog Component
const ConfirmationDialog = ({ message, onConfirm, onCancel }: { message: string, onConfirm: () => void, onCancel: () => void }) => {
  return (
    <div role="alertdialog" aria-modal="true" aria-label="Confirm change" className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[600] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm text-center animate-in zoom-in-90 duration-300">
        <p className="text-lg font-semibold text-slate-800 mb-6">{message}</p>
        <div className="flex gap-3 justify-center">
          <button onClick={onCancel} className="px-5 py-2 rounded-lg text-slate-600 border border-slate-300 hover:bg-slate-50 transition-colors">Cancel</button>
          <button onClick={onConfirm} className="px-5 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors">Confirm</button>
        </div>
      </div>
    </div>
  );
};

const formatEventDateRange = (startDate?: string, endDate?: string) => {
  if (!startDate) return '';
  const start = format(parseISO(startDate), 'd MMM yyyy');
  if (!endDate || endDate === startDate) return start;
  return `${start} – ${format(parseISO(endDate), 'd MMM yyyy')}`;
};

const EventDateDialog = ({ placeName, isAdding, onConfirm, onCancel }: {
  placeName: string;
  isAdding: boolean;
  onConfirm: (startDate: string, endDate: string) => void;
  onCancel: () => void;
}) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const invalidRange = Boolean(startDate && endDate && endDate < startDate);

  return (
    <div role="dialog" aria-modal="true" aria-label="Event dates" className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (startDate && !invalidRange) onConfirm(startDate, endDate);
        }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200"
      >
        <div className="p-5 border-b border-slate-100">
          <h3 className="font-bold text-lg text-slate-900">Event dates</h3>
          <p className="text-xs text-slate-500 mt-1 truncate">{placeName}</p>
        </div>
        <div className="p-5 space-y-4">
          <label className="block space-y-1">
            <span className="text-xs font-bold tracking-wide text-slate-400">Start date</span>
            <input required type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); if (endDate && event.target.value > endDate) setEndDate(''); }} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-bold tracking-wide text-slate-400">End date <span className="normal-case font-medium">(optional)</span></span>
            <input type="date" min={startDate || undefined} value={endDate} onChange={(event) => setEndDate(event.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
          </label>
          <p className="text-xs text-slate-400">Leave the end date blank for a single-day event.</p>
        </div>
        <div className="p-5 border-t bg-slate-50 flex justify-end gap-2">
          <button type="button" disabled={isAdding} onClick={onCancel} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-white font-bold text-xs disabled:opacity-50">Back</button>
          <button type="submit" disabled={!startDate || invalidRange || isAdding} className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 font-bold text-xs flex items-center gap-2 disabled:opacity-50">
            {isAdding && <Loader2 size={14} className="animate-spin" />} Add Event
          </button>
        </div>
      </form>
    </div>
  );
};

const EditLocationModal = ({ item, onSave, onDelete, onClose }: { item: Place, onSave: (id: string, data: any, type: 'place' | 'hotel') => void, onDelete: (item: Place) => void, onClose: () => void }) => {
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState(item.category || 'Other');
  const [address, setAddress] = useState(item.address);
  const [lat, setLat] = useState(String(item.lat));
  const [lng, setLng] = useState(String(item.lng));
  const [details, setDetails] = useState(item.details || '');
  const [eventStartDate, setEventStartDate] = useState(item.eventStartDate || '');
  const [eventEndDate, setEventEndDate] = useState(item.eventEndDate || '');
  const isHotel = item.type === 'hotel';
  const invalidEventDates = category === 'Events' && (!eventStartDate || Boolean(eventEndDate && eventEndDate < eventStartDate));

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextLat = parseFloat(lat);
    const nextLng = parseFloat(lng);
    onSave(item.id, {
      name: name.trim() || item.name,
      category: isHotel ? 'Hotels' : category,
      address,
      lat: Number.isFinite(nextLat) ? nextLat : item.lat,
      lng: Number.isFinite(nextLng) ? nextLng : item.lng,
      details,
      eventStartDate: category === 'Events' ? eventStartDate : '',
      eventEndDate: category === 'Events' ? eventEndDate : ''
    }, item.type || 'place');
    onClose();
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Edit location" className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[550] flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92dvh] overflow-y-auto animate-in zoom-in-95 duration-200">
        <div className="p-5 border-b flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg text-slate-900">Edit Location</h3>
            <p className="text-xs text-slate-500">Adjust the saved details or remove it entirely.</p>
          </div>
          <button type="button" onClick={onClose} className="secondary-button">Close</button>
        </div>
        <div className="p-5 space-y-4">
          <label className="block space-y-1">
            <span className="text-xs font-bold tracking-wide text-slate-400">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
          </label>
          {!isHotel && (
            <label className="block space-y-1">
              <span className="text-xs font-bold tracking-wide text-slate-400">Category</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm">
                {['Food', 'Drinks', 'Activities', 'Shopping', 'Sport', 'Events', 'Other'].map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          )}
          <label className="block space-y-1">
            <span className="text-xs font-bold tracking-wide text-slate-400">Address</span>
            <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-xs font-bold tracking-wide text-slate-400">Latitude</span>
              <input value={lat} onChange={(e) => setLat(e.target.value)} inputMode="decimal" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-bold tracking-wide text-slate-400">Longitude</span>
              <input value={lng} onChange={(e) => setLng(e.target.value)} inputMode="decimal" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
            </label>
          </div>
          {!isHotel && (
            <label className="block space-y-1">
              <span className="text-xs font-bold tracking-wide text-slate-400">Details</span>
              <input value={details} onChange={(e) => setDetails(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
            </label>
          )}
          {!isHotel && category === 'Events' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-xs font-bold tracking-wide text-slate-400">Event start</span>
                <input required type="date" value={eventStartDate} onChange={(event) => { setEventStartDate(event.target.value); if (eventEndDate && event.target.value > eventEndDate) setEventEndDate(''); }} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-bold tracking-wide text-slate-400">Event end <span className="normal-case font-medium">(optional)</span></span>
                <input type="date" min={eventStartDate || undefined} value={eventEndDate} onChange={(event) => setEventEndDate(event.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
              </label>
            </div>
          )}
        </div>
        <div className="p-5 border-t bg-slate-50 flex items-center justify-between gap-3">
          <button type="button" onClick={() => onDelete(item)} className="px-4 py-2 rounded-xl text-red-600 hover:bg-red-50 font-bold text-xs flex items-center gap-2"><Trash2 size={16} /> Delete</button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-white font-bold text-xs">Cancel</button>
            <button type="submit" disabled={invalidEventDates} className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 font-bold text-xs flex items-center gap-2 disabled:opacity-50"><Save size={16} /> Save Changes</button>
          </div>
        </div>
      </form>
    </div>
  );
};

// Custom Date Picker Popover Component
const CustomDatePicker = ({ value, onChange }: { value: string, onChange: (date: string) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(value ? parseISO(value) : new Date());
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const popoverWidth = 280;

  const updatePopoverPosition = () => {
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const gap = 8;
    const left = Math.min(
      Math.max(12, rect.left),
      window.innerWidth - popoverWidth - 12
    );
    const opensUpward = rect.bottom + gap + 340 > window.innerHeight && rect.top > 340;

    setPopoverPosition({
      left,
      top: opensUpward ? rect.top - gap : rect.bottom + gap,
    });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    updatePopoverPosition();
    const handleReposition = () => updatePopoverPosition();

    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [isOpen]);

  const renderHeader = () => (
    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
      <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1.5 hover:bg-slate-50 rounded-full text-slate-400 hover:text-indigo-600 transition-colors">
        <ChevronLeft size={18} />
      </button>
      <span className="text-sm font-semibold text-slate-700 tracking-wide">
        {format(currentMonth, 'MMMM yyyy')}
      </span>
      <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1.5 hover:bg-slate-50 rounded-full text-slate-400 hover:text-indigo-600 transition-colors">
        <ChevronRight size={18} />
      </button>
    </div>
  );

  const renderDays = () => {
    const dateFormat = 'EEE';
    const days = [];
    let startDate = startOfWeek(currentMonth);
    for (let i = 0; i < 7; i++) {
      days.push(
        <div key={i} className="text-xs font-bold text-slate-400 uppercase text-center py-2">
          {format(addDays(startDate, i), dateFormat)}
        </div>
      );
    }
    return <div className="grid grid-cols-7 border-b border-slate-50">{days}</div>;
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    const rows = [];
    let days = [];
    let day = startDate;
    let formattedDate = '';

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, 'd');
        const cloneDay = day;
        const isSelected = value && isSameDay(day, parseISO(value));
        const isCurrentMonth = isSameMonth(day, monthStart);

        days.push(
          <div
            key={day.toString()}
            className={`relative py-3 flex items-center justify-center text-xs font-bold cursor-pointer transition-all
              ${!isCurrentMonth ? 'text-slate-200 pointer-events-none' : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-600'}
              ${isSelected ? 'bg-indigo-600 !text-white rounded-lg shadow-md z-10' : ''}
            `}
            onClick={() => {
              onChange(format(cloneDay, 'yyyy-MM-dd'));
              setIsOpen(false);
            }}
          >
            <span>{formattedDate}</span>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(<div className="grid grid-cols-7" key={day.toString()}>{days}</div>);
      days = [];
    }
    return <div className="p-1">{rows}</div>;
  };

  const popover = isOpen ? createPortal(
    <div
      ref={popoverRef}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="fixed w-[280px] bg-white rounded-2xl shadow-2xl border border-slate-100 z-[550] overflow-hidden"
      style={{
        left: popoverPosition.left,
        top: popoverPosition.top,
        transform: popoverPosition.top < (buttonRef.current?.getBoundingClientRect().top ?? 0) ? 'translateY(-100%)' : undefined,
      }}
    >
      {renderHeader()}
      {renderDays()}
      {renderCells()}
      <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
        <button
          onClick={() => { onChange(''); setIsOpen(false); }}
          className="text-xs font-bold text-slate-400 hover:text-red-500 tracking-wide transition-colors"
        >
          Clear Date
        </button>
        <button
          onClick={() => { onChange(format(new Date(), 'yyyy-MM-dd')); setIsOpen(false); }}
          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 tracking-wide transition-colors"
        >
          Today
        </button>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className="relative w-full">
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          updatePopoverPosition();
          setCurrentMonth(value ? parseISO(value) : new Date());
          setIsOpen(!isOpen);
        }}
        className="w-full text-xs font-semibold text-indigo-600 bg-indigo-50/50 border border-indigo-100/50 rounded-xl pl-9 pr-3 py-2.5 hover:bg-white focus:ring-2 focus:ring-indigo-500 transition-all flex items-center shadow-sm"
      >
        <Calendar size={16} className="absolute left-3 text-indigo-400" strokeWidth={2.5} />
        {value ? format(parseISO(value), 'MMM d, yyyy') : 'Pick a date'}
      </button>

      {popover}
    </div>
  );
}; // Closing CustomDatePicker

const Lightbox = ({ urls, initialIndex, onClose }: { urls: string[], initialIndex: number, onClose: () => void }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const next = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % urls.length);
  };
  const prev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + urls.length) % urls.length);
  };
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  return (
    <div role="dialog" aria-modal="true" aria-label="Photo viewer" className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[300] flex items-center justify-center" onClick={onClose}>
      <button type="button" aria-label="Close photo viewer" onClick={onClose} className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-[310]"><X size={28} /></button>
      {urls.length > 1 && (
        <>
          <button type="button" aria-label="Previous photo" onClick={prev} className="absolute left-4 top-1/2 -translate-y-1/2 p-4 bg-white/5 hover:bg-white/10 rounded-full text-white transition-all z-[310]"><ChevronLeft size={32} /></button>
          <button type="button" aria-label="Next photo" onClick={next} className="absolute right-4 top-1/2 -translate-y-1/2 p-4 bg-white/5 hover:bg-white/10 rounded-full text-white transition-all z-[310]"><ChevronRight size={32} /></button>
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/50 text-sm font-medium tracking-widest">{currentIndex + 1} / {urls.length}</div>
        </>
      )}
      <div className="w-full h-full flex items-center justify-center p-4 sm:p-12">
        <img key={currentIndex} src={urls[currentIndex]} alt={`Full size ${currentIndex + 1}`} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in fade-in zoom-in duration-300 select-none" onClick={(e) => e.stopPropagation()} />
      </div>
    </div>
  );
};

const PhotoPreviewGrid = ({ photos, onExpand }: { photos: string, onExpand: (urls: string[], index: number) => void }) => {
  const urlList = photos.split(',').filter(Boolean);
  if (urlList.length === 0) return null;
  const renderGrid = () => {
    switch (urlList.length) {
      case 1:
        return (<div onClick={() => onExpand(urlList, 0)} className="w-full rounded-xl overflow-hidden cursor-pointer border border-slate-100 hover:opacity-95 transition-all shadow-sm"><img src={urlList[0]} className="w-full h-auto max-h-64 object-cover" alt="" /></div>);
      case 2:
        return (<div className="grid grid-cols-2 gap-1.5 rounded-xl overflow-hidden shadow-sm">{urlList.map((url, i) => (<div key={i} onClick={() => onExpand(urlList, i)} className="aspect-[4/5] cursor-pointer hover:opacity-90 transition-opacity"><img src={url} className="w-full h-full object-cover" alt="" /></div>))}</div>);
      default:
        return (<div className="grid grid-cols-2 gap-1.5 rounded-xl overflow-hidden shadow-sm"><div onClick={() => onExpand(urlList, 0)} className="aspect-square cursor-pointer hover:opacity-90 transition-opacity relative"><img src={urlList[0]} className="w-full h-full object-cover" alt="" /></div><div className="grid grid-rows-2 gap-1.5"><div onClick={() => onExpand(urlList, 1)} className="aspect-video cursor-pointer hover:opacity-90 transition-opacity relative overflow-hidden"><img src={urlList[1]} className="w-full h-full object-cover" alt="" /></div><div onClick={() => onExpand(urlList, 2)} className="aspect-video cursor-pointer hover:opacity-90 transition-opacity relative overflow-hidden bg-slate-100 flex items-center justify-center"><img src={urlList[2]} className="w-full h-full object-cover" alt="" />{urlList.length > 3 && <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-xs font-bold pointer-events-none">+{urlList.length - 3}</div>}</div></div></div>);
    }
  };
  return <div className="mt-3 mb-1 shrink-0">{renderGrid()}</div>;
};

const photoDetailsFor = (item: Place): PhotoDetails[] => item.photoDetails?.length
  ? item.photoDetails
  : (item.photos || '').split(',').filter(Boolean).map(url => ({ url, comment: '', capturedAt: '', uploadedAt: '' }));

const formatPhotoTimestamp = (value: string) => {
  if (!value) return '';
  const normalized = /^\d{4}:\d{2}:\d{2} /.test(value)
    ? value.replace(/^(\d{4}):(\d{2}):(\d{2}) /, '$1-$2-$3T')
    : value;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
};

const photoCaptureDate = (value: string) => {
  if (!value) return '';
  const directMatch = value.match(/^(\d{4})[:-](\d{2})[:-](\d{2})/);
  if (directMatch) return `${directMatch[1]}-${directMatch[2]}-${directMatch[3]}`;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : format(parsed, 'yyyy-MM-dd');
};

const PhotoModal = ({ item, isOpen, onClose, onUpload, onCommentSave, onDeletePhoto, onBackfillPhotoDates, onCheckPhotoDate, appPassword, onExpand, onError }: { item: Place, isOpen: boolean, onClose: () => void, onUpload: (photo: PhotoDetails) => Promise<void>, onCommentSave: (url: string, comment: string) => Promise<void>, onDeletePhoto: (url: string) => void, onBackfillPhotoDates: () => Promise<void>, onCheckPhotoDate: (url: string) => Promise<string>, appPassword: string | null, onExpand: (urls: string[], index: number) => void, onError: (message: string) => void }) => {
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [savingCommentUrl, setSavingCommentUrl] = useState<string | null>(null);
  const [isBackfillingDates, setIsBackfillingDates] = useState(false);
  const [checkingPhotoUrl, setCheckingPhotoUrl] = useState<string | null>(null);
  const [photoCheckResults, setPhotoCheckResults] = useState<Record<string, string>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photos = useMemo(() => photoDetailsFor(item), [item.photos, item.photoDetails]);
  const photoUrls = useMemo(() => photos.map(photo => photo.url), [photos]);
  const missingCaptureDateCount = useMemo(() => photos.filter(photo => !photo.capturedAt).length, [photos]);
  const hasMissingCaptureDates = missingCaptureDateCount > 0;
  useEffect(() => {
    setCommentDrafts(Object.fromEntries(photos.map(photo => [photo.url, photo.comment])));
  }, [photos]);
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !appPassword) return;
    setUploadStatus(`Uploading ${files.length} photo${files.length > 1 ? 's' : ''}...`);
    try {
      const sigRes = await fetch('/api/photos', { headers: { 'Authorization': appPassword } });
      const sigData = await sigRes.json();
      if (!sigRes.ok) throw new Error(sigData.error || 'Failed to get signature');
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (files.length > 1) setUploadStatus(`Uploading ${i + 1}/${files.length}...`);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('api_key', sigData.apiKey);
        formData.append('timestamp', sigData.timestamp);
        formData.append('signature', sigData.signature);
        formData.append('folder', sigData.folder);
        formData.append('media_metadata', String(sigData.mediaMetadata));
        const res = await fetch(`https://api.cloudinary.com/v1_1/${sigData.cloudName}/image/upload`, { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || 'Cloudinary upload failed');
        if (data.secure_url) {
          const metadata = data.media_metadata || data.image_metadata || {};
          const capturedAt = metadata.DateTimeOriginal || metadata.DateTimeDigitized || metadata.CreateDate || metadata.DateTime || '';
          await onUpload({
            url: data.secure_url,
            comment: '',
            capturedAt: String(capturedAt),
            uploadedAt: data.created_at || new Date().toISOString(),
          });
        }
      }
    } catch (err: any) {
      console.error("Secure upload process failed:", err);
      onError(`Upload failed: ${err.message}`);
    } finally {
      setUploadStatus(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };
  if (!isOpen) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={`Photos of ${item.name}`} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-4xl h-[calc(100dvh-1rem)] sm:h-full max-h-[calc(100dvh-1rem)] sm:max-h-[90vh] min-h-0 flex flex-col overflow-hidden animate-in zoom-in duration-200">
        <div className="p-4 sm:p-6 border-b flex justify-between items-center bg-indigo-50/30 shrink-0">
          <div><h3 className="text-lg sm:text-xl font-bold text-slate-900">{item.name}</h3><p className="text-xs sm:text-sm text-slate-500 line-clamp-1">{item.address}</p></div>
          <button type="button" onClick={onClose} className="secondary-button">Close</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8">
          {photos.length === 0 ? (
            appPassword ? (
              <button
                type="button"
                disabled={!!uploadStatus}
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-64 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center gap-4 text-slate-400 bg-slate-50/50 hover:border-indigo-300 hover:bg-indigo-50/40 hover:text-indigo-500 active:scale-[0.99] transition-all disabled:opacity-50"
              >
                {uploadStatus ? <Loader2 size={48} strokeWidth={1.5} className="animate-spin" /> : <Upload size={48} strokeWidth={1.5} />}
                <div className="text-center">
                  <p className="text-sm font-bold">{uploadStatus || 'Add photos'}</p>
                  {!uploadStatus && <p className="text-xs font-medium mt-1">Tap here to upload the first photos for this visit.</p>}
                </div>
              </button>
            ) : (
              <div className="h-64 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center gap-4 text-slate-400 bg-slate-50/50"><ImageIcon size={48} strokeWidth={1.5} /><p className="text-sm font-medium">No photos yet for this visit.</p></div>
            )
          ) : (
            <div className="flex flex-col gap-10">
              {photos.map((photo, i) => {
                const timestamp = formatPhotoTimestamp(photo.capturedAt);
                const draft = commentDrafts[photo.url] ?? photo.comment;
                return (
                <div key={photo.url} className={`w-full rounded-2xl sm:rounded-3xl overflow-hidden shadow-lg border bg-white ${photo.capturedAt ? 'border-slate-100' : 'border-amber-400 ring-2 ring-amber-100'}`}>
                  <div onClick={() => onExpand(photoUrls, i)} className="group relative cursor-pointer bg-slate-50 flex items-center justify-center min-h-[300px]">
                    {!photo.capturedAt && (
                      <div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-xs font-extrabold shadow-sm">
                        Missing taken date
                      </div>
                    )}
                    <img src={photo.url} alt={photo.comment || `Visit ${i+1}`} className="w-full h-auto max-h-[75vh] block object-contain" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="bg-white/30 backdrop-blur-md p-4 rounded-full text-white shadow-xl"><Maximize2 size={32} strokeWidth={2.5} /></div>
                    </div>
                  </div>
                  <div className="p-4 sm:p-5 space-y-3">
                    {timestamp && <p className="text-xs font-semibold text-slate-500">Taken {timestamp}</p>}
                    {appPassword && !photo.capturedAt && (
                      <div className="space-y-1">
                        <button
                          disabled={checkingPhotoUrl === photo.url}
                          onClick={async () => {
                            setCheckingPhotoUrl(photo.url);
                            try {
                              const result = await onCheckPhotoDate(photo.url);
                              setPhotoCheckResults(current => ({ ...current, [photo.url]: result }));
                            } catch (error: any) {
                              setPhotoCheckResults(current => ({ ...current, [photo.url]: error.message || 'Check failed.' }));
                            } finally {
                              setCheckingPhotoUrl(null);
                            }
                          }}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                        >
                          {checkingPhotoUrl === photo.url ? 'Checking EXIF…' : 'Check EXIF for this photo'}
                        </button>
                        {photoCheckResults[photo.url] && <p className="text-xs text-slate-500 break-words">{photoCheckResults[photo.url]}</p>}
                      </div>
                    )}
                    {appPassword ? <>
                      <textarea
                        value={draft}
                        maxLength={280}
                        onChange={event => setCommentDrafts(current => ({ ...current, [photo.url]: event.target.value }))}
                        placeholder="What did you order, or what do you want to remember?"
                        className="w-full min-h-20 resize-y px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-bold text-slate-400">{draft.length}/280</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onDeletePhoto(photo.url)}
                            className="px-3 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 flex items-center gap-1.5"
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                          <button
                            disabled={savingCommentUrl === photo.url || draft.trim() === photo.comment}
                            onClick={async () => {
                              setSavingCommentUrl(photo.url);
                              try { await onCommentSave(photo.url, draft); }
                              catch (error: any) { onError(error.message || 'Comment could not be saved.'); }
                              finally { setSavingCommentUrl(null); }
                            }}
                            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold disabled:opacity-40"
                          >
                            {savingCommentUrl === photo.url ? 'Saving…' : 'Save comment'}
                          </button>
                        </div>
                      </div>
                    </> : photo.comment ? <p className="text-sm text-slate-700 whitespace-pre-wrap">{photo.comment}</p> : null}
                  </div>
                </div>
              )})}
            </div>
          )}
        </div>
        {appPassword && (
          <div className="p-4 sm:p-6 border-t bg-slate-50 flex flex-col gap-3 shrink-0">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" multiple className="hidden" />
            <button disabled={!!uploadStatus} onClick={() => fileInputRef.current?.click()} className="w-full bg-indigo-600 text-white py-3 rounded-2xl font-bold hover:bg-indigo-700 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-md">
              {uploadStatus ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}{uploadStatus || 'Upload New Photos'}
            </button>
            {hasMissingCaptureDates && (
              <>
                <div className="text-center text-xs font-bold text-amber-700">
                  {missingCaptureDateCount} photo{missingCaptureDateCount === 1 ? '' : 's'} still missing a taken date
                </div>
                <button
                  disabled={isBackfillingDates}
                onClick={async () => {
                  setIsBackfillingDates(true);
                  try { await onBackfillPhotoDates(); }
                  catch (error: any) { onError(error.message || 'Could not recover older photo dates.'); }
                  finally { setIsBackfillingDates(false); }
                }}
                className="w-full py-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
              >
                {isBackfillingDates ? 'Recovering photo dates…' : 'Recover dates for older photos'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const App = () => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('todo_tracker_theme');
    if (savedTheme) return savedTheme === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [places, setPlaces] = useState<Place[]>([]);
  const [markers, setMarkers] = useState<MarkerData[]>([]);
  const [hotels, setHotels] = useState<Place[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
  const [isJourneyMode, setIsJourneyMode] = useState(false);
  const [selectedJourneyPlaces, setSelectedJourneyPlaces] = useState<string[]>([]);
  const [journeyName, setJourneyName] = useState('');
  const [tripType, setTripType] = useState<'ordered' | 'unordered'>('ordered');
  const [journeySortMode, setJourneySortMode] = useState<'shortest' | 'added'>('shortest');
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);
  const [journeyFilter, setJourneyFilter] = useState('All');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [filter, setFilter] = useState('TODO');
  const [activeScope, setActiveScope] = useState<ScopeName>('Austin');
  const [placeCategory, setPlaceCategory] = useState('All');
  const [listSearch, setListSearch] = useState('');
  const [showAddPlace, setShowAddPlace] = useState(false);
  const listPanelRef = useRef<HTMLDivElement>(null);
  const [nearbyLocation, setNearbyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [nearbyIncludeVisited, setNearbyIncludeVisited] = useState(false);
  const [isNearbyLocating, setIsNearbyLocating] = useState(false);
  const [view, setView] = useState(window.innerWidth < 900 ? 'list' : 'split');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mapTarget, setMapTarget] = useState<any>(null);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [activePhotoItem, setActivePhotoItem] = useState<Place | null>(null);
  const [editingItem, setEditingItem] = useState<Place | null>(null);
  const [lightboxState, setLightboxState] = useState<{ urls: string[], index: number } | null>(null);
  const [appPassword, setAppPassword] = useState<string | null>(localStorage.getItem('todo_tracker_pw'));
  const [pwInput, setPwInput] = useState('');
  const [showSignIn, setShowSignIn] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [debugPhotoResults, setDebugPhotoResults] = useState<Record<string, string>>({});
  const [debugCheckingUrl, setDebugCheckingUrl] = useState<string | null>(null);
  const [autoDiaryPhotoSync, setAutoDiaryPhotoSync] = useState(() => localStorage.getItem('todo_tracker_diary_photo_sync') !== 'false');
  const [isDiaryPhotoSyncing, setIsDiaryPhotoSyncing] = useState(false);
  const [isAuthError, setIsAuthError] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [confirmationDialog, setConfirmationDialog] = useState<any>(null);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(() => {
    const saved = localStorage.getItem('todo_tracker_lockout');
    return saved && parseInt(saved) > Date.now() ? parseInt(saved) : null;
  });
  const [countdown, setCountdown] = useState(0);
  const isOwner = Boolean(appPassword);

  useEffect(() => {
    localStorage.setItem('todo_tracker_theme', isDarkMode ? 'dark' : 'light');
    document.documentElement.classList.toggle('theme-dark', isDarkMode);
    document.documentElement.style.colorScheme = isDarkMode ? 'dark' : 'light';
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem('todo_tracker_diary_photo_sync', autoDiaryPhotoSync ? 'true' : 'false');
  }, [autoDiaryPhotoSync]);

  useEffect(() => {
    if (!lockoutUntil) { localStorage.removeItem('todo_tracker_lockout'); return; }
    localStorage.setItem('todo_tracker_lockout', lockoutUntil.toString());
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining === 0) { setLockoutUntil(null); localStorage.removeItem('todo_tracker_lockout'); }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isSavingRoute, setIsSavingRoute] = useState(false);
  const [pendingPlace, setPendingPlace] = useState<any>(null);
  const [pendingName, setPendingName] = useState('');
  const [pendingDetails, setPendingDetails] = useState('');
  const [showEventDateDialog, setShowEventDateDialog] = useState(false);
  const [showDiaryDialog, setShowDiaryDialog] = useState(false);
  const [diaryDate, setDiaryDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [diaryTitle, setDiaryTitle] = useState('');
  const [diaryNotes, setDiaryNotes] = useState('');
  const [diaryPlace, setDiaryPlace] = useState<any>(null);
  const [diarySource, setDiarySource] = useState<'existing' | 'search' | 'current' | 'none'>('existing');
  const [diarySearch, setDiarySearch] = useState('');
  const [diarySearchResults, setDiarySearchResults] = useState<any[]>([]);
  const [isDiarySearching, setIsDiarySearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [diaryMarkVisited, setDiaryMarkVisited] = useState(true);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [view]);

  const dialogKey = confirmationDialog ? 'confirmation' : editingItem && isOwner ? 'edit' : lightboxState ? 'lightbox' : showDebugPanel && isOwner ? 'settings' : showSignIn && !isOwner ? 'sign-in' : showEventDateDialog && isOwner ? 'event' : showAddPlace && isOwner ? 'add' : activePhotoItem ? 'photos' : showDiaryDialog && isOwner ? 'diary' : '';
  useEffect(() => {
    if (!dialogKey) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const getDialog = () => Array.from(document.querySelectorAll<HTMLElement>('[aria-modal="true"]')).sort((a, b) => Number(getComputedStyle(b).zIndex) - Number(getComputedStyle(a).zIndex))[0];
    const getFocusables = () => Array.from(getDialog()?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]):not([type="file"]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]') || []).filter(element => element.getClientRects().length > 0);
    const frame = requestAnimationFrame(() => { if (!getDialog()?.contains(document.activeElement)) getFocusables()[0]?.focus(); });
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (dialogKey === 'confirmation') { confirmationDialog?.onCancel?.(); setConfirmationDialog(null); }
        else if (dialogKey === 'edit') setEditingItem(null);
        else if (dialogKey === 'lightbox') setLightboxState(null);
        else if (dialogKey === 'settings') setShowDebugPanel(false);
        else if (dialogKey === 'sign-in') setShowSignIn(false);
        else if (dialogKey === 'event') setShowEventDateDialog(false);
        else if (dialogKey === 'add') { setShowAddPlace(false); setPendingPlace(null); }
        else if (dialogKey === 'photos') setActivePhotoItem(null);
        else if (dialogKey === 'diary') resetDiaryDialog();
      }
      if (event.key === 'Tab') {
        const elements = getFocusables();
        const first = elements[0], last = elements[elements.length - 1];
        if (event.shiftKey && (document.activeElement === first || !getDialog()?.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !getDialog()?.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', handleKey); if (previousFocus?.isConnected) previousFocus.focus(); };
  }, [dialogKey]);

  useEffect(() => { listPanelRef.current?.scrollTo({ top: 0 }); }, [filter, activeScope, placeCategory]);

  useEffect(() => {
    setIsLoading(true);
    const headers = appPassword ? { 'Authorization': appPassword } : undefined;
    fetch('/api/places', { headers })
      .then(res => {
        if (res.status === 423) return res.json().then(data => { setLockoutUntil(Date.now() + (data.retryAfter * 1000)); setIsAuthError(true); throw new Error('System Locked'); });
        if (res.status === 401) { localStorage.removeItem('todo_tracker_pw'); setAppPassword(null); setShowSignIn(true); setIsAuthError(true); setLockoutUntil(Date.now() + 30000); throw new Error('Unauthorized'); }
        if (!res.ok) return res.json().then(err => { throw new Error(err.error || 'Failed to fetch'); });
        return res.json();
      })
      .then(data => {
        setPlaces(data.places || []);
        setMarkers(data.markers || []);
        setHotels(data.hotels || []);
        setRoutes(data.routes || []);
        setDiaryEntries(data.diaryEntries || []);
        setIsAuthError(false);
        if (appPassword) { setShowSignIn(false); setPwInput(''); }
      })
      .catch(err => { if (err.message !== 'Unauthorized' && err.message !== 'System Locked') setError(err.message); })
      .finally(() => setIsLoading(false));
  }, [appPassword, lockoutUntil === null]);

  const signOut = () => {
    localStorage.removeItem('todo_tracker_pw');
    setAppPassword(null);
    setPwInput('');
    setIsJourneyMode(false);
    setEditingItem(null);
    setPendingPlace(null);
    setShowAddPlace(false);
    setShowDebugPanel(false);
    setShowDiaryDialog(false);
    setToastMessage('Signed out. You are now viewing read-only.');
  };

  const updatePlace = async (id: string, data: any, type: 'place' | 'hotel' = 'place') => {
    if (!isOwner) return;
    const prevPlaces = [...places]; const prevHotels = [...hotels];
    if (type === 'hotel') setHotels(h => h.map(x => x.id === id ? { ...x, ...data } : x));
    else setPlaces(p => p.map(x => x.id === id ? { ...x, ...data } : x));
    try {
      const response = await fetch('/api/places', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': appPassword || '' }, body: JSON.stringify({ id, type, ...data }), });
      if (!response.ok) throw new Error('Failed to update');
    } catch (error) {
      if (type === 'hotel') setHotels(prevHotels); else setPlaces(prevPlaces);
      setError("Failed to save. Reverting..."); setTimeout(() => setError(null), 3000);
    }
  };

  const deletePlace = async (item: Place) => {
    if (!isOwner) return;
    const type = item.type || 'place';
    setConfirmationDialog({
      message: `Delete "${item.name}"?`,
      onConfirm: async () => {
        const compositeId = `${type}:${item.id}`;
        const prevPlaces = [...places];
        const prevHotels = [...hotels];
        const prevRoutes = [...routes];
        const removeFromRoutes = (route: Route) => ({
          ...route,
          placeIds: route.placeIds.filter(placeId => placeId !== compositeId && placeId !== item.id),
          completedPlaceIds: route.completedPlaceIds.filter(placeId => placeId !== compositeId && placeId !== item.id)
        });

        if (type === 'hotel') setHotels(current => current.filter(h => h.id !== item.id));
        else setPlaces(current => current.filter(p => p.id !== item.id));
        setRoutes(current => current.map(removeFromRoutes));
        setEditingItem(null);

        try {
          const response = await fetch('/api/places', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': appPassword || '' },
            body: JSON.stringify({ id: item.id, type, action: 'delete' })
          });

          if (!response.ok) throw new Error('Failed to delete');
          setToastMessage(`Deleted "${item.name}".`);
        } catch (error) {
          setPlaces(prevPlaces);
          setHotels(prevHotels);
          setRoutes(prevRoutes);
          setError("Failed to delete. Reverting...");
          setTimeout(() => setError(null), 3000);
        }
      },
      onCancel: () => {}
    });
  };

  const addPlace = async (category: string, eventStartDate = '', eventEndDate = '') => {
    if (!isOwner || !pendingPlace) return; setIsAdding(true);
    const isHotel = category === 'Hotels';
    const newEntry: any = { name: pendingName || pendingPlace.display_name.split(',')[0], address: pendingPlace.display_name.split(',').slice(1).join(',').trim(), lat: parseFloat(pendingPlace.lat), lng: parseFloat(pendingPlace.lon), category: isHotel ? 'Hotels' : category, status: 'To Do', notes: '', rating: '', priority: '', scope: activeScope, type: isHotel ? 'hotel' : 'place', details: pendingDetails, eventStartDate, eventEndDate };
    try {
      const res = await fetch('/api/places', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': appPassword || '' }, body: JSON.stringify(newEntry) });
      const data = await res.json();
      if (data.success) { if (isHotel) setHotels(prev => [...prev, { ...newEntry, id: data.id }]); else setPlaces(prev => [...prev, { ...newEntry, id: data.id }]); setPendingPlace(null); setPendingName(''); setPendingDetails(''); setShowEventDateDialog(false); setSearchQuery(''); setSearchResults([]); setFilter('All'); setPlaceCategory(category); setListSearch(''); setShowAddPlace(false); }
    } catch (err) { setError("Failed to add entry."); } finally { setIsAdding(false); }
  };

  const resetDiaryDialog = () => {
    setShowDiaryDialog(false);
    setDiaryDate(format(new Date(), 'yyyy-MM-dd'));
    setDiaryTitle('');
    setDiaryNotes('');
    setDiaryPlace(null);
    setDiarySource('existing');
    setDiarySearch('');
    setDiarySearchResults([]);
    setDiaryMarkVisited(true);
  };

  const chooseDiaryPlace = (item: any) => {
    setDiaryPlace(item);
    setDiaryTitle(item.name || item.display_name?.split(',')[0] || '');
    setDiaryMarkVisited(item.status === 'To Do');
  };

  const searchDiaryPlaces = async () => {
    if (!diarySearch.trim()) return;
    setIsDiarySearching(true);
    try {
      const scopeConfig = SCOPE_CONFIG[activeScope];
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(diarySearch)}${scopeConfig.searchParams}`);
      setDiarySearchResults(await response.json());
    } catch (error) {
      setToastMessage('Could not search for that location.');
    } finally {
      setIsDiarySearching(false);
    }
  };

  const locateNearby = () => {
    if (!navigator.geolocation) {
      setToastMessage('Geolocation is not supported by this browser.');
      return;
    }
    setIsNearbyLocating(true);
    navigator.geolocation.getCurrentPosition(position => {
      const { latitude, longitude } = position.coords;
      const nextLocation = { lat: latitude, lng: longitude };
      setNearbyLocation(nextLocation);
      setMapTarget({ center: [latitude, longitude], zoom: 13 });
      setIsNearbyLocating(false);
    }, () => {
      setIsNearbyLocating(false);
      setToastMessage('Location permission was denied or unavailable.');
    }, { enableHighAccuracy: true, timeout: 10000 });
  };

  const useCurrentDiaryLocation = () => {
    if (!navigator.geolocation) {
      setToastMessage('Geolocation is not supported by this browser.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(async position => {
      const { latitude, longitude } = position.coords;
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
        const result = await response.json();
        chooseDiaryPlace({
          id: '',
          type: '',
          name: result.name || result.display_name?.split(',')[0] || 'Current location',
          address: result.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
          lat: latitude,
          lng: longitude,
          status: ''
        });
      } catch (error) {
        chooseDiaryPlace({ id: '', type: '', name: 'Current location', address: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`, lat: latitude, lng: longitude, status: '' });
      } finally {
        setIsLocating(false);
      }
    }, () => {
      setIsLocating(false);
      setToastMessage('Location permission was denied or unavailable.');
    }, { enableHighAccuracy: true, timeout: 10000 });
  };

  const saveDiaryEntry = async () => {
    if (!isOwner || !diaryTitle.trim()) {
      setToastMessage('Add a title for this diary entry.');
      return;
    }
    setIsAdding(true);
    const entry = {
      date: diaryDate,
      title: diaryTitle.trim(),
      notes: diaryNotes.trim(),
      placeId: diaryPlace?.id || '',
      placeType: diaryPlace?.type || '',
      name: diaryPlace?.name || diaryTitle.trim(),
      address: diaryPlace?.address || '',
      lat: Number(diaryPlace?.lat) || 0,
      lng: Number(diaryPlace?.lng) || 0,
      scope: activeScope,
      createdAt: new Date().toISOString()
    };
    try {
      const response = await fetch('/api/places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': appPassword || '' },
        body: JSON.stringify({ type: 'diary', ...entry })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save diary entry');
      setDiaryEntries(current => [{ ...entry, id: data.id }, ...current]);
      if (diaryMarkVisited && diaryPlace?.id && (diaryPlace.type === 'place' || diaryPlace.type === 'hotel')) {
        await updatePlace(diaryPlace.id, { status: 'Visited', date: diaryDate }, diaryPlace.type);
      }
      resetDiaryDialog();
      setToastMessage('Diary entry saved.');
    } catch (error: any) {
      setError(error.message || 'Failed to save diary entry.');
    } finally {
      setIsAdding(false);
    }
  };

  const deleteDiaryEntry = (entry: DiaryEntry) => {
    if (!isOwner) return;
    setConfirmationDialog({
      message: `Delete diary entry "${entry.title}"?`,
      onConfirm: async () => {
        const response = await fetch('/api/places', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': appPassword || '' },
          body: JSON.stringify({ type: 'diary', id: entry.id, action: 'delete' })
        });
        if (response.ok) {
          setDiaryEntries(current => current.filter(item => item.id !== entry.id));
          setToastMessage('Diary entry deleted.');
        } else {
          setError('Failed to delete diary entry.');
        }
      },
      onCancel: () => {}
    });
  };

  const handlePhotoUpload = async (item: Place, photo: PhotoDetails) => {
    if (!isOwner || !appPassword) return;
    try {
      const response = await fetch('/api/places', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': appPassword }, body: JSON.stringify({
        id: item.id,
        photoUrl: photo.url,
        capturedAt: photo.capturedAt,
        uploadedAt: photo.uploadedAt,
      }), });
      if (response.ok) {
        const withPhoto = (place: Place) => ({
          ...place,
          photos: [...(place.photos ? place.photos.split(',').filter(Boolean) : []), photo.url].join(','),
          photoDetails: [...photoDetailsFor(place), photo],
        });
        if (item.type === 'hotel') setHotels(prev => prev.map(h => h.id === item.id ? withPhoto(h) : h));
        else setPlaces(prev => prev.map(p => p.id === item.id ? withPhoto(p) : p));
        setActivePhotoItem(prev => (prev && prev.id === item.id ? withPhoto(prev) : prev));
      } else {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Photo linked failed.');
      }
    } catch (err: any) { throw new Error(err.message || 'Photo linked failed.'); }
  };

  const handlePhotoDelete = (item: Place, photoUrl: string) => {
    if (!isOwner || !appPassword) return;
    setConfirmationDialog({
      message: 'Delete this photo? This will remove it from the tracker and Cloudinary.',
      onConfirm: async () => {
        const response = await fetch('/api/places', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': appPassword },
          body: JSON.stringify({ id: item.id, photoUrl, action: 'deletePhoto' }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          setToastMessage(data.error || 'Photo could not be deleted.');
          return;
        }

        const withoutPhoto = (place: Place) => ({
          ...place,
          photos: (place.photos ? place.photos.split(',').filter(url => url && url !== photoUrl) : []).join(','),
          photoDetails: photoDetailsFor(place).filter(photo => photo.url !== photoUrl),
        });
        if (item.type === 'hotel') setHotels(prev => prev.map(h => h.id === item.id ? withoutPhoto(h) : h));
        else setPlaces(prev => prev.map(p => p.id === item.id ? withoutPhoto(p) : p));
        setActivePhotoItem(prev => (prev && prev.id === item.id ? withoutPhoto(prev) : prev));
        setToastMessage('Photo deleted.');
      },
      onCancel: () => {}
    });
  };

  const handlePhotoCommentSave = async (item: Place, photoUrl: string, comment: string) => {
    if (!isOwner || !appPassword) return;
    const normalizedComment = comment.trim();
    const response = await fetch('/api/places', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': appPassword },
      body: JSON.stringify({ id: item.id, photoUrl, photoComment: normalizedComment, action: 'updatePhoto' }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Comment could not be saved.');
    }
    const withComment = (place: Place) => ({
      ...place,
      photoDetails: photoDetailsFor(place).map(photo => photo.url === photoUrl ? { ...photo, comment: normalizedComment } : photo),
    });
    if (item.type === 'hotel') setHotels(prev => prev.map(h => h.id === item.id ? withComment(h) : h));
    else setPlaces(prev => prev.map(p => p.id === item.id ? withComment(p) : p));
    setActivePhotoItem(prev => (prev && prev.id === item.id ? withComment(prev) : prev));
    setToastMessage('Photo comment saved.');
  };

  const handleSinglePhotoMetadataCheck = async (photoUrl: string) => {
    if (!isOwner || !appPassword) throw new Error('Owner sign-in required.');
    const response = await fetch('/api/places', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': appPassword },
      body: JSON.stringify({ action: 'checkPhotoMetadata', photoUrl }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = [data.error, data.publicId ? `publicId: ${data.publicId}` : '', data.httpCode ? `HTTP ${data.httpCode}` : ''].filter(Boolean).join(' · ');
      throw new Error(detail || 'Photo metadata check failed.');
    }

    if (data.status === 'recovered' && data.capturedAt) {
      const applyRecoveredDate = (place: Place) => ({
        ...place,
        photoDetails: photoDetailsFor(place).map(photo => photo.url === photoUrl ? { ...photo, capturedAt: data.capturedAt } : photo),
      });
      setPlaces(prev => prev.map(applyRecoveredDate));
      setHotels(prev => prev.map(applyRecoveredDate));
      setActivePhotoItem(prev => prev ? applyRecoveredDate(prev) : prev);
      return `Recovered: ${formatPhotoTimestamp(data.capturedAt)} · publicId: ${data.publicId}`;
    }

    const keys = Array.isArray(data.metadataKeys) && data.metadataKeys.length ? data.metadataKeys.join(', ') : 'none';
    return `Cloudinary lookup succeeded, but no capture date was found. publicId: ${data.publicId} · metadata keys: ${keys}`;
  };

  const handlePhotoMetadataBackfill = async () => {
    if (!isOwner || !appPassword) return;
    const response = await fetch('/api/places', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': appPassword },
      body: JSON.stringify({ action: 'backfillPhotoMetadata' }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Could not recover older photo dates.');

    const recovered = new Map<string, string>((data.updates || []).map((entry: { url: string; capturedAt: string }) => [entry.url, entry.capturedAt]));
    if (recovered.size > 0) {
      const applyRecoveredDates = (place: Place) => ({
        ...place,
        photoDetails: photoDetailsFor(place).map(photo => recovered.has(photo.url) ? { ...photo, capturedAt: recovered.get(photo.url) || photo.capturedAt } : photo),
      });
      setPlaces(prev => prev.map(applyRecoveredDates));
      setHotels(prev => prev.map(applyRecoveredDates));
      setActivePhotoItem(prev => prev ? applyRecoveredDates(prev) : prev);
    }

    const parts = [`Recovered ${data.recovered || 0} photo date${data.recovered === 1 ? '' : 's'}.`];
    if (data.unavailable) parts.push(`${data.unavailable} had no recoverable EXIF date.`);
    if (data.failed) parts.push(`${data.failed} failed to check.`);
    setToastMessage(parts.join(' '));
  };

  const getJourneyItems = (ids: string[]) => {
    const allItems = [
      ...places.map(p => ({ ...p, type: 'place' as const })),
      ...hotels.map(h => ({ ...h, type: 'hotel' as const })),
      ...markers.map(m => ({ ...m, type: 'marker' as const }))
    ];

    return ids.map(compositeId => {
      const [type, id] = compositeId.includes(':') ? compositeId.split(':') : ['place', compositeId];
      return allItems.find(item => item.id === id && item.type === type);
    }).filter(Boolean) as any[];
  };

  const getJourneyId = (item: any) => `${item.type}:${item.id}`;

  const getDistance = (a: any, b: any) => {
    const toRadians = (value: number) => value * Math.PI / 180;
    const earthRadiusKm = 6371;
    const latDelta = toRadians(Number(b.lat) - Number(a.lat));
    const lngDelta = toRadians(Number(b.lng) - Number(a.lng));
    const latA = toRadians(Number(a.lat));
    const latB = toRadians(Number(b.lat));
    const h =
      Math.sin(latDelta / 2) ** 2 +
      Math.cos(latA) * Math.cos(latB) * Math.sin(lngDelta / 2) ** 2;
    return 2 * earthRadiusKm * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  };

  const calculateOptimalPath = (ids: string[]) => {
    if (ids.length < 3) return ids;

    const selectedItems = getJourneyItems(ids);

    if (selectedItems.length < 2) return ids;

    const result = [selectedItems[0]];
    const unvisited = selectedItems.slice(1);

    while (unvisited.length > 0) {
      const current = result[result.length - 1];
      let nearestIdx = 0;
      let minDistance = Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const dist = getDistance(current, unvisited[i]);
        if (dist < minDistance) {
          minDistance = dist;
          nearestIdx = i;
        }
      }

      result.push(unvisited[nearestIdx]);
      unvisited.splice(nearestIdx, 1);
    }

    let improved = result;
    let didImprove = true;
    let passes = 0;

    while (didImprove && passes < 25) {
      didImprove = false;
      passes += 1;

      for (let i = 1; i < improved.length - 1; i++) {
        for (let j = i + 1; j < improved.length; j++) {
          const currentDistance =
            getDistance(improved[i - 1], improved[i]) +
            (j < improved.length - 1 ? getDistance(improved[j], improved[j + 1]) : 0);
          const swappedDistance =
            getDistance(improved[i - 1], improved[j]) +
            (j < improved.length - 1 ? getDistance(improved[i], improved[j + 1]) : 0);

          if (swappedDistance < currentDistance) {
            improved = [
              ...improved.slice(0, i),
              ...improved.slice(i, j + 1).reverse(),
              ...improved.slice(j + 1)
            ];
            didImprove = true;
          }
        }
      }
    }

    return improved.map(getJourneyId);
  };

  const getJourneyPathIds = (ids: string[]) => {
    if (tripType === 'unordered') return ids;
    return journeySortMode === 'shortest' ? calculateOptimalPath(ids) : ids;
  };

  const toggleJourneyPlace = (id: string) => {
    setSelectedJourneyPlaces(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const saveRoute = async () => {
    if (!isOwner) return;
    if (!journeyName || selectedJourneyPlaces.length === 0) {
      setToastMessage("Please enter a name and select at least one location.");
      return;
    }
    setIsSavingRoute(true);
    const optimizedIds = getJourneyPathIds(selectedJourneyPlaces);
    try {
      const res = await fetch('/api/places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': appPassword || '' },
        body: JSON.stringify({ type: 'route', name: journeyName, placeIds: optimizedIds, scope: activeScope, tripType })
      });
      const data = await res.json();
      if (data.success) {
        setRoutes(prev => [...prev, { id: data.id, name: journeyName, placeIds: optimizedIds, scope: activeScope, tripType, completedPlaceIds: [], status: 'planned' }]);
        setIsJourneyMode(false);
        setJourneyName('');
        setSelectedJourneyPlaces([]);
        setFilter('Trips');
        setActiveRouteId(data.id);
        setToastMessage(`Trip "${journeyName}" saved successfully!`);
      } else {
        setError(data.error || "Failed to save trip.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to save trip.");
    } finally {
      setIsSavingRoute(false);
    }
  };

  const deleteRoute = async (id: string) => {
    if (!isOwner) return;
    setConfirmationDialog({
      message: "Are you sure you want to delete this trip?",
      onConfirm: async () => {
        setIsSavingRoute(true);
        try {
          const res = await fetch('/api/places', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': appPassword || '' },
            body: JSON.stringify({ type: 'route', id, action: 'delete' })
          });
          if (res.ok) {
            setRoutes(prev => prev.filter(r => r.id !== id));
            if (activeRouteId === id) setActiveRouteId(null);
            setToastMessage("Trip deleted successfully!");
          } else {
            setError("Failed to delete trip.");
          }
        } catch (err) {
          setError("Failed to delete trip.");
        } finally {
          setIsSavingRoute(false);
        }
      },
      onCancel: () => {}
    });
  };

  const updateRoute = async (route: Route, updates: Partial<Route>) => {
    const previousRoutes = routes;
    setRoutes(current => current.map(item => item.id === route.id ? { ...item, ...updates } : item));
    try {
      const response = await fetch('/api/places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': appPassword || '' },
        body: JSON.stringify({ type: 'route', id: route.id, action: 'update', ...updates })
      });
      if (!response.ok) throw new Error('Failed to update trip');
    } catch (error) {
      setRoutes(previousRoutes);
      setError('Failed to update trip. Reverting...');
      setTimeout(() => setError(null), 3000);
    }
  };

  const startTrip = async (route: Route) => {
    await updateRoute(route, { status: 'active' });
    setToastMessage(`Trip "${route.name}" started.`);
  };

  const toggleTripPlace = async (route: Route, compositeId: string) => {
    if (!isOwner || route.status !== 'active') return;
    const isComplete = route.completedPlaceIds.includes(compositeId);
    const completedPlaceIds = isComplete
      ? route.completedPlaceIds.filter(id => id !== compositeId)
      : [...route.completedPlaceIds, compositeId];
    const [type, id] = compositeId.includes(':') ? compositeId.split(':') : ['place', compositeId];
    if (type === 'place' || type === 'hotel') {
      await updatePlace(id, { status: isComplete ? 'To Do' : 'Visited', date: isComplete ? '' : format(new Date(), 'yyyy-MM-dd') }, type);
    }
    await updateRoute(route, { completedPlaceIds });
  };

  const completeRoute = async (route: Route) => {
    if (!isOwner) return;
    setConfirmationDialog({
      message: `Complete trip "${route.name}"? Unchecked locations will remain in To Do.`,
      onConfirm: async () => {
        const uncheckedUpdates = route.placeIds
          .filter(compositeId => !route.completedPlaceIds.includes(compositeId))
          .map(compositeId => {
            const [type, id] = compositeId.includes(':') ? compositeId.split(':') : ['place', compositeId];
            if (type !== 'place' && type !== 'hotel') return Promise.resolve();
            return updatePlace(id, { status: 'To Do' }, type);
          });
        await Promise.all(uncheckedUpdates);
        await updateRoute(route, { status: 'completed' });
        setToastMessage(`Trip "${route.name}" completed!`);
      },
      onCancel: () => {}
    });
  };

  const placeCategories = ['All', 'Food', 'Drinks', 'Activities', 'Shopping', 'Sport', 'Events', 'Hotels', 'Other'];
  const activeSection: TrackerSection = filter === 'Saved' ? 'Pins' : filter === 'Nearby' || filter === 'Trips' || filter === 'Diary' ? filter : 'Places';
  const matchesSearch = (item: { name?: string; title?: string; address?: string; details?: string; notes?: string }) =>
    [item.name, item.title, item.address, item.details, item.notes].join(' ').toLowerCase().includes(listSearch.trim().toLowerCase());
  const scopedItems = [...places, ...hotels].filter(item => item.scope === activeScope);
  const toDoCount = scopedItems.filter(item => item.status === 'To Do').length;
  const visitedCount = scopedItems.filter(item => item.status === 'Visited').length;
  const sectionCounts = { Places: scopedItems.length, Trips: routes.filter(route => route.scope === activeScope).length, Diary: diaryEntries.filter(entry => entry.scope === activeScope).length, Pins: markers.filter(marker => marker.scope === activeScope).length };
  const navigateSection = (section: TrackerSection) => {
    setFilter(section === 'Places' ? 'TODO' : section === 'Pins' ? 'Saved' : section);
    setListSearch('');
    setPlaceCategory('All');
    setHoveredId(null);
    setSelectedMapId(null);
    if (section !== 'Trips') { setIsJourneyMode(false); setActiveRouteId(null); }
    if (windowWidth < 900) setView('list');
    if (section === 'Nearby' && !nearbyLocation) locateNearby();
  };
  const createTrip = () => {
    setFilter('Trips'); setIsJourneyMode(true); setSelectedJourneyPlaces([]); setJourneyName('');
    setTripType('ordered'); setJourneySortMode('shortest'); setActiveRouteId(null); setJourneyFilter('All'); setListSearch('');
    if (windowWidth < 900 || view === 'map') setView(windowWidth < 900 ? 'list' : 'split');
  };
  const locateItem = (item: { lat: number; lng: number; id?: string; type?: 'place' | 'hotel' }) => {
    if (!Number.isFinite(Number(item.lat)) || !Number.isFinite(Number(item.lng))) return;
    if (item.id && item.type) setSelectedMapId(`${item.type}:${item.id}`);
    setMapTarget({ center: [Number(item.lat), Number(item.lng)], zoom: 15 });
    if (windowWidth < 900) setView('map'); else if (view === 'list') setView('split');
  };
  const diaryGroups = useMemo(() => {
    const scopedEntries = diaryEntries
      .filter(entry => entry.scope === activeScope && matchesSearch(entry))
      .sort((a, b) => `${b.date}-${b.createdAt}`.localeCompare(`${a.date}-${a.createdAt}`));
    return scopedEntries.reduce<Record<string, DiaryEntry[]>>((groups, entry) => {
      if (!groups[entry.date]) groups[entry.date] = [];
      groups[entry.date].push(entry);
      return groups;
    }, {});
  }, [diaryEntries, activeScope, listSearch]);
  const effectiveSidebarWidth = windowWidth < 900 ? (view === 'map' ? 0 : 100) : view === 'map' ? 0 : view === 'list' ? 100 : 48;

  const filteredMarkers = useMemo(() => markers.filter(m => m.scope === activeScope), [markers, activeScope]);

  const currentRoutePoints = useMemo(() => {
    let ids: string[] = [];
    if (isJourneyMode) {
      ids = getJourneyPathIds(selectedJourneyPlaces);
    } else if (activeRouteId && filter === 'Trips') {
      const route = routes.find(r => r.id === activeRouteId);
      if (route) ids = route.placeIds;
    }
    if (ids.length === 0) return [];

    return getJourneyItems(ids);
  }, [isJourneyMode, selectedJourneyPlaces, activeRouteId, routes, places, hotels, markers, filter, journeySortMode, tripType]);

  const showRouteLine = isJourneyMode
    ? tripType === 'ordered'
    : routes.find(route => route.id === activeRouteId)?.tripType !== 'unordered';

  const hoveredItem = useMemo(() => {
    const previewId = selectedMapId || hoveredId;
    if (!previewId) return null;
    const [type, id] = previewId.split(':');
    const allItems = [
      ...places.map(p => ({ ...p, type: 'place' as const })),
      ...hotels.map(h => ({ ...h, type: 'hotel' as const })),
      ...markers.map(m => ({ ...m, type: 'marker' as const }))
    ];
    return allItems.find(item => item.id === id && item.type === type) || null;
  }, [hoveredId, selectedMapId, places, hotels, markers]);

  useEffect(() => {
    if (currentRoutePoints.length >= 2) {
      const lats = currentRoutePoints.map(p => p.lat);
      const lngs = currentRoutePoints.map(p => p.lng);
      const bounds = [
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)]
      ];
      setMapTarget({ bounds });
    }
  }, [currentRoutePoints]);

  const filteredPlaces = useMemo(() => {
    const scopePlaces = places.filter(item => item.scope === activeScope && matchesSearch(item));
    if (isJourneyMode) {
      return scopePlaces.filter(item => journeyFilter === 'All' || item.status === journeyFilter);
    }
    if (filter === 'Trips') {
      const route = routes.find(item => item.id === activeRouteId);
      return route ? scopePlaces.filter(item => route.placeIds.includes(`place:${item.id}`) || route.placeIds.includes(item.id)) : [];
    }
    if (filter === 'Diary' || filter === 'Saved') return [];
    return scopePlaces.filter(item => {
      if (placeCategory !== 'All' && (item.category || 'Other') !== placeCategory) return false;
      if (filter === 'Nearby') return nearbyLocation && item.lat && item.lng && (nearbyIncludeVisited || item.status !== 'Visited');
      if (filter === 'Visited') return item.status === 'Visited';
      if (filter === 'TODO') return item.status === 'To Do';
      return true;
    });
  }, [places, filter, activeScope, placeCategory, listSearch, isJourneyMode, journeyFilter, routes, activeRouteId, nearbyLocation, nearbyIncludeVisited]);

  const filteredHotels = useMemo(() => {
    const scopeHotels = hotels.filter(item => item.scope === activeScope && matchesSearch(item));
    if (isJourneyMode) return scopeHotels.filter(item => journeyFilter === 'All' || item.status === journeyFilter);
    if (filter === 'Trips') {
      const route = routes.find(item => item.id === activeRouteId);
      return route ? scopeHotels.filter(item => route.placeIds.includes(`hotel:${item.id}`)) : [];
    }
    if (filter === 'Diary' || filter === 'Saved' || (placeCategory !== 'All' && placeCategory !== 'Hotels')) return [];
    if (filter === 'Nearby') return nearbyLocation ? scopeHotels.filter(item => item.lat && item.lng && (nearbyIncludeVisited || item.status !== 'Visited')) : [];
    if (filter === 'Visited') return scopeHotels.filter(item => item.status === 'Visited');
    if (filter === 'TODO') return scopeHotels.filter(item => item.status === 'To Do');
    return scopeHotels;
  }, [hotels, filter, activeScope, placeCategory, listSearch, isJourneyMode, journeyFilter, routes, activeRouteId, nearbyLocation, nearbyIncludeVisited]);

  const displayItems = useMemo(() => {
    const items = [
      ...filteredHotels.map(h => ({ ...h, category: 'Hotels', type: 'hotel' as const })),
      ...filteredPlaces.map(p => ({ ...p, type: 'place' as const }))
    ];

    if (filter === 'Visited') return items;
    if (filter === 'Nearby' && nearbyLocation) {
      return items.sort((a, b) => getDistance(nearbyLocation, a) - getDistance(nearbyLocation, b));
    }
    return items.sort((a, b) => (parseInt(b.priority) || 0) - (parseInt(a.priority) || 0));
  }, [filteredHotels, filteredPlaces, filter, nearbyLocation]);

  const visitedGroups = useMemo(() => {
    if (filter !== 'Visited') return {};
    const groups = displayItems.reduce<Record<string, (Place & { type: 'place' | 'hotel' })[]>>((result, item) => {
      const category = item.category || 'Other';
      (result[category] ||= []).push(item);
      return result;
    }, {});
    Object.values(groups).forEach(items => items.sort((a, b) => {
      const aScore = Number(a.rating) || 0; const bScore = Number(b.rating) || 0;
      if (aScore === 0 && bScore !== 0) return -1;
      if (bScore === 0 && aScore !== 0) return 1;
      if (aScore !== bScore) return bScore - aScore;
      return Number(b.return === true || b.return === 'TRUE') - Number(a.return === true || a.return === 'TRUE');
    }));
    return groups;
  }, [displayItems, filter]);

  const getMarkerIcon = (type: string, id: string) => {
    const compositeId = `marker:${id}`;
    const isHovered = hoveredId === compositeId;
    const color = isHovered ? '#f59e0b' : (type === 'home' ? '#0f766e' : type === 'office' ? '#0891b2' : '#64748b');
    const scale = isHovered ? 1.2 : 1;
    const IconComponent = type === 'home' ? Home : type === 'office' ? Briefcase : MapPin;

    return L.divIcon({
      html: renderToStaticMarkup(
        <div
          style={{ color, transform: `scale(${scale})` }}
          className="bg-white rounded-full shadow-lg border-2 border-current flex items-center justify-center w-[30px] h-[30px] transition-all duration-200"
        >
          <IconComponent size={18} strokeWidth={2.5} />
        </div>
      ),
      className: 'custom-leaflet-icon',
      iconSize: [30, 30],
      iconAnchor: [15, 30],
    });
  };

  const getHotelIcon = (id: string) => {
    const compositeId = `hotel:${id}`;
    const isHovered = hoveredId === compositeId;
    const color = isHovered ? '#f59e0b' : '#2563eb';
    const scale = isHovered ? 1.2 : 1;

    return L.divIcon({
      html: renderToStaticMarkup(
        <div
          style={{ color, transform: `scale(${scale})` }}
          className="bg-white rounded-full shadow-lg border-2 border-current flex items-center justify-center w-[30px] h-[30px] transition-all duration-200"
        >
          <Bed size={18} strokeWidth={2.5} />
        </div>
      ),
      className: 'custom-leaflet-icon',
      iconSize: [30, 30],
      iconAnchor: [15, 30],
    });
  };

  const getPlaceIcon = (id: string) => {
    const compositeId = `place:${id}`;
    const isHovered = hoveredId === compositeId;
    const color = isHovered ? '#f59e0b' : '#64748b';
    const scale = isHovered ? 1.2 : 1;

    return L.divIcon({
      html: renderToStaticMarkup(
        <div
          style={{ color, transform: `scale(${scale})` }}
          className="bg-white rounded-full shadow-lg border-2 border-current flex items-center justify-center w-[30px] h-[30px] transition-all duration-200"
        >
          <MapPin size={18} strokeWidth={2.5} />
        </div>
      ),
      className: 'custom-leaflet-icon',
      iconSize: [30, 30],
      iconAnchor: [15, 30],
    });
  };

  const PriorityRating = ({ priority, onChange, readOnly = false, compact = false }: { priority: string, onChange: (r: string) => void, readOnly?: boolean, compact?: boolean }) => (
    <div className="flex items-center gap-0.5 shrink-0" aria-label={priority ? `Priority ${priority} out of 5` : 'No priority set'}>
      {[1, 2, 3, 4, 5].map(level => {
        const score = parseInt(priority) || 0;
        const activeColor = score === 1 ? 'text-rose-300' : score === 2 ? 'text-orange-400' : score === 3 ? 'text-amber-400' : score === 4 ? 'text-lime-500' : 'text-emerald-500';
        return (
          <button
            key={level}
            type="button"
            disabled={readOnly}
            aria-label={`Set priority to ${level} out of 5`}
            onClick={(e) => { e.stopPropagation(); if (!readOnly) onChange(level.toString()); }}
            className={`rounded-full transition-all ${compact ? 'p-0.5' : 'p-1'} ${score >= level ? activeColor : `text-slate-400 ${readOnly ? '' : 'hover:text-slate-500'}`}`}
          >
            <Circle size={compact ? 12 : 16} strokeWidth={2.5} fill={score >= level ? 'currentColor' : 'none'} />
          </button>
        );
      })}
    </div>
  );

  const missingPhotoEntries = useMemo(() => {
    const items = [
      ...places.map(place => ({ ...place, type: 'place' as const })),
      ...hotels.map(hotel => ({ ...hotel, type: 'hotel' as const, category: hotel.category || 'Hotels' })),
    ];
    return items.flatMap(item =>
      photoDetailsFor(item)
        .filter(photo => !photo.capturedAt)
        .map(photo => ({ item, photo }))
    );
  }, [places, hotels]);

  const diaryPhotoCandidates = useMemo(() => {
    const items = [
      ...places.map(place => ({ ...place, type: 'place' as const })),
      ...hotels.map(hotel => ({ ...hotel, type: 'hotel' as const, category: hotel.category || 'Hotels' })),
    ];
    const existingKeys = new Set(
      diaryEntries
        .filter(entry => entry.placeId && entry.placeType && entry.date)
        .map(entry => `${entry.placeType}:${entry.placeId}:${entry.date}`)
    );
    const grouped = new Map<string, { item: Place & { type: 'place' | 'hotel' }; date: string; photos: PhotoDetails[] }>();

    items.forEach(item => {
      photoDetailsFor(item).forEach(photo => {
        const date = photoCaptureDate(photo.capturedAt);
        if (!date || date > format(new Date(), 'yyyy-MM-dd')) return;
        const key = `${item.type}:${item.id}:${date}`;
        if (existingKeys.has(key)) return;
        const existing = grouped.get(key);
        if (existing) existing.photos.push(photo);
        else grouped.set(key, { item, date, photos: [photo] });
      });
    });

    return Array.from(grouped.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [places, hotels, diaryEntries]);

  const syncDiaryFromPhotos = async (silent = false) => {
    if (!isOwner || !appPassword || isDiaryPhotoSyncing) return;
    if (diaryPhotoCandidates.length === 0) {
      if (!silent) setToastMessage('Diary is already in sync with photo EXIF dates.');
      return;
    }

    setIsDiaryPhotoSyncing(true);
    const entries = diaryPhotoCandidates.map(candidate => {
      const photoNotes = Array.from(new Set(candidate.photos.map(photo => photo.comment.trim()).filter(Boolean)));
      return {
        date: candidate.date,
        title: candidate.item.name,
        notes: photoNotes.join('\n'),
        placeId: candidate.item.id,
        placeType: candidate.item.type,
        name: candidate.item.name,
        address: candidate.item.address,
        lat: Number(candidate.item.lat) || 0,
        lng: Number(candidate.item.lng) || 0,
        scope: candidate.item.scope || activeScope,
        createdAt: new Date().toISOString()
      };
    });

    try {
      const response = await fetch('/api/places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': appPassword },
        body: JSON.stringify({ type: 'diary', action: 'syncDiaryFromPhotos', entries })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Diary sync failed with HTTP ${response.status}`);

      const createdEntries = Array.isArray(data.created) ? data.created as DiaryEntry[] : [];
      const invalidEntries = Array.isArray(data.invalid) ? data.invalid : [];
      if (createdEntries.length > 0) {
        setDiaryEntries(current => [...createdEntries, ...current]);
      }

      if (!silent || invalidEntries.length > 0) {
        const invalidSummary = invalidEntries.length > 0
          ? ` ${invalidEntries.length} skipped: ${invalidEntries.slice(0, 3).map((entry: any) => `${entry.name} (${entry.reason})`).join(', ')}${invalidEntries.length > 3 ? '…' : ''}`
          : '';
        setToastMessage(
          createdEntries.length > 0
            ? `Added ${createdEntries.length} diary entr${createdEntries.length === 1 ? 'y' : 'ies'} from photo dates.${invalidSummary}`
            : invalidEntries.length > 0
              ? `No diary entries added.${invalidSummary}`
              : 'Diary is already in sync with photo EXIF dates.'
        );
      }
    } catch (error: any) {
      console.error('Photo diary batch sync failed', error);
      setToastMessage(`Diary photo sync failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsDiaryPhotoSyncing(false);
    }
  };

  useEffect(() => {
    if (!isOwner || isLoading || !autoDiaryPhotoSync || isDiaryPhotoSyncing || diaryPhotoCandidates.length === 0) return;
    void syncDiaryFromPhotos(true);
  }, [isOwner, isLoading, autoDiaryPhotoSync, diaryPhotoCandidates.length]);

  return (
    <div className={`tracker-app ${isDarkMode ? 'theme-dark' : ''}`}>
      {showSignIn && !isOwner && (
        <div role="dialog" aria-modal="true" aria-label="Owner sign in" className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[400] flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md space-y-6 border border-slate-100 text-center">
            <button onClick={() => { setShowSignIn(false); setPwInput(''); }} className="secondary-button float-right" aria-label="Close sign in">Close</button>
            <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center ${lockoutUntil ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-600'}`}>{lockoutUntil ? <X size={32} /> : <Lock size={32} />}</div>
            <div className="space-y-1"><h2 className="text-2xl font-bold text-slate-900">Owner sign in</h2><p className="text-slate-500">{lockoutUntil ? `Try again in ${countdown}s` : 'Enter the password to make changes.'}</p></div>
            <form onSubmit={(e) => { e.preventDefault(); if (!pwInput || lockoutUntil) return; localStorage.setItem('todo_tracker_pw', pwInput); setAppPassword(pwInput); }} className="space-y-4">
              <input type="password" aria-label="Password" disabled={!!lockoutUntil} value={pwInput} onChange={(e) => setPwInput(e.target.value)} placeholder="Password" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" autoFocus />
              {isAuthError && lockoutUntil && <p className="text-sm text-red-600">That password was not accepted.</p>}
              <button type="submit" disabled={!!lockoutUntil} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 flex items-center justify-center gap-2 disabled:opacity-50"><LogIn size={20} /> Sign in</button>
            </form>
          </div>
        </div>
      )}
      {isOwner && showDebugPanel && (
        <div role="dialog" aria-modal="true" aria-label="Settings" className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[410] flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-3xl max-h-[calc(100dvh-1rem)] sm:max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 sm:p-5 border-b flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Settings size={20} className="text-indigo-600" /> Settings & diagnostics</h3>
                <p className="text-xs text-slate-500 mt-1">{missingPhotoEntries.length} photo{missingPhotoEntries.length === 1 ? '' : 's'} missing a taken date</p>
              </div>
              <button type="button" onClick={() => setShowDebugPanel(false)} className="secondary-button">Close</button>
            </div>
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between gap-3 p-3 border border-slate-200 rounded-xl"><span className="text-sm text-slate-600">Signed in to your tracker</span><button type="button" onClick={() => { setShowDebugPanel(false); signOut(); }} className="secondary-button"><LogOut size={16} />Sign out</button></div>
              <div className="p-4 rounded-2xl border border-indigo-200 bg-indigo-50/40 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2"><BookOpen size={16} className="text-indigo-600" /> Diary sync from photos</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">Uses each photo's EXIF taken date to fill missing diary visits. One entry is created per saved location per day, and existing manual entries are left alone.</p>
                  </div>
                  <span className="shrink-0 px-2 py-1 rounded-full bg-white border border-indigo-100 text-xs font-semibold text-indigo-600">{diaryPhotoCandidates.length} ready</span>
                </div>
                <label className="flex items-center justify-between gap-4 cursor-pointer">
                  <div>
                    <p className="text-xs font-bold text-slate-700">Automatic photo diary sync</p>
                    <p className="text-xs text-slate-400 mt-0.5">Runs after tracker data loads while you are signed in.</p>
                  </div>
                  <input type="checkbox" checked={autoDiaryPhotoSync} onChange={event => setAutoDiaryPhotoSync(event.target.checked)} className="accent-indigo-600 w-4 h-4 shrink-0" />
                </label>
                <button
                  type="button"
                  disabled={isDiaryPhotoSyncing || diaryPhotoCandidates.length === 0}
                  onClick={() => void syncDiaryFromPhotos(false)}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isDiaryPhotoSyncing ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
                  {isDiaryPhotoSyncing ? 'Syncing diary…' : diaryPhotoCandidates.length > 0 ? `Sync ${diaryPhotoCandidates.length} visit${diaryPhotoCandidates.length === 1 ? '' : 's'} now` : 'Diary is in sync'}
                </button>
              </div>

              <div className="pt-1">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h4 className="text-xs font-semibold tracking-wide text-slate-400">Photo EXIF diagnostics</h4>
                  <span className="text-xs text-slate-400">{missingPhotoEntries.length} missing taken date{missingPhotoEntries.length === 1 ? '' : 's'}</span>
                </div>
              {missingPhotoEntries.length === 0 ? (
                <div className="py-12 text-center text-sm font-semibold text-slate-500">All photos have a taken date.</div>
              ) : (
                missingPhotoEntries.map(({ item, photo }) => (
                  <div key={photo.url} className="flex gap-3 p-3 rounded-2xl border border-amber-200 bg-amber-50/40">
                    <img src={photo.url} alt="" className="w-20 h-20 rounded-xl object-cover bg-slate-100 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-800 truncate">{item.name}</p>
                      <p className="text-xs text-slate-500 truncate">{item.address}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          disabled={debugCheckingUrl === photo.url}
                          onClick={async () => {
                            setDebugCheckingUrl(photo.url);
                            try {
                              const result = await handleSinglePhotoMetadataCheck(photo.url);
                              setDebugPhotoResults(current => ({ ...current, [photo.url]: result }));
                            } catch (error: any) {
                              setDebugPhotoResults(current => ({ ...current, [photo.url]: error.message || 'Check failed.' }));
                            } finally {
                              setDebugCheckingUrl(null);
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold disabled:opacity-50"
                        >
                          {debugCheckingUrl === photo.url ? 'Checking…' : 'Check EXIF'}
                        </button>
                        <button
                          onClick={() => { setActivePhotoItem(item); setShowDebugPanel(false); }}
                          className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-bold"
                        >
                          Open photos
                        </button>
                      </div>
                      {debugPhotoResults[photo.url] && <p className="mt-2 text-xs text-slate-500 break-words">{debugPhotoResults[photo.url]}</p>}
                    </div>
                  </div>
                ))
              )}
              </div>
            </div>
            {missingPhotoEntries.length > 0 && (
              <div className="p-4 border-t bg-slate-50 shrink-0">
                <button
                  onClick={async () => {
                    try { await handlePhotoMetadataBackfill(); }
                    catch (error: any) { setToastMessage(error.message || 'Bulk recovery failed.'); }
                  }}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold"
                >
                  Retry recovery for all missing photos
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {activePhotoItem && (<PhotoModal
        item={activePhotoItem}
        isOpen={!!activePhotoItem}
        onClose={() => setActivePhotoItem(null)}
        onUpload={(photo) => handlePhotoUpload(activePhotoItem, photo)}
        onCommentSave={(url, comment) => handlePhotoCommentSave(activePhotoItem, url, comment)}
        onDeletePhoto={(url) => handlePhotoDelete(activePhotoItem, url)}
        onBackfillPhotoDates={handlePhotoMetadataBackfill}
        onCheckPhotoDate={handleSinglePhotoMetadataCheck}
        appPassword={appPassword}
        onExpand={(urls, index) => setLightboxState({ urls, index })}
        onError={setToastMessage}
      />)}
      {isOwner && editingItem && (<EditLocationModal item={editingItem} onSave={updatePlace} onDelete={deletePlace} onClose={() => setEditingItem(null)} />)}
      {isOwner && pendingPlace && showEventDateDialog && (
        <EventDateDialog
          placeName={pendingName || pendingPlace.display_name.split(',')[0]}
          isAdding={isAdding}
          onConfirm={(startDate, endDate) => addPlace('Events', startDate, endDate)}
          onCancel={() => setShowEventDateDialog(false)}
        />
      )}
      {isOwner && showDiaryDialog && (
        <div role="dialog" aria-modal="true" aria-label="Add diary entry" className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[120] flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2"><BookOpen size={20} className="text-indigo-600" /> Add Diary Entry</h3>
                <p className="text-xs text-slate-500 mt-1">Record today or catch up on an earlier day.</p>
              </div>
              <button type="button" onClick={resetDiaryDialog} className="secondary-button">Close</button>
            </div>

            <label className="block">
              <span className="text-xs font-semibold tracking-wide text-slate-400">Date</span>
              <input type="date" value={diaryDate} max={format(new Date(), 'yyyy-MM-dd')} onChange={event => setDiaryDate(event.target.value)} className="mt-1 w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
            </label>

            <div>
              <span className="text-xs font-semibold tracking-wide text-slate-400">Location</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-1 p-1 bg-slate-100 rounded-xl">
                {([
                  { id: 'existing', label: 'Tracker' },
                  { id: 'search', label: 'Search' },
                  { id: 'current', label: 'Current' },
                  { id: 'none', label: 'No location' }
                ] as const).map(option => (
                  <button key={option.id} onClick={() => { setDiarySource(option.id); setDiaryPlace(null); setDiarySearch(''); setDiarySearchResults([]); }} className={`px-2 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${diarySource === option.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>{option.label}</button>
                ))}
              </div>
            </div>

            {diarySource === 'existing' && (
              <div className="space-y-2">
                <input value={diarySearch} onChange={event => setDiarySearch(event.target.value)} placeholder="Filter your saved places..." className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                  {[...places.map(place => ({ ...place, type: 'place' })), ...hotels.map(hotel => ({ ...hotel, type: 'hotel', category: 'Hotels' }))]
                    .filter(item => item.scope === activeScope && (!diarySearch.trim() || `${item.name} ${item.address}`.toLowerCase().includes(diarySearch.toLowerCase())))
                    .map(item => (
                      <button key={`${item.type}:${item.id}`} onClick={() => chooseDiaryPlace(item)} className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 ${diaryPlace?.id === item.id && diaryPlace?.type === item.type ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-slate-100 hover:border-indigo-200'}`}>
                        <span className="min-w-0"><span className="block text-xs font-bold text-slate-800 truncate">{item.name}</span><span className="block text-xs text-slate-400 truncate">{item.address}</span></span>
                        <span className={`text-xs font-semibold uppercase px-1.5 py-0.5 rounded-full shrink-0 ${item.status === 'Visited' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{item.status}</span>
                      </button>
                    ))}
                </div>
              </div>
            )}

            {diarySource === 'search' && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input value={diarySearch} onChange={event => setDiarySearch(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); searchDiaryPlaces(); } }} placeholder="Search for any place..." className="flex-1 min-w-0 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                  <button onClick={searchDiaryPlaces} disabled={isDiarySearching} className="px-3 rounded-xl bg-indigo-600 text-white disabled:opacity-50">{isDiarySearching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}</button>
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1.5">
                  {diarySearchResults.map((result, index) => (
                    <button key={index} onClick={() => chooseDiaryPlace({ id: '', type: '', name: result.display_name.split(',')[0], address: result.display_name, lat: Number(result.lat), lng: Number(result.lon), status: '' })} className="w-full p-2.5 rounded-xl border border-slate-100 hover:border-indigo-200 text-left">
                      <span className="block text-xs font-bold text-slate-800 truncate">{result.display_name.split(',')[0]}</span>
                      <span className="block text-xs text-slate-400 truncate">{result.display_name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {diarySource === 'current' && (
              <button onClick={useCurrentDiaryLocation} disabled={isLocating} className="w-full py-3 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50 text-indigo-600 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                {isLocating ? <Loader2 size={18} className="animate-spin" /> : <LocateFixed size={18} />} {isLocating ? 'Finding location...' : 'Use my current location'}
              </button>
            )}

            {diaryPlace && (
              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                <p className="text-xs font-bold text-indigo-800">{diaryPlace.name}</p>
                <p className="text-xs text-indigo-500 truncate mt-0.5">{diaryPlace.address}</p>
              </div>
            )}

            <label className="block">
              <span className="text-xs font-semibold tracking-wide text-slate-400">What did you do?</span>
              <input value={diaryTitle} onChange={event => setDiaryTitle(event.target.value)} placeholder="e.g. Museum of the Weird" className="mt-1 w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold tracking-wide text-slate-400">Memory or notes</span>
              <textarea value={diaryNotes} onChange={event => setDiaryNotes(event.target.value)} placeholder="Anything worth remembering..." className="mt-1 w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm h-24 resize-none outline-none focus:ring-2 focus:ring-indigo-500" />
            </label>

            {diaryPlace?.status === 'To Do' && (
              <label className="flex items-center gap-2 p-3 rounded-xl bg-green-50 text-green-800 text-xs font-semibold cursor-pointer">
                <input type="checkbox" checked={diaryMarkVisited} onChange={event => setDiaryMarkVisited(event.target.checked)} className="accent-green-600" />
                Also mark this tracker location as Visited
              </label>
            )}

            <button onClick={saveDiaryEntry} disabled={isAdding || !diaryTitle.trim()} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {isAdding ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Save Diary Entry
            </button>
          </div>
        </div>
      )}
      {lightboxState && (<Lightbox urls={lightboxState.urls} initialIndex={lightboxState.index} onClose={() => setLightboxState(null)} />)}
      {isOwner && showAddPlace && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-3 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="add-place-heading">
          <section className="add-place-dialog bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90dvh] overflow-y-auto p-5 sm:p-6 space-y-5">
            <div className="flex justify-between items-center gap-3"><h2 id="add-place-heading" className="text-xl font-bold">Add place</h2><button type="button" className="secondary-button" onClick={() => { if (pendingPlace) { setPendingPlace(null); setPendingDetails(''); } else { setShowAddPlace(false); setSearchResults([]); setSearchQuery(''); } }}>{pendingPlace ? 'Back to search' : 'Close'}</button></div>
            {!pendingPlace ? <>
              <form onSubmit={async (event) => {
                event.preventDefault(); if (!searchQuery.trim()) return;
                setIsSearching(true);
                try {
                  const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}${SCOPE_CONFIG[activeScope].searchParams}`);
                  if (!response.ok) throw new Error('Search failed');
                  setSearchResults(await response.json());
                } catch { setToastMessage('Could not search for that place. Please try again.'); }
                finally { setIsSearching(false); }
              }} className="space-y-3">
                <label className="place-field"><span>Name or address in {activeScope}</span><input autoFocus type="search" aria-label="Search for a new place" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="e.g. Museum of the Weird" /></label>
                <button type="submit" className="primary-button w-full" disabled={isSearching || !searchQuery.trim()}>{isSearching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}Search places</button>
              </form>
              <div className="space-y-2">{searchResults.map((result, index) => <button key={index} type="button" onClick={() => { setPendingPlace(result); setPendingName(result.display_name.split(',')[0]); setPendingDetails(''); }} className="search-result"><strong>{result.display_name.split(',')[0]}</strong><span>{result.display_name.split(',').slice(1).join(',')}</span></button>)}</div>
            </> : <>
              <p className="text-sm text-slate-500">{pendingPlace.display_name}</p>
              <label className="place-field"><span>Name</span><input value={pendingName} onChange={event => setPendingName(event.target.value)} /></label>
              <label className="place-field"><span>Details</span><textarea value={pendingDetails} onChange={event => setPendingDetails(event.target.value)} placeholder="What makes this place worth a visit?" /></label>
              <div className="space-y-2"><p className="text-sm font-semibold">Choose a category to save</p><div className="grid grid-cols-2 gap-2">{placeCategories.filter(category => category !== 'All').map(category => <button key={category} type="button" className="secondary-button" disabled={isAdding} onClick={() => category === 'Events' ? setShowEventDateDialog(true) : addPlace(category)}>{isAdding && <Loader2 size={16} className="animate-spin" />}{category}</button>)}</div></div>
            </>}
          </section>
        </div>
      )}
      <div className="tracker-workspace">
        <TrackerNavigation activeSection={activeSection} onNavigate={navigateSection} counts={sectionCounts} isOwner={isOwner} isDarkMode={isDarkMode} onToggleTheme={() => setIsDarkMode(current => !current)} onSettings={() => setShowDebugPanel(true)} onSignIn={() => { setIsAuthError(false); setShowSignIn(true); }} onSignOut={signOut} />
        <div className="tracker-body">
          <header className="tracker-topbar">
            <h1>{activeSection}</h1>
            <div className="topbar-actions">
              <label className="scope-picker"><MapPin size={16} /><select aria-label="Tracker region" value={activeScope} onChange={event => { setActiveScope(event.target.value as ScopeName); setActiveRouteId(null); setMapTarget(null); setHoveredId(null); setSelectedMapId(null); setIsJourneyMode(false); }} >{SCOPE_NAMES.map(scope => <option key={scope} value={scope}>{SCOPE_CONFIG[scope].label}</option>)}</select><ChevronDown size={14} /></label>
              <button type="button" className="mobile-utility icon-button" onClick={() => setIsDarkMode(current => !current)} aria-label={isDarkMode ? 'Use light mode' : 'Use dark mode'}>{isDarkMode ? <Sun size={18} /> : <Moon size={18} />}</button>
              {isOwner ? <button type="button" className="mobile-utility icon-button" onClick={() => setShowDebugPanel(true)} aria-label="Settings"><Settings size={18} /></button> : <button type="button" className="mobile-utility icon-button" onClick={() => { setIsAuthError(false); setShowSignIn(true); }} aria-label="Owner sign in"><LogIn size={18} /></button>}
            </div>
          </header>
          <div className="workspace-toolbar">
            <label className="collection-search"><Search size={18} /><input type="search" value={listSearch} onChange={event => setListSearch(event.target.value)} aria-label={`Search ${activeSection.toLowerCase()}`} placeholder={activeSection === 'Places' || activeSection === 'Nearby' ? 'Search your places…' : `Search ${activeSection.toLowerCase()}…`} />{listSearch && <button type="button" onClick={() => setListSearch('')} aria-label="Clear search"><X size={16} /></button>}</label>
            <div className="toolbar-actions">
              <div className="view-switch" role="group" aria-label="Layout">{[{ id: 'list', icon: List, label: 'List' }, ...(windowWidth >= 900 ? [{ id: 'split', icon: Columns2, label: 'Split' }] : []), { id: 'map', icon: MapIcon, label: 'Map' }].map(({ id, icon: Icon, label }) => <button key={id} type="button" onClick={() => setView(id)} className={view === id || (windowWidth < 900 && view === 'split' && id === 'list') ? 'is-active' : ''} aria-label={`${label} view`} aria-pressed={view === id || (windowWidth < 900 && view === 'split' && id === 'list')}><Icon size={17} /><span>{label}</span></button>)}</div>
              {isOwner && activeSection !== 'Pins' && !isJourneyMode && <button type="button" className="primary-button collection-add" onClick={() => { if (activeSection === 'Trips') createTrip(); else if (activeSection === 'Diary') setShowDiaryDialog(true); else setShowAddPlace(true); }}><Plus size={18} /><span>{activeSection === 'Trips' ? 'New trip' : activeSection === 'Diary' ? 'Add entry' : 'Add place'}</span></button>}
            </div>
          </div>
          {(activeSection === 'Places' || activeSection === 'Nearby') && <div className="collection-filters">
            {activeSection === 'Places' && <div className="status-switch" role="group" aria-label="Visit status">{[{ id: 'TODO', label: 'To do', count: toDoCount }, { id: 'Visited', label: 'Visited', count: visitedCount }, { id: 'All', label: 'All', count: scopedItems.length }].map(option => <button key={option.id} type="button" onClick={() => setFilter(option.id)} className={filter === option.id ? 'is-active' : ''} aria-pressed={filter === option.id}>{option.label}<span>{option.count}</span></button>)}</div>}
            <label className="category-picker"><Filter size={15} /><select aria-label="Place category" value={placeCategory} onChange={event => setPlaceCategory(event.target.value)}>{placeCategories.map(category => <option key={category} value={category}>{category === 'All' ? 'All categories' : category}</option>)}</select></label>
          </div>}
          <main className="tracker-main">
            {error && <div role="alert" className="tracker-error">{error}<button type="button" onClick={() => setError(null)} aria-label="Dismiss error"><X size={16} /></button></div>}
            <div ref={listPanelRef} style={{ width: `${effectiveSidebarWidth}%` }} data-view={view} className={`collection-panel ${view === 'map' ? 'is-hidden' : ''}`}>
          {isLoading ? <div className="collection-empty" role="status"><Loader2 size={28} className="animate-spin" /><p>Loading your tracker…</p></div> : filter === 'Diary' ? (
            <section className="space-y-5">
              <p className="collection-caption">{Object.values(diaryGroups).flat().length} entries · Most recent first</p>
              {Object.keys(diaryGroups).length === 0 ? (
                <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-slate-100">
                  <BookOpen size={36} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-medium">{listSearch ? 'No diary entries match your search.' : `No diary entries for ${activeScope} yet.`}</p>
                </div>
              ) : Object.entries(diaryGroups).map(([date, entries]) => (
                <div key={date} className="space-y-2">
                  <h3 className="text-xs font-semibold text-indigo-400 uppercase tracking-[0.16em] px-1">{format(parseISO(date), 'EEEE, d MMMM yyyy')}</h3>
                  {entries.map(entry => (
                    <div key={entry.id} className={`bg-white p-4 rounded-2xl border border-slate-100 shadow-sm ${entry.lat && entry.lng ? 'cursor-pointer hover:border-indigo-200' : ''}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="font-bold text-base text-slate-900">{entry.lat && entry.lng ? <button type="button" className="text-left hover:text-indigo-600" onClick={() => locateItem(entry)}>{entry.title}</button> : entry.title}</h4>
                          {entry.address && <p className="text-xs text-indigo-500 mt-1 flex items-center gap-1 truncate"><MapPin size={11} className="shrink-0" /> {entry.address}</p>}
                        </div>
                        {isOwner && <button onClick={event => { event.stopPropagation(); deleteDiaryEntry(entry); }} className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete diary entry"><Trash2 size={16} /></button>}
                      </div>
                      {entry.notes && <p className="text-sm text-slate-600 mt-3 whitespace-pre-wrap leading-relaxed">{entry.notes}</p>}
                    </div>
                  ))}
                </div>
              ))}
            </section>
          ) : filter === 'Trips' ? (
            <section className="space-y-6">
              <p className="collection-caption">{routes.filter(route => route.scope === activeScope && matchesSearch(route)).length} trips · Active trips first</p>

              {isJourneyMode && (
                <div className="trip-builder bg-indigo-600 p-4 rounded-2xl shadow-lg space-y-4 animate-in slide-in-from-top-4 duration-300">
                  <div className="flex items-center justify-between">
                    <h3 className="text-white font-bold text-sm flex items-center gap-2"><Navigation size={18} /> Creating Trip</h3>
                    <button type="button" onClick={() => setIsJourneyMode(false)} className="text-white/70 hover:text-white px-2">Cancel</button>
                  </div>
                  <input
                    type="text"
                    value={journeyName}
                    onChange={(e) => setJourneyName(e.target.value)}
                    placeholder="Trip name (e.g. Dallas weekend)"
                    className="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-white/50 outline-none focus:ring-2 focus:ring-white/30 text-sm"
                  />
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-white/10 rounded-xl">
                    {([
                      { id: 'ordered', label: 'Ordered', description: 'Follow a planned route' },
                      { id: 'unordered', label: 'Unordered', description: 'Complete in any order' }
                    ] as const).map(option => (
                      <button
                        key={option.id}
                        onClick={() => setTripType(option.id)}
                        className={`p-2 rounded-lg text-left transition-all ${tripType === option.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-white/60 hover:text-white'}`}
                      >
                        <span className="block text-xs font-semibold tracking-wide">{option.label}</span>
                        <span className="block text-xs opacity-70 mt-0.5">{option.description}</span>
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1.5 p-1 bg-white/10 rounded-xl">
                    {['All', 'To Do', 'Visited'].map(cat => (
                      <button
                        key={cat}
                        onClick={() => setJourneyFilter(cat)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${journeyFilter === cat ? 'bg-white text-indigo-600 shadow-sm' : 'text-white/60 hover:text-white'}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  {tripType === 'ordered' && <div className="flex gap-1.5 p-1 bg-white/10 rounded-xl">
                    {[
                      { id: 'shortest', label: 'Shortest distance' },
                      { id: 'added', label: 'Order added' }
                    ].map(option => (
                      <button
                        key={option.id}
                        onClick={() => setJourneySortMode(option.id as 'shortest' | 'added')}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${journeySortMode === option.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-white/60 hover:text-white'}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>}
                  <div className="space-y-2">
                    <p className="text-white/70 text-xs font-bold tracking-wide">
                      {tripType === 'unordered' ? 'Any order' : journeySortMode === 'shortest' ? 'Start Point + Shortest Path' : 'Order Added'}: {selectedJourneyPlaces.length} places
                    </p>
                    {selectedJourneyPlaces.length === 0 && (
                      <div className="bg-white/10 border border-white/15 rounded-xl p-3 text-white">
                        <p className="text-xs font-semibold tracking-wide">{tripType === 'ordered' ? 'Pick your start point first' : 'Pick places for the trip'}</p>
                        <p className="text-xs text-white/60 mt-1 leading-snug">
                          {tripType === 'unordered'
                            ? 'There is no fixed route. Finish places in whichever order suits the day.'
                            : journeySortMode === 'shortest'
                            ? 'After that, each new stop is ordered into the shortest available route from your start.'
                            : 'After that, stops stay in the exact order you add them.'}
                        </p>
                      </div>
                    )}
                    {currentRoutePoints.length > 0 && (
                      <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 no-scrollbar">
                        {currentRoutePoints.map((p, i) => (
                          <div key={`${p.type}:${p.id}`} className={`flex items-center justify-between p-2 rounded-lg group/item ${tripType === 'ordered' && i === 0 ? 'bg-white text-indigo-700 ring-2 ring-white/40' : 'bg-white/10'}`}>
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`text-xs font-semibold w-4 ${tripType === 'ordered' && i === 0 ? 'text-indigo-300' : 'text-white/40'}`}>{tripType === 'ordered' ? i + 1 : '•'}</span>
                              <span className={`text-xs font-bold truncate ${tripType === 'ordered' && i === 0 ? 'text-indigo-700' : 'text-white'}`}>{p.name}</span>
                              {tripType === 'ordered' && i === 0 && <span className="text-xs font-semibold tracking-wide bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full shrink-0">Start</span>}
                            </div>
                            <button
                              onClick={() => toggleJourneyPlace(`${p.type}:${p.id}`)}
                              className={`transition-colors ${tripType === 'ordered' && i === 0 ? 'text-indigo-300 hover:text-indigo-700' : 'text-white/30 hover:text-white'}`}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={saveRoute}
                        disabled={selectedJourneyPlaces.length === 0 || !journeyName || isSavingRoute}
                        className="flex-1 bg-white text-indigo-600 py-2 rounded-xl font-bold text-xs hover:bg-indigo-50 disabled:opacity-50 transition-all flex items-center justify-center gap-1"
                      >
                        {isSavingRoute ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Trip
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-white/50 leading-tight">
                    {tripType === 'unordered'
                      ? 'Unchecked places stay at the top while you are taking the trip.'
                      : journeySortMode === 'shortest'
                      ? 'Your first selection stays as the start point. The remaining stops are ordered by shortest path.'
                      : 'Your first selection stays as the start point. The remaining stops stay in the order you added them.'}
                  </p>
                </div>
              )}

              {isJourneyMode ? (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <h3 className="text-xs font-bold text-slate-400 tracking-wide px-1">Select Locations</h3>
                  <div className="space-y-2">
                    {displayItems.map(item => {
                      const itemId = `${item.type}:${item.id}`;
                      const isSelected = selectedJourneyPlaces.includes(itemId);
                      const isStart = tripType === 'ordered' && selectedJourneyPlaces[0] === itemId;
                      return (
                        <div
                          key={itemId}
                          onMouseEnter={() => setHoveredId(itemId)}
                          onMouseLeave={() => setHoveredId(null)}
                          role="checkbox" aria-checked={isSelected} tabIndex={0}
                          onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleJourneyPlace(itemId); } }}
                          onClick={() => toggleJourneyPlace(itemId)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex justify-between items-center group ${isStart ? 'bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-200 shadow-md' : isSelected ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-200' : 'bg-white border-slate-100 hover:border-indigo-100'} ${hoveredId === itemId ? 'translate-x-1 shadow-sm' : ''}`}
                        >
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold uppercase ${isStart ? 'text-white/60' : 'text-slate-400'}`}>{item.category}</span>
                              {isStart && <span className="text-xs font-semibold tracking-wide bg-white/15 text-white px-1.5 py-0.5 rounded-full">Start</span>}
                            </div>
                            <h4 className="font-semibold text-xs truncate">{item.name}</h4>
                            <PriorityRating priority={item.priority} readOnly compact onChange={() => {}} />
                          </div>
                          <div className={`transition-colors ${isStart ? 'text-white' : isSelected ? 'text-indigo-600' : 'text-slate-200'}`}>
                            {isSelected ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {routes.filter(r => r.scope === activeScope && matchesSearch(r)).sort((a, b) => ({ active: 0, planned: 1, completed: 2 }[a.status] - { active: 0, planned: 1, completed: 2 }[b.status])).map(route => {
                    const remainingIds = route.placeIds.filter(id => !route.completedPlaceIds.includes(id));
                    const completedIds = route.placeIds.filter(id => route.completedPlaceIds.includes(id));
                    const tripItems = getJourneyItems([...remainingIds, ...completedIds]);
                    return <div
                      key={route.id}
                      className={`p-4 rounded-xl border transition-all cursor-pointer group ${activeRouteId === route.id ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200 shadow-sm' : 'bg-white border-slate-100 hover:border-indigo-100'}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <h3 className="font-bold text-base text-slate-900"><button type="button" className="text-left hover:text-indigo-600" aria-expanded={activeRouteId === route.id} onClick={() => setActiveRouteId(activeRouteId === route.id ? null : route.id)}>{route.name}</button></h3>
                          <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold tracking-wide">
                            <span className="text-slate-400">{route.completedPlaceIds.length}/{route.placeIds.length} complete</span>
                            <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{route.tripType}</span>
                            <span className={`px-1.5 py-0.5 rounded-full ${route.status === 'completed' ? 'bg-green-100 text-green-700' : route.status === 'active' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>{route.status}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isOwner && route.status === 'planned' && <button
                            onClick={(e) => { e.stopPropagation(); startTrip(route); setActiveRouteId(route.id); }}
                            className="px-2 py-1.5 text-xs font-semibold tracking-wide text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-all"
                            title="Start Trip"
                          >
                            Start
                          </button>}
                          {isOwner && route.status === 'active' && <button
                            onClick={(e) => { e.stopPropagation(); completeRoute(route); }}
                            className="p-1.5 text-slate-300 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all"
                            title="Complete Trip"
                          >
                            <CheckSquare size={18} />
                          </button>}
                          {isOwner && <button
                            onClick={(e) => { e.stopPropagation(); deleteRoute(route.id); }}
                            className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Delete Trip"
                            disabled={isSavingRoute}
                          >
                            {isSavingRoute ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                          </button>}
                          <RouteIcon size={20} className={activeRouteId === route.id ? 'text-indigo-600' : 'text-slate-300'} />
                        </div>
                      </div>
                      {activeRouteId === route.id && (
                        <div className="mt-4 pt-4 border-t border-indigo-100 space-y-3 animate-in fade-in duration-300">
                          {tripItems.map((p) => {
                            const compositeId = `${p.type}:${p.id}`;
                            const isComplete = route.completedPlaceIds.includes(compositeId);
                            const orderedPosition = route.placeIds.indexOf(compositeId) + 1;
                            return <button
                              key={compositeId}
                              type="button"
                              disabled={!isOwner || route.status !== 'active'}
                              onClick={(e) => { e.stopPropagation(); toggleTripPlace(route, compositeId); }}
                              className={`w-full flex items-center gap-3 text-left rounded-lg p-1.5 transition-colors ${route.status === 'active' ? 'hover:bg-white' : 'cursor-default'} ${isComplete ? 'opacity-55' : ''}`}
                            >
                              <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${isComplete ? 'bg-green-600 border-green-600 text-white' : 'border-indigo-300 text-indigo-600'}`}>
                                {isComplete ? <Check size={13} strokeWidth={3} /> : route.tripType === 'ordered' ? <span className="text-xs font-semibold">{orderedPosition}</span> : <Circle size={12} />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className={`text-xs font-bold text-slate-700 truncate ${isComplete ? 'line-through' : ''}`}>{p.name}</p>
                                <p className="text-xs text-slate-400 truncate">{p.address}</p>
                              </div>
                            </button>;
                          })}
                          {route.status === 'planned' && <p className="text-xs text-slate-500 bg-white/70 rounded-lg p-2">Start this trip to check off places.</p>}
                          {route.status === 'completed' && remainingIds.length > 0 && <p className="text-xs text-slate-500 bg-white/70 rounded-lg p-2">{remainingIds.length} unchecked {remainingIds.length === 1 ? 'place remains' : 'places remain'} in To Do.</p>}
                        </div>
                      )}
                    </div>
                  })}
                  {routes.filter(r => r.scope === activeScope && matchesSearch(r)).length === 0 && (
                    <div className="text-center py-10 text-slate-400">
                      <RouteIcon size={32} className="mx-auto mb-3 opacity-20" />
                      <p className="text-sm font-medium">{listSearch ? 'No trips match your search.' : 'No trips saved yet.'}</p>
                    </div>
                  )}
                </div>
              )}
            </section>
          ) : filter === 'Saved' ? (
            <section className="space-y-3">
              <p className="collection-caption">Home, work, and other reference points</p>
              <div className="grid grid-cols-1 gap-2">
                {markers.filter(m => m.scope === activeScope && matchesSearch(m)).map(m => (
                  <div
                    key={m.id}
                    onClick={() => {
                      if (isJourneyMode) { toggleJourneyPlace(`marker:${m.id}`); return; }
                      const lat = parseFloat(m.lat as any); const lng = parseFloat(m.lng as any);
                      if (!isNaN(lat)) { setMapTarget({ center: [lat, lng], zoom: 15 }); if (windowWidth < 900) setView('map'); else if (view === 'list') setView('split'); }
                    }}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${isJourneyMode && selectedJourneyPlaces.includes(`marker:${m.id}`) ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-200' : 'bg-indigo-50/50 border-indigo-100 hover:bg-indigo-50'}`}
                  >
                    <div className="text-indigo-600">
                      {isJourneyMode && selectedJourneyPlaces.includes(`marker:${m.id}`) ? <CheckCircle2 size={20} /> : (m.type === 'home' ? <Home size={20} /> : <Briefcase size={20} />)}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-sm truncate">{m.name}</h4>
                      <p className="text-xs text-slate-500 truncate">{m.address}</p>
                    </div>
                  </div>
                ))}
              </div>
              {markers.filter(marker => marker.scope === activeScope && matchesSearch(marker)).length === 0 && <div className="collection-empty"><MapPin size={32} /><h3>{listSearch ? 'No matching pins' : 'No pins in this region'}</h3><p>{listSearch ? 'Try a different name or address.' : 'Your home, work, and other reference points appear here.'}</p></div>}
            </section>
          ) : (
            <section className="space-y-6">
              <div className="space-y-4">
                <p className="collection-caption">{displayItems.length} {displayItems.length === 1 ? 'place' : 'places'}{filter === 'Nearby' ? ' · Closest first' : filter === 'Visited' ? ' · Grouped by category' : ' · Highest priority first'}</p>
                {filter === 'Nearby' && (
                  <div className="p-3 bg-white border border-indigo-100 rounded-xl shadow-sm space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                          {isNearbyLocating ? <Loader2 size={16} className="animate-spin" /> : <LocateFixed size={16} />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-700">{nearbyLocation ? 'Closest saved places first' : isNearbyLocating ? 'Finding your location…' : 'Location needed'}</p>
                          <p className="text-xs text-slate-400">{nearbyLocation ? 'Distances update when you refresh your location.' : 'Allow location access to sort your saved places by distance.'}</p>
                        </div>
                      </div>
                      <button type="button" onClick={locateNearby} disabled={isNearbyLocating} className="px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-semibold tracking-wide hover:bg-indigo-100 disabled:opacity-50">
                        {nearbyLocation ? 'Refresh' : 'Locate'}
                      </button>
                    </div>
                    <label className="flex items-center justify-between gap-3 cursor-pointer">
                      <span className="text-xs font-semibold tracking-wide text-slate-500">Show visited places</span>
                      <input type="checkbox" checked={nearbyIncludeVisited} onChange={event => setNearbyIncludeVisited(event.target.checked)} className="accent-indigo-600 w-4 h-4" />
                    </label>
                  </div>
                )}
              </div>
              {isLoading ? <div className="collection-empty" role="status"><Loader2 size={28} className="animate-spin" /><p>Loading your places…</p></div> : displayItems.length === 0 ? <div className="collection-empty"><MapPin size={32} /><h3>{listSearch ? 'No matching places' : filter === 'Nearby' && !nearbyLocation ? 'Find what is nearby' : filter === 'Visited' ? 'No visits yet' : 'Nothing here yet'}</h3><p>{listSearch ? 'Try a different name or clear your filters.' : filter === 'Nearby' && !nearbyLocation ? 'Use your location to see saved places around you.' : placeCategory !== 'All' ? `No ${placeCategory.toLowerCase()} places in this view.` : 'Your places in this region will appear here.'}</p>{(listSearch || placeCategory !== 'All') && <button type="button" className="secondary-button" onClick={() => { setListSearch(''); setPlaceCategory('All'); }}>Clear filters</button>}</div> : (
                (filter === 'Visited' ? Object.entries(visitedGroups) : [['', displayItems]] as [string, (Place & { type: 'place' | 'hotel' })[]][]).map(([category, items]) => <div key={category} className="place-group">
                  {category && <h3 className="group-heading">{category}<span>{items.length}</span></h3>}
                  <div className="place-list">{items.map(item => <PlaceCard key={`${item.type}:${item.id}`} item={item} isOwner={isOwner} distance={filter === 'Nearby' && nearbyLocation ? `${(getDistance(nearbyLocation, item) * 0.621371).toFixed(1)} mi` : undefined} eventDates={item.category === 'Events' ? formatEventDateRange(item.eventStartDate, item.eventEndDate) : undefined} onLocate={() => locateItem(item)} onHover={hovered => setHoveredId(hovered ? `${item.type}:${item.id}` : null)} onUpdate={updates => updatePlace(item.id, updates, item.type)} onEdit={() => setEditingItem(item)} onDelete={() => deletePlace(item)} onPhotos={() => setActivePhotoItem(item)} visitDatePicker={<CustomDatePicker value={item.date || ''} onChange={date => updatePlace(item.id, { date }, item.type)} />} />)}</div>
                </div>)
              )}
            </section>
          )}
        </div>
        <div className={`map-panel ${view === 'list' || (windowWidth < 900 && view !== 'map') ? 'is-hidden' : ''}`} aria-label="Map of saved locations">
          {isLoading && (<div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm z-[20] flex items-center justify-center p-4"><div className="bg-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-indigo-600 font-bold text-sm"><Loader2 size={20} className="animate-spin" /><span>Loading...</span></div></div>)}

          {hoveredItem && (
            <div className={`map-preview absolute top-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-indigo-100 z-[100] p-4 ${selectedMapId ? '' : 'pointer-events-none'}`}>
              <div className="flex justify-between items-start mb-2">
                <div className="min-w-0">
                  <span className="text-xs font-semibold tracking-wide text-indigo-500 mb-0.5 block">{(hoveredItem as any).category || (hoveredItem as any).type}</span>
                  <h3 className="font-bold text-sm text-slate-900 truncate">{(hoveredItem as any).name}</h3>
                </div>
                {selectedMapId ? <button type="button" className="icon-button shrink-0" aria-label="Close map preview" onClick={() => { setSelectedMapId(null); setHoveredId(null); }}><X size={18} /></button> : (hoveredItem as any).status === 'Visited' && <CheckCircle2 size={16} className="text-green-500 shrink-0" />}
              </div>
              <p className="text-xs text-slate-500 mb-3 truncate">{(hoveredItem as any).address}</p>
              {(hoveredItem as any).details && <p className="text-sm text-indigo-600 font-medium italic mb-3 bg-indigo-50/50 p-2 rounded-lg leading-relaxed">{(hoveredItem as any).details}</p>}
              {(hoveredItem as any).category === 'Events' && (hoveredItem as any).eventStartDate && <p className="text-xs text-rose-600 font-bold mb-3 flex items-center gap-1"><Calendar size={12} /> {formatEventDateRange((hoveredItem as any).eventStartDate, (hoveredItem as any).eventEndDate)}</p>}
              {(hoveredItem as any).photos && <div className="rounded-xl overflow-hidden mb-3 ring-1 ring-slate-100"><img src={(hoveredItem as any).photos.split(',')[0]} className="w-full h-32 object-cover" alt="" /></div>}
              {(hoveredItem as any).rating && (
                <div className="flex gap-0.5 text-yellow-500">
                  {Array.from({ length: parseInt((hoveredItem as any).rating) }).map((_, i) => <Star key={i} size={12} fill="currentColor" />)}
                </div>
              )}
              {selectedMapId && <div className="flex gap-2 mt-3">
                <button type="button" className="secondary-button flex-1" onClick={() => { if (hoveredItem.type === 'marker') navigateSection('Pins'); setView('list'); }}>{hoveredItem.type === 'marker' ? 'Show pins' : 'Show in list'}</button>
                {hoveredItem.type !== 'marker' && (isOwner || (hoveredItem as Place).photos) && <button type="button" className="secondary-button" onClick={() => setActivePhotoItem(hoveredItem as Place)}><Camera size={16} />Photos</button>}
              </div>}
            </div>
          )}

          <MapContainer key={activeScope} center={SCOPE_CONFIG[activeScope].center} zoom={SCOPE_CONFIG[activeScope].zoom} className="h-full w-full z-0">
            <TileLayer
              url={isDarkMode ? DARK_MAP_TILE_URL : OPENSTREETMAP_TILE_URL}
              attribution={isDarkMode && cartoApiKey ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>' : '&copy; OpenStreetMap contributors'}
              subdomains={isDarkMode && cartoApiKey ? 'abcd' : 'abc'}
              maxZoom={20}
            />
            <MapController
              center={mapTarget?.center}
              zoom={mapTarget?.zoom}
              bounds={mapTarget?.bounds}
              sidebarWidth={effectiveSidebarWidth}
              windowWidth={windowWidth}
              view={view}
            />
            {showRouteLine && currentRoutePoints.length > 1 && (
              <Polyline
                positions={currentRoutePoints.map(p => [p.lat, p.lng])}
                color="#0f766e"
                weight={4}
                opacity={0.6}
                dashArray="10, 10"
              />
            )}
            {filteredMarkers.map(m => (
              <Marker
                key={m.id}
                position={[m.lat, m.lng]}
                icon={getMarkerIcon(m.type, m.id)}
                eventHandlers={{
                  click: () => {
                    if (isJourneyMode) toggleJourneyPlace(`marker:${m.id}`);
                    else { setSelectedMapId(`marker:${m.id}`); setMapTarget({ center: [m.lat, m.lng], zoom: 15 }); }
                  },
                  mouseover: () => setHoveredId(`marker:${m.id}`),
                  mouseout: () => setHoveredId(null)
                }}
              />
            ))}
            {filteredHotels.filter(h => h.lat && h.lng).map(h => (
              <Marker
                key={h.id}
                position={[h.lat, h.lng]}
                icon={getHotelIcon(h.id)}
                eventHandlers={{
                  click: () => {
                    if (isJourneyMode) toggleJourneyPlace(`hotel:${h.id}`);
                    else { setSelectedMapId(`hotel:${h.id}`); setMapTarget({ center: [h.lat, h.lng], zoom: 15 }); }
                  },
                  mouseover: () => setHoveredId(`hotel:${h.id}`),
                  mouseout: () => setHoveredId(null)
                }}
              />
            ))}
            {filteredPlaces.filter(p => p.lat && p.lng).map(p => (
              <Marker
                key={p.id}
                position={[p.lat, p.lng]}
                icon={getPlaceIcon(p.id)}
                eventHandlers={{
                  click: () => {
                    if (isJourneyMode) toggleJourneyPlace(`place:${p.id}`);
                    else { setSelectedMapId(`place:${p.id}`); setMapTarget({ center: [p.lat, p.lng], zoom: 15 }); }
                  },
                  mouseover: () => setHoveredId(`place:${p.id}`),
                  mouseout: () => setHoveredId(null)
                }}
              />
            ))}
            {filter === 'Diary' && diaryEntries.filter(entry => entry.scope === activeScope && entry.lat && entry.lng).map(entry => (
              <Marker key={`diary:${entry.id}`} position={[entry.lat, entry.lng]} icon={defaultPinIcon}>
                <Popup>
                  <div className="min-w-[180px]">
                    <p className="font-bold text-sm">{entry.title}</p>
                    <p className="text-xs text-slate-500 mt-1">{format(parseISO(entry.date), 'd MMM yyyy')}</p>
                    {entry.notes && <p className="text-xs mt-2">{entry.notes}</p>}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </main>
        </div>
      </div>
      {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}
      {confirmationDialog && (
        <ConfirmationDialog
          message={confirmationDialog.message}
          onConfirm={() => { confirmationDialog.onConfirm(); setConfirmationDialog(null); }}
          onCancel={() => { confirmationDialog.onCancel?.(); setConfirmationDialog(null); }}
        />
      )}
    </div>
  );
};

export default App;
