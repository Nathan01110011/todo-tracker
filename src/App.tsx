import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import 'leaflet/dist/leaflet.css';
import { 
  CheckCircle2, Circle, Map as MapIcon, List, Filter, Home, Briefcase, 
  MapPin, Search, Star, X, Plus, Save, Loader2, Bed, RotateCcw, 
  Lock, LogIn, Info, Trophy, Camera, Upload, Image as ImageIcon, 
  Maximize2, ChevronLeft, ChevronRight, Calendar 
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

const homeIcon = createCustomIcon(Home, '#4f46e5'); // Indigo
const officeIcon = createCustomIcon(Briefcase, '#0891b2'); // Cyan
const hotelMarkerIcon = createCustomIcon(Bed, '#8b5cf6'); // Violet
const defaultPinIcon = createCustomIcon(MapPin, '#64748b'); // Slate

// Types
interface Place {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: string;
  status: string;
  notes: string;
  rating: string;
  scope: string;
  return?: string | boolean;
  type?: 'place' | 'hotel';
  details?: string;
  date?: string;
  photos?: string;
}

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

// Map Controller Component
const MapController = ({ center, zoom, sidebarWidth, windowWidth, view }: any) => {
  const map = useMap();
  const lastCenterRef = useRef<string | null>(null);
  
  useEffect(() => {
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
  }, [center, zoom, map]);

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

// Custom Date Picker Popover Component
const CustomDatePicker = ({ value, onChange }: { value: string, onChange: (date: string) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(value ? parseISO(value) : new Date());
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const renderHeader = () => (
    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
      <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1.5 hover:bg-slate-50 rounded-full text-slate-400 hover:text-indigo-600 transition-colors">
        <ChevronLeft size={18} />
      </button>
      <span className="text-sm font-black text-slate-700 uppercase tracking-wider">
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
        <div key={i} className="text-[10px] font-bold text-slate-400 uppercase text-center py-2">
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

  return (
    <div className="relative w-full" ref={popoverRef}>
      <button 
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className="w-full text-xs font-black text-indigo-600 bg-indigo-50/50 border border-indigo-100/50 rounded-xl pl-9 pr-3 py-2.5 hover:bg-white focus:ring-2 focus:ring-indigo-500 transition-all flex items-center shadow-sm"
      >
        <Calendar size={16} className="absolute left-3 text-indigo-400" strokeWidth={2.5} />
        {value ? format(parseISO(value), 'MMM d, yyyy') : 'Pick a date'}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-[280px] bg-white rounded-2xl shadow-2xl border border-slate-100 z-[200] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {renderHeader()}
          {renderDays()}
          {renderCells()}
          <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
            <button 
              onClick={() => { onChange(''); setIsOpen(false); }}
              className="text-[10px] font-bold text-slate-400 hover:text-red-500 uppercase tracking-wider transition-colors"
            >
              Clear Date
            </button>
            <button 
              onClick={() => { onChange(format(new Date(), 'yyyy-MM-dd')); setIsOpen(false); }}
              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-wider transition-colors"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

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
    <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[300] flex items-center justify-center" onClick={onClose}>
      <button onClick={onClose} className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-[310]"><X size={28} /></button>
      {urls.length > 1 && (
        <>
          <button onClick={prev} className="absolute left-4 top-1/2 -translate-y-1/2 p-4 bg-white/5 hover:bg-white/10 rounded-full text-white transition-all z-[310]"><ChevronLeft size={32} /></button>
          <button onClick={next} className="absolute right-4 top-1/2 -translate-y-1/2 p-4 bg-white/5 hover:bg-white/10 rounded-full text-white transition-all z-[310]"><ChevronRight size={32} /></button>
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

const PhotoModal = ({ item, isOpen, onClose, onUpload, appPassword, onExpand }: { item: Place, isOpen: boolean, onClose: () => void, onUpload: (url: string) => void, appPassword: string | null, onExpand: (urls: string[], index: number) => void }) => {
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photos = useMemo(() => item.photos ? item.photos.split(',').filter(Boolean) : [], [item.photos]);
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
        formData.append('folder', 'tracker_photos');
        const res = await fetch(`https://api.cloudinary.com/v1_1/${sigData.cloudName}/image/upload`, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.secure_url) await onUpload(data.secure_url);
      }
    } catch (err: any) {
      console.error("Secure upload process failed:", err);
      alert(`Upload failed: ${err.message}`);
    } finally {
      setUploadStatus(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl h-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in duration-200">
        <div className="p-4 sm:p-6 border-b flex justify-between items-center bg-indigo-50/30 shrink-0">
          <div><h3 className="text-lg sm:text-xl font-bold text-slate-900">{item.name}</h3><p className="text-xs sm:text-sm text-slate-500 line-clamp-1">{item.address}</p></div>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors"><X size={24} className="text-slate-400" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8">
          {photos.length === 0 ? (
            <div className="h-64 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center gap-4 text-slate-400 bg-slate-50/50"><ImageIcon size={48} strokeWidth={1.5} /><p className="text-sm font-medium">No photos yet for this visit.</p></div>
          ) : (
            <div className="flex flex-col gap-10">
              {photos.map((url, i) => (
                <div key={i} onClick={() => onExpand(photos, i)} className="w-full rounded-2xl sm:rounded-3xl overflow-hidden shadow-lg border border-slate-100 group relative cursor-pointer bg-slate-50 flex items-center justify-center min-h-[300px]">
                  <img src={url} alt={`Visit ${i+1}`} className="w-full h-auto max-h-[75vh] block object-contain transition-transform duration-700 group-hover:scale-[1.02]" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="bg-white/30 backdrop-blur-md p-4 rounded-full text-white shadow-xl"><Maximize2 size={32} strokeWidth={2.5} /></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-4 sm:p-6 border-t bg-slate-50 flex gap-4 shrink-0">
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" multiple className="hidden" />
          <button disabled={!!uploadStatus} onClick={() => fileInputRef.current?.click()} className="flex-1 bg-indigo-600 text-white py-3 rounded-2xl font-bold hover:bg-indigo-700 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-md">
            {uploadStatus ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}{uploadStatus || 'Upload New Photos'}
          </button>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  const [places, setPlaces] = useState<Place[]>([]);
  const [markers, setMarkers] = useState<MarkerData[]>([]);
  const [hotels, setHotels] = useState<Place[]>([]);
  const [filter, setFilter] = useState('All');
  const [activeScope, setActiveScope] = useState('Austin');
  const [visitedFilter, setVisitedFilter] = useState('All');
  const [view, setView] = useState('split');
  const [sidebarWidth, setSidebarWidth] = useState(33.33);
  const [isResizing, setIsResizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mapTarget, setMapTarget] = useState<any>(null);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [activePhotoItem, setActivePhotoItem] = useState<Place | null>(null);
  const [lightboxState, setLightboxState] = useState<{ urls: string[], index: number } | null>(null);
  const [appPassword, setAppPassword] = useState<string | null>(localStorage.getItem('todo_tracker_pw'));
  const [pwInput, setPwInput] = useState('');
  const [isAuthError, setIsAuthError] = useState(false);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(() => {
    const saved = localStorage.getItem('todo_tracker_lockout');
    return saved && parseInt(saved) > Date.now() ? parseInt(saved) : null;
  });
  const [countdown, setCountdown] = useState(0);

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
  const [pendingPlace, setPendingPlace] = useState<any>(null);
  const [pendingName, setPendingName] = useState('');
  const [pendingDetails, setPendingDetails] = useState('');

  useEffect(() => {
    const handleResize = () => { setWindowWidth(window.innerWidth); if (window.innerWidth >= 640 && view === 'map') setView('split'); };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [view]);

  useEffect(() => { if (filter !== 'Visited') setVisitedFilter('All'); }, [filter]);

  useEffect(() => {
    if (!appPassword || lockoutUntil) { setIsLoading(false); return; }
    setIsLoading(true);
    fetch('/api/places', { headers: { 'Authorization': appPassword } })
      .then(res => {
        if (res.status === 423) return res.json().then(data => { setLockoutUntil(Date.now() + (data.retryAfter * 1000)); setIsAuthError(true); throw new Error('System Locked'); });
        if (res.status === 401) { localStorage.removeItem('todo_tracker_pw'); setAppPassword(null); setIsAuthError(true); setLockoutUntil(Date.now() + 30000); throw new Error('Unauthorized'); }
        if (!res.ok) return res.json().then(err => { throw new Error(err.error || 'Failed to fetch'); });
        return res.json();
      })
      .then(data => { setPlaces(data.places || []); setMarkers(data.markers || []); setHotels(data.hotels || []); setIsAuthError(false); })
      .catch(err => { if (err.message !== 'Unauthorized' && err.message !== 'System Locked') setError(err.message); })
      .finally(() => setIsLoading(false));
  }, [appPassword, lockoutUntil === null]);

  const updatePlace = async (id: string, data: any, type: 'place' | 'hotel' = 'place') => {
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

  const addPlace = async (category: string) => {
    if (!pendingPlace) return; setIsAdding(true);
    const isHotel = category === 'Hotels';
    const newEntry: any = { name: pendingName || pendingPlace.display_name.split(',')[0], address: pendingPlace.display_name.split(',').slice(1).join(',').trim(), lat: parseFloat(pendingPlace.lat), lng: parseFloat(pendingPlace.lon), category: isHotel ? 'Hotels' : category, status: 'To Do', notes: '', rating: '', scope: activeScope, type: isHotel ? 'hotel' : 'place', details: pendingDetails };
    try {
      const res = await fetch('/api/places', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': appPassword || '' }, body: JSON.stringify(newEntry) });
      const data = await res.json();
      if (data.success) { if (isHotel) setHotels(prev => [...prev, { ...newEntry, id: data.id }]); else setPlaces(prev => [...prev, { ...newEntry, id: data.id }]); setPendingPlace(null); setPendingName(''); setPendingDetails(''); setSearchQuery(''); setSearchResults([]); setFilter(isHotel ? 'Hotels' : 'All'); }
    } catch (err) { setError("Failed to add entry."); } finally { setIsAdding(false); }
  };

  const handlePhotoUpload = async (item: Place, url: string) => {
    if (!appPassword) return;
    try {
      const response = await fetch('/api/places', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': appPassword }, body: JSON.stringify({ id: item.id, photoUrl: url }), });
      if (response.ok) {
        const up = (p: string | undefined) => { const ex = p ? p.split(',') : []; return [...ex, url].join(','); };
        if (item.type === 'hotel') setHotels(prev => prev.map(h => h.id === item.id ? { ...h, photos: up(h.photos) } : h));
        else setPlaces(prev => prev.map(p => p.id === item.id ? { ...p, photos: up(p.photos) } : p));
        setActivePhotoItem(prev => (prev && prev.id === item.id ? { ...prev, photos: up(prev.photos) } : prev));
      }
    } catch (err) { alert("Photo linked failed."); }
  };

  const categories = ['All', 'Food', 'Drinks', 'Activities', 'Sport', 'Hotels', 'Saved', 'Visited'];
  const effectiveSidebarWidth = useMemo(() => { if (windowWidth < 640) return view === 'map' ? 0 : 100; if (view === 'map') return 0; if (filter === 'Visited') return 66.66; return sidebarWidth; }, [windowWidth, view, filter, sidebarWidth]);

  const filteredMarkers = useMemo(() => markers.filter(m => m.scope === activeScope), [markers, activeScope]);

  const filteredPlaces = useMemo(() => {
    const scopePlaces = places.filter(p => p.scope === activeScope);
    if (filter === 'Visited') {
      let res = scopePlaces.filter(p => p.status === 'Visited');
      if (visitedFilter !== 'All') res = res.filter(p => p.category === visitedFilter);
      return res;
    }
    if (filter === 'All') return scopePlaces.filter(p => p.status === 'To Do');
    if (filter === 'Hotels' || filter === 'Saved') return [];
    return scopePlaces.filter(p => p.category === filter && p.status === 'To Do');
  }, [places, filter, activeScope, visitedFilter]);

  const filteredHotels = useMemo(() => {
    const scopeHotels = hotels.filter(h => h.scope === activeScope);
    if (filter === 'Hotels') return scopeHotels.filter(h => h.status === 'To Do');
    if (filter === 'Visited') {
      let res = scopeHotels.filter(h => h.status === 'Visited');
      if (visitedFilter === 'All' || visitedFilter === 'Hotels') return res;
      return [];
    }
    if (filter === 'All') return scopeHotels.filter(h => h.status === 'To Do');
    return [];
  }, [hotels, filter, activeScope, visitedFilter]);

  const visitedGroups = useMemo(() => {
    if (filter !== 'Visited') return {};
    let all = [...places.filter(p => p.scope === activeScope && p.status === 'Visited').map(p => ({ ...p, type: 'place' as const })), ...hotels.filter(h => h.scope === activeScope && h.status === 'Visited').map(h => ({ ...h, category: 'Hotels', type: 'hotel' as const }))];
    if (visitedFilter !== 'All') all = all.filter(item => item.category === visitedFilter);
    const groups = all.reduce((acc: any, item) => { const cat = item.category || 'Other'; if (!acc[cat]) acc[cat] = []; acc[cat].push(item); return acc; }, {});
    Object.keys(groups).forEach(cat => {
      groups[cat].sort((a: any, b: any) => {
        const aScore = a.rating ? parseInt(a.rating) : 0; const bScore = b.rating ? parseInt(b.rating) : 0;
        if (aScore === 0 && bScore !== 0) return -1; if (aScore !== 0 && bScore === 0) return 1; if (aScore !== bScore) return bScore - aScore;
        const aRet = a.return === 'TRUE' || a.return === true; const bRet = b.return === 'TRUE' || b.return === true;
        if (aRet && !bRet) return -1; if (!aRet && bRet) return 1; return 0;
      });
    });
    return groups;
  }, [places, hotels, filter, activeScope, visitedFilter]);

  const getMarkerIcon = (type: string) => {
    if (type === 'home') return homeIcon;
    if (type === 'office') return officeIcon;
    return defaultPinIcon;
  };

  const StarRating = ({ rating, onChange }: { rating: string, onChange: (r: string) => void }) => (
    <div className="flex gap-1 shrink-0">{[1, 2, 3, 4, 5].map(star => (<button key={star} onClick={(e) => { e.stopPropagation(); onChange(star.toString()); }} className={`transition-colors ${parseInt(rating) >= star ? 'text-yellow-400' : 'text-slate-300 hover:text-yellow-400'}`}><Star size={18} strokeWidth={2.5} fill={parseInt(rating) >= star ? 'currentColor' : 'none'} /></button>))}</div>
  );

  if (!appPassword || lockoutUntil) {
    return (
      <div className="h-screen w-full bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md space-y-6 border border-slate-100 text-center">
          <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center ${lockoutUntil ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-600'}`}>{lockoutUntil ? <X size={32} /> : <Lock size={32} />}</div>
          <div className="space-y-1"><h1 className="text-2xl font-bold text-slate-900">{lockoutUntil ? 'Locked' : 'Protected'}</h1><p className="text-slate-500">{lockoutUntil ? `Wait ${countdown}s` : 'Enter password to unlock'}</p></div>
          <form onSubmit={(e) => { e.preventDefault(); if (!pwInput || lockoutUntil) return; localStorage.setItem('todo_tracker_pw', pwInput); setAppPassword(pwInput); }} className="space-y-4">
            <input type="password" disabled={!!lockoutUntil} value={pwInput} onChange={(e) => setPwInput(e.target.value)} placeholder="Password" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" autoFocus />
            <button type="submit" disabled={!!lockoutUntil} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 flex items-center justify-center gap-2 disabled:opacity-50"><LogIn size={20} /> Unlock</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-screen bg-slate-50 font-sans text-slate-900 ${isResizing ? 'cursor-col-resize select-none' : ''}`}>
      {activePhotoItem && (<PhotoModal item={activePhotoItem} isOpen={!!activePhotoItem} onClose={() => setActivePhotoItem(null)} onUpload={(url) => handlePhotoUpload(activePhotoItem, url)} appPassword={appPassword} onExpand={(urls, index) => setLightboxState({ urls, index })} />)}
      {lightboxState && (<Lightbox urls={lightboxState.urls} initialIndex={lightboxState.index} onClose={() => setLightboxState(null)} />)}
      <header className="p-3 sm:p-4 bg-white border-b flex flex-col gap-3 shrink-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4"><h1 className="text-lg sm:text-xl font-bold text-indigo-600">TODO Tracker</h1><div className="flex bg-slate-100 p-1 rounded-lg">{['Austin', 'USA'].map(scope => (<button key={scope} onClick={() => { setActiveScope(scope); setFilter('All'); }} className={`px-3 py-1 rounded-md text-xs sm:text-sm font-bold transition-all ${activeScope === scope ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>{scope}</button>))}</div></div>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <Filter size={16} className="text-slate-400 shrink-0" />{categories.map(cat => (<button key={cat} onClick={() => setFilter(cat)} className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${filter === cat ? 'bg-indigo-600 text-white ring-2 ring-indigo-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{cat}</button>))}
        </div>
      </header>
      <main className="flex-1 flex overflow-hidden relative pb-[60px] sm:pb-0">
        {error && <div className="absolute top-0 left-0 right-0 bg-red-500 text-white p-2 text-center text-xs z-50">{error}</div>}
        <div style={{ width: `${effectiveSidebarWidth}%` }} className={`overflow-y-auto p-3 sm:p-4 space-y-6 shrink-0 ${view === 'map' ? 'hidden sm:block sm:!w-0' : 'block'}`}>
          <section className="space-y-3">
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Add New Place</h2>
            <form onSubmit={async (e) => { e.preventDefault(); if (!searchQuery) return; setIsSearching(true); try { let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`; if (activeScope === 'Austin') url += '&viewbox=-98.3,30.7,-97.2,29.8&bounded=1'; const res = await fetch(url); setSearchResults(await res.json()); } finally { setIsSearching(false); } }} className="relative">
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search..." className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm text-sm" />
              <div className="absolute left-3 top-2.5 text-slate-400">{isSearching ? <Loader2 size={18} className="animate-spin text-indigo-500" /> : <Search size={18} />}</div>
            </form>
            {searchResults.length > 0 && (<div className="bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto divide-y">{searchResults.map((r, i) => (<button key={i} onClick={() => { setPendingPlace(r); setPendingName(r.display_name.split(',')[0]); }} className="w-full text-left p-3 hover:bg-slate-50 flex flex-col gap-0.5"><span className="font-semibold text-sm line-clamp-1">{r.display_name.split(',')[0]}</span><span className="text-xs text-slate-500 line-clamp-1">{r.display_name.split(',').slice(1).join(',')}</span></button>))}</div>)}
            {pendingPlace && (
              <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in duration-200 text-center">
                  <h3 className="text-lg font-bold mb-4">Add Place</h3>
                  <input type="text" value={pendingName} onChange={(e) => setPendingName(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border rounded-xl mb-3 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-semibold" placeholder="Name" />
                  <textarea value={pendingDetails} onChange={(e) => setPendingDetails(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border rounded-xl mb-4 outline-none focus:ring-2 focus:ring-indigo-500 text-sm h-20 resize-none" placeholder="Details" />
                  <div className="grid grid-cols-2 gap-2">{['Food', 'Drinks', 'Activities', 'Sport', 'Hotels', 'Other'].map(cat => (<button key={cat} disabled={isAdding} onClick={() => addPlace(cat)} className="py-2 bg-slate-50 hover:bg-indigo-600 hover:text-white rounded-xl text-sm font-medium transition-all border border-slate-100 flex items-center justify-center gap-2">{isAdding && <Loader2 size={14} className="animate-spin" />}{cat}</button>))}</div>
                  <button onClick={() => setPendingPlace(null)} className="mt-4 text-slate-400 text-sm font-medium">Cancel</button>
                </div>
              </div>
            )}
          </section>
          {filter === 'Saved' ? (
            <section className="space-y-3"><h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Key Locations</h2><div className="grid grid-cols-1 gap-2">{markers.filter(m => m.scope === activeScope).map(m => (<div key={m.id} onClick={() => { const lat = parseFloat(m.lat as any); const lng = parseFloat(m.lng as any); if (!isNaN(lat)) { setMapTarget({ center: [lat, lng], zoom: 15 }); if (windowWidth < 640) setView('map'); } }} className="flex items-center gap-3 p-3 bg-indigo-50/50 rounded-lg border border-indigo-100 cursor-pointer hover:bg-indigo-50 transition-colors"><div className="text-indigo-600">{m.type === 'home' ? <Home size={20} /> : <Briefcase size={20} />}</div><div className="min-w-0"><h4 className="font-semibold text-sm truncate">{m.name}</h4><p className="text-xs text-slate-500 truncate">{m.address}</p></div></div>))}</div></section>
          ) : (
            <section className="space-y-6">
              <div className="space-y-4">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">{filter === 'Hotels' ? 'Hotels' : filter === 'Visited' ? 'Visited' : 'To Do'}</h2>
                {filter === 'Visited' && (<div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1.5 px-1">{['All', 'Food', 'Drinks', 'Activities', 'Sport', 'Hotels', 'Other'].map(cat => (<button key={cat} onClick={() => setVisitedFilter(cat)} className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all whitespace-nowrap ${visitedFilter === cat ? 'bg-indigo-100 text-indigo-600 ring-2 ring-indigo-200' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>{cat}</button>))}</div>)}
              </div>
              <div className="space-y-4 sm:space-y-2">
                {filter === 'Visited' ? (
                  Object.entries(visitedGroups).map(([cat, items]: any) => (
                    <div key={cat} className="space-y-3">
                      <h3 className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em] px-1 pl-2 border-l-2 border-indigo-100">{cat}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-2">
                        {items.map((item: any) => (
                          <div key={item.id} onClick={(e) => { if (!(e.target as HTMLElement).closest('button') && !(e.target as HTMLElement).closest('textarea')) { const lat = parseFloat(item.lat); const lng = parseFloat(item.lng); if (!isNaN(lat)) { setMapTarget({ center: [lat, lng], zoom: 15 }); if (windowWidth < 640) setView('map'); } } }} className="bg-white p-4 sm:p-3 rounded-xl shadow-sm border border-slate-100 flex flex-col gap-3 group hover:border-indigo-200 transition-all cursor-pointer">
                            <div className="flex justify-between items-center"><div className="min-w-0 pr-2"><h3 className="font-semibold text-base md:text-sm truncate">{item.name}</h3>{item.details && <p className="text-xs md:text-[10px] text-indigo-500 font-medium italic mt-0.5">{item.details}</p>}<p className="text-sm md:text-[11px] text-slate-500 truncate mt-1">{item.address}</p></div><button onClick={(e) => { e.stopPropagation(); updatePlace(item.id, { status: 'To Do' }, item.type); }} className="p-2 rounded-full text-green-500 bg-green-50"><CheckCircle2 size={28} /></button></div>
                            <div className="pt-3 border-t border-slate-50 space-y-4">
                              <div className="flex flex-wrap items-end justify-between gap-3">
                                <div className="space-y-1"><span className="text-xs font-bold text-slate-400 uppercase">Rating</span><StarRating rating={item.rating} onChange={(r) => updatePlace(item.id, { rating: r }, item.type)} /></div>
                                <div className="flex-1 min-w-[140px] max-w-[180px]"><span className="text-[10px] font-bold text-slate-400 uppercase block mb-1 ml-1">Date Visited</span><CustomDatePicker value={item.date || ''} onChange={(d) => updatePlace(item.id, { date: d }, item.type)} /></div>
                                <div className="flex items-center gap-1">
                                  <button onClick={(e) => { e.stopPropagation(); setActivePhotoItem(item); }} className={`p-2 rounded-lg ${item.photos ? 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100' : 'text-slate-300 hover:text-indigo-500 hover:bg-indigo-50'}`}><Camera size={20} /></button>
                                  <button onClick={(e) => { e.stopPropagation(); updatePlace(item.id, { return: !(item.return === 'TRUE' || item.return === true) }, item.type); }} className={`p-2 rounded-lg ${(item.return === 'TRUE' || item.return === true) ? 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100' : 'text-slate-300'}`}><RotateCcw size={20} /></button>
                                </div>
                              </div>
                              <textarea placeholder="Notes..." defaultValue={item.notes} onClick={(e) => e.stopPropagation()} onBlur={(e) => { if (e.target.value !== item.notes) updatePlace(item.id, { notes: e.target.value }, item.type); }} className="w-full text-sm bg-slate-50 border-none rounded-lg p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all h-20 resize-none" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <>{[...hotels.filter(h => h.scope === activeScope && h.status === 'To Do' && (filter === 'All' || filter === 'Hotels')).map(h => ({ ...h, category: 'Hotels', type: 'hotel' as const })), ...places.filter(p => p.scope === activeScope && p.status === 'To Do' && (filter === 'All' || filter === p.category))].map(item => (<div key={item.id} onClick={() => { const lat = parseFloat(item.lat as any); const lng = parseFloat(item.lng as any); if (!isNaN(lat)) { setMapTarget({ center: [lat, lng], zoom: 15 }); if (windowWidth < 640) setView('map'); } }} className="bg-white p-4 sm:p-3 rounded-xl shadow-sm border border-slate-100 flex flex-col gap-3 group hover:border-indigo-200 transition-all cursor-pointer"><div className="flex justify-between items-center"><div className="min-w-0 pr-2"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{item.category}</span><h3 className="font-semibold text-base md:text-sm truncate">{item.name}</h3>{item.details && <p className="text-[10px] text-indigo-500 font-medium italic flex items-center gap-1"><Info size={12}/> {item.details}</p>}<p className="text-sm md:text-[11px] text-slate-500 truncate mt-1">{item.address}</p></div><button onClick={(e) => { e.stopPropagation(); updatePlace(item.id, { status: 'Visited' }, item.type); }} className="p-2 rounded-full text-slate-300 hover:text-indigo-500 hover:bg-indigo-50"><Circle size={28} /></button></div></div>))} {(places.length === 0 && hotels.length === 0) && <div className="text-center py-10 text-slate-400">Nothing here yet.</div>}</>
                )}
              </div>
            </section>
          )}
        </div>
        <div style={{ flex: 1 }} className={`bg-slate-200 relative ${view === 'list' ? 'hidden sm:block' : 'block'} min-w-0`}>
          {isLoading && (<div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm z-[20] flex items-center justify-center p-4"><div className="bg-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-indigo-600 font-bold text-sm"><Loader2 size={20} className="animate-spin" /><span>Loading...</span></div></div>)}
          <MapContainer key={activeScope} center={activeScope === 'Austin' ? [30.2672, -97.7431] : [37.0902, -95.7129]} zoom={activeScope === 'Austin' ? 12 : 4} className="h-full w-full z-0">
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
            <MapController center={mapTarget?.center} zoom={mapTarget?.zoom} sidebarWidth={effectiveSidebarWidth} windowWidth={windowWidth} view={view} />
            {filteredMarkers.map(m => (<Marker key={m.id} position={[m.lat, m.lng]} icon={getMarkerIcon(m.type)}><Popup><div className="font-sans"><strong>{m.name}</strong><span className="block text-xs text-slate-500">{m.address}</span></div></Popup></Marker>))}
            {filteredHotels.filter(h => h.lat && h.lng).map(h => (
              <Marker key={h.id} position={[h.lat, h.lng]} icon={hotelMarkerIcon}>
                <Popup><div className="font-sans w-64"><span className="text-[10px] font-bold uppercase tracking-wider text-violet-500">Hotel</span><strong className="block text-indigo-600">{h.name}</strong><span className="block text-xs text-slate-500 mb-2">{h.address}</span><PhotoPreviewGrid photos={h.photos || ''} onExpand={(urls, index) => setLightboxState({ urls, index })} />{h.rating && <div className="flex gap-0.5 text-yellow-500 mt-1">{Array.from({ length: parseInt(h.rating) }).map((_, i) => <Star key={i} size={12} fill="currentColor" />)}</div>}</div></Popup>
              </Marker>
            ))}
            {filteredPlaces.filter(p => p.lat && p.lng).map(p => (
              <Marker key={p.id} position={[p.lat, p.lng]}>
                <Popup><div className="font-sans w-64"><strong className="block text-indigo-600">{p.name}</strong><span className="block text-xs text-slate-500 mb-2">{p.address}</span><PhotoPreviewGrid photos={p.photos || ''} onExpand={(urls, index) => setLightboxState({ urls, index })} />{p.rating && <div className="flex gap-0.5 text-yellow-500 mt-1">{Array.from({ length: parseInt(p.rating) }).map((_, i) => <Star key={i} size={12} fill="currentColor" />)}</div>}</div></Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </main>
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t flex items-center justify-around h-[60px] z-[100] px-4"><button onClick={() => setView('list')} className={`flex flex-col items-center gap-1 ${view === 'list' ? 'text-indigo-600' : 'text-slate-400'}`}><List size={20} /><span className="text-[10px] font-bold uppercase">List</span></button><button onClick={() => { setView('list'); setTimeout(() => { document.querySelector('input[type="text"]')?.focus(); }, 50); }} className="flex flex-col items-center justify-center -mt-8 bg-indigo-600 text-white w-14 h-14 rounded-full shadow-lg ring-4 ring-slate-50"><Plus size={24} /></button><button onClick={() => setView('map')} className={`flex flex-col items-center gap-1 ${view === 'map' ? 'text-indigo-600' : 'text-slate-400'}`}><MapIcon size={20} /><span className="text-[10px] font-bold uppercase">Map</span></button></nav>
    </div>
  );
};

export default App;
