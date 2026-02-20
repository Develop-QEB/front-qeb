import React, { useState, useRef, useMemo } from 'react';
import { GoogleMap, Marker, Circle, InfoWindow, Autocomplete } from '@react-google-maps/api';
import {
  Search, X, MapPin, Navigation, FileUp, Trash2, Plus,
  Check, Ban, LocateFixed, ChevronDown, ChevronRight
} from 'lucide-react';
import { InventarioDisponible } from '../../services/inventarios.service';

// Dark map styles
const DARK_MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#a78bfa' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#4a4a6a' }] },
  { featureType: 'administrative', elementType: 'labels.text.fill', stylers: [{ color: '#c084fc' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d2d44' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3d3d5c' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8b8bb0' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f0f1a' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#22d3ee' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#252540' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#a78bfa' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1e2e1e' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#252540' }] },
];

interface POIMarker {
  id: string;
  position: { lat: number; lng: number };
  name: string;
  type: 'poi' | 'custom' | 'address' | 'kml';
  range: number;
}

interface Props {
  inventarios: InventarioDisponible[];
  selectedInventory: Set<number>;
  onToggleSelection: (id: number) => void;
  mapCenter: { lat: number; lng: number };
  onFilterByPOI?: (idsInRange: number[], idsOutOfRange: number[]) => void;
  hasPOIFilter?: boolean;
}

export function AdvancedMapComponent({
  inventarios,
  selectedInventory,
  onToggleSelection,
  mapCenter,
  onFilterByPOI,
}: Props) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);

  // Mode state
  const [activeMode, setActiveMode] = useState<'poi' | 'custom' | 'address' | 'kml'>('poi');

  // POI markers
  const [poiMarkers, setPoiMarkers] = useState<POIMarker[]>([]);

  // Search states
  const [poiSearch, setPoiSearch] = useState('');
  const [searchRange, setSearchRange] = useState(300);
  const [isSearching, setIsSearching] = useState(false);

  // Custom pin states
  const [customLat, setCustomLat] = useState('');
  const [customLng, setCustomLng] = useState('');
  const [customName, setCustomName] = useState('');

  // Address search
  const [addressSearch, setAddressSearch] = useState('');

  // Autocomplete refs
  const poiAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const addressAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  // Info window
  const [selectedMarker, setSelectedMarker] = useState<POIMarker | null>(null);
  const [selectedInvInfo, setSelectedInvInfo] = useState<InventarioDisponible | null>(null);

  // Panel collapsed
  const [panelCollapsed, setPanelCollapsed] = useState(false);

  // Calculate location groups to determine if Flujo and Contraflujo are at same position
  const locationFlowMap = useMemo(() => {
    const map = new Map<string, { hasFlujo: boolean; hasContraflujo: boolean }>();

    inventarios.forEach(inv => {
      if (!inv.latitud || !inv.longitud) return;
      // Round to 5 decimal places to group nearby points
      const key = `${inv.latitud.toFixed(5)},${inv.longitud.toFixed(5)}`;

      if (!map.has(key)) {
        map.set(key, { hasFlujo: false, hasContraflujo: false });
      }

      const entry = map.get(key)!;
      if (inv.tipo_de_cara === 'Flujo') {
        entry.hasFlujo = true;
      } else if (inv.tipo_de_cara === 'Contraflujo') {
        entry.hasContraflujo = true;
      }
    });

    return map;
  }, [inventarios]);

  // Calculate which inventarios are in range
  const { inRangeSet, outOfRangeSet } = useMemo(() => {
    const inRange = new Set<number>();
    const outOfRange = new Set<number>();

    if (poiMarkers.length === 0) {
      return { inRangeSet: inRange, outOfRangeSet: outOfRange };
    }

    inventarios.forEach(inv => {
      if (!inv.latitud || !inv.longitud) return;

      let isInRange = false;
      for (const poi of poiMarkers) {
        const distance = google.maps.geometry.spherical.computeDistanceBetween(
          new google.maps.LatLng(inv.latitud, inv.longitud),
          new google.maps.LatLng(poi.position.lat, poi.position.lng)
        );
        if (distance <= poi.range) {
          isInRange = true;
          break;
        }
      }

      if (isInRange) {
        inRange.add(inv.id);
      } else {
        outOfRange.add(inv.id);
      }
    });

    return { inRangeSet: inRange, outOfRangeSet: outOfRange };
  }, [inventarios, poiMarkers]);

  // Handle map load
  const handleMapLoad = (map: google.maps.Map) => {
    mapRef.current = map;
    placesServiceRef.current = new google.maps.places.PlacesService(map);
  };

  // Search POI with pagination to get more results
  const handleSearchPOI = () => {
    if (!poiSearch.trim() || !placesServiceRef.current || !mapRef.current) return;

    setIsSearching(true);
    const bounds = mapRef.current.getBounds();
    const allResults: google.maps.places.PlaceResult[] = [];

    const request: google.maps.places.TextSearchRequest = {
      query: poiSearch,
      bounds: bounds || undefined,
    };

    const processResults = (
      results: google.maps.places.PlaceResult[] | null,
      status: google.maps.places.PlacesServiceStatus,
      pagination: google.maps.places.PlaceSearchPagination | null
    ) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && results) {
        allResults.push(...results);

        // If we have more pages and less than 60 results, get more
        if (pagination?.hasNextPage && allResults.length < 60) {
          setTimeout(() => pagination.nextPage(), 200);
        } else {
          // Done - create markers from all results
          setIsSearching(false);
          const timestamp = Date.now();
          const newMarkers: POIMarker[] = allResults.slice(0, 60).map((place, idx) => ({
            id: `poi-${timestamp}-${idx}`,
            position: {
              lat: place.geometry?.location?.lat() || 0,
              lng: place.geometry?.location?.lng() || 0,
            },
            name: place.name || 'POI',
            type: 'poi',
            range: searchRange,
          }));
          setPoiMarkers(prev => [...prev, ...newMarkers]);
        }
      } else {
        setIsSearching(false);
        // If we have some results, still show them
        if (allResults.length > 0) {
          const timestamp = Date.now();
          const newMarkers: POIMarker[] = allResults.map((place, idx) => ({
            id: `poi-${timestamp}-${idx}`,
            position: {
              lat: place.geometry?.location?.lat() || 0,
              lng: place.geometry?.location?.lng() || 0,
            },
            name: place.name || 'POI',
            type: 'poi',
            range: searchRange,
          }));
          setPoiMarkers(prev => [...prev, ...newMarkers]);
        }
      }
    };

    placesServiceRef.current.textSearch(request, processResults);
  };

  // Add custom pin
  const handleAddCustomPin = () => {
    const lat = parseFloat(customLat);
    const lng = parseFloat(customLng);
    if (isNaN(lat) || isNaN(lng)) return;

    const newMarker: POIMarker = {
      id: `custom-${Date.now()}`,
      position: { lat, lng },
      name: customName || `Pin ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      type: 'custom',
      range: searchRange,
    };
    setPoiMarkers(prev => [...prev, newMarker]);
    setCustomLat('');
    setCustomLng('');
    setCustomName('');
    mapRef.current?.setCenter({ lat, lng });
    mapRef.current?.setZoom(15);
  };

  // Search address
  const handleSearchAddress = () => {
    if (!addressSearch.trim()) return;

    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: addressSearch + ', Mexico' }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        const location = results[0].geometry.location;
        const newMarker: POIMarker = {
          id: `address-${Date.now()}`,
          position: { lat: location.lat(), lng: location.lng() },
          name: results[0].formatted_address?.split(',')[0] || addressSearch,
          type: 'address',
          range: searchRange,
        };
        setPoiMarkers(prev => [...prev, newMarker]);
        mapRef.current?.setCenter({ lat: location.lat(), lng: location.lng() });
        mapRef.current?.setZoom(16);
      }
    });
    setAddressSearch('');
  };

  // Handle KML file
  const handleKMLUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parser = new DOMParser();
        const kmlDoc = parser.parseFromString(content, 'text/xml');
        const placemarks = kmlDoc.getElementsByTagName('Placemark');

        const newMarkers: POIMarker[] = [];
        for (let i = 0; i < placemarks.length; i++) {
          const placemark = placemarks[i];
          const nameEl = placemark.getElementsByTagName('name')[0];
          const coordsEl = placemark.getElementsByTagName('coordinates')[0];

          if (coordsEl) {
            const coords = coordsEl.textContent?.trim().split(',');
            if (coords && coords.length >= 2) {
              const lng = parseFloat(coords[0]);
              const lat = parseFloat(coords[1]);
              if (!isNaN(lat) && !isNaN(lng)) {
                newMarkers.push({
                  id: `kml-${Date.now()}-${i}`,
                  position: { lat, lng },
                  name: nameEl?.textContent || `KML ${i + 1}`,
                  type: 'kml',
                  range: searchRange,
                });
              }
            }
          }
        }

        if (newMarkers.length > 0) {
          setPoiMarkers(prev => [...prev, ...newMarkers]);
          if (newMarkers[0]) {
            mapRef.current?.setCenter(newMarkers[0].position);
            mapRef.current?.setZoom(14);
          }
        }
      } catch (err) {
        console.error('KML parse error:', err);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // Remove marker
  const handleRemoveMarker = (id: string) => {
    setPoiMarkers(prev => prev.filter(m => m.id !== id));
    setSelectedMarker(null);
  };

  // Clear all markers
  const handleClearAll = () => {
    setPoiMarkers([]);
    setSelectedMarker(null);
  };

  // Filter handlers
  const handleConservarConPOIs = () => {
    if (onFilterByPOI && inRangeSet.size > 0) {
      onFilterByPOI(Array.from(inRangeSet), Array.from(outOfRangeSet));
    }
  };

  const handleConservarSinPOIs = () => {
    if (onFilterByPOI && outOfRangeSet.size > 0) {
      onFilterByPOI(Array.from(outOfRangeSet), Array.from(inRangeSet));
    }
  };

  // Get marker color by type
  const getMarkerColor = (type: POIMarker['type']) => {
    const colors = {
      poi: '#a855f7',
      custom: '#d946ef',
      address: '#8b5cf6',
      kml: '#818cf8',
    };
    return colors[type];
  };

  // Color constants for consistency
  const COLORS = {
    // Traffic direction
    flujo: '#3b82f6',        // Blue - Flujo
    contraflujo: '#06b6d4',  // Cyan - Contraflujo
    ambos: '#a855f7',        // Purple - Completos (F+C juntos)
    // Status
    seleccionado: '#facc15', // Yellow - Seleccionado
    yaReservado: '#22c55e',  // Green - Ya reservado para otra cara
    fueraRango: '#6b7280',   // Gray - Fuera de rango de POI
  };

  // Get inventory marker color
  const getInventoryColor = (inv: InventarioDisponible) => {
    // Priority 1: Selection status
    if (selectedInventory.has(inv.id)) return COLORS.seleccionado;
    if (inv.ya_reservado_para_cara) return COLORS.yaReservado;

    // Priority 2: POI range filter
    if (poiMarkers.length > 0) {
      if (!inRangeSet.has(inv.id)) return COLORS.fueraRango;
    }

    // Priority 3: Handle "Completo" type (merged Flujo+Contraflujo from muebles completos filter)
    if (inv.tipo_de_cara === 'Completo') {
      return COLORS.ambos;  // Purple for complete pairs
    }

    // Differentiate Flujo vs Contraflujo
    if (inv.tipo_de_cara === 'Contraflujo') return COLORS.contraflujo;
    return COLORS.flujo;
  };

  // Center map on inventory bounds
  const handleCenterOnInventory = () => {
    if (!mapRef.current || inventarios.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    let hasValidCoords = false;
    inventarios.forEach(inv => {
      if (inv.latitud && inv.longitud) {
        bounds.extend({ lat: inv.latitud, lng: inv.longitud });
        hasValidCoords = true;
      }
    });
    if (hasValidCoords) {
      mapRef.current.fitBounds(bounds);
    }
  };

  // Handle POI autocomplete
  const handlePOIPlaceChanged = () => {
    const place = poiAutocompleteRef.current?.getPlace();
    if (place?.geometry?.location) {
      const newMarker: POIMarker = {
        id: `poi-${Date.now()}`,
        position: {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        },
        name: place.name || 'POI',
        type: 'poi',
        range: searchRange,
      };
      setPoiMarkers(prev => [...prev, newMarker]);
      mapRef.current?.setCenter(newMarker.position);
      mapRef.current?.setZoom(15);
      setPoiSearch('');
    }
  };

  // Handle address autocomplete
  const handleAddressPlaceChanged = () => {
    const place = addressAutocompleteRef.current?.getPlace();
    if (place?.geometry?.location) {
      const newMarker: POIMarker = {
        id: `address-${Date.now()}`,
        position: {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        },
        name: place.formatted_address?.split(',')[0] || place.name || 'Direccion',
        type: 'address',
        range: searchRange,
      };
      setPoiMarkers(prev => [...prev, newMarker]);
      mapRef.current?.setCenter(newMarker.position);
      mapRef.current?.setZoom(16);
      setAddressSearch('');
    }
  };

  const tabs = [
    { id: 'poi' as const, icon: Search, label: 'POI' },
    { id: 'address' as const, icon: Navigation, label: 'Dirección' },
    { id: 'custom' as const, icon: MapPin, label: 'Coordenadas' },
    { id: 'kml' as const, icon: FileUp, label: 'KML' },
  ];

  return (
    <div className="relative w-full h-full flex">
      {/* Side Panel */}
      <div className={`bg-zinc-900 border-r border-zinc-800 flex flex-col transition-all ${panelCollapsed ? 'w-10' : 'w-72'}`}>
        {/* Panel Header */}
        <div className="flex items-center justify-between p-2 border-b border-zinc-800">
          {!panelCollapsed && <span className="text-xs font-medium text-zinc-400">Filtros de Ubicación</span>}
          <button
            onClick={() => setPanelCollapsed(!panelCollapsed)}
            className="p-1 text-zinc-500 hover:text-white rounded"
          >
            {panelCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4 rotate-90" />}
          </button>
        </div>

        {!panelCollapsed && (
          <>
            {/* Tabs */}
            <div className="flex border-b border-zinc-800">
              {tabs.map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  onClick={() => setActiveMode(id)}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-colors ${
                    activeMode === id
                      ? 'text-purple-400 bg-purple-500/10 border-b-2 border-purple-500'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* Search Form */}
            <div className="p-3 space-y-3 border-b border-zinc-800">
              {/* Range selector */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-zinc-500">Radio:</label>
                <select
                  value={searchRange}
                  onChange={(e) => setSearchRange(parseInt(e.target.value))}
                  className="flex-1 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-white"
                >
                  <option value={100}>100m</option>
                  <option value={200}>200m</option>
                  <option value={300}>300m</option>
                  <option value={500}>500m</option>
                  <option value={1000}>1km</option>
                  <option value={2000}>2km</option>
                </select>
              </div>

              {activeMode === 'poi' && (
                <div className="space-y-2">
                  <Autocomplete
                    onLoad={(ac) => { poiAutocompleteRef.current = ac; }}
                    onPlaceChanged={handlePOIPlaceChanged}
                    options={{ componentRestrictions: { country: 'mx' }, fields: ['geometry', 'name', 'formatted_address'] }}
                  >
                    <input
                      type="text"
                      value={poiSearch}
                      onChange={(e) => setPoiSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearchPOI()}
                      placeholder="Buscar: escuelas, oxxo, walmart..."
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                  </Autocomplete>
                  <button
                    onClick={handleSearchPOI}
                    disabled={isSearching || !poiSearch.trim()}
                    className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    {isSearching ? 'Buscando...' : 'Buscar en área visible'}
                  </button>
                </div>
              )}

              {activeMode === 'address' && (
                <div className="space-y-2">
                  <Autocomplete
                    onLoad={(ac) => { addressAutocompleteRef.current = ac; }}
                    onPlaceChanged={handleAddressPlaceChanged}
                    options={{ componentRestrictions: { country: 'mx' }, fields: ['geometry', 'name', 'formatted_address'] }}
                  >
                    <input
                      type="text"
                      value={addressSearch}
                      onChange={(e) => setAddressSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearchAddress()}
                      placeholder="Av. Reforma 222, CDMX..."
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                  </Autocomplete>
                  <button
                    onClick={handleSearchAddress}
                    disabled={!addressSearch.trim()}
                    className="w-full px-3 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Agregar dirección
                  </button>
                </div>
              )}

              {activeMode === 'custom' && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      value={customLat}
                      onChange={(e) => setCustomLat(e.target.value)}
                      placeholder="Latitud"
                      step="any"
                      className="px-2 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-500"
                    />
                    <input
                      type="number"
                      value={customLng}
                      onChange={(e) => setCustomLng(e.target.value)}
                      placeholder="Longitud"
                      step="any"
                      className="px-2 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-500"
                    />
                  </div>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Nombre (opcional)"
                    className="w-full px-2 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-500"
                  />
                  <button
                    onClick={handleAddCustomPin}
                    disabled={!customLat || !customLng}
                    className="w-full px-3 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Agregar pin
                  </button>
                </div>
              )}

              {activeMode === 'kml' && (
                <div className="space-y-2">
                  <p className="text-xs text-zinc-500">Sube un archivo KML con puntos de interés</p>
                  <input
                    type="file"
                    accept=".kml"
                    onChange={handleKMLUpload}
                    className="w-full text-xs text-zinc-400 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 file:cursor-pointer file:w-full"
                  />
                </div>
              )}
            </div>

            {/* Pins List */}
            {poiMarkers.length > 0 && (
              <div className="flex-1 overflow-auto">
                <div className="p-2 border-b border-zinc-800 flex items-center justify-between">
                  <span className="text-xs text-zinc-400">{poiMarkers.length} pines</span>
                  <button onClick={handleClearAll} className="text-xs text-red-400 hover:text-red-300">
                    Limpiar todos
                  </button>
                </div>
                <div className="divide-y divide-zinc-800/50">
                  {poiMarkers.map(marker => (
                    <div key={marker.id} className="flex items-center gap-2 p-2 hover:bg-zinc-800/30">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: getMarkerColor(marker.type) }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white truncate">{marker.name}</p>
                        <p className="text-[10px] text-zinc-500">{marker.range}m</p>
                      </div>
                      <button
                        onClick={() => handleRemoveMarker(marker.id)}
                        className="p-1 text-zinc-500 hover:text-red-400"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {poiMarkers.length > 0 && onFilterByPOI && (
              <div className="p-3 border-t border-zinc-800 space-y-2">
                <button
                  onClick={handleConservarConPOIs}
                  disabled={inRangeSet.size === 0}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-purple-600/80 hover:bg-purple-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
                >
                  <Check className="h-4 w-4" />
                  Conservar con POIs ({inRangeSet.size})
                </button>
                <button
                  onClick={handleConservarSinPOIs}
                  disabled={outOfRangeSet.size === 0}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
                >
                  <Ban className="h-4 w-4" />
                  Conservar sin POIs ({outOfRangeSet.size})
                </button>
              </div>
            )}

            {/* Stats */}
            <div className="p-3 border-t border-zinc-800 text-xs text-zinc-500">
              <div className="flex items-center justify-between">
                <span>Total inventarios:</span>
                <span className="text-purple-400 font-medium">{inventarios.length}</span>
              </div>
              {poiMarkers.length > 0 && (
                <>
                  <div className="flex items-center justify-between mt-1">
                    <span>En rango:</span>
                    <span className="text-purple-400 font-medium">{inRangeSet.size}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span>Fuera de rango:</span>
                    <span className="text-zinc-400 font-medium">{outOfRangeSet.size}</span>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Map Area */}
      <div className="flex-1 relative">
        {/* Center button */}
        <button
          onClick={handleCenterOnInventory}
          className="absolute top-3 right-3 z-10 p-2 bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-colors"
          title="Centrar en inventarios"
        >
          <LocateFixed className="h-5 w-5" />
        </button>

        {/* Color Legend */}
        <div className="absolute bottom-4 right-3 z-10 bg-zinc-900/95 border border-zinc-700 rounded-lg p-3 text-xs max-w-[220px]">
          <div className="text-zinc-300 font-semibold mb-2 flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-purple-400" />
            Leyenda del Mapa
          </div>

          {/* Tipo de cara - solo mostrar cuando NO hay POIs activos */}
          {poiMarkers.length === 0 && (
            <div className="space-y-1.5 mb-2">
              <div className="text-zinc-500 text-[10px] uppercase tracking-wide">Dirección del tráfico</div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500 ring-1 ring-blue-400/30" />
                <span className="text-zinc-300">Flujo</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-cyan-500 ring-1 ring-cyan-400/30" />
                <span className="text-zinc-300">Contraflujo</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500 ring-1 ring-purple-400/30" />
                <div>
                  <span className="text-zinc-300">Completo</span>
                  <span className="text-zinc-500 text-[10px] ml-1">(F+C)</span>
                </div>
              </div>
            </div>
          )}

          {/* POI mode legend */}
          {poiMarkers.length > 0 && (
            <div className="space-y-1.5 mb-2">
              <div className="text-zinc-500 text-[10px] uppercase tracking-wide">Proximidad a POIs</div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500 ring-1 ring-purple-400/30" />
                <div>
                  <span className="text-zinc-300">En rango</span>
                  <span className="text-zinc-500 text-[10px] ml-1">({inRangeSet.size})</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-500 ring-1 ring-gray-400/30" />
                <div>
                  <span className="text-zinc-300">Fuera de rango</span>
                  <span className="text-zinc-500 text-[10px] ml-1">({outOfRangeSet.size})</span>
                </div>
              </div>
            </div>
          )}

          {/* Estado de selección */}
          <div className="border-t border-zinc-700/70 pt-2 space-y-1.5">
            <div className="text-zinc-500 text-[10px] uppercase tracking-wide">Estado</div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-400 ring-2 ring-yellow-300/50" />
              <div>
                <span className="text-zinc-300">Seleccionado</span>
                <span className="text-zinc-500 text-[10px] ml-1">({selectedInventory.size})</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500 ring-1 ring-green-400/30" />
              <div>
                <span className="text-zinc-300">Ya reservado</span>
                <span className="text-zinc-500 text-[10px] ml-1">(otra cara)</span>
              </div>
            </div>
          </div>
        </div>

        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={mapCenter}
          zoom={13}
          options={{
            styles: DARK_MAP_STYLES,
            disableDefaultUI: true,
            zoomControl: true,
            zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_CENTER },
          }}
          onLoad={handleMapLoad}
        >
          {/* POI Markers & Circles */}
          {poiMarkers.map(marker => (
            <React.Fragment key={marker.id}>
              <Circle
                center={marker.position}
                radius={marker.range}
                options={{
                  strokeColor: getMarkerColor(marker.type),
                  strokeOpacity: 0.7,
                  strokeWeight: 2,
                  fillColor: getMarkerColor(marker.type),
                  fillOpacity: 0.15,
                }}
              />
              <Marker
                position={marker.position}
                onClick={() => setSelectedMarker(marker)}
                icon={{
                  path: 'M12,2C8.13,2 5,5.13 5,9c0,5.25 7,13 7,13s7-7.75 7-13C19,5.13 15.87,2 12,2z',
                  fillColor: getMarkerColor(marker.type),
                  fillOpacity: 1,
                  strokeColor: '#ffffff',
                  strokeWeight: 2,
                  scale: 1.3,
                  anchor: new google.maps.Point(12, 24),
                }}
              />
            </React.Fragment>
          ))}

          {/* Inventory Markers */}
          {inventarios.map(inv => (
            inv.latitud && inv.longitud && (
              <Marker
                key={inv.espacio_id ? `${inv.id}_${inv.espacio_id}` : inv.id}
                position={{ lat: inv.latitud, lng: inv.longitud }}
                onClick={() => {
                  onToggleSelection(inv.id);
                  setSelectedInvInfo(inv);
                }}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: selectedInventory.has(inv.id) ? 10 : 7,
                  fillColor: getInventoryColor(inv),
                  fillOpacity: 0.9,
                  strokeColor: selectedInventory.has(inv.id) ? '#fef08a' : '#fff',
                  strokeWeight: selectedInventory.has(inv.id) ? 3 : 1.5,
                }}
              />
            )
          ))}

          {/* POI Info Window */}
          {selectedMarker && (
            <InfoWindow
              position={selectedMarker.position}
              onCloseClick={() => setSelectedMarker(null)}
            >
              <div className="p-1 min-w-[180px]">
                <h3 className="font-semibold text-sm mb-1 text-gray-800">{selectedMarker.name}</h3>
                <p className="text-xs text-gray-500 mb-2">{selectedMarker.range}m de radio</p>
                <button
                  onClick={() => handleRemoveMarker(selectedMarker.id)}
                  className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200 w-full justify-center"
                >
                  <Trash2 className="h-3 w-3" />
                  Eliminar
                </button>
              </div>
            </InfoWindow>
          )}

          {/* Inventory Info Window */}
          {selectedInvInfo && !selectedMarker && (
            <InfoWindow
              position={{ lat: selectedInvInfo.latitud, lng: selectedInvInfo.longitud }}
              onCloseClick={() => setSelectedInvInfo(null)}
            >
              <div className="p-1 min-w-[200px]">
                <h3 className="font-semibold text-xs mb-1 text-gray-800 font-mono">
                  {selectedInvInfo.codigo_unico}
                </h3>
                <p className="text-xs text-gray-600 mb-0.5">
                  {selectedInvInfo.tipo_de_cara} · {selectedInvInfo.plaza}
                </p>
                <p className="text-xs text-gray-500">
                  {selectedInvInfo.ubicacion}
                </p>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </div>
    </div>
  );
}
