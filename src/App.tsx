import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import 'leaflet/dist/leaflet.css';
import { CheckCircle2, Circle, Map as MapIcon, List, Filter, Home, Briefcase, MapPin, Search, Star, X, Plus, Save, Loader2, Bed, RotateCcw } from 'lucide-react';

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

const App = () => {
  const [places, setPlaces] = useState<Place[]>([]);
  const [markers, setMarkers] = useState<MarkerData[]>([]);
  const [hotels, setHotels] = useState<Place[]>([]);
  const [filter, setFilter] = useState('All');
  const [activeScope, setActiveScope] = useState('Austin');
  const [view, setView] = useState('split');
  const [sidebarWidth, setSidebarWidth] = useState(33.33);
  const [isResizing, setIsResizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mapTarget, setMapTarget] = useState<any>(null);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [pendingPlace, setPendingPlace] = useState<any>(null);

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      if (window.innerWidth >= 640 && view === 'map') {
        setView('split');
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [view]);

  useEffect(() => {
    setIsLoading(true);
    fetch('/api/places')
      .then(res => {
        if (!res.ok) return res.json().then(err => { 
          const msg = err.error + (err.details ? ': ' + err.details : '');
          throw new Error(msg || 'Failed to fetch');
        });
        return res.json();
      })
      .then(data => {
        setPlaces(data.places || []);
        setMarkers(data.markers || []);
        setHotels(data.hotels || []);
      })
      .catch(err => {
        console.error("Error fetching data:", err);
        setError(err.message);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const centerOnMap = (lat: any, lng: any) => {
    const nLat = parseFloat(lat);
    const nLng = parseFloat(lng);
    if (isNaN(nLat) || isNaN(nLng) || nLat === 0 || nLng === 0) return;
    
    setMapTarget({ center: [nLat, nLng], zoom: 15 });
    if (window.innerWidth < 640) setView('map');
  };

  const startResizing = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = (e.clientX / window.innerWidth) * 100;
      if (newWidth > 15 && newWidth < 60) {
        setSidebarWidth(newWidth);
      }
    };

    const stopResizing = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', stopResizing);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing]);

  const updatePlace = async (id: string, data: any, type: 'place' | 'hotel' = 'place') => {
    const previousState = type === 'hotel' ? [...hotels] : [...places];
    if (type === 'hotel') {
      setHotels(hotels.map(h => h.id === id ? { ...h, ...data } : h));
    } else {
      setPlaces(places.map(p => p.id === id ? { ...p, ...data } : p));
    }

    try {
      const response = await fetch('/api/places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, type, ...data }),
      });
      if (!response.ok) throw new Error('Failed to update');
    } catch (error) {
      console.error("Update failed, reverting state:", error);
      if (type === 'hotel') setHotels(previousState);
      else setPlaces(previousState);
      setError("Failed to save changes. Reverting...");
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;
    setIsSearching(true);
    try {
      let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`;
      if (activeScope === 'Austin') {
        url += '&viewbox=-98.3,30.7,-97.2,29.8&bounded=1';
      } else if (activeScope === 'USA') {
        url += '&countrycodes=us';
      }
      
      const response = await fetch(url);
      const data = await response.json();
      setSearchResults(data);
    } catch (err) {
      console.error("Search failed:", err);
      setError("Search failed. Try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const addPlace = async (category: string) => {
    if (!pendingPlace) return;
    setIsAdding(true);
    const isHotel = category === 'Hotels';
    const newEntry: any = {
      name: pendingPlace.display_name.split(',')[0],
      address: pendingPlace.display_name.split(',').slice(1).join(',').trim(),
      lat: parseFloat(pendingPlace.lat),
      lng: parseFloat(pendingPlace.lon),
      category: isHotel ? 'Hotels' : category,
      status: 'To Do',
      notes: '',
      rating: '',
      scope: activeScope,
      type: isHotel ? 'hotel' : 'place'
    };

    try {
      const response = await fetch('/api/places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEntry),
      });
      const data = await response.json();
      if (data.success) {
        if (isHotel) {
          setHotels([...hotels, { ...newEntry, id: data.id }]);
        } else {
          setPlaces([...places, { ...newEntry, id: data.id }]);
        }
        setPendingPlace(null);
        setSearchQuery('');
        setSearchResults([]);
        setFilter(isHotel ? 'Hotels' : 'All');
      }
    } catch (err) {
      console.error("Failed to add:", err);
      setError("Failed to add entry.");
    } finally {
      setIsAdding(false);
    }
  };

  const categories = ['All', 'Food', 'Drinks', 'Activities', 'Hotels', 'Saved', 'Visited'];

  const filteredPlaces = useMemo(() => {
    if (filter === 'Hotels' || filter === 'Saved') return [];
    const scopePlaces = places.filter(p => p.scope === activeScope);
    if (filter === 'Visited') return scopePlaces.filter(p => p.status === 'Visited');
    if (filter === 'All') return scopePlaces.filter(p => p.status === 'To Do');
    return scopePlaces.filter(p => p.category === filter && p.status === 'To Do');
  }, [places, filter, activeScope]);

  const filteredHotels = useMemo(() => {
    const scopeHotels = hotels.filter(h => h.scope === activeScope);
    if (filter === 'Hotels') return scopeHotels;
    if (filter === 'Visited') return scopeHotels.filter(h => h.status === 'Visited');
    return [];
  }, [hotels, filter, activeScope]);

  const visitedGroups = useMemo(() => {
    if (filter !== 'Visited') return {};
    
    const allVisited = [
      ...filteredPlaces.map(p => ({ ...p, type: 'place' as const })),
      ...filteredHotels.map(h => ({ ...h, category: 'Hotels', type: 'hotel' as const }))
    ];

    const groups = allVisited.reduce((acc: any, item) => {
      const cat = item.category || 'Other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {});

    Object.keys(groups).forEach(cat => {
      groups[cat].sort((a: any, b: any) => {
        const aScore = a.rating ? parseInt(a.rating) : 0;
        const bScore = b.rating ? parseInt(b.rating) : 0;
        if (aScore === 0 && bScore !== 0) return -1;
        if (aScore !== 0 && bScore === 0) return 1;
        const aReturn = a.return === 'TRUE' || a.return === true;
        const bReturn = b.return === 'TRUE' || b.return === true;
        if (aReturn && !bReturn) return -1;
        if (!aReturn && bReturn) return 1;
        return 0;
      });
    });

    return groups;
  }, [filteredPlaces, filteredHotels, filter]);

  const filteredMarkers = useMemo(() => {
    return markers.filter(m => m.scope === activeScope);
  }, [markers, activeScope]);

  const getMarkerIcon = (type: string) => {
    if (type === 'home') return homeIcon;
    if (type === 'office') return officeIcon;
    return defaultPinIcon;
  };

  const StarRating = ({ rating, onChange }: { rating: string, onChange: (r: string) => void }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          onClick={() => onChange(star.toString())}
          className={`transition-colors ${parseInt(rating) >= star ? 'text-yellow-400' : 'text-slate-300 hover:text-yellow-400'}`}
        >
          <Star size={18} strokeWidth={2.5} fill={parseInt(rating) >= star ? 'currentColor' : 'none'} />
        </button>
      ))}
    </div>
  );

  return (
    <div className={`flex flex-col h-screen bg-slate-50 font-sans text-slate-900 ${isResizing ? 'cursor-col-resize select-none' : ''}`}>
      <header className="p-3 sm:p-4 bg-white border-b flex flex-col gap-3 shrink-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <h1 className="text-lg sm:text-xl font-bold text-indigo-600 truncate">TODO Tracker</h1>
            <div className="flex bg-slate-100 p-1 rounded-lg scale-90 sm:scale-100 origin-left">
              {['Austin', 'USA'].map(scope => (
                <button
                  key={scope}
                  onClick={() => {
                    setActiveScope(scope);
                    setFilter('All');
                  }}
                  className={`px-3 py-1 rounded-md text-xs sm:text-sm font-bold transition-all ${
                    activeScope === scope ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {scope}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
          <Filter size={16} className="text-slate-400 shrink-0" />
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                filter === cat ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative pb-[60px] sm:pb-0">
        {error && (
          <div className="absolute top-0 left-0 right-0 bg-red-500 text-white p-2 text-center text-xs sm:text-sm z-50 animate-pulse">
            {error}
          </div>
        )}
        
        <div 
          style={{ 
            width: windowWidth < 640 
              ? (view === 'map' ? '0%' : '100%') 
              : (view === 'map' ? '0%' : `${sidebarWidth}%`) 
          }}
          className={`overflow-y-auto p-3 sm:p-4 space-y-6 shrink-0 ${view === 'map' ? 'hidden sm:block sm:!w-0' : 'block'}`}
        >
          <section className="space-y-3">
            <h2 className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Add New Place</h2>
            <form onSubmit={handleSearch} className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for a bar, park, etc..."
                className="w-full pl-10 pr-10 py-2.5 sm:py-2 bg-white border border-slate-200 rounded-xl sm:rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-sm text-sm"
              />
              <div className="absolute left-3 top-2.5 text-slate-400">
                {isSearching ? <Loader2 size={18} className="animate-spin text-indigo-500" /> : <Search size={18} />}
              </div>
              {searchQuery && !isSearching && (
                <button type="button" onClick={() => { setSearchQuery(''); setSearchResults([]); }} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              )}
            </form>

            {searchResults.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto divide-y divide-slate-100">
                {searchResults.map((result, i) => (
                  <button
                    key={i}
                    onClick={() => setPendingPlace(result)}
                    className="w-full text-left p-3 hover:bg-slate-50 transition-colors flex flex-col gap-0.5"
                  >
                    <span className="font-semibold text-sm line-clamp-1">{result.display_name.split(',')[0]}</span>
                    <span className="text-xs text-slate-500 line-clamp-1">{result.display_name.split(',').slice(1).join(',')}</span>
                  </button>
                ))}
              </div>
            )}

            {pendingPlace && (
              <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in duration-200">
                  <h3 className="text-lg font-bold mb-1">Add to TODO Tracker</h3>
                  <p className="text-sm text-slate-500 mb-6">{pendingPlace.display_name.split(',')[0]}</p>
                  
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Select Category</p>
                    <div className="grid grid-cols-2 gap-2">
                      {['Food', 'Drinks', 'Activities', 'Hotels', 'Other'].map(cat => (
                        <button
                          key={cat}
                          disabled={isAdding}
                          onClick={() => addPlace(cat)}
                          className="px-4 py-3 bg-slate-50 hover:bg-indigo-600 hover:text-white disabled:hover:bg-slate-50 disabled:hover:text-slate-600 disabled:opacity-50 rounded-xl text-sm font-medium transition-all text-slate-600 border border-slate-100 flex items-center justify-center gap-2"
                        >
                          {isAdding && <Loader2 size={14} className="animate-spin" />}
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                  {!isAdding && (
                    <button 
                      onClick={() => setPendingPlace(null)}
                      className="mt-6 w-full py-2 text-slate-400 hover:text-slate-600 text-sm font-medium"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>

          {filter === 'Saved' && (
            <section className="space-y-3">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Key Locations</h2>
              <div className="grid grid-cols-1 gap-2">
                {isLoading ? (
                  [1, 2].map(i => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-100 animate-pulse">
                      <div className="h-5 w-5 bg-slate-100 rounded"></div>
                      <div className="w-full space-y-1">
                        <div className="h-3 w-1/2 bg-slate-100 rounded"></div>
                        <div className="h-2 w-3/4 bg-slate-100 rounded"></div>
                      </div>
                    </div>
                  ))
                ) : (
                  <>
                    {markers.filter(m => m.scope === activeScope).map(marker => (
                      <div key={marker.id} onClick={() => centerOnMap(marker.lat, marker.lng)} className="flex items-center gap-3 p-3 bg-indigo-50/50 rounded-lg border border-indigo-100 cursor-pointer hover:bg-indigo-50 transition-colors group/marker">
                        <div className="text-indigo-600 w-8 h-8 flex items-center justify-center shrink-0 group-hover/marker:scale-110 transition-transform">
                          {marker.type === 'home' ? <Home size={20} /> : <Briefcase size={20} />}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-semibold text-sm truncate">{marker.name}</h4>
                          <p className="text-xs text-slate-500 truncate">{marker.address}</p>
                        </div>
                      </div>
                    ))}
                    {markers.filter(m => m.scope === activeScope).length === 0 && <div className="text-center py-10 text-slate-400 text-sm">No saved locations found.</div>}
                  </>
                )}
              </div>
            </section>
          )}

          {filter !== 'Saved' && (
            <section className="space-y-6">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                {filter === 'Hotels' ? 'Saved Hotels' : filter === 'Visited' ? 'Visited Locations' : 'Places to Visit'}
              </h2>
              <div className="space-y-4">
                {isLoading ? (
                  [1, 2, 3].map(i => (
                    <div key={i} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col gap-3 animate-pulse">
                      <div className="flex justify-between items-center">
                        <div className="w-full space-y-2">
                          <div className="h-2 w-16 bg-slate-100 rounded"></div>
                          <div className="h-4 w-3/4 bg-slate-100 rounded"></div>
                          <div className="h-3 w-1/2 bg-slate-100 rounded"></div>
                        </div>
                        <div className="h-10 w-10 bg-slate-50 rounded-full"></div>
                      </div>
                    </div>
                  ))
                ) : filter === 'Visited' ? (
                  Object.entries(visitedGroups).map(([category, items]: any) => (
                    <div key={category} className="space-y-3">
                      <h3 className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em] px-1 pl-2 border-l-2 border-indigo-100">{category}</h3>
                      <div className="space-y-3">
                        {items.map((item: any) => (
                          <div 
                            key={item.id} 
                            onClick={(e) => {
                              if (!(e.target as HTMLElement).closest('button') && !(e.target as HTMLElement).closest('textarea')) {
                                centerOnMap(item.lat, item.lng);
                              }
                            }}
                            className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col gap-3 group hover:border-indigo-200 transition-all cursor-pointer"
                          >
                            <div className="flex justify-between items-center">
                              <div className="min-w-0 pr-2">
                                <h3 className="font-semibold text-lg truncate">{item.name}</h3>
                                <p className="text-sm text-slate-500 truncate">{item.address}</p>
                              </div>
                              <button 
                                onClick={() => updatePlace(item.id, { status: item.status === 'Visited' ? 'To Do' : 'Visited' }, item.type)}
                                className={`p-2 rounded-full transition-colors shrink-0 ${item.status === 'Visited' ? 'text-green-500 bg-green-50' : 'text-slate-300 hover:text-indigo-500 hover:bg-indigo-50'}`}
                              >
                                {item.status === 'Visited' ? <CheckCircle2 size={28} /> : <Circle size={28} />}
                              </button>
                            </div>

                            <div className="pt-3 border-t border-slate-50 space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                  <span className="text-xs font-bold text-slate-400 uppercase">{item.type === 'hotel' ? 'Stay Rating' : 'Your Rating'}</span>
                                  <StarRating 
                                    rating={item.rating} 
                                    onChange={(r) => updatePlace(item.id, { rating: r }, item.type)} 
                                  />
                                </div>
                                <button
                                  onClick={() => updatePlace(item.id, { return: !(item.return === 'TRUE' || item.return === true) }, item.type)}
                                  className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${
                                    (item.return === 'TRUE' || item.return === true) 
                                      ? 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100' 
                                      : 'text-slate-300 hover:text-slate-400 hover:bg-slate-50'
                                  }`}
                                >
                                  <RotateCcw size={20} className={(item.return === 'TRUE' || item.return === true) ? 'animate-in spin-in-180 duration-500' : ''} />
                                  <span className="text-[10px] font-bold uppercase">Return?</span>
                                </button>
                              </div>
                              <div className="relative group/note">
                                <textarea
                                  placeholder={item.type === 'hotel' ? 'Notes about your stay...' : 'Add your thoughts here...'}
                                  defaultValue={item.notes}
                                  onBlur={(e) => {
                                    if (e.target.value !== item.notes) {
                                      updatePlace(item.id, { notes: e.target.value }, item.type);
                                    }
                                  }}
                                  className="w-full text-sm bg-slate-50 border-none rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 transition-all resize-none min-h-[80px]"
                                />
                                <div className="absolute right-2 bottom-2 text-slate-300 pointer-events-none group-focus-within/note:opacity-0 transition-opacity">
                                  <Save size={14} />
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <>
                    {filteredHotels.map(hotel => (
                      <div 
                        key={hotel.id} 
                        onClick={(e) => {
                          if (!(e.target as HTMLElement).closest('button')) centerOnMap(hotel.lat, hotel.lng);
                        }}
                        className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col gap-3 group hover:border-indigo-200 transition-all cursor-pointer"
                      >
                        <div className="flex justify-between items-center">
                          <div className="min-w-0 pr-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Hotel</span>
                            <h3 className="font-semibold text-lg truncate">{hotel.name}</h3>
                            <p className="text-sm text-slate-500 truncate">{hotel.address}</p>
                          </div>
                          <button 
                            onClick={() => updatePlace(hotel.id, { status: hotel.status === 'Visited' ? 'To Do' : 'Visited' }, 'hotel')}
                            className={`p-2 rounded-full transition-colors shrink-0 ${hotel.status === 'Visited' ? 'text-green-500 bg-green-50' : 'text-slate-300 hover:text-indigo-500 hover:bg-indigo-50'}`}
                          >
                            {hotel.status === 'Visited' ? <CheckCircle2 size={28} /> : <Circle size={28} />}
                          </button>
                        </div>
                      </div>
                    ))}

                    {filteredPlaces.map(place => (
                      <div 
                        key={place.id} 
                        onClick={(e) => {
                          if (!(e.target as HTMLElement).closest('button')) centerOnMap(place.lat, place.lng);
                        }}
                        className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col gap-3 group hover:border-indigo-200 transition-all cursor-pointer"
                      >
                        <div className="flex justify-between items-center">
                          <div className="min-w-0 pr-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{place.category}</span>
                            <h3 className="font-semibold text-lg truncate">{place.name}</h3>
                            <p className="text-sm text-slate-500 truncate">{place.address}</p>
                          </div>
                          <button 
                            onClick={() => updatePlace(place.id, { status: place.status === 'Visited' ? 'To Do' : 'Visited' })}
                            className={`p-2 rounded-full transition-colors shrink-0 ${place.status === 'Visited' ? 'text-green-500 bg-green-50' : 'text-slate-300 hover:text-indigo-500 hover:bg-indigo-50'}`}
                          >
                            {place.status === 'Visited' ? <CheckCircle2 size={28} /> : <Circle size={28} />}
                          </button>
                        </div>
                      </div>
                    ))}
                    {(filteredPlaces.length === 0 && filteredHotels.length === 0) && <div className="text-center py-10 text-slate-400">Nothing to show here yet.</div>}
                  </>
                )}
              </div>
            </section>
          )}
        </div>

        <div onMouseDown={startResizing} className="hidden sm:flex w-1 bg-slate-200 hover:bg-indigo-400 cursor-col-resize transition-colors items-center justify-center z-10">
          <div className="w-px h-8 bg-slate-400"></div>
        </div>

        <div style={{ flex: 1 }} className={`bg-slate-200 relative ${view === 'list' ? 'hidden sm:block' : 'block'} min-w-0`}>
          {isLoading && (
            <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm z-[20] flex items-center justify-center p-4 text-center">
              <div className="bg-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-indigo-600 font-bold text-sm">
                <Loader2 size={20} className="animate-spin" />
                <span>Loading Map Data...</span>
              </div>
            </div>
          )}
          <MapContainer key={activeScope} center={activeScope === 'Austin' ? [30.2672, -97.7431] : [37.0902, -95.7129]} zoom={activeScope === 'Austin' ? 12 : 4} className="h-full w-full z-0">
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
            <MapController center={mapTarget?.center} zoom={mapTarget?.zoom} sidebarWidth={sidebarWidth} windowWidth={windowWidth} view={view} />
            {filteredMarkers.filter(m => m.lat && m.lng && !isNaN(m.lat) && !isNaN(m.lng)).map(marker => (
              <Marker key={marker.id} position={[marker.lat, marker.lng]} icon={getMarkerIcon(marker.type)}>
                <Popup><div className="font-sans"><strong>{marker.name}</strong><span className="block text-xs text-slate-500">{marker.address}</span></div></Popup>
              </Marker>
            ))}
            {filteredHotels.filter(h => h.lat && h.lng && !isNaN(h.lat) && !isNaN(h.lng)).map(hotel => (
              <Marker key={hotel.id} position={[hotel.lat, hotel.lng]} icon={hotelMarkerIcon}>
                <Popup><div className="font-sans"><span className="text-[10px] font-bold uppercase tracking-wider text-violet-500">Hotel</span><strong>{hotel.name}</strong><span className="block text-xs text-slate-500">{hotel.address}</span>{hotel.rating && <div className="flex gap-0.5 text-yellow-500 mt-1">{Array.from({ length: parseInt(hotel.rating) }).map((_, i) => <Star key={i} size={12} fill="currentColor" />)}</div>}</div></Popup>
              </Marker>
            ))}
            {filteredPlaces.filter(p => p.lat && p.lng && !isNaN(p.lat) && !isNaN(p.lng)).map(place => (
              <Marker key={place.id} position={[place.lat, place.lng]}>
                <Popup><div className="font-sans"><strong>{place.name}</strong><span className="block text-xs text-slate-500">{place.address}</span>{place.rating && <div className="flex gap-0.5 text-yellow-500 mt-1">{Array.from({ length: parseInt(place.rating) }).map((_, i) => <Star key={i} size={12} fill="currentColor" />)}</div>}</div></Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </main>

      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t flex items-center justify-around h-[60px] z-[100] px-4">
        <button onClick={() => setView('list')} className={`flex flex-col items-center gap-1 ${view === 'list' ? 'text-indigo-600' : 'text-slate-400'}`}><List size={20} /><span className="text-[10px] font-bold uppercase">List</span></button>
        <button onClick={() => { setView('list'); setTimeout(() => { document.querySelector('input[type="text"]')?.focus(); }, 50); }} className="flex flex-col items-center justify-center -mt-8 bg-indigo-600 text-white w-14 h-14 rounded-full shadow-lg ring-4 ring-slate-50"><Plus size={24} /></button>
        <button onClick={() => setView('map')} className={`flex flex-col items-center gap-1 ${view === 'map' ? 'text-indigo-600' : 'text-slate-400'}`}><MapIcon size={20} /><span className="text-[10px] font-bold uppercase">Map</span></button>
      </nav>
    </div>
  );
};

export default App;
