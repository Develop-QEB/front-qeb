import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X, Search, Plus, Trash2, ChevronDown, ChevronRight, Check, Users, Building2,
  Package, Calendar, FileText, MapPin, RefreshCw, Save, Loader2, Edit3, Upload, File
} from 'lucide-react';
import { solicitudesService, UserOption } from '../../services/solicitudes.service';
import { formatCurrency } from '../../lib/utils';
import { getSapCache, setSapCache, SAP_CACHE_KEYS, clearSapCache } from '../../lib/sapCache';

// ====== TARIFA PUBLICA & COSTO MAPS ======
const TARIFA_PUBLICA_MAP: Record<string, number> = {
  'RT-BL-COB-MX': 2500, 'RT-BP1-SEC1-01-NAUC': 110000, 'RT-BP1-SEC1-02-NAUC': 110000,
  'RT-BP2-SEC1-01-NAUC': 50000, 'RT-BP2-SEC1-02-NAUC': 50000, 'RT-BP3-SEC1-01-NAUC': 60000,
  'RT-BP3-SEC1-02-NAUC': 60000, 'RT-BP4-SEC1-01-NAUC': 55000, 'RT-BP5-SEC1-01-NAUC': 36667,
  'RT-CL-COB-MX': 6127, 'RT-CL-PRA-MX': 9190, 'RT-DIG-01-MX': 9482, 'RT-DIG-02-MX': 9482,
  'RT-P1-COB-MX': 6127, 'RT-P1-COB-GD': 6127, 'RT-P1-DIG-MX': 9482, 'RT-P1-PRA-MX': 9190,
  'RT-KCS-GDL': 30000, 'RT-KCS-GDL-PER': 30000, 'RT-TUC-GDL': 84000, 'RT-TUV-GDL': 112000,
};

const getTarifaFromItemCode = (itemCode: string): { costo: number; tarifa_publica: number } => {
  if (!itemCode) return { costo: 0, tarifa_publica: 0 };
  const code = itemCode.toUpperCase().trim();
  if (TARIFA_PUBLICA_MAP[code] !== undefined) {
    return { costo: 650, tarifa_publica: TARIFA_PUBLICA_MAP[code] };
  }
  return { costo: 650, tarifa_publica: 850 };
};

// City-State mapping
const CIUDAD_ESTADO_MAP: Record<string, string> = {
  'GUADALAJARA': 'Jalisco', 'ZAPOPAN': 'Jalisco', 'MONTERREY': 'Nuevo León',
  'CIUDAD DE MEXICO': 'Ciudad de México', 'CDMX': 'Ciudad de México',
  'TIJUANA': 'Baja California', 'LEON': 'Guanajuato', 'QUERETARO': 'Querétaro',
  'PUEBLA': 'Puebla', 'MERIDA': 'Yucatán', 'CANCUN': 'Quintana Roo',
};

const getCiudadEstadoFromArticulo = (itemName: string): { estado: string; ciudad: string } | null => {
  if (!itemName) return null;
  const name = itemName.toUpperCase();
  for (const [ciudad, estado] of Object.entries(CIUDAD_ESTADO_MAP)) {
    if (name.includes(ciudad)) {
      return { estado, ciudad: ciudad.charAt(0) + ciudad.slice(1).toLowerCase() };
    }
  }
  return null;
};

const getFormatoFromArticulo = (itemName: string): string => {
  if (!itemName) return '';
  const name = itemName.toUpperCase();
  if (name.includes('PARABUS')) return 'PARABUS';
  if (name.includes('CASETA')) return 'CASETA DE TAXIS';
  if (name.includes('MUPI')) return 'MUPI';
  if (name.includes('COLUMNA')) return 'COLUMNA';
  return '';
};

const getTipoFromName = (itemName: string): 'Tradicional' | 'Digital' | '' => {
  if (!itemName) return '';
  const name = itemName.toUpperCase();
  if (name.includes('DIGITAL') || name.includes('DIG')) return 'Digital';
  return 'Tradicional';
};

// ====== INTERFACES ======
interface SAPCuicItem {
  CUIC: number;
  T0_U_RazonSocial: string;
  T0_U_Cliente: string;
  T1_U_UnidadNegocio: string;
  T0_U_Agencia: string;
  // Usar los campos correctos de Asesor
  ASESOR_U_IDAsesor: string;
  ASESOR_U_Asesor: string;
  T1_U_IDMarca: number;
  T2_U_Marca: string;
  T2_U_IDProducto: number;
  T2_U_Producto: string;
  T2_U_IDCategoria: number;
  T2_U_Categoria: string;
}

interface SAPArticulo {
  ItemCode: string;
  ItemName: string;
}

interface ExistingCaraEntry {
  id: number;
  ciudad: string;
  estado: string;
  tipo: string;
  formato: string;
  caras: number;
  bonificacion: number;
  tarifa_publica: number;
  nivel_socioeconomico: string;
  inicio_periodo: string;
  fin_periodo: string;
  articulo?: string;
}

interface NewCaraEntry {
  tempId: string;
  articulo: SAPArticulo;
  estado: string;
  ciudades: string[];
  formato: string;
  tipo: string;
  nse: string[];
  catorcenaNum: number;
  catorcenaYear: number;
  periodoInicio: string;
  periodoFin: string;
  renta: number;
  bonificacion: number;
  tarifaPublica: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  solicitudId: number | null;
}

// ====== SEARCHABLE SELECT COMPONENT ======
function SearchableSelect({
  label, options, value, onChange, onClear, displayKey, valueKey, searchKeys, renderOption, renderSelected, loading,
}: {
  label: string; options: any[]; value: any; onChange: (item: any) => void; onClear: () => void;
  displayKey: string; valueKey: string; searchKeys: string[];
  renderOption?: (item: any) => React.ReactNode; renderSelected?: (item: any) => React.ReactNode; loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options.slice(0, 100);
    const term = searchTerm.toLowerCase();
    return options.filter(opt => searchKeys.some(key => String(opt[key] || '').toLowerCase().includes(term))).slice(0, 100);
  }, [options, searchTerm, searchKeys]);

  const handleClose = () => { setOpen(false); setSearchTerm(''); };

  return (
    <div className="relative flex-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm transition-all ${value
          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
          : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600'}`}
      >
        <span className="truncate text-left flex-1">
          {value && renderSelected ? renderSelected(value) : (value ? String(value[displayKey]) : label)}
        </span>
        {value ? (
          <X className="h-4 w-4 hover:text-white flex-shrink-0" onClick={(e) => { e.stopPropagation(); onClear(); }} />
        ) : (
          <ChevronDown className="h-4 w-4 flex-shrink-0" />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={handleClose} />
          <div className="absolute top-full left-0 right-0 mt-1 z-50 w-full min-w-[350px] rounded-xl border border-purple-500/20 bg-zinc-900 backdrop-blur-xl shadow-2xl overflow-hidden">
            <div className="p-2 border-b border-zinc-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder={`Buscar ${label.toLowerCase()}...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-72 overflow-auto">
              {loading ? (
                <div className="px-3 py-4 text-center text-zinc-500 text-sm">Cargando...</div>
              ) : filteredOptions.length === 0 ? (
                <div className="px-3 py-4 text-center text-zinc-500 text-sm">No se encontraron resultados</div>
              ) : (
                filteredOptions.map((option, idx) => (
                  <button
                    key={`${option[valueKey]}-${idx}`}
                    type="button"
                    onClick={() => { onChange(option); handleClose(); }}
                    className={`w-full px-3 py-2.5 text-left text-sm transition-colors border-b border-zinc-800/50 last:border-0 ${value && value[valueKey] === option[valueKey]
                      ? 'bg-purple-500/20 text-purple-300' : 'text-zinc-300 hover:bg-zinc-800'}`}
                  >
                    {renderOption ? renderOption(option) : <span>{option[displayKey]}</span>}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ====== MULTI SELECT TAGS ======
function MultiSelectTags({
  label, options, selected, onChange, displayKey, valueKey, searchKey,
}: {
  label: string; options: any[]; selected: any[]; onChange: (items: any[]) => void;
  displayKey: string; valueKey: string; searchKey: string;
}) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    return options.filter(opt => String(opt[searchKey] || '').toLowerCase().includes(searchTerm.toLowerCase()));
  }, [options, searchTerm, searchKey]);

  const toggle = (item: any) => {
    const exists = selected.find(s => s[valueKey] === item[valueKey]);
    if (exists) onChange(selected.filter(s => s[valueKey] !== item[valueKey]));
    else onChange([...selected, item]);
  };

  const remove = (item: any) => onChange(selected.filter(s => s[valueKey] !== item[valueKey]));

  return (
    <div className="space-y-2">
      <div className="relative">
        <button type="button" onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800/60 text-zinc-400 border border-zinc-700/50 rounded-lg text-xs hover:border-zinc-600 transition-all">
          <Plus className="h-3 w-3" />
          Agregar {label}
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setSearchTerm(''); }} />
            <div className="absolute top-full left-0 mt-1 z-50 w-72 rounded-xl border border-purple-500/20 bg-zinc-900 backdrop-blur-xl shadow-2xl overflow-hidden">
              <div className="p-2 border-b border-zinc-800">
                <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50" autoFocus />
              </div>
              <div className="max-h-52 overflow-auto">
                {filteredOptions.map((option) => {
                  const isSelected = selected.find(s => s[valueKey] === option[valueKey]);
                  return (
                    <button key={option[valueKey]} type="button" onClick={() => toggle(option)}
                      className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 transition-colors ${isSelected ? 'bg-purple-500/20 text-purple-300' : 'text-zinc-400 hover:bg-zinc-800'}`}>
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-purple-500 border-purple-500' : 'border-zinc-600'}`}>
                        {isSelected && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <span>{option[displayKey]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((item) => (
            <span key={item[valueKey]} className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded-full text-xs">
              {item[displayKey]}
              <button type="button" onClick={() => remove(item)} className="hover:text-white"><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ====== MAIN COMPONENT ======
export function EditSolicitudModal({ isOpen, onClose, solicitudId }: Props) {
  const queryClient = useQueryClient();

  // Form state
  const [selectedCuic, setSelectedCuic] = useState<SAPCuicItem | null>(null);
  const [selectedAsignados, setSelectedAsignados] = useState<UserOption[]>([]);
  const [nombreCampania, setNombreCampania] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [notas, setNotas] = useState('');

  // File state
  const [existingFile, setExistingFile] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Editable client fields (after CUIC selection)
  const [editableAsesor, setEditableAsesor] = useState('');
  const [editableRazonSocial, setEditableRazonSocial] = useState('');
  const [editableCategoria, setEditableCategoria] = useState('');

  // Dates with catorcenas
  const [yearInicio, setYearInicio] = useState<number | undefined>();
  const [yearFin, setYearFin] = useState<number | undefined>();
  const [catorcenaInicio, setCatorcenaInicio] = useState<number | undefined>();
  const [catorcenaFin, setCatorcenaFin] = useState<number | undefined>();

  // Existing caras (editable: caras, bonificacion only)
  const [existingCaras, setExistingCaras] = useState<ExistingCaraEntry[]>([]);
  // New caras (full creation like CreateSolicitudModal)
  const [newCaras, setNewCaras] = useState<NewCaraEntry[]>([]);

  // New cara form
  const [newCaraForm, setNewCaraForm] = useState({
    articulo: null as SAPArticulo | null,
    estado: '',
    ciudades: [] as string[],
    formato: '',
    tipo: '' as 'Tradicional' | 'Digital' | '',
    nse: [] as string[],
    periodo: '',
    renta: 1,
    bonificacion: 0,
    tarifaPublica: 0,
  });

  // SAP refresh
  const [forceRefreshSap, setForceRefreshSap] = useState(0);

  // ====== QUERIES ======
  const { data: solicitudData, isLoading } = useQuery({
    queryKey: ['solicitud-edit', solicitudId],
    queryFn: () => solicitudesService.getFullDetails(solicitudId!),
    enabled: isOpen && !!solicitudId,
  });

  const { data: users } = useQuery({
    queryKey: ['solicitudes-users'],
    queryFn: () => solicitudesService.getUsers(),
    enabled: isOpen,
  });

  const { data: catorcenasData } = useQuery({
    queryKey: ['catorcenas'],
    queryFn: () => solicitudesService.getCatorcenas(),
    enabled: isOpen,
  });

  const { data: inventarioFilters } = useQuery({
    queryKey: ['inventario-filters'],
    queryFn: () => solicitudesService.getInventarioFilters(),
    enabled: isOpen,
  });

  const { data: cuicData, isLoading: cuicLoading, isFetching: cuicFetching } = useQuery({
    queryKey: ['sap-cuic-all', forceRefreshSap],
    queryFn: async () => {
      if (forceRefreshSap === 0) {
        const cached = getSapCache<SAPCuicItem[]>(SAP_CACHE_KEYS.CUIC);
        if (cached && cached.length > 0) return cached;
      }
      try {
        const response = await fetch('https://binding-convinced-ride-foto.trycloudflare.com/cuic');
        if (!response.ok) throw new Error('Error fetching CUIC data');
        const data = await response.json();
        const items = (data.value || data) as SAPCuicItem[];
        if (items && items.length > 0) setSapCache(SAP_CACHE_KEYS.CUIC, items);
        return items;
      } catch (error) {
        const cached = getSapCache<SAPCuicItem[]>(SAP_CACHE_KEYS.CUIC);
        if (cached && cached.length > 0) return cached;
        throw error;
      }
    },
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
  });

  const { data: articulosData, isLoading: articulosLoading, isFetching: articulosFetching } = useQuery({
    queryKey: ['sap-articulos-all', forceRefreshSap],
    queryFn: async () => {
      if (forceRefreshSap === 0) {
        const cached = getSapCache<SAPArticulo[]>(SAP_CACHE_KEYS.ARTICULOS);
        if (cached && cached.length > 0) return cached;
      }
      try {
        const response = await fetch('https://binding-convinced-ride-foto.trycloudflare.com/articulos');
        if (!response.ok) throw new Error('Error fetching articulos data');
        const data = await response.json();
        const items = (data.value || data) as SAPArticulo[];
        if (items && items.length > 0) setSapCache(SAP_CACHE_KEYS.ARTICULOS, items);
        return items;
      } catch (error) {
        const cached = getSapCache<SAPArticulo[]>(SAP_CACHE_KEYS.ARTICULOS);
        if (cached && cached.length > 0) return cached;
        throw error;
      }
    },
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
  });

  const { data: formatosByCiudades } = useQuery({
    queryKey: ['formatos-by-ciudades', newCaraForm.ciudades],
    queryFn: () => solicitudesService.getFormatosByCiudades(newCaraForm.ciudades),
    enabled: isOpen && newCaraForm.ciudades.length > 0,
  });

  // ====== DERIVED STATE ======
  const yearInicioOptions = useMemo(() => {
    if (!catorcenasData?.years) return [];
    if (yearFin) return catorcenasData.years.filter(y => y <= yearFin);
    return catorcenasData.years;
  }, [catorcenasData, yearFin]);

  const yearFinOptions = useMemo(() => {
    if (!catorcenasData?.years) return [];
    if (yearInicio) return catorcenasData.years.filter(y => y >= yearInicio);
    return catorcenasData.years;
  }, [catorcenasData, yearInicio]);

  const catorcenasInicioOptions = useMemo(() => {
    if (!catorcenasData?.data || !yearInicio) return [];
    const cats = catorcenasData.data.filter(c => c.a_o === yearInicio);
    if (yearInicio === yearFin && catorcenaFin) return cats.filter(c => c.numero_catorcena <= catorcenaFin);
    return cats;
  }, [catorcenasData, yearInicio, yearFin, catorcenaFin]);

  const catorcenasFinOptions = useMemo(() => {
    if (!catorcenasData?.data || !yearFin) return [];
    const cats = catorcenasData.data.filter(c => c.a_o === yearFin);
    if (yearInicio === yearFin && catorcenaInicio) return cats.filter(c => c.numero_catorcena >= catorcenaInicio);
    return cats;
  }, [catorcenasData, yearFin, yearInicio, catorcenaInicio]);

  const availablePeriods = useMemo(() => {
    if (!catorcenasData?.data || !yearInicio || !yearFin || !catorcenaInicio || !catorcenaFin) return [];
    return catorcenasData.data.filter(c => {
      if (c.a_o < yearInicio || c.a_o > yearFin) return false;
      if (c.a_o === yearInicio && c.numero_catorcena < catorcenaInicio) return false;
      if (c.a_o === yearFin && c.numero_catorcena > catorcenaFin) return false;
      return true;
    });
  }, [catorcenasData, yearInicio, yearFin, catorcenaInicio, catorcenaFin]);

  const fechaInicio = useMemo(() => {
    if (!catorcenasData?.data || !yearInicio || !catorcenaInicio) return '';
    const cat = catorcenasData.data.find(c => c.a_o === yearInicio && c.numero_catorcena === catorcenaInicio);
    return cat ? cat.fecha_inicio : '';
  }, [catorcenasData, yearInicio, catorcenaInicio]);

  const fechaFin = useMemo(() => {
    if (!catorcenasData?.data || !yearFin || !catorcenaFin) return '';
    const cat = catorcenasData.data.find(c => c.a_o === yearFin && c.numero_catorcena === catorcenaFin);
    return cat ? cat.fecha_fin : '';
  }, [catorcenasData, yearFin, catorcenaFin]);

  const filteredFormatos = useMemo(() => {
    if (newCaraForm.ciudades.length > 0 && formatosByCiudades) return formatosByCiudades;
    return [];
  }, [formatosByCiudades, newCaraForm.ciudades]);

  // Filter cities by estado for new cara
  const filteredCiudadesForNewCara = useMemo(() => {
    if (!inventarioFilters?.ciudades || !newCaraForm.estado) return [];
    return inventarioFilters.ciudades
      .filter(c => c.estado === newCaraForm.estado)
      .map(c => c.ciudad)
      .filter((c): c is string => !!c);
  }, [inventarioFilters, newCaraForm.estado]);

  // Update editable fields when CUIC changes
  useEffect(() => {
    if (selectedCuic) {
      setEditableAsesor(selectedCuic.ASESOR_U_Asesor || '');
      setEditableRazonSocial(selectedCuic.T0_U_RazonSocial || '');
      setEditableCategoria(selectedCuic.T2_U_Categoria || '');
    }
  }, [selectedCuic]);

  // ====== LOAD DATA ======
  useEffect(() => {
    if (solicitudData && cuicData && catorcenasData?.data) {
      const sol = solicitudData.solicitud;

      // Load CUIC
      const solCuic = sol.cuic ? parseInt(sol.cuic, 10) : null;
      const cuicItem = cuicData.find(c => c.CUIC === solCuic);
      if (cuicItem) {
        setSelectedCuic(cuicItem);
        // Set editable fields from saved data or from CUIC
        setEditableAsesor(sol.asesor || cuicItem.ASESOR_U_Asesor || '');
        setEditableRazonSocial(sol.razon_social || cuicItem.T0_U_RazonSocial || '');
        setEditableCategoria(sol.categoria_nombre || cuicItem.T2_U_Categoria || '');
      }

      // Load campaign data
      setNombreCampania(solicitudData.cotizacion?.nombre_campania || '');
      setDescripcion(sol.descripcion || '');
      setNotas(sol.notas || '');

      // Load existing file
      if (sol.archivo) {
        setExistingFile(sol.archivo);
      }

      // Load asignados
      if (sol.id_asignado && sol.asignado) {
        const ids = sol.id_asignado.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        const nombres = sol.asignado.split(',').map(n => n.trim());
        setSelectedAsignados(ids.map((id, idx) => ({ id, nombre: nombres[idx] || '', area: '', puesto: '' })));
      }

      // Load dates from catorcenas
      if (solicitudData.cotizacion?.fecha_inicio && solicitudData.cotizacion?.fecha_fin) {
        const inicioDate = new Date(solicitudData.cotizacion.fecha_inicio);
        const finDate = new Date(solicitudData.cotizacion.fecha_fin);

        const inicioCat = catorcenasData.data.find(c => {
          const cInicio = new Date(c.fecha_inicio);
          const cFin = new Date(c.fecha_fin);
          return inicioDate >= cInicio && inicioDate <= cFin;
        });

        const finCat = catorcenasData.data.find(c => {
          const cInicio = new Date(c.fecha_inicio);
          const cFin = new Date(c.fecha_fin);
          return finDate >= cInicio && finDate <= cFin;
        });

        if (inicioCat) {
          setYearInicio(inicioCat.a_o);
          setCatorcenaInicio(inicioCat.numero_catorcena);
        }
        if (finCat) {
          setYearFin(finCat.a_o);
          setCatorcenaFin(finCat.numero_catorcena);
        }
      }

      // Load existing caras
      if (solicitudData.caras && solicitudData.caras.length > 0) {
        setExistingCaras(solicitudData.caras.map(c => ({
          id: c.id,
          ciudad: c.ciudad || '',
          estado: c.estados || '',
          tipo: c.tipo || '',
          formato: c.formato || '',
          caras: Number(c.caras) || 0,
          bonificacion: Number(c.bonificacion) || 0,
          tarifa_publica: Number(c.tarifa_publica) || 0,
          nivel_socioeconomico: c.nivel_socioeconomico || '',
          inicio_periodo: c.inicio_periodo || '',
          fin_periodo: c.fin_periodo || '',
          articulo: c.articulo,
        })));
      }
    }
  }, [solicitudData, cuicData, catorcenasData]);

  // ====== HANDLERS ======
  const handleRefreshSap = () => {
    clearSapCache();
    setForceRefreshSap(prev => prev + 1);
  };

  const updateExistingCara = (id: number, field: 'caras' | 'bonificacion' | 'tarifa_publica', value: number) => {
    setExistingCaras(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const removeExistingCara = (id: number) => {
    setExistingCaras(prev => prev.filter(c => c.id !== id));
  };

  const toggleNse = (nse: string) => {
    if (newCaraForm.nse.includes(nse)) {
      setNewCaraForm({ ...newCaraForm, nse: newCaraForm.nse.filter(n => n !== nse) });
    } else {
      setNewCaraForm({ ...newCaraForm, nse: [...newCaraForm.nse, nse] });
    }
  };

  const handleAddNewCara = () => {
    if (!newCaraForm.articulo || !newCaraForm.estado || !newCaraForm.formato || !newCaraForm.tipo || newCaraForm.nse.length === 0 || !newCaraForm.periodo) return;

    const [yearStr, catStr] = newCaraForm.periodo.split('-');
    const catorcenaYear = parseInt(yearStr);
    const catorcenaNum = parseInt(catStr);

    const period = availablePeriods.find(p => p.a_o === catorcenaYear && p.numero_catorcena === catorcenaNum);
    if (!period) return;

    const newCara: NewCaraEntry = {
      tempId: `new-${Date.now()}-${Math.random()}`,
      articulo: newCaraForm.articulo,
      estado: newCaraForm.estado,
      ciudades: newCaraForm.ciudades.length > 0 ? newCaraForm.ciudades : filteredCiudadesForNewCara,
      formato: newCaraForm.formato,
      tipo: newCaraForm.tipo,
      nse: newCaraForm.nse,
      catorcenaNum,
      catorcenaYear,
      periodoInicio: period.fecha_inicio,
      periodoFin: period.fecha_fin,
      renta: newCaraForm.renta,
      bonificacion: newCaraForm.bonificacion,
      tarifaPublica: newCaraForm.tarifaPublica,
    };

    setNewCaras([...newCaras, newCara]);
    setNewCaraForm({
      articulo: null, estado: '', ciudades: [], formato: '', tipo: '', nse: [], periodo: '', renta: 1, bonificacion: 0, tarifaPublica: 0,
    });
  };

  const removeNewCara = (tempId: string) => {
    setNewCaras(prev => prev.filter(c => c.tempId !== tempId));
  };

  // ====== TOTALS ======
  const existingTotals = useMemo(() => {
    const renta = existingCaras.reduce((sum, c) => sum + c.caras, 0);
    const bonif = existingCaras.reduce((sum, c) => sum + c.bonificacion, 0);
    const inversion = existingCaras.reduce((sum, c) => sum + (c.tarifa_publica * c.caras), 0);
    return { renta, bonif, inversion };
  }, [existingCaras]);

  const newTotals = useMemo(() => {
    const renta = newCaras.reduce((sum, c) => sum + c.renta, 0);
    const bonif = newCaras.reduce((sum, c) => sum + c.bonificacion, 0);
    const inversion = newCaras.reduce((sum, c) => sum + (c.tarifaPublica * c.renta), 0);
    return { renta, bonif, inversion };
  }, [newCaras]);

  const grandTotals = useMemo(() => {
    const renta = existingTotals.renta + newTotals.renta;
    const bonif = existingTotals.bonif + newTotals.bonif;
    const inversion = existingTotals.inversion + newTotals.inversion;
    const totalCaras = renta + bonif;
    const tarifaEfectiva = totalCaras > 0 ? inversion / totalCaras : 0;
    return { renta, bonif, inversion, totalCaras, tarifaEfectiva };
  }, [existingTotals, newTotals]);

  // ====== FILE UPLOAD MUTATION ======
  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => solicitudesService.uploadArchivo(solicitudId!, file),
    onSuccess: (data) => {
      if (data.url) {
        setExistingFile(data.url);
      }
    },
  });

  // ====== UPDATE MUTATION ======
  const updateMutation = useMutation({
    mutationFn: async (data: any) => solicitudesService.update(solicitudId!, data),
    onSuccess: async () => {
      // Upload file if selected
      if (selectedFile) {
        await uploadFileMutation.mutateAsync(selectedFile);
      }
      // Invalidate all related queries with refetchType 'all' to ensure updates
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['solicitudes'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['solicitudes-stats'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['solicitud-edit', solicitudId], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['solicitud-details', solicitudId], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['solicitud-full', solicitudId], refetchType: 'all' }),
      ]);
      onClose();
    },
  });

  const handleSave = () => {
    if (!selectedCuic) return;

    const allCaras = [
      ...existingCaras.map(c => ({
        ciudad: c.ciudad,
        estado: c.estado,
        tipo: c.tipo,
        flujo: 'Ambos',
        bonificacion: c.bonificacion,
        caras: c.caras,
        nivel_socioeconomico: c.nivel_socioeconomico,
        formato: c.formato,
        costo: c.tarifa_publica * c.caras,
        tarifa_publica: c.tarifa_publica,
        inicio_periodo: c.inicio_periodo,
        fin_periodo: c.fin_periodo,
        caras_flujo: Math.ceil(c.caras / 2),
        caras_contraflujo: Math.floor(c.caras / 2),
        descuento: c.caras > 0 ? (c.bonificacion / (c.caras + c.bonificacion)) * 100 : 0,
        articulo: c.articulo || '',
      })),
      ...newCaras.map(c => ({
        ciudad: c.ciudades.join(', '),
        estado: c.estado,
        tipo: c.tipo,
        flujo: 'Ambos',
        bonificacion: c.bonificacion,
        caras: c.renta,
        nivel_socioeconomico: c.nse.join(','),
        formato: c.formato,
        costo: c.tarifaPublica * c.renta,
        tarifa_publica: c.tarifaPublica,
        inicio_periodo: c.periodoInicio,
        fin_periodo: c.periodoFin,
        caras_flujo: Math.ceil(c.renta / 2),
        caras_contraflujo: Math.floor(c.renta / 2),
        descuento: c.renta > 0 ? (c.bonificacion / (c.renta + c.bonificacion)) * 100 : 0,
        articulo: c.articulo.ItemCode,
      })),
    ];

    const updateData = {
      cliente_id: selectedCuic.CUIC,
      cuic: selectedCuic.CUIC,
      razon_social: editableRazonSocial, // Use editable field
      unidad_negocio: selectedCuic.T1_U_UnidadNegocio,
      marca_id: selectedCuic.T1_U_IDMarca,
      marca_nombre: selectedCuic.T2_U_Marca,
      asesor: editableAsesor, // Use editable field
      producto_id: selectedCuic.T2_U_IDProducto,
      producto_nombre: selectedCuic.T2_U_Producto,
      agencia: selectedCuic.T0_U_Agencia,
      categoria_id: selectedCuic.T2_U_IDCategoria,
      categoria_nombre: editableCategoria, // Use editable field
      nombre_campania: nombreCampania,
      descripcion,
      notas,
      articulo: existingCaras[0]?.articulo || newCaras[0]?.articulo.ItemCode || '',
      asignados: selectedAsignados.map(u => ({ id: u.id, nombre: u.nombre })),
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      IMU: solicitudData?.solicitud.IMU,
      caras: allCaras,
    };

    updateMutation.mutate(updateData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-6xl max-h-[95vh] h-[95vh] bg-zinc-900 rounded-2xl border border-zinc-700 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-gradient-to-r from-violet-900/30 to-purple-900/30">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Edit3 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Editar Solicitud</h2>
              {solicitudData && <span className="text-violet-300 text-sm">#{solicitudData.solicitud.id}</span>}
            </div>
            {/* SAP Status */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-800 rounded-lg text-[10px]">
                <span className="text-zinc-500">SAP:</span>
                <span className={cuicData && cuicData.length > 0 ? 'text-emerald-400' : 'text-red-400'}>{cuicData?.length || 0}</span>
              </div>
              <button type="button" onClick={handleRefreshSap} disabled={cuicFetching || articulosFetching}
                className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50">
                <RefreshCw className={`h-4 w-4 text-zinc-400 ${(cuicFetching || articulosFetching) ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="h-5 w-5 text-zinc-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Grand Totals KPIs */}
              <div className="p-4 bg-gradient-to-r from-violet-600/10 via-purple-600/10 to-fuchsia-600/10 rounded-2xl border border-violet-500/20">
                <div className="grid grid-cols-5 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">{grandTotals.totalCaras}</p>
                    <p className="text-xs text-zinc-400 mt-1">Total Caras</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-violet-400">{grandTotals.renta}</p>
                    <p className="text-xs text-zinc-400 mt-1">En Renta</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-emerald-400">{grandTotals.bonif}</p>
                    <p className="text-xs text-zinc-400 mt-1">Bonificadas</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-amber-400">{formatCurrency(grandTotals.inversion)}</p>
                    <p className="text-xs text-zinc-400 mt-1">Inversión Total</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-purple-400">{formatCurrency(grandTotals.tarifaEfectiva)}</p>
                    <p className="text-xs text-zinc-400 mt-1">Tarifa Efectiva</p>
                  </div>
                </div>
              </div>

              {/* Two Column Layout - Similar to ViewSolicitudModal */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Campaign Info */}
                <div className="bg-zinc-800/30 rounded-2xl p-5 border border-zinc-800/50">
                  <h3 className="text-sm font-semibold text-violet-400 mb-4 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Campaña
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-zinc-500">Nombre Campaña</label>
                      <input type="text" value={nombreCampania} onChange={(e) => setNombreCampania(e.target.value)}
                        className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50" />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500">Descripción</label>
                      <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2}
                        className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none" />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500">Notas</label>
                      <input type="text" value={notas} onChange={(e) => setNotas(e.target.value)}
                        className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50" />
                    </div>
                    {/* File Upload Section */}
                    <div>
                      <label className="text-xs text-zinc-500 mb-2 block">Archivo (opcional)</label>
                      {existingFile && !selectedFile ? (
                        <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                          <File className="h-5 w-5 text-emerald-400" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-emerald-300 truncate">
                              {existingFile.split('/').pop()}
                            </p>
                            <a
                              href={`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}${existingFile}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-emerald-400 hover:text-emerald-300 underline"
                            >
                              Ver archivo
                            </a>
                          </div>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-3 py-1.5 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg transition-colors"
                          >
                            Cambiar
                          </button>
                        </div>
                      ) : selectedFile ? (
                        <div className="flex items-center gap-3 p-3 bg-violet-500/10 border border-violet-500/30 rounded-lg">
                          <Upload className="h-5 w-5 text-violet-400" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-violet-300 truncate">{selectedFile.name}</p>
                            <p className="text-xs text-zinc-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedFile(null)}
                            className="p-1.5 hover:bg-red-500/20 rounded text-red-400"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-zinc-700 hover:border-violet-500/50 rounded-lg text-zinc-400 hover:text-violet-300 transition-colors"
                        >
                          <Upload className="h-4 w-4" />
                          <span className="text-sm">Seleccionar archivo</span>
                        </button>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setSelectedFile(file);
                        }}
                        className="hidden"
                      />
                    </div>
                  </div>
                </div>

                {/* Client Info */}
                <div className="bg-zinc-800/30 rounded-2xl p-5 border border-zinc-800/50">
                  <h3 className="text-sm font-semibold text-violet-400 mb-4 flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Cliente
                  </h3>
                  <div className="space-y-4">
                    <SearchableSelect
                      label="Seleccionar CUIC"
                      options={cuicData || []}
                      value={selectedCuic}
                      onChange={setSelectedCuic}
                      onClear={() => setSelectedCuic(null)}
                      displayKey="T2_U_Marca"
                      valueKey="CUIC"
                      searchKeys={['T2_U_Marca', 'T2_U_Producto', 'T0_U_RazonSocial', 'CUIC']}
                      loading={cuicLoading}
                      renderOption={(item) => (
                        <div>
                          <div className="font-medium text-white">{item.T2_U_Marca || 'Sin marca'}</div>
                          <div className="text-xs text-zinc-500">{item.CUIC} | {item.T2_U_Producto || 'Sin producto'}</div>
                        </div>
                      )}
                      renderSelected={(item) => (
                        <div className="text-left">
                          <div className="font-medium">{item.T2_U_Marca || 'Sin marca'}</div>
                          <div className="text-[10px] text-zinc-500">{item.CUIC} | {item.T2_U_Producto}</div>
                        </div>
                      )}
                    />
                    {selectedCuic && (
                      <>
                        <div>
                          <label className="text-xs text-zinc-500 mb-1 block">Razón Social</label>
                          <input type="text" value={editableRazonSocial} onChange={(e) => setEditableRazonSocial(e.target.value)}
                            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-zinc-500 mb-1 block">Asesor</label>
                            <input type="text" value={editableAsesor} onChange={(e) => setEditableAsesor(e.target.value)}
                              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-emerald-400 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50" />
                          </div>
                          <div>
                            <label className="text-xs text-zinc-500 mb-1 block">Categoría</label>
                            <input type="text" value={editableCategoria} onChange={(e) => setEditableCategoria(e.target.value)}
                              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-amber-400 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50" />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Period and Asignados Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Dates with Catorcenas */}
                <div className="lg:col-span-2 bg-zinc-800/30 rounded-2xl p-5 border border-zinc-800/50">
                  <h3 className="text-sm font-semibold text-violet-400 mb-4 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Período (Catorcenas)
                  </h3>
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <label className="text-xs text-zinc-500">Año Inicio</label>
                      <select value={yearInicio || ''} onChange={(e) => { setYearInicio(e.target.value ? parseInt(e.target.value) : undefined); setCatorcenaInicio(undefined); }}
                        className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50">
                        <option value="">Seleccionar</option>
                        {yearInicioOptions.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500">Cat. Inicio</label>
                      <select value={catorcenaInicio || ''} onChange={(e) => setCatorcenaInicio(e.target.value ? parseInt(e.target.value) : undefined)}
                        disabled={!yearInicio}
                        className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50">
                        <option value="">Seleccionar</option>
                        {catorcenasInicioOptions.map(c => <option key={c.id} value={c.numero_catorcena}>Cat. {c.numero_catorcena}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500">Año Fin</label>
                      <select value={yearFin || ''} onChange={(e) => { setYearFin(e.target.value ? parseInt(e.target.value) : undefined); setCatorcenaFin(undefined); }}
                        className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50">
                        <option value="">Seleccionar</option>
                        {yearFinOptions.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500">Cat. Fin</label>
                      <select value={catorcenaFin || ''} onChange={(e) => setCatorcenaFin(e.target.value ? parseInt(e.target.value) : undefined)}
                        disabled={!yearFin}
                        className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50">
                        <option value="">Seleccionar</option>
                        {catorcenasFinOptions.map(c => <option key={c.id} value={c.numero_catorcena}>Cat. {c.numero_catorcena}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Asignados */}
                <div className="bg-zinc-800/30 rounded-2xl p-5 border border-zinc-800/50">
                  <h3 className="text-sm font-semibold text-violet-400 mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Asignados
                  </h3>
                  <MultiSelectTags
                    label="usuario"
                    options={users || []}
                    selected={selectedAsignados}
                    onChange={setSelectedAsignados}
                    displayKey="nombre"
                    valueKey="id"
                    searchKey="nombre"
                  />
                </div>
              </div>

              {/* Unified Caras Section */}
              <div className="bg-gradient-to-br from-violet-900/20 via-purple-900/15 to-fuchsia-900/10 rounded-2xl border border-violet-500/20 overflow-hidden">
                <div className="px-5 py-4 border-b border-violet-500/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <MapPin className="h-5 w-5 text-violet-400" />
                      <span className="text-base font-semibold text-white">Detalle de Caras</span>
                      <span className="text-xs text-zinc-400">({existingCaras.length + newCaras.length} caras)</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-zinc-400">{grandTotals.renta} renta</span>
                      <span className="text-emerald-400">+{grandTotals.bonif} bonif</span>
                      <span className="text-amber-400 font-medium">{formatCurrency(grandTotals.inversion)}</span>
                      <span className="text-purple-400 font-medium">TE: {formatCurrency(grandTotals.tarifaEfectiva)}</span>
                    </div>
                  </div>
                </div>

                <div className="p-5 space-y-6">
                  {/* Add New Cara Form - ARRIBA */}
                  <div className="pb-4 border-b border-violet-500/20">
                    <div className="flex items-center gap-2 mb-4">
                      <Plus className="h-4 w-4 text-emerald-400" />
                      <span className="text-sm font-medium text-white">Agregar Nueva Cara</span>
                    </div>

                    <div className="grid grid-cols-4 gap-3 mb-4">
                      {/* Artículo SAP */}
                      <div className="col-span-4">
                        <label className="text-xs text-zinc-500">Artículo SAP</label>
                        <SearchableSelect
                          label="Seleccionar artículo"
                          options={articulosData || []}
                          value={newCaraForm.articulo}
                          onChange={(item) => {
                            const tarifa = getTarifaFromItemCode(item.ItemCode);
                            const ciudadEstado = getCiudadEstadoFromArticulo(item.ItemName);
                            const formato = getFormatoFromArticulo(item.ItemName);
                            const tipo = getTipoFromName(item.ItemName);
                            setNewCaraForm({
                              ...newCaraForm,
                              articulo: item,
                              tarifaPublica: tarifa.tarifa_publica,
                              estado: ciudadEstado?.estado || newCaraForm.estado,
                              ciudades: ciudadEstado ? [ciudadEstado.ciudad] : newCaraForm.ciudades,
                              formato: formato || newCaraForm.formato,
                              tipo: tipo || newCaraForm.tipo,
                            });
                          }}
                          onClear={() => setNewCaraForm({ ...newCaraForm, articulo: null, tarifaPublica: 0 })}
                          displayKey="ItemName"
                          valueKey="ItemCode"
                          searchKeys={['ItemCode', 'ItemName']}
                          loading={articulosLoading}
                          renderOption={(item) => (
                            <div>
                              <div className="font-medium text-white">{item.ItemCode}</div>
                              <div className="text-xs text-zinc-500">{item.ItemName}</div>
                            </div>
                          )}
                        />
                      </div>

                      {/* Estado */}
                      <div>
                        <label className="text-xs text-zinc-500">Estado</label>
                        <select value={newCaraForm.estado} onChange={(e) => setNewCaraForm({ ...newCaraForm, estado: e.target.value, ciudades: [] })}
                          className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none">
                          <option value="">Seleccionar</option>
                          {inventarioFilters?.estados.map(e => <option key={e} value={e}>{e}</option>)}
                        </select>
                      </div>

                      {/* Formato */}
                      <div>
                        <label className="text-xs text-zinc-500">Formato</label>
                        <select value={newCaraForm.formato} onChange={(e) => setNewCaraForm({ ...newCaraForm, formato: e.target.value })}
                          className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none">
                          <option value="">Seleccionar</option>
                          {filteredFormatos.map(f => <option key={f} value={f}>{f}</option>)}
                          {inventarioFilters?.formatos.filter(f => !filteredFormatos.includes(f)).map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>

                      {/* Tipo */}
                      <div>
                        <label className="text-xs text-zinc-500">Tipo</label>
                        <select value={newCaraForm.tipo} onChange={(e) => setNewCaraForm({ ...newCaraForm, tipo: e.target.value as any })}
                          className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none">
                          <option value="">Seleccionar</option>
                          <option value="Tradicional">Tradicional</option>
                          <option value="Digital">Digital</option>
                        </select>
                      </div>

                      {/* Periodo */}
                      <div>
                        <label className="text-xs text-zinc-500">Periodo</label>
                        <select value={newCaraForm.periodo} onChange={(e) => setNewCaraForm({ ...newCaraForm, periodo: e.target.value })}
                          disabled={availablePeriods.length === 0}
                          className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none disabled:opacity-50">
                          <option value="">Seleccionar</option>
                          {availablePeriods.map(p => <option key={`${p.a_o}-${p.numero_catorcena}`} value={`${p.a_o}-${p.numero_catorcena}`}>Cat. {p.numero_catorcena} / {p.a_o}</option>)}
                        </select>
                      </div>

                      {/* Renta */}
                      <div>
                        <label className="text-xs text-zinc-500">Renta</label>
                        <input type="number" min={1} value={newCaraForm.renta}
                          onChange={(e) => setNewCaraForm({ ...newCaraForm, renta: parseInt(e.target.value) || 1 })}
                          className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none" />
                      </div>

                      {/* Bonificación */}
                      <div>
                        <label className="text-xs text-zinc-500">Bonificación</label>
                        <input type="number" min={0} value={newCaraForm.bonificacion}
                          onChange={(e) => setNewCaraForm({ ...newCaraForm, bonificacion: parseInt(e.target.value) || 0 })}
                          className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none" />
                      </div>

                      {/* Tarifa Pública (auto) */}
                      <div>
                        <label className="text-xs text-zinc-500">Tarifa Pública</label>
                        <div className="w-full mt-1 px-3 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-emerald-400 text-sm font-medium">
                          {newCaraForm.tarifaPublica > 0 ? formatCurrency(newCaraForm.tarifaPublica) : 'Selecciona artículo'}
                        </div>
                      </div>
                    </div>

                    {/* NSE */}
                    <div className="mb-4">
                      <label className="text-xs text-zinc-500">Nivel Socioeconómico</label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {inventarioFilters?.nse.map(n => (
                          <button key={n} type="button" onClick={() => toggleNse(n)}
                            className={`px-3 py-1 rounded-full text-xs transition-all ${newCaraForm.nse.includes(n)
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                              : 'bg-zinc-700/50 text-zinc-400 border border-zinc-600/50 hover:border-zinc-500'}`}>
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Preview & Add button */}
                    {newCaraForm.renta > 0 && newCaraForm.tarifaPublica > 0 && (
                      <div className="mb-4 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/30 text-xs text-zinc-300">
                        Vista previa: {newCaraForm.renta} caras × {formatCurrency(newCaraForm.tarifaPublica)} = <span className="text-emerald-400 font-medium">{formatCurrency(newCaraForm.renta * newCaraForm.tarifaPublica)}</span>
                      </div>
                    )}

                    <button type="button" onClick={handleAddNewCara}
                      disabled={!newCaraForm.articulo || !newCaraForm.estado || !newCaraForm.formato || !newCaraForm.tipo || newCaraForm.nse.length === 0 || !newCaraForm.periodo}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg text-sm font-medium transition-colors">
                      <Plus className="h-4 w-4" />
                      Agregar Cara
                    </button>
                  </div>

                  {/* New Caras Table - ABAJO */}
                  {newCaras.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-medium text-emerald-300">Nuevas Caras ({newCaras.length})</span>
                        <div className="flex-1 h-px bg-emerald-500/20"></div>
                        <span className="text-xs text-zinc-500">{formatCurrency(newTotals.inversion)}</span>
                      </div>
                      <div className="overflow-x-auto rounded-xl border border-emerald-500/20 bg-zinc-900/50">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-emerald-600/20">
                              <th className="px-3 py-2 text-left text-xs text-emerald-200">Artículo</th>
                              <th className="px-3 py-2 text-left text-xs text-emerald-200">Estado</th>
                              <th className="px-3 py-2 text-left text-xs text-emerald-200">Formato</th>
                              <th className="px-3 py-2 text-center text-xs text-emerald-200">Renta</th>
                              <th className="px-3 py-2 text-center text-xs text-emerald-200">Bonif</th>
                              <th className="px-3 py-2 text-right text-xs text-amber-300">Tarifa</th>
                              <th className="px-3 py-2 text-right text-xs text-emerald-300">Inversión</th>
                              <th className="px-3 py-2"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-emerald-500/10">
                            {newCaras.map((cara) => (
                              <tr key={cara.tempId} className="hover:bg-emerald-600/10">
                                <td className="px-3 py-2 text-white text-xs">{cara.articulo.ItemCode}</td>
                                <td className="px-3 py-2 text-zinc-300 text-xs">{cara.estado}</td>
                                <td className="px-3 py-2 text-zinc-300 text-xs">{cara.formato}</td>
                                <td className="px-3 py-2 text-center text-white">{cara.renta}</td>
                                <td className="px-3 py-2 text-center text-emerald-400">{cara.bonificacion}</td>
                                <td className="px-3 py-2 text-right text-amber-300">{formatCurrency(cara.tarifaPublica)}</td>
                                <td className="px-3 py-2 text-right text-emerald-300 font-medium">{formatCurrency(cara.tarifaPublica * cara.renta)}</td>
                                <td className="px-3 py-2 text-center">
                                  <button onClick={() => removeNewCara(cara.tempId)} className="p-1 hover:bg-red-500/20 rounded text-red-400">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Existing Caras Table - ABAJO */}
                  {existingCaras.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-medium text-violet-300">Caras Existentes ({existingCaras.length})</span>
                        <div className="flex-1 h-px bg-violet-500/20"></div>
                        <span className="text-xs text-zinc-500">{formatCurrency(existingTotals.inversion)}</span>
                      </div>
                      <div className="overflow-x-auto rounded-xl border border-violet-500/20 bg-zinc-900/50">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-violet-600/20">
                              <th className="px-3 py-2.5 text-left text-xs font-semibold text-violet-200">Ciudad</th>
                              <th className="px-3 py-2.5 text-left text-xs font-semibold text-violet-200">Estado</th>
                              <th className="px-3 py-2.5 text-left text-xs font-semibold text-violet-200">Formato</th>
                              <th className="px-3 py-2.5 text-left text-xs font-semibold text-violet-200">Tipo</th>
                              <th className="px-3 py-2.5 text-center text-xs font-semibold text-violet-200">Renta</th>
                              <th className="px-3 py-2.5 text-center text-xs font-semibold text-violet-200">Bonif</th>
                              <th className="px-3 py-2.5 text-right text-xs font-semibold text-amber-300">Tarifa Púb.</th>
                              <th className="px-3 py-2.5 text-right text-xs font-semibold text-emerald-300">Inversión</th>
                              <th className="px-3 py-2.5 text-center text-xs font-semibold text-violet-200"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-violet-500/10">
                            {existingCaras.map((cara) => {
                              const inversion = cara.tarifa_publica * cara.caras;
                              return (
                                <tr key={cara.id} className="hover:bg-violet-600/10 transition-colors">
                                  <td className="px-3 py-2.5 text-zinc-400">{cara.ciudad || '-'}</td>
                                  <td className="px-3 py-2.5 text-zinc-400">{cara.estado || '-'}</td>
                                  <td className="px-3 py-2.5 text-zinc-400">{cara.formato || '-'}</td>
                                  <td className="px-3 py-2.5 text-zinc-400">{cara.tipo || '-'}</td>
                                  <td className="px-3 py-2.5">
                                    <input type="number" min={0} value={cara.caras}
                                      onChange={(e) => updateExistingCara(cara.id, 'caras', parseInt(e.target.value) || 0)}
                                      className="w-16 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-xs text-center focus:outline-none focus:ring-1 focus:ring-purple-500/50" />
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <input type="number" min={0} value={cara.bonificacion}
                                      onChange={(e) => updateExistingCara(cara.id, 'bonificacion', parseInt(e.target.value) || 0)}
                                      className="w-16 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-emerald-400 text-xs text-center focus:outline-none focus:ring-1 focus:ring-purple-500/50" />
                                  </td>
                                  <td className="px-3 py-2.5 text-right">
                                    <input type="number" min={0} value={cara.tarifa_publica}
                                      onChange={(e) => updateExistingCara(cara.id, 'tarifa_publica', parseFloat(e.target.value) || 0)}
                                      className="w-24 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-amber-300 text-xs text-right focus:outline-none focus:ring-1 focus:ring-purple-500/50" />
                                  </td>
                                  <td className="px-3 py-2.5 text-right text-emerald-300 font-medium">{formatCurrency(inversion)}</td>
                                  <td className="px-3 py-2.5 text-center">
                                    <button onClick={() => removeExistingCara(cara.id)} className="p-1 hover:bg-red-500/20 rounded text-red-400">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800 bg-zinc-900/50">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700 border border-zinc-700">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={updateMutation.isPending || !selectedCuic}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm hover:bg-violet-700 disabled:opacity-50">
            {updateMutation.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Guardando...</>
            ) : (
              <><Save className="h-4 w-4" />Guardar Cambios</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
