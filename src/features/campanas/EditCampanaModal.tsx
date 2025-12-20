import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X, Megaphone, Calendar, FileText, Save, Building2,
  Package, Tag, Loader2, ChevronLeft, ChevronRight, Check, Info
} from 'lucide-react';
import { Campana } from '../../types';
import { solicitudesService } from '../../services/solicitudes.service';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  campana: Campana | null;
}

// Fetch campaign details
async function fetchCampanaDetails(id: number): Promise<Campana> {
  const response = await fetch(`http://localhost:3000/api/campanas/${id}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
    },
  });
  if (!response.ok) throw new Error('Error al cargar detalles de campaña');
  const data = await response.json();
  return data.data;
}

// Status options for campaign
const STATUS_OPTIONS = [
  { value: 'activo', label: 'Activo' },
  { value: 'por iniciar', label: 'Por iniciar' },
  { value: 'finalizado', label: 'Finalizado' },
  { value: 'cancelada', label: 'Cancelada' },
  { value: 'sin cotizacion activa', label: 'Sin cotización activa' },
];

// Step configuration
const STEPS = [
  { num: 1, label: 'Información', icon: Info },
  { num: 2, label: 'Campaña', icon: Megaphone },
  { num: 3, label: 'Periodos', icon: Calendar },
];

export function EditCampanaModal({ isOpen, onClose, campana }: Props) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);

  // Fetch complete campaign details
  const { data: campanaDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['campana-details', campana?.id],
    queryFn: () => fetchCampanaDetails(campana!.id),
    enabled: isOpen && !!campana?.id,
  });

  // Use the detailed data if available, otherwise fall back to the basic campana
  const campanaData = campanaDetails || campana;

  // Form state - Campos editables
  const [nombre, setNombre] = useState('');
  const [status, setStatus] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [notas, setNotas] = useState('');

  // Campos de periodo
  const [yearInicio, setYearInicio] = useState<number | undefined>();
  const [yearFin, setYearFin] = useState<number | undefined>();
  const [catorcenaInicio, setCatorcenaInicio] = useState<number | undefined>();
  const [catorcenaFin, setCatorcenaFin] = useState<number | undefined>();

  // Campos de SAP/Cliente (readonly display)
  const [cuic, setCuic] = useState<number | null>(null);
  const [unidadNegocio, setUnidadNegocio] = useState('');
  const [agencia, setAgencia] = useState('');
  const [marca, setMarca] = useState('');
  const [producto, setProducto] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [asesor, setAsesor] = useState('');
  const [categoria, setCategoria] = useState('');
  const [clienteNombre, setClienteNombre] = useState('');

  // Fetch catorcenas
  const { data: catorcenasData } = useQuery({
    queryKey: ['catorcenas'],
    queryFn: () => solicitudesService.getCatorcenas(),
    enabled: isOpen,
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

  // Load campaign data when opened or when details are loaded
  useEffect(() => {
    if (campanaData && isOpen) {
      // Campos editables
      setNombre(campanaData.nombre || campanaData.nombre_campania || '');
      setStatus(campanaData.status || '');
      setDescripcion(campanaData.descripcion || '');
      setNotas(campanaData.notas || '');

      // Campos de periodo
      setYearInicio(campanaData.catorcena_inicio_anio || undefined);
      setYearFin(campanaData.catorcena_fin_anio || undefined);
      setCatorcenaInicio(campanaData.catorcena_inicio_num || undefined);
      setCatorcenaFin(campanaData.catorcena_fin_num || undefined);

      // Campos SAP/Cliente (readonly)
      setCuic(campanaData.cuic || null);
      setUnidadNegocio(campanaData.T1_U_UnidadNegocio || '');
      setAgencia(campanaData.T0_U_Agencia || '');
      setMarca(campanaData.T2_U_Marca || '');
      setProducto(campanaData.T2_U_Producto || '');
      setRazonSocial(campanaData.T0_U_RazonSocial || campanaData.cliente_razon_social || '');
      setAsesor(campanaData.T0_U_Asesor || campanaData.asignado || '');
      setCategoria(campanaData.T2_U_Categoria || '');
      setClienteNombre(campanaData.cliente_nombre || campanaData.T0_U_Cliente || '');
    }
  }, [campanaData, isOpen]);

  // Reset step when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStep(1);
    }
  }, [isOpen]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const response = await fetch(`http://localhost:3000/api/campanas/${campana?.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al actualizar campaña');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campanas'] });
      queryClient.invalidateQueries({ queryKey: ['campana-details', campana?.id] });
      onClose();
    },
  });

  const handleSubmit = () => {
    updateMutation.mutate({
      nombre,
      status,
      descripcion,
      notas,
      catorcenaInicioNum: catorcenaInicio,
      catorcenaInicioAnio: yearInicio,
      catorcenaFinNum: catorcenaFin,
      catorcenaFinAnio: yearFin,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-3xl max-h-[85vh] bg-zinc-900 rounded-2xl border border-zinc-700 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/30">
              <Megaphone className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Editar Campaña</h2>
              <p className="text-xs text-zinc-500">ID: #{campanaData?.id} • {campanaData?.articulo || 'Sin artículo'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-zinc-400" />
          </button>
        </div>

        {/* Progress steps */}
        <div className="px-6 py-3 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
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
                  {step > s.num ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                  {s.label}
                </button>
                {i < STEPS.length - 1 && <div className="flex-1 h-px bg-zinc-700" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Loading state */}
        {isLoadingDetails && (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 text-purple-400 animate-spin" />
              <p className="text-sm text-zinc-400">Cargando información...</p>
            </div>
          </div>
        )}

        {/* Content */}
        {!isLoadingDetails && (
          <div className="flex-1 overflow-y-auto p-6">

            {/* Step 1: Información del Cliente/Producto */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold text-white">Información del Cliente</h3>
                  <p className="text-sm text-zinc-400">Datos asociados a esta campaña (solo lectura)</p>
                </div>

                {/* Grid de información del cliente */}
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
                    <p className="text-white mt-1">{campanaData?.creador_nombre || '-'}</p>
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
                      <p className="text-white font-mono text-sm mt-1">{campanaData?.articulo || '-'}</p>
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

                {/* Nombre de Campaña */}
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

                {/* Estatus */}
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
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Descripción */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-zinc-400" />
                    Descripción
                  </label>
                  <textarea
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-700 bg-zinc-800/50 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-all resize-none"
                    placeholder="Descripción de la campaña..."
                  />
                </div>

                {/* Notas */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-amber-400" />
                    Notas
                  </label>
                  <textarea
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-700 bg-zinc-800/50 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-all resize-none"
                    placeholder="Notas adicionales..."
                  />
                </div>
              </div>
            )}

            {/* Step 3: Periodos */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold text-white">Rango de Periodos</h3>
                  <p className="text-sm text-zinc-400">Define el período de la campaña</p>
                </div>

                {/* Rango de años */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-emerald-400" />
                    Rango de Años
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
                        className="w-full px-4 py-3 rounded-xl border border-zinc-700 bg-zinc-800/50 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-all"
                      >
                        <option value="">Seleccionar</option>
                        {years.map(y => (
                          <option key={y} value={y}>{y}</option>
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
                        className="w-full px-4 py-3 rounded-xl border border-zinc-700 bg-zinc-800/50 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-all"
                      >
                        <option value="">Seleccionar</option>
                        {years.map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Rango de Catorcenas */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-rose-400" />
                    Rango de Catorcenas
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-xs text-zinc-500">Catorcena inicio</span>
                      <select
                        value={catorcenaInicio || ''}
                        onChange={(e) => setCatorcenaInicio(e.target.value ? parseInt(e.target.value) : undefined)}
                        disabled={!yearInicio}
                        className="w-full px-4 py-3 rounded-xl border border-zinc-700 bg-zinc-800/50 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="">Seleccionar</option>
                        {catorcenasInicioOptions.map(c => (
                          <option key={c.id} value={c.numero_catorcena}>
                            Catorcena {c.numero_catorcena}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-zinc-500">Catorcena fin</span>
                      <select
                        value={catorcenaFin || ''}
                        onChange={(e) => setCatorcenaFin(e.target.value ? parseInt(e.target.value) : undefined)}
                        disabled={!yearFin}
                        className="w-full px-4 py-3 rounded-xl border border-zinc-700 bg-zinc-800/50 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="">Seleccionar</option>
                        {catorcenasFinOptions.map(c => (
                          <option key={c.id} value={c.numero_catorcena}>
                            Catorcena {c.numero_catorcena}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Resumen del periodo */}
                {yearInicio && catorcenaInicio && yearFin && catorcenaFin && (
                  <div className="mt-6 p-4 rounded-xl bg-purple-500/10 border border-purple-500/30">
                    <p className="text-sm text-purple-300 text-center">
                      Periodo: <span className="font-semibold">Catorcena {catorcenaInicio}, {yearInicio}</span>
                      {' → '}
                      <span className="font-semibold">Catorcena {catorcenaFin}, {yearFin}</span>
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {!isLoadingDetails && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-900/50">
            <button
              type="button"
              onClick={() => step > 1 ? setStep(step - 1) : onClose()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all text-sm font-medium"
            >
              <ChevronLeft className="h-4 w-4" />
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
                onClick={handleSubmit}
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
                    Actualizar Datos
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Error message */}
        {updateMutation.isError && (
          <div className="px-6 py-3 bg-red-500/10 border-t border-red-500/20">
            <p className="text-sm text-red-400">
              {updateMutation.error instanceof Error ? updateMutation.error.message : 'Error al guardar'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
