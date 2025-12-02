import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Plus, Pencil, Trash2, Eye, History, Building2,
  Phone, Mail, MapPin, Globe, X, FileText, Calendar, Tag, CheckCircle, Clock, Users, Loader2
} from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { proveedoresService, ProveedorInput } from '../../services/proveedores.service';
import { Proveedor } from '../../types';

// Info Item Component for Details Modal
function InfoItem({ icon: Icon, label, value, isLink }: { icon: React.ElementType; label: string; value: string | null | undefined; isLink?: boolean }) {
  return (
    <div className="p-4 rounded-xl bg-zinc-800/50 border border-purple-500/20 hover:border-purple-500/40 transition-colors">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-purple-400" />
        <span className="text-xs font-medium text-purple-300/70 uppercase tracking-wider">{label}</span>
      </div>
      {isLink && value ? (
        <a href={value.startsWith('http') ? value : `https://${value}`} target="_blank" rel="noopener noreferrer" className="text-sm text-fuchsia-400 hover:text-fuchsia-300 hover:underline transition-colors">
          {value}
        </a>
      ) : (
        <p className="text-sm text-white font-medium">{value || '-'}</p>
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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-2xl bg-gradient-to-br from-zinc-900 via-purple-950/20 to-zinc-900 border border-purple-500/30 rounded-2xl shadow-2xl shadow-purple-500/10 max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-purple-500/20 bg-gradient-to-r from-purple-900/40 via-fuchsia-900/30 to-purple-900/40">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/30 to-fuchsia-500/30 border border-purple-500/30">
              <Building2 className="h-6 w-6 text-purple-300" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{proveedor.nombre}</h2>
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
          <button onClick={onClose} className="p-2 hover:bg-purple-500/20 rounded-xl transition-colors group">
            <X className="h-5 w-5 text-purple-300 group-hover:text-white transition-colors" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
          {/* Contact Info */}
          <div className="grid grid-cols-2 gap-4">
            <InfoItem icon={Tag} label="Categoría" value={proveedor.categoria} />
            <InfoItem icon={Users} label="Contacto Principal" value={proveedor.contacto_principal} />
            <InfoItem icon={Phone} label="Teléfono" value={proveedor.telefono} />
            <InfoItem icon={Mail} label="Email" value={proveedor.email} />
            <InfoItem icon={Globe} label="Sitio Web" value={proveedor.sitio_web} isLink />
            <InfoItem icon={Calendar} label="Fecha de Alta" value={proveedor.fecha_alta ? new Date(proveedor.fecha_alta).toLocaleDateString() : null} />
          </div>

          {/* Address */}
          <div className="p-5 rounded-xl bg-zinc-800/50 border border-purple-500/20">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="h-4 w-4 text-purple-400" />
              <span className="text-sm font-medium text-purple-300">Dirección</span>
            </div>
            <p className="text-white font-medium">{proveedor.direccion || '-'}</p>
            <p className="text-purple-300/70 text-sm mt-1">
              {proveedor.ciudad && `${proveedor.ciudad}`}
              {proveedor.codigo_postal && `, CP ${proveedor.codigo_postal}`}
            </p>
          </div>

          {/* Notes */}
          {proveedor.notas && (
            <div className="p-5 rounded-xl bg-zinc-800/50 border border-purple-500/20">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-medium text-purple-300">Notas</span>
              </div>
              <p className="text-zinc-300 text-sm whitespace-pre-wrap leading-relaxed">{proveedor.notas}</p>
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
  const { data, isLoading } = useQuery({
    queryKey: ['proveedor-history', proveedorId],
    queryFn: () => proveedoresService.getHistory(proveedorId),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-2xl bg-gradient-to-br from-zinc-900 via-purple-950/20 to-zinc-900 border border-purple-500/30 rounded-2xl shadow-2xl shadow-purple-500/10 max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-purple-500/20 bg-gradient-to-r from-purple-900/40 via-fuchsia-900/30 to-purple-900/40">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-fuchsia-500/30 to-purple-500/30 border border-fuchsia-500/30">
              <History className="h-6 w-6 text-fuchsia-300" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Historial</h2>
              <p className="text-sm text-purple-300/70">{proveedorName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-purple-500/20 rounded-xl transition-colors group">
            <X className="h-5 w-5 text-purple-300 group-hover:text-white transition-colors" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-10 w-10 text-purple-400 animate-spin mb-4" />
              <p className="text-purple-300/70 text-sm">Cargando historial...</p>
            </div>
          ) : data && data.tareas.length > 0 ? (
            <div className="space-y-3">
              <div className="text-sm text-purple-300/70 mb-4 flex items-center gap-2">
                <span className="px-2 py-1 rounded-lg bg-purple-500/20 text-purple-300 font-semibold">{data.totalTareas}</span>
                tarea{data.totalTareas !== 1 ? 's' : ''} encontrada{data.totalTareas !== 1 ? 's' : ''}
              </div>
              {data.tareas.map((tarea, index) => (
                <div
                  key={tarea.id}
                  className="p-4 rounded-xl bg-zinc-800/50 border border-purple-500/20 hover:border-purple-500/40 transition-all hover:shadow-lg hover:shadow-purple-500/5"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-white">{tarea.titulo || 'Sin título'}</h4>
                      <p className="text-sm text-zinc-400 mt-1 line-clamp-2">{tarea.descripcion || 'Sin descripción'}</p>
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
                      <p className="text-xs text-purple-300/50 mt-2">
                        {new Date(tarea.fecha_inicio).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-purple-500/10 mb-4">
                <History className="h-10 w-10 text-purple-500/50" />
              </div>
              <p className="text-purple-300 font-medium">Sin historial</p>
              <p className="text-purple-300/50 text-sm mt-1">Este proveedor no tiene tareas asociadas</p>
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

  const inputClasses = "w-full px-4 py-3 rounded-xl bg-zinc-800/80 border border-purple-500/20 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all hover:border-purple-500/40";
  const labelClasses = "block text-sm font-medium text-purple-300 mb-2";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-2xl bg-gradient-to-br from-zinc-900 via-purple-950/20 to-zinc-900 border border-purple-500/30 rounded-2xl shadow-2xl shadow-purple-500/10 max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-purple-500/20 bg-gradient-to-r from-purple-900/40 via-fuchsia-900/30 to-purple-900/40">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/30 to-fuchsia-500/30 border border-purple-500/30">
              {proveedor ? <Pencil className="h-6 w-6 text-purple-300" /> : <Plus className="h-6 w-6 text-purple-300" />}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {proveedor ? 'Editar Proveedor' : 'Nuevo Proveedor'}
              </h2>
              <p className="text-sm text-purple-300/70">
                {proveedor ? 'Modifica los datos del proveedor' : 'Agrega un nuevo proveedor al sistema'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-purple-500/20 rounded-xl transition-colors group">
            <X className="h-5 w-5 text-purple-300 group-hover:text-white transition-colors" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[65vh]">
          <div className="space-y-6">
            {/* Basic Info Section */}
            <div>
              <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Información Básica
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
                  <label className={labelClasses}>Categoría</label>
                  <input
                    type="text"
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
                  <label className={labelClasses}>Contacto Principal</label>
                  <input
                    type="text"
                    value={form.contacto_principal}
                    onChange={(e) => setForm({ ...form, contacto_principal: e.target.value })}
                    placeholder="Nombre del contacto"
                    className={inputClasses}
                  />
                </div>

                <div>
                  <label className={labelClasses}>Teléfono</label>
                  <input
                    type="text"
                    value={form.telefono}
                    onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                    placeholder="(123) 456-7890"
                    className={inputClasses}
                  />
                </div>

                <div>
                  <label className={labelClasses}>Email</label>
                  <input
                    type="email"
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
                Ubicación
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={labelClasses}>Dirección</label>
                  <input
                    type="text"
                    value={form.direccion}
                    onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                    placeholder="Calle y número"
                    className={inputClasses}
                  />
                </div>

                <div>
                  <label className={labelClasses}>Ciudad</label>
                  <input
                    type="text"
                    value={form.ciudad}
                    onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
                    placeholder="Ciudad"
                    className={inputClasses}
                  />
                </div>

                <div>
                  <label className={labelClasses}>Código Postal</label>
                  <input
                    type="text"
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
          <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-purple-500/20">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-xl text-sm font-medium text-purple-300 bg-zinc-800 border border-purple-500/20 hover:bg-purple-500/10 hover:border-purple-500/40 transition-all"
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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-md bg-gradient-to-br from-zinc-900 via-purple-950/20 to-zinc-900 border border-red-500/30 rounded-2xl shadow-2xl shadow-red-500/10 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/20 mb-4">
            <Trash2 className="h-8 w-8 text-red-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Eliminar Proveedor</h3>
          <p className="text-zinc-400 mb-6">
            ¿Estás seguro de eliminar a <span className="text-white font-semibold">{proveedorName}</span>? Esta acción no se puede deshacer.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-6 py-3 rounded-xl text-sm font-medium text-purple-300 bg-zinc-800 border border-purple-500/20 hover:bg-purple-500/10 hover:border-purple-500/40 transition-all disabled:opacity-50"
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
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [selectedProveedor, setSelectedProveedor] = useState<Proveedor | null>(null);
  const [detailsProveedor, setDetailsProveedor] = useState<Proveedor | null>(null);
  const [historyProveedor, setHistoryProveedor] = useState<{ id: number; name: string } | null>(null);
  const [deleteProveedor, setDeleteProveedor] = useState<{ id: number; name: string } | null>(null);
  const limit = 20;

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

  return (
    <div className="min-h-screen">
      <Header title="Proveedores" />

      <div className="p-6 space-y-5">
        {/* Control Bar */}
        <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-zinc-900/90 via-purple-950/20 to-zinc-900/90 backdrop-blur-xl p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* Search */}
            <div className="relative flex-1 w-full sm:max-w-md">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-purple-400" />
              <input
                type="search"
                placeholder="Buscar proveedores..."
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-purple-500/20 bg-zinc-900/80 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/40 transition-all hover:border-purple-500/40"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Add Button */}
            <button
              onClick={() => { setSelectedProveedor(null); setFormModalOpen(true); }}
              className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all"
            >
              <Plus className="h-4 w-4" />
              Nuevo Proveedor
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-zinc-900/90 via-purple-950/20 to-zinc-900/90 backdrop-blur-xl overflow-hidden shadow-xl shadow-purple-500/5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-10 w-10 text-purple-400 animate-spin mb-4" />
              <p className="text-purple-300/70 text-sm">Cargando proveedores...</p>
            </div>
          ) : (
            <>
              {/* Loading overlay for fetching */}
              {isFetching && !isLoading && (
                <div className="absolute inset-0 bg-zinc-950/50 backdrop-blur-sm z-10 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-purple-400 animate-spin" />
                </div>
              )}

              <div className="overflow-x-auto relative">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-purple-500/20 bg-gradient-to-r from-purple-900/30 via-fuchsia-900/20 to-purple-900/30">
                      <th className="px-5 py-4 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Nombre</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Categoría</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Ciudad</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Contacto</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Teléfono</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Estado</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proveedores.map((proveedor, index) => (
                      <tr
                        key={proveedor.id}
                        className="border-b border-purple-500/10 last:border-0 hover:bg-purple-500/5 transition-all"
                        style={{ animationDelay: `${index * 30}ms` }}
                      >
                        <td className="px-5 py-4">
                          <span className="font-semibold text-white">{proveedor.nombre}</span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-zinc-400 text-sm">{proveedor.categoria || '-'}</span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-1.5 text-purple-300 text-sm">
                            <MapPin className="h-3.5 w-3.5 text-purple-400" />
                            {proveedor.ciudad || '-'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-zinc-400 text-sm">{proveedor.contacto_principal || '-'}</span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-1.5 text-zinc-400 text-sm">
                            <Phone className="h-3.5 w-3.5 text-purple-400/50" />
                            {proveedor.telefono || '-'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                            proveedor.estado === 'activo'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30'
                          }`}>
                            {proveedor.estado === 'activo' ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                            {proveedor.estado || 'Sin estado'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setDetailsProveedor(proveedor)}
                              className="p-2 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 hover:text-purple-300 border border-purple-500/20 hover:border-purple-500/40 transition-all"
                              title="Ver detalles"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setHistoryProveedor({ id: proveedor.id, name: proveedor.nombre })}
                              className="p-2 rounded-lg bg-fuchsia-500/10 text-fuchsia-400 hover:bg-fuchsia-500/20 hover:text-fuchsia-300 border border-fuchsia-500/20 hover:border-fuchsia-500/40 transition-all"
                              title="Ver historial"
                            >
                              <History className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => { setSelectedProveedor(proveedor); setFormModalOpen(true); }}
                              className="p-2 rounded-lg bg-zinc-500/10 text-zinc-400 hover:bg-zinc-500/20 hover:text-zinc-300 border border-zinc-500/20 hover:border-zinc-500/40 transition-all"
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setDeleteProveedor({ id: proveedor.id, name: proveedor.nombre })}
                              className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 border border-red-500/20 hover:border-red-500/40 transition-all"
                              title="Eliminar"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {proveedores.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-5 py-16 text-center">
                          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-500/10 mb-4">
                            <Building2 className="w-8 h-8 text-purple-400" />
                          </div>
                          <p className="text-purple-300/70 text-sm">No se encontraron proveedores</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-purple-500/20 bg-gradient-to-r from-purple-900/20 via-transparent to-fuchsia-900/20 px-5 py-4">
                  <p className="text-sm text-purple-300/70">
                    Página <span className="font-semibold text-purple-300">{page}</span> de <span className="font-semibold text-purple-300">{totalPages}</span>
                    <span className="text-purple-300/50 ml-2">({totalProveedores} total)</span>
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-4 py-2 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-300 text-sm font-medium hover:bg-purple-500/20 hover:border-purple-500/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-4 py-2 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-300 text-sm font-medium hover:bg-purple-500/20 hover:border-purple-500/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
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
