import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ArrowLeft, MessageSquare, Send, X, FileSpreadsheet, ListTodo, Layers, ChevronDown, ChevronRight, Check } from 'lucide-react';
import { GoogleMap, useLoadScript, Marker } from '@react-google-maps/api';
import { Header } from '../../components/layout/Header';
import { campanasService, InventarioReservado, InventarioConAPS } from '../../services/campanas.service';
import { Badge } from '../../components/ui/badge';
import { formatDate } from '../../lib/utils';
import { useAuthStore } from '../../store/authStore';

const statusVariants: Record<string, 'secondary' | 'success' | 'warning' | 'info'> = {
  activa: 'success',
  Abierto: 'success',
  inactiva: 'secondary',
  Cerrado: 'secondary',
};

interface InfoItemProps {
  label: string;
  value: string | number | null | undefined;
  isDate?: boolean;
}

function InfoItem({ label, value, isDate }: InfoItemProps) {
  if (value === null || value === undefined || value === '') return null;

  const displayValue = isDate ? formatDate(String(value)) : value;

  return (
    <div className="flex justify-between py-1.5 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{displayValue}</span>
    </div>
  );
}

const GOOGLE_MAPS_API_KEY = 'AIzaSyB7Bzwydh91xZPdR8mGgqAV2hO72W1EVaw';

type GroupByField = 'inicio_periodo' | 'articulo' | 'plaza' | 'tipo_de_cara' | 'estatus_reserva';

interface GroupConfig {
  field: GroupByField;
  label: string;
}

const AVAILABLE_GROUPINGS: GroupConfig[] = [
  { field: 'inicio_periodo', label: 'Inicio Periodo' },
  { field: 'articulo', label: 'Artículo' },
  { field: 'plaza', label: 'Plaza' },
  { field: 'tipo_de_cara', label: 'Tipo de Cara' },
  { field: 'estatus_reserva', label: 'Estatus' },
];

// Helper para formatear inicio_periodo como "Catorcena X, Año YYYY"
function formatInicioPeriodo(item: InventarioReservado | InventarioConAPS): string {
  if (item.numero_catorcena && item.anio_catorcena) {
    return `Catorcena ${item.numero_catorcena}, ${item.anio_catorcena}`;
  }
  return item.inicio_periodo || 'Sin asignar';
}

// Helper para formatear articulo con info adicional
function formatArticulo(item: InventarioReservado | InventarioConAPS): string {
  console.log('formatArticulo item:', {
    articulo: item.articulo,
    solicitud_caras_id: item.solicitud_caras_id,
    tradicional_digital: item.tradicional_digital,
    caras_totales: item.caras_totales
  });
  const parts: string[] = [];

  if (item.articulo) {
    parts.push(item.articulo.toUpperCase());
  }

  if (item.solicitud_caras_id) {
    parts.push(`Grupo ${item.solicitud_caras_id}`);
  }

  if (item.tradicional_digital) {
    const tipo = item.tradicional_digital.charAt(0).toUpperCase() + item.tradicional_digital.slice(1).toLowerCase();
    parts.push(`${tipo} (${item.caras_totales})`);
  } else if (item.tipo_medio) {
    parts.push(item.tipo_medio);
  }

  return parts.length > 0 ? parts.join(' | ') : 'Sin asignar';
}

// Helper para obtener el valor de agrupación formateado
function getGroupValue(item: InventarioReservado | InventarioConAPS, field: GroupByField): string {
  if (field === 'inicio_periodo') {
    return formatInicioPeriodo(item);
  }
  if (field === 'articulo') {
    return formatArticulo(item);
  }
  return String(item[field] || 'Sin asignar');
}

export function CampanaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const campanaId = id ? parseInt(id, 10) : 1;
  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState('');
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  // Estado para selección de items (sin APS)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Estado para selección de items (con APS)
  const [selectedItemsAPS, setSelectedItemsAPS] = useState<Set<string>>(new Set());

  // Estado para agrupación (sin APS)
  const [activeGroupings, setActiveGroupings] = useState<GroupByField[]>(['inicio_periodo', 'articulo']);
  const [showGroupingConfig, setShowGroupingConfig] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Estado para agrupación (con APS)
  const [activeGroupingsAPS, setActiveGroupingsAPS] = useState<GroupByField[]>(['inicio_periodo', 'articulo']);
  const [showGroupingConfigAPS, setShowGroupingConfigAPS] = useState(false);
  const [expandedGroupsAPS, setExpandedGroupsAPS] = useState<Set<string>>(new Set());

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  const { data: campana, isLoading, error } = useQuery({
    queryKey: ['campana', campanaId],
    queryFn: () => campanasService.getById(campanaId),
  });

  const { data: inventarioReservado = [] } = useQuery({
    queryKey: ['campana-inventario', campanaId],
    queryFn: () => campanasService.getInventarioReservado(campanaId),
    enabled: !!campana,
  });

  const { data: inventarioConAPS = [] } = useQuery({
    queryKey: ['campana-inventario-aps', campanaId],
    queryFn: () => campanasService.getInventarioConAPS(campanaId),
    enabled: !!campana,
  });


  // Calcular centro del mapa basado en inventario
  const mapCenter = useMemo(() => {
    if (inventarioReservado.length > 0) {
      const validItems = inventarioReservado.filter(i => i.latitud && i.longitud);
      if (validItems.length > 0) {
        const avgLat = validItems.reduce((sum, i) => sum + i.latitud, 0) / validItems.length;
        const avgLng = validItems.reduce((sum, i) => sum + i.longitud, 0) / validItems.length;
        return { lat: avgLat, lng: avgLng };
      }
    }
    return { lat: 19.4326, lng: -99.1332 }; // CDMX por defecto
  }, [inventarioReservado]);

  // Callback para ajustar zoom del mapa a todos los puntos
  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;

    const validItems = inventarioReservado.filter(i => i.latitud && i.longitud);
    if (validItems.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      validItems.forEach(item => {
        bounds.extend({ lat: item.latitud, lng: item.longitud });
      });
      map.fitBounds(bounds, 50); // 50px padding
    }
  }, [inventarioReservado]);

  // Efecto para ajustar bounds cuando cambia el inventario
  useEffect(() => {
    if (mapRef.current && inventarioReservado.length > 1) {
      const validItems = inventarioReservado.filter(i => i.latitud && i.longitud);
      if (validItems.length > 1) {
        const bounds = new google.maps.LatLngBounds();
        validItems.forEach(item => {
          bounds.extend({ lat: item.latitud, lng: item.longitud });
        });
        mapRef.current.fitBounds(bounds, 50);
      }
    }
  }, [inventarioReservado]);

  // Agrupar datos del inventario
  const groupedInventario = useMemo(() => {
    if (activeGroupings.length === 0) {
      return { ungrouped: inventarioReservado };
    }

    const grouped: Record<string, InventarioReservado[] | Record<string, InventarioReservado[]>> = {};

    inventarioReservado.forEach(item => {
      const firstKey = getGroupValue(item, activeGroupings[0]);

      if (activeGroupings.length === 1) {
        if (!grouped[firstKey]) {
          grouped[firstKey] = [];
        }
        (grouped[firstKey] as InventarioReservado[]).push(item);
      } else {
        if (!grouped[firstKey]) {
          grouped[firstKey] = {};
        }
        const secondKey = getGroupValue(item, activeGroupings[1]);
        if (!(grouped[firstKey] as Record<string, InventarioReservado[]>)[secondKey]) {
          (grouped[firstKey] as Record<string, InventarioReservado[]>)[secondKey] = [];
        }
        (grouped[firstKey] as Record<string, InventarioReservado[]>)[secondKey].push(item);
      }
    });

    return grouped;
  }, [inventarioReservado, activeGroupings]);

  // Toggle grupo expandido
  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  // Toggle selección de item
  const toggleItemSelection = (rsvId: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(rsvId)) {
        next.delete(rsvId);
      } else {
        next.add(rsvId);
      }
      return next;
    });
  };

  // Seleccionar/deseleccionar todos
  const toggleSelectAll = () => {
    if (selectedItems.size === inventarioReservado.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(inventarioReservado.map(i => i.rsv_ids)));
    }
  };

  // Toggle agrupación (sin APS)
  const toggleGrouping = (field: GroupByField) => {
    setActiveGroupings(prev => {
      if (prev.includes(field)) {
        return prev.filter(f => f !== field);
      }
      if (prev.length < 2) {
        return [...prev, field];
      }
      return [prev[1], field];
    });
  };

  // Toggle agrupación (con APS)
  const toggleGroupingAPS = (field: GroupByField) => {
    setActiveGroupingsAPS(prev => {
      if (prev.includes(field)) {
        return prev.filter(f => f !== field);
      }
      if (prev.length < 2) {
        return [...prev, field];
      }
      return [prev[1], field];
    });
  };

  // Toggle selección de item (con APS)
  const toggleItemSelectionAPS = (rsvId: string) => {
    setSelectedItemsAPS(prev => {
      const next = new Set(prev);
      if (next.has(rsvId)) {
        next.delete(rsvId);
      } else {
        next.add(rsvId);
      }
      return next;
    });
  };

  // Seleccionar/deseleccionar todos (con APS)
  const toggleSelectAllAPS = () => {
    if (selectedItemsAPS.size === inventarioConAPS.length) {
      setSelectedItemsAPS(new Set());
    } else {
      setSelectedItemsAPS(new Set(inventarioConAPS.map(i => String(i.rsv_ids))));
    }
  };

  // Toggle grupo expandido (APS)
  const toggleGroupAPS = (groupKey: string) => {
    setExpandedGroupsAPS(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  // Agrupar datos del inventario con APS
  const groupedInventarioAPS = useMemo(() => {
    if (activeGroupingsAPS.length === 0) {
      return { ungrouped: inventarioConAPS };
    }

    const grouped: Record<string, InventarioConAPS[] | Record<string, InventarioConAPS[]>> = {};

    inventarioConAPS.forEach(item => {
      const firstKey = getGroupValue(item, activeGroupingsAPS[0]);

      if (activeGroupingsAPS.length === 1) {
        if (!grouped[firstKey]) {
          grouped[firstKey] = [];
        }
        (grouped[firstKey] as InventarioConAPS[]).push(item);
      } else {
        if (!grouped[firstKey]) {
          grouped[firstKey] = {};
        }
        const secondKey = getGroupValue(item, activeGroupingsAPS[1]);
        if (!(grouped[firstKey] as Record<string, InventarioConAPS[]>)[secondKey]) {
          (grouped[firstKey] as Record<string, InventarioConAPS[]>)[secondKey] = [];
        }
        (grouped[firstKey] as Record<string, InventarioConAPS[]>)[secondKey].push(item);
      }
    });

    return grouped;
  }, [inventarioConAPS, activeGroupingsAPS]);

  // Scroll al final cuando se abren comentarios o se agregan nuevos
  useEffect(() => {
    if (showComments && commentsEndRef.current) {
      commentsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [showComments, campana?.comentarios?.length]);

  const addCommentMutation = useMutation({
    mutationFn: (contenido: string) => campanasService.addComment(campanaId, contenido),
    onSuccess: () => {
      setComment('');
      queryClient.invalidateQueries({ queryKey: ['campana', campanaId] });
    },
  });

  const assignAPSMutation = useMutation({
    mutationFn: (inventarioIds: number[]) => campanasService.assignAPS(campanaId, inventarioIds),
    onSuccess: (data) => {
      // Limpiar selección y refrescar datos
      setSelectedItems(new Set());
      queryClient.invalidateQueries({ queryKey: ['campana-inventario', campanaId] });
      queryClient.invalidateQueries({ queryKey: ['campana-inventario-aps', campanaId] });
      alert(`${data.message}`);
    },
    onError: (error: Error) => {
      alert(`Error al asignar APS: ${error.message}`);
    },
  });

  const handleAssignAPS = () => {
    if (selectedItems.size === 0) {
      alert('Selecciona al menos un elemento para asignar APS');
      return;
    }
    // Obtener los IDs de inventario de los items seleccionados
    const inventarioIds = inventarioReservado
      .filter(item => selectedItems.has(item.rsv_ids))
      .map(item => item.id);

    if (inventarioIds.length > 0) {
      assignAPSMutation.mutate(inventarioIds);
    }
  };

  const handleCommentSubmit = () => {
    if (comment.trim()) {
      addCommentMutation.mutate(comment.trim());
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Header title="Detalle de Campana" />
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !campana) {
    return (
      <div className="min-h-screen">
        <Header title="Detalle de Campana" />
        <div className="p-6">
          <div className="text-center text-red-500">
            Error al cargar la campana
          </div>
        </div>
      </div>
    );
  }

  const comentarios = campana.comentarios || [];

  return (
    <div className="min-h-screen">
      <Header title="Detalle de Campana" />

      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/campanas')}
            className="flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver</span>
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowComments(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-900/30 hover:bg-purple-900/50 transition-colors"
              title="Comentarios"
            >
              <MessageSquare className="h-4 w-4 text-purple-400" />
              <span className="text-xs text-purple-300">{comentarios.length}</span>
            </button>
            <Badge variant={statusVariants[campana.status] || 'secondary'} className="text-sm">
              {campana.status}
            </Badge>
          </div>
        </div>

        {/* Titulo */}
        <div className="flex items-baseline gap-3">
          <h2 className="text-2xl font-semibold">{campana.nombre}</h2>
          <span className="text-muted-foreground">#{campana.id}</span>
        </div>

        {/* Grid de 3 columnas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Columna 1: Info Campana */}
          <div className="bg-card rounded-xl border border-border p-4">
            <h3 className="text-sm font-semibold mb-3 text-purple-300 uppercase tracking-wide">Campana</h3>
            <div className="space-y-0">
              <InfoItem label="Articulo" value={campana.articulo} />
              <InfoItem label="Inicio" value={campana.fecha_inicio} isDate />
              <InfoItem label="Fin" value={campana.fecha_fin} isDate />
              <InfoItem label="Total Caras" value={campana.total_caras} />
              <InfoItem label="Frontal" value={campana.frontal} />
              <InfoItem label="Cruzada" value={campana.cruzada} />
              <InfoItem label="NSE" value={campana.nivel_socioeconomico} />
              <InfoItem label="Bonificacion" value={campana.bonificacion ? `${campana.bonificacion}%` : null} />
              <InfoItem label="Descuento" value={campana.descuento ? `${campana.descuento}%` : null} />
              <InfoItem label="Inversion" value={campana.inversion} />
              <InfoItem label="Precio" value={campana.precio} />
            </div>
          </div>

          {/* Columna 2: Cliente */}
          <div className="bg-card rounded-xl border border-border p-4">
            <h3 className="text-sm font-semibold mb-3 text-purple-300 uppercase tracking-wide">Cliente</h3>
            <div className="space-y-0">
              <InfoItem label="Cliente" value={campana.T0_U_Cliente} />
              <InfoItem label="Razon Social" value={campana.T0_U_RazonSocial} />
              <InfoItem label="CUIC" value={campana.cuic} />
              <InfoItem label="Agencia" value={campana.T0_U_Agencia} />
              <InfoItem label="Asesor" value={campana.T0_U_Asesor} />
              <InfoItem label="Unidad Negocio" value={campana.T1_U_UnidadNegocio} />
              <InfoItem label="Marca" value={campana.T2_U_Marca} />
              <InfoItem label="Producto" value={campana.T2_U_Producto} />
              <InfoItem label="Categoria" value={campana.T2_U_Categoria} />
            </div>
          </div>

          {/* Columna 3: Asignacion y Notas */}
          <div className="bg-card rounded-xl border border-border p-4">
            <h3 className="text-sm font-semibold mb-3 text-purple-300 uppercase tracking-wide">Asignacion</h3>
            <div className="space-y-0">
              <InfoItem label="Asignado" value={campana.asignado} />
              <InfoItem label="Contacto" value={campana.contacto} />
              <InfoItem label="Solicitud" value={campana.solicitud_id ? `#${campana.solicitud_id}` : null} />
              <InfoItem label="Actualizado" value={campana.updated_at} isDate />
            </div>

            {(campana.observaciones || campana.descripcion || campana.notas) && (
              <>
                <h3 className="text-sm font-semibold mb-2 mt-4 text-purple-300 uppercase tracking-wide">Notas</h3>
                {campana.descripcion && (
                  <p className="text-sm text-muted-foreground mb-2">{campana.descripcion}</p>
                )}
                {campana.observaciones && (
                  <p className="text-sm text-muted-foreground mb-2">{campana.observaciones}</p>
                )}
                {campana.notas && (
                  <p className="text-sm text-muted-foreground">{campana.notas}</p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Lista de inventario reservado */}
        <div className="bg-card rounded-xl border border-border">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="text-sm font-semibold text-purple-300 uppercase tracking-wide">
              Lista de inventario reservado
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleAssignAPS}
                disabled={selectedItems.size === 0 || assignAPSMutation.isPending}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  selectedItems.size === 0
                    ? 'bg-purple-900/30 text-purple-400/50 cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                }`}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                {assignAPSMutation.isPending ? 'Asignando...' : `APS${selectedItems.size > 0 ? ` (${selectedItems.size})` : ''}`}
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-purple-900/50 hover:bg-purple-900/70 border border-purple-500/30 rounded-lg transition-colors">
                <ListTodo className="h-3.5 w-3.5" />
                Gestor de Tareas
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
            {/* Columna izquierda: Mapa */}
            <div className="h-[400px] rounded-lg overflow-hidden border border-border relative map-dark-controls">
              {!isLoaded ? (
                <div className="w-full h-full flex items-center justify-center bg-purple-900/20">
                  <span className="text-muted-foreground text-sm">Cargando mapa...</span>
                </div>
              ) : (
                <GoogleMap
                  mapContainerClassName="w-full h-full"
                  center={mapCenter}
                  zoom={12}
                  onLoad={onMapLoad}
                  options={{
                    styles: [
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
                    ],
                    disableDefaultUI: true,
                    zoomControl: true,
                  }}
                >
                  {inventarioReservado.map((item) => {
                    const isSelected = selectedItems.has(item.rsv_ids);
                    return item.latitud && item.longitud && (
                      <Marker
                        key={item.rsv_ids}
                        position={{ lat: item.latitud, lng: item.longitud }}
                        title={item.codigo_unico}
                        onClick={() => {
                          toggleItemSelection(item.rsv_ids);
                          // Scroll a la fila en la tabla
                          const row = document.getElementById(`row-${item.rsv_ids}`);
                          if (row) {
                            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }
                        }}
                        icon={{
                          path: google.maps.SymbolPath.CIRCLE,
                          scale: isSelected ? 12 : 8,
                          fillColor: isSelected ? '#facc15' : '#ec4899',
                          fillOpacity: 1,
                          strokeColor: isSelected ? '#fef08a' : '#ffffff',
                          strokeWeight: isSelected ? 3 : 2,
                        }}
                        zIndex={isSelected ? 1000 : 1}
                      />
                    );
                  })}
                </GoogleMap>
              )}
            </div>
            {/* Columna derecha: Tabla */}
            <div className="h-[400px] flex flex-col">
              {/* Header con botón de agrupación */}
              <div className="flex items-center justify-between pb-2 flex-shrink-0">
                <div className="flex items-center gap-2">
                  {selectedItems.size > 0 && (
                    <span className="text-xs text-purple-300">
                      {selectedItems.size} seleccionados
                    </span>
                  )}
                </div>
                <div className="relative">
                  <button
                    onClick={() => setShowGroupingConfig(!showGroupingConfig)}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium bg-purple-900/50 hover:bg-purple-900/70 border border-purple-500/30 rounded-lg transition-colors"
                  >
                    <Layers className="h-3.5 w-3.5" />
                    Agrupar
                    {activeGroupings.length > 0 && (
                      <span className="px-1 py-0.5 rounded bg-purple-600 text-[10px]">
                        {activeGroupings.length}
                      </span>
                    )}
                  </button>
                  {/* Dropdown de configuración */}
                  {showGroupingConfig && (
                    <div className="absolute right-0 top-full mt-1 z-10 bg-[#1a1025] border border-purple-900/50 rounded-lg shadow-xl p-2 min-w-[180px]">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide px-2 py-1">
                        Agrupar por (max 2)
                      </p>
                      {AVAILABLE_GROUPINGS.map(({ field, label }) => (
                        <button
                          key={field}
                          onClick={() => toggleGrouping(field)}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-purple-900/30 transition-colors ${
                            activeGroupings.includes(field) ? 'text-purple-300' : 'text-zinc-400'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                            activeGroupings.includes(field)
                              ? 'bg-purple-600 border-purple-600'
                              : 'border-purple-500/50'
                          }`}>
                            {activeGroupings.includes(field) && (
                              <Check className="h-3 w-3 text-white" />
                            )}
                          </div>
                          {label}
                          {activeGroupings.indexOf(field) === 0 && (
                            <span className="ml-auto text-[10px] text-purple-400">1°</span>
                          )}
                          {activeGroupings.indexOf(field) === 1 && (
                            <span className="ml-auto text-[10px] text-pink-400">2°</span>
                          )}
                        </button>
                      ))}
                      <div className="border-t border-purple-900/30 mt-2 pt-2">
                        <button
                          onClick={() => setActiveGroupings([])}
                          className="w-full text-xs text-zinc-500 hover:text-zinc-300 py-1"
                        >
                          Quitar agrupación
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Tabla con scroll */}
              <div className="flex-1 overflow-auto scrollbar-purple">
                {inventarioReservado.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">
                    No hay inventario reservado
                  </p>
                ) : activeGroupings.length === 0 ? (
                  // Sin agrupación
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-card z-10">
                      <tr className="border-b border-border text-left">
                        <th className="p-2 w-8">
                          <button
                            onClick={toggleSelectAll}
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                              selectedItems.size === inventarioReservado.length
                                ? 'bg-purple-600 border-purple-600'
                                : 'border-purple-500/50 hover:border-purple-400'
                            }`}
                          >
                            {selectedItems.size === inventarioReservado.length && (
                              <Check className="h-3 w-3 text-white" />
                            )}
                          </button>
                        </th>
                        <th className="p-2 font-medium text-purple-300">Código</th>
                        <th className="p-2 font-medium text-purple-300">Tipo</th>
                        <th className="p-2 font-medium text-purple-300">Plaza</th>
                        <th className="p-2 font-medium text-purple-300">Ubicación</th>
                        <th className="p-2 font-medium text-purple-300">Caras</th>
                        <th className="p-2 font-medium text-purple-300">Estatus</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventarioReservado.map((item) => (
                        <tr
                          key={item.rsv_ids}
                          id={`row-${item.rsv_ids}`}
                          className={`border-b border-border/50 hover:bg-purple-900/20 transition-colors ${
                            selectedItems.has(item.rsv_ids) ? 'bg-yellow-500/20' : ''
                          }`}
                        >
                          <td className="p-2">
                            <button
                              onClick={() => toggleItemSelection(item.rsv_ids)}
                              className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                selectedItems.has(item.rsv_ids)
                                  ? 'bg-purple-600 border-purple-600'
                                  : 'border-purple-500/50 hover:border-purple-400'
                              }`}
                            >
                              {selectedItems.has(item.rsv_ids) && (
                                <Check className="h-3 w-3 text-white" />
                              )}
                            </button>
                          </td>
                          <td className="p-2 text-white font-medium">{item.codigo_unico}</td>
                          <td className="p-2 text-zinc-300">{item.tipo_de_cara || '-'}</td>
                          <td className="p-2 text-zinc-300">{item.plaza || '-'}</td>
                          <td className="p-2 text-zinc-400 max-w-[150px] truncate" title={item.ubicacion || ''}>
                            {item.ubicacion || '-'}
                          </td>
                          <td className="p-2 text-center">
                            <span className="px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-400">
                              {item.caras_totales}
                            </span>
                          </td>
                          <td className="p-2">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                              item.estatus_reserva === 'confirmado'
                                ? 'bg-green-500/20 text-green-400'
                                : item.estatus_reserva === 'pendiente'
                                ? 'bg-yellow-500/20 text-yellow-400'
                                : 'bg-zinc-500/20 text-zinc-400'
                            }`}>
                              {item.estatus_reserva || 'N/A'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  // Con agrupación
                  <div className="space-y-2">
                    {Object.entries(groupedInventario).map(([groupKey, groupData]) => {
                      const isExpanded = expandedGroups.has(groupKey);
                      const isNested = activeGroupings.length > 1 && typeof groupData === 'object' && !Array.isArray(groupData);
                      const items = isNested ? null : (groupData as InventarioReservado[]);
                      const nestedGroups = isNested ? (groupData as Record<string, InventarioReservado[]>) : null;
                      const totalItems = isNested
                        ? Object.values(nestedGroups!).reduce((sum, arr) => sum + arr.length, 0)
                        : items!.length;

                      return (
                        <div key={groupKey} className="border border-purple-900/30 rounded-lg overflow-hidden">
                          {/* Cabecera del grupo */}
                          <button
                            onClick={() => toggleGroup(groupKey)}
                            className="w-full flex items-center gap-2 px-3 py-2 bg-purple-900/20 hover:bg-purple-900/30 transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-purple-400" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-purple-400" />
                            )}
                            <span className="text-xs font-medium text-purple-300">
                              {AVAILABLE_GROUPINGS.find(g => g.field === activeGroupings[0])?.label}:
                            </span>
                            <span className="text-xs text-white">{groupKey}</span>
                            <span className="ml-auto text-[10px] text-muted-foreground">
                              {totalItems} items
                            </span>
                          </button>

                          {/* Contenido expandido */}
                          {isExpanded && (
                            <div className="px-2 py-1">
                              {isNested && nestedGroups ? (
                                // Segundo nivel de agrupación
                                <div className="space-y-1">
                                  {Object.entries(nestedGroups).map(([subGroupKey, subItems]) => {
                                    const subGroupFullKey = `${groupKey}-${subGroupKey}`;
                                    const isSubExpanded = expandedGroups.has(subGroupFullKey);

                                    return (
                                      <div key={subGroupKey} className="border border-purple-900/20 rounded-lg overflow-hidden ml-2">
                                        <button
                                          onClick={() => toggleGroup(subGroupFullKey)}
                                          className="w-full flex items-center gap-2 px-2 py-1.5 bg-purple-900/10 hover:bg-purple-900/20 transition-colors"
                                        >
                                          {isSubExpanded ? (
                                            <ChevronDown className="h-3 w-3 text-pink-400" />
                                          ) : (
                                            <ChevronRight className="h-3 w-3 text-pink-400" />
                                          )}
                                          <span className="text-[10px] font-medium text-pink-300">
                                            {AVAILABLE_GROUPINGS.find(g => g.field === activeGroupings[1])?.label}:
                                          </span>
                                          <span className="text-[10px] text-white">{subGroupKey}</span>
                                          <span className="ml-auto text-[10px] text-muted-foreground">
                                            {subItems.length}
                                          </span>
                                        </button>
                                        {isSubExpanded && (
                                          <table className="w-full text-xs">
                                            <tbody>
                                              {subItems.map((item) => (
                                                <tr
                                                  key={item.rsv_ids}
                                                  id={`row-${item.rsv_ids}`}
                                                  className={`border-t border-border/30 hover:bg-purple-900/10 transition-colors ${
                                                    selectedItems.has(item.rsv_ids) ? 'bg-yellow-500/20' : ''
                                                  }`}
                                                >
                                                  <td className="p-1.5 w-8">
                                                    <button
                                                      onClick={() => toggleItemSelection(item.rsv_ids)}
                                                      className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
                                                        selectedItems.has(item.rsv_ids)
                                                          ? 'bg-purple-600 border-purple-600'
                                                          : 'border-purple-500/50 hover:border-purple-400'
                                                      }`}
                                                    >
                                                      {selectedItems.has(item.rsv_ids) && (
                                                        <Check className="h-2.5 w-2.5 text-white" />
                                                      )}
                                                    </button>
                                                  </td>
                                                  <td className="p-1.5 text-white font-medium">{item.codigo_unico}</td>
                                                  <td className="p-1.5 text-zinc-400">{item.tipo_de_cara || '-'}</td>
                                                  <td className="p-1.5 text-zinc-400">{item.plaza || '-'}</td>
                                                  <td className="p-1.5">
                                                    <span className={`px-1 py-0.5 rounded text-[10px] ${
                                                      item.estatus_reserva === 'confirmado'
                                                        ? 'bg-green-500/20 text-green-400'
                                                        : 'bg-zinc-500/20 text-zinc-400'
                                                    }`}>
                                                      {item.estatus_reserva || 'N/A'}
                                                    </span>
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : items ? (
                                // Un solo nivel de agrupación
                                <table className="w-full text-xs">
                                  <tbody>
                                    {items.map((item) => (
                                      <tr
                                        key={item.rsv_ids}
                                        id={`row-${item.rsv_ids}`}
                                        className={`border-t border-border/30 hover:bg-purple-900/10 transition-colors ${
                                          selectedItems.has(item.rsv_ids) ? 'bg-yellow-500/20' : ''
                                        }`}
                                      >
                                        <td className="p-1.5 w-8">
                                          <button
                                            onClick={() => toggleItemSelection(item.rsv_ids)}
                                            className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
                                              selectedItems.has(item.rsv_ids)
                                                ? 'bg-purple-600 border-purple-600'
                                                : 'border-purple-500/50 hover:border-purple-400'
                                            }`}
                                          >
                                            {selectedItems.has(item.rsv_ids) && (
                                              <Check className="h-2.5 w-2.5 text-white" />
                                            )}
                                          </button>
                                        </td>
                                        <td className="p-1.5 text-white font-medium">{item.codigo_unico}</td>
                                        <td className="p-1.5 text-zinc-400">{item.tipo_de_cara || '-'}</td>
                                        <td className="p-1.5 text-zinc-400">{item.plaza || '-'}</td>
                                        <td className="p-1.5 text-zinc-400 max-w-[100px] truncate">
                                          {item.ubicacion || '-'}
                                        </td>
                                        <td className="p-1.5">
                                          <span className={`px-1 py-0.5 rounded text-[10px] ${
                                            item.estatus_reserva === 'confirmado'
                                              ? 'bg-green-500/20 text-green-400'
                                              : 'bg-zinc-500/20 text-zinc-400'
                                          }`}>
                                            {item.estatus_reserva || 'N/A'}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              ) : null}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Lista de inventario por APS */}
        <div className="bg-card rounded-xl border border-border">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="text-sm font-semibold text-purple-300 uppercase tracking-wide">
              Lista de Inventario por APS
            </h3>
            <span className="text-xs text-muted-foreground">
              {inventarioConAPS.length} registros
            </span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
            {/* Columna izquierda: Mapa */}
            <div className="h-[400px] rounded-lg overflow-hidden border border-border relative map-dark-controls">
              {!isLoaded ? (
                <div className="w-full h-full flex items-center justify-center bg-purple-900/20">
                  <span className="text-muted-foreground text-sm">Cargando mapa...</span>
                </div>
              ) : (
                <GoogleMap
                  mapContainerClassName="w-full h-full"
                  center={
                    inventarioConAPS.length > 0
                      ? {
                          lat: inventarioConAPS.filter(i => i.latitud && i.longitud)[0]?.latitud || 19.4326,
                          lng: inventarioConAPS.filter(i => i.latitud && i.longitud)[0]?.longitud || -99.1332
                        }
                      : { lat: 19.4326, lng: -99.1332 }
                  }
                  zoom={12}
                  onLoad={(map) => {
                    const validItems = inventarioConAPS.filter(i => i.latitud && i.longitud);
                    if (validItems.length > 1) {
                      const bounds = new google.maps.LatLngBounds();
                      validItems.forEach(item => {
                        bounds.extend({ lat: item.latitud, lng: item.longitud });
                      });
                      map.fitBounds(bounds, 50);
                    }
                  }}
                  options={{
                    styles: [
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
                    ],
                    disableDefaultUI: true,
                    zoomControl: true,
                  }}
                >
                  {inventarioConAPS.map((item) => {
                    const isSelected = selectedItemsAPS.has(String(item.rsv_ids));
                    return item.latitud && item.longitud && (
                      <Marker
                        key={`aps-${item.rsv_ids}`}
                        position={{ lat: item.latitud, lng: item.longitud }}
                        title={`${item.codigo_unico} - APS: ${item.aps}`}
                        onClick={() => {
                          toggleItemSelectionAPS(String(item.rsv_ids));
                          // Scroll a la fila en la tabla
                          const row = document.getElementById(`row-aps-${item.rsv_ids}`);
                          if (row) {
                            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }
                        }}
                        icon={{
                          path: google.maps.SymbolPath.CIRCLE,
                          scale: isSelected ? 12 : 8,
                          fillColor: isSelected ? '#facc15' : '#22d3ee',
                          fillOpacity: 1,
                          strokeColor: isSelected ? '#fef08a' : '#ffffff',
                          strokeWeight: isSelected ? 3 : 2,
                        }}
                        zIndex={isSelected ? 1000 : 1}
                      />
                    );
                  })}
                </GoogleMap>
              )}
            </div>
            {/* Columna derecha: Tabla */}
            <div className="h-[400px] flex flex-col">
              {/* Header con botón de agrupación */}
              <div className="flex items-center justify-between pb-2 flex-shrink-0">
                <div className="flex items-center gap-2">
                  {selectedItemsAPS.size > 0 && (
                    <span className="text-xs text-cyan-300">
                      {selectedItemsAPS.size} seleccionados
                    </span>
                  )}
                </div>
                <div className="relative">
                  <button
                    onClick={() => setShowGroupingConfigAPS(!showGroupingConfigAPS)}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium bg-purple-900/50 hover:bg-purple-900/70 border border-purple-500/30 rounded-lg transition-colors"
                  >
                    <Layers className="h-3.5 w-3.5" />
                    Agrupar
                    {activeGroupingsAPS.length > 0 && (
                      <span className="px-1 py-0.5 rounded bg-purple-600 text-[10px]">
                        {activeGroupingsAPS.length}
                      </span>
                    )}
                  </button>
                  {/* Dropdown de configuración */}
                  {showGroupingConfigAPS && (
                    <div className="absolute right-0 top-full mt-1 z-10 bg-[#1a1025] border border-purple-900/50 rounded-lg shadow-xl p-2 min-w-[180px]">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide px-2 py-1">
                        Agrupar por (max 2)
                      </p>
                      {AVAILABLE_GROUPINGS.map(({ field, label }) => (
                        <button
                          key={field}
                          onClick={() => toggleGroupingAPS(field)}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-purple-900/30 transition-colors ${
                            activeGroupingsAPS.includes(field) ? 'text-purple-300' : 'text-zinc-400'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                            activeGroupingsAPS.includes(field)
                              ? 'bg-purple-600 border-purple-600'
                              : 'border-purple-500/50'
                          }`}>
                            {activeGroupingsAPS.includes(field) && (
                              <Check className="h-3 w-3 text-white" />
                            )}
                          </div>
                          {label}
                          {activeGroupingsAPS.indexOf(field) === 0 && (
                            <span className="ml-auto text-[10px] text-purple-400">1°</span>
                          )}
                          {activeGroupingsAPS.indexOf(field) === 1 && (
                            <span className="ml-auto text-[10px] text-pink-400">2°</span>
                          )}
                        </button>
                      ))}
                      <div className="border-t border-purple-900/30 mt-2 pt-2">
                        <button
                          onClick={() => setActiveGroupingsAPS([])}
                          className="w-full text-xs text-zinc-500 hover:text-zinc-300 py-1"
                        >
                          Quitar agrupación
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Tabla de inventario con APS */}
              <div className="flex-1 overflow-auto scrollbar-purple">
              {inventarioConAPS.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">
                  No hay inventario con APS asignado
                </p>
              ) : activeGroupingsAPS.length === 0 ? (
                // Sin agrupación
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-card z-10">
                    <tr className="border-b border-border text-left">
                      <th className="p-2 w-8">
                        <button
                          onClick={toggleSelectAllAPS}
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                            selectedItemsAPS.size === inventarioConAPS.length && inventarioConAPS.length > 0
                              ? 'bg-cyan-600 border-cyan-600'
                              : 'border-cyan-500/50 hover:border-cyan-400'
                          }`}
                        >
                          {selectedItemsAPS.size === inventarioConAPS.length && inventarioConAPS.length > 0 && (
                            <Check className="h-3 w-3 text-white" />
                          )}
                        </button>
                      </th>
                      <th className="p-2 font-medium text-purple-300">Código</th>
                      <th className="p-2 font-medium text-purple-300">Tipo</th>
                      <th className="p-2 font-medium text-purple-300">Plaza</th>
                      <th className="p-2 font-medium text-purple-300">Ubicación</th>
                      <th className="p-2 font-medium text-purple-300">Caras</th>
                      <th className="p-2 font-medium text-purple-300">APS</th>
                      <th className="p-2 font-medium text-purple-300">Estatus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventarioConAPS.map((item) => (
                      <tr
                        key={item.rsv_ids}
                        id={`row-aps-${item.rsv_ids}`}
                        className={`border-b border-border/50 hover:bg-purple-900/20 transition-colors ${
                          selectedItemsAPS.has(String(item.rsv_ids)) ? 'bg-yellow-500/20' : ''
                        }`}
                      >
                        <td className="p-2">
                          <button
                            onClick={() => toggleItemSelectionAPS(String(item.rsv_ids))}
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                              selectedItemsAPS.has(String(item.rsv_ids))
                                ? 'bg-cyan-600 border-cyan-600'
                                : 'border-cyan-500/50 hover:border-cyan-400'
                            }`}
                          >
                            {selectedItemsAPS.has(String(item.rsv_ids)) && (
                              <Check className="h-3 w-3 text-white" />
                            )}
                          </button>
                        </td>
                        <td className="p-2 text-white font-medium">{item.codigo_unico}</td>
                        <td className="p-2 text-zinc-300">{item.tipo_de_cara || '-'}</td>
                        <td className="p-2 text-zinc-300">{item.plaza || '-'}</td>
                        <td className="p-2 text-zinc-400 max-w-[150px] truncate" title={item.ubicacion || ''}>
                          {item.ubicacion || '-'}
                        </td>
                        <td className="p-2 text-center">
                          <span className="px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-400">
                            {item.caras_totales}
                          </span>
                        </td>
                        <td className="p-2 text-center">
                          <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-medium">
                            {item.aps}
                          </span>
                        </td>
                        <td className="p-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                            item.estatus_reserva === 'confirmado'
                              ? 'bg-green-500/20 text-green-400'
                              : item.estatus_reserva === 'pendiente'
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : 'bg-zinc-500/20 text-zinc-400'
                          }`}>
                            {item.estatus_reserva || 'N/A'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                // Con agrupación
                <div className="space-y-2">
                  {Object.entries(groupedInventarioAPS).map(([groupKey, groupData]) => {
                    const isExpanded = expandedGroupsAPS.has(groupKey);
                    const isNested = activeGroupingsAPS.length > 1 && typeof groupData === 'object' && !Array.isArray(groupData);
                    const items = isNested ? null : (groupData as InventarioConAPS[]);
                    const nestedGroups = isNested ? (groupData as Record<string, InventarioConAPS[]>) : null;
                    const totalItems = isNested
                      ? Object.values(nestedGroups!).reduce((sum, arr) => sum + arr.length, 0)
                      : items!.length;

                    return (
                      <div key={groupKey} className="border border-purple-900/30 rounded-lg overflow-hidden">
                        {/* Cabecera del grupo */}
                        <button
                          onClick={() => toggleGroupAPS(groupKey)}
                          className="w-full flex items-center gap-2 px-3 py-2 bg-purple-900/20 hover:bg-purple-900/30 transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-purple-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-purple-400" />
                          )}
                          <span className="text-xs font-medium text-purple-300">
                            {AVAILABLE_GROUPINGS.find(g => g.field === activeGroupingsAPS[0])?.label}:
                          </span>
                          <span className="text-xs text-white">{groupKey}</span>
                          <span className="ml-auto text-[10px] text-muted-foreground">
                            {totalItems} items
                          </span>
                        </button>

                        {/* Contenido expandido */}
                        {isExpanded && (
                          <div className="px-2 py-1">
                            {isNested && nestedGroups ? (
                              // Segundo nivel de agrupación
                              <div className="space-y-1">
                                {Object.entries(nestedGroups).map(([subGroupKey, subItems]) => {
                                  const subGroupFullKey = `${groupKey}-${subGroupKey}`;
                                  const isSubExpanded = expandedGroupsAPS.has(subGroupFullKey);

                                  return (
                                    <div key={subGroupKey} className="border border-purple-900/20 rounded-lg overflow-hidden ml-2">
                                      <button
                                        onClick={() => toggleGroupAPS(subGroupFullKey)}
                                        className="w-full flex items-center gap-2 px-2 py-1.5 bg-purple-900/10 hover:bg-purple-900/20 transition-colors"
                                      >
                                        {isSubExpanded ? (
                                          <ChevronDown className="h-3 w-3 text-pink-400" />
                                        ) : (
                                          <ChevronRight className="h-3 w-3 text-pink-400" />
                                        )}
                                        <span className="text-[10px] font-medium text-pink-300">
                                          {AVAILABLE_GROUPINGS.find(g => g.field === activeGroupingsAPS[1])?.label}:
                                        </span>
                                        <span className="text-[10px] text-white">{subGroupKey}</span>
                                        <span className="ml-auto text-[10px] text-muted-foreground">
                                          {subItems.length}
                                        </span>
                                      </button>
                                      {isSubExpanded && (
                                        <table className="w-full text-xs">
                                          <tbody>
                                            {subItems.map((item) => (
                                              <tr
                                                key={item.rsv_ids}
                                                id={`row-aps-${item.rsv_ids}`}
                                                className={`border-t border-border/30 hover:bg-purple-900/10 transition-colors ${
                                                  selectedItemsAPS.has(String(item.rsv_ids)) ? 'bg-yellow-500/20' : ''
                                                }`}
                                              >
                                                <td className="p-1.5 w-8">
                                                  <button
                                                    onClick={() => toggleItemSelectionAPS(String(item.rsv_ids))}
                                                    className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
                                                      selectedItemsAPS.has(String(item.rsv_ids))
                                                        ? 'bg-cyan-600 border-cyan-600'
                                                        : 'border-cyan-500/50 hover:border-cyan-400'
                                                    }`}
                                                  >
                                                    {selectedItemsAPS.has(String(item.rsv_ids)) && (
                                                      <Check className="h-2.5 w-2.5 text-white" />
                                                    )}
                                                  </button>
                                                </td>
                                                <td className="p-1.5 text-white font-medium">{item.codigo_unico}</td>
                                                <td className="p-1.5 text-zinc-400">{item.tipo_de_cara || '-'}</td>
                                                <td className="p-1.5 text-zinc-400">{item.plaza || '-'}</td>
                                                <td className="p-1.5 text-center">
                                                  <span className="px-1 py-0.5 rounded bg-cyan-500/20 text-cyan-400 text-[10px]">
                                                    APS: {item.aps}
                                                  </span>
                                                </td>
                                                <td className="p-1.5">
                                                  <span className={`px-1 py-0.5 rounded text-[10px] ${
                                                    item.estatus_reserva === 'confirmado'
                                                      ? 'bg-green-500/20 text-green-400'
                                                      : 'bg-zinc-500/20 text-zinc-400'
                                                  }`}>
                                                    {item.estatus_reserva || 'N/A'}
                                                  </span>
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : items ? (
                              // Un solo nivel de agrupación
                              <table className="w-full text-xs">
                                <tbody>
                                  {items.map((item) => (
                                    <tr
                                      key={item.rsv_ids}
                                      id={`row-aps-${item.rsv_ids}`}
                                      className={`border-t border-border/30 hover:bg-purple-900/10 transition-colors ${
                                        selectedItemsAPS.has(String(item.rsv_ids)) ? 'bg-yellow-500/20' : ''
                                      }`}
                                    >
                                      <td className="p-1.5 w-8">
                                        <button
                                          onClick={() => toggleItemSelectionAPS(String(item.rsv_ids))}
                                          className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
                                            selectedItemsAPS.has(String(item.rsv_ids))
                                              ? 'bg-cyan-600 border-cyan-600'
                                              : 'border-cyan-500/50 hover:border-cyan-400'
                                          }`}
                                        >
                                          {selectedItemsAPS.has(String(item.rsv_ids)) && (
                                            <Check className="h-2.5 w-2.5 text-white" />
                                          )}
                                        </button>
                                      </td>
                                      <td className="p-1.5 text-white font-medium">{item.codigo_unico}</td>
                                      <td className="p-1.5 text-zinc-400">{item.tipo_de_cara || '-'}</td>
                                      <td className="p-1.5 text-zinc-400">{item.plaza || '-'}</td>
                                      <td className="p-1.5 text-zinc-400 max-w-[100px] truncate">
                                        {item.ubicacion || '-'}
                                      </td>
                                      <td className="p-1.5 text-center">
                                        <span className="px-1 py-0.5 rounded bg-cyan-500/20 text-cyan-400 text-[10px]">
                                          APS: {item.aps}
                                        </span>
                                      </td>
                                      <td className="p-1.5">
                                        <span className={`px-1 py-0.5 rounded text-[10px] ${
                                          item.estatus_reserva === 'confirmado'
                                            ? 'bg-green-500/20 text-green-400'
                                            : 'bg-zinc-500/20 text-zinc-400'
                                        }`}>
                                          {item.estatus_reserva || 'N/A'}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : null}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Comentarios */}
      {showComments && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowComments(false)}
          />
          <div className="relative bg-[#1a1025] border border-purple-900/30 rounded-xl w-full max-w-xl mx-4 h-[600px] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-purple-900/30">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-purple-400" />
                Comentarios
                {comentarios.length > 0 && (
                  <span className="text-sm text-muted-foreground">({comentarios.length})</span>
                )}
              </h3>
              <button
                onClick={() => setShowComments(false)}
                className="p-1 hover:bg-purple-900/30 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 divide-y divide-purple-900/20 flex flex-col scrollbar-purple">
              {comentarios.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No hay comentarios aun
                </p>
              ) : (
                [...comentarios].reverse().map((c) => (
                  <div key={c.id} className="flex gap-2 py-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-[9px] text-white font-medium flex-shrink-0">
                      {c.autor_nombre?.charAt(0) || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-white">{c.autor_nombre || 'Usuario'}</span>
                        <span className="text-[10px] text-muted-foreground">{formatDate(c.fecha)}</span>
                      </div>
                      <p className="text-xs text-zinc-300 mt-0.5">{c.contenido}</p>
                    </div>
                  </div>
                ))
              )}
              <div ref={commentsEndRef} />
            </div>
            <div className="p-3 border-t border-purple-900/30">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-[9px] text-white font-medium flex-shrink-0">
                  {user?.nombre?.charAt(0) || 'U'}
                </div>
                <div className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg bg-purple-900/20 border border-purple-900/30 focus-within:border-purple-500">
                  <input
                    type="text"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCommentSubmit()}
                    placeholder="Escribe un comentario..."
                    className="flex-1 bg-transparent text-xs focus:outline-none placeholder:text-muted-foreground"
                  />
                  <button
                    onClick={handleCommentSubmit}
                    disabled={!comment.trim() || addCommentMutation.isPending}
                    className="p-1 rounded bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
