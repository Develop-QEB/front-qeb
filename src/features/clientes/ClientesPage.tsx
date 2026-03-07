import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Users, Building2, Tag, Database, Cloud, Plus, Trash2,
  Filter, ChevronDown, ChevronRight, X, Layers, Package, RefreshCw,
  Eye, User, Calendar, Hash, FileText, ArrowUpDown, ArrowUp, ArrowDown, Check
} from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { clientesService } from '../../services/clientes.service';
import { Cliente } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { getPermissions } from '../../lib/permissions';
import { useSocketClientes } from '../../hooks/useSocket';
import { useThemeStore } from '../../store/themeStore';

// ============ TIPOS Y CONFIGURACIÓN DE FILTROS/ORDENAMIENTO ============
type FilterOperator = '=' | '!=' | 'contains' | 'not_contains';

interface FilterCondition {
  id: string;
  field: string;
  operator: FilterOperator;
  value: string;
}

interface FilterFieldConfig {
  field: keyof Cliente;
  label: string;
  type: 'string' | 'number';
}

// Campos disponibles para filtrar/ordenar
const FILTER_FIELDS: FilterFieldConfig[] = [
  { field: 'CUIC', label: 'CUIC', type: 'string' },
  { field: 'T0_U_Cliente', label: 'Cliente', type: 'string' },
  { field: 'T0_U_RazonSocial', label: 'Razón Social', type: 'string' },
  { field: 'T0_U_Agencia', label: 'Agencia', type: 'string' },
  { field: 'T2_U_Marca', label: 'Marca', type: 'string' },
  { field: 'T2_U_Categoria', label: 'Categoría', type: 'string' },
  { field: 'T2_U_Producto', label: 'Producto', type: 'string' },
];

// Campos disponibles para agrupar
type GroupByField = 'T0_U_Agencia' | 'T2_U_Marca' | 'T2_U_Categoria';

interface GroupConfig {
  field: GroupByField;
  label: string;
}

const AVAILABLE_GROUPINGS: GroupConfig[] = [
  { field: 'T0_U_Agencia', label: 'Agencia' },
  { field: 'T2_U_Marca', label: 'Marca' },
  { field: 'T2_U_Categoria', label: 'Categoría' },
];

const OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: '=', label: 'Igual a' },
  { value: '!=', label: 'Diferente de' },
  { value: 'contains', label: 'Contiene' },
  { value: 'not_contains', label: 'No contiene' },
];

// Función para aplicar filtros a los datos
function applyFilters(data: Cliente[], filters: FilterCondition[]): Cliente[] {
  if (filters.length === 0) return data;

  return data.filter(item => {
    return filters.every(filter => {
      const fieldValue = item[filter.field as keyof Cliente];
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

// Helper para formatear fechas
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

// ============ VIEW CLIENTE MODAL ============
interface ViewClienteModalProps {
  isOpen: boolean;
  onClose: () => void;
  cliente: Cliente | null;
}

function ViewClienteModal({ isOpen, onClose, cliente }: ViewClienteModalProps) {
  const isDark = useThemeStore((s) => s.theme === 'dark');

  // Bloquear scroll del body cuando el modal está abierto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !cliente) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 isolate">
      <div className={`${isDark ? 'bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 border-zinc-800/50' : 'bg-white border-gray-200'} border rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative z-50`}>
        {/* Header */}
        <div className={`relative px-6 py-5 border-b ${isDark ? 'border-purple-500/20 bg-gradient-to-r from-purple-600/20 via-fuchsia-600/15 to-pink-600/10' : 'border-purple-200 bg-gradient-to-r from-purple-50 via-fuchsia-50 to-pink-50'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Cliente</h2>
                  <span className={`font-mono text-sm px-2 py-0.5 rounded-lg ${isDark ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-purple-100 text-purple-700 border border-purple-200'}`}>
                    CUIC: {cliente.CUIC || '-'}
                  </span>
                  {cliente.sap_database && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-lg border ${
                      cliente.sap_database === 'CIMU'
                        ? (isDark ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-blue-50 text-blue-700 border-blue-200')
                        : cliente.sap_database === 'TEST'
                        ? (isDark ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-amber-50 text-amber-700 border-amber-200')
                        : cliente.sap_database === 'TRADE'
                        ? (isDark ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200')
                        : (isDark ? 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30' : 'bg-gray-100 text-gray-600 border-gray-200')
                    }`}>
                      {cliente.sap_database}
                    </span>
                  )}
                </div>
                <p className={`${isDark ? 'text-zinc-400' : 'text-gray-500'} text-sm`}>{cliente.T0_U_Cliente || 'Sin nombre'}</p>
              </div>
            </div>
            <button onClick={onClose} className={`p-2 ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-100'} rounded-xl transition-colors`}>
              <X className={`h-5 w-5 ${isDark ? 'text-zinc-400' : 'text-gray-400'}`} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="space-y-5">
            {/* Stats Row */}
            <div className={`${isDark ? 'bg-gradient-to-r from-purple-600/10 via-fuchsia-600/10 to-pink-600/10 border-purple-500/20' : 'bg-gradient-to-r from-purple-50 via-fuchsia-50 to-pink-50 border-purple-200'} rounded-2xl p-5 border`}>
              <div className="grid grid-cols-4 gap-6">
                <div className="text-center">
                  <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} font-mono`}>{cliente.CUIC || '-'}</p>
                  <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'} mt-1`}>CUIC</p>
                </div>
                <div className="text-center">
                  <p className={`text-lg font-bold ${isDark ? 'text-purple-400' : 'text-purple-600'} truncate`}>{cliente.T2_U_Marca || '-'}</p>
                  <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'} mt-1`}>Marca</p>
                </div>
                <div className="text-center">
                  <p className={`text-lg font-bold ${isDark ? 'text-cyan-400' : 'text-cyan-600'} truncate`}>{cliente.T0_U_Agencia || '-'}</p>
                  <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'} mt-1`}>Agencia</p>
                </div>
                <div className="text-center">
                  <p className={`text-lg font-bold ${isDark ? 'text-amber-400' : 'text-amber-600'} truncate`}>{cliente.T2_U_Categoria || '-'}</p>
                  <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'} mt-1`}>Categoría</p>
                </div>
              </div>
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Información General */}
              <div className={`${isDark ? 'bg-zinc-800/30 border-zinc-800/50' : 'bg-gray-50 border-gray-200'} rounded-2xl p-5 border`}>
                <h3 className={`text-sm font-semibold ${isDark ? 'text-purple-400' : 'text-purple-600'} mb-4 flex items-center gap-2`}>
                  <FileText className="h-4 w-4" />
                  Información General
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className={`${isDark ? 'text-zinc-500' : 'text-gray-500'} text-sm`}>ID</span>
                    <span className={`${isDark ? 'text-white' : 'text-gray-900'} text-sm font-mono`}>{cliente.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`${isDark ? 'text-zinc-500' : 'text-gray-500'} text-sm`}>CUIC</span>
                    <span className={`${isDark ? 'text-purple-300' : 'text-purple-600'} text-sm font-mono font-medium`}>{cliente.CUIC || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`${isDark ? 'text-zinc-500' : 'text-gray-500'} text-sm`}>Cliente</span>
                    <span className={`${isDark ? 'text-white' : 'text-gray-900'} text-sm font-medium truncate ml-4 max-w-[200px]`}>{cliente.T0_U_Cliente || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`${isDark ? 'text-zinc-500' : 'text-gray-500'} text-sm`}>Razón Social</span>
                    <span className={`${isDark ? 'text-white' : 'text-gray-900'} text-sm truncate ml-4 max-w-[200px]`}>{cliente.T0_U_RazonSocial || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`${isDark ? 'text-zinc-500' : 'text-gray-500'} text-sm`}>Unidad de Negocio</span>
                    <span className={`${isDark ? 'text-cyan-300' : 'text-cyan-600'} text-sm`}>{cliente.T1_U_UnidadNegocio || cliente.ASESOR_U_UnidadNegocio || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Asesor Comercial */}
              <div className={`${isDark ? 'bg-zinc-800/30 border-zinc-800/50' : 'bg-gray-50 border-gray-200'} rounded-2xl p-5 border`}>
                <h3 className={`text-sm font-semibold ${isDark ? 'text-purple-400' : 'text-purple-600'} mb-4 flex items-center gap-2`}>
                  <User className="h-4 w-4" />
                  Asesor Comercial
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className={`${isDark ? 'text-zinc-500' : 'text-gray-500'} text-sm`}>Asesor</span>
                    <span className={`${isDark ? 'text-emerald-400' : 'text-emerald-600'} text-sm font-medium`}>{cliente.ASESOR_U_Asesor || cliente.T0_U_Asesor || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`${isDark ? 'text-zinc-500' : 'text-gray-500'} text-sm`}>ID Asesor</span>
                    <span className={`${isDark ? 'text-white' : 'text-gray-900'} text-sm font-mono`}>{cliente.ASESOR_U_IDAsesor || cliente.T0_U_IDAsesor || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`${isDark ? 'text-zinc-500' : 'text-gray-500'} text-sm`}>Código SAP</span>
                    <span className={`${isDark ? 'text-white' : 'text-gray-900'} text-sm font-mono`}>{cliente.ASESOR_U_SAPCode || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`${isDark ? 'text-zinc-500' : 'text-gray-500'} text-sm`}>Unidad Asesor</span>
                    <span className={`${isDark ? 'text-white' : 'text-gray-900'} text-sm`}>{cliente.ASESOR_U_UnidadNegocio || '-'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Three Column Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Agencia */}
              <div className={`${isDark ? 'bg-zinc-800/30 border-zinc-800/50' : 'bg-gray-50 border-gray-200'} rounded-2xl p-5 border`}>
                <h3 className={`text-sm font-semibold ${isDark ? 'text-purple-400' : 'text-purple-600'} mb-3 flex items-center gap-2`}>
                  <Building2 className="h-4 w-4" />
                  Agencia
                </h3>
                <p className={`${isDark ? 'text-white' : 'text-gray-900'} font-medium text-lg`}>{cliente.T0_U_Agencia || '-'}</p>
                <p className={`${isDark ? 'text-zinc-500' : 'text-gray-500'} text-xs mt-1`}>ID: {cliente.T0_U_IDAgencia || '-'}</p>
              </div>

              {/* Marca y Producto */}
              <div className={`${isDark ? 'bg-zinc-800/30 border-zinc-800/50' : 'bg-gray-50 border-gray-200'} rounded-2xl p-5 border`}>
                <h3 className={`text-sm font-semibold ${isDark ? 'text-purple-400' : 'text-purple-600'} mb-3 flex items-center gap-2`}>
                  <Tag className="h-4 w-4" />
                  Marca & Producto
                </h3>
                <p className={`${isDark ? 'text-fuchsia-300' : 'text-fuchsia-600'} font-medium`}>{cliente.T2_U_Marca || '-'}</p>
                <p className={`${isDark ? 'text-zinc-500' : 'text-gray-500'} text-xs mt-0.5`}>ID Marca: {cliente.T1_U_IDMarca || '-'}</p>
                <div className={`mt-2 pt-2 border-t ${isDark ? 'border-zinc-700/50' : 'border-gray-200'}`}>
                  <p className={`${isDark ? 'text-amber-300' : 'text-amber-600'} font-medium`}>{cliente.T2_U_Producto || '-'}</p>
                  <p className={`${isDark ? 'text-zinc-500' : 'text-gray-500'} text-xs mt-0.5`}>ID Producto: {cliente.T2_U_IDProducto || '-'}</p>
                </div>
              </div>

              {/* Categoría */}
              <div className={`${isDark ? 'bg-zinc-800/30 border-zinc-800/50' : 'bg-gray-50 border-gray-200'} rounded-2xl p-5 border`}>
                <h3 className={`text-sm font-semibold ${isDark ? 'text-purple-400' : 'text-purple-600'} mb-3 flex items-center gap-2`}>
                  <Layers className="h-4 w-4" />
                  Categoría
                </h3>
                <p className={`${isDark ? 'text-white' : 'text-gray-900'} font-medium text-lg`}>{cliente.T2_U_Categoria || '-'}</p>
                <p className={`${isDark ? 'text-zinc-500' : 'text-gray-500'} text-xs mt-1`}>ID: {cliente.T2_U_IDCategoria || '-'}</p>
              </div>
            </div>

            {/* Vigencias */}
            <div className={`${isDark ? 'bg-zinc-800/30 border-zinc-800/50' : 'bg-gray-50 border-gray-200'} rounded-2xl p-5 border`}>
              <h3 className={`text-sm font-semibold ${isDark ? 'text-purple-400' : 'text-purple-600'} mb-4 flex items-center gap-2`}>
                <Calendar className="h-4 w-4" />
                Vigencias
              </h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <span className={`${isDark ? 'text-zinc-500' : 'text-gray-500'} text-xs block mb-1`}>Válido Desde (T1)</span>
                  <span className={`${isDark ? 'text-white' : 'text-gray-900'} text-sm`}>{formatDate(cliente.T1_U_ValidFrom)}</span>
                </div>
                <div>
                  <span className={`${isDark ? 'text-zinc-500' : 'text-gray-500'} text-xs block mb-1`}>Válido Hasta (T1)</span>
                  <span className={`${isDark ? 'text-white' : 'text-gray-900'} text-sm`}>{formatDate(cliente.T1_U_ValidTo)}</span>
                </div>
                <div>
                  <span className={`${isDark ? 'text-zinc-500' : 'text-gray-500'} text-xs block mb-1`}>Válido Desde (T2)</span>
                  <span className={`${isDark ? 'text-white' : 'text-gray-900'} text-sm`}>{formatDate(cliente.T2_U_ValidFrom)}</span>
                </div>
                <div>
                  <span className={`${isDark ? 'text-zinc-500' : 'text-gray-500'} text-xs block mb-1`}>Válido Hasta (T2)</span>
                  <span className={`${isDark ? 'text-white' : 'text-gray-900'} text-sm`}>{formatDate(cliente.T2_U_ValidTo)}</span>
                </div>
              </div>
            </div>

            {/* IDs Técnicos */}
            <div className={`${isDark ? 'bg-zinc-800/30 border-zinc-800/50' : 'bg-gray-50 border-gray-200'} rounded-2xl p-5 border`}>
              <h3 className={`text-sm font-semibold ${isDark ? 'text-purple-400' : 'text-purple-600'} mb-4 flex items-center gap-2`}>
                <Hash className="h-4 w-4" />
                IDs Técnicos
              </h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <span className={`${isDark ? 'text-zinc-500' : 'text-gray-500'} text-xs block mb-1`}>T0 IDACA</span>
                  <span className={`${isDark ? 'text-white' : 'text-gray-900'} text-sm font-mono`}>{cliente.T0_U_IDACA || '-'}</span>
                </div>
                <div>
                  <span className={`${isDark ? 'text-zinc-500' : 'text-gray-500'} text-xs block mb-1`}>T1 IDACA</span>
                  <span className={`${isDark ? 'text-white' : 'text-gray-900'} text-sm font-mono`}>{cliente.T1_U_IDACA || '-'}</span>
                </div>
                <div>
                  <span className={`${isDark ? 'text-zinc-500' : 'text-gray-500'} text-xs block mb-1`}>T1 IDCM</span>
                  <span className={`${isDark ? 'text-white' : 'text-gray-900'} text-sm font-mono`}>{cliente.T1_U_IDCM || '-'}</span>
                </div>
                <div>
                  <span className={`${isDark ? 'text-zinc-500' : 'text-gray-500'} text-xs block mb-1`}>T2 IDCM</span>
                  <span className={`${isDark ? 'text-white' : 'text-gray-900'} text-sm font-mono`}>{cliente.T2_U_IDCM || '-'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-gray-200 bg-gray-50'}`}>
          <button onClick={onClose} className={`px-4 py-2 rounded-lg ${isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border-zinc-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-300'} text-sm border`}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// Simple Stat Card - Solo número grande
function StatCard({
  title,
  value,
  icon: Icon,
  color,
  delay = 0,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  color: string;
  delay?: number;
}) {
  const isDark = useThemeStore((s) => s.theme === 'dark');
  const [animate, setAnimate] = useState(false);
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setAnimate(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  useEffect(() => {
    if (!animate || value === 0) {
      setDisplayValue(value);
      return;
    }
    const duration = 800;
    const steps = 20;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [animate, value]);

  const colorClasses: Record<string, string> = {
    purple: 'from-purple-500/20 to-fuchsia-500/20 border-purple-500/30',
    cyan: 'from-cyan-500/20 to-blue-500/20 border-cyan-500/30',
    pink: 'from-pink-500/20 to-rose-500/20 border-pink-500/30',
    violet: 'from-violet-500/20 to-indigo-500/20 border-violet-500/30',
  };

  const colorClassesLight: Record<string, string> = {
    purple: 'from-purple-50 to-fuchsia-50 border-purple-200',
    cyan: 'from-cyan-50 to-blue-50 border-cyan-200',
    pink: 'from-pink-50 to-rose-50 border-pink-200',
    violet: 'from-violet-50 to-indigo-50 border-violet-200',
  };

  const iconColors: Record<string, string> = {
    purple: isDark ? 'text-purple-400' : 'text-purple-600',
    cyan: isDark ? 'text-cyan-400' : 'text-cyan-600',
    pink: isDark ? 'text-pink-400' : 'text-pink-600',
    violet: isDark ? 'text-violet-400' : 'text-violet-600',
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${isDark ? colorClasses[color] : colorClassesLight[color]} backdrop-blur-sm p-5 transition-all duration-500 hover:scale-[1.02] ${animate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-5 w-5 ${iconColors[color]}`} />
        <span className={`text-sm font-medium ${isDark ? 'text-zinc-400' : 'text-gray-500'} uppercase tracking-wide`}>{title}</span>
      </div>
      <p className={`text-4xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
        {displayValue.toLocaleString()}
      </p>
    </div>
  );
}

// Tab Button Component
function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  count,
  loading
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  count?: number;
  loading?: boolean;
}) {
  const isDark = useThemeStore((s) => s.theme === 'dark');
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 ${
        active
          ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-lg shadow-purple-500/20'
          : isDark
            ? 'bg-zinc-800/60 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 border border-zinc-700/50'
            : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 border border-gray-200'
      }`}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
      <span className={`px-1.5 py-0.5 rounded-md text-xs ${
        active ? 'bg-white/20' : isDark ? 'bg-zinc-700' : 'bg-gray-200'
      }`}>
        {loading ? '...' : (count ?? 0).toLocaleString()}
      </span>
    </button>
  );
}

// Grouped Table Row - Level 1
function GroupHeader({
  groupName,
  count,
  expanded,
  onToggle,
  level = 1
}: {
  groupName: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  level?: 1 | 2;
}) {
  const isDark = useThemeStore((s) => s.theme === 'dark');
  const isLevel1 = level === 1;
  return (
    <tr
      onClick={onToggle}
      className={`border-b cursor-pointer transition-colors ${
        isLevel1
          ? isDark
            ? 'bg-purple-500/10 border-purple-500/20 hover:bg-purple-500/20'
            : 'bg-purple-50 border-purple-200 hover:bg-purple-100'
          : isDark
            ? 'bg-fuchsia-500/5 border-fuchsia-500/10 hover:bg-fuchsia-500/10'
            : 'bg-fuchsia-50 border-fuchsia-100 hover:bg-fuchsia-100'
      }`}
    >
      <td colSpan={8} className={`px-4 py-2.5 ${isLevel1 ? '' : 'pl-10'}`}>
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className={`h-4 w-4 ${isLevel1 ? (isDark ? 'text-purple-400' : 'text-purple-600') : (isDark ? 'text-fuchsia-400' : 'text-fuchsia-600')}`} />
          ) : (
            <ChevronRight className={`h-4 w-4 ${isLevel1 ? (isDark ? 'text-purple-400' : 'text-purple-600') : (isDark ? 'text-fuchsia-400' : 'text-fuchsia-600')}`} />
          )}
          <span className={`font-semibold ${isLevel1 ? (isDark ? 'text-white' : 'text-gray-900') : (isDark ? 'text-zinc-200' : 'text-gray-700') + ' text-sm'}`}>
            {groupName || 'Sin asignar'}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-xs ${
            isLevel1
              ? isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'
              : isDark ? 'bg-fuchsia-500/20 text-fuchsia-300' : 'bg-fuchsia-100 text-fuchsia-700'
          }`}>
            {count} {count === 1 ? 'cliente' : 'clientes'}
          </span>
        </div>
      </td>
    </tr>
  );
}

export function ClientesPage() {
  const isDark = useThemeStore((s) => s.theme === 'dark');
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const permissions = getPermissions(user?.rol);

  // WebSocket para actualizaciones en tiempo real
  useSocketClientes();

  const [activeTab, setActiveTab] = useState<'db' | 'CIMU' | 'TEST' | 'TRADE'>('db');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const limit = 20;

  // Estado para el modal de ver cliente
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Estados para filtros avanzados
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [showFilterPopup, setShowFilterPopup] = useState(false);

  // Estados para agrupación
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
      setSapPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['clientes-stats'],
    queryFn: () => clientesService.getStats(),
  });

  // Fetch paginated DB clients
  const { data: dbData, isLoading: dbLoading } = useQuery({
    queryKey: ['clientes', page, debouncedSearch],
    queryFn: () => clientesService.getAll({ page, limit, search: debouncedSearch }),
  });

  // Fetch ALL DB clients for filtering/grouping/sorting
  const needsFullData = filters.length > 0 || activeGroupings.length > 0 || sortField !== null;
  const { data: fullDbData, isLoading: fullDbLoading } = useQuery({
    queryKey: ['clientes-full', debouncedSearch],
    queryFn: () => clientesService.getAllFull(debouncedSearch || undefined),
    enabled: needsFullData,
  });

  // SAP pagination
  const [sapPage, setSapPage] = useState(1);
  const sapLimit = 100;

  // Fetch SAP clients per database - all prefetch on mount (no wait for tab click)
  const { data: cimuData, isLoading: cimuLoading, refetch: refetchCimu, isFetching: cimuFetching } = useQuery({
    queryKey: ['clientes-sap-CIMU', debouncedSearch],
    queryFn: () => clientesService.getSAPClientesByDB('CIMU', debouncedSearch || undefined),
    staleTime: 10 * 60 * 1000,
  });

  const { data: testData, isLoading: testLoading, refetch: refetchTest, isFetching: testFetching } = useQuery({
    queryKey: ['clientes-sap-TEST', debouncedSearch],
    queryFn: () => clientesService.getSAPClientesByDB('TEST', debouncedSearch || undefined),
    staleTime: 10 * 60 * 1000,
  });

  const { data: tradeData, isLoading: tradeLoading, refetch: refetchTrade, isFetching: tradeFetching } = useQuery({
    queryKey: ['clientes-sap-TRADE', debouncedSearch],
    queryFn: () => clientesService.getSAPClientesByDB('TRADE', debouncedSearch || undefined),
    staleTime: 10 * 60 * 1000,
  });

  // Helper to get the active SAP query data/refetch
  const activeSapData = activeTab === 'CIMU' ? cimuData : activeTab === 'TEST' ? testData : activeTab === 'TRADE' ? tradeData : null;
  const activeSapLoading = activeTab === 'CIMU' ? cimuLoading : activeTab === 'TEST' ? testLoading : activeTab === 'TRADE' ? tradeLoading : false;
  const activeSapFetching = activeTab === 'CIMU' ? cimuFetching : activeTab === 'TEST' ? testFetching : activeTab === 'TRADE' ? tradeFetching : false;
  const activeSapRefetch = activeTab === 'CIMU' ? refetchCimu : activeTab === 'TEST' ? refetchTest : activeTab === 'TRADE' ? refetchTrade : null;

  // Refresh SAP data (clear cache on backend)
  const handleRefreshSap = async () => {
    if (activeSapRefetch) {
      await activeSapRefetch();
    }
  };

  // Create client mutation
  const createMutation = useMutation({
    mutationFn: clientesService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['clientes-full'] });
      queryClient.invalidateQueries({ queryKey: ['clientes-sap-CIMU'] });
      queryClient.invalidateQueries({ queryKey: ['clientes-sap-TEST'] });
      queryClient.invalidateQueries({ queryKey: ['clientes-sap-TRADE'] });
      queryClient.invalidateQueries({ queryKey: ['clientes-stats'] });
    },
  });

  // Delete client mutation
  const deleteMutation = useMutation({
    mutationFn: clientesService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['clientes-full'] });
      queryClient.invalidateQueries({ queryKey: ['clientes-sap-CIMU'] });
      queryClient.invalidateQueries({ queryKey: ['clientes-sap-TEST'] });
      queryClient.invalidateQueries({ queryKey: ['clientes-sap-TRADE'] });
      queryClient.invalidateQueries({ queryKey: ['clientes-stats'] });
    },
  });

  // Get current data based on tab and filters
  const isDb = activeTab === 'db';
  const isSapTab = activeTab === 'CIMU' || activeTab === 'TEST' || activeTab === 'TRADE';

  // All SAP data (for total count + filtering)
  const allSapData = useMemo(() => {
    if (!isSapTab) return [];
    return activeSapData?.data || [];
  }, [isSapTab, activeSapData]);

  // Paginated SAP data
  const paginatedSapData = useMemo(() => {
    const start = (sapPage - 1) * sapLimit;
    return allSapData.slice(start, start + sapLimit);
  }, [allSapData, sapPage]);

  const sapTotalPages = Math.max(1, Math.ceil(allSapData.length / sapLimit));

  const currentData = useMemo(() => {
    if (isSapTab) {
      return paginatedSapData;
    }
    if (needsFullData && fullDbData?.data) {
      return fullDbData.data;
    }
    return dbData?.data || [];
  }, [isSapTab, paginatedSapData, fullDbData, dbData, needsFullData]);

  const isLoading = isSapTab
    ? activeSapLoading
    : (needsFullData ? fullDbLoading : dbLoading);

  // Obtener valores únicos para cada campo de filtro
  const getUniqueValues = useMemo(() => {
    const valuesMap: Record<string, string[]> = {};
    FILTER_FIELDS.forEach(fieldConfig => {
      const values = new Set<string>();
      currentData.forEach(item => {
        const val = item[fieldConfig.field];
        if (val !== null && val !== undefined && val !== '') {
          values.add(String(val));
        }
      });
      valuesMap[fieldConfig.field] = Array.from(values).sort();
    });
    return valuesMap;
  }, [currentData]);

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

  // Función para toggle de agrupación
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

  // Filter data
  const filteredData = useMemo(() => {
    let data = applyFilters(currentData, filters);

    // Aplicar ordenamiento
    if (sortField) {
      data = [...data].sort((a, b) => {
        const aVal = a[sortField as keyof Cliente];
        const bVal = b[sortField as keyof Cliente];

        if (aVal === null || aVal === undefined) return sortDirection === 'asc' ? 1 : -1;
        if (bVal === null || bVal === undefined) return sortDirection === 'asc' ? -1 : 1;

        const comparison = String(aVal).localeCompare(String(bVal));
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return data;
  }, [currentData, filters, sortField, sortDirection]);

  // Group data - supports up to 2 levels
  interface GroupedLevel1 {
    name: string;
    items: Cliente[];
    subgroups?: { name: string; items: Cliente[] }[];
  }

  const groupedData = useMemo((): GroupedLevel1[] | null => {
    if (activeGroupings.length === 0) return null;

    const groupKey1 = activeGroupings[0];
    const groupKey2 = activeGroupings.length > 1 ? activeGroupings[1] : null;

    const groups: Record<string, Cliente[]> = {};

    // First level grouping
    filteredData.forEach(item => {
      const key = (item[groupKey1] as string) || 'Sin asignar';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    // Sort function for groups - by name if sorting is active, otherwise by count
    const sortGroups = (entries: [string, Cliente[]][]) => {
      if (sortField) {
        // Sort groups alphabetically by group name
        return entries.sort((a, b) => {
          const comparison = a[0].localeCompare(b[0]);
          return sortDirection === 'asc' ? comparison : -comparison;
        });
      }
      // Default: sort by count (descending)
      return entries.sort((a, b) => b[1].length - a[1].length);
    };

    // Convert to array and add second level if needed
    const result: GroupedLevel1[] = sortGroups(Object.entries(groups))
      .map(([name, items]) => {
        if (groupKey2) {
          // Second level grouping
          const subgroupsMap: Record<string, Cliente[]> = {};
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

  const [addingCuic, setAddingCuic] = useState<number | null>(null);

  const handleAddToDatabase = async (cliente: Cliente) => {
    try {
      setAddingCuic(cliente.CUIC ?? null);
      const payload: Partial<Cliente> = { ...cliente };
      if (isSapTab) {
        payload.sap_database = activeTab;
        payload.card_code = cliente.ACA_U_SAPCode || null;
        payload.salesperson_code = cliente.ASESOR_U_SAPCode_Original ? Number(cliente.ASESOR_U_SAPCode_Original) : null;
      }
      await createMutation.mutateAsync(payload);
    } catch (error) {
      console.error('Error adding cliente:', error);
    } finally {
      setAddingCuic(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('¿Estás seguro de eliminar este cliente?')) {
      try {
        await deleteMutation.mutateAsync(id);
      } catch (error) {
        console.error('Error deleting cliente:', error);
      }
    }
  };

  const clearAllFilters = () => {
    setFilters([]);
    setActiveGroupings([]);
    setSortField(null);
    setSortDirection('asc');
    setExpandedGroups(new Set());
  };

  const sapDatabaseBadgeClasses: Record<string, string> = {
    CIMU: isDark ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-blue-50 text-blue-700 border-blue-200',
    TEST: isDark ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-amber-50 text-amber-700 border-amber-200',
    TRADE: isDark ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };

  const renderClientRow = (item: Cliente, isDbRow: boolean, index: number) => (
    <tr key={isDbRow ? `db-${item.id}` : `sap-${index}-${item.CUIC}`} className={`border-b ${isDark ? 'border-zinc-800/50 hover:bg-zinc-800/30' : 'border-gray-100 hover:bg-gray-50'} transition-colors`}>
      <td className="px-2 py-2">
        <div className="flex items-center gap-1">
          <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'bg-purple-500/10 text-purple-300' : 'bg-purple-50 text-purple-700'}`}>{item.CUIC || '-'}</span>
          {isDbRow && item.sap_database && (
            <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded border ${sapDatabaseBadgeClasses[item.sap_database] || (isDark ? 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30' : 'bg-gray-100 text-gray-600 border-gray-200')}`}>
              {item.sap_database}
            </span>
          )}
        </div>
      </td>
      <td className="px-2 py-2">
        <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'} text-xs truncate block max-w-[120px]`}>{item.T0_U_Cliente || '-'}</span>
      </td>
      <td className="px-2 py-2 hidden lg:table-cell">
        <span className={`max-w-[150px] truncate block ${isDark ? 'text-zinc-400' : 'text-gray-500'} text-[11px]`}>{item.T0_U_RazonSocial || '-'}</span>
      </td>
      <td className="px-2 py-2 hidden md:table-cell">
        <span className="inline-flex items-center gap-1 max-w-[100px]">
          <Building2 className={`h-3 w-3 ${isDark ? 'text-cyan-400' : 'text-cyan-600'} flex-shrink-0`} />
          <span className={`${isDark ? 'text-cyan-300' : 'text-cyan-600'} text-[11px] truncate`}>{item.T0_U_Agencia || '-'}</span>
        </span>
      </td>
      <td className="px-2 py-2">
        <span className="inline-flex items-center gap-1 max-w-[100px]">
          <Tag className={`h-3 w-3 ${isDark ? 'text-fuchsia-400' : 'text-fuchsia-600'} flex-shrink-0`} />
          <span className={`${isDark ? 'text-fuchsia-300' : 'text-fuchsia-600'} text-[11px] truncate`}>{item.T2_U_Marca || '-'}</span>
        </span>
      </td>
      <td className="px-2 py-2 hidden xl:table-cell">
        <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${isDark ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : 'bg-purple-50 text-purple-700 border-purple-200'} border truncate max-w-[80px] block`}>
          {item.T2_U_Categoria || '-'}
        </span>
      </td>
      {isDbRow && (
        <td className="px-2 py-2 hidden xl:table-cell">
          <span className="inline-flex items-center gap-1 max-w-[100px]">
            <Package className={`h-3 w-3 ${isDark ? 'text-amber-400' : 'text-amber-600'} flex-shrink-0`} />
            <span className={`${isDark ? 'text-amber-300' : 'text-amber-600'} text-[11px] truncate`}>{item.T2_U_Producto || '-'}</span>
          </span>
        </td>
      )}
      <td className="px-2 py-2">
        <div className="flex items-center gap-0.5">
          <button
            onClick={(e) => { e.stopPropagation(); setSelectedCliente(item); setShowViewModal(true); }}
            className={`p-1.5 rounded-lg ${isDark ? 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 hover:text-purple-300 border-purple-500/20 hover:border-purple-500/40' : 'bg-purple-50 text-purple-600 hover:bg-purple-100 hover:text-purple-700 border-purple-200 hover:border-purple-300'} border transition-all`}
            title="Ver detalles"
          >
            <Eye className="h-3 w-3" />
          </button>
          {isDbRow && permissions.canDeleteClientes && (
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
              disabled={deleteMutation.isPending}
              className={`p-1.5 rounded-lg ${isDark ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 border-red-500/20 hover:border-red-500/40' : 'bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 border-red-200 hover:border-red-300'} border transition-all disabled:opacity-50`}
              title="Eliminar"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
          {!isDbRow && (
            <button
              onClick={(e) => { e.stopPropagation(); handleAddToDatabase(item); }}
              disabled={addingCuic !== null}
              className={`p-1.5 rounded-lg ${isDark ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 border-emerald-500/20 hover:border-emerald-500/40' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 border-emerald-200 hover:border-emerald-300'} border transition-all disabled:opacity-50`}
              title="Agregar a BD"
            >
              {addingCuic === item.CUIC ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <Plus className="h-3 w-3" />
              )}
            </button>
          )}
        </div>
      </td>
    </tr>
  );

  const dbTotalPages = dbData?.pagination?.totalPages || 1;
  const cimuTotal = cimuData?.total ?? 0;
  const testTotal = testData?.total ?? 0;
  const tradeTotal = tradeData?.total ?? 0;
  const dbTotal = dbData?.pagination?.total ?? 0;

  return (
    <div className="min-h-screen">
      <Header title="Clientes" />

      <div className="p-6 space-y-5">
        {/* Stats Row - Solo números grandes */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            title="Total Clientes"
            value={stats?.total || 0}
            icon={Users}
            color="purple"
            delay={0}
          />
          <StatCard
            title="Agencias"
            value={stats?.agencias || 0}
            icon={Building2}
            color="cyan"
            delay={50}
          />
          <StatCard
            title="Marcas"
            value={stats?.marcas || 0}
            icon={Tag}
            color="pink"
            delay={100}
          />
          <StatCard
            title="Categorias"
            value={stats?.categorias || 0}
            icon={Layers}
            color="violet"
            delay={150}
          />
        </div>

        {/* Control Bar */}
        <div className={`rounded-2xl border ${isDark ? 'border-purple-500/20 bg-gradient-to-br from-zinc-900/90 via-purple-950/20 to-zinc-900/90' : 'border-purple-200 bg-gradient-to-br from-white via-purple-50/30 to-white'} backdrop-blur-xl p-4 relative z-[45]`}>
          <div className="flex flex-col gap-4">
            {/* Top Row: Tabs + Search */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
              {/* Tabs */}
              <div className="flex items-center gap-2 flex-wrap">
                <TabButton
                  active={activeTab === 'db'}
                  onClick={() => { setActiveTab('db'); setPage(1); clearAllFilters(); }}
                  icon={Database}
                  label="Base de Datos"
                  count={dbTotal}
                  loading={dbLoading}
                />
                <TabButton
                  active={activeTab === 'CIMU'}
                  onClick={() => { setActiveTab('CIMU'); setSapPage(1); clearAllFilters(); }}
                  icon={Cloud}
                  label="CIMU"
                  count={cimuTotal}
                  loading={activeTab === 'CIMU' && cimuLoading}
                />
                <TabButton
                  active={activeTab === 'TEST'}
                  onClick={() => { setActiveTab('TEST'); setSapPage(1); clearAllFilters(); }}
                  icon={Cloud}
                  label="TEST"
                  count={testTotal}
                  loading={activeTab === 'TEST' && testLoading}
                />
                <TabButton
                  active={activeTab === 'TRADE'}
                  onClick={() => { setActiveTab('TRADE'); setSapPage(1); clearAllFilters(); }}
                  icon={Cloud}
                  label="TRADE"
                  count={tradeTotal}
                  loading={activeTab === 'TRADE' && tradeLoading}
                />
                {isSapTab && (
                  <button
                    onClick={handleRefreshSap}
                    disabled={activeSapFetching}
                    className={`p-2 rounded-lg ${isDark ? 'bg-zinc-800/60 text-zinc-400 border-zinc-700/50 hover:bg-zinc-800 hover:text-zinc-200' : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200 hover:text-gray-700'} border transition-all disabled:opacity-50`}
                    title="Refrescar SAP"
                  >
                    <RefreshCw className={`h-4 w-4 ${activeSapFetching ? 'animate-spin' : ''}`} />
                  </button>
                )}
              </div>

              {/* Search */}
              <div className="relative flex-1 w-full lg:max-w-xl">
                <Search className={`absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${isDark ? 'text-purple-400' : 'text-purple-500'}`} />
                <input
                  type="search"
                  placeholder="Buscar..."
                  className={`w-full pl-11 pr-4 py-3 rounded-xl border ${isDark ? 'border-purple-500/20 bg-zinc-900/80 text-white placeholder:text-zinc-500 focus:ring-purple-500/30 focus:border-purple-500/40 hover:border-purple-500/40' : 'border-purple-200 bg-white text-gray-900 placeholder:text-gray-400 focus:ring-purple-300 focus:border-purple-300 hover:border-purple-300'} text-sm focus:outline-none focus:ring-2 transition-all`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* Nuevo Cliente + Acciones */}
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white text-sm font-medium transition-all shadow-lg shadow-purple-500/20"
              >
                <Plus className="h-4 w-4" />
                Nuevo Cliente
              </button>

              {/* Botones de Acción: Filtrar, Agrupar, Ordenar */}
              <div className="flex items-center gap-2">
                {/* Botón de Filtros */}
                <div className="relative">
                  <button
                    onClick={() => setShowFilterPopup(!showFilterPopup)}
                    className={`relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
                      filters.length > 0
                        ? 'bg-purple-600 text-white'
                        : isDark
                          ? 'bg-purple-900/50 hover:bg-purple-900/70 border border-purple-500/30 text-purple-300'
                          : 'bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-600'
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
                    <div className={`absolute right-0 top-full mt-1 z-[60] w-[520px] max-w-[calc(100vw-2rem)] ${isDark ? 'bg-[#1a1025] border-purple-900/50' : 'bg-white border-purple-200'} border rounded-lg shadow-xl p-4`}>
                      <div className="flex items-center justify-between mb-3">
                        <span className={`text-sm font-medium ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>Filtros de búsqueda</span>
                        <button onClick={() => setShowFilterPopup(false)} className={`${isDark ? 'text-zinc-400 hover:text-white' : 'text-gray-400 hover:text-gray-700'}`}>
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                        {filters.map((filter, index) => (
                          <div key={filter.id} className="flex items-center gap-2">
                            {index > 0 && <span className={`text-[10px] ${isDark ? 'text-purple-400' : 'text-purple-600'} font-medium w-8`}>AND</span>}
                            {index === 0 && <span className="w-8"></span>}
                            <select
                              value={filter.field}
                              onChange={(e) => updateFilter(filter.id, { field: e.target.value })}
                              className={`w-[130px] text-xs ${isDark ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'} border rounded px-2 py-1.5`}
                            >
                              {FILTER_FIELDS.map((f) => (
                                <option key={f.field} value={f.field}>{f.label}</option>
                              ))}
                            </select>
                            <select
                              value={filter.operator}
                              onChange={(e) => updateFilter(filter.id, { operator: e.target.value as FilterOperator })}
                              className={`w-[110px] text-xs ${isDark ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'} border rounded px-2 py-1.5`}
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
                              className={`flex-1 text-xs ${isDark ? 'bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-purple-500' : 'bg-gray-50 border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-purple-400'} border rounded px-2 py-1.5 focus:outline-none`}
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
                          <p className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-gray-400'} text-center py-3`}>Sin filtros. Haz clic en "Añadir".</p>
                        )}
                      </div>
                      <div className={`flex items-center justify-between mt-3 pt-3 border-t ${isDark ? 'border-purple-900/30' : 'border-purple-100'}`}>
                        <button onClick={addFilter} className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-purple-600 hover:bg-purple-700 text-white rounded">
                          <Plus className="h-3 w-3" /> Añadir
                        </button>
                        <button onClick={clearFilters} disabled={filters.length === 0} className={`px-2 py-1 text-xs font-medium text-red-400 hover:text-red-300 ${isDark ? 'hover:bg-red-900/30 border-red-500/30' : 'hover:bg-red-50 border-red-200'} border rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors`}>
                          Limpiar
                        </button>
                      </div>
                      {filters.length > 0 && (
                        <div className={`mt-2 pt-2 border-t ${isDark ? 'border-purple-900/30' : 'border-purple-100'}`}>
                          <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{filteredData.length} de {currentData.length} registros</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Botón de Agrupar */}
                <div className="relative">
                  <button
                    onClick={() => setShowGroupPopup(!showGroupPopup)}
                    className={`relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
                      activeGroupings.length > 0
                        ? 'bg-purple-600 text-white'
                        : isDark
                          ? 'bg-purple-900/50 hover:bg-purple-900/70 border border-purple-500/30 text-purple-300'
                          : 'bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-600'
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
                    <div className={`absolute right-0 top-full mt-1 z-[60] ${isDark ? 'bg-[#1a1025] border-purple-900/50' : 'bg-white border-purple-200'} border rounded-lg shadow-xl p-2 min-w-[180px]`}>
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
                            activeGroupings.includes(field) ? 'bg-purple-600 border-purple-600' : isDark ? 'border-purple-500/50' : 'border-purple-300'
                          }`}>
                            {activeGroupings.includes(field) && <Check className="h-3 w-3 text-white" />}
                          </div>
                          {label}
                          {activeGroupings.indexOf(field) === 0 && <span className={`ml-auto text-[10px] ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>1°</span>}
                          {activeGroupings.indexOf(field) === 1 && <span className={`ml-auto text-[10px] ${isDark ? 'text-pink-400' : 'text-pink-600'}`}>2°</span>}
                        </button>
                      ))}
                      <div className={`border-t ${isDark ? 'border-purple-900/30' : 'border-purple-100'} mt-2 pt-2`}>
                        <button onClick={() => setActiveGroupings([])} className={`w-full text-xs ${isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-gray-400 hover:text-gray-600'} py-1`}>
                          Quitar agrupación
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Botón de Ordenar */}
                <div className="relative">
                  <button
                    onClick={() => setShowSortPopup(!showSortPopup)}
                    className={`relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
                      sortField
                        ? 'bg-purple-600 text-white'
                        : isDark
                          ? 'bg-purple-900/50 hover:bg-purple-900/70 border border-purple-500/30 text-purple-300'
                          : 'bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-600'
                    }`}
                    title="Ordenar"
                  >
                    <ArrowUpDown className="h-4 w-4" />
                  </button>
                  {showSortPopup && (
                    <div className={`absolute right-0 top-full mt-1 z-[60] w-[300px] ${isDark ? 'bg-[#1a1025] border-purple-900/50' : 'bg-white border-purple-200'} border rounded-lg shadow-xl p-3`}>
                      <div className="flex items-center justify-between mb-3">
                        <span className={`text-sm font-medium ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>Ordenar por</span>
                        <button onClick={() => setShowSortPopup(false)} className={`${isDark ? 'text-zinc-400 hover:text-white' : 'text-gray-400 hover:text-gray-700'}`}>
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="space-y-1">
                        {FILTER_FIELDS.map((field) => (
                          <div
                            key={field.field}
                            className={`flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors ${
                              sortField === field.field
                                ? isDark ? 'bg-purple-600/20 border border-purple-500/30' : 'bg-purple-50 border border-purple-200'
                                : isDark ? 'hover:bg-purple-900/20' : 'hover:bg-purple-50'
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
                                    : isDark ? 'text-zinc-400 hover:text-white hover:bg-purple-900/50' : 'text-gray-400 hover:text-gray-700 hover:bg-purple-50'
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
                                    : isDark ? 'text-zinc-400 hover:text-white hover:bg-purple-900/50' : 'text-gray-400 hover:text-gray-700 hover:bg-purple-50'
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
                        <div className={`mt-3 pt-3 border-t ${isDark ? 'border-purple-900/30' : 'border-purple-100'}`}>
                          <button
                            onClick={() => { setSortField(null); setSortDirection('asc'); }}
                            className={`w-full px-2 py-1 text-xs font-medium text-red-400 hover:text-red-300 ${isDark ? 'hover:bg-red-900/30 border-red-500/30' : 'hover:bg-red-50 border-red-200'} border rounded transition-colors`}
                          >
                            Quitar ordenamiento
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Botón Limpiar Todo */}
                {hasActiveFilters && (
                  <button
                    onClick={clearAllFilters}
                    className={`flex items-center justify-center w-9 h-9 ${isDark ? 'text-zinc-400 hover:text-white bg-zinc-800/50 hover:bg-zinc-800 border-zinc-700/50' : 'text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 border-gray-200'} rounded-lg border transition-colors`}
                    title="Limpiar filtros"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Info Badge */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${isDark ? 'bg-purple-500/10 border-purple-500/20 text-purple-300' : 'bg-purple-50 border-purple-200 text-purple-700'} border text-xs`}>
              <Filter className="h-3.5 w-3.5" />
              {filteredData.length} resultados
              {activeGroupings.length > 0 && (
                <span className={isDark ? 'text-zinc-500' : 'text-gray-400'}>
                  | Agrupado por {activeGroupings.map(g => AVAILABLE_GROUPINGS.find(ag => ag.field === g)?.label).join(' → ')}
                </span>
              )}
              {sortField && (
                <span className={isDark ? 'text-zinc-500' : 'text-gray-400'}>| Ordenado por {FILTER_FIELDS.find(f => f.field === sortField)?.label} ({sortDirection === 'asc' ? '↑' : '↓'})</span>
              )}
            </div>
          </div>
        )}

        {/* Data Table */}
        <div className={`rounded-2xl border ${isDark ? 'border-purple-500/20 bg-gradient-to-br from-zinc-900/90 via-purple-950/20 to-zinc-900/90 shadow-purple-500/5' : 'border-purple-200 bg-white shadow-purple-100/50'} backdrop-blur-xl overflow-hidden shadow-xl relative z-10`}>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={`border-b ${isDark ? 'border-purple-500/20 bg-gradient-to-r from-purple-900/30 via-fuchsia-900/20 to-purple-900/30' : 'border-purple-100 bg-gradient-to-r from-purple-50 via-fuchsia-50 to-purple-50'}`}>
                      <th className={`px-2 py-2 text-left text-[10px] font-semibold ${isDark ? 'text-purple-300' : 'text-purple-600'} uppercase tracking-wider`}>CUIC</th>
                      <th className={`px-2 py-2 text-left text-[10px] font-semibold ${isDark ? 'text-purple-300' : 'text-purple-600'} uppercase tracking-wider`}>Cliente</th>
                      <th className={`px-2 py-2 text-left text-[10px] font-semibold ${isDark ? 'text-purple-300' : 'text-purple-600'} uppercase tracking-wider hidden lg:table-cell`}>Razón Social</th>
                      <th className={`px-2 py-2 text-left text-[10px] font-semibold ${isDark ? 'text-purple-300' : 'text-purple-600'} uppercase tracking-wider hidden md:table-cell`}>Agencia</th>
                      <th className={`px-2 py-2 text-left text-[10px] font-semibold ${isDark ? 'text-purple-300' : 'text-purple-600'} uppercase tracking-wider`}>Marca</th>
                      <th className={`px-2 py-2 text-left text-[10px] font-semibold ${isDark ? 'text-purple-300' : 'text-purple-600'} uppercase tracking-wider hidden xl:table-cell`}>Categoría</th>
                      {isDb && (
                        <th className={`px-2 py-2 text-left text-[10px] font-semibold ${isDark ? 'text-purple-300' : 'text-purple-600'} uppercase tracking-wider hidden xl:table-cell`}>Producto</th>
                      )}
                      <th className={`px-2 py-2 text-left text-[10px] font-semibold ${isDark ? 'text-purple-300' : 'text-purple-600'} uppercase tracking-wider`}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedData ? (
                      groupedData.map((group) => (
                        <React.Fragment key={`group-${group.name}`}>
                          {/* Level 1 Header */}
                          <GroupHeader
                            groupName={group.name}
                            count={group.items.length}
                            expanded={expandedGroups.has(group.name)}
                            onToggle={() => toggleGroup(group.name)}
                            level={1}
                          />
                          {/* Level 1 Content */}
                          {expandedGroups.has(group.name) && (
                            group.subgroups ? (
                              // Has subgroups (2 level grouping)
                              group.subgroups.map((subgroup) => (
                                <React.Fragment key={`subgroup-${group.name}-${subgroup.name}`}>
                                  {/* Level 2 Header */}
                                  <GroupHeader
                                    groupName={subgroup.name}
                                    count={subgroup.items.length}
                                    expanded={expandedGroups.has(`${group.name}|${subgroup.name}`)}
                                    onToggle={() => toggleGroup(`${group.name}|${subgroup.name}`)}
                                    level={2}
                                  />
                                  {/* Level 2 Content */}
                                  {expandedGroups.has(`${group.name}|${subgroup.name}`) &&
                                    subgroup.items.map((item, idx) => renderClientRow(item, isDb, idx))
                                  }
                                </React.Fragment>
                              ))
                            ) : (
                              // No subgroups (1 level grouping)
                              group.items.map((item, idx) => renderClientRow(item, isDb, idx))
                            )
                          )}
                        </React.Fragment>
                      ))
                    ) : (
                      filteredData.map((item, idx) => renderClientRow(item, isDb, idx))
                    )}
                    {filteredData.length === 0 && !groupedData && (
                      <tr>
                        <td colSpan={isDb ? 8 : 7} className={`px-4 py-12 text-center ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                          {isSapTab ? `No hay clientes nuevos en SAP (${activeTab})` : "No se encontraron clientes"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination for DB only (when not filtering/grouping) */}
              {isDb && !needsFullData && dbData?.pagination && dbTotalPages > 1 && (
                <div className={`flex items-center justify-between border-t ${isDark ? 'border-purple-500/20 bg-gradient-to-r from-purple-900/20 via-transparent to-fuchsia-900/20' : 'border-purple-100 bg-gradient-to-r from-purple-50/50 via-transparent to-fuchsia-50/50'} px-4 py-3`}>
                  <span className={`text-sm ${isDark ? 'text-purple-300/70' : 'text-purple-500'}`}>
                    Página <span className={`font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>{page}</span> de <span className={`font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>{dbTotalPages}</span>
                    <span className={`${isDark ? 'text-purple-300/50' : 'text-purple-400'} ml-2`}>({dbData.pagination.total} total)</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className={`px-4 py-2 rounded-lg border ${isDark ? 'border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 hover:border-purple-500/50' : 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 hover:border-purple-300'} text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-all`}
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => setPage(p => Math.min(dbTotalPages, p + 1))}
                      disabled={page === dbTotalPages}
                      className={`px-4 py-2 rounded-lg border ${isDark ? 'border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 hover:border-purple-500/50' : 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 hover:border-purple-300'} text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-all`}
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}

              {/* Full data info when filtering/grouping */}
              {isDb && needsFullData && (
                <div className={`flex items-center justify-between px-4 py-3 border-t ${isDark ? 'border-purple-500/20' : 'border-purple-100'}`}>
                  <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                    Mostrando {filteredData.length} clientes filtrados
                  </span>
                </div>
              )}

              {/* SAP pagination + info */}
              {isSapTab && (
                <div className={`flex items-center justify-between border-t ${isDark ? 'border-purple-500/20 bg-gradient-to-r from-purple-900/20 via-transparent to-fuchsia-900/20' : 'border-purple-100 bg-gradient-to-r from-purple-50/50 via-transparent to-fuchsia-50/50'} px-4 py-3`}>
                  <span className={`text-sm ${isDark ? 'text-purple-300/70' : 'text-purple-500'}`}>
                    Página <span className={`font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>{sapPage}</span> de <span className={`font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>{sapTotalPages}</span>
                    <span className={`${isDark ? 'text-purple-300/50' : 'text-purple-400'} ml-2`}>({allSapData.length} total)</span>
                    {activeSapData?.cached && <span className="ml-2 text-emerald-400 text-xs">(cache)</span>}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSapPage(p => Math.max(1, p - 1))}
                      disabled={sapPage === 1}
                      className={`px-4 py-2 rounded-lg border ${isDark ? 'border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 hover:border-purple-500/50' : 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 hover:border-purple-300'} text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-all`}
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => setSapPage(p => Math.min(sapTotalPages, p + 1))}
                      disabled={sapPage === sapTotalPages}
                      className={`px-4 py-2 rounded-lg border ${isDark ? 'border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 hover:border-purple-500/50' : 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 hover:border-purple-300'} text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-all`}
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

      {/* Modal Ver Cliente */}
      <ViewClienteModal
        isOpen={showViewModal}
        onClose={() => { setShowViewModal(false); setSelectedCliente(null); }}
        cliente={selectedCliente}
      />

      {/* Create Client Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateModal(false)}>
          <div className={`${isDark ? 'bg-zinc-900 border-purple-500/20 shadow-purple-500/10' : 'bg-white border-purple-200 shadow-purple-100/50'} border rounded-2xl w-full max-w-lg mx-4 overflow-hidden shadow-2xl`} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className={`${isDark ? 'bg-gradient-to-r from-purple-900/40 via-fuchsia-900/30 to-purple-900/40 border-purple-500/20' : 'bg-gradient-to-r from-purple-50 via-fuchsia-50 to-purple-50 border-purple-200'} px-6 py-4 border-b`}>
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} flex items-center gap-2`}>
                <Plus className={`h-5 w-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                Nuevo Cliente Manual
              </h3>
              <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'} mt-1`}>CUIC: <span className={`${isDark ? 'text-purple-300' : 'text-purple-600'} font-mono`}>0</span> (sin SAP)</p>
            </div>
            {/* Form */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const data = {
                  CUIC: 0,
                  T0_U_RazonSocial: (form.elements.namedItem('razon_social') as HTMLInputElement).value,
                  T0_U_Cliente: (form.elements.namedItem('cliente') as HTMLInputElement).value,
                  T1_U_Cliente: (form.elements.namedItem('cliente') as HTMLInputElement).value,
                  T2_U_Marca: (form.elements.namedItem('marca') as HTMLInputElement).value || null,
                  T2_U_Producto: (form.elements.namedItem('producto') as HTMLInputElement).value || null,
                  T2_U_Categoria: (form.elements.namedItem('categoria') as HTMLInputElement).value || null,
                  T1_U_UnidadNegocio: (form.elements.namedItem('unidad_negocio') as HTMLInputElement).value || null,
                  T0_U_Agencia: (form.elements.namedItem('agencia') as HTMLInputElement).value || null,
                  T0_U_Asesor: (form.elements.namedItem('asesor') as HTMLInputElement).value || null,
                  sap_database: null,
                };
                try {
                  await createMutation.mutateAsync(data);
                  setShowCreateModal(false);
                } catch (err) {
                  console.error('Error creating client:', err);
                }
              }}
              className="p-6 space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'} mb-1 block`}>Razón Social *</label>
                  <input name="razon_social" required className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'} border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50`} placeholder="Razón social del cliente" />
                </div>
                <div className="col-span-2">
                  <label className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'} mb-1 block`}>Cliente *</label>
                  <input name="cliente" required className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'} border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50`} placeholder="Nombre del cliente" />
                </div>
                <div>
                  <label className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'} mb-1 block`}>Marca</label>
                  <input name="marca" className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'} border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50`} placeholder="Marca" />
                </div>
                <div>
                  <label className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'} mb-1 block`}>Producto</label>
                  <input name="producto" className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'} border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50`} placeholder="Producto" />
                </div>
                <div>
                  <label className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'} mb-1 block`}>Categoría</label>
                  <input name="categoria" className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'} border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50`} placeholder="Categoría" />
                </div>
                <div>
                  <label className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'} mb-1 block`}>Unidad de Negocio</label>
                  <input name="unidad_negocio" className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'} border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50`} placeholder="Unidad de negocio" />
                </div>
                <div>
                  <label className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'} mb-1 block`}>Agencia</label>
                  <input name="agencia" className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'} border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50`} placeholder="Agencia" />
                </div>
                <div>
                  <label className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'} mb-1 block`}>Asesor</label>
                  <input name="asesor" className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'} border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50`} placeholder="Asesor" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className={`px-4 py-2 rounded-lg border ${isDark ? 'border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500' : 'border-gray-300 text-gray-500 hover:text-gray-700 hover:border-gray-400'} text-sm transition-all`}>
                  Cancelar
                </button>
                <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white text-sm font-medium transition-all disabled:opacity-50">
                  {createMutation.isPending ? 'Creando...' : 'Crear Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
