import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X, Search, Plus, Trash2, Upload, ChevronDown, ChevronRight, Check, Users, Building2,
  Package, Calendar, FileText, MapPin, Layers, Hash
} from 'lucide-react';
import { solicitudesService, UserOption } from '../../services/solicitudes.service';
import { formatCurrency } from '../../lib/utils';

// Tarifa publica lookup map based on ItemCode
const TARIFA_PUBLICA_MAP: Record<string, { costo: number; tarifa_publica: number }> = {
  'RT-CAR': { costo: 8000, tarifa_publica: 10000 },
  'RT-ESQ': { costo: 5600, tarifa_publica: 7000 },
  'RT-MUR': { costo: 16000, tarifa_publica: 20000 },
  'RT-PAN': { costo: 7200, tarifa_publica: 9000 },
  'RT-TOT': { costo: 4800, tarifa_publica: 6000 },
  'RT-PAR': { costo: 96000, tarifa_publica: 120000 },
  'RT-UNI': { costo: 6720, tarifa_publica: 8400 },
  'RT-COB': { costo: 4000, tarifa_publica: 5000 },
  'RT-DTA': { costo: 2800, tarifa_publica: 3500 },
  'RT-PSU': { costo: 4800, tarifa_publica: 6000 },
  'DI-BAN': { costo: 6400, tarifa_publica: 8000 },
  'DI-VER': { costo: 6400, tarifa_publica: 8000 },
  'DI-TOT': { costo: 6400, tarifa_publica: 8000 },
  'DI-DTA': { costo: 5600, tarifa_publica: 7000 },
  'DI-PST': { costo: 6400, tarifa_publica: 8000 },
  'DI-PAN': { costo: 11200, tarifa_publica: 14000 },
  'DI-ESP': { costo: 64000, tarifa_publica: 80000 },
  'DI-MUR': { costo: 24000, tarifa_publica: 30000 },
  'DI-UNI': { costo: 10400, tarifa_publica: 13000 },
  'DI-MED': { costo: 28000, tarifa_publica: 35000 },
  'DI-LED': { costo: 32000, tarifa_publica: 40000 },
  'DI-MES': { costo: 12800, tarifa_publica: 16000 },
  'DI-MIX': { costo: 32000, tarifa_publica: 40000 },
  'RT-BRD': { costo: 4000, tarifa_publica: 5000 },
  'RT-BAN': { costo: 4000, tarifa_publica: 5000 },
  'RT-VER': { costo: 4000, tarifa_publica: 5000 },
  'RT-MES': { costo: 8000, tarifa_publica: 10000 },
  'RT-PST': { costo: 4000, tarifa_publica: 5000 },
  'RT-ESP': { costo: 40000, tarifa_publica: 50000 },
  'RT-MED': { costo: 16000, tarifa_publica: 20000 },
  'RT-LED': { costo: 16000, tarifa_publica: 20000 },
  'RT-GRA': { costo: 6400, tarifa_publica: 8000 },
  'RT-ACT': { costo: 8000, tarifa_publica: 10000 },
  'RT-TAX': { costo: 3200, tarifa_publica: 4000 },
  'RT-BUS': { costo: 4000, tarifa_publica: 5000 },
  'RT-CEN': { costo: 12000, tarifa_publica: 15000 },
  'RT-PRO': { costo: 8000, tarifa_publica: 10000 },
  'DI-GRA': { costo: 9600, tarifa_publica: 12000 },
  'DI-ACT': { costo: 12000, tarifa_publica: 15000 },
  'DI-TAX': { costo: 4800, tarifa_publica: 6000 },
  'DI-BUS': { costo: 6400, tarifa_publica: 8000 },
  'DI-CEN': { costo: 20000, tarifa_publica: 25000 },
  'DI-PRO': { costo: 12000, tarifa_publica: 15000 },
  'DI-CAR': { costo: 12000, tarifa_publica: 15000 },
  'DI-ESQ': { costo: 8400, tarifa_publica: 10500 },
  'DI-PAR': { costo: 160000, tarifa_publica: 200000 },
  'DI-COB': { costo: 6400, tarifa_publica: 8000 },
};

// Get tarifa and costo from ItemCode - flexible matching
const getTarifaFromItemCode = (itemCode: string): { costo: number; tarifa_publica: number } => {
  if (!itemCode) return { costo: 0, tarifa_publica: 0 };

  // Try exact match first
  const code = itemCode.toUpperCase().trim();
  if (TARIFA_PUBLICA_MAP[code]) {
    return TARIFA_PUBLICA_MAP[code];
  }

  // Try matching the pattern XX-XXX (first 6 chars or until space/special char)
  const match = code.match(/^([A-Z]{2}-[A-Z]{3})/);
  if (match && TARIFA_PUBLICA_MAP[match[1]]) {
    return TARIFA_PUBLICA_MAP[match[1]];
  }

  // Try finding partial match
  for (const key of Object.keys(TARIFA_PUBLICA_MAP)) {
    if (code.startsWith(key) || code.includes(key)) {
      return TARIFA_PUBLICA_MAP[key];
    }
  }

  return { costo: 0, tarifa_publica: 0 };
};

// Ciudad -> Estado mapping for auto-selection
const CIUDAD_ESTADO_MAP: Record<string, string> = {
  'GUADALAJARA': 'Jalisco',
  'ZAPOPAN': 'Jalisco',
  'TLAQUEPAQUE': 'Jalisco',
  'TONALA': 'Jalisco',
  'TLAJOMULCO': 'Jalisco',
  'PUERTO VALLARTA': 'Jalisco',
  'MONTERREY': 'Nuevo León',
  'SAN PEDRO': 'Nuevo León',
  'SAN NICOLAS': 'Nuevo León',
  'APODACA': 'Nuevo León',
  'ESCOBEDO': 'Nuevo León',
  'SANTA CATARINA': 'Nuevo León',
  'CIUDAD DE MEXICO': 'Ciudad de México',
  'CDMX': 'Ciudad de México',
  'MEXICO': 'Ciudad de México',
  'DF': 'Ciudad de México',
  'TIJUANA': 'Baja California',
  'MEXICALI': 'Baja California',
  'ENSENADA': 'Baja California',
  'LEON': 'Guanajuato',
  'IRAPUATO': 'Guanajuato',
  'CELAYA': 'Guanajuato',
  'QUERETARO': 'Querétaro',
  'PUEBLA': 'Puebla',
  'MERIDA': 'Yucatán',
  'CANCUN': 'Quintana Roo',
  'PLAYA DEL CARMEN': 'Quintana Roo',
  'CHIHUAHUA': 'Chihuahua',
  'JUAREZ': 'Chihuahua',
  'CIUDAD JUAREZ': 'Chihuahua',
  'HERMOSILLO': 'Sonora',
  'CULIACAN': 'Sinaloa',
  'MAZATLAN': 'Sinaloa',
  'TORREON': 'Coahuila',
  'SALTILLO': 'Coahuila',
  'AGUASCALIENTES': 'Aguascalientes',
  'MORELIA': 'Michoacán',
  'SAN LUIS POTOSI': 'San Luis Potosí',
  'TAMPICO': 'Tamaulipas',
  'REYNOSA': 'Tamaulipas',
  'VERACRUZ': 'Veracruz',
  'XALAPA': 'Veracruz',
  'OAXACA': 'Oaxaca',
  'TUXTLA': 'Chiapas',
  'VILLAHERMOSA': 'Tabasco',
  'CAMPECHE': 'Campeche',
  'ACAPULCO': 'Guerrero',
  'CUERNAVACA': 'Morelos',
  'TOLUCA': 'Estado de México',
  'PACHUCA': 'Hidalgo',
  'ZACATECAS': 'Zacatecas',
  'DURANGO': 'Durango',
  'TEPIC': 'Nayarit',
  'COLIMA': 'Colima',
  'LA PAZ': 'Baja California Sur',
  'LOS CABOS': 'Baja California Sur',
};

// Extract city from article name and return estado/ciudad
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

interface SAPCuicItem {
  CUIC: number;
  T0_U_RazonSocial: string;
  T0_U_Cliente: string;
  T1_U_UnidadNegocio: string;
  T0_U_Agencia: string;
  T0_U_Asesor: string;
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

interface CaraEntry {
  id: string;
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
  descuento: number;
  precioTotal: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// Searchable Select Component - Shows ALL options
function SearchableSelect({
  label,
  options,
  value,
  onChange,
  onClear,
  displayKey,
  valueKey,
  searchKeys,
  renderOption,
  renderSelected,
  loading,
}: {
  label: string;
  options: any[];
  value: any;
  onChange: (item: any) => void;
  onClear: () => void;
  displayKey: string;
  valueKey: string;
  searchKeys: string[]; // Support multiple search keys
  renderOption?: (item: any) => React.ReactNode;
  renderSelected?: (item: any) => React.ReactNode;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Show ALL options, only filter when searching - search across multiple keys
  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    const term = searchTerm.toLowerCase();
    return options.filter(opt =>
      searchKeys.some(key => String(opt[key] || '').toLowerCase().includes(term))
    );
  }, [options, searchTerm, searchKeys]);

  const handleClose = () => {
    setOpen(false);
    setSearchTerm('');
  };

  const displayValue = value ? (renderSelected ? null : String(value[displayKey])) : '';

  return (
    <div className="relative flex-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm transition-all ${
          value
            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
            : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600'
        }`}
      >
        <span className="truncate text-left flex-1">
          {value && renderSelected ? renderSelected(value) : (displayValue || label)}
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
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
            <div className="max-h-72 overflow-auto">
              {loading ? (
                <div className="px-3 py-4 text-center text-zinc-500 text-sm">Cargando...</div>
              ) : filteredOptions.length === 0 ? (
                <div className="px-3 py-4 text-center text-zinc-500 text-sm">
                  {options.length === 0 ? 'Sin opciones' : 'No se encontraron resultados'}
                </div>
              ) : (
                filteredOptions.map((option, idx) => (
                  <button
                    key={`${option[valueKey]}-${idx}`}
                    type="button"
                    onClick={() => { onChange(option); handleClose(); }}
                    className={`w-full px-3 py-2.5 text-left text-sm transition-colors border-b border-zinc-800/50 last:border-0 ${
                      value && value[valueKey] === option[valueKey]
                        ? 'bg-purple-500/20 text-purple-300'
                        : 'text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    {renderOption ? renderOption(option) : (
                      <span>{option[displayKey]}</span>
                    )}
                  </button>
                ))
              )}
            </div>
            <div className="px-3 py-1.5 border-t border-zinc-800 text-[10px] text-zinc-500">
              Mostrando {filteredOptions.length} de {options.length} opciones
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Multi-select with tags - Add button at top
function MultiSelectTags({
  label,
  options,
  selected,
  onChange,
  displayKey,
  valueKey,
  searchKey,
}: {
  label: string;
  options: any[];
  selected: any[];
  onChange: (items: any[]) => void;
  displayKey: string;
  valueKey: string;
  searchKey: string;
}) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    return options.filter(opt =>
      String(opt[searchKey] || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [options, searchTerm, searchKey]);

  const toggle = (item: any) => {
    const exists = selected.find(s => s[valueKey] === item[valueKey]);
    if (exists) {
      onChange(selected.filter(s => s[valueKey] !== item[valueKey]));
    } else {
      onChange([...selected, item]);
    }
  };

  const remove = (item: any) => {
    onChange(selected.filter(s => s[valueKey] !== item[valueKey]));
  };

  return (
    <div className="space-y-2">
      {/* Add button at TOP */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800/60 text-zinc-400 border border-zinc-700/50 rounded-lg text-xs hover:border-zinc-600 transition-all"
        >
          <Plus className="h-3 w-3" />
          Agregar {label}
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setSearchTerm(''); }} />
            <div className="absolute top-full left-0 mt-1 z-50 w-72 rounded-xl border border-purple-500/20 bg-zinc-900 backdrop-blur-xl shadow-2xl overflow-hidden">
              {/* Search at top */}
              <div className="p-2 border-b border-zinc-800">
                <input
                  type="text"
                  placeholder={`Buscar...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                  autoFocus
                />
              </div>
              {/* Options below */}
              <div className="max-h-52 overflow-auto">
                {filteredOptions.map((option) => {
                  const isSelected = selected.find(s => s[valueKey] === option[valueKey]);
                  return (
                    <button
                      key={option[valueKey]}
                      type="button"
                      onClick={() => toggle(option)}
                      className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 transition-colors ${
                        isSelected ? 'bg-purple-500/20 text-purple-300' : 'text-zinc-400 hover:bg-zinc-800'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                        isSelected ? 'bg-purple-500 border-purple-500' : 'border-zinc-600'
                      }`}>
                        {isSelected && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <div className="flex-1">
                        <span>{option[displayKey]}</span>
                        {option.area && (
                          <span className="ml-2 text-[10px] text-zinc-500">({option.area})</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Selected tags below button */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((item) => (
            <span
              key={item[valueKey]}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded-full text-xs"
            >
              {item[displayKey]}
              {item.area && <span className="text-[10px] text-purple-400/70">({item.area})</span>}
              <button type="button" onClick={() => remove(item)} className="hover:text-white">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function CreateSolicitudModal({ isOpen, onClose }: Props) {
  const queryClient = useQueryClient();

  // Form state
  const [step, setStep] = useState(1);

  // Client section
  const [selectedCuic, setSelectedCuic] = useState<SAPCuicItem | null>(null);

  // Asignados
  const [selectedAsignados, setSelectedAsignados] = useState<UserOption[]>([]);

  // Campaign data
  const [nombreCampania, setNombreCampania] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [notas, setNotas] = useState('');

  // Dates
  const [yearInicio, setYearInicio] = useState<number | undefined>();
  const [yearFin, setYearFin] = useState<number | undefined>();
  const [catorcenaInicio, setCatorcenaInicio] = useState<number | undefined>();
  const [catorcenaFin, setCatorcenaFin] = useState<number | undefined>();

  // Caras data with full info per entry
  const [caras, setCaras] = useState<CaraEntry[]>([]);

  // New cara form
  const [newCara, setNewCara] = useState({
    articulo: null as SAPArticulo | null,
    estado: '',
    ciudades: [] as string[],
    formato: '',
    nse: [] as string[],
    periodo: '',
    renta: 1,
    bonificacion: 0,
    tarifaPublica: 0,
  });

  // File
  const [archivo, setArchivo] = useState<string | null>(null);
  const [tipoArchivo, setTipoArchivo] = useState<string | null>(null);

  // IMU
  const [imu, setImu] = useState(false);

  // Expanded catorcenas in table
  const [expandedCatorcenas, setExpandedCatorcenas] = useState<Set<string>>(new Set());

  // Fetch users
  const { data: users } = useQuery({
    queryKey: ['solicitudes-users'],
    queryFn: () => solicitudesService.getUsers(),
    enabled: isOpen,
  });

  // Fetch trafico users by default
  const { data: traficoUsers } = useQuery({
    queryKey: ['solicitudes-users-trafico'],
    queryFn: () => solicitudesService.getUsers('Trafico'),
    enabled: isOpen,
  });

  // Fetch inventory filters
  const { data: inventarioFilters } = useQuery({
    queryKey: ['inventario-filters'],
    queryFn: () => solicitudesService.getInventarioFilters(),
    enabled: isOpen,
  });

  // Fetch catorcenas
  const { data: catorcenasData } = useQuery({
    queryKey: ['catorcenas'],
    queryFn: () => solicitudesService.getCatorcenas(),
    enabled: isOpen,
  });

  // Fetch ALL CUIC data from SAP
  const { data: cuicData, isLoading: cuicLoading } = useQuery({
    queryKey: ['sap-cuic-all'],
    queryFn: async () => {
      const response = await fetch('https://characteristics-terminals-athletic-workplace.trycloudflare.com/cuic');
      if (!response.ok) throw new Error('Error fetching CUIC data');
      const data = await response.json();
      return (data.value || data) as SAPCuicItem[];
    },
    enabled: isOpen,
    staleTime: 60000,
  });

  // Fetch ALL articulos from SAP
  const { data: articulosData, isLoading: articulosLoading } = useQuery({
    queryKey: ['sap-articulos-all'],
    queryFn: async () => {
      const response = await fetch('https://characteristics-terminals-athletic-workplace.trycloudflare.com/articulos');
      if (!response.ok) throw new Error('Error fetching articulos data');
      const data = await response.json();
      return (data.value || data) as SAPArticulo[];
    },
    enabled: isOpen,
    staleTime: 60000,
  });

  // Fetch formatos based on selected ciudades
  const { data: formatosByCiudades } = useQuery({
    queryKey: ['formatos-by-ciudades', newCara.ciudades],
    queryFn: () => solicitudesService.getFormatosByCiudades(newCara.ciudades),
    enabled: isOpen && newCara.ciudades.length > 0,
  });

  // Fetch next available ID
  const { data: nextId } = useQuery({
    queryKey: ['solicitudes-next-id'],
    queryFn: () => solicitudesService.getNextId(),
    enabled: isOpen,
  });

  // Set default asignados on mount
  useEffect(() => {
    if (traficoUsers && traficoUsers.length > 0 && selectedAsignados.length === 0) {
      setSelectedAsignados(traficoUsers);
    }
  }, [traficoUsers]);

  // Derive tipo from articulo
  const getTipoFromArticulo = (articulo: SAPArticulo | null): string => {
    if (!articulo) return '';
    const name = articulo.ItemName.toUpperCase();
    if (name.includes('DIGITAL')) return 'Digital';
    if (name.includes('RENTA')) return 'Tradicional';
    return '';
  };

  // Filter cities by estado
  const filteredCiudades = useMemo(() => {
    if (!inventarioFilters?.ciudades || !newCara.estado) return [];
    return inventarioFilters.ciudades
      .filter(c => c.estado === newCara.estado)
      .map(c => c.ciudad)
      .filter((c): c is string => !!c);
  }, [inventarioFilters, newCara.estado]);

  // Filter formatos by selected ciudades (from API)
  const filteredFormatos = useMemo(() => {
    if (newCara.ciudades.length > 0 && formatosByCiudades) {
      return formatosByCiudades;
    }
    return [];
  }, [formatosByCiudades, newCara.ciudades]);

  // Year options with validation
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

  // Catorcena options
  const catorcenasInicioOptions = useMemo(() => {
    if (!catorcenasData?.data || !yearInicio) return [];
    const cats = catorcenasData.data.filter(c => c.a_o === yearInicio);
    if (yearInicio === yearFin && catorcenaFin) {
      return cats.filter(c => c.numero_catorcena <= catorcenaFin);
    }
    return cats;
  }, [catorcenasData, yearInicio, yearFin, catorcenaFin]);

  const catorcenasFinOptions = useMemo(() => {
    if (!catorcenasData?.data || !yearFin) return [];
    const cats = catorcenasData.data.filter(c => c.a_o === yearFin);
    if (yearInicio === yearFin && catorcenaInicio) {
      return cats.filter(c => c.numero_catorcena >= catorcenaInicio);
    }
    return cats;
  }, [catorcenasData, yearFin, yearInicio, catorcenaInicio]);

  // Get periods from selected range
  const availablePeriods = useMemo(() => {
    if (!catorcenasData?.data || !yearInicio || !yearFin || !catorcenaInicio || !catorcenaFin) return [];

    return catorcenasData.data.filter(c => {
      if (c.a_o < yearInicio || c.a_o > yearFin) return false;
      if (c.a_o === yearInicio && c.numero_catorcena < catorcenaInicio) return false;
      if (c.a_o === yearFin && c.numero_catorcena > catorcenaFin) return false;
      return true;
    });
  }, [catorcenasData, yearInicio, yearFin, catorcenaInicio, catorcenaFin]);

  // Calculate fecha_inicio and fecha_fin from catorcenas
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

  // Add cara entry
  const handleAddCara = () => {
    if (!newCara.articulo || !newCara.estado || !newCara.formato || newCara.nse.length === 0 || !newCara.periodo) return;

    const [yearStr, catStr] = newCara.periodo.split('-');
    const catorcenaYear = parseInt(yearStr);
    const catorcenaNum = parseInt(catStr);

    const period = availablePeriods.find(p => p.a_o === catorcenaYear && p.numero_catorcena === catorcenaNum);
    if (!period) return;

    // Calculate descuento: if renta=100, bonif=10, then real renta is 90, descuento is 10/100 = 10%
    const totalCaras = newCara.renta;
    const descuento = totalCaras > 0 ? (newCara.bonificacion / totalCaras) * 100 : 0;
    const realRenta = newCara.renta - newCara.bonificacion;
    const precioTotal = (newCara.tarifaPublica * realRenta) * (1 - descuento / 100);

    const cara: CaraEntry = {
      id: `${Date.now()}-${Math.random()}`,
      articulo: newCara.articulo,
      estado: newCara.estado,
      ciudades: newCara.ciudades.length > 0 ? newCara.ciudades : ['Todas'],
      formato: newCara.formato,
      tipo: getTipoFromArticulo(newCara.articulo),
      nse: newCara.nse,
      catorcenaNum,
      catorcenaYear,
      periodoInicio: period.fecha_inicio,
      periodoFin: period.fecha_fin,
      renta: newCara.renta,
      bonificacion: newCara.bonificacion,
      tarifaPublica: newCara.tarifaPublica,
      descuento,
      precioTotal: newCara.tarifaPublica * (newCara.renta - newCara.bonificacion),
    };

    setCaras([...caras, cara]);

    // Auto expand the catorcena
    setExpandedCatorcenas(prev => new Set(prev).add(`${catorcenaYear}-${catorcenaNum}`));

    // Reset form but keep articulo as default
    setNewCara({
      ...newCara,
      estado: '',
      ciudades: [],
      formato: '',
      nse: [],
      periodo: '',
      renta: 1,
      bonificacion: 0,
      tarifaPublica: 0,
    });
  };

  // Remove cara
  const handleRemoveCara = (id: string) => {
    setCaras(caras.filter(c => c.id !== id));
  };

  // Group caras by catorcena
  const groupedCaras = useMemo(() => {
    const groups: Record<string, CaraEntry[]> = {};
    caras.forEach(cara => {
      const key = `${cara.catorcenaYear}-${cara.catorcenaNum}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(cara);
    });
    // Sort by year and catorcena
    return Object.entries(groups).sort((a, b) => {
      const [yearA, catA] = a[0].split('-').map(Number);
      const [yearB, catB] = b[0].split('-').map(Number);
      if (yearA !== yearB) return yearA - yearB;
      return catA - catB;
    });
  }, [caras]);

  // Toggle catorcena expansion
  const toggleCatorcena = (key: string) => {
    setExpandedCatorcenas(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Calculate totals
  const totals = useMemo(() => {
    const totalRenta = caras.reduce((acc, c) => acc + c.renta, 0);
    const totalBonificacion = caras.reduce((acc, c) => acc + c.bonificacion, 0);
    const totalPrecio = caras.reduce((acc, c) => acc + c.precioTotal, 0);
    // Average descuento
    const avgDescuento = caras.length > 0
      ? caras.reduce((acc, c) => acc + c.descuento, 0) / caras.length
      : 0;
    return { totalRenta, totalBonificacion, totalCaras: totalRenta, totalPrecio, avgDescuento };
  }, [caras]);

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setArchivo(reader.result as string);
        setTipoArchivo(file.type);
      };
      reader.readAsDataURL(file);
    }
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => solicitudesService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitudes'] });
      queryClient.invalidateQueries({ queryKey: ['solicitudes-stats'] });
      onClose();
      resetForm();
    },
  });

  // Reset form
  const resetForm = () => {
    setStep(1);
    setSelectedCuic(null);
    setSelectedAsignados(traficoUsers || []);
    setNombreCampania('');
    setDescripcion('');
    setNotas('');
    setYearInicio(undefined);
    setYearFin(undefined);
    setCatorcenaInicio(undefined);
    setCatorcenaFin(undefined);
    setCaras([]);
    setArchivo(null);
    setTipoArchivo(null);
    setImu(false);
    setExpandedCatorcenas(new Set());
  };

  // Handle submit
  const handleSubmit = () => {
    if (!selectedCuic || caras.length === 0 || !fechaInicio || !fechaFin) {
      return;
    }

    const data = {
      cliente_id: selectedCuic.CUIC,
      cuic: selectedCuic.CUIC,
      razon_social: selectedCuic.T0_U_RazonSocial,
      unidad_negocio: selectedCuic.T1_U_UnidadNegocio,
      marca_id: selectedCuic.T1_U_IDMarca,
      marca_nombre: selectedCuic.T2_U_Marca,
      asesor: selectedCuic.T0_U_Asesor,
      producto_id: selectedCuic.T2_U_IDProducto,
      producto_nombre: selectedCuic.T2_U_Producto,
      agencia: selectedCuic.T0_U_Agencia,
      categoria_id: selectedCuic.T2_U_IDCategoria,
      categoria_nombre: selectedCuic.T2_U_Categoria,
      nombre_campania: nombreCampania,
      descripcion,
      notas,
      articulo: caras[0]?.articulo.ItemCode || '',
      asignados: selectedAsignados.map(u => ({ id: u.id, nombre: u.nombre })),
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      archivo: archivo || undefined,
      tipo_archivo: tipoArchivo || undefined,
      IMU: imu,
      caras: caras.map(c => ({
        ciudad: c.ciudades.join(', '),
        estado: c.estado,
        tipo: c.tipo,
        flujo: 'Ambos',
        bonificacion: c.bonificacion,
        caras: c.renta,
        nivel_socioeconomico: c.nse.join(','),
        formato: c.formato,
        costo: c.precioTotal,
        tarifa_publica: c.tarifaPublica,
        inicio_periodo: c.periodoInicio,
        fin_periodo: c.periodoFin,
        caras_flujo: Math.ceil(c.renta / 2),
        caras_contraflujo: Math.floor(c.renta / 2),
        descuento: c.descuento,
      })),
    };

    createMutation.mutate(data);
  };

  // Toggle NSE
  const toggleNse = (nse: string) => {
    if (newCara.nse.includes(nse)) {
      setNewCara({ ...newCara, nse: newCara.nse.filter(n => n !== nse) });
    } else {
      setNewCara({ ...newCara, nse: [...newCara.nse, nse] });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-5xl max-h-[95vh] h-[95vh] bg-zinc-900 rounded-2xl border border-zinc-700 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="text-xl font-bold text-white">Nueva Solicitud</h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="h-5 w-5 text-zinc-400" />
          </button>
        </div>

        {/* Progress steps */}
        <div className="px-6 py-3 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-2">
            {[
              { num: 1, label: 'Cliente', icon: Building2 },
              { num: 2, label: 'Campaña', icon: FileText },
              { num: 3, label: 'Ubicaciones', icon: MapPin },
              { num: 4, label: 'Resumen', icon: Layers },
            ].map((s, i) => (
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
                  <s.icon className="h-4 w-4" />
                  {s.label}
                </button>
                {i < 3 && <div className="flex-1 h-px bg-zinc-700" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Cliente */}
          {step === 1 && (
            <div className="space-y-6">
              {/* CUIC Select - Shows Marca first, then CUIC + Producto */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-purple-400" />
                  CUIC / Cliente
                </label>
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
                      <div className="text-xs text-zinc-500">
                        {item.CUIC} | {item.T2_U_Producto || 'Sin producto'}
                      </div>
                    </div>
                  )}
                  renderSelected={(item) => (
                    <div className="text-left">
                      <div className="font-medium">{item.T2_U_Marca || 'Sin marca'}</div>
                      <div className="text-[10px] text-zinc-500">{item.CUIC} | {item.T2_U_Producto || ''}</div>
                    </div>
                  )}
                />
              </div>

              {/* Selected client info - Complete */}
              {selectedCuic && (
                <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700/50 space-y-4">
                  {/* Row 1: CUIC, Marca, Producto */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                      <span className="text-[10px] text-purple-400 uppercase tracking-wider">CUIC</span>
                      <div className="text-lg font-bold text-white">{selectedCuic.CUIC}</div>
                    </div>
                    <div className="p-3 bg-zinc-700/30 rounded-lg">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Marca</span>
                      <div className="text-sm font-medium text-white">{selectedCuic.T2_U_Marca || '-'}</div>
                    </div>
                    <div className="p-3 bg-zinc-700/30 rounded-lg">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Producto</span>
                      <div className="text-sm font-medium text-white">{selectedCuic.T2_U_Producto || '-'}</div>
                    </div>
                  </div>
                  {/* Row 2: Razón Social, Cliente */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Razón Social</span>
                      <div className="text-sm text-white">{selectedCuic.T0_U_RazonSocial || '-'}</div>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Cliente</span>
                      <div className="text-sm text-white">{selectedCuic.T0_U_Cliente || '-'}</div>
                    </div>
                  </div>
                  {/* Row 3: Asesor, Agencia, Unidad Negocio */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Asesor</span>
                      <div className="text-sm text-emerald-400">{selectedCuic.T0_U_Asesor || '-'}</div>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Agencia</span>
                      <div className="text-sm text-white">{selectedCuic.T0_U_Agencia || '-'}</div>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Unidad de Negocio</span>
                      <div className="text-sm text-white">{selectedCuic.T1_U_UnidadNegocio || '-'}</div>
                    </div>
                  </div>
                  {/* Row 4: Categoría */}
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Categoría</span>
                    <div className="text-sm text-amber-400">{selectedCuic.T2_U_Categoria || '-'}</div>
                  </div>
                </div>
              )}

              {/* Asignados with tags - search at bottom */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <Users className="h-4 w-4 text-purple-400" />
                    Asignados
                  </label>
                  {selectedAsignados.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedAsignados([])}
                      className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                    >
                      <Trash2 className="h-3 w-3" />
                      Limpiar todos
                    </button>
                  )}
                </div>
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
          )}

          {/* Step 2: Campaña */}
          {step === 2 && (
            <div className="space-y-6">
              {/* Campaign name and notas */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">Nombre de Campaña</label>
                  <input
                    type="text"
                    value={nombreCampania}
                    onChange={(e) => setNombreCampania(e.target.value)}
                    placeholder="Nombre de la campaña..."
                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">Notas</label>
                  <input
                    type="text"
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    placeholder="Notas breves..."
                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
              </div>

              {/* Date range */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-purple-400" />
                  Rango de Fechas
                </label>
                <div className="grid grid-cols-2 gap-4">
                  {/* Años */}
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-xs text-zinc-500">Año Inicio</label>
                      <select
                        value={yearInicio || ''}
                        onChange={(e) => {
                          setYearInicio(e.target.value ? parseInt(e.target.value) : undefined);
                          setCatorcenaInicio(undefined);
                        }}
                        className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                      >
                        <option value="">Seleccionar</option>
                        {yearInicioOptions.map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-zinc-500">Año Fin</label>
                      <select
                        value={yearFin || ''}
                        onChange={(e) => {
                          setYearFin(e.target.value ? parseInt(e.target.value) : undefined);
                          setCatorcenaFin(undefined);
                        }}
                        className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                      >
                        <option value="">Seleccionar</option>
                        {yearFinOptions.map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Catorcenas */}
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-xs text-zinc-500">Catorcena Inicio</label>
                      <select
                        value={catorcenaInicio || ''}
                        onChange={(e) => setCatorcenaInicio(e.target.value ? parseInt(e.target.value) : undefined)}
                        disabled={!yearInicio}
                        className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50"
                      >
                        <option value="">Seleccionar</option>
                        {catorcenasInicioOptions.map(c => (
                          <option key={c.id} value={c.numero_catorcena}>
                            Catorcena {c.numero_catorcena} / {c.a_o}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-zinc-500">Catorcena Fin</label>
                      <select
                        value={catorcenaFin || ''}
                        onChange={(e) => setCatorcenaFin(e.target.value ? parseInt(e.target.value) : undefined)}
                        disabled={!yearFin}
                        className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50"
                      >
                        <option value="">Seleccionar</option>
                        {catorcenasFinOptions.map(c => (
                          <option key={c.id} value={c.numero_catorcena}>
                            Catorcena {c.numero_catorcena} / {c.a_o}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Descripción (large) */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Descripción</label>
                <textarea
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Descripción detallada de la campaña..."
                  rows={4}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
                />
              </div>
            </div>
          )}

          {/* Step 3: Ubicaciones */}
          {step === 3 && (
            <div className="space-y-6">
              {/* Next ID indicator */}
              <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-xl border border-purple-500/20">
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-purple-400" />
                  <span className="text-sm text-zinc-300">Próximo ID de Solicitud:</span>
                </div>
                <span className="text-lg font-bold text-purple-400 bg-purple-500/20 px-3 py-1 rounded-lg">
                  #{nextId || '...'}
                </span>
              </div>

              {/* Add cara form */}
              <div className="p-4 bg-zinc-800/30 rounded-xl border border-zinc-700/50">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <Plus className="h-4 w-4 text-purple-400" />
                  Agregar Ubicación
                </h3>

                {/* Articulo SAP - per entry */}
                <div className="mb-4">
                  <label className="text-xs text-zinc-500 flex items-center gap-1">
                    <Package className="h-3 w-3" />
                    Artículo SAP
                  </label>
                  <SearchableSelect
                    label="Seleccionar artículo"
                    options={articulosData || []}
                    value={newCara.articulo}
                    onChange={(item) => {
                      // Auto-set tarifa publica from ItemCode mapping
                      const tarifa = getTarifaFromItemCode(item.ItemCode);
                      // Auto-set estado and ciudad from ItemName
                      const ciudadEstado = getCiudadEstadoFromArticulo(item.ItemName);
                      if (ciudadEstado) {
                        setNewCara({
                          ...newCara,
                          articulo: item,
                          tarifaPublica: tarifa.tarifa_publica,
                          estado: ciudadEstado.estado,
                          ciudades: [ciudadEstado.ciudad],
                          formato: '', // Reset formato to re-filter by new ciudad
                        });
                      } else {
                        setNewCara({ ...newCara, articulo: item, tarifaPublica: tarifa.tarifa_publica });
                      }
                    }}
                    onClear={() => setNewCara({ ...newCara, articulo: null, tarifaPublica: 0, estado: '', ciudades: [], formato: '' })}
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
                    renderSelected={(item) => (
                      <div className="text-left">
                        <div className="font-medium text-sm">{item.ItemCode}</div>
                        <div className="text-[10px] text-zinc-500">{item.ItemName}</div>
                      </div>
                    )}
                  />
                  {newCara.articulo && (
                    <div className="flex items-center gap-2 text-xs mt-1">
                      <span className="text-zinc-400">Tipo:</span>
                      <span className={`px-2 py-0.5 rounded-full ${
                        getTipoFromArticulo(newCara.articulo) === 'Digital' ? 'bg-blue-500/20 text-blue-300' : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        {getTipoFromArticulo(newCara.articulo) || 'No determinado'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {/* Estado */}
                  <div>
                    <label className="text-xs text-zinc-500">Estado</label>
                    <select
                      value={newCara.estado}
                      onChange={(e) => setNewCara({ ...newCara, estado: e.target.value, ciudades: [], formato: '' })}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    >
                      <option value="">Seleccionar</option>
                      {inventarioFilters?.estados.map(e => (
                        <option key={e} value={e}>{e}</option>
                      ))}
                    </select>
                  </div>

                  {/* Ciudad - Multiselect */}
                  <div>
                    <label className="text-xs text-zinc-500">Ciudad (multiselect)</label>
                    <MultiSelectTags
                      label="ciudad"
                      options={filteredCiudades.map(c => ({ ciudad: c }))}
                      selected={newCara.ciudades.map(c => ({ ciudad: c }))}
                      onChange={(items) => setNewCara({ ...newCara, ciudades: items.map(i => i.ciudad), formato: '' })}
                      displayKey="ciudad"
                      valueKey="ciudad"
                      searchKey="ciudad"
                    />
                  </div>

                  {/* Formato - filtered by ciudades */}
                  <div>
                    <label className="text-xs text-zinc-500">Formato</label>
                    <select
                      value={newCara.formato}
                      onChange={(e) => setNewCara({ ...newCara, formato: e.target.value })}
                      disabled={newCara.ciudades.length === 0}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50"
                    >
                      <option value="">{newCara.ciudades.length === 0 ? 'Selecciona ciudad(es)' : 'Seleccionar'}</option>
                      {filteredFormatos.map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>

                  {/* Periodo */}
                  <div>
                    <label className="text-xs text-zinc-500">Periodo</label>
                    <select
                      value={newCara.periodo}
                      onChange={(e) => setNewCara({ ...newCara, periodo: e.target.value })}
                      disabled={availablePeriods.length === 0}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50"
                    >
                      <option value="">Seleccionar</option>
                      {availablePeriods.map(p => (
                        <option key={`${p.a_o}-${p.numero_catorcena}`} value={`${p.a_o}-${p.numero_catorcena}`}>
                          Catorcena {p.numero_catorcena} / {p.a_o}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Renta */}
                  <div>
                    <label className="text-xs text-zinc-500">Renta (caras)</label>
                    <input
                      type="number"
                      min={1}
                      value={newCara.renta}
                      onChange={(e) => setNewCara({ ...newCara, renta: parseInt(e.target.value) || 1 })}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                  </div>

                  {/* Bonificacion */}
                  <div>
                    <label className="text-xs text-zinc-500">Bonificación</label>
                    <input
                      type="number"
                      min={0}
                      max={newCara.renta}
                      value={newCara.bonificacion}
                      onChange={(e) => setNewCara({ ...newCara, bonificacion: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                  </div>

                  {/* Tarifa Publica - Auto-calculated from ItemCode */}
                  <div>
                    <label className="text-xs text-zinc-500">Tarifa Pública (auto)</label>
                    <div className="w-full px-3 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-emerald-400 text-sm font-medium">
                      {newCara.tarifaPublica > 0 ? formatCurrency(newCara.tarifaPublica) : 'Selecciona artículo'}
                    </div>
                    {newCara.articulo && (
                      <div className="text-[10px] text-zinc-500 mt-1">
                        Costo: {formatCurrency(getTarifaFromItemCode(newCara.articulo.ItemCode).costo)}
                      </div>
                    )}
                  </div>

                  {/* NSE */}
                  <div className="col-span-2">
                    <label className="text-xs text-zinc-500">Nivel Socioeconómico</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {inventarioFilters?.nse.map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => toggleNse(n)}
                          className={`px-3 py-1 rounded-full text-xs transition-all ${
                            newCara.nse.includes(n)
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                              : 'bg-zinc-700/50 text-zinc-400 border border-zinc-600/50 hover:border-zinc-500'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Preview calculation */}
                {newCara.renta > 0 && newCara.tarifaPublica > 0 && (
                  <div className="mt-4 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/30">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-400">Vista previa:</span>
                      <span className="text-zinc-300">
                        {newCara.renta} caras - {newCara.bonificacion} bonif. = {newCara.renta - newCara.bonificacion} cobradas × {formatCurrency(newCara.tarifaPublica)} = <span className="text-emerald-400 font-medium">{formatCurrency((newCara.renta - newCara.bonificacion) * newCara.tarifaPublica)}</span>
                      </span>
                    </div>
                    {newCara.bonificacion > 0 && (
                      <div className="text-[10px] text-amber-400 mt-1">
                        Descuento: {((newCara.bonificacion / newCara.renta) * 100).toFixed(1)}%
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleAddCara}
                  disabled={!newCara.articulo || !newCara.estado || !newCara.formato || newCara.nse.length === 0 || !newCara.periodo}
                  className="mt-4 flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Agregar
                </button>
              </div>

              {/* Caras table - grouped by catorcena */}
              <div className="rounded-xl border border-zinc-700/50 overflow-hidden">
                {groupedCaras.length === 0 ? (
                  <div className="px-4 py-8 text-center text-zinc-500 text-sm">
                    No hay ubicaciones agregadas
                  </div>
                ) : (
                  <div>
                    {groupedCaras.map(([key, items]) => {
                      const [year, cat] = key.split('-');
                      const isExpanded = expandedCatorcenas.has(key);
                      const groupTotal = items.reduce((acc, c) => acc + c.precioTotal, 0);
                      const groupRenta = items.reduce((acc, c) => acc + c.renta, 0);
                      const groupBonif = items.reduce((acc, c) => acc + c.bonificacion, 0);

                      return (
                        <div key={key}>
                          {/* Catorcena header */}
                          <button
                            type="button"
                            onClick={() => toggleCatorcena(key)}
                            className="w-full flex items-center justify-between px-4 py-3 bg-zinc-800/50 hover:bg-zinc-800 transition-colors border-b border-zinc-700/50"
                          >
                            <div className="flex items-center gap-3">
                              {isExpanded ? <ChevronDown className="h-4 w-4 text-zinc-400" /> : <ChevronRight className="h-4 w-4 text-zinc-400" />}
                              <span className="font-medium text-white">Catorcena {cat} / {year}</span>
                              <span className="text-xs text-zinc-500">({items.length} ubicaciones)</span>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <span className="text-zinc-400">{groupRenta} renta</span>
                              <span className="text-emerald-400">+{groupBonif} bonif.</span>
                              <span className="text-amber-400 font-medium">{formatCurrency(groupTotal)}</span>
                            </div>
                          </button>

                          {/* Expanded items */}
                          {isExpanded && (
                            <div className="bg-zinc-900/50">
                              <table className="w-full">
                                <thead>
                                  <tr className="bg-zinc-800/30">
                                    <th className="px-3 py-2 text-left text-[10px] font-semibold text-zinc-500">Artículo</th>
                                    <th className="px-3 py-2 text-left text-[10px] font-semibold text-zinc-500">Estado</th>
                                    <th className="px-3 py-2 text-left text-[10px] font-semibold text-zinc-500">Ciudad</th>
                                    <th className="px-3 py-2 text-left text-[10px] font-semibold text-zinc-500">Formato</th>
                                    <th className="px-3 py-2 text-left text-[10px] font-semibold text-zinc-500">Tipo</th>
                                    <th className="px-3 py-2 text-center text-[10px] font-semibold text-zinc-500">Renta</th>
                                    <th className="px-3 py-2 text-center text-[10px] font-semibold text-zinc-500">Bonif.</th>
                                    <th className="px-3 py-2 text-center text-[10px] font-semibold text-zinc-500">Total</th>
                                    <th className="px-3 py-2 text-right text-[10px] font-semibold text-zinc-500">Tarifa</th>
                                    <th className="px-3 py-2 text-right text-[10px] font-semibold text-zinc-500">Desc.</th>
                                    <th className="px-3 py-2 text-right text-[10px] font-semibold text-zinc-500">Precio</th>
                                    <th className="px-3 py-2 text-center text-[10px] font-semibold text-zinc-500"></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {items.map((cara) => (
                                    <tr key={cara.id} className="border-t border-zinc-800/50 hover:bg-zinc-800/20">
                                      <td className="px-3 py-2 text-xs text-white max-w-[120px] truncate" title={cara.articulo.ItemName}>
                                        {cara.articulo.ItemName}
                                      </td>
                                      <td className="px-3 py-2 text-xs text-zinc-300">{cara.estado}</td>
                                      <td className="px-3 py-2 text-xs text-zinc-300 max-w-[100px] truncate" title={cara.ciudades.join(', ')}>
                                        {cara.ciudades.join(', ')}
                                      </td>
                                      <td className="px-3 py-2 text-xs text-zinc-300">{cara.formato}</td>
                                      <td className="px-3 py-2">
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                          cara.tipo === 'Digital' ? 'bg-blue-500/20 text-blue-300' : 'bg-amber-500/20 text-amber-300'
                                        }`}>
                                          {cara.tipo}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2 text-xs text-center text-white">{cara.renta}</td>
                                      <td className="px-3 py-2 text-xs text-center text-emerald-400">{cara.bonificacion}</td>
                                      <td className="px-3 py-2 text-xs text-center text-white font-medium">{cara.renta - cara.bonificacion}</td>
                                      <td className="px-3 py-2 text-xs text-right text-zinc-300">{formatCurrency(cara.tarifaPublica)}</td>
                                      <td className="px-3 py-2 text-xs text-right text-amber-400">{cara.descuento.toFixed(1)}%</td>
                                      <td className="px-3 py-2 text-xs text-right text-emerald-400 font-medium">{formatCurrency(cara.precioTotal)}</td>
                                      <td className="px-3 py-2 text-center">
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveCara(cara.id)}
                                          className="p-1 hover:bg-red-500/20 rounded text-red-400 text-[10px]"
                                          title="Descartar"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Totals footer */}
                    <div className="px-4 py-3 bg-zinc-800/30 border-t border-zinc-700/50">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-zinc-400">Totales:</span>
                        <div className="flex items-center gap-6 text-sm">
                          <span className="text-white">{totals.totalRenta} renta</span>
                          <span className="text-emerald-400">+{totals.totalBonificacion} bonif.</span>
                          <span className="text-amber-400 font-bold">{formatCurrency(totals.totalPrecio)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Resumen */}
          {step === 4 && (
            <div className="space-y-6">
              {/* Summary cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-zinc-800/30 rounded-xl border border-zinc-700/50">
                  <h3 className="text-sm font-semibold text-zinc-400 mb-3">Cliente</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-zinc-500 text-sm">CUIC:</span>
                      <span className="text-white text-sm">{selectedCuic?.CUIC || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500 text-sm">Marca:</span>
                      <span className="text-white text-sm">{selectedCuic?.T2_U_Marca || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500 text-sm">Producto:</span>
                      <span className="text-white text-sm">{selectedCuic?.T2_U_Producto || '-'}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-zinc-800/30 rounded-xl border border-zinc-700/50">
                  <h3 className="text-sm font-semibold text-zinc-400 mb-3">Campaña</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-zinc-500 text-sm">Nombre:</span>
                      <span className="text-white text-sm">{nombreCampania || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500 text-sm">Ubicaciones:</span>
                      <span className="text-white text-sm">{caras.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500 text-sm">Fechas:</span>
                      <span className="text-white text-sm">
                        {fechaInicio && fechaFin ? `${new Date(fechaInicio).toLocaleDateString()} - ${new Date(fechaFin).toLocaleDateString()}` : '-'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Totals */}
              <div className="p-4 bg-purple-500/10 rounded-xl border border-purple-500/30">
                <div className="grid grid-cols-5 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">{totals.totalRenta}</div>
                    <div className="text-xs text-zinc-400">Renta</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-emerald-400">{totals.totalBonificacion}</div>
                    <div className="text-xs text-zinc-400">Bonificación</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-400">{totals.totalRenta - totals.totalBonificacion}</div>
                    <div className="text-xs text-zinc-400">Total Caras</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-400">{totals.avgDescuento.toFixed(1)}%</div>
                    <div className="text-xs text-zinc-400">Descuento Prom.</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-amber-400">{formatCurrency(totals.totalPrecio)}</div>
                    <div className="text-xs text-zinc-400">Inversión</div>
                  </div>
                </div>
              </div>

              {/* Asignados */}
              <div className="p-4 bg-zinc-800/30 rounded-xl border border-zinc-700/50">
                <h3 className="text-sm font-semibold text-zinc-400 mb-3">Asignados</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedAsignados.map(u => (
                    <span key={u.id} className="px-3 py-1 bg-zinc-700/50 text-white text-xs rounded-full">
                      {u.nombre}
                    </span>
                  ))}
                </div>
              </div>

              {/* File upload */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                  <Upload className="h-4 w-4 text-purple-400" />
                  Archivo (opcional)
                </label>
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-500 file:text-white hover:file:bg-purple-600"
                />
                {archivo && (
                  <div className="text-xs text-emerald-400">Archivo cargado: {tipoArchivo}</div>
                )}
              </div>

              {/* IMU checkbox */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={imu}
                  onChange={(e) => setImu(e.target.checked)}
                  className="w-5 h-5 rounded bg-zinc-800 border-zinc-700 text-purple-500 focus:ring-purple-500/50"
                />
                <span className="text-sm text-zinc-300">IMU (Impuesto Municipal)</span>
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-900/50">
          <button
            type="button"
            onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-700 transition-colors"
          >
            {step === 1 ? 'Cancelar' : 'Anterior'}
          </button>

          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
            >
              Siguiente
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={createMutation.isPending || !selectedCuic || caras.length === 0}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:bg-zinc-700 disabled:text-zinc-500 transition-colors flex items-center gap-2"
            >
              {createMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Creando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Crear Solicitud
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
