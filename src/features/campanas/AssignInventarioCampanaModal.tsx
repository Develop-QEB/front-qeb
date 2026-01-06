import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  X, Search, Plus, Trash2, ChevronDown, ChevronRight, ChevronUp, Users,
  FileText, MapPin, Layers, Pencil, Map, Package, Share2,
  Gift, Target, Save, ArrowLeft, Filter, Grid, LayoutGrid, Ruler, ArrowUpDown,
  Loader2, Building2, Calendar, Tag, Info, Check, Lock, Unlock
} from 'lucide-react';
import { GoogleMap, useLoadScript, Marker } from '@react-google-maps/api';
import { Campana } from '../../types';
import { campanasService, SolicitudCara, InventarioReservado, InventarioConAPS } from '../../services/campanas.service';
import { solicitudesService, UserOption } from '../../services/solicitudes.service';
import { inventariosService, InventarioDisponible } from '../../services/inventarios.service';
import { formatCurrency } from '../../lib/utils';

const GOOGLE_MAPS_API_KEY = 'AIzaSyB7Bzwydh91xZPdR8mGgqAV2hO72W1EVaw';

// Dark map styles
const DARK_MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#212121' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#c084fc' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#757575' }] },
  { featureType: 'administrative', elementType: 'labels.text.fill', stylers: [{ color: '#e879f9' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#383838' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#4a4a4a' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#a78bfa' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#181818' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#22d3ee' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#2a2a2a' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#c084fc' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1e1e1e' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2a2a2a' }] },
  { featureType: 'transit', elementType: 'labels.text.fill', stylers: [{ color: '#f472b6' }] },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  campana: Campana;
}

interface CaraItem {
  localId: string;
  id?: number;
  ciudad: string;
  estados: string;
  tipo: string;
  flujo: string;
  bonificacion: number;
  caras: number;
  nivel_socioeconomico: string;
  formato: string;
  costo: number;
  tarifa_publica: number;
  inicio_periodo: string;
  fin_periodo: string;
  caras_flujo: number;
  caras_contraflujo: number;
  articulo: string;
  descuento: number;
  isEditing?: boolean;
}

interface ReservaItem {
  id: string;
  inventario_id: number;
  codigo_unico: string;
  tipo: 'Flujo' | 'Contraflujo' | 'Bonificacion';
  catorcena: number;
  anio: number;
  latitud: number;
  longitud: number;
  plaza: string;
  formato: string;
  ubicacion?: string | null;
  aps?: number | null; // Si tiene APS, el grupo está bloqueado para edición
  hasAPS: boolean;
}

// View states for the modal
type ViewState = 'main' | 'search-inventory';

// Extended inventory item for processed data
type ProcessedInventoryItem = InventarioDisponible & {
  isCompleto?: boolean;
  flujoId?: number;
  contraflujoId?: number;
  grupo?: string;
};

// Empty cara template
const EMPTY_CARA: Omit<CaraItem, 'localId'> = {
  ciudad: '',
  estados: '',
  tipo: '',
  flujo: '',
  bonificacion: 0,
  caras: 0,
  nivel_socioeconomico: '',
  formato: '',
  costo: 0,
  tarifa_publica: 0,
  inicio_periodo: '',
  fin_periodo: '',
  caras_flujo: 0,
  caras_contraflujo: 0,
  articulo: '',
  descuento: 0,
};

// Status options
const STATUS_OPTIONS = [
  { value: 'activa', label: 'Activa' },
  { value: 'por iniciar', label: 'Por iniciar' },
  { value: 'finalizada', label: 'Finalizada' },
  { value: 'atendida', label: 'Atendida' },
  { value: 'cancelada', label: 'Cancelada' },
];

// Step configuration
const STEPS = [
  { num: 1, label: 'Información', icon: Info },
  { num: 2, label: 'Campaña', icon: FileText },
  { num: 3, label: 'Inventario', icon: Package },
];

export function AssignInventarioCampanaModal({ isOpen, onClose, campana }: Props) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const mapRef = useRef<google.maps.Map | null>(null);

  // Load Google Maps with required libraries
  const { isLoaded: mapsLoaded } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: ['places', 'geometry'],
  });

  // View state
  const [viewState, setViewState] = useState<ViewState>('main');
  const [step, setStep] = useState(1);
  const [selectedCaraForSearch, setSelectedCaraForSearch] = useState<CaraItem | null>(null);

  // Editable campaña fields
  const [nombre, setNombre] = useState('');
  const [status, setStatus] = useState('');
  const [notas, setNotas] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [yearInicio, setYearInicio] = useState<number | undefined>();
  const [yearFin, setYearFin] = useState<number | undefined>();
  const [catorcenaInicio, setCatorcenaInicio] = useState<number | undefined>();
  const [catorcenaFin, setCatorcenaFin] = useState<number | undefined>();

  // Client info (readonly)
  const [cuic, setCuic] = useState<number | null>(null);
  const [unidadNegocio, setUnidadNegocio] = useState('');
  const [agencia, setAgencia] = useState('');
  const [marca, setMarca] = useState('');
  const [producto, setProducto] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [asesor, setAsesor] = useState('');
  const [categoria, setCategoria] = useState('');
  const [clienteNombre, setClienteNombre] = useState('');

  // Caras state
  const [caras, setCaras] = useState<CaraItem[]>([]);
  const [expandedCaras, setExpandedCaras] = useState<Set<string>>(new Set());
  const [expandedCatorcenas, setExpandedCatorcenas] = useState<Set<string>>(new Set());

  // New cara form state
  const [newCara, setNewCara] = useState<Omit<CaraItem, 'localId'>>(EMPTY_CARA);
  const [showAddCaraForm, setShowAddCaraForm] = useState(false);
  const [editingCaraId, setEditingCaraId] = useState<string | null>(null);

  // Reservas state (from existing inventory)
  const [reservas, setReservas] = useState<ReservaItem[]>([]);

  // Inventory search state
  const [searchFilters, setSearchFilters] = useState({
    plaza: '',
    tipo: '',
    formato: '',
  });
  const [selectedInventory, setSelectedInventory] = useState<Set<number>>(new Set());

  // Tab state for search view
  const [searchViewTab, setSearchViewTab] = useState<'buscar' | 'reservados'>('buscar');

  // Disponibles data
  const [inventarioDisponible, setInventarioDisponible] = useState<InventarioDisponible[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Saving state
  const [isSaving, setIsSaving] = useState(false);

  // Body scroll lock when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => document.body.classList.remove('modal-open');
  }, [isOpen]);

  // Dev helper: log when modal opens so you can verify in browser console
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line no-console
      console.log('AssignInventarioCampanaModal opened for campana', campana?.id);
    }
  }, [isOpen, campana?.id]);

  // Fetch campaña details
  const { data: campanaDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ['campana-details', campana.id],
    queryFn: () => campanasService.getById(campana.id),
    enabled: isOpen && !!campana.id,
  });

  // Fetch caras
  const { data: carasData, isLoading: carasLoading } = useQuery({
    queryKey: ['campana-caras', campana.id],
    queryFn: () => campanasService.getCaras(campana.id),
    enabled: isOpen && !!campana.id,
  });

  // Fetch existing reservas (inventario reservado - sin APS)
  const { data: inventarioReservado } = useQuery({
    queryKey: ['campana-inventario', campana.id],
    queryFn: () => campanasService.getInventarioReservado(campana.id),
    enabled: isOpen && !!campana.id,
  });

  // Fetch inventario con APS (bloqueado para edición)
  const { data: inventarioConAPS } = useQuery({
    queryKey: ['campana-inventario-aps', campana.id],
    queryFn: () => campanasService.getInventarioConAPS(campana.id),
    enabled: isOpen && !!campana.id,
  });

  // Set de IDs con APS para verificación rápida
  const idsConAPS = useMemo(() => {
    if (!inventarioConAPS) return new Set<number>();
    return new Set(inventarioConAPS.map(inv => inv.id));
  }, [inventarioConAPS]);

  // Fetch catorcenas
  const { data: catorcenasData } = useQuery({
    queryKey: ['catorcenas'],
    queryFn: () => solicitudesService.getCatorcenas(),
    enabled: isOpen,
  });

  // Fetch inventory filters
  const { data: inventoryFilters } = useQuery({
    queryKey: ['inventory-filters'],
    queryFn: async () => {
      const [tipos, plazas, estatus] = await Promise.all([
        inventariosService.getTipos(),
        inventariosService.getPlazas(),
        inventariosService.getEstatus(),
      ]);
      return { tipos, plazas, estatus };
    },
    enabled: isOpen,
  });

  // Fetch solicitud filters for add cara form
  const { data: solicitudFilters } = useQuery({
    queryKey: ['inventario-filters'],
    queryFn: () => solicitudesService.getInventarioFilters(),
    enabled: isOpen,
  });

  // Fetch inventory for map
  const { data: inventoryData, isLoading: inventoryLoading, refetch: refetchInventory } = useQuery({
    queryKey: ['inventarios-map', searchFilters.plaza, searchFilters.tipo],
    queryFn: () => {
      const params: { tipo?: string; plaza?: string } = {};
      if (searchFilters.plaza) params.plaza = searchFilters.plaza;
      if (searchFilters.tipo) params.tipo = searchFilters.tipo;
      return inventariosService.getForMap(params);
    },
    enabled: isOpen && viewState === 'search-inventory',
  });

  const years = catorcenasData?.years || [];

  // Catorcenas filtradas por año
  const catorcenasInicioOptions = useMemo(() => {
    if (!catorcenasData?.data || !yearInicio) return [];
    return catorcenasData.data.filter(c => c.a_o === yearInicio);
  }, [catorcenasData, yearInicio]);

  const catorcenasFinOptions = useMemo(() => {
    if (!catorcenasData?.data || !yearFin) return [];
    return catorcenasData.data.filter(c => c.a_o === yearFin);
  }, [catorcenasData, yearFin]);

  // Initialize form from campaña details
  useEffect(() => {
    if (campanaDetails && isOpen) {
      setNombre(campanaDetails.nombre || campanaDetails.nombre_campania || '');
      setStatus((campanaDetails.status || '').toLowerCase().trim());
      setNotas(campanaDetails.notas || '');
      setDescripcion(campanaDetails.descripcion || '');

      // Period
      setYearInicio(campanaDetails.catorcena_inicio_anio || undefined);
      setYearFin(campanaDetails.catorcena_fin_anio || undefined);
      setCatorcenaInicio(campanaDetails.catorcena_inicio_num || undefined);
      setCatorcenaFin(campanaDetails.catorcena_fin_num || undefined);

      // Client info (readonly)
      setCuic(campanaDetails.cuic || null);
      setUnidadNegocio(campanaDetails.T1_U_UnidadNegocio || '');
      setAgencia(campanaDetails.T0_U_Agencia || '');
      setMarca(campanaDetails.T2_U_Marca || '');
      setProducto(campanaDetails.T2_U_Producto || '');
      setRazonSocial(campanaDetails.T0_U_RazonSocial || campanaDetails.cliente_razon_social || '');
      setAsesor(campanaDetails.T0_U_Asesor || '');
      setCategoria(campanaDetails.T2_U_Categoria || '');
      setClienteNombre(campanaDetails.cliente_nombre || campanaDetails.T0_U_Cliente || '');
    }
  }, [campanaDetails, isOpen]);

  // Initialize caras from API
  useEffect(() => {
    if (carasData && isOpen) {
      const carasWithIds: CaraItem[] = carasData.map((cara, idx) => ({
        localId: `cara-${cara.id || idx}-${Date.now()}`,
        id: cara.id,
        ciudad: cara.ciudad || '',
        estados: cara.estados || '',
        tipo: cara.tipo || '',
        flujo: cara.flujo || '',
        bonificacion: Number(cara.bonificacion) || 0,
        caras: Number(cara.caras) || 0,
        nivel_socioeconomico: cara.nivel_socioeconomico || '',
        formato: cara.formato || '',
        costo: Number(cara.costo) || 0,
        tarifa_publica: Number(cara.tarifa_publica) || 0,
        inicio_periodo: cara.inicio_periodo || '',
        fin_periodo: cara.fin_periodo || '',
        caras_flujo: Number(cara.caras_flujo) || 0,
        caras_contraflujo: Number(cara.caras_contraflujo) || 0,
        articulo: cara.articulo || '',
        descuento: Number(cara.descuento) || 0,
      }));
      setCaras(carasWithIds);
    }
  }, [carasData, isOpen]);

  // Initialize reservas from existing inventory (sin APS - editables)
  // y también del inventario con APS (bloqueados)
  useEffect(() => {
    if (caras.length > 0 && isOpen) {
      const reservasFromInventario: ReservaItem[] = [];

      // Agregar inventario sin APS (editable)
      if (inventarioReservado) {
        inventarioReservado.forEach((inv, idx) => {
          const matchingCara = caras.find(c => c.articulo === inv.articulo);
          if (matchingCara) {
            reservasFromInventario.push({
              id: `${matchingCara.localId}-${inv.id}-${idx}`,
              inventario_id: inv.id,
              codigo_unico: inv.codigo_unico,
              tipo: (inv.tipo_de_cara === 'Flujo' ? 'Flujo' : inv.tipo_de_cara === 'Contraflujo' ? 'Contraflujo' : 'Flujo') as 'Flujo' | 'Contraflujo' | 'Bonificacion',
              catorcena: inv.numero_catorcena || 0,
              anio: inv.anio_catorcena || 0,
              latitud: inv.latitud || 0,
              longitud: inv.longitud || 0,
              plaza: inv.plaza || '',
              formato: inv.tipo_medio || '',
              hasAPS: false, // Sin APS - editable
            });
          }
        });
      }

      // Agregar inventario con APS (bloqueado)
      if (inventarioConAPS) {
        inventarioConAPS.forEach((inv, idx) => {
          const matchingCara = caras.find(c => c.articulo === inv.articulo);
          if (matchingCara) {
            reservasFromInventario.push({
              id: `${matchingCara.localId}-aps-${inv.id}-${idx}`,
              inventario_id: inv.id,
              codigo_unico: inv.codigo_unico,
              tipo: (inv.tipo_de_cara === 'Flujo' ? 'Flujo' : inv.tipo_de_cara === 'Contraflujo' ? 'Contraflujo' : 'Flujo') as 'Flujo' | 'Contraflujo' | 'Bonificacion',
              catorcena: inv.numero_catorcena || 0,
              anio: inv.anio_catorcena || 0,
              latitud: inv.latitud || 0,
              longitud: inv.longitud || 0,
              plaza: inv.plaza || '',
              formato: inv.tipo_medio || '',
              aps: inv.aps,
              hasAPS: true, // Con APS - bloqueado
            });
          }
        });
      }

      setReservas(reservasFromInventario);
    }
  }, [inventarioReservado, inventarioConAPS, caras, isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setViewState('main');
      setStep(1);
      setSelectedCaraForSearch(null);
      setSelectedInventory(new Set());
    }
  }, [isOpen]);

  // Expand all catorcenas by default
  useEffect(() => {
    if (caras.length > 0) {
      const periodos = new Set(caras.map(c => c.inicio_periodo || 'Sin periodo'));
      setExpandedCatorcenas(periodos);
    }
  }, [caras]);

  // Calculate KPIs for caras
  const carasKPIs = useMemo(() => {
    const totalRenta = caras.reduce((acc, c) => acc + (c.caras || 0), 0);
    const totalBonificacion = caras.reduce((acc, c) => acc + (c.bonificacion || 0), 0);
    const totalInversion = caras.reduce((acc, c) => acc + ((c.caras || 0) * (c.tarifa_publica || 0)), 0);
    return { totalRenta, totalBonificacion, totalInversion };
  }, [caras]);

  // Calculate KPIs for reservas
  const reservasKPIs = useMemo(() => {
    const flujo = reservas.filter(r => r.tipo === 'Flujo').length;
    const contraflujo = reservas.filter(r => r.tipo === 'Contraflujo').length;
    const bonificadas = reservas.filter(r => r.tipo === 'Bonificacion').length;
    const total = reservas.length;
    const conAPS = reservas.filter(r => r.hasAPS).length;
    const sinAPS = reservas.filter(r => !r.hasAPS).length;
    return { flujo, contraflujo, bonificadas, total, conAPS, sinAPS };
  }, [reservas]);

  // Group caras by catorcena
  const carasGroupedByCatorcena = useMemo(() => {
    const groups: Record<string, { caras: CaraItem[]; catorcenaNum?: number; year?: number }> = {};

    caras.forEach(cara => {
      const periodo = cara.inicio_periodo || 'Sin periodo';
      if (!groups[periodo]) {
        groups[periodo] = { caras: [] };
      }
      groups[periodo].caras.push(cara);
    });

    return Object.entries(groups)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, value]) => [key, value] as const);
  }, [caras]);

  // Get cara completion status
  const getCaraCompletionStatus = (cara: CaraItem) => {
    const caraReservas = reservas.filter(r => r.id.startsWith(cara.localId));
    const flujoReservado = caraReservas.filter(r => r.tipo === 'Flujo').length;
    const contraflujoReservado = caraReservas.filter(r => r.tipo === 'Contraflujo').length;
    const bonificacionReservado = caraReservas.filter(r => r.tipo === 'Bonificacion').length;

    const totalRequerido = (cara.caras_flujo || 0) + (cara.caras_contraflujo || 0) + (cara.bonificacion || 0);
    const totalReservado = flujoReservado + contraflujoReservado + bonificacionReservado;

    // Calcular si tiene reservas y si todas tienen APS (grupo bloqueado)
    const reservasConAPS = caraReservas.filter(r => r.hasAPS);
    const reservasSinAPS = caraReservas.filter(r => !r.hasAPS);
    const hasAllAPS = caraReservas.length > 0 && reservasSinAPS.length === 0;
    const hasSomeAPS = reservasConAPS.length > 0;

    return {
      flujoReservado,
      contraflujoReservado,
      bonificacionReservado,
      totalRequerido,
      totalReservado,
      isComplete: totalReservado >= totalRequerido && totalRequerido > 0,
      percentage: totalRequerido > 0 ? Math.round((totalReservado / totalRequerido) * 100) : 0,
      hasAllAPS, // true si todas las reservas tienen APS - grupo completamente bloqueado
      hasSomeAPS, // true si alguna reserva tiene APS
      reservasConAPS: reservasConAPS.length,
      reservasSinAPS: reservasSinAPS.length,
    };
  };

  // Handle open search for cara
  const handleOpenSearchForCara = (cara: CaraItem) => {
    setSelectedCaraForSearch(cara);
    setViewState('search-inventory');
    setSearchViewTab('buscar');
  };

  // Handle save cara (add or update)
  const handleSaveCara = () => {
    if (!newCara.formato || !newCara.estados) {
      alert('Por favor completa al menos el formato y estado');
      return;
    }

    if (editingCaraId) {
      // Update existing cara
      setCaras(prev => prev.map(c =>
        c.localId === editingCaraId
          ? { ...c, ...newCara }
          : c
      ));
      setEditingCaraId(null);
    } else {
      // Add new cara
      const newCaraItem: CaraItem = {
        ...newCara,
        localId: `cara-new-${Date.now()}`,
      };
      setCaras(prev => [...prev, newCaraItem]);
    }

    setNewCara(EMPTY_CARA);
    setShowAddCaraForm(false);
  };

  // Handle cancel cara form
  const handleCancelCaraForm = () => {
    setNewCara(EMPTY_CARA);
    setShowAddCaraForm(false);
    setEditingCaraId(null);
  };

  // Handle edit cara
  const handleEditCara = (cara: CaraItem) => {
    setEditingCaraId(cara.localId);
    setNewCara({
      id: cara.id,
      ciudad: cara.ciudad,
      estados: cara.estados,
      tipo: cara.tipo,
      flujo: cara.flujo,
      bonificacion: cara.bonificacion,
      caras: cara.caras,
      nivel_socioeconomico: cara.nivel_socioeconomico,
      formato: cara.formato,
      costo: cara.costo,
      tarifa_publica: cara.tarifa_publica,
      inicio_periodo: cara.inicio_periodo,
      fin_periodo: cara.fin_periodo,
      caras_flujo: cara.caras_flujo,
      caras_contraflujo: cara.caras_contraflujo,
      articulo: cara.articulo,
      descuento: cara.descuento,
    });
    setShowAddCaraForm(true);
  };

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      return campanasService.update(campana.id, {
        nombre,
        status,
        descripcion,
        notas,
        catorcenaInicioNum: catorcenaInicio,
        catorcenaInicioAnio: yearInicio,
        catorcenaFinNum: catorcenaFin,
        catorcenaFinAnio: yearFin,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campanas'] });
      queryClient.invalidateQueries({ queryKey: ['campana-details', campana.id] });
      onClose();
    },
  });

  // Handle save
  const handleSave = () => {
    setIsSaving(true);
    updateMutation.mutate();
  };

  // Map center
  const mapCenter = useMemo(() => {
    if (inventoryData && inventoryData.length > 0) {
      const firstWithCoords = inventoryData.find(i => i.latitud && i.longitud);
      if (firstWithCoords) {
        return { lat: firstWithCoords.latitud, lng: firstWithCoords.longitud };
      }
    }
    return { lat: 20.6597, lng: -103.3496 }; // Default: Guadalajara
  }, [inventoryData]);

  // Get reservas for current cara
  const currentCaraReservas = useMemo(() => {
    if (!selectedCaraForSearch) return [];
    return reservas.filter(r => r.id.startsWith(selectedCaraForSearch.localId));
  }, [reservas, selectedCaraForSearch]);

  if (!isOpen) return null;

  // Main modal render
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-[95vw] max-w-[1400px] h-[90vh] bg-zinc-900 rounded-2xl border border-purple-500/20 shadow-2xl flex flex-col overflow-hidden">

        {/* Search Inventory View */}
        {viewState === 'search-inventory' && selectedCaraForSearch && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <div>
                <h2 className="text-lg font-semibold text-white">Inventario - {selectedCaraForSearch.formato}</h2>
                <p className="text-sm text-zinc-400">{selectedCaraForSearch.estados} • {selectedCaraForSearch.tipo}</p>
              </div>
              <button onClick={onClose} className="p-2 rounded-lg text-zinc-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-zinc-800">
              <button
                onClick={() => setSearchViewTab('buscar')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  searchViewTab === 'buscar'
                    ? 'text-purple-400 border-b-2 border-purple-500'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Search className="h-4 w-4 inline mr-2" />
                Buscar Inventario
              </button>
              <button
                onClick={() => setSearchViewTab('reservados')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  searchViewTab === 'reservados'
                    ? 'text-purple-400 border-b-2 border-purple-500'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Package className="h-4 w-4 inline mr-2" />
                Reservados ({currentCaraReservas.length})
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4">
              {searchViewTab === 'buscar' ? (
                <div className="grid grid-cols-2 gap-4 h-full">
                  {/* Filters */}
                  <div className="space-y-4">
                    <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50">
                      <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                        <Filter className="h-4 w-4 text-purple-400" />
                        Filtros
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-zinc-500 mb-1 block">Plaza</label>
                          <select
                            value={searchFilters.plaza}
                            onChange={(e) => setSearchFilters(prev => ({ ...prev, plaza: e.target.value }))}
                            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white"
                          >
                            <option value="">Todas</option>
                            {inventoryFilters?.plazas.map(p => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-zinc-500 mb-1 block">Tipo</label>
                          <select
                            value={searchFilters.tipo}
                            onChange={(e) => setSearchFilters(prev => ({ ...prev, tipo: e.target.value }))}
                            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white"
                          >
                            <option value="">Todos</option>
                            {inventoryFilters?.tipos.map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Results list */}
                    <div className="bg-zinc-800/50 rounded-xl border border-zinc-700/50 overflow-hidden flex-1">
                      <div className="px-4 py-2 border-b border-zinc-700/50 bg-zinc-800/50">
                        <span className="text-xs text-zinc-400">
                          {inventoryLoading ? 'Cargando...' : `${inventoryData?.length || 0} resultados`}
                        </span>
                      </div>
                      <div className="max-h-[400px] overflow-y-auto">
                        {inventoryData?.slice(0, 50).map((item, idx) => (
                          <div
                            key={item.id || idx}
                            className="px-4 py-2 border-b border-zinc-700/30 hover:bg-zinc-700/30 cursor-pointer"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-white font-mono">{item.codigo_unico}</p>
                                <p className="text-xs text-zinc-500">{item.plaza} • {item.tipo_de_mueble}</p>
                              </div>
                              <span className="text-xs text-zinc-400">{item.tipo_de_cara}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Map */}
                  <div className="bg-zinc-800/50 rounded-xl border border-zinc-700/50 overflow-hidden">
                    {mapsLoaded ? (
                      <GoogleMap
                        mapContainerStyle={{ width: '100%', height: '100%' }}
                        center={mapCenter}
                        zoom={12}
                        options={{
                          styles: DARK_MAP_STYLES,
                          disableDefaultUI: true,
                          zoomControl: true,
                        }}
                        onLoad={(map) => { mapRef.current = map; }}
                      >
                        {inventoryData?.map((item, idx) => (
                          item.latitud && item.longitud && (
                            <Marker
                              key={item.id || idx}
                              position={{ lat: item.latitud, lng: item.longitud }}
                            />
                          )
                        ))}
                      </GoogleMap>
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <Loader2 className="h-8 w-8 text-purple-400 animate-spin" />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                // Reservados tab
                <div className="space-y-4">
                  <div className="bg-zinc-800/50 rounded-xl border border-zinc-700/50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-zinc-700/50 bg-zinc-800/50">
                      <h3 className="text-sm font-medium text-white">
                        Inventario Reservado ({currentCaraReservas.length})
                      </h3>
                    </div>
                    <div className="max-h-[500px] overflow-y-auto">
                      {currentCaraReservas.length === 0 ? (
                        <div className="p-8 text-center text-zinc-500">
                          <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
                          <p>No hay inventario reservado para esta cara</p>
                        </div>
                      ) : (
                        currentCaraReservas.map((reserva, idx) => (
                          <div
                            key={reserva.id}
                            className={`px-4 py-3 border-b border-zinc-700/30 ${
                              reserva.hasAPS
                                ? 'bg-amber-500/5 border-l-2 border-l-amber-500/50'
                                : 'hover:bg-zinc-700/30'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {reserva.hasAPS ? (
                                  <Lock className="h-4 w-4 text-amber-400 flex-shrink-0" />
                                ) : (
                                  <Unlock className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                                )}
                                <div>
                                  <p className="text-sm text-white font-mono">{reserva.codigo_unico}</p>
                                  <p className="text-xs text-zinc-500">
                                    {reserva.plaza} • {reserva.tipo}
                                    {reserva.hasAPS && reserva.aps && (
                                      <span className="ml-2 text-amber-400">APS #{reserva.aps}</span>
                                    )}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-xs ${
                                  reserva.tipo === 'Flujo' ? 'bg-emerald-500/20 text-emerald-300' :
                                  reserva.tipo === 'Contraflujo' ? 'bg-blue-500/20 text-blue-300' :
                                  'bg-amber-500/20 text-amber-300'
                                }`}>
                                  {reserva.tipo}
                                </span>
                                {reserva.hasAPS ? (
                                  <span className="px-2 py-0.5 rounded text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    Bloqueado
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    Editable
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Main View */}
        {viewState === 'main' && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <div>
                <h2 className="text-lg font-semibold text-white">Asignar Inventario</h2>
                <p className="text-sm text-zinc-400">Campaña #{campana.id}</p>
              </div>
              <div className="flex items-center gap-3">
                {campana.cotizacion_id && (
                  <button
                    onClick={() => {
                      onClose();
                      navigate(`/propuestas/compartir/${campana.cotizacion_id}`);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded-xl text-sm font-medium hover:bg-cyan-500/30 transition-colors"
                  >
                    <Share2 className="h-4 w-4" />
                    Compartir
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-xl text-sm font-medium hover:bg-purple-600 transition-colors disabled:opacity-50"
                >
                  {updateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Guardar
                </button>
                <button onClick={onClose} className="p-2 rounded-lg text-zinc-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Progress steps */}
            <div className="px-6 py-3 border-b border-zinc-800 bg-zinc-900/50">
              <div className="flex items-center gap-2">
                {STEPS.map((s, i) => (
                  <React.Fragment key={s.num}>
                    <button
                      onClick={() => setStep(s.num)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        step === s.num
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                          : step > s.num
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-zinc-800/50 text-zinc-500 border border-zinc-700/50'
                      }`}
                    >
                      {step > s.num ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                      {s.label}
                    </button>
                    {i < STEPS.length - 1 && <div className="flex-1 h-px bg-zinc-700" />}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6 space-y-6">
              {(detailsLoading || carasLoading) ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 text-purple-400 animate-spin" />
                </div>
              ) : (
                <>
                  {/* Step 1: Información del Cliente */}
                  {step === 1 && (
                    <div className="space-y-6">
                      <div className="text-center mb-6">
                        <h3 className="text-lg font-semibold text-white">Información del Cliente</h3>
                        <p className="text-sm text-zinc-400">Datos asociados a esta campaña (solo lectura)</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
                          <label className="text-[10px] text-zinc-500 uppercase font-medium">CUIC</label>
                          <p className="text-white font-mono mt-1">{cuic || '-'}</p>
                        </div>
                        <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
                          <label className="text-[10px] text-zinc-500 uppercase font-medium">Cliente</label>
                          <p className="text-white mt-1 truncate" title={clienteNombre}>{clienteNombre || '-'}</p>
                        </div>
                        <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700/50 col-span-2">
                          <label className="text-[10px] text-zinc-500 uppercase font-medium">Razón Social</label>
                          <p className="text-white mt-1 truncate" title={razonSocial}>{razonSocial || '-'}</p>
                        </div>
                        <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
                          <label className="text-[10px] text-zinc-500 uppercase font-medium">Unidad de Negocio</label>
                          <p className="text-white mt-1">{unidadNegocio || '-'}</p>
                        </div>
                        <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
                          <label className="text-[10px] text-zinc-500 uppercase font-medium">Agencia</label>
                          <p className="text-white mt-1">{agencia || '-'}</p>
                        </div>
                        <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
                          <label className="text-[10px] text-zinc-500 uppercase font-medium">Asesor</label>
                          <p className="text-white mt-1">{asesor || '-'}</p>
                        </div>
                        <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
                          <label className="text-[10px] text-zinc-500 uppercase font-medium">Creador</label>
                          <p className="text-white mt-1">{campanaDetails?.creador_nombre || '-'}</p>
                        </div>
                      </div>

                      {/* Producto/Marca */}
                      <div className="mt-6">
                        <h4 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2 mb-4">
                          <Package className="h-4 w-4" />
                          Producto / Marca
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
                            <label className="text-[10px] text-zinc-500 uppercase font-medium">Marca</label>
                            <p className="text-white mt-1">{marca || '-'}</p>
                          </div>
                          <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
                            <label className="text-[10px] text-zinc-500 uppercase font-medium">Producto</label>
                            <p className="text-white mt-1">{producto || '-'}</p>
                          </div>
                          <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
                            <label className="text-[10px] text-zinc-500 uppercase font-medium">Categoría</label>
                            <p className="text-white mt-1">{categoria || '-'}</p>
                          </div>
                          <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
                            <label className="text-[10px] text-zinc-500 uppercase font-medium">Artículo</label>
                            <p className="text-white font-mono text-sm mt-1">{campana.articulo || '-'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 2: Datos de la Campaña */}
                  {step === 2 && (
                    <div className="space-y-6">
                      <div className="text-center mb-6">
                        <h3 className="text-lg font-semibold text-white">Datos de la Campaña</h3>
                        <p className="text-sm text-zinc-400">Información editable de la campaña</p>
                      </div>

                      {/* Nombre */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                          <Tag className="h-4 w-4 text-purple-400" />
                          Nombre de Campaña
                        </label>
                        <input
                          type="text"
                          value={nombre}
                          onChange={(e) => setNombre(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-zinc-700 bg-zinc-800/50 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-all"
                          placeholder="Nombre de la campaña"
                        />
                      </div>

                      {/* Status */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                          <FileText className="h-4 w-4 text-cyan-400" />
                          Estatus
                        </label>
                        <select
                          value={status}
                          onChange={(e) => setStatus(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-zinc-700 bg-zinc-800/50 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-all"
                        >
                          <option value="">Seleccionar estatus</option>
                          {STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Período */}
                      <div className="space-y-3">
                        <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-emerald-400" />
                          Período
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <span className="text-xs text-zinc-500">Año inicio</span>
                            <select
                              value={yearInicio || ''}
                              onChange={(e) => {
                                const val = e.target.value ? parseInt(e.target.value) : undefined;
                                setYearInicio(val);
                                if (!val) setCatorcenaInicio(undefined);
                              }}
                              className="w-full px-4 py-2 rounded-xl border border-zinc-700 bg-zinc-800/50 text-white"
                            >
                              <option value="">Seleccionar</option>
                              {years.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <span className="text-xs text-zinc-500">Catorcena inicio</span>
                            <select
                              value={catorcenaInicio || ''}
                              onChange={(e) => setCatorcenaInicio(e.target.value ? parseInt(e.target.value) : undefined)}
                              disabled={!yearInicio}
                              className="w-full px-4 py-2 rounded-xl border border-zinc-700 bg-zinc-800/50 text-white disabled:opacity-50"
                            >
                              <option value="">Seleccionar</option>
                              {catorcenasInicioOptions.map(c => (
                                <option key={c.id} value={c.numero_catorcena}>Cat {c.numero_catorcena}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <span className="text-xs text-zinc-500">Año fin</span>
                            <select
                              value={yearFin || ''}
                              onChange={(e) => {
                                const val = e.target.value ? parseInt(e.target.value) : undefined;
                                setYearFin(val);
                                if (!val) setCatorcenaFin(undefined);
                              }}
                              className="w-full px-4 py-2 rounded-xl border border-zinc-700 bg-zinc-800/50 text-white"
                            >
                              <option value="">Seleccionar</option>
                              {years.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <span className="text-xs text-zinc-500">Catorcena fin</span>
                            <select
                              value={catorcenaFin || ''}
                              onChange={(e) => setCatorcenaFin(e.target.value ? parseInt(e.target.value) : undefined)}
                              disabled={!yearFin}
                              className="w-full px-4 py-2 rounded-xl border border-zinc-700 bg-zinc-800/50 text-white disabled:opacity-50"
                            >
                              <option value="">Seleccionar</option>
                              {catorcenasFinOptions.map(c => (
                                <option key={c.id} value={c.numero_catorcena}>Cat {c.numero_catorcena}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Descripción */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300">Descripción</label>
                        <textarea
                          value={descripcion}
                          onChange={(e) => setDescripcion(e.target.value)}
                          rows={3}
                          className="w-full px-4 py-3 rounded-xl border border-zinc-700 bg-zinc-800/50 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30 resize-none"
                          placeholder="Descripción de la campaña..."
                        />
                      </div>

                      {/* Notas */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300">Notas</label>
                        <textarea
                          value={notas}
                          onChange={(e) => setNotas(e.target.value)}
                          rows={3}
                          className="w-full px-4 py-3 rounded-xl border border-zinc-700 bg-zinc-800/50 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30 resize-none"
                          placeholder="Notas adicionales..."
                        />
                      </div>
                    </div>
                  )}

                  {/* Step 3: Inventario */}
                  {step === 3 && (
                    <div className="space-y-6">
                      <div className="text-center mb-6">
                        <h3 className="text-lg font-semibold text-white">Inventario Asignado</h3>
                        <p className="text-sm text-zinc-400">Caras y reservas de la campaña</p>
                      </div>

                      {/* KPIs */}
                      <div className="grid grid-cols-5 gap-4">
                        <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30">
                          <p className="text-xs text-purple-300 uppercase">Caras Renta</p>
                          <p className="text-2xl font-bold text-white">{carasKPIs.totalRenta}</p>
                        </div>
                        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                          <p className="text-xs text-emerald-300 uppercase flex items-center gap-1">
                            <Unlock className="h-3 w-3" /> Editables
                          </p>
                          <p className="text-2xl font-bold text-white">{reservasKPIs.sinAPS}</p>
                        </div>
                        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                          <p className="text-xs text-amber-300 uppercase flex items-center gap-1">
                            <Lock className="h-3 w-3" /> Con APS
                          </p>
                          <p className="text-2xl font-bold text-white">{reservasKPIs.conAPS}</p>
                        </div>
                        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
                          <p className="text-xs text-blue-300 uppercase">Total Reservas</p>
                          <p className="text-2xl font-bold text-white">{reservasKPIs.total}</p>
                        </div>
                        <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
                          <p className="text-xs text-cyan-300 uppercase">Inversión</p>
                          <p className="text-xl font-bold text-white">{formatCurrency(carasKPIs.totalInversion)}</p>
                        </div>
                      </div>

                      {/* Caras list */}
                      <div className="bg-zinc-800/30 rounded-2xl border border-zinc-700/50 overflow-hidden">
                        <div className="px-5 py-3 border-b border-zinc-700/50 bg-zinc-800/50 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <h3 className="text-sm font-medium text-white flex items-center gap-2">
                              <Layers className="h-4 w-4 text-purple-400" />
                              Formatos / Caras ({caras.length})
                            </h3>
                            <span className="text-zinc-400 text-xs">
                              Renta: <span className="text-purple-300 font-medium">{carasKPIs.totalRenta}</span>
                            </span>
                            <span className="text-zinc-400 text-xs">
                              Bonificación: <span className="text-emerald-300 font-medium">{carasKPIs.totalBonificacion}</span>
                            </span>
                            <span className="text-zinc-400 text-xs">
                              Inversión: <span className="text-amber-300 font-medium">{formatCurrency(carasKPIs.totalInversion)}</span>
                            </span>
                          </div>
                          <button
                            onClick={() => { setShowAddCaraForm(true); setEditingCaraId(null); setNewCara(EMPTY_CARA); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded-lg hover:bg-purple-500/30 transition-colors"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Agregar Cara
                          </button>
                        </div>

                        {/* Add/Edit Cara Form */}
                        {showAddCaraForm && (
                          <div className="px-5 py-4 bg-zinc-800/50 border-b border-zinc-700/50">
                            <h4 className="text-sm font-medium text-white mb-4">
                              {editingCaraId ? 'Editar Cara' : 'Nueva Cara'}
                            </h4>
                            <div className="grid grid-cols-4 gap-4 mb-4">
                              <div className="space-y-1">
                                <label className="text-xs text-zinc-500">Estado</label>
                                <select
                                  value={newCara.estados}
                                  onChange={(e) => setNewCara({ ...newCara, estados: e.target.value })}
                                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                                >
                                  <option value="">Seleccionar</option>
                                  {solicitudFilters?.estados.map(e => (
                                    <option key={e} value={e}>{e}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-zinc-500">Ciudad</label>
                                <select
                                  value={newCara.ciudad}
                                  onChange={(e) => setNewCara({ ...newCara, ciudad: e.target.value })}
                                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                                >
                                  <option value="">Seleccionar</option>
                                  {solicitudFilters?.ciudades
                                    .filter(c => !newCara.estados || c.estado === newCara.estados)
                                    .map(c => (
                                      <option key={c.ciudad} value={c.ciudad}>{c.ciudad}</option>
                                    ))}
                                </select>
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-zinc-500">Formato</label>
                                <select
                                  value={newCara.formato}
                                  onChange={(e) => setNewCara({ ...newCara, formato: e.target.value })}
                                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                                >
                                  <option value="">Seleccionar</option>
                                  {solicitudFilters?.formatos.map(f => (
                                    <option key={f} value={f}>{f}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-zinc-500">Tipo</label>
                                <select
                                  value={newCara.tipo}
                                  onChange={(e) => setNewCara({ ...newCara, tipo: e.target.value })}
                                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                                >
                                  <option value="">Seleccionar</option>
                                  <option value="Tradicional">Tradicional</option>
                                  <option value="Digital">Digital</option>
                                </select>
                              </div>
                            </div>
                            <div className="grid grid-cols-5 gap-4 mb-4">
                              <div className="space-y-1">
                                <label className="text-xs text-zinc-500">Caras Flujo</label>
                                <input
                                  type="number"
                                  value={newCara.caras_flujo || ''}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0;
                                    setNewCara({ ...newCara, caras_flujo: val, caras: val + (newCara.caras_contraflujo || 0) });
                                  }}
                                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                                  min="0"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-zinc-500">Caras Contraflujo</label>
                                <input
                                  type="number"
                                  value={newCara.caras_contraflujo || ''}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0;
                                    setNewCara({ ...newCara, caras_contraflujo: val, caras: (newCara.caras_flujo || 0) + val });
                                  }}
                                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                                  min="0"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-zinc-500">Bonificación</label>
                                <input
                                  type="number"
                                  value={newCara.bonificacion || ''}
                                  onChange={(e) => setNewCara({ ...newCara, bonificacion: parseInt(e.target.value) || 0 })}
                                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                                  min="0"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-zinc-500">Tarifa Pública</label>
                                <input
                                  type="number"
                                  value={newCara.tarifa_publica || ''}
                                  onChange={(e) => setNewCara({ ...newCara, tarifa_publica: parseFloat(e.target.value) || 0 })}
                                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                                  min="0"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-zinc-500">NSE</label>
                                <select
                                  value={newCara.nivel_socioeconomico}
                                  onChange={(e) => setNewCara({ ...newCara, nivel_socioeconomico: e.target.value })}
                                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                                >
                                  <option value="">Seleccionar</option>
                                  {solicitudFilters?.nse.map(n => (
                                    <option key={n} value={n}>{n}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={handleCancelCaraForm}
                                className="px-4 py-2 bg-zinc-700 text-zinc-300 rounded-lg text-sm hover:bg-zinc-600 transition-colors"
                              >
                                Cancelar
                              </button>
                              <button
                                onClick={handleSaveCara}
                                className="px-4 py-2 bg-purple-500 text-white rounded-lg text-sm hover:bg-purple-600 transition-colors"
                              >
                                {editingCaraId ? 'Actualizar' : 'Agregar'}
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="divide-y divide-zinc-700/30 max-h-[400px] overflow-y-auto">
                          {caras.length === 0 ? (
                            <div className="p-8 text-center text-zinc-500">
                              <Layers className="h-10 w-10 mx-auto mb-3 opacity-30" />
                              <p>No hay formatos/caras en esta campaña</p>
                              <button
                                onClick={() => setShowAddCaraForm(true)}
                                className="mt-3 text-purple-400 hover:text-purple-300 text-sm"
                              >
                                Agregar primera cara
                              </button>
                            </div>
                          ) : (
                            caras.map((cara) => {
                              const completionStatus = getCaraCompletionStatus(cara);
                              const isExpanded = expandedCaras.has(cara.localId);

                              return (
                                <div key={cara.localId} className="border-b border-zinc-700/30">
                                  {/* Cara header */}
                                  <div
                                    className="px-4 py-3 flex items-center gap-3 hover:bg-zinc-800/30 cursor-pointer"
                                    onClick={() => {
                                      const newExpanded = new Set(expandedCaras);
                                      if (isExpanded) {
                                        newExpanded.delete(cara.localId);
                                      } else {
                                        newExpanded.add(cara.localId);
                                      }
                                      setExpandedCaras(newExpanded);
                                    }}
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="h-4 w-4 text-zinc-500" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 text-zinc-500" />
                                    )}

                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-white">{cara.formato || 'Sin formato'}</span>
                                        <span className="text-xs text-zinc-500">•</span>
                                        <span className="text-xs text-zinc-400">{cara.estados}</span>
                                        <span className="text-xs text-zinc-500">•</span>
                                        <span className="text-xs text-zinc-400">{cara.tipo}</span>
                                      </div>
                                      <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                                        <span>Flujo: {cara.caras_flujo || 0}</span>
                                        <span>Contraflujo: {cara.caras_contraflujo || 0}</span>
                                        <span>Bonif: {cara.bonificacion || 0}</span>
                                      </div>
                                    </div>

                                    {/* Progress */}
                                    <div className="flex items-center gap-3">
                                      <div className="w-24 h-2 bg-zinc-700 rounded-full overflow-hidden">
                                        <div
                                          className={`h-full transition-all ${
                                            completionStatus.isComplete ? 'bg-emerald-500' : 'bg-purple-500'
                                          }`}
                                          style={{ width: `${Math.min(100, completionStatus.percentage)}%` }}
                                        />
                                      </div>
                                      <span className="text-xs text-zinc-400 w-12 text-right">
                                        {completionStatus.percentage}%
                                      </span>
                                    </div>

                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!completionStatus.hasAllAPS) {
                                          handleEditCara(cara);
                                        }
                                      }}
                                      disabled={completionStatus.hasAllAPS}
                                      className={`p-2 rounded-lg border ${
                                        completionStatus.hasAllAPS
                                          ? 'bg-zinc-700/30 text-zinc-500 border-zinc-600/30 cursor-not-allowed'
                                          : 'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border-cyan-500/30'
                                      }`}
                                      title={completionStatus.hasAllAPS ? "Grupo bloqueado - todas las reservas tienen APS" : "Editar cara"}
                                    >
                                      {completionStatus.hasAllAPS ? <Lock className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                                    </button>

                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!completionStatus.hasAllAPS) {
                                          handleOpenSearchForCara(cara);
                                        }
                                      }}
                                      disabled={completionStatus.hasAllAPS}
                                      className={`p-2 rounded-lg border ${
                                        completionStatus.hasAllAPS
                                          ? 'bg-zinc-700/30 text-zinc-500 border-zinc-600/30 cursor-not-allowed'
                                          : 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border-purple-500/30'
                                      }`}
                                      title={completionStatus.hasAllAPS ? "Grupo bloqueado - todas las reservas tienen APS" : "Buscar inventario"}
                                    >
                                      <Search className="h-4 w-4" />
                                    </button>
                                  </div>

                                  {/* Expanded content */}
                                  {isExpanded && (() => {
                                    // Get reservas for this cara
                                    const caraReservas = reservas.filter(r => r.id.startsWith(cara.localId));
                                    const reservasSinAPS = caraReservas.filter(r => !r.hasAPS);
                                    const reservasConAPS = caraReservas.filter(r => r.hasAPS);

                                    return (
                                      <div className="px-4 py-3 bg-zinc-800/20 border-t border-zinc-700/30">
                                        <div className="grid grid-cols-4 gap-3 text-xs">
                                          <div>
                                            <span className="text-zinc-500">Artículo:</span>
                                            <span className="ml-2 text-white font-mono">{cara.articulo || '-'}</span>
                                          </div>
                                          <div>
                                            <span className="text-zinc-500">Tarifa:</span>
                                            <span className="ml-2 text-white">{formatCurrency(cara.tarifa_publica)}</span>
                                          </div>
                                          <div>
                                            <span className="text-zinc-500">NSE:</span>
                                            <span className="ml-2 text-white">{cara.nivel_socioeconomico || '-'}</span>
                                          </div>
                                          <div>
                                            <span className="text-zinc-500">Descuento:</span>
                                            <span className="ml-2 text-white">{cara.descuento}%</span>
                                          </div>
                                        </div>

                                        {/* Reservas summary */}
                                        <div className="mt-3 pt-3 border-t border-zinc-700/30">
                                          <div className="flex items-center justify-between mb-3">
                                            <p className="text-xs text-zinc-400">
                                              Reservas: {completionStatus.totalReservado} / {completionStatus.totalRequerido}
                                            </p>
                                            <div className="flex gap-2">
                                              <span className="px-2 py-0.5 rounded text-xs bg-emerald-500/20 text-emerald-300">
                                                Flujo: {completionStatus.flujoReservado}/{cara.caras_flujo || 0}
                                              </span>
                                              <span className="px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-300">
                                                Contraflujo: {completionStatus.contraflujoReservado}/{cara.caras_contraflujo || 0}
                                              </span>
                                              <span className="px-2 py-0.5 rounded text-xs bg-amber-500/20 text-amber-300">
                                                Bonif: {completionStatus.bonificacionReservado}/{cara.bonificacion || 0}
                                              </span>
                                            </div>
                                          </div>

                                          {/* Reservas sin APS - Editables */}
                                          {reservasSinAPS.length > 0 && (
                                            <div className="mb-3">
                                              <div className="flex items-center gap-2 mb-2">
                                                <Unlock className="h-3.5 w-3.5 text-emerald-400" />
                                                <span className="text-xs font-medium text-emerald-400">
                                                  Sin APS - Editables ({reservasSinAPS.length})
                                                </span>
                                              </div>
                                              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                                                {reservasSinAPS.map((reserva) => (
                                                  <div
                                                    key={reserva.id}
                                                    className="flex items-center justify-between px-2 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg"
                                                  >
                                                    <div className="flex items-center gap-2">
                                                      <span className="text-xs font-mono text-white">{reserva.codigo_unico}</span>
                                                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                                        reserva.tipo === 'Flujo' ? 'bg-emerald-500/20 text-emerald-300' :
                                                        reserva.tipo === 'Contraflujo' ? 'bg-blue-500/20 text-blue-300' :
                                                        'bg-amber-500/20 text-amber-300'
                                                      }`}>
                                                        {reserva.tipo}
                                                      </span>
                                                    </div>
                                                    <span className="text-[10px] text-zinc-500">{reserva.plaza}</span>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )}

                                          {/* Reservas con APS - Bloqueadas */}
                                          {reservasConAPS.length > 0 && (
                                            <div>
                                              <div className="flex items-center gap-2 mb-2">
                                                <Lock className="h-3.5 w-3.5 text-amber-400" />
                                                <span className="text-xs font-medium text-amber-400">
                                                  Con APS - Bloqueadas ({reservasConAPS.length})
                                                </span>
                                              </div>
                                              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                                                {reservasConAPS.map((reserva) => (
                                                  <div
                                                    key={reserva.id}
                                                    className="flex items-center justify-between px-2 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg opacity-70"
                                                  >
                                                    <div className="flex items-center gap-2">
                                                      <span className="text-xs font-mono text-white">{reserva.codigo_unico}</span>
                                                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                                        reserva.tipo === 'Flujo' ? 'bg-emerald-500/20 text-emerald-300' :
                                                        reserva.tipo === 'Contraflujo' ? 'bg-blue-500/20 text-blue-300' :
                                                        'bg-amber-500/20 text-amber-300'
                                                      }`}>
                                                        {reserva.tipo}
                                                      </span>
                                                    </div>
                                                    <span className="text-[10px] text-amber-400">APS #{reserva.aps}</span>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )}

                                          {/* No reservas message */}
                                          {caraReservas.length === 0 && (
                                            <div className="text-center py-3 text-zinc-500 text-xs">
                                              <Package className="h-5 w-5 mx-auto mb-1 opacity-50" />
                                              No hay inventario reservado para esta cara
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-900/50">
              <button
                type="button"
                onClick={() => step > 1 ? setStep(step - 1) : onClose()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all text-sm font-medium"
              >
                <ArrowLeft className="h-4 w-4" />
                {step === 1 ? 'Cancelar' : 'Anterior'}
              </button>

              {step < 3 ? (
                <button
                  type="button"
                  onClick={() => setStep(step + 1)}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white transition-all text-sm font-medium"
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/50 text-white transition-all text-sm font-medium"
                >
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Guardar Cambios
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Error message */}
            {updateMutation.isError && (
              <div className="px-6 py-3 bg-red-500/10 border-t border-red-500/20">
                <p className="text-sm text-red-400">
                  {updateMutation.error instanceof Error ? updateMutation.error.message : 'Error al guardar'}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
