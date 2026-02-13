import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Mail, Briefcase, Building, Shield, Loader2, Search, Pencil, X, Trash2, Plus, Network, UserPlus, Check, Crown, Ticket, Send, Image, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Header } from '../../components/layout/Header';
import { usuariosService, UsuarioAdmin, UpdateUsuarioInput, CreateUsuarioInput } from '../../services/usuarios.service';
import { equiposService, Equipo, CreateEquipoInput, MiembroEquipo } from '../../services/equipos.service';
import { ticketsService, Ticket as TicketType, CreateTicketInput } from '../../services/tickets.service';
import { UserAvatar } from '../../components/ui/user-avatar';
import { useSocketEquipos } from '../../hooks/useSocket';

type TabType = 'usuarios' | 'equipos' | 'tickets';

const inputClasses =
  'w-full px-4 py-3 rounded-xl bg-zinc-800/80 border border-purple-500/20 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all hover:border-purple-500/40';
const labelClasses = 'block text-sm font-medium text-purple-300 mb-2';

const AREAS_DISPONIBLES = [
  'Dirección General',
  'Dirección Comercial',
  'Dirección Comercial Aeropuerto',
  'Departamento de Tráfico',
  'Dirección de Mercadotecnia',
  'Compras',
  'Operaciones',
  'Facturación',
];

// Mapeo de puestos por área
const PUESTOS_POR_AREA: Record<string, string[]> = {
  'Dirección General': [
    'Director General',
  ],
  'Dirección Comercial': [
    'Director Comercial',
    'Asesor Comercial',
    'Analista de Servicio al Cliente',
    'Jefe Digital Comercial',
    'Especialista de BI',
  ],
  'Dirección Comercial Aeropuerto': [
    'Director Comercial Aeropuerto',
    'Gerente Comercial Aeropuerto',
    'Asesor Comercial (Aeropuerto)',
    'Analista de Aeropuerto',
  ],
  'Departamento de Tráfico': [
    'Gerente de Tráfico',
    'Coordinador de tráfico',
    'Especialista de tráfico',
    'Auxiliar de tráfico',
  ],
  'Dirección de Mercadotecnia': [
    'Coordinador de Diseño',
    'Diseñadores',
  ],
  'Compras': [
    'Compradores',
  ],
  'Operaciones': [
    'Call Center (CON)',
    'Director de Operaciones',
    'Gerente de Operaciones CON',
    'Gerentes de Operaciones Plazas (GDL y MTY)',
    'Jefes de Operaciones Plazas',
    'Gerente Digital (Operaciones)',
    'Jefe de Operaciones Digital',
  ],
  'Facturación': [
    'Coordinador de Facturación y Cobranza',
    'Mesa de Control',
    'Analista de Facturación y Cobranza',
  ],
};

// Función para obtener puestos según área
const getPuestosPorArea = (area: string): string[] => {
  return PUESTOS_POR_AREA[area] || [];
};

// Función para obtener roles según área (puestos del área + Administrador)
const getRolesPorArea = (area: string): string[] => {
  const puestos = PUESTOS_POR_AREA[area] || [];
  return [...puestos, 'Administrador'];
};

// Todos los puestos (para compatibilidad)
const PUESTOS_DISPONIBLES = Object.values(PUESTOS_POR_AREA).flat();

const ROLES_DISPONIBLES = [...PUESTOS_DISPONIBLES, 'Administrador'];

// Modal de Creación
function CreateModal({
  onClose,
  onSubmit,
  loading,
  error,
}: {
  onClose: () => void;
  onSubmit: (data: CreateUsuarioInput) => void;
  loading: boolean;
  error: string | null;
}) {
  const [form, setForm] = useState<CreateUsuarioInput>({
    nombre: '',
    correo_electronico: '',
    password: '',
    area: '',
    puesto: '',
    rol: '',
    foto_perfil: '',
  });

  // Puestos y roles filtrados según área seleccionada
  const puestosDisponibles = form.area ? getPuestosPorArea(form.area) : [];
  const rolesDisponibles = form.area ? getRolesPorArea(form.area) : [];

  // Cuando cambia el área, resetear puesto y rol
  const handleAreaChange = (newArea: string) => {
    setForm({ ...form, area: newArea, puesto: '', rol: '' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-lg bg-gradient-to-br from-zinc-900 via-purple-950/20 to-zinc-900 border border-purple-500/30 rounded-2xl shadow-2xl shadow-purple-500/10 overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-purple-500/20 bg-gradient-to-r from-purple-900/40 via-fuchsia-900/30 to-purple-900/40 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-purple-500/20">
              <Plus className="h-6 w-6 text-purple-300" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Nuevo Usuario</h2>
              <p className="text-sm text-purple-300/70">Completa todos los campos</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-purple-500/20 rounded-xl transition-colors group">
            <X className="h-5 w-5 text-purple-300 group-hover:text-white transition-colors" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className={labelClasses}>Nombre completo *</label>
              <input
                type="text"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                className={inputClasses}
                placeholder="Ej: Juan Pérez"
                required
              />
            </div>

            <div>
              <label className={labelClasses}>Correo electrónico *</label>
              <input
                type="email"
                value={form.correo_electronico}
                onChange={(e) => setForm({ ...form, correo_electronico: e.target.value })}
                className={inputClasses}
                placeholder="correo@ejemplo.com"
                required
              />
            </div>

            <div>
              <label className={labelClasses}>Contraseña *</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className={inputClasses}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            <div>
              <label className={labelClasses}>Área *</label>
              <select
                value={form.area}
                onChange={(e) => handleAreaChange(e.target.value)}
                className={inputClasses}
                required
              >
                <option value="">Seleccionar área...</option>
                {AREAS_DISPONIBLES.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClasses}>Puesto *</label>
              <select
                value={form.puesto}
                onChange={(e) => setForm({ ...form, puesto: e.target.value })}
                className={inputClasses}
                required
                disabled={!form.area || puestosDisponibles.length === 0}
              >
                <option value="">{!form.area ? 'Primero selecciona un área...' : puestosDisponibles.length === 0 ? 'Sin puestos disponibles' : 'Seleccionar puesto...'}</option>
                {puestosDisponibles.map((puesto) => (
                  <option key={puesto} value={puesto}>
                    {puesto}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClasses}>Rol *</label>
              <select
                value={form.rol}
                onChange={(e) => setForm({ ...form, rol: e.target.value })}
                className={inputClasses}
                required
                disabled={!form.area}
              >
                <option value="">{!form.area ? 'Primero selecciona un área...' : 'Seleccionar rol...'}</option>
                {rolesDisponibles.map((rol) => (
                  <option key={rol} value={rol}>
                    {rol}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className={labelClasses}>URL foto de perfil (opcional)</label>
              <input
                type="url"
                value={form.foto_perfil}
                onChange={(e) => setForm({ ...form, foto_perfil: e.target.value })}
                className={inputClasses}
                placeholder="https://ejemplo.com/foto.jpg"
              />
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-purple-500/20">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-purple-300 bg-zinc-800 border border-purple-500/20 hover:bg-purple-500/10 hover:border-purple-500/40 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all flex items-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Creando...' : 'Crear Usuario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal de Edición
function EditModal({
  usuario,
  onClose,
  onSubmit,
  loading,
}: {
  usuario: UsuarioAdmin;
  onClose: () => void;
  onSubmit: (data: UpdateUsuarioInput) => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<UpdateUsuarioInput>({
    nombre: usuario.nombre,
    area: usuario.area || '',
    puesto: usuario.puesto || '',
    rol: usuario.rol,
  });

  // Puestos y roles filtrados según área seleccionada
  const puestosDisponibles = form.area ? getPuestosPorArea(form.area) : [];
  const rolesDisponibles = form.area ? getRolesPorArea(form.area) : [];

  // Cuando cambia el área, resetear puesto y rol
  const handleAreaChange = (newArea: string) => {
    setForm({ ...form, area: newArea, puesto: '', rol: '' });
  };

  useEffect(() => {
    setForm({
      nombre: usuario.nombre,
      area: usuario.area || '',
      puesto: usuario.puesto || '',
      rol: usuario.rol,
    });
  }, [usuario]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-md bg-gradient-to-br from-zinc-900 via-purple-950/20 to-zinc-900 border border-purple-500/30 rounded-2xl shadow-2xl shadow-purple-500/10 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-purple-500/20 bg-gradient-to-r from-purple-900/40 via-fuchsia-900/30 to-purple-900/40">
          <div className="flex items-center gap-4">
            <UserAvatar nombre={usuario.nombre} foto_perfil={usuario.foto_perfil} size="lg" />
            <div>
              <h2 className="text-xl font-bold text-white">Editar Usuario</h2>
              <p className="text-sm text-purple-300/70">{usuario.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-purple-500/20 rounded-xl transition-colors group">
            <X className="h-5 w-5 text-purple-300 group-hover:text-white transition-colors" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={labelClasses}>Nombre</label>
            <input
              type="text"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className={inputClasses}
              required
            />
          </div>

          <div>
            <label className={labelClasses}>Área</label>
            <select
              value={form.area}
              onChange={(e) => handleAreaChange(e.target.value)}
              className={inputClasses}
            >
              <option value="">Seleccionar área...</option>
              {AREAS_DISPONIBLES.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClasses}>Puesto</label>
            <select
              value={form.puesto}
              onChange={(e) => setForm({ ...form, puesto: e.target.value })}
              className={inputClasses}
              disabled={!form.area || puestosDisponibles.length === 0}
            >
              <option value="">{!form.area ? 'Primero selecciona un área...' : puestosDisponibles.length === 0 ? 'Sin puestos disponibles' : 'Seleccionar puesto...'}</option>
              {puestosDisponibles.map((puesto) => (
                <option key={puesto} value={puesto}>
                  {puesto}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClasses}>Rol</label>
            <select
              value={form.rol}
              onChange={(e) => setForm({ ...form, rol: e.target.value })}
              className={inputClasses}
              disabled={!form.area}
            >
              <option value="">{!form.area ? 'Primero selecciona un área...' : 'Seleccionar rol...'}</option>
              {rolesDisponibles.map((rol) => (
                <option key={rol} value={rol}>
                  {rol}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-purple-500/20">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-purple-300 bg-zinc-800 border border-purple-500/20 hover:bg-purple-500/10 hover:border-purple-500/40 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all flex items-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal de Confirmación de Eliminación
function DeleteConfirmModal({
  count,
  onClose,
  onConfirm,
  loading,
  title = 'Eliminar Usuarios',
  message,
}: {
  count: number;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  title?: string;
  message?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-md bg-gradient-to-br from-zinc-900 via-purple-950/20 to-zinc-900 border border-red-500/30 rounded-2xl shadow-2xl shadow-red-500/10 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/20 mb-4">
            <Trash2 className="h-8 w-8 text-red-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
          <p className="text-zinc-400 mb-6">
            {message || (
              <>
                ¿Estás seguro de eliminar <span className="text-white font-semibold">{count} usuario(s)</span>? Esta acción
                no se puede deshacer.
              </>
            )}
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

// Modal para crear/editar equipo
function EquipoModal({
  equipo,
  onClose,
  onSubmit,
  loading,
}: {
  equipo: Equipo | null;
  onClose: () => void;
  onSubmit: (data: CreateEquipoInput) => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<CreateEquipoInput>({
    nombre: equipo?.nombre || '',
    descripcion: equipo?.descripcion || '',
    color: equipo?.color || '#8B5CF6',
  });

  const COLORES_DISPONIBLES = [
    '#8B5CF6', // purple
    '#EC4899', // pink
    '#3B82F6', // blue
    '#10B981', // green
    '#F59E0B', // yellow
    '#EF4444', // red
    '#6366F1', // indigo
    '#14B8A6', // teal
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-md bg-gradient-to-br from-zinc-900 via-purple-950/20 to-zinc-900 border border-purple-500/30 rounded-2xl shadow-2xl shadow-purple-500/10 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-purple-500/20 bg-gradient-to-r from-purple-900/40 via-fuchsia-900/30 to-purple-900/40">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl" style={{ backgroundColor: `${form.color}30` }}>
              <Network className="h-6 w-6" style={{ color: form.color }} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{equipo ? 'Editar Equipo' : 'Nuevo Equipo'}</h2>
              <p className="text-sm text-purple-300/70">Define el nombre y color del equipo</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-purple-500/20 rounded-xl transition-colors group">
            <X className="h-5 w-5 text-purple-300 group-hover:text-white transition-colors" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={labelClasses}>Nombre del equipo *</label>
            <input
              type="text"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className={inputClasses}
              placeholder="Ej: Equipo Comercial Norte"
              required
            />
          </div>

          <div>
            <label className={labelClasses}>Descripcion (opcional)</label>
            <textarea
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              className={`${inputClasses} resize-none`}
              placeholder="Descripcion breve del equipo..."
              rows={3}
            />
          </div>

          <div>
            <label className={labelClasses}>Color del equipo</label>
            <div className="flex gap-2 flex-wrap">
              {COLORES_DISPONIBLES.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm({ ...form, color })}
                  className={`w-10 h-10 rounded-xl transition-all ${
                    form.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900 scale-110' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-purple-500/20">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-purple-300 bg-zinc-800 border border-purple-500/20 hover:bg-purple-500/10 hover:border-purple-500/40 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !form.nombre.trim()}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all flex items-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Guardando...' : equipo ? 'Guardar' : 'Crear Equipo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal para agregar miembros a un equipo
function AddMembersModal({
  equipo,
  onClose,
  onSubmit,
  loading,
}: {
  equipo: Equipo;
  onClose: () => void;
  onSubmit: (usuarioIds: number[]) => void;
  loading: boolean;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');

  const { data: availableUsers, isLoading: loadingUsers } = useQuery({
    queryKey: ['available-users', equipo.id],
    queryFn: () => equiposService.getAvailableUsers(equipo.id),
  });

  const filteredUsers = useMemo(() => {
    if (!availableUsers) return [];
    if (!search) return availableUsers;
    const searchLower = search.toLowerCase();
    return availableUsers.filter(
      (u) =>
        u.nombre.toLowerCase().includes(searchLower) ||
        u.email.toLowerCase().includes(searchLower) ||
        u.area?.toLowerCase().includes(searchLower)
    );
  }, [availableUsers, search]);

  const toggleSelect = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSubmit = () => {
    if (selectedIds.size > 0) {
      onSubmit(Array.from(selectedIds));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-lg bg-gradient-to-br from-zinc-900 via-purple-950/20 to-zinc-900 border border-purple-500/30 rounded-2xl shadow-2xl shadow-purple-500/10 overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-purple-500/20 bg-gradient-to-r from-purple-900/40 via-fuchsia-900/30 to-purple-900/40">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl" style={{ backgroundColor: `${equipo.color}30` }}>
              <UserPlus className="h-6 w-6" style={{ color: equipo.color || '#8B5CF6' }} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Agregar Miembros</h2>
              <p className="text-sm text-purple-300/70">a {equipo.nombre}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-purple-500/20 rounded-xl transition-colors group">
            <X className="h-5 w-5 text-purple-300 group-hover:text-white transition-colors" />
          </button>
        </div>

        <div className="p-4 border-b border-purple-500/20">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-purple-400" />
            <input
              type="search"
              placeholder="Buscar usuarios..."
              className="w-full pl-11 pr-4 py-3 rounded-xl border border-purple-500/20 bg-zinc-900/80 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loadingUsers ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 text-purple-400 animate-spin" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-10">
              <Users className="h-12 w-12 text-purple-400/50 mx-auto mb-3" />
              <p className="text-zinc-400">No hay usuarios disponibles</p>
            </div>
          ) : (
            filteredUsers.map((user) => (
              <button
                key={user.id}
                onClick={() => toggleSelect(user.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  selectedIds.has(user.id)
                    ? 'bg-purple-500/20 border-purple-500/50'
                    : 'bg-zinc-800/50 border-purple-500/10 hover:border-purple-500/30'
                }`}
              >
                <UserAvatar nombre={user.nombre} foto_perfil={user.foto_perfil} size="sm" />
                <div className="flex-1 text-left">
                  <p className="text-white font-medium text-sm">{user.nombre}</p>
                  <p className="text-zinc-500 text-xs">{user.area} - {user.puesto}</p>
                </div>
                {selectedIds.has(user.id) && (
                  <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                )}
              </button>
            ))
          )}
        </div>

        <div className="p-4 border-t border-purple-500/20 flex justify-between items-center">
          <span className="text-sm text-purple-300">
            {selectedIds.size} usuario(s) seleccionado(s)
          </span>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-purple-300 bg-zinc-800 border border-purple-500/20 hover:bg-purple-500/10 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || selectedIds.size === 0}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/25 transition-all flex items-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Agregando...' : 'Agregar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Componente de tarjeta de equipo
function EquipoCard({
  equipo,
  onEdit,
  onDelete,
  onAddMembers,
  onRemoveMember,
}: {
  equipo: Equipo;
  onEdit: () => void;
  onDelete: () => void;
  onAddMembers: () => void;
  onRemoveMember: (userId: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-zinc-900/90 via-purple-950/20 to-zinc-900/90 overflow-hidden"
      style={{ borderLeftColor: equipo.color || '#8B5CF6', borderLeftWidth: '4px' }}
    >
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl" style={{ backgroundColor: `${equipo.color}20` }}>
              <Network className="h-5 w-5" style={{ color: equipo.color || '#8B5CF6' }} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{equipo.nombre}</h3>
              {equipo.descripcion && (
                <p className="text-sm text-zinc-400 mt-1">{equipo.descripcion}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onAddMembers}
              className="p-2 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 transition-all"
              title="Agregar miembros"
            >
              <UserPlus className="h-4 w-4" />
            </button>
            <button
              onClick={onEdit}
              className="p-2 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 transition-all"
              title="Editar equipo"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-all"
              title="Eliminar equipo"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <span className="text-sm text-zinc-400">{equipo.miembros.length} miembro(s)</span>
          {equipo.miembros.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
            >
              {expanded ? 'Ocultar' : 'Ver miembros'}
            </button>
          )}
        </div>

        {/* Lista de miembros (colapsable) */}
        {expanded && equipo.miembros.length > 0 && (
          <div className="mt-4 space-y-2 border-t border-purple-500/20 pt-4">
            {equipo.miembros.map((miembro) => (
              <div
                key={miembro.id}
                className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/50 border border-purple-500/10"
              >
                <div className="flex items-center gap-3">
                  <UserAvatar nombre={miembro.nombre} foto_perfil={miembro.foto_perfil} size="sm" />
                  <div>
                    <p className="text-white font-medium text-sm">{miembro.nombre}</p>
                    <p className="text-zinc-500 text-xs">{miembro.area} - {miembro.puesto}</p>
                  </div>
                </div>
                <button
                  onClick={() => onRemoveMember(miembro.id)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  title="Remover del equipo"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Componente de la pestaña Red de Trabajo
function RedDeTrabajoTab() {
  const queryClient = useQueryClient();
  const [showEquipoModal, setShowEquipoModal] = useState(false);
  const [editingEquipo, setEditingEquipo] = useState<Equipo | null>(null);
  const [deletingEquipo, setDeletingEquipo] = useState<Equipo | null>(null);
  const [addingMembersEquipo, setAddingMembersEquipo] = useState<Equipo | null>(null);

  const { data: equipos, isLoading } = useQuery({
    queryKey: ['equipos'],
    queryFn: () => equiposService.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateEquipoInput) => equiposService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipos'] });
      setShowEquipoModal(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CreateEquipoInput }) => equiposService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipos'] });
      setEditingEquipo(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => equiposService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipos'] });
      setDeletingEquipo(null);
    },
  });

  const addMembersMutation = useMutation({
    mutationFn: ({ equipoId, usuarioIds }: { equipoId: number; usuarioIds: number[] }) =>
      equiposService.addMembers(equipoId, usuarioIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipos'] });
      queryClient.invalidateQueries({ queryKey: ['available-users'] });
      setAddingMembersEquipo(null);
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: ({ equipoId, usuarioId }: { equipoId: number; usuarioId: number }) =>
      equiposService.removeMembers(equipoId, [usuarioId]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipos'] });
    },
  });

  const handleCreateEquipo = (data: CreateEquipoInput) => {
    createMutation.mutate(data);
  };

  const handleUpdateEquipo = (data: CreateEquipoInput) => {
    if (editingEquipo) {
      updateMutation.mutate({ id: editingEquipo.id, data });
    }
  };

  const handleDeleteEquipo = () => {
    if (deletingEquipo) {
      deleteMutation.mutate(deletingEquipo.id);
    }
  };

  const handleAddMembers = (usuarioIds: number[]) => {
    if (addingMembersEquipo) {
      addMembersMutation.mutate({ equipoId: addingMembersEquipo.id, usuarioIds });
    }
  };

  const handleRemoveMember = (equipoId: number, usuarioId: number) => {
    removeMemberMutation.mutate({ equipoId, usuarioId });
  };

  return (
    <div className="space-y-5">
      {/* Control Bar */}
      <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-zinc-900/90 via-purple-950/20 to-zinc-900/90 backdrop-blur-xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Red de Trabajo</h2>
            <p className="text-sm text-zinc-400">Organiza a los usuarios en equipos de trabajo</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowEquipoModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all"
            >
              <Plus className="h-4 w-4" />
              Nuevo Equipo
            </button>
            <div className="px-4 py-2 rounded-xl bg-purple-500/10 border border-purple-500/20">
              <span className="text-purple-300 text-sm font-medium">{equipos?.length || 0} equipos</span>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de equipos */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-10 w-10 text-purple-400 animate-spin mb-4" />
          <p className="text-purple-300/70 text-sm">Cargando equipos...</p>
        </div>
      ) : equipos && equipos.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {equipos.map((equipo) => (
            <EquipoCard
              key={equipo.id}
              equipo={equipo}
              onEdit={() => setEditingEquipo(equipo)}
              onDelete={() => setDeletingEquipo(equipo)}
              onAddMembers={() => setAddingMembersEquipo(equipo)}
              onRemoveMember={(userId) => handleRemoveMember(equipo.id, userId)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-zinc-900/90 via-purple-950/20 to-zinc-900/90 p-16 text-center">
          <Network className="h-16 w-16 text-purple-400/50 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No hay equipos creados</h3>
          <p className="text-zinc-400 mb-6">Crea tu primer equipo para organizar a los usuarios</p>
          <button
            onClick={() => setShowEquipoModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 shadow-lg shadow-purple-500/25 transition-all"
          >
            <Plus className="h-4 w-4" />
            Crear Primer Equipo
          </button>
        </div>
      )}

      {/* Modales */}
      {showEquipoModal && (
        <EquipoModal
          equipo={null}
          onClose={() => setShowEquipoModal(false)}
          onSubmit={handleCreateEquipo}
          loading={createMutation.isPending}
        />
      )}

      {editingEquipo && (
        <EquipoModal
          equipo={editingEquipo}
          onClose={() => setEditingEquipo(null)}
          onSubmit={handleUpdateEquipo}
          loading={updateMutation.isPending}
        />
      )}

      {deletingEquipo && (
        <DeleteConfirmModal
          count={1}
          title="Eliminar Equipo"
          message={`¿Estás seguro de eliminar el equipo "${deletingEquipo.nombre}"? Los miembros no serán eliminados, solo desvinculados del equipo.`}
          onClose={() => setDeletingEquipo(null)}
          onConfirm={handleDeleteEquipo}
          loading={deleteMutation.isPending}
        />
      )}

      {addingMembersEquipo && (
        <AddMembersModal
          equipo={addingMembersEquipo}
          onClose={() => setAddingMembersEquipo(null)}
          onSubmit={handleAddMembers}
          loading={addMembersMutation.isPending}
        />
      )}
    </div>
  );
}

// Componente de la pestaña Usuarios (contenido original)
function UsuariosTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [editingUsuario, setEditingUsuario] = useState<UsuarioAdmin | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: usuarios, isLoading } = useQuery({
    queryKey: ['usuarios-admin'],
    queryFn: () => usuariosService.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateUsuarioInput) => usuariosService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios-admin'] });
      setShowCreateModal(false);
      setCreateError(null);
    },
    onError: (error: Error) => {
      setCreateError(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateUsuarioInput }) => usuariosService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios-admin'] });
      setEditingUsuario(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (ids: number[]) => usuariosService.deleteMany(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios-admin'] });
      setSelectedIds(new Set());
      setShowDeleteConfirm(false);
    },
  });

  const handleCreate = (data: CreateUsuarioInput) => {
    createMutation.mutate(data);
  };

  const handleUpdate = (data: UpdateUsuarioInput) => {
    if (editingUsuario) {
      updateMutation.mutate({ id: editingUsuario.id, data });
    }
  };

  const handleDeleteSelected = () => {
    deleteMutation.mutate(Array.from(selectedIds));
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredUsuarios.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredUsuarios.map((u) => u.id)));
    }
  };

  const toggleSelect = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const filteredUsuarios =
    usuarios?.filter((u) => {
      if (!debouncedSearch) return true;
      const searchLower = debouncedSearch.toLowerCase();
      return (
        u.nombre.toLowerCase().includes(searchLower) ||
        u.email.toLowerCase().includes(searchLower) ||
        u.area?.toLowerCase().includes(searchLower) ||
        u.puesto?.toLowerCase().includes(searchLower) ||
        u.rol.toLowerCase().includes(searchLower)
      );
    }) || [];

  const getRolBadgeStyle = (rol: string) => {
    switch (rol) {
      case 'Administrador':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'Normal':
        return 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30';
      default:
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    }
  };

  const allSelected = filteredUsuarios.length > 0 && selectedIds.size === filteredUsuarios.length;
  const someSelected = selectedIds.size > 0;

  return (
    <>
      <div className="space-y-5">
        {/* Control Bar */}
        <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-zinc-900/90 via-purple-950/20 to-zinc-900/90 backdrop-blur-xl p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* Search */}
            <div className="relative flex-1 w-full sm:max-w-md">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-purple-400" />
              <input
                type="search"
                placeholder="Buscar usuarios..."
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-purple-500/20 bg-zinc-900/80 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/40 transition-all hover:border-purple-500/40"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              {/* Add Button */}
              <button
                onClick={() => {
                  setCreateError(null);
                  setShowCreateModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all"
              >
                <Plus className="h-4 w-4" />
                Nuevo Usuario
              </button>

              {/* Delete Button - solo visible cuando hay selección */}
              {someSelected && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 shadow-lg shadow-red-500/25 transition-all"
                >
                  <Trash2 className="h-4 w-4" />
                  Eliminar ({selectedIds.size})
                </button>
              )}

              {/* Stats */}
              <div className="px-4 py-2 rounded-xl bg-purple-500/10 border border-purple-500/20">
                <span className="text-purple-300 text-sm font-medium">{usuarios?.length || 0} usuarios</span>
              </div>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-zinc-900/90 via-purple-950/20 to-zinc-900/90 backdrop-blur-xl overflow-hidden shadow-xl shadow-purple-500/5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-10 w-10 text-purple-400 animate-spin mb-4" />
              <p className="text-purple-300/70 text-sm">Cargando usuarios...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-purple-500/20 bg-gradient-to-r from-purple-900/30 via-fuchsia-900/20 to-purple-900/30">
                    <th className="px-5 py-4 text-left">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-purple-500/50 bg-zinc-800 text-purple-600 focus:ring-purple-500/50 focus:ring-offset-0 cursor-pointer"
                      />
                    </th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">
                      Usuario
                    </th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider hidden md:table-cell">
                      Email
                    </th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider hidden lg:table-cell">
                      Área
                    </th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider hidden lg:table-cell">
                      Puesto
                    </th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">
                      Rol
                    </th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider hidden xl:table-cell">
                      Equipos
                    </th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsuarios.map((usuario: UsuarioAdmin) => (
                    <tr
                      key={usuario.id}
                      className={`border-b border-purple-500/10 last:border-0 hover:bg-purple-500/5 transition-all ${
                        selectedIds.has(usuario.id) ? 'bg-purple-500/10' : ''
                      }`}
                    >
                      <td className="px-5 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(usuario.id)}
                          onChange={() => toggleSelect(usuario.id)}
                          className="w-4 h-4 rounded border-purple-500/50 bg-zinc-800 text-purple-600 focus:ring-purple-500/50 focus:ring-offset-0 cursor-pointer"
                        />
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <UserAvatar nombre={usuario.nombre} foto_perfil={usuario.foto_perfil} size="md" />
                          <div>
                            <span className="font-semibold text-white text-sm block">{usuario.nombre}</span>
                            <span className="text-xs text-zinc-500 md:hidden">{usuario.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 hidden md:table-cell">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-purple-400/50" />
                          <span className="text-zinc-300 text-sm">{usuario.email}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 hidden lg:table-cell">
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-purple-400/50" />
                          <span className="text-zinc-400 text-sm">{usuario.area || '-'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 hidden lg:table-cell">
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4 text-purple-400/50" />
                          <span className="text-zinc-400 text-sm">{usuario.puesto || '-'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getRolBadgeStyle(
                            usuario.rol
                          )}`}
                        >
                          <Shield className="h-3 w-3" />
                          {usuario.rol}
                        </span>
                      </td>
                      <td className="px-5 py-4 hidden xl:table-cell">
                        {usuario.equipos && usuario.equipos.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {usuario.equipos.map((equipo) => (
                              <span
                                key={equipo.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border"
                                style={{
                                  backgroundColor: `${equipo.color || '#8B5CF6'}20`,
                                  borderColor: `${equipo.color || '#8B5CF6'}50`,
                                  color: equipo.color || '#8B5CF6',
                                }}
                                title={equipo.rol_equipo === 'Administrador' ? 'Administrador del equipo' : 'Miembro'}
                              >
                                {equipo.rol_equipo === 'Administrador' && (
                                  <Crown className="h-3 w-3" />
                                )}
                                {equipo.nombre}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-zinc-500 text-sm">Sin equipos</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() => setEditingUsuario(usuario)}
                          className="p-2 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 transition-all"
                          title="Editar usuario"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredUsuarios.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-5 py-16 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-500/10 mb-4">
                          <Users className="w-8 h-8 text-purple-400" />
                        </div>
                        <p className="text-purple-300/70 text-sm">No se encontraron usuarios</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateModal
          onClose={() => {
            setShowCreateModal(false);
            setCreateError(null);
          }}
          onSubmit={handleCreate}
          loading={createMutation.isPending}
          error={createError}
        />
      )}

      {/* Edit Modal */}
      {editingUsuario && (
        <EditModal
          usuario={editingUsuario}
          onClose={() => setEditingUsuario(null)}
          onSubmit={handleUpdate}
          loading={updateMutation.isPending}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <DeleteConfirmModal
          count={selectedIds.size}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDeleteSelected}
          loading={deleteMutation.isPending}
        />
      )}
    </>
  );
}

// Componente de la pestaña Tickets
function TicketsTab() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<TicketType | null>(null);

  const { data: ticketsData, isLoading } = useQuery({
    queryKey: ['my-tickets'],
    queryFn: () => ticketsService.getMyTickets(),
  });

  const tickets = ticketsData?.data || [];

  const STATUS_CONFIG: Record<string, { color: string; textColor: string; bgColor: string; borderColor: string; icon: typeof Ticket }> = {
    'Nuevo': { color: 'bg-blue-500', textColor: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30', icon: Ticket },
    'En Progreso': { color: 'bg-yellow-500', textColor: 'text-yellow-400', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/30', icon: Clock },
    'Resuelto': { color: 'bg-green-500', textColor: 'text-green-400', bgColor: 'bg-green-500/10', borderColor: 'border-green-500/30', icon: CheckCircle2 },
    'Cerrado': { color: 'bg-zinc-500', textColor: 'text-zinc-400', bgColor: 'bg-zinc-500/10', borderColor: 'border-zinc-500/30', icon: X },
  };

  const PRIORIDAD_CONFIG: Record<string, { color: string; bgColor: string; borderColor: string }> = {
    'Baja': { color: 'text-zinc-400', bgColor: 'bg-zinc-500/10', borderColor: 'border-zinc-500/30' },
    'Normal': { color: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30' },
    'Alta': { color: 'text-orange-400', bgColor: 'bg-orange-500/10', borderColor: 'border-orange-500/30' },
    'Urgente': { color: 'text-red-400', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/30' },
  };

  return (
    <div className="space-y-5">
      {/* Control Bar */}
      <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-zinc-900/90 via-purple-950/20 to-zinc-900/90 backdrop-blur-xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Mis Tickets de Soporte</h2>
            <p className="text-sm text-zinc-400">Reporta problemas o solicita ayuda</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all"
            >
              <Plus className="h-4 w-4" />
              Nuevo Ticket
            </button>
            <div className="px-4 py-2 rounded-xl bg-purple-500/10 border border-purple-500/20">
              <span className="text-purple-300 text-sm font-medium">{tickets.length} tickets</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tickets List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-10 w-10 text-purple-400 animate-spin mb-4" />
          <p className="text-purple-300/70 text-sm">Cargando tickets...</p>
        </div>
      ) : tickets.length > 0 ? (
        <div className="space-y-3">
          {tickets.map((ticket) => {
            const statusConfig = STATUS_CONFIG[ticket.status] || STATUS_CONFIG['Nuevo'];
            const prioridadConfig = PRIORIDAD_CONFIG[ticket.prioridad] || PRIORIDAD_CONFIG['Normal'];
            const StatusIcon = statusConfig.icon;

            return (
              <div
                key={ticket.id}
                className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-zinc-900/90 via-purple-950/20 to-zinc-900/90 p-5 hover:border-purple-500/40 transition-all cursor-pointer"
                onClick={() => setSelectedTicket(ticket)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-zinc-500">#{ticket.id}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${statusConfig.bgColor} ${statusConfig.textColor} ${statusConfig.borderColor}`}>
                        <StatusIcon className="h-3 w-3" />
                        {ticket.status}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${prioridadConfig.bgColor} ${prioridadConfig.color} ${prioridadConfig.borderColor}`}>
                        {ticket.prioridad}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-1">{ticket.titulo}</h3>
                    <p className="text-sm text-zinc-400 line-clamp-2">{ticket.descripcion}</p>
                    <p className="text-xs text-zinc-500 mt-2">
                      Creado: {new Date(ticket.created_at).toLocaleString('es-MX')}
                    </p>
                  </div>
                  {ticket.imagen && (
                    <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                      <Image className="h-5 w-5 text-purple-400" />
                    </div>
                  )}
                </div>

                {ticket.respuesta && (
                  <div className="mt-4 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                    <p className="text-xs text-green-400 font-medium mb-1">Respuesta:</p>
                    <p className="text-sm text-zinc-300">{ticket.respuesta}</p>
                    {ticket.respondido_por && (
                      <p className="text-xs text-zinc-500 mt-1">
                        Por {ticket.respondido_por} - {ticket.respondido_at && new Date(ticket.respondido_at).toLocaleString('es-MX')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-zinc-900/90 via-purple-950/20 to-zinc-900/90 p-16 text-center">
          <Ticket className="h-16 w-16 text-purple-400/50 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No tienes tickets</h3>
          <p className="text-zinc-400 mb-6">Crea un ticket si necesitas ayuda o quieres reportar un problema</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 shadow-lg shadow-purple-500/25 transition-all"
          >
            <Plus className="h-4 w-4" />
            Crear Primer Ticket
          </button>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateTicketModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['my-tickets'] });
            setShowCreateModal(false);
          }}
        />
      )}

      {/* View Ticket Modal */}
      {selectedTicket && (
        <ViewTicketModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
        />
      )}
    </div>
  );
}

// Modal para crear ticket
function CreateTicketModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState<CreateTicketInput>({
    titulo: '',
    descripcion: '',
    prioridad: 'Normal',
    imagen: null,
  });
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createMutation = useMutation({
    mutationFn: (data: CreateTicketInput) => ticketsService.create(data),
    onSuccess: () => {
      onSuccess();
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('La imagen no puede ser mayor a 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm({ ...form, imagen: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim() || !form.descripcion.trim()) {
      setError('Titulo y descripcion son requeridos');
      return;
    }
    createMutation.mutate(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-lg bg-gradient-to-br from-zinc-900 via-purple-950/20 to-zinc-900 border border-purple-500/30 rounded-2xl shadow-2xl shadow-purple-500/10 overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-purple-500/20 bg-gradient-to-r from-purple-900/40 via-fuchsia-900/30 to-purple-900/40 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-purple-500/20">
              <Ticket className="h-6 w-6 text-purple-300" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Nuevo Ticket</h2>
              <p className="text-sm text-purple-300/70">Describe tu problema o solicitud</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-purple-500/20 rounded-xl transition-colors group">
            <X className="h-5 w-5 text-purple-300 group-hover:text-white transition-colors" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={labelClasses}>Titulo *</label>
            <input
              type="text"
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              className={inputClasses}
              placeholder="Ej: Error al cargar la pagina"
              required
            />
          </div>

          <div>
            <label className={labelClasses}>Descripcion *</label>
            <textarea
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              className={`${inputClasses} resize-none`}
              placeholder="Describe detalladamente el problema o solicitud..."
              rows={5}
              required
            />
          </div>

          <div>
            <label className={labelClasses}>Prioridad</label>
            <select
              value={form.prioridad}
              onChange={(e) => setForm({ ...form, prioridad: e.target.value as CreateTicketInput['prioridad'] })}
              className={inputClasses}
            >
              <option value="Baja">Baja - No urgente</option>
              <option value="Normal">Normal</option>
              <option value="Alta">Alta - Afecta mi trabajo</option>
              <option value="Urgente">Urgente - Bloquea operaciones</option>
            </select>
          </div>

          <div>
            <label className={labelClasses}>Captura de pantalla (opcional)</label>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
            {form.imagen ? (
              <div className="relative">
                <img
                  src={form.imagen}
                  alt="Preview"
                  className="w-full h-40 object-cover rounded-xl border border-purple-500/20"
                />
                <button
                  type="button"
                  onClick={() => setForm({ ...form, imagen: null })}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-500/80 text-white hover:bg-red-500 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full p-4 rounded-xl border-2 border-dashed border-purple-500/30 hover:border-purple-500/50 transition-colors flex flex-col items-center gap-2"
              >
                <Image className="h-8 w-8 text-purple-400" />
                <span className="text-sm text-zinc-400">Haz clic para subir una imagen</span>
                <span className="text-xs text-zinc-500">Max 5MB</span>
              </button>
            )}
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-purple-500/20">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-purple-300 bg-zinc-800 border border-purple-500/20 hover:bg-purple-500/10 hover:border-purple-500/40 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all flex items-center gap-2"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {createMutation.isPending ? 'Enviando...' : 'Enviar Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal para ver ticket
function ViewTicketModal({
  ticket,
  onClose,
}: {
  ticket: TicketType;
  onClose: () => void;
}) {
  const [showImage, setShowImage] = useState(false);

  const STATUS_CONFIG: Record<string, { textColor: string; bgColor: string; borderColor: string }> = {
    'Nuevo': { textColor: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30' },
    'En Progreso': { textColor: 'text-yellow-400', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/30' },
    'Resuelto': { textColor: 'text-green-400', bgColor: 'bg-green-500/10', borderColor: 'border-green-500/30' },
    'Cerrado': { textColor: 'text-zinc-400', bgColor: 'bg-zinc-500/10', borderColor: 'border-zinc-500/30' },
  };

  const statusConfig = STATUS_CONFIG[ticket.status] || STATUS_CONFIG['Nuevo'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-2xl bg-gradient-to-br from-zinc-900 via-purple-950/20 to-zinc-900 border border-purple-500/30 rounded-2xl shadow-2xl shadow-purple-500/10 overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-purple-500/20 bg-gradient-to-r from-purple-900/40 via-fuchsia-900/30 to-purple-900/40 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-purple-500/20">
              <Ticket className="h-6 w-6 text-purple-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-500">Ticket #{ticket.id}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusConfig.bgColor} ${statusConfig.textColor} ${statusConfig.borderColor}`}>
                  {ticket.status}
                </span>
              </div>
              <h2 className="text-xl font-bold text-white">{ticket.titulo}</h2>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-purple-500/20 rounded-xl transition-colors group">
            <X className="h-5 w-5 text-purple-300 group-hover:text-white transition-colors" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-4 rounded-xl bg-zinc-800/50 border border-purple-500/10">
            <h3 className="text-sm font-medium text-purple-300 mb-2">Descripcion</h3>
            <p className="text-zinc-300 whitespace-pre-wrap">{ticket.descripcion}</p>
          </div>

          {ticket.imagen && (
            <div className="p-4 rounded-xl bg-zinc-800/50 border border-purple-500/10">
              <button
                onClick={() => setShowImage(!showImage)}
                className="flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors"
              >
                <Image className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {showImage ? 'Ocultar imagen' : 'Ver imagen adjunta'}
                </span>
              </button>
              {showImage && (
                <div className="mt-3">
                  <img
                    src={ticket.imagen}
                    alt="Imagen del ticket"
                    className="max-w-full rounded-lg border border-purple-500/20"
                  />
                </div>
              )}
            </div>
          )}

          {ticket.respuesta && (
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
              <h3 className="text-sm font-medium text-green-400 mb-2">Respuesta del equipo</h3>
              <p className="text-zinc-300 whitespace-pre-wrap">{ticket.respuesta}</p>
              {ticket.respondido_por && (
                <p className="text-xs text-zinc-500 mt-2">
                  Por {ticket.respondido_por} - {ticket.respondido_at && new Date(ticket.respondido_at).toLocaleString('es-MX')}
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-zinc-500 pt-4 border-t border-purple-500/20">
            <span>Creado: {new Date(ticket.created_at).toLocaleString('es-MX')}</span>
            <span>Actualizado: {new Date(ticket.updated_at).toLocaleString('es-MX')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Componente principal con tabs
export function UsuariosAdminPage() {
  const [activeTab, setActiveTab] = useState<TabType>('usuarios');

  // WebSocket para actualizar equipos en tiempo real
  useSocketEquipos();

  const tabs = [
    { key: 'usuarios' as TabType, label: 'Usuarios', icon: Users },
    { key: 'equipos' as TabType, label: 'Red de Trabajo', icon: Network },
    { key: 'tickets' as TabType, label: 'Tickets', icon: Ticket, alignRight: true },
  ];

  return (
    <div className="min-h-screen">
      <Header title="Administrador" />

      <div className="p-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {tabs.filter(t => !t.alignRight).map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeTab === tab.key
                    ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-lg shadow-purple-500/25'
                    : 'bg-zinc-800/50 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-purple-500/10'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
          <div className="flex-1" />
          {tabs.filter(t => t.alignRight).map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeTab === tab.key
                    ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-lg shadow-purple-500/25'
                    : 'bg-zinc-800/50 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-purple-500/10'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === 'usuarios' && <UsuariosTab />}
        {activeTab === 'equipos' && <RedDeTrabajoTab />}
        {activeTab === 'tickets' && <TicketsTab />}
      </div>
    </div>
  );
}
