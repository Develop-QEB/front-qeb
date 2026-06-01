import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { Ban, AlertTriangle, X, Loader2, Search, User, ExternalLink, ChevronRight, Check } from 'lucide-react';
import { solicitudesService, UserOption } from '../../services/solicitudes.service';
import { inventariosService } from '../../services/inventarios.service';
import { campanasService } from '../../services/campanas.service';

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

export interface CampanaBloqueoEntry {
  campana: CampanaActiva;
  analistas: UserOption[];
  trafico: UserOption[];
}

export interface BloqueoData {
  motivo: string;
  analistas: UserOption[];
  trafico: UserOption[];
  campanas: CampanaActiva[];
  perCampana?: CampanaBloqueoEntry[];
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
      <div className="bg-zinc-800/60 border border-zinc-700 rounded-lg max-h-36 overflow-y-auto">
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
              <span className="text-[10px] text-zinc-600 flex-shrink-0">{u.puesto}</span>
              {isSelected && <X className="h-3 w-3 text-orange-400 flex-shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function BloqueoModal({ isOpen, onClose, item, onConfirm, isSubmitting }: Props) {
  const [motivo, setMotivo] = useState('');
  // Wizard: step 0 = motivo + overview, step 1..N = per-campaign assignment
  const [step, setStep] = useState(0);
  // Per-campaign selections stored by index
  const [perCampanaSelections, setPerCampanaSelections] = useState<Record<number, { analistas: UserOption[]; trafico: UserOption[] }>>({});
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

  // Fetch each affected campaign to get its assigned user IDs
  const campanaQueries = useQueries({
    queries: campanasActivas.map(c => ({
      queryKey: ['campana-detail-bloqueo', c.campana_id],
      queryFn: () => campanasService.getById(c.campana_id),
      enabled: isOpen && campanasActivas.length > 0,
    })),
  });

  // Per-campaign assigned user IDs
  const perCampanaUserIds = useMemo(() => {
    const map = new Map<number, Set<number>>();
    for (let i = 0; i < campanaQueries.length; i++) {
      const q = campanaQueries[i];
      const campanaId = campanasActivas[i]?.campana_id;
      if (!campanaId) continue;
      const ids = new Set<number>();
      const idAsignado = q.data?.id_asignado;
      if (idAsignado) {
        idAsignado.split(',').forEach(s => {
          const n = parseInt(s.trim());
          if (!isNaN(n)) ids.add(n);
        });
      }
      map.set(campanaId, ids);
    }
    return map;
  }, [campanaQueries, campanasActivas]);

  // Current campaign for wizard steps (step 1 = index 0, etc.)
  const currentCampanaIndex = step - 1;
  const currentCampana = campanasActivas[currentCampanaIndex] ?? null;
  const currentCampanaIds = currentCampana ? (perCampanaUserIds.get(currentCampana.campana_id) ?? new Set<number>()) : new Set<number>();
  const hasCurrentCampanaAssignees = currentCampanaIds.size > 0;

  const analistasForCurrentCampana = useMemo(() => {
    const allAnalistas = allUsers.filter(u => u.puesto?.toLowerCase().includes('analista'));
    if (!hasCurrentCampanaAssignees) return allAnalistas;
    // Filter by campaign assignees; if none match, show all analistas
    const fromCampana = allAnalistas.filter(u => currentCampanaIds.has(u.id));
    return fromCampana.length > 0 ? fromCampana : allAnalistas;
  }, [allUsers, hasCurrentCampanaAssignees, currentCampanaIds]);

  const traficoForCurrentCampana = useMemo(() => {
    const isTrafico = (u: UserOption) =>
      u.area?.toLowerCase().includes('tráfico') || u.area?.toLowerCase().includes('trafico') ||
      u.puesto?.toLowerCase().includes('tráfico') || u.puesto?.toLowerCase().includes('trafico');
    const allTrafico = allUsers.filter(isTrafico);
    if (!hasCurrentCampanaAssignees) return allTrafico;
    // Filter by campaign assignees; if none match, show all tráfico
    const fromCampana = allTrafico.filter(u => currentCampanaIds.has(u.id));
    return fromCampana.length > 0 ? fromCampana : allTrafico;
  }, [allUsers, hasCurrentCampanaAssignees, currentCampanaIds]);

  // Pre-select campaign assignees as analistas/tráfico when data loads
  const preselectedRef = useRef(new Set<number>());
  const allQueriesLoaded = campanaQueries.length > 0 && campanaQueries.every(q => q.isSuccess);
  useEffect(() => {
    if (!allUsers.length || !campanasActivas.length || !allQueriesLoaded) return;

    const isTrafico = (u: UserOption) =>
      u.area?.toLowerCase().includes('tráfico') || u.area?.toLowerCase().includes('trafico') ||
      u.puesto?.toLowerCase().includes('tráfico') || u.puesto?.toLowerCase().includes('trafico');
    const isAnalista = (u: UserOption) => u.puesto?.toLowerCase().includes('analista');

    const newSelections: Record<number, { analistas: UserOption[]; trafico: UserOption[] }> = {};
    let hasNew = false;

    campanasActivas.forEach((c, i) => {
      if (preselectedRef.current.has(c.campana_id)) return;

      // Read id_asignado directly from the query data
      const campanaData = campanaQueries[i]?.data;
      const idAsignado = campanaData?.id_asignado;
      if (!idAsignado) return;

      const idSet = new Set<number>();
      idAsignado.split(',').forEach(s => {
        const n = parseInt(s.trim());
        if (!isNaN(n)) idSet.add(n);
      });
      if (idSet.size === 0) return;

      const assignedUsers = allUsers.filter(u => idSet.has(u.id));
      const analistas = assignedUsers.filter(isAnalista);
      const trafico = assignedUsers.filter(isTrafico);
      if (analistas.length > 0 || trafico.length > 0) {
        newSelections[i] = { analistas, trafico };
        preselectedRef.current.add(c.campana_id);
        hasNew = true;
      }
    });

    if (hasNew) {
      setPerCampanaSelections(prev => ({ ...prev, ...newSelections }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allUsers, campanasActivas, allQueriesLoaded]);

  // Current step selections
  const currentAnalistas = perCampanaSelections[currentCampanaIndex]?.analistas ?? [];
  const currentTrafico = perCampanaSelections[currentCampanaIndex]?.trafico ?? [];

  if (!isOpen || !item) return null;

  const estatusReal = item.estatus_real || item.estatus || '';
  const yaEstaBloquedo = item.estatus === 'Bloqueado';
  const enUso = ['Reservado', 'Ocupado', 'Vendido'].includes(estatusReal);
  const esDisponible = !yaEstaBloquedo && !enUso && campanasActivas.length === 0;

  const totalSteps = campanasActivas.length; // step 0 + N campaign steps

  const canContinue = step === 0
    ? motivo.trim().length > 0
    : (currentAnalistas.length > 0 || currentTrafico.length > 0);

  const isLastStep = step === totalSteps;

  const handleNext = () => {
    setSearchAnalista('');
    setSearchTrafico('');
    setStep(prev => prev + 1);
  };

  const handleConfirm = async () => {
    const perCampana: CampanaBloqueoEntry[] = campanasActivas.map((c, i) => ({
      campana: c,
      analistas: perCampanaSelections[i]?.analistas ?? [],
      trafico: perCampanaSelections[i]?.trafico ?? [],
    }));
    // For backwards compat, also flatten all analistas/trafico
    const allAnalistas = perCampana.flatMap(e => e.analistas);
    const allTrafico = perCampana.flatMap(e => e.trafico);
    await onConfirm({ motivo, analistas: allAnalistas, trafico: allTrafico, campanas: campanasActivas, perCampana });
    reset();
  };

  const handleConfirmSimple = async () => {
    await onConfirm({ motivo, analistas: [], trafico: [], campanas: [] });
    reset();
  };

  const reset = () => {
    setMotivo('');
    setStep(0);
    setPerCampanaSelections({});
    setSearchAnalista('');
    setSearchTrafico('');
    preselectedRef.current.clear();
  };

  const handleClose = () => { reset(); onClose(); };

  const toggleAnalista = (u: UserOption) => {
    setPerCampanaSelections(prev => {
      const current = prev[currentCampanaIndex] ?? { analistas: [], trafico: [] };
      const exists = current.analistas.some(x => x.id === u.id);
      return {
        ...prev,
        [currentCampanaIndex]: {
          ...current,
          analistas: exists ? current.analistas.filter(x => x.id !== u.id) : [...current.analistas, u],
        },
      };
    });
  };

  const toggleTrafico = (u: UserOption) => {
    setPerCampanaSelections(prev => {
      const current = prev[currentCampanaIndex] ?? { analistas: [], trafico: [] };
      const exists = current.trafico.some(x => x.id === u.id);
      return {
        ...prev,
        [currentCampanaIndex]: {
          ...current,
          trafico: exists ? current.trafico.filter(x => x.id !== u.id) : [...current.trafico, u],
        },
      };
    });
  };

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

        {/* Step indicator for wizard */}
        {!esDisponible && totalSteps > 0 && (
          <div className="px-5 pt-3 pb-1">
            <div className="flex items-center gap-1.5">
              {Array.from({ length: totalSteps + 1 }).map((_, i) => (
                <div key={i} className="flex items-center gap-1.5 flex-1">
                  <div className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? 'bg-orange-500' : 'bg-zinc-800'}`} />
                </div>
              ))}
            </div>
            <p className="text-[10px] text-zinc-500 mt-1.5">
              {step === 0 ? 'Información general' : `Campaña ${step} de ${totalSteps}`}
            </p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Info inventario — always visible */}
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
                <div className="space-y-1">
                  <p className="text-xs text-red-300">
                    Se bloqueará este inventario. Indica el motivo para que se pueda desbloquear después.
                  </p>
                  <p className="text-[11px] text-red-300/80">
                    Cualquier reserva activa sobre este inventario se eliminará automáticamente, con o sin APS.
                  </p>
                </div>
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
          ) : step === 0 ? (
            /* ===== STEP 0: Overview + motivo ===== */
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
                      : 'Se bloqueará el inventario y se creará una tarea por cada campaña afectada.'}
                  </p>
                  {!yaEstaBloquedo && (
                    <p className="text-[11px] text-red-300 mt-1">
                      Todas las reservas activas de este inventario se eliminarán al confirmar, con o sin APS.
                    </p>
                  )}
                </div>
              </div>

              {/* Campañas afectadas */}
              {campanasActivas.length > 0 && (
                <div>
                  <p className="text-xs text-zinc-400 mb-1.5 font-medium">Campañas afectadas ({campanasActivas.length})</p>
                  <div className="space-y-1">
                    {campanasActivas.map((c, i) => {
                      const done = !!perCampanaSelections[i]?.analistas?.length || !!perCampanaSelections[i]?.trafico?.length;
                      return (
                        <div
                          key={c.campana_id}
                          className="flex items-center justify-between px-3 py-2 bg-zinc-800/60 border border-zinc-700 rounded-lg"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {done && <Check className="h-3 w-3 text-emerald-400 flex-shrink-0" />}
                            <div className="min-w-0">
                              <p className="text-xs text-white truncate">{c.campana_nombre}</p>
                              <p className="text-[10px] text-zinc-500">{c.cliente_nombre}</p>
                            </div>
                          </div>
                          <a
                            href={`/campanas/detail/${c.campana_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-zinc-600 hover:text-orange-400 transition-colors flex-shrink-0"
                            onClick={e => e.stopPropagation()}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      );
                    })}
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
            </>
          ) : (
            /* ===== STEP 1..N: Per-campaign assignment ===== */
            currentCampana && (
              <>
                {/* Current campaign header */}
                <div className="px-3 py-2.5 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                  <p className="text-xs font-semibold text-purple-300">{currentCampana.campana_nombre}</p>
                  <p className="text-[10px] text-purple-400/80 mt-0.5">{currentCampana.cliente_nombre}</p>
                  <p className="text-[10px] text-zinc-500 mt-1">Selecciona los analistas y tráfico responsables de esta campaña.</p>
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
                      users={analistasForCurrentCampana}
                      selected={currentAnalistas}
                      onToggle={toggleAnalista}
                      search={searchAnalista}
                      onSearch={setSearchAnalista}
                    />
                    <UserSelector
                      label="Tráfico *"
                      users={traficoForCurrentCampana}
                      selected={currentTrafico}
                      onToggle={toggleTrafico}
                      search={searchTrafico}
                      onSearch={setSearchTrafico}
                    />
                  </div>
                )}
              </>
            )
          )}
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-zinc-800">
          <button
            onClick={step > 0 ? () => { setSearchAnalista(''); setSearchTrafico(''); setStep(prev => prev - 1); } : handleClose}
            disabled={isSubmitting}
            className="flex-1 px-3 py-2 text-sm text-zinc-400 border border-zinc-700 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            {step > 0 ? 'Atrás' : 'Cancelar'}
          </button>

          {esDisponible ? (
            <button
              onClick={handleConfirmSimple}
              disabled={isSubmitting || !motivo.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg transition-colors"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
              {isSubmitting ? 'Bloqueando...' : 'Bloquear inventario'}
            </button>
          ) : !isLastStep ? (
            <button
              onClick={handleNext}
              disabled={!canContinue}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg transition-colors"
            >
              {step === 0 ? 'Continuar' : 'Siguiente campaña'}
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleConfirm}
              disabled={isSubmitting || !canContinue}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg transition-colors"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
              {isSubmitting ? 'Creando...' : 'Crear tareas'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
