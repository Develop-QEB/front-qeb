import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Plus, Pencil, Trash2, Eye, History, Building2,
  Phone, Mail, MapPin, Globe, X, FileText, Calendar, Tag, CheckCircle, Clock, Users, Loader2,
  Filter, Layers, ArrowUpDown, ArrowUp, ArrowDown, Check, ChevronDown, ChevronRight
} from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { proveedoresService, ProveedorInput } from '../../services/proveedores.service';
import { Proveedor } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { getPermissions } from '../../lib/permissions';
import { useThemeStore } from '../../store/themeStore';

// ============ TIPOS Y CONFIGURACION DE FILTROS/ORDENAMIENTO ============
type FilterOperator = '=' | '!=' | 'contains' | 'not_contains';

interface FilterCondition {
  id: string;
  field: string;
  operator: FilterOperator;
  value: string;
}

interface FilterFieldConfig {
  field: keyof Proveedor;
  label: string;
  type: 'string' | 'number';
}

// Campos disponibles para filtrar/ordenar
const FILTER_FIELDS: FilterFieldConfig[] = [
  { field: 'nombre', label: 'Nombre', type: 'string' },
  { field: 'categoria', label: 'Categoria', type: 'string' },
  { field: 'ciudad', label: 'Ciudad', type: 'string' },
  { field: 'estado', label: 'Estado', type: 'string' },
  { field: 'contacto_principal', label: 'Contacto', type: 'string' },
];

// Campos disponibles para agrupar
type GroupByField = 'categoria' | 'ciudad' | 'estado';

interface GroupConfig {
  field: GroupByField;
  label: string;
}

const AVAILABLE_GROUPINGS: GroupConfig[] = [
  { field: 'categoria', label: 'Categoria' },
  { field: 'ciudad', label: 'Ciudad' },
  { field: 'estado', label: 'Estado' },
];

const OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: '=', label: 'Igual a' },
  { value: '!=', label: 'Diferente de' },
  { value: 'contains', label: 'Contiene' },
  { value: 'not_contains', label: 'No contiene' },
];

// Funcion para aplicar filtros a los datos
function applyFilters(data: Proveedor[], filters: FilterCondition[]): Proveedor[] {
  if (filters.length === 0) return data;

  return data.filter(item => {
    return filters.every(filter => {
      const fieldValue = item[filter.field as keyof Proveedor];
      const filterValue = filter.value;

      if (fieldValue === null || fieldValue === undefined) {
        return filter.operator === '!=' || filter.operator === 'not_contains';
      }

      const strValue = String(fieldValue).toLowerCase();
      const strFilterValue = filterValue.toLowerCase();

      switch (filter.operator) {
        case '=':
          return strValue === strFilterValue;
        case '!=':
          return strValue !== strFilterValue;
        case 'contains':
          return strValue.includes(strFilterValue);
        case 'not_contains':
          return !strValue.includes(strFilterValue);
        default:
          return true;
      }
    });
  });
}

// Grouped Table Row Header
function GroupHeader({
  groupName,
  count,
  expanded,
  onToggle,
  level = 1,
  isDark
}: {
  groupName: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  level?: 1 | 2;
  isDark: boolean;
}) {
  const isLevel1 = level === 1;
  return (
    <tr
      onClick={onToggle}
      className={`border-b cursor-pointer transition-colors ${
        isLevel1
          ? `${isDark ? 'bg-purple-500/10 border-purple-500/20 hover:bg-purple-500/20' : 'bg-purple-50 border-purple-200 hover:bg-purple-100'}`
          : `${isDark ? 'bg-fuchsia-500/5 border-fuchsia-500/10 hover:bg-fuchsia-500/10' : 'bg-fuchsia-50 border-fuchsia-200 hover:bg-fuchsia-100'}`
      }`}
    >
      <td colSpan={7} className={`px-5 py-3 ${isLevel1 ? '' : 'pl-10'}`}>
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className={`h-4 w-4 ${isLevel1 ? 'text-purple-400' : 'text-fuchsia-400'}`} />
          ) : (
            <ChevronRight className={`h-4 w-4 ${isLevel1 ? 'text-purple-400' : 'text-fuchsia-400'}`} />
          )}
          <span className={`font-semibold ${isLevel1 ? (isDark ? 'text-white' : 'text-gray-900') : (isDark ? 'text-zinc-200 text-sm' : 'text-gray-700 text-sm')}`}>
            {groupName || 'Sin asignar'}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-xs ${
            isLevel1
              ? (isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700')
              : (isDark ? 'bg-fuchsia-500/20 text-fuchsia-300' : 'bg-fuchsia-100 text-fuchsia-700')
          }`}>
            {count} {count === 1 ? 'proveedor' : 'proveedores'}
          </span>
        </div>
      </td>
    </tr>
  );
}

// Info Item Component for Details Modal
function InfoItem({ icon: Icon, label, value, isLink, isDark }: { icon: React.ElementType; label: string; value: string | null | undefined; isLink?: boolean; isDark: boolean }) {
  return (
    <div className={`p-4 rounded-xl ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50'} border ${isDark ? 'border-purple-500/20' : 'border-gray-200'} hover:border-purple-500/40 transition-colors`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-purple-400" />
        <span className={`text-xs font-medium ${isDark ? 'text-purple-300/70' : 'text-purple-600'} uppercase tracking-wider`}>{label}</span>
      </div>
      {isLink && value ? (
        <a href={value.startsWith('http') ? value : `https://${value}`} target="_blank" rel="noopener noreferrer" className="text-sm text-fuchsia-400 hover:text-fuchsia-300 hover:underline transition-colors">
          {value}
        </a>
      ) : (
        <p className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'} font-medium`}>{value || '-'}</p>
      )}
    </div>
  );
}

// Details Modal Component
function DetailsModal({
  proveedor,
  onClose,
}: {
  proveedor: Proveedor;
  onClose: () => void;
}) {
  const isDark = useThemeStore((s) => s.theme) === 'dark';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative z-50 w-full max-w-2xl bg-gradient-to-br ${isDark ? 'from-zinc-900 via-purple-950/20 to-zinc-900' : 'from-white via-purple-50/10 to-white'} border ${isDark ? 'border-purple-500/30' : 'border-gray-200'} rounded-2xl shadow-2xl shadow-purple-500/10 max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-purple-500/20' : 'border-gray-200'} bg-gradient-to-r ${isDark ? 'from-purple-900/40 via-fuchsia-900/30 to-purple-900/40' : 'from-purple-50 via-fuchsia-50/50 to-purple-50'}`}>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/30 to-fuchsia-500/30 border border-purple-500/30">
              <Building2 className={`h-6 w-6 ${isDark ? 'text-purple-300' : 'text-purple-700'}`} />
            </div>
            <div>
              <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{proveedor.nombre}</h2>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium mt-1 ${
                proveedor.estado === 'activo'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30'
              }`}>
                {proveedor.estado === 'activo' ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                {proveedor.estado || 'Sin estado'}
              </span>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 ${isDark ? 'hover:bg-purple-500/20' : 'hover:bg-purple-100'} rounded-xl transition-colors group`}>
            <X className={`h-5 w-5 ${isDark ? 'text-purple-300' : 'text-purple-700'} group-hover:text-white transition-colors`} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
          {/* Contact Info */}
          <div className="grid grid-cols-2 gap-4">
            <InfoItem icon={Tag} label="Categoria" value={proveedor.categoria} isDark={isDark} />
            <InfoItem icon={Users} label="Contacto Principal" value={proveedor.contacto_principal} isDark={isDark} />
            <InfoItem icon={Phone} label="Telefono" value={proveedor.telefono} isDark={isDark} />
            <InfoItem icon={Mail} label="Email" value={proveedor.email} isDark={isDark} />
            <InfoItem icon={Globe} label="Sitio Web" value={proveedor.sitio_web} isLink isDark={isDark} />
            <InfoItem icon={Calendar} label="Fecha de Alta" value={proveedor.fecha_alta ? new Date(proveedor.fecha_alta).toLocaleDateString() : null} isDark={isDark} />
          </div>

          {/* Address */}
          <div className={`p-5 rounded-xl ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50'} border ${isDark ? 'border-purple-500/20' : 'border-gray-200'}`}>
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="h-4 w-4 text-purple-400" />
              <span className={`text-sm font-medium ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>Direccion</span>
            </div>
            <p className={`${isDark ? 'text-white' : 'text-gray-900'} font-medium`}>{proveedor.direccion || '-'}</p>
            <p className={`${isDark ? 'text-purple-300/70' : 'text-purple-600'} text-sm mt-1`}>
              {proveedor.ciudad && `${proveedor.ciudad}`}
              {proveedor.codigo_postal && `, CP ${proveedor.codigo_postal}`}
            </p>
          </div>

          {/* Notes */}
          {proveedor.notas && (
            <div className={`p-5 rounded-xl ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50'} border ${isDark ? 'border-purple-500/20' : 'border-gray-200'}`}>
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-purple-400" />
                <span className={`text-sm font-medium ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>Notas</span>
              </div>
              <p className={`${isDark ? 'text-zinc-300' : 'text-gray-600'} text-sm whitespace-pre-wrap leading-relaxed`}>{proveedor.notas}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// History Modal Component
function HistoryModal({
  proveedorId,
  proveedorName,
  onClose,
}: {
  proveedorId: number;
  proveedorName: string;
  onClose: () => void;
}) {
  const isDark = useThemeStore((s) => s.theme) === 'dark';

  const { data, isLoading } = useQuery({
    queryKey: ['proveedor-history', proveedorId],
    queryFn: () => proveedoresService.getHistory(proveedorId),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative z-50 w-full max-w-2xl bg-gradient-to-br ${isDark ? 'from-zinc-900 via-purple-950/20 to-zinc-900' : 'from-white via-purple-50/10 to-white'} border ${isDark ? 'border-purple-500/30' : 'border-gray-200'} rounded-2xl shadow-2xl shadow-purple-500/10 max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-purple-500/20' : 'border-gray-200'} bg-gradient-to-r ${isDark ? 'from-purple-900/40 via-fuchsia-900/30 to-purple-900/40' : 'from-purple-50 via-fuchsia-50/50 to-purple-50'}`}>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-fuchsia-500/30 to-purple-500/30 border border-fuchsia-500/30">
              <History className="h-6 w-6 text-fuchsia-300" />
            </div>
            <div>
              <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Historial</h2>
              <p className={`text-sm ${isDark ? 'text-purple-300/70' : 'text-purple-600'}`}>{proveedorName}</p>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 ${isDark ? 'hover:bg-purple-500/20' : 'hover:bg-purple-100'} rounded-xl transition-colors group`}>
            <X className={`h-5 w-5 ${isDark ? 'text-purple-300' : 'text-purple-700'} group-hover:text-white transition-colors`} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-10 w-10 text-purple-400 animate-spin mb-4" />
              <p className={`${isDark ? 'text-purple-300/70' : 'text-purple-600'} text-sm`}>Cargando historial...</p>
            </div>
          ) : data && data.tareas.length > 0 ? (
            <div className="space-y-3">
              <div className={`text-sm ${isDark ? 'text-purple-300/70' : 'text-purple-600'} mb-4 flex items-center gap-2`}>
                <span className={`px-2 py-1 rounded-lg ${isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'} font-semibold`}>{data.totalTareas}</span>
                tarea{data.totalTareas !== 1 ? 's' : ''} encontrada{data.totalTareas !== 1 ? 's' : ''}
              </div>
              {data.tareas.map((tarea, index) => (
                <div
                  key={tarea.id}
                  className={`p-4 rounded-xl ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50'} border ${isDark ? 'border-purple-500/20' : 'border-gray-200'} hover:border-purple-500/40 transition-all hover:shadow-lg hover:shadow-purple-500/5`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h4 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{tarea.titulo || 'Sin titulo'}</h4>
                      <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'} mt-1 line-clamp-2`}>{tarea.descripcion || 'Sin descripcion'}</p>
                      {tarea.campania && (
                        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-fuchsia-500/20 to-purple-500/20 border border-fuchsia-500/30">
                          <Tag className="h-3.5 w-3.5 text-fuchsia-400" />
                          <span className="text-xs font-medium text-fuchsia-300">{tarea.campania.nombre}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                        tarea.estatus === 'completada' || tarea.estatus === 'Completada'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : tarea.estatus === 'en_proceso' || tarea.estatus === 'En proceso'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30'
                      }`}>
                        {tarea.estatus || 'Sin estado'}
                      </span>
                      <p className={`text-xs ${isDark ? 'text-purple-300/50' : 'text-purple-500'} mt-2`}>
                        {new Date(tarea.fecha_inicio).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full ${isDark ? 'bg-purple-500/10' : 'bg-purple-50'} mb-4`}>
                <History className="h-10 w-10 text-purple-500/50" />
              </div>
              <p className={`${isDark ? 'text-purple-300' : 'text-purple-700'} font-medium`}>Sin historial</p>
              <p className={`${isDark ? 'text-purple-300/50' : 'text-purple-500'} text-sm mt-1`}>Este proveedor no tiene tareas asociadas</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Form Modal Component - Redesigned
function FormModal({
  proveedor,
  onClose,
  onSubmit,
  loading,
}: {
  proveedor: Proveedor | null;
  onClose: () => void;
  onSubmit: (data: ProveedorInput) => void;
  loading: boolean;
}) {
  const isDark = useThemeStore((s) => s.theme) === 'dark';

  const [form, setForm] = useState<ProveedorInput>({
    nombre: '',
    categoria: '',
    estado: 'activo',
    contacto_principal: '',
    telefono: '',
    email: '',
    sitio_web: '',
    direccion: '',
    ciudad: '',
    codigo_postal: '',
    notas: '',
  });

  useEffect(() => {
    if (proveedor) {
      setForm({
        nombre: proveedor.nombre || '',
        categoria: proveedor.categoria || '',
        estado: proveedor.estado || 'activo',
        contacto_principal: proveedor.contacto_principal || '',
        telefono: proveedor.telefono || '',
        email: proveedor.email || '',
        sitio_web: proveedor.sitio_web || '',
        direccion: proveedor.direccion || '',
        ciudad: proveedor.ciudad || '',
        codigo_postal: proveedor.codigo_postal || '',
        notas: proveedor.notas || '',
      });
    }
  }, [proveedor]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  const inputClasses = `w-full px-4 py-3 rounded-xl ${isDark ? 'bg-zinc-800/80' : 'bg-white'} border ${isDark ? 'border-purple-500/20' : 'border-gray-300'} ${isDark ? 'text-white' : 'text-gray-900'} ${isDark ? 'placeholder:text-zinc-500' : 'placeholder:text-gray-400'} focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all hover:border-purple-500/40`;
  const labelClasses = `block text-sm font-medium ${isDark ? 'text-purple-300' : 'text-purple-700'} mb-2`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative z-50 w-full max-w-2xl bg-gradient-to-br ${isDark ? 'from-zinc-900 via-purple-950/20 to-zinc-900' : 'from-white via-purple-50/10 to-white'} border ${isDark ? 'border-purple-500/30' : 'border-gray-200'} rounded-2xl shadow-2xl shadow-purple-500/10 max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-purple-500/20' : 'border-gray-200'} bg-gradient-to-r ${isDark ? 'from-purple-900/40 via-fuchsia-900/30 to-purple-900/40' : 'from-purple-50 via-fuchsia-50/50 to-purple-50'}`}>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/30 to-fuchsia-500/30 border border-purple-500/30">
              {proveedor ? <Pencil className={`h-6 w-6 ${isDark ? 'text-purple-300' : 'text-purple-700'}`} /> : <Plus className={`h-6 w-6 ${isDark ? 'text-purple-300' : 'text-purple-700'}`} />}
            </div>
            <div>
              <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {proveedor ? 'Editar Proveedor' : 'Nuevo Proveedor'}
              </h2>
              <p className={`text-sm ${isDark ? 'text-purple-300/70' : 'text-purple-600'}`}>
                {proveedor ? 'Modifica los datos del proveedor' : 'Agrega un nuevo proveedor al sistema'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 ${isDark ? 'hover:bg-purple-500/20' : 'hover:bg-purple-100'} rounded-xl transition-colors group`}>
            <X className={`h-5 w-5 ${isDark ? 'text-purple-300' : 'text-purple-700'} group-hover:text-white transition-colors`} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[65vh]">
          <div className="space-y-6">
            {/* Basic Info Section */}
            <div>
              <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Informacion Basica
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={labelClasses}>Nombre *</label>
                  <input
                    type="text"
                    required
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    placeholder="Nombre del proveedor"
                    className={inputClasses}
                  />
                </div>

                <div>
                  <label className={labelClasses}>Categoria *</label>
                  <input
                    type="text"
                    required
                    value={form.categoria}
                    onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                    placeholder="Ej: Imprenta, Servicios..."
                    className={inputClasses}
                  />
                </div>

                <div>
                  <label className={labelClasses}>Estado</label>
                  <select
                    value={form.estado}
                    onChange={(e) => setForm({ ...form, estado: e.target.value as 'activo' | 'inactivo' })}
                    className={inputClasses}
                  >
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Contact Section */}
            <div>
              <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Contacto
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClasses}>Contacto Principal *</label>
                  <input
                    type="text"
                    required
                    value={form.contacto_principal}
                    onChange={(e) => setForm({ ...form, contacto_principal: e.target.value })}
                    placeholder="Nombre del contacto"
                    className={inputClasses}
                  />
                </div>

                <div>
                  <label className={labelClasses}>Telefono *</label>
                  <input
                    type="text"
                    required
                    value={form.telefono}
                    onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                    placeholder="(123) 456-7890"
                    className={inputClasses}
                  />
                </div>

                <div>
                  <label className={labelClasses}>Email *</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="correo@ejemplo.com"
                    className={inputClasses}
                  />
                </div>

                <div>
                  <label className={labelClasses}>Sitio Web</label>
                  <input
                    type="text"
                    value={form.sitio_web}
                    onChange={(e) => setForm({ ...form, sitio_web: e.target.value })}
                    placeholder="www.ejemplo.com"
                    className={inputClasses}
                  />
                </div>
              </div>
            </div>

            {/* Location Section */}
            <div>
              <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Ubicacion
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={labelClasses}>Direccion *</label>
                  <input
                    type="text"
                    required
                    value={form.direccion}
                    onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                    placeholder="Calle y numero"
                    className={inputClasses}
                  />
                </div>

                <div>
                  <label className={labelClasses}>Ciudad *</label>
                  <input
                    type="text"
                    required
                    value={form.ciudad}
                    onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
                    placeholder="Ciudad"
                    className={inputClasses}
                  />
                </div>

                <div>
                  <label className={labelClasses}>Codigo Postal *</label>
                  <input
                    type="text"
                    required
                    value={form.codigo_postal}
                    onChange={(e) => setForm({ ...form, codigo_postal: e.target.value })}
                    placeholder="00000"
                    className={inputClasses}
                  />
                </div>
              </div>
            </div>

            {/* Notes Section */}
            <div>
              <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Notas
              </h3>
              <textarea
                value={form.notas}
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
                rows={3}
                placeholder="Notas adicionales sobre el proveedor..."
                className={`${inputClasses} resize-none`}
              />
            </div>
          </div>

          {/* Footer */}
          <div className={`flex justify-end gap-3 mt-8 pt-6 border-t ${isDark ? 'border-purple-500/20' : 'border-gray-200'}`}>
            <button
              type="button"
              onClick={onClose}
              className={`px-6 py-3 rounded-xl text-sm font-medium ${isDark ? 'text-purple-300' : 'text-purple-700'} ${isDark ? 'bg-zinc-800' : 'bg-gray-100'} border ${isDark ? 'border-purple-500/20' : 'border-gray-300'} ${isDark ? 'hover:bg-purple-500/10' : 'hover:bg-purple-50'} hover:border-purple-500/40 transition-all`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all flex items-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Guardando...' : proveedor ? 'Actualizar' : 'Crear Proveedor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Delete Confirmation Modal
function DeleteModal({
  proveedorName,
  onClose,
  onConfirm,
  loading,
}: {
  proveedorName: string;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  const isDark = useThemeStore((s) => s.theme) === 'dark';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative z-50 w-full max-w-md bg-gradient-to-br ${isDark ? 'from-zinc-900 via-purple-950/20 to-zinc-900' : 'from-white via-purple-50/10 to-white'} border border-red-500/30 rounded-2xl shadow-2xl shadow-red-500/10 overflow-hidden animate-in fade-in zoom-in-95 duration-200`}>
        <div className="p-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/20 mb-4">
            <Trash2 className="h-8 w-8 text-red-400" />
          </div>
          <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} mb-2`}>Eliminar Proveedor</h3>
          <p className={`${isDark ? 'text-zinc-400' : 'text-gray-500'} mb-6`}>
            Estas seguro de eliminar a <span className={`${isDark ? 'text-white' : 'text-gray-900'} font-semibold`}>{proveedorName}</span>? Esta accion no se puede deshacer.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={onClose}
              disabled={loading}
              className={`px-6 py-3 rounded-xl text-sm font-medium ${isDark ? 'text-purple-300' : 'text-purple-700'} ${isDark ? 'bg-zinc-800' : 'bg-gray-100'} border ${isDark ? 'border-purple-500/20' : 'border-gray-300'} ${isDark ? 'hover:bg-purple-500/10' : 'hover:bg-purple-50'} hover:border-purple-500/40 transition-all disabled:opacity-50`}
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="px-6 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-500/25 transition-all flex items-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Eliminando...' : 'Eliminar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProveedoresPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const permissions = getPermissions(user?.rol);
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [selectedProveedor, setSelectedProveedor] = useState<Proveedor | null>(null);
  const [detailsProveedor, setDetailsProveedor] = useState<Proveedor | null>(null);
  const [historyProveedor, setHistoryProveedor] = useState<{ id: number; name: string } | null>(null);
  const [deleteProveedor, setDeleteProveedor] = useState<{ id: number; name: string } | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const limit = 20;

  // Estados para filtros avanzados
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [showFilterPopup, setShowFilterPopup] = useState(false);

  // Estados para agrupacion
  const [activeGroupings, setActiveGroupings] = useState<GroupByField[]>([]);
  const [showGroupPopup, setShowGroupPopup] = useState(false);

  // Estados para ordenamiento
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showSortPopup, setShowSortPopup] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['proveedores', page, debouncedSearch],
    queryFn: () => proveedoresService.getAll({ page, limit, search: debouncedSearch }),
  });

  const createMutation = useMutation({
    mutationFn: (data: ProveedorInput) => proveedoresService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proveedores'] });
      setFormModalOpen(false);
      setSelectedProveedor(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: ProveedorInput }) =>
      proveedoresService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proveedores'] });
      setFormModalOpen(false);
      setSelectedProveedor(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => proveedoresService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proveedores'] });
      setDeleteProveedor(null);
    },
  });

  const handleSubmit = (formData: ProveedorInput) => {
    if (selectedProveedor) {
      updateMutation.mutate({ id: selectedProveedor.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = () => {
    if (deleteProveedor) {
      deleteMutation.mutate(deleteProveedor.id);
    }
  };

  const proveedores = data?.data || [];
  const totalProveedores = data?.pagination?.total || 0;
  const totalPages = data?.pagination?.totalPages || 1;

  // Obtener valores unicos para cada campo de filtro
  const getUniqueValues = useMemo(() => {
    const valuesMap: Record<string, string[]> = {};
    FILTER_FIELDS.forEach(fieldConfig => {
      const values = new Set<string>();
      proveedores.forEach(item => {
        const val = item[fieldConfig.field];
        if (val !== null && val !== undefined && val !== '') {
          values.add(String(val));
        }
      });
      valuesMap[fieldConfig.field] = Array.from(values).sort();
    });
    return valuesMap;
  }, [proveedores]);

  // Funciones para manejar filtros
  const addFilter = useCallback(() => {
    const newFilter: FilterCondition = {
      id: `filter-${Date.now()}`,
      field: FILTER_FIELDS[0].field,
      operator: '=',
      value: '',
    };
    setFilters(prev => [...prev, newFilter]);
  }, []);

  const updateFilter = useCallback((id: string, updates: Partial<FilterCondition>) => {
    setFilters(prev => prev.map(f => (f.id === id ? { ...f, ...updates } : f)));
  }, []);

  const removeFilter = useCallback((id: string) => {
    setFilters(prev => prev.filter(f => f.id !== id));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters([]);
  }, []);

  // Funcion para toggle de agrupacion
  const toggleGrouping = useCallback((field: GroupByField) => {
    setActiveGroupings(prev => {
      if (prev.includes(field)) {
        return prev.filter(f => f !== field);
      }
      if (prev.length >= 2) {
        return [prev[1], field];
      }
      return [...prev, field];
    });
  }, []);

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  };

  // Filter data
  const filteredData = useMemo(() => {
    let data = applyFilters(proveedores, filters);

    // Aplicar ordenamiento
    if (sortField) {
      data = [...data].sort((a, b) => {
        const aVal = a[sortField as keyof Proveedor];
        const bVal = b[sortField as keyof Proveedor];

        if (aVal === null || aVal === undefined) return sortDirection === 'asc' ? 1 : -1;
        if (bVal === null || bVal === undefined) return sortDirection === 'asc' ? -1 : 1;

        const comparison = String(aVal).localeCompare(String(bVal));
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return data;
  }, [proveedores, filters, sortField, sortDirection]);

  // Group data - supports up to 2 levels
  interface GroupedLevel1 {
    name: string;
    items: Proveedor[];
    subgroups?: { name: string; items: Proveedor[] }[];
  }

  const groupedData = useMemo((): GroupedLevel1[] | null => {
    if (activeGroupings.length === 0) return null;

    const groupKey1 = activeGroupings[0];
    const groupKey2 = activeGroupings.length > 1 ? activeGroupings[1] : null;

    const groups: Record<string, Proveedor[]> = {};

    // First level grouping
    filteredData.forEach(item => {
      const key = (item[groupKey1] as string) || 'Sin asignar';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    // Sort function for groups
    const sortGroups = (entries: [string, Proveedor[]][]) => {
      if (sortField) {
        return entries.sort((a, b) => {
          const comparison = a[0].localeCompare(b[0]);
          return sortDirection === 'asc' ? comparison : -comparison;
        });
      }
      return entries.sort((a, b) => b[1].length - a[1].length);
    };

    // Convert to array and add second level if needed
    const result: GroupedLevel1[] = sortGroups(Object.entries(groups))
      .map(([name, items]) => {
        if (groupKey2) {
          const subgroupsMap: Record<string, Proveedor[]> = {};
          items.forEach(item => {
            const subKey = (item[groupKey2] as string) || 'Sin asignar';
            if (!subgroupsMap[subKey]) subgroupsMap[subKey] = [];
            subgroupsMap[subKey].push(item);
          });
          const subgroups = sortGroups(Object.entries(subgroupsMap))
            .map(([subName, subItems]) => ({ name: subName, items: subItems }));
          return { name, items, subgroups };
        }
        return { name, items };
      });

    return result;
  }, [filteredData, activeGroupings, sortField, sortDirection]);

  const hasActiveFilters = filters.length > 0 || activeGroupings.length > 0 || sortField !== null;

  const clearAllFilters = () => {
    setFilters([]);
    setActiveGroupings([]);
    setSortField(null);
    setSortDirection('asc');
    setExpandedGroups(new Set());
  };

  // Helper to render a proveedor table row (used in 3 places)
  const renderProveedorRow = (proveedor: Proveedor, index?: number) => (
    <tr key={proveedor.id} className={`border-b ${isDark ? 'border-purple-500/10' : 'border-gray-100'} last:border-0 ${isDark ? 'hover:bg-purple-500/5' : 'hover:bg-purple-50/50'} transition-all`} style={index !== undefined ? { animationDelay: `${index * 30}ms` } : undefined}>
      <td className="px-2 py-2">
        <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'} text-xs truncate block max-w-[120px]`}>{proveedor.nombre}</span>
      </td>
      <td className="px-2 py-2 hidden md:table-cell">
        <span className={`${isDark ? 'text-zinc-400' : 'text-gray-500'} text-[11px] truncate block max-w-[80px]`}>{proveedor.categoria || '-'}</span>
      </td>
      <td className="px-2 py-2">
        <span className="inline-flex items-center gap-1 max-w-[80px]">
          <MapPin className="h-3 w-3 text-purple-400 flex-shrink-0" />
          <span className={`${isDark ? 'text-purple-300' : 'text-purple-700'} text-[11px] truncate`}>{proveedor.ciudad || '-'}</span>
        </span>
      </td>
      <td className="px-2 py-2 hidden lg:table-cell">
        <span className={`${isDark ? 'text-zinc-400' : 'text-gray-500'} text-[11px] truncate block max-w-[100px]`}>{proveedor.contacto_principal || '-'}</span>
      </td>
      <td className="px-2 py-2 hidden md:table-cell">
        <span className="inline-flex items-center gap-1">
          <Phone className="h-3 w-3 text-purple-400/50 flex-shrink-0" />
          <span className={`${isDark ? 'text-zinc-400' : 'text-gray-500'} text-[11px]`}>{proveedor.telefono || '-'}</span>
        </span>
      </td>
      <td className="px-2 py-2">
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${proveedor.estado === 'activo' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30'}`}>
          {proveedor.estado === 'activo' ? <CheckCircle className="h-2.5 w-2.5" /> : <Clock className="h-2.5 w-2.5" />}
          <span className="hidden sm:inline">{proveedor.estado || '-'}</span>
        </span>
      </td>
      <td className="px-2 py-2">
        <div className="flex items-center gap-0.5">
          <button onClick={() => setDetailsProveedor(proveedor)} className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 transition-all" title="Ver detalles"><Eye className="h-3 w-3" /></button>
          <button onClick={() => setHistoryProveedor({ id: proveedor.id, name: proveedor.nombre })} className="p-1.5 rounded-lg bg-fuchsia-500/10 text-fuchsia-400 hover:bg-fuchsia-500/20 border border-fuchsia-500/20 transition-all hidden sm:block" title="Historial"><History className="h-3 w-3" /></button>
          {permissions.canEditProveedores && (
            <button onClick={() => { setSelectedProveedor(proveedor); setFormModalOpen(true); }} className="p-1.5 rounded-lg bg-zinc-500/10 text-zinc-400 hover:bg-zinc-500/20 border border-zinc-500/20 transition-all" title="Editar"><Pencil className="h-3 w-3" /></button>
          )}
          {permissions.canDeleteProveedores && (
            <button onClick={() => setDeleteProveedor({ id: proveedor.id, name: proveedor.nombre })} className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-all" title="Eliminar"><Trash2 className="h-3 w-3" /></button>
          )}
        </div>
      </td>
    </tr>
  );

  return (
    <div className="min-h-screen">
      <Header title="Proveedores" />

      <div className="p-6 space-y-5">
        {/* Control Bar */}
        <div className={`rounded-2xl border ${isDark ? 'border-purple-500/20' : 'border-gray-200'} bg-gradient-to-br ${isDark ? 'from-zinc-900/90 via-purple-950/20 to-zinc-900/90' : 'from-white via-purple-50/30 to-white'} backdrop-blur-xl p-5 relative z-[45]`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* Search */}
            <div className="relative flex-1 w-full sm:max-w-md">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-purple-400" />
              <input
                type="search"
                placeholder="Buscar proveedores..."
                className={`w-full pl-11 pr-4 py-3 rounded-xl border ${isDark ? 'border-purple-500/20' : 'border-gray-300'} ${isDark ? 'bg-zinc-900/80' : 'bg-white'} ${isDark ? 'text-white' : 'text-gray-900'} text-sm ${isDark ? 'placeholder:text-zinc-500' : 'placeholder:text-gray-400'} focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/40 transition-all hover:border-purple-500/40`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Filter/Group/Sort Buttons */}
            <div className="flex items-center gap-2">
              {/* Boton de Filtros */}
              <div className="relative">
                <button
                  onClick={() => setShowFilterPopup(!showFilterPopup)}
                  className={`relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
                    filters.length > 0
                      ? 'bg-purple-600 text-white'
                      : `${isDark ? 'bg-purple-900/50 hover:bg-purple-900/70' : 'bg-purple-50 hover:bg-purple-100'} border ${isDark ? 'border-purple-500/30' : 'border-gray-300'} ${isDark ? 'text-purple-300' : 'text-purple-700'}`
                  }`}
                  title="Filtrar"
                >
                  <Filter className="h-4 w-4" />
                  {filters.length > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-pink-500 text-[10px] font-bold text-white px-1">
                      {filters.length}
                    </span>
                  )}
                </button>
                {showFilterPopup && (
                  <div className={`absolute right-0 top-full mt-1 z-[60] w-[520px] max-w-[calc(100vw-2rem)] ${isDark ? 'bg-[#1a1025]' : 'bg-white'} border ${isDark ? 'border-purple-900/50' : 'border-gray-200'} rounded-lg shadow-xl p-4`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-sm font-medium ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>Filtros de busqueda</span>
                      <button onClick={() => setShowFilterPopup(false)} className={`${isDark ? 'text-zinc-400 hover:text-white' : 'text-gray-400 hover:text-gray-900'}`}>
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                      {filters.map((filter, index) => (
                        <div key={filter.id} className="flex items-center gap-2">
                          {index > 0 && <span className="text-[10px] text-purple-400 font-medium w-8">AND</span>}
                          {index === 0 && <span className="w-8"></span>}
                          <select
                            value={filter.field}
                            onChange={(e) => updateFilter(filter.id, { field: e.target.value })}
                            className={`w-[130px] text-xs ${isDark ? 'bg-zinc-900' : 'bg-gray-50'} border ${isDark ? 'border-zinc-700' : 'border-gray-300'} rounded px-2 py-1.5 ${isDark ? 'text-white' : 'text-gray-900'}`}
                          >
                            {FILTER_FIELDS.map((f) => (
                              <option key={f.field} value={f.field}>{f.label}</option>
                            ))}
                          </select>
                          <select
                            value={filter.operator}
                            onChange={(e) => updateFilter(filter.id, { operator: e.target.value as FilterOperator })}
                            className={`w-[110px] text-xs ${isDark ? 'bg-zinc-900' : 'bg-gray-50'} border ${isDark ? 'border-zinc-700' : 'border-gray-300'} rounded px-2 py-1.5 ${isDark ? 'text-white' : 'text-gray-900'}`}
                          >
                            {OPERATORS.map((op) => (
                              <option key={op.value} value={op.value}>{op.label}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            list={`datalist-${filter.id}`}
                            value={filter.value}
                            onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                            placeholder="Escribe o selecciona..."
                            className={`flex-1 text-xs ${isDark ? 'bg-zinc-900' : 'bg-gray-50'} border ${isDark ? 'border-zinc-700' : 'border-gray-300'} rounded px-2 py-1.5 ${isDark ? 'text-white' : 'text-gray-900'} ${isDark ? 'placeholder:text-zinc-500' : 'placeholder:text-gray-400'} focus:outline-none focus:border-purple-500`}
                          />
                          <datalist id={`datalist-${filter.id}`}>
                            {getUniqueValues[filter.field]?.map((val) => (
                              <option key={val} value={val} />
                            ))}
                          </datalist>
                          <button onClick={() => removeFilter(filter.id)} className="text-red-400 hover:text-red-300 p-0.5">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      {filters.length === 0 && (
                        <p className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-gray-400'} text-center py-3`}>Sin filtros. Haz clic en "Anadir".</p>
                      )}
                    </div>
                    <div className={`flex items-center justify-between mt-3 pt-3 border-t ${isDark ? 'border-purple-900/30' : 'border-gray-200'}`}>
                      <button onClick={addFilter} className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-purple-600 hover:bg-purple-700 text-white rounded">
                        <Plus className="h-3 w-3" /> Anadir
                      </button>
                      <button onClick={clearFilters} disabled={filters.length === 0} className="px-2 py-1 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-900/30 border border-red-500/30 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                        Limpiar
                      </button>
                    </div>
                    {filters.length > 0 && (
                      <div className={`mt-2 pt-2 border-t ${isDark ? 'border-purple-900/30' : 'border-gray-200'}`}>
                        <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{filteredData.length} de {proveedores.length} registros</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Boton de Agrupar */}
              <div className="relative">
                <button
                  onClick={() => setShowGroupPopup(!showGroupPopup)}
                  className={`relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
                    activeGroupings.length > 0
                      ? 'bg-purple-600 text-white'
                      : `${isDark ? 'bg-purple-900/50 hover:bg-purple-900/70' : 'bg-purple-50 hover:bg-purple-100'} border ${isDark ? 'border-purple-500/30' : 'border-gray-300'} ${isDark ? 'text-purple-300' : 'text-purple-700'}`
                  }`}
                  title="Agrupar"
                >
                  <Layers className="h-4 w-4" />
                  {activeGroupings.length > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-pink-500 text-[10px] font-bold text-white px-1">
                      {activeGroupings.length}
                    </span>
                  )}
                </button>
                {showGroupPopup && (
                  <div className={`absolute right-0 top-full mt-1 z-[60] ${isDark ? 'bg-[#1a1025]' : 'bg-white'} border ${isDark ? 'border-purple-900/50' : 'border-gray-200'} rounded-lg shadow-xl p-2 min-w-[180px]`}>
                    <p className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'} uppercase tracking-wide px-2 py-1`}>Agrupar por (max 2)</p>
                    {AVAILABLE_GROUPINGS.map(({ field, label }) => (
                      <button
                        key={field}
                        onClick={() => toggleGrouping(field)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded ${isDark ? 'hover:bg-purple-900/30' : 'hover:bg-purple-50'} transition-colors ${
                          activeGroupings.includes(field) ? (isDark ? 'text-purple-300' : 'text-purple-700') : (isDark ? 'text-zinc-400' : 'text-gray-500')
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                          activeGroupings.includes(field) ? 'bg-purple-600 border-purple-600' : 'border-purple-500/50'
                        }`}>
                          {activeGroupings.includes(field) && <Check className="h-3 w-3 text-white" />}
                        </div>
                        {label}
                        {activeGroupings.indexOf(field) === 0 && <span className="ml-auto text-[10px] text-purple-400">1</span>}
                        {activeGroupings.indexOf(field) === 1 && <span className="ml-auto text-[10px] text-pink-400">2</span>}
                      </button>
                    ))}
                    <div className={`border-t ${isDark ? 'border-purple-900/30' : 'border-gray-200'} mt-2 pt-2`}>
                      <button onClick={() => setActiveGroupings([])} className={`w-full text-xs ${isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-gray-400 hover:text-gray-600'} py-1`}>
                        Quitar agrupacion
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Boton de Ordenar */}
              <div className="relative">
                <button
                  onClick={() => setShowSortPopup(!showSortPopup)}
                  className={`relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
                    sortField
                      ? 'bg-purple-600 text-white'
                      : `${isDark ? 'bg-purple-900/50 hover:bg-purple-900/70' : 'bg-purple-50 hover:bg-purple-100'} border ${isDark ? 'border-purple-500/30' : 'border-gray-300'} ${isDark ? 'text-purple-300' : 'text-purple-700'}`
                  }`}
                  title="Ordenar"
                >
                  <ArrowUpDown className="h-4 w-4" />
                </button>
                {showSortPopup && (
                  <div className={`absolute right-0 top-full mt-1 z-[60] w-[300px] ${isDark ? 'bg-[#1a1025]' : 'bg-white'} border ${isDark ? 'border-purple-900/50' : 'border-gray-200'} rounded-lg shadow-xl p-3`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-sm font-medium ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>Ordenar por</span>
                      <button onClick={() => setShowSortPopup(false)} className={`${isDark ? 'text-zinc-400 hover:text-white' : 'text-gray-400 hover:text-gray-900'}`}>
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="space-y-1">
                      {FILTER_FIELDS.map((field) => (
                        <div
                          key={field.field}
                          className={`flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors ${
                            sortField === field.field ? `${isDark ? 'bg-purple-600/20' : 'bg-purple-50'} border ${isDark ? 'border-purple-500/30' : 'border-purple-200'}` : `${isDark ? 'hover:bg-purple-900/20' : 'hover:bg-purple-50'}`
                          }`}
                        >
                          <span className={sortField === field.field ? (isDark ? 'text-purple-300 font-medium' : 'text-purple-700 font-medium') : (isDark ? 'text-zinc-300' : 'text-gray-600')}>
                            {field.label}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => { setSortField(field.field); setSortDirection('asc'); }}
                              className={`p-1.5 rounded transition-colors ${
                                sortField === field.field && sortDirection === 'asc'
                                  ? 'bg-purple-600 text-white'
                                  : `${isDark ? 'text-zinc-400 hover:text-white hover:bg-purple-900/50' : 'text-gray-400 hover:text-gray-900 hover:bg-purple-50'}`
                              }`}
                              title="Ascendente (A-Z)"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => { setSortField(field.field); setSortDirection('desc'); }}
                              className={`p-1.5 rounded transition-colors ${
                                sortField === field.field && sortDirection === 'desc'
                                  ? 'bg-purple-600 text-white'
                                  : `${isDark ? 'text-zinc-400 hover:text-white hover:bg-purple-900/50' : 'text-gray-400 hover:text-gray-900 hover:bg-purple-50'}`
                              }`}
                              title="Descendente (Z-A)"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {sortField && (
                      <div className={`mt-3 pt-3 border-t ${isDark ? 'border-purple-900/30' : 'border-gray-200'}`}>
                        <button
                          onClick={() => { setSortField(null); setSortDirection('asc'); }}
                          className="w-full px-2 py-1 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-900/30 border border-red-500/30 rounded transition-colors"
                        >
                          Quitar ordenamiento
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Boton Limpiar Todo */}
              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className={`flex items-center justify-center w-9 h-9 ${isDark ? 'text-zinc-400 hover:text-white bg-zinc-800/50 hover:bg-zinc-800' : 'text-gray-400 hover:text-gray-900 bg-gray-100 hover:bg-gray-200'} rounded-lg border ${isDark ? 'border-zinc-700/50' : 'border-gray-300'} transition-colors`}
                  title="Limpiar filtros"
                >
                  <X className="h-4 w-4" />
                </button>
              )}

              {/* Add Button */}
              {permissions.canCreateProveedores && (
                <button
                  onClick={() => { setSelectedProveedor(null); setFormModalOpen(true); }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all"
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Nuevo Proveedor</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Info Badge */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${isDark ? 'bg-purple-500/10' : 'bg-purple-50'} border ${isDark ? 'border-purple-500/20' : 'border-purple-200'} ${isDark ? 'text-purple-300' : 'text-purple-700'} text-xs`}>
              <Filter className="h-3.5 w-3.5" />
              {filteredData.length} resultados
              {activeGroupings.length > 0 && (
                <span className={isDark ? 'text-zinc-500' : 'text-gray-400'}>
                  | Agrupado por {activeGroupings.map(g => AVAILABLE_GROUPINGS.find(ag => ag.field === g)?.label).join(' -> ')}
                </span>
              )}
              {sortField && (
                <span className={isDark ? 'text-zinc-500' : 'text-gray-400'}>| Ordenado por {FILTER_FIELDS.find(f => f.field === sortField)?.label} ({sortDirection === 'asc' ? '\u2191' : '\u2193'})</span>
              )}
            </div>
          </div>
        )}

        {/* Data Table */}
        <div className={`rounded-2xl border ${isDark ? 'border-purple-500/20' : 'border-gray-200'} bg-gradient-to-br ${isDark ? 'from-zinc-900/90 via-purple-950/20 to-zinc-900/90' : 'from-white via-purple-50/30 to-white'} backdrop-blur-xl overflow-hidden shadow-xl ${isDark ? 'shadow-purple-500/5' : 'shadow-gray-200/50'}`}>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-10 w-10 text-purple-400 animate-spin mb-4" />
              <p className={`${isDark ? 'text-purple-300/70' : 'text-purple-600'} text-sm`}>Cargando proveedores...</p>
            </div>
          ) : (
            <>
              {/* Loading overlay for fetching */}
              {isFetching && !isLoading && (
                <div className={`absolute inset-0 ${isDark ? 'bg-zinc-950/50' : 'bg-white/70'} backdrop-blur-sm z-10 flex items-center justify-center`}>
                  <Loader2 className="h-8 w-8 text-purple-400 animate-spin" />
                </div>
              )}

              <div className="overflow-x-auto relative">
                <table className="w-full">
                  <thead>
                    <tr className={`border-b ${isDark ? 'border-purple-500/20' : 'border-gray-200'} bg-gradient-to-r ${isDark ? 'from-purple-900/30 via-fuchsia-900/20 to-purple-900/30' : 'from-purple-50 via-fuchsia-50/50 to-purple-50'}`}>
                      <th className={`px-2 py-2 text-left text-[10px] font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'} uppercase tracking-wider`}>Nombre</th>
                      <th className={`px-2 py-2 text-left text-[10px] font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'} uppercase tracking-wider hidden md:table-cell`}>Categoria</th>
                      <th className={`px-2 py-2 text-left text-[10px] font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'} uppercase tracking-wider`}>Ciudad</th>
                      <th className={`px-2 py-2 text-left text-[10px] font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'} uppercase tracking-wider hidden lg:table-cell`}>Contacto</th>
                      <th className={`px-2 py-2 text-left text-[10px] font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'} uppercase tracking-wider hidden md:table-cell`}>Telefono</th>
                      <th className={`px-2 py-2 text-left text-[10px] font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'} uppercase tracking-wider`}>Estado</th>
                      <th className={`px-2 py-2 text-left text-[10px] font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'} uppercase tracking-wider`}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedData ? (
                      groupedData.map((group) => (
                        <React.Fragment key={`group-${group.name}`}>
                          <GroupHeader
                            groupName={group.name}
                            count={group.items.length}
                            expanded={expandedGroups.has(group.name)}
                            onToggle={() => toggleGroup(group.name)}
                            level={1}
                            isDark={isDark}
                          />
                          {expandedGroups.has(group.name) && (
                            group.subgroups ? (
                              group.subgroups.map((subgroup) => (
                                <React.Fragment key={`subgroup-${group.name}-${subgroup.name}`}>
                                  <GroupHeader
                                    groupName={subgroup.name}
                                    count={subgroup.items.length}
                                    expanded={expandedGroups.has(`${group.name}|${subgroup.name}`)}
                                    onToggle={() => toggleGroup(`${group.name}|${subgroup.name}`)}
                                    level={2}
                                    isDark={isDark}
                                  />
                                  {expandedGroups.has(`${group.name}|${subgroup.name}`) &&
                                    subgroup.items.map((proveedor) => renderProveedorRow(proveedor))
                                  }
                                </React.Fragment>
                              ))
                            ) : (
                              group.items.map((proveedor) => renderProveedorRow(proveedor))
                            )
                          )}
                        </React.Fragment>
                      ))
                    ) : (
                      filteredData.map((proveedor, index) => renderProveedorRow(proveedor, index))
                    )}
                    {filteredData.length === 0 && !groupedData && (
                      <tr>
                        <td colSpan={7} className="px-5 py-16 text-center">
                          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${isDark ? 'bg-purple-500/10' : 'bg-purple-50'} mb-4`}>
                            <Building2 className="w-8 h-8 text-purple-400" />
                          </div>
                          <p className={`${isDark ? 'text-purple-300/70' : 'text-purple-600'} text-sm`}>No se encontraron proveedores</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className={`flex items-center justify-between border-t ${isDark ? 'border-purple-500/20' : 'border-gray-200'} bg-gradient-to-r ${isDark ? 'from-purple-900/20 via-transparent to-fuchsia-900/20' : 'from-purple-50/50 via-transparent to-fuchsia-50/50'} px-5 py-4`}>
                  <p className={`text-sm ${isDark ? 'text-purple-300/70' : 'text-purple-600'}`}>
                    Pagina <span className={`font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>{page}</span> de <span className={`font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>{totalPages}</span>
                    <span className={`${isDark ? 'text-purple-300/50' : 'text-purple-500'} ml-2`}>({totalProveedores} total)</span>
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className={`px-4 py-2 rounded-lg border ${isDark ? 'border-purple-500/30' : 'border-purple-200'} ${isDark ? 'bg-purple-500/10' : 'bg-purple-50'} ${isDark ? 'text-purple-300' : 'text-purple-700'} text-sm font-medium ${isDark ? 'hover:bg-purple-500/20 hover:border-purple-500/50' : 'hover:bg-purple-100 hover:border-purple-300'} disabled:opacity-40 disabled:cursor-not-allowed transition-all`}
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className={`px-4 py-2 rounded-lg border ${isDark ? 'border-purple-500/30' : 'border-purple-200'} ${isDark ? 'bg-purple-500/10' : 'bg-purple-50'} ${isDark ? 'text-purple-300' : 'text-purple-700'} text-sm font-medium ${isDark ? 'hover:bg-purple-500/20 hover:border-purple-500/50' : 'hover:bg-purple-100 hover:border-purple-300'} disabled:opacity-40 disabled:cursor-not-allowed transition-all`}
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      {formModalOpen && (
        <FormModal
          proveedor={selectedProveedor}
          onClose={() => { setFormModalOpen(false); setSelectedProveedor(null); }}
          onSubmit={handleSubmit}
          loading={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {detailsProveedor && (
        <DetailsModal
          proveedor={detailsProveedor}
          onClose={() => setDetailsProveedor(null)}
        />
      )}

      {historyProveedor && (
        <HistoryModal
          proveedorId={historyProveedor.id}
          proveedorName={historyProveedor.name}
          onClose={() => setHistoryProveedor(null)}
        />
      )}

      {deleteProveedor && (
        <DeleteModal
          proveedorName={deleteProveedor.name}
          onClose={() => setDeleteProveedor(null)}
          onConfirm={handleDelete}
          loading={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
