import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X, Search, Plus, Trash2, Upload, ChevronDown, ChevronRight, Check, Users, Building2,
  Package, Calendar, FileText, MapPin, Layers, Hash, RefreshCw
} from 'lucide-react';
import { solicitudesService, UserOption } from '../../services/solicitudes.service';
import { formatCurrency } from '../../lib/utils';
import { getSapCache, setSapCache, SAP_CACHE_KEYS, getCacheTimestamp, clearSapCache } from '../../lib/sapCache';
import { useEnvironmentStore, getEndpoints } from '../../store/environmentStore';

// Tarifa publica lookup map based on ItemCode (full SAP codes with tarifa_publica values)
const TARIFA_PUBLICA_MAP: Record<string, number> = {
  'RT-BL-COB-MX': 2500,
  'RT-BP1-SEC1-01-NAUC': 110000,
  'RT-BP1-SEC1-02-NAUC': 110000,
  'RT-BP2-SEC1-01-NAUC': 50000,
  'RT-BP2-SEC1-02-NAUC': 50000,
  'RT-BP3-SEC1-01-NAUC': 60000,
  'RT-BP3-SEC1-02-NAUC': 60000,
  'RT-BP4-SEC1-01-NAUC': 55000,
  'RT-BP5-SEC1-01-NAUC': 36667,
  'RT-BP5-SEC1-02-NAUC': 36667,
  'RT-BP5-SEC1-03-NAUC': 36667,
  'RT-BP5-SEC1-04-NAUC': 36667,
  'RT-BP5-SEC2-01-NAUC': 36667,
  'RT-BP5-SEC2-02-NAUC': 36667,
  'RT-BP5-SEC2-03-NAUC': 36667,
  'RT-BP5-SEC2-04-NAUC': 36667,
  'RT-BP5-SEC3-01-NAUC': 36667,
  'RT-BP5-SEC3-02-NAUC': 36667,
  'RT-BP5-SEC3-03-NAUC': 36667,
  'RT-BP5-SEC3-04-NAUC': 36667,
  'RT-BP5-SEC4-01-NAUC': 36667,
  'RT-BP5-SEC4-02-NAUC': 36667,
  'RT-BP5-SEC4-03-NAUC': 36667,
  'RT-BP5-SEC4-04-NAUC': 36667,
  'RT-CDMX-DI-IT': 0,
  'RT-CDMX-PA-IT': 0,
  'RT-CDMX-WIFI': 0,
  'RT-CL-COB-BR': 3768,
  'RT-CL-COB-MX': 6127,
  'RT-CL-COB-PH': 3768,
  'RT-CL-COB-TJ': 3768,
  'RT-CL-PRA-MX': 9190,
  'RT-DIG-01-MR': 9842,
  'RT-DIG-01-MX': 9482,
  'RT-DIG-01-PB': 8500,
  'RT-DIG-02-MX': 9482,
  'RT-DIG-03-MX': 9482,
  'RT-DIG-04-MX': 9482,
  'RT-DIG-PRG-PB': 0,
  'RT-ES-DIG-EM': 40000,
  'RT-GDL-WIFI': 0,
  'RT-GDL-WIFI-DIG': 0,
  'RT-KCD-GDL-FL': 35000,
  'RT-KCD-GDL-PER': 26900,
  'RT-KCS-AGS': 27500,
  'RT-KCS-AGS-PER': 30000,
  'RT-KCS-GDL': 30000,
  'RT-KCS-GDL-PER': 30000,
  'RT-KCS-LEN': 27500,
  'RT-KCS-LEN-PER': 30000,
  'RT-KCS-MEX-PER': 60000,
  'RT-KCS-MTY-PER': 2500,
  'RT-KCS-PH-PER': 30000,
  'RT-KCS-SLP': 27500,
  'RT-KCS-SLP-PER': 30000,
  'RT-KCS-VER-PER': 60000,
  'RT-KCS-ZAP': 30000,
  'RT-KCS-ZAP-FL': 30000,
  'RT-KCS-ZAP-PER': 30000,
  'RT-MMC-GDL-MA': 0,
  'RT-MMC-GDL-MB': 0,
  'RT-MMC-GDL-MC': 0,
  'RT-MMC-GDL-MP': 0,
  'RT-MMC-GDL-VE': 0,
  'RT-MMC-GDL-VI': 0,
  'RT-MTY-DI-IT': 0,
  'RT-MTY-PA-IT': 0,
  'RT-MTY-WIFI': 0,
  'RT-P1-COB-CH': 3768,
  'RT-P1-COB-CL': 3768,
  'RT-P1-COB-EM': 6127,
  'RT-P1-COB-GD': 6127,
  'RT-P1-COB-MR': 3768,
  'RT-P1-COB-MX': 6127,
  'RT-P1-COB-MY': 6127,
  'RT-P1-COB-PB': 3768,
  'RT-P1-COB-QR': 3768,
  'RT-P1-COB-SA': 3768,
  'RT-P1-COB-TL': 6127,
  'RT-P1-COB-ZP': 6127,
  'RT-P1-DIG-GD': 6127,
  'RT-P1-DIG-MX': 9482,
  'RT-P1-DIG-MY': 6127,
  'RT-P1-PRA-MX': 9190,
  'RT-P1-PRC-EM': 9190,
  'RT-P1-PRC-MX': 9190,
  'RT-P2-COB-AC': 3768,
  'RT-P2-COB-BR': 3768,
  'RT-P2-COB-MZ': 3768,
  'RT-P2-COB-OX': 3768,
  'RT-P2-COB-PH': 3768,
  'RT-P2-COB-PV': 3768,
  'RT-P2-COB-TJ': 3768,
  'RT-P3-COB-BR': 3768,
  'RT-P4-COB-CU': 3768,
  'RT-P4-COB-MZ': 0,
  'RT-P4-COB-ZP': 6127,
  'RT-PTE-GDL': 45000,
  'RT-TUC-GDL': 84000,
  'RT-TUV-GDL': 112000,
};

// Costo lookup map (for reference)
const COSTO_MAP: Record<string, number> = {
  'RT-BL-COB-MX': 1875,
  'RT-BP1-SEC1-01-NAUC': 50000,
  'RT-BP1-SEC1-02-NAUC': 50000,
  'RT-BP2-SEC1-01-NAUC': 35000,
  'RT-BP2-SEC1-02-NAUC': 35000,
  'RT-BP3-SEC1-01-NAUC': 40000,
  'RT-BP3-SEC1-02-NAUC': 40000,
  'RT-BP4-SEC1-01-NAUC': 30000,
  'RT-BP5-SEC1-01-NAUC': 22000,
  'RT-BP5-SEC1-02-NAUC': 22000,
  'RT-BP5-SEC1-03-NAUC': 22000,
  'RT-BP5-SEC1-04-NAUC': 22000,
  'RT-BP5-SEC2-01-NAUC': 22000,
  'RT-BP5-SEC2-02-NAUC': 22000,
  'RT-BP5-SEC2-03-NAUC': 22000,
  'RT-BP5-SEC2-04-NAUC': 22000,
  'RT-BP5-SEC3-01-NAUC': 22000,
  'RT-BP5-SEC3-02-NAUC': 22000,
  'RT-BP5-SEC3-03-NAUC': 22000,
  'RT-BP5-SEC3-04-NAUC': 22000,
  'RT-BP5-SEC4-01-NAUC': 22000,
  'RT-BP5-SEC4-02-NAUC': 22000,
  'RT-BP5-SEC4-03-NAUC': 22000,
  'RT-BP5-SEC4-04-NAUC': 22000,
  'RT-CDMX-DI-IT': 3,
  'RT-CDMX-PA-IT': 3,
  'RT-CDMX-WIFI': 3,
  'RT-CL-COB-BR': 2400,
  'RT-CL-COB-MX': 3400,
  'RT-CL-COB-PH': 2400,
  'RT-CL-COB-TJ': 2400,
  'RT-CL-PRA-MX': 4100,
  'RT-DIG-01-MR': 4100,
  'RT-DIG-01-MX': 5000,
  'RT-DIG-01-PB': 4100,
  'RT-DIG-02-MX': 5000,
  'RT-DIG-03-MX': 5000,
  'RT-DIG-04-MX': 5000,
  'RT-DIG-PRG-PB': 5000,
  'RT-ES-DIG-EM': 25000,
  'RT-GDL-WIFI': 3,
  'RT-GDL-WIFI-DIG': 3,
  'RT-KCD-GDL-FL': 23000,
  'RT-KCD-GDL-PER': 20000,
  'RT-KCS-AGS': 18000,
  'RT-KCS-AGS-PER': 14000,
  'RT-KCS-GDL': 20000,
  'RT-KCS-GDL-PER': 14000,
  'RT-KCS-LEN': 18000,
  'RT-KCS-LEN-PER': 14000,
  'RT-KCS-MEX-PER': 25000,
  'RT-KCS-MTY-PER': 20000,
  'RT-KCS-PH-PER': 14000,
  'RT-KCS-SLP': 18000,
  'RT-KCS-SLP-PER': 14000,
  'RT-KCS-VER-PER': 14000,
  'RT-KCS-ZAP': 20000,
  'RT-KCS-ZAP-FL': 14000,
  'RT-KCS-ZAP-PER': 14000,
  'RT-MMC-GDL-MA': 20000,
  'RT-MMC-GDL-MB': 15000,
  'RT-MMC-GDL-MC': 10000,
  'RT-MMC-GDL-MP': 2000,
  'RT-MMC-GDL-VE': 15000,
  'RT-MMC-GDL-VI': 20000,
  'RT-MTY-DI-IT': 3,
  'RT-MTY-PA-IT': 3,
  'RT-MTY-WIFI': 3,
  'RT-P1-COB-CH': 2400,
  'RT-P1-COB-CL': 2400,
  'RT-P1-COB-EM': 3400,
  'RT-P1-COB-GD': 3100,
  'RT-P1-COB-MR': 2400,
  'RT-P1-COB-MX': 3400,
  'RT-P1-COB-MY': 3100,
  'RT-P1-COB-PB': 2400,
  'RT-P1-COB-QR': 2400,
  'RT-P1-COB-SA': 2400,
  'RT-P1-COB-TL': 2400,
  'RT-P1-COB-ZP': 3100,
  'RT-P1-DIG-GD': 4000,
  'RT-P1-DIG-MX': 5000,
  'RT-P1-DIG-MY': 4000,
  'RT-P1-PRA-MX': 4100,
  'RT-P1-PRC-EM': 4100,
  'RT-P1-PRC-MX': 4100,
  'RT-P2-COB-AC': 2400,
  'RT-P2-COB-BR': 2400,
  'RT-P2-COB-MZ': 2400,
  'RT-P2-COB-OX': 2400,
  'RT-P2-COB-PH': 2400,
  'RT-P2-COB-PV': 2400,
  'RT-P2-COB-TJ': 2400,
  'RT-P3-COB-BR': 2400,
  'RT-P4-COB-CU': 2400,
  'RT-P4-COB-MZ': 2400,
  'RT-P4-COB-ZP': 3100,
  'RT-PTE-GDL': 20000,
  'RT-TUC-GDL': 50000,
  'RT-TUV-GDL': 50000,
};

// Formato auto-detection from article name
const getFormatoFromArticulo = (itemName: string): string => {
  if (!itemName) return '';
  const name = itemName.toUpperCase();
  if (name.includes('PARABUS')) return 'PARABUS';
  if (name.includes('CASETA DE TAXIS')) return 'CASETA DE TAXIS';
  if (name.includes('METROPOLITANO PARALELO')) return 'METROPOLITANO PARALELO';
  if (name.includes('METROPOLITANO PERPENDICULAR')) return 'METROPOLITANO PERPENDICULAR';
  if (name.includes('COLUMNA RECARGA')) return 'COLUMNA RECARGA';
  if (name.includes('MUPI DE PIEDRA')) return 'MUPI DE PIEDRA';
  if (name.includes('MUPI')) return 'MUPI';
  if (name.includes('COLUMNA')) return 'COLUMNA';
  if (name.includes('BOLERO')) return 'BOLERO';
  return '';
};

// Tipo auto-detection from article name (Tradicional or Digital)
const getTipoFromName = (itemName: string): 'Tradicional' | 'Digital' | '' => {
  if (!itemName) return '';
  const name = itemName.toUpperCase();
  if (name.includes('DIGITAL') || name.includes('DIG')) return 'Digital';
  if (name.includes('TRADICIONAL') || name.includes('RENTA')) return 'Tradicional';
  return '';
};

// Get tarifa and costo from ItemCode - exact match first, then default calculation
const getTarifaFromItemCode = (itemCode: string, caras: number = 1): { costo: number; tarifa_publica: number } => {
  if (!itemCode) return { costo: 0, tarifa_publica: 0 };

  const code = itemCode.toUpperCase().trim();

  // Check exact match in tarifa map
  if (TARIFA_PUBLICA_MAP[code] !== undefined) {
    const tarifa = TARIFA_PUBLICA_MAP[code];
    const costo = COSTO_MAP[code] || (caras * 650);
    return { costo, tarifa_publica: tarifa };
  }

  // Default calculation: caras * 650 for costo, caras * 850 for tarifa
  return { costo: caras * 650, tarifa_publica: caras * 850 };
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
  'ESTADO DE MEXICO': 'Estado de México',
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

// Some entries are state-level (no specific ciudad should be set)
const STATE_LEVEL_ENTRIES = ['CDMX', 'CIUDAD DE MEXICO', 'DF', 'ESTADO DE MEXICO', 'MEXICO'];

// Extract city from article name and return estado/ciudad
const getCiudadEstadoFromArticulo = (itemName: string): { estado: string; ciudad: string | null } | null => {
  if (!itemName) return null;
  const name = itemName.toUpperCase();

  for (const [ciudad, estado] of Object.entries(CIUDAD_ESTADO_MAP)) {
    if (name.includes(ciudad)) {
      // If this is a state-level entry, don't return a ciudad
      if (STATE_LEVEL_ENTRIES.includes(ciudad)) {
        return { estado, ciudad: null };
      }
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
  // Usar los campos correctos de Asesor
  ASESOR_U_IDAsesor: string;
  ASESOR_U_Asesor: string;
  T1_U_IDMarca: number;
  T2_U_Marca: string;
  T2_U_IDProducto: number;
  T2_U_Producto: string;
  T2_U_IDCategoria: number;
  T2_U_Categoria: string;
  ACA_U_SAPCode: string;
  ASESOR_U_SAPCode_Original?: number;
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
  editSolicitudId?: number;
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
        className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm transition-all ${value
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
                    className={`w-full px-3 py-2.5 text-left text-sm transition-colors border-b border-zinc-800/50 last:border-0 ${value && value[valueKey] === option[valueKey]
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
                      className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 transition-colors ${isSelected ? 'bg-purple-500/20 text-purple-300' : 'text-zinc-400 hover:bg-zinc-800'
                        }`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-purple-500 border-purple-500' : 'border-zinc-600'
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

export function CreateSolicitudModal({ isOpen, onClose, editSolicitudId }: Props) {
  const queryClient = useQueryClient();
  const isEditMode = !!editSolicitudId;

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
    tipo: '' as 'Tradicional' | 'Digital' | '',
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

  // Fetch existing solicitud data for edit mode
  const { data: editSolicitudData, isLoading: editDataLoading } = useQuery({
    queryKey: ['solicitud-edit', editSolicitudId],
    queryFn: () => solicitudesService.getFullDetails(editSolicitudId!),
    enabled: isOpen && isEditMode,
  });

  // State for forcing SAP refresh
  const [forceRefreshSap, setForceRefreshSap] = useState(0);

  // Environment for SAP endpoints
  const environment = useEnvironmentStore((state) => state.environment);
  const endpoints = getEndpoints('test'); // Forzar test por ahora
  const isTestMode = environment === 'test';

  // Fetch ALL CUIC data from SAP with cache
  const { data: cuicData, isLoading: cuicLoading, refetch: refetchCuic, isFetching: cuicFetching } = useQuery({
    queryKey: ['sap-cuic-all', forceRefreshSap],
    queryFn: async () => {
      // Try cache first (unless forcing refresh)
      if (forceRefreshSap === 0) {
        const cached = getSapCache<SAPCuicItem[]>(SAP_CACHE_KEYS.CUIC);
        if (cached && cached.length > 0) {
          return cached;
        }
      }
      // Fetch from SAP
      try {
        const response = await fetch(endpoints.cuic);
        if (!response.ok) throw new Error('Error fetching CUIC data');
        const data = await response.json();
        const items = (data.value || data) as SAPCuicItem[];
        // Save to cache
        if (items && items.length > 0) {
          setSapCache(SAP_CACHE_KEYS.CUIC, items);
        }
        return items;
      } catch (error) {
        // If fetch fails, try to return cached data
        const cached = getSapCache<SAPCuicItem[]>(SAP_CACHE_KEYS.CUIC);
        if (cached && cached.length > 0) {
          console.warn('SAP fetch failed, using cached data');
          return cached;
        }
        throw error;
      }
    },
    enabled: isOpen,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  // Fetch ALL articulos from SAP with cache
  const { data: articulosData, isLoading: articulosLoading, refetch: refetchArticulos, isFetching: articulosFetching } = useQuery({
    queryKey: ['sap-articulos-all', forceRefreshSap],
    queryFn: async () => {
      // Try cache first (unless forcing refresh)
      if (forceRefreshSap === 0) {
        const cached = getSapCache<SAPArticulo[]>(SAP_CACHE_KEYS.ARTICULOS);
        if (cached && cached.length > 0) {
          return cached;
        }
      }
      // Fetch from SAP
      try {
        const response = await fetch(endpoints.articulos);
        if (!response.ok) throw new Error('Error fetching articulos data');
        const data = await response.json();
        const items = (data.value || data) as SAPArticulo[];
        // Save to cache
        if (items && items.length > 0) {
          setSapCache(SAP_CACHE_KEYS.ARTICULOS, items);
        }
        return items;
      } catch (error) {
        // If fetch fails, try to return cached data
        const cached = getSapCache<SAPArticulo[]>(SAP_CACHE_KEYS.ARTICULOS);
        if (cached && cached.length > 0) {
          console.warn('SAP articulos fetch failed, using cached data');
          return cached;
        }
        throw error;
      }
    },
    enabled: isOpen,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  // Function to force refresh SAP data
  const handleRefreshSap = () => {
    clearSapCache();
    setForceRefreshSap(prev => prev + 1);
  };

  // Get cache timestamps for display
  const cuicCacheTime = getCacheTimestamp(SAP_CACHE_KEYS.CUIC);
  const articulosCacheTime = getCacheTimestamp(SAP_CACHE_KEYS.ARTICULOS);

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

  // Block body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Reset form when opening modal in create mode - set asignados to traficoUsers directly
  useEffect(() => {
    if (isOpen && !isEditMode) {
      // Reset all form state for a fresh start
      setStep(1);
      setSelectedCuic(null);
      // Set asignados to trafico users (or empty if not loaded yet)
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
      setNewCara({
        articulo: null,
        estado: '',
        ciudades: [],
        formato: '',
        tipo: '',
        nse: [],
        periodo: '',
        renta: 1,
        bonificacion: 0,
        tarifaPublica: 0,
      });
    }
  }, [isOpen, isEditMode, traficoUsers]);

  // Reset form state when switching between different solicitudes in edit mode
  useEffect(() => {
    if (isOpen && isEditMode && editSolicitudId) {
      // Reset state before loading new solicitud data
      setSelectedCuic(null);
      setSelectedAsignados([]);
      setNombreCampania('');
      setDescripcion('');
      setNotas('');
      setCaras([]);
      setArchivo(null);
      setTipoArchivo(null);
      setImu(false);
    }
  }, [editSolicitudId]);

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
    if (!newCara.articulo || !newCara.estado || !newCara.formato || !newCara.tipo || newCara.nse.length === 0 || !newCara.periodo) return;

    const [yearStr, catStr] = newCara.periodo.split('-');
    const catorcenaYear = parseInt(yearStr);
    const catorcenaNum = parseInt(catStr);

    const period = availablePeriods.find(p => p.a_o === catorcenaYear && p.numero_catorcena === catorcenaNum);
    if (!period) return;

    // Calculate descuento: if renta=100, bonif=10, then descuento is 10/(100+10) = 9.09%
    const totalCaras = newCara.renta + newCara.bonificacion;
    const descuento = totalCaras > 0 ? (newCara.bonificacion / totalCaras) : 0;
    const precioTotal = newCara.tarifaPublica * newCara.renta;

    const cara: CaraEntry = {
      id: `${Date.now()}-${Math.random()}`,
      articulo: newCara.articulo,
      estado: newCara.estado,
      ciudades: newCara.ciudades.length > 0 ? newCara.ciudades : filteredCiudades,
      formato: newCara.formato,
      tipo: newCara.tipo,
      nse: newCara.nse,
      catorcenaNum,
      catorcenaYear,
      periodoInicio: period.fecha_inicio,
      periodoFin: period.fecha_fin,
      renta: newCara.renta,
      bonificacion: newCara.bonificacion,
      tarifaPublica: newCara.tarifaPublica,
      descuento: descuento * 100, // Store as percentage
      precioTotal,
    };

    setCaras([...caras, cara]);

    // Auto expand the catorcena
    setExpandedCatorcenas(prev => new Set(prev).add(`${catorcenaYear}-${catorcenaNum}`));

    // Keep filter values intact, only reset quantities and period
    setNewCara({
      ...newCara,
      periodo: '',
      renta: 1,
      bonificacion: 0,
      // Keep articulo, estado, ciudades, formato, tipo, nse, tarifaPublica
    });
  };

  // Clear all new cara fields
  const handleClearNewCara = () => {
    setNewCara({
      articulo: null,
      estado: '',
      ciudades: [],
      formato: '',
      tipo: '',
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
    const totalCarasAll = totalRenta + totalBonificacion;
    // Tarifa Efectiva = Inversión Total / Total Caras (renta + bonificación)
    const tarifaEfectiva = totalCarasAll > 0 ? totalPrecio / totalCarasAll : 0;
    return { totalRenta, totalBonificacion, totalCaras: totalRenta, totalPrecio, tarifaEfectiva };
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

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: any) => solicitudesService.update(editSolicitudId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitudes'] });
      queryClient.invalidateQueries({ queryKey: ['solicitudes-stats'] });
      queryClient.invalidateQueries({ queryKey: ['solicitud-edit', editSolicitudId] });
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
    if (!selectedCuic || caras.length === 0 || !fechaInicio || !fechaFin || selectedAsignados.length === 0) {
      return;
    }

    const data = {
      cliente_id: selectedCuic.CUIC,
      cuic: selectedCuic.CUIC,
      razon_social: selectedCuic.T0_U_RazonSocial,
      unidad_negocio: selectedCuic.T1_U_UnidadNegocio,
      marca_id: selectedCuic.T1_U_IDMarca,
      marca_nombre: selectedCuic.T2_U_Marca,
      asesor: selectedCuic.ASESOR_U_Asesor,
      producto_id: selectedCuic.T2_U_IDProducto,
      producto_nombre: selectedCuic.T2_U_Producto,
      agencia: selectedCuic.T0_U_Agencia,
      categoria_id: selectedCuic.T2_U_IDCategoria,
      categoria_nombre: selectedCuic.T2_U_Categoria,
      card_code: selectedCuic.ACA_U_SAPCode,
      salesperson_code: selectedCuic.ASESOR_U_SAPCode_Original,
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
        articulo: c.articulo.ItemCode,
      })),
    };

    if (isEditMode) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  // Populate form when editing
  useEffect(() => {
    if (isEditMode && editSolicitudData && cuicData && articulosData && catorcenasData?.data) {
      const sol = editSolicitudData.solicitud;

      // Find the CUIC item from SAP data - cuic is stored as string, CUIC from SAP is number
      const solCuic = sol.cuic ? parseInt(sol.cuic, 10) : null;
      const cuicItem = cuicData.find(c => c.CUIC === solCuic);
      if (cuicItem) {
        setSelectedCuic(cuicItem);
      }

      // Set campaign data - nombre_campania might come from cotizacion
      const nombreCampania = editSolicitudData.cotizacion?.nombre_campania || editSolicitudData.campania?.nombre || '';
      setNombreCampania(nombreCampania);
      setDescripcion(sol.descripcion || '');
      setNotas(sol.notas || '');
      setImu(Boolean(sol.IMU));

      // Set asignados - parse from id_asignado and asignado strings
      if (sol.id_asignado && sol.asignado) {
        const ids = sol.id_asignado.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
        const nombres = sol.asignado.split(',').map(n => n.trim());
        const asignadosData = ids.map((id, idx) => ({
          id,
          nombre: nombres[idx] || '',
          area: '',
          puesto: ''
        }));
        setSelectedAsignados(asignadosData);
      } else {
        // No asignados in this solicitud - clear the state
        setSelectedAsignados([]);
      }

      // Load archivo from solicitud
      if (sol.archivo) {
        setArchivo(sol.archivo);
        setTipoArchivo(sol.tipo_archivo || null);
      }

      // Load catorcenas from cotizacion dates (like ViewSolicitudModal does)
      const cotizacion = editSolicitudData.cotizacion;
      if (cotizacion?.fecha_inicio && cotizacion?.fecha_fin) {
        const fechaInicioDate = new Date(cotizacion.fecha_inicio);
        const fechaFinDate = new Date(cotizacion.fecha_fin);

        const inicioCat = catorcenasData.data.find(c => {
          const cInicio = new Date(c.fecha_inicio);
          const cFin = new Date(c.fecha_fin);
          return fechaInicioDate >= cInicio && fechaInicioDate <= cFin;
        });

        const finCat = catorcenasData.data.find(c => {
          const cInicio = new Date(c.fecha_inicio);
          const cFin = new Date(c.fecha_fin);
          return fechaFinDate >= cInicio && fechaFinDate <= cFin;
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

      // Set caras from the fetched data
      if (editSolicitudData.caras && editSolicitudData.caras.length > 0) {
        const loadedCaras: CaraEntry[] = editSolicitudData.caras.map((cara, idx) => {
          const articulo = articulosData.find(a => a.ItemCode === cara.articulo) || {
            ItemCode: cara.articulo || '',
            ItemName: cara.articulo || ''
          };

          // Find matching catorcena from catorcenasData by matching dates
          let catNum = 1;
          let catYear = new Date().getFullYear();
          if (cara.inicio_periodo) {
            const initDate = new Date(cara.inicio_periodo);
            if (!isNaN(initDate.getTime())) {
              // Normalize date to compare (remove time component)
              const initDateStr = initDate.toISOString().split('T')[0];

              // Find catorcena that matches this period
              const matchingCat = catorcenasData.data.find(cat => {
                const catStartStr = new Date(cat.fecha_inicio).toISOString().split('T')[0];
                return catStartStr === initDateStr;
              });

              if (matchingCat) {
                catNum = matchingCat.numero_catorcena;
                catYear = matchingCat.a_o;
              } else {
                // Fallback: find catorcena where date falls within range
                const matchingRange = catorcenasData.data.find(cat => {
                  const catStart = new Date(cat.fecha_inicio);
                  const catEnd = new Date(cat.fecha_fin);
                  return initDate >= catStart && initDate <= catEnd;
                });
                if (matchingRange) {
                  catNum = matchingRange.numero_catorcena;
                  catYear = matchingRange.a_o;
                } else {
                  // Last fallback: use year from date
                  catYear = initDate.getFullYear();
                }
              }
            }
          }

          return {
            id: `edit-${idx}-${Date.now()}-${Math.random()}`,
            articulo,
            estado: cara.estados || '',
            ciudades: cara.ciudad ? cara.ciudad.split(', ').map(c => c.trim()) : [],
            formato: cara.formato || '',
            tipo: cara.tipo || '',
            nse: cara.nivel_socioeconomico ? cara.nivel_socioeconomico.split(',') : [],
            catorcenaNum: catNum,
            catorcenaYear: catYear,
            periodoInicio: cara.inicio_periodo || '',
            periodoFin: cara.fin_periodo || '',
            renta: Number(cara.caras) || 1,
            bonificacion: Number(cara.bonificacion) || 0,
            tarifaPublica: Number(cara.tarifa_publica) || 0,
            descuento: Number(cara.descuento) || 0,
            precioTotal: Number(cara.costo) || 0,
          };
        });
        setCaras(loadedCaras);

        // Auto-expand all catorcenas in edit mode so user can see them
        if (loadedCaras.length > 0) {
          const catKeys = new Set(loadedCaras.map(c => `${c.catorcenaYear}-${c.catorcenaNum}`));
          setExpandedCatorcenas(catKeys);
        }
      }
    }
  }, [isEditMode, editSolicitudData, cuicData, articulosData, catorcenasData]);

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
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-3">
              {isEditMode ? 'Editar Solicitud' : 'Nueva Solicitud'}
              {isTestMode && (
                <span className="text-xs px-2 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full">🧪 PRUEBAS</span>
              )}
            </h2>
            {/* SAP Status & Refresh */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-800 rounded-lg text-[10px]">
                <span className="text-zinc-500">CUIC:</span>
                <span className={cuicData && cuicData.length > 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {cuicData?.length || 0}
                </span>
                <span className="text-zinc-600">|</span>
                <span className="text-zinc-500">Art:</span>
                <span className={articulosData && articulosData.length > 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {articulosData?.length || 0}
                </span>
              </div>
              <button
                type="button"
                onClick={handleRefreshSap}
                disabled={cuicFetching || articulosFetching}
                className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
                title={`Refrescar datos SAP${cuicCacheTime ? `\nÚltima actualización: ${cuicCacheTime.toLocaleString()}` : ''}`}
              >
                <RefreshCw className={`h-4 w-4 text-zinc-400 ${(cuicFetching || articulosFetching) ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
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
              { num: 3, label: 'Asignar Caras', icon: MapPin },
              { num: 4, label: 'Resumen', icon: Layers },
            ].map((s, i) => (
              <React.Fragment key={s.num}>
                <button
                  onClick={() => setStep(s.num)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${step === s.num
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
        <div className="flex-1 overflow-y-auto overscroll-contain p-6">
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
                <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700/50">
                  {/* Header con CUIC destacado */}
                  <div className="flex items-start justify-between mb-3 pb-3 border-b border-zinc-700/50">
                    <div>
                      <span className="text-[10px] text-purple-400 uppercase tracking-wider">CUIC</span>
                      <div className="text-xl font-bold text-purple-400">{selectedCuic.CUIC}</div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Categoría</span>
                      <div className="text-sm font-medium text-amber-400">{selectedCuic.T2_U_Categoria || '-'}</div>
                    </div>
                  </div>

                  {/* Grid de información 2 columnas */}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Marca:</span>
                      <span className="text-white font-medium">{selectedCuic.T2_U_Marca || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Producto:</span>
                      <span className="text-white">{selectedCuic.T2_U_Producto || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Cliente:</span>
                      <span className="text-white">{selectedCuic.T0_U_Cliente || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Razón Social:</span>
                      <span className="text-white truncate max-w-[180px]" title={selectedCuic.T0_U_RazonSocial || '-'}>{selectedCuic.T0_U_RazonSocial || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Asesor:</span>
                      <span className="text-emerald-400 font-medium">{selectedCuic.ASESOR_U_Asesor || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Agencia:</span>
                      <span className="text-white">{selectedCuic.T0_U_Agencia || '-'}</span>
                    </div>
                    <div className="flex justify-between col-span-2">
                      <span className="text-zinc-500">Unidad de Negocio:</span>
                      <span className="text-white">{selectedCuic.T1_U_UnidadNegocio || '-'}</span>
                    </div>
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
              {/* KPIs Totales */}
              <div className="p-4 bg-purple-500/10 rounded-xl border border-purple-500/30">
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">{totals.totalRenta}</div>
                    <div className="text-xs text-zinc-400">Renta</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-emerald-400">{totals.totalBonificacion}</div>
                    <div className="text-xs text-zinc-400">Bonificación</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-400">{totals.totalRenta + totals.totalBonificacion}</div>
                    <div className="text-xs text-zinc-400">Total Caras</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-amber-400">{formatCurrency(totals.totalPrecio)}</div>
                    <div className="text-xs text-zinc-400">Inversión</div>
                  </div>
                </div>
              </div>

              {/* Add cara form */}
              <div className="p-4 bg-zinc-800/30 rounded-xl border border-zinc-700/50">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <Plus className="h-4 w-4 text-purple-400" />
                  Agregar Cara
                </h3>

                {/* Row 1: Articulo SAP */}
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
                      // Auto-set formato from ItemName
                      const formato = getFormatoFromArticulo(item.ItemName);
                      // Auto-set tipo from ItemName
                      const tipo = getTipoFromName(item.ItemName);

                      setNewCara({
                        ...newCara,
                        articulo: item,
                        tarifaPublica: tarifa.tarifa_publica,
                        estado: ciudadEstado?.estado || newCara.estado,
                        ciudades: ciudadEstado?.ciudad ? [ciudadEstado.ciudad] : newCara.ciudades,
                        formato: formato || newCara.formato,
                        tipo: tipo || newCara.tipo,
                      });
                    }}
                    onClear={() => setNewCara({ ...newCara, articulo: null, tarifaPublica: 0, estado: '', ciudades: [], formato: '', tipo: '' })}
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
                </div>

                {/* Row 2: Estado, Ciudad (opcional), Formato, Tipo */}
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {/* Estado */}
                  <div>
                    <label className="text-xs text-zinc-500">Estado</label>
                    <select
                      value={newCara.estado}
                      onChange={(e) => setNewCara({ ...newCara, estado: e.target.value, ciudades: [] })}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    >
                      <option value="">Seleccionar</option>
                      {inventarioFilters?.estados.map(e => (
                        <option key={e} value={e}>{e}</option>
                      ))}
                    </select>
                  </div>

                  {/* Ciudad (opcional) */}
                  <div>
                    <label className="text-xs text-zinc-500">Ciudad (opcional)</label>
                    <MultiSelectTags
                      label="ciudad"
                      options={filteredCiudades.map(c => ({ ciudad: c }))}
                      selected={newCara.ciudades.map(c => ({ ciudad: c }))}
                      onChange={(items) => setNewCara({ ...newCara, ciudades: items.map(i => i.ciudad) })}
                      displayKey="ciudad"
                      valueKey="ciudad"
                      searchKey="ciudad"
                    />
                  </div>

                  {/* Formato */}
                  <div>
                    <label className="text-xs text-zinc-500">Formato</label>
                    <select
                      value={newCara.formato}
                      onChange={(e) => setNewCara({ ...newCara, formato: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    >
                      <option value="">Seleccionar</option>
                      {filteredFormatos.map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                      {inventarioFilters?.formatos.filter(f => !filteredFormatos.includes(f)).map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>

                  {/* Tipo (selector con autocompletado) */}
                  <div>
                    <label className="text-xs text-zinc-500">Tipo</label>
                    <select
                      value={newCara.tipo}
                      onChange={(e) => setNewCara({ ...newCara, tipo: e.target.value as 'Tradicional' | 'Digital' | '' })}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    >
                      <option value="">Seleccionar</option>
                      <option value="Tradicional">Tradicional</option>
                      <option value="Digital">Digital</option>
                    </select>
                  </div>
                </div>

                {/* Row 3: Periodo, Renta, Bonificación, Tarifa Pública */}
                <div className="grid grid-cols-4 gap-3 mb-4">
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
                    <label className="text-xs text-zinc-500">Renta</label>
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

                  {/* Tarifa Publica - Editable */}
                  <div>
                    <label className="text-xs text-zinc-500">Tarifa Pública</label>
                    <input
                      type="number"
                      value={newCara.tarifaPublica || ''}
                      onChange={(e) => setNewCara({ ...newCara, tarifaPublica: parseFloat(e.target.value) || 0 })}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-emerald-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                  </div>
                </div>

                {/* Row 4: NSE */}
                <div className="mb-4">
                  <label className="text-xs text-zinc-500">Nivel Socioeconómico</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {inventarioFilters?.nse.map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => toggleNse(n)}
                        className={`px-3 py-1 rounded-full text-xs transition-all ${newCara.nse.includes(n)
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                          : 'bg-zinc-700/50 text-zinc-400 border border-zinc-600/50 hover:border-zinc-500'
                          }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview calculation */}
                {newCara.renta > 0 && newCara.tarifaPublica > 0 && (
                  <div className="mt-4 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/30 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-400">Inversión (Tarifa Cliente):</span>
                      <span className="text-zinc-300">
                        {newCara.renta} caras × {formatCurrency(newCara.tarifaPublica)} = <span className="text-emerald-400 font-medium">{formatCurrency(newCara.renta * newCara.tarifaPublica)}</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-400">Caras Totales:</span>
                      <span className="text-zinc-300">
                        {newCara.renta} caras + {newCara.bonificacion} bonif. = <span className="text-blue-400 font-medium">{newCara.renta + newCara.bonificacion} caras totales</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-400">Tarifa Efectiva:</span>
                      <span className="text-zinc-300">
                        {formatCurrency(newCara.renta * newCara.tarifaPublica)} ÷ {newCara.renta + newCara.bonificacion} = <span className="text-purple-400 font-medium">{formatCurrency((newCara.renta * newCara.tarifaPublica) / (newCara.renta + newCara.bonificacion))}</span>
                      </span>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleAddCara}
                    disabled={!newCara.articulo || !newCara.estado || !newCara.formato || !newCara.tipo || newCara.nse.length === 0 || !newCara.periodo}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Agregar Cara
                  </button>
                  <button
                    type="button"
                    onClick={handleClearNewCara}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg text-sm font-medium transition-colors"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Limpiar Campos
                  </button>
                </div>
              </div>

              {/* Caras table - grouped by catorcena */}
              <div className="rounded-xl border border-zinc-700/50 overflow-hidden">
                {groupedCaras.length === 0 ? (
                  <div className="px-4 py-8 text-center text-zinc-500 text-sm">
                    No hay caras agregadas
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
                              <span className="text-xs text-zinc-500">({items.length} caras)</span>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <span className="text-zinc-400">{groupRenta} renta</span>
                              <span className="text-emerald-400">{groupBonif} bonif.</span>
                              <span className="text-amber-400 font-medium">{formatCurrency(groupTotal)}</span>
                            </div>
                          </button>

                          {/* Expanded items */}
                          {isExpanded && (
                            <div className="bg-zinc-900/50 overflow-x-auto">
                              <table className="w-full min-w-[900px]">
                                <thead>
                                  <tr className="bg-zinc-800/30">
                                    <th className="px-2 py-2 text-left text-[10px] font-semibold text-zinc-500">Artículo</th>
                                    <th className="px-2 py-2 text-left text-[10px] font-semibold text-zinc-500">Ciudad</th>
                                    <th className="px-2 py-2 text-left text-[10px] font-semibold text-zinc-500">Tipo</th>
                                    <th className="px-2 py-2 text-left text-[10px] font-semibold text-zinc-500">Formato</th>
                                    <th className="px-2 py-2 text-center text-[10px] font-semibold text-zinc-500">Caras</th>
                                    <th className="px-2 py-2 text-center text-[10px] font-semibold text-zinc-500">Bonif.</th>
                                    <th className="px-2 py-2 text-center text-[10px] font-semibold text-zinc-500">Total</th>
                                    <th className="px-2 py-2 text-right text-[10px] font-semibold text-zinc-500">Tarifa Púb.</th>
                                    <th className="px-2 py-2 text-right text-[10px] font-semibold text-zinc-500">Precio Total</th>
                                    <th className="px-2 py-2 text-center text-[10px] font-semibold text-zinc-500"></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {items.map((cara) => {
                                    const totalCaras = cara.renta + cara.bonificacion;
                                    const precioTotal = cara.tarifaPublica * cara.renta;
                                    const tarifaEfectiva = totalCaras > 0 ? precioTotal / totalCaras : 0;
                                    const descuento = totalCaras > 0 ? ((cara.bonificacion / totalCaras) * 100) : 0;

                                    return (
                                      <tr key={cara.id} className="border-t border-zinc-800/50 hover:bg-zinc-800/20">
                                        <td className="px-2 py-2 text-xs text-white max-w-[140px]" title={`${cara.articulo.ItemCode} - ${cara.articulo.ItemName}`}>
                                          <div className="truncate font-medium">{cara.articulo.ItemCode}</div>
                                          <div className="truncate text-[10px] text-zinc-500">{cara.articulo.ItemName}</div>
                                        </td>
                                        <td className="px-2 py-2 text-xs text-zinc-300 max-w-[80px] truncate" title={`${cara.estado} - ${cara.ciudades.join(', ')}`}>
                                          {cara.ciudades.join(', ')}
                                        </td>
                                        <td className="px-2 py-2">
                                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${cara.tipo === 'Digital' ? 'bg-blue-500/20 text-blue-300' : 'bg-amber-500/20 text-amber-300'
                                            }`}>
                                            {cara.tipo}
                                          </span>
                                        </td>
                                        <td className="px-2 py-2 text-xs text-zinc-300">{cara.formato}</td>
                                        <td className="px-2 py-2 text-xs text-center text-white">{cara.renta}</td>
                                        <td className="px-2 py-2 text-xs text-center text-emerald-400">{cara.bonificacion}</td>
                                        <td className="px-2 py-2 text-xs text-center text-white font-medium">{totalCaras}</td>
                                        <td className="px-2 py-2 text-xs text-right text-zinc-300">{formatCurrency(cara.tarifaPublica)}</td>
                                        <td className="px-2 py-2 text-xs text-right text-emerald-400 font-medium">{formatCurrency(precioTotal)}</td>
                                        <td className="px-2 py-2 text-center">
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveCara(cara.id)}
                                            className="p-1 hover:bg-red-500/20 rounded text-red-400 text-[10px]"
                                            title="Eliminar"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })}
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
                          <span className="text-emerald-400">{totals.totalBonificacion} bonif.</span>
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
                      <span className="text-zinc-500 text-sm">Caras:</span>
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
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">{totals.totalRenta}</div>
                    <div className="text-xs text-zinc-400">Renta</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-emerald-400">{totals.totalBonificacion}</div>
                    <div className="text-xs text-zinc-400">Bonificación</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-400">{totals.totalRenta + totals.totalBonificacion}</div>
                    <div className="text-xs text-zinc-400">Total Caras</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-amber-400">{formatCurrency(totals.totalPrecio)}</div>
                    <div className="text-xs text-zinc-400">Inversión</div>
                  </div>
                </div>
              </div>

              {/* Resumen de Catorcenas y Artículos */}
              <div className="rounded-xl border border-zinc-700/50 overflow-hidden">
                <div className="px-4 py-3 bg-zinc-800/50 border-b border-zinc-700/50">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-purple-400" />
                    Desglose por Catorcenas
                  </h3>
                </div>
                {groupedCaras.length === 0 ? (
                  <div className="px-4 py-6 text-center text-zinc-500 text-sm">
                    No hay caras agregadas
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-700/50">
                    {groupedCaras.map(([key, items]) => {
                      const [year, cat] = key.split('-');
                      const groupTotal = items.reduce((acc, c) => acc + c.precioTotal, 0);
                      const groupRenta = items.reduce((acc, c) => acc + c.renta, 0);
                      const groupBonif = items.reduce((acc, c) => acc + c.bonificacion, 0);

                      // Group by articulo within this catorcena
                      const byArticulo = items.reduce((acc, cara) => {
                        const artKey = cara.articulo.ItemCode;
                        if (!acc[artKey]) {
                          acc[artKey] = {
                            articulo: cara.articulo,
                            renta: 0,
                            bonificacion: 0,
                            precioTotal: 0,
                            items: []
                          };
                        }
                        acc[artKey].renta += cara.renta;
                        acc[artKey].bonificacion += cara.bonificacion;
                        acc[artKey].precioTotal += cara.precioTotal;
                        acc[artKey].items.push(cara);
                        return acc;
                      }, {} as Record<string, { articulo: any; renta: number; bonificacion: number; precioTotal: number; items: any[] }>);

                      return (
                        <div key={key} className="bg-zinc-900/30">
                          {/* Catorcena header */}
                          <div className="flex items-center justify-between px-4 py-3 bg-zinc-800/30">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white">Catorcena {cat} / {year}</span>
                              <span className="text-xs text-zinc-500">({Object.keys(byArticulo).length} artículos)</span>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <span className="text-zinc-400">{groupRenta} renta</span>
                              <span className="text-emerald-400">{groupBonif} bonif.</span>
                              <span className="text-amber-400 font-medium">{formatCurrency(groupTotal)}</span>
                            </div>
                          </div>
                          {/* Artículos dentro de esta catorcena */}
                          <div className="px-4 py-2 space-y-1">
                            {Object.entries(byArticulo).map(([artCode, data]) => (
                              <div key={artCode} className="flex items-center justify-between py-1.5 px-3 bg-zinc-800/20 rounded-lg">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-purple-400 font-medium">{data.articulo.ItemCode}</span>
                                  <span className="text-xs text-zinc-400 truncate max-w-[200px]">{data.articulo.ItemName}</span>
                                </div>
                                <div className="flex items-center gap-3 text-xs">
                                  <span className="text-white">{data.renta} renta</span>
                                  <span className="text-emerald-400">{data.bonificacion} bonif.</span>
                                  <span className="text-amber-400">{formatCurrency(data.precioTotal)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
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
                {archivo ? (
                  <div className="flex items-center gap-3 p-3 bg-zinc-800 border border-emerald-500/30 rounded-xl">
                    {tipoArchivo?.startsWith('image/') ? (
                      <img src={archivo} alt="Preview" className="w-16 h-16 object-cover rounded-lg" />
                    ) : (
                      <div className="w-16 h-16 flex items-center justify-center bg-zinc-700 rounded-lg">
                        <FileText className="h-6 w-6 text-zinc-400" />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="text-sm text-emerald-400 font-medium">Archivo cargado</div>
                      <div className="text-xs text-zinc-500">{tipoArchivo}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setArchivo(null); setTipoArchivo(null); }}
                      className="p-2 hover:bg-red-500/20 rounded-lg text-red-400"
                      title="Eliminar archivo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <input
                    type="file"
                    onChange={handleFileChange}
                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-500 file:text-white hover:file:bg-purple-600"
                  />
                )}
              </div>

              {/* IMU checkbox */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={imu}
                  onChange={(e) => setImu(e.target.checked)}
                  className="checkbox-purple w-5 h-5"
                />
                <span className="text-sm text-zinc-300">IMU (Impresión  IMU)</span>
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
              disabled={(isEditMode ? updateMutation.isPending : createMutation.isPending) || !selectedCuic || caras.length === 0 || selectedAsignados.length === 0}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:bg-zinc-700 disabled:text-zinc-500 transition-colors flex items-center gap-2"
              title={selectedAsignados.length === 0 ? 'Debes asignar al menos un usuario' : undefined}
            >
              {(isEditMode ? updateMutation.isPending : createMutation.isPending) ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  {isEditMode ? 'Guardando...' : 'Creando...'}
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  {isEditMode ? 'Guardar Cambios' : 'Crear Solicitud'}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
