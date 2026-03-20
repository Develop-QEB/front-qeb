import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Ban, AlertTriangle, X, Loader2, Search, User, ExternalLink } from 'lucide-react';
import { solicitudesService, UserOption } from '../../services/solicitudes.service';
import { inventariosService } from '../../services/inventarios.service';

interface InventarioBasico {
  id: number;
  codigo_unico?: string | null;
  ubicacion?: string | null;
  plaza?: string | null;
  estatus?: string | null;
  estatus_real?: string | null;
}

export interface CampanaActiva {
  campana_id: number;
  campana_nombre: string;
  cliente_nombre: string;
}

export interface BloqueoData {
  motivo: string;
  analistas: UserOption[];
  trafico: UserOption[];
  campanas: CampanaActiva[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  item: InventarioBasico | null;
  onConfirm: (data: BloqueoData) => Promise<void>;
  isSubmitting: boolean;
}

function UserSelector({
  label,
  users,
  selected,
  onToggle,
  search,
  onSearch,
}: {
  label: string;
  users: UserOption[];
  selected: UserOption[];
  onToggle: (u: UserOption) => void;
  search: string;
  onSearch: (v: string) => void;
}) {
  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return users.filter(u => !s || u.nombre.toLowerCase().includes(s)).slice(0, 6);
  }, [users, search]);

  return (
    <div>
      <label className="text-xs text-zinc-400 mb-1.5 block font-medium">{label}</label>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selected.map(u => (
            <span key={u.id} className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-orange-500/20 text-orange-300 border border-orange-500/30 rounded-full">
              {u.nombre}
              <button type="button" onClick={() => onToggle(u)} className="hover:text-orange-100"><X className="h-2.5 w-2.5" /></button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg mb-1">
        <Search className="h-3 w-3 text-zinc-500 flex-shrink-0" />
        <input
          type="text"
          value={search}
          onChange={e => onSearch(e.target.value)}
          placeholder={`Buscar...`}
          className="flex-1 bg-transparent text-xs text-white placeholder:text-zinc-600 focus:outline-none"
        />
      </div>
      <div className="bg-zinc-800/60 border border-zinc-700 rounded-lg max-h-28 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-xs text-zinc-600 px-3 py-2">Sin resultados</p>
        ) : filtered.map(u => {
          const isSelected = selected.some(s => s.id === u.id);
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => onToggle(u)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${isSelected ? 'bg-orange-500/10 text-orange-300' : 'text-zinc-300 hover:bg-zinc-700'}`}
            >
              <User className="h-3 w-3 text-zinc-500 flex-shrink-0" />
              <span className="flex-1">{u.nombre}</span>
              <span className="text-[10px] text-zinc-600">{u.puesto}</span>
              {isSelected && <X className="h-3 w-3 text-orange-400" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function BloqueoModal({ isOpen, onClose, item, onConfirm, isSubmitting }: Props) {
  const [motivo, setMotivo] = useState('');
  const [analistas, setAnalistas] = useState<UserOption[]>([]);
  const [trafico, setTrafico] = useState<UserOption[]>([]);
  const [searchAnalista, setSearchAnalista] = useState('');
  const [searchTrafico, setSearchTrafico] = useState('');

  const { data: allUsers = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ['solicitudes-users-bloqueo'],
    queryFn: () => solicitudesService.getUsers(undefined, false),
    enabled: isOpen,
  });

  const { data: historialData } = useQuery({
    queryKey: ['inventario-historial-bloqueo', item?.id],
    queryFn: () => inventariosService.getHistorial(item!.id),
    enabled: isOpen && item !== null,
  });

  const campanasActivas = useMemo((): CampanaActiva[] => {
    if (!historialData) return [];
    const hoy = new Date();
    const seen = new Set<number>();
    return historialData.historial
      .filter(h =>
        ['Reservado', 'Ocupado', 'Vendido'].includes(h.reserva_estatus) &&
        new Date(h.fin_periodo) >= hoy
      )
      .reduce<CampanaActiva[]>((acc, h) => {
        if (!seen.has(h.campana_id)) {
          seen.add(h.campana_id);
          acc.push({ campana_id: h.campana_id, campana_nombre: h.campana_nombre, cliente_nombre: h.cliente_nombre });
        }
        return acc;
      }, []);
  }, [historialData]);

  const analistasDisponibles = useMemo(() =>
    allUsers.filter(u => u.puesto?.toLowerCase().includes('analista')),
    [allUsers]);

  const traficoDisponibles = useMemo(() =>
    allUsers.filter(u =>
      u.area?.toLowerCase().includes('tr') ||
      u.puesto?.toLowerCase().includes('tráfico') ||
      u.puesto?.toLowerCase().includes('trafico')
    ),
    [allUsers]);

  if (!isOpen || !item) return null;

  const estatusReal = item.estatus_real || item.estatus || '';
  const yaEstaBloquedo = item.estatus === 'Bloqueado';
  const enUso = ['Reservado', 'Ocupado', 'Vendido'].includes(estatusReal);
  const esDisponible = !yaEstaBloquedo && !enUso;

  const canConfirm = esDisponible
    ? motivo.trim().length > 0
    : motivo.trim().length > 0 && (analistas.length > 0 || trafico.length > 0);

  const handleConfirm = async () => {
    await onConfirm({ motivo, analistas, trafico, campanas: campanasActivas });
    reset();
  };

  const reset = () => {
    setMotivo('');
    setAnalistas([]);
    setTrafico([]);
    setSearchAnalista('');
    setSearchTrafico('');
  };

  const handleClose = () => { reset(); onClose(); };

  const toggleAnalista = (u: UserOption) =>
    setAnalistas(prev => prev.some(x => x.id === u.id) ? prev.filter(x => x.id !== u.id) : [...prev, u]);

  const toggleTrafico = (u: UserOption) =>
    setTrafico(prev => prev.some(x => x.id === u.id) ? prev.filter(x => x.id !== u.id) : [...prev, u]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-zinc-900 border border-red-500/30 rounded-xl w-full max-w-md shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Ban className="h-5 w-5 text-red-400" />
            <h2 className="text-sm font-semibold text-white">
              {yaEstaBloquedo ? 'Crear tarea de revisión de bloqueo' : esDisponible ? 'Bloquear inventario' : 'Bloquear inventario en uso'}
            </h2>
          </div>
          <button onClick={handleClose} className="text-zinc-500 hover:text-zinc-300"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Info inventario */}
          <div className="px-3 py-2.5 bg-zinc-800/60 rounded-lg space-y-0.5">
            <p className="text-xs text-zinc-400">
              <span className="text-zinc-500">ID:</span> <span className="text-white font-mono">#{item.id}</span>
              {item.codigo_unico && <span className="ml-2 text-zinc-400">· {item.codigo_unico}</span>}
            </p>
            {item.ubicacion && <p className="text-xs text-zinc-400 truncate">{item.ubicacion}</p>}
            {item.plaza && <p className="text-xs text-zinc-500">{item.plaza}</p>}
          </div>

          {esDisponible ? (
            <>
              <div className="flex items-start gap-2.5 px-3 py-2.5 bg-red-500/10 border border-red-500/30 rounded-lg">
                <Ban className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-300">
                  Se bloqueará este inventario. Indica el motivo para que se pueda desbloquear después.
                </p>
              </div>

              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Indicaciones <span className="text-red-400">*</span></label>
                <textarea
                  value={motivo}
                  onChange={e => setMotivo(e.target.value)}
                  rows={3}
                  placeholder="¿Por qué se bloquea este inventario?"
                  className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-red-500/50 placeholder:text-zinc-600"
                />
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start gap-2.5 px-3 py-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-amber-300">
                    {yaEstaBloquedo ? 'Inventario bloqueado' : `En uso — ${estatusReal}`}
                  </p>
                  <p className="text-xs text-amber-400/80 mt-0.5">
                    {yaEstaBloquedo
                      ? 'Se creará una tarea para que un usuario pueda revisar y desbloquear manualmente.'
                      : 'Se bloqueará el inventario y se creará una tarea "Ajuste Inventario Bloqueado" en cada campaña activa.'}
                  </p>
                </div>
              </div>

              {/* Campañas activas */}
              {campanasActivas.length > 0 && (
                <div>
                  <p className="text-xs text-zinc-400 mb-1.5 font-medium">Campañas afectadas</p>
                  <div className="space-y-1">
                    {campanasActivas.map(c => (
                      <a
                        key={c.campana_id}
                        href={`/campanas/${c.campana_id}/tareas`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between px-3 py-2 bg-zinc-800/60 border border-zinc-700 rounded-lg hover:border-orange-500/40 transition-colors group"
                      >
                        <div>
                          <p className="text-xs text-white">{c.campana_nombre}</p>
                          <p className="text-[10px] text-zinc-500">{c.cliente_nombre}</p>
                        </div>
                        <ExternalLink className="h-3 w-3 text-zinc-600 group-hover:text-orange-400 flex-shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Motivo */}
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Indicaciones <span className="text-red-400">*</span></label>
                <textarea
                  value={motivo}
                  onChange={e => setMotivo(e.target.value)}
                  rows={2}
                  placeholder="¿Qué debe revisarse para poder desbloquear este inventario?"
                  className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-red-500/50 placeholder:text-zinc-600"
                />
              </div>

              {/* Selectores */}
              {isLoadingUsers ? (
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando usuarios...
                </div>
              ) : (
                <div className="space-y-4">
                  <UserSelector
                    label="Analistas *"
                    users={analistasDisponibles}
                    selected={analistas}
                    onToggle={toggleAnalista}
                    search={searchAnalista}
                    onSearch={setSearchAnalista}
                  />
                  <UserSelector
                    label="Tráfico *"
                    users={traficoDisponibles.length > 0 ? traficoDisponibles : allUsers}
                    selected={trafico}
                    onToggle={toggleTrafico}
                    search={searchTrafico}
                    onSearch={setSearchTrafico}
                  />
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-zinc-800">
          <button onClick={handleClose} disabled={isSubmitting} className="flex-1 px-3 py-2 text-sm text-zinc-400 border border-zinc-700 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50">
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSubmitting || !canConfirm}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg transition-colors"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
            {isSubmitting ? (esDisponible ? 'Bloqueando...' : 'Creando...') : (esDisponible ? 'Bloquear inventario' : 'Crear tarea')}
          </button>
        </div>
      </div>
    </div>
  );
}
