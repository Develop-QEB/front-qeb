import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { Ban, AlertTriangle, X, Loader2, Search, User, ExternalLink, ChevronRight, Check } from 'lucide-react';
import { solicitudesService, UserOption } from '../../services/solicitudes.service';
import { inventariosService } from '../../services/inventarios.service';
import { campanasService } from '../../services/campanas.service';

export interface InventarioBasico {
  id: number;
  codigo_unico?: string | null;
  ubicacion?: string | null;
  plaza?: string | null;
  estatus?: string | null;
  estatus_real?: string | null;
}

export interface CampanaActivaBulk {
  campana_id: number;
  campana_nombre: string;
  cliente_nombre: string;
}

export interface PairAssignment {
  item: InventarioBasico;
  campana: CampanaActivaBulk;
  analistas: UserOption[];
  trafico: UserOption[];
}

export interface BloqueoBulkData {
  motivo: string;
  // Por cada inventario, lo que se necesita aplicar al confirmar:
  // - campañas afectadas y sus asignaciones (para crear tareas)
  // - flag de si ya estaba bloqueado (para skip del toggleBlock)
  perItem: Array<{
    item: InventarioBasico;
    yaEstaBloquedo: boolean;
    pairs: Array<{
      campana: CampanaActivaBulk;
      analistas: UserOption[];
      trafico: UserOption[];
    }>;
  }>;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  items: InventarioBasico[];
  onConfirm: (data: BloqueoBulkData) => Promise<void>;
  isSubmitting: boolean;
}

// Reutilizamos el mismo selector visual que el modal individual.
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
          placeholder="Buscar..."
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

export function BloqueoBulkModal({ isOpen, onClose, items, onConfirm, isSubmitting }: Props) {
  const [motivo, setMotivo] = useState('');
  const [step, setStep] = useState(0);
  // Asignaciones por pareja (inv, campaña). Key = `${invId}::${campanaId}`.
  const [pairSelections, setPairSelections] = useState<Record<string, { analistas: UserOption[]; trafico: UserOption[] }>>({});
  const [searchAnalista, setSearchAnalista] = useState('');
  const [searchTrafico, setSearchTrafico] = useState('');

  // === Usuarios ===
  const { data: allUsers = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ['solicitudes-users-bloqueo-bulk'],
    queryFn: () => solicitudesService.getUsers(undefined, false),
    enabled: isOpen,
  });

  // === Historial por cada inventario seleccionado ===
  // Determina las campañas activas que tocan cada inventario.
  const historialQueries = useQueries({
    queries: items.map(it => ({
      queryKey: ['inventario-historial-bloqueo-bulk', it.id],
      queryFn: () => inventariosService.getHistorial(it.id),
      enabled: isOpen,
    })),
  });

  // === Campañas activas por inventario (deduplicadas dentro del mismo inv) ===
  const campanasPorInv = useMemo((): Map<number, CampanaActivaBulk[]> => {
    const map = new Map<number, CampanaActivaBulk[]>();
    const hoy = new Date();
    for (let i = 0; i < items.length; i++) {
      const inv = items[i];
      const h = historialQueries[i]?.data;
      if (!h) { map.set(inv.id, []); continue; }
      const seen = new Set<number>();
      const list: CampanaActivaBulk[] = [];
      for (const ev of h.historial) {
        if (
          ['Reservado', 'Ocupado', 'Vendido'].includes(ev.reserva_estatus) &&
          new Date(ev.fin_periodo) >= hoy &&
          !seen.has(ev.campana_id)
        ) {
          seen.add(ev.campana_id);
          list.push({ campana_id: ev.campana_id, campana_nombre: ev.campana_nombre, cliente_nombre: ev.cliente_nombre });
        }
      }
      map.set(inv.id, list);
    }
    return map;
  }, [items, historialQueries]);

  // === Detalle de cada campaña (para pre-seleccionar asignados como en el individual) ===
  // Lista plana de todas las campañas únicas a través de todos los inventarios.
  const allCampanaIds = useMemo(() => {
    const s = new Set<number>();
    for (const [, list] of campanasPorInv) for (const c of list) s.add(c.campana_id);
    return Array.from(s);
  }, [campanasPorInv]);

  const campanaQueries = useQueries({
    queries: allCampanaIds.map(cid => ({
      queryKey: ['campana-detail-bloqueo-bulk', cid],
      queryFn: () => campanasService.getById(cid),
      enabled: isOpen && allCampanaIds.length > 0,
    })),
  });

  // Mapa campana_id → Set<user_id asignados>
  const idsAsignadosPorCampana = useMemo(() => {
    const map = new Map<number, Set<number>>();
    for (let i = 0; i < campanaQueries.length; i++) {
      const cid = allCampanaIds[i];
      const idAsignado = campanaQueries[i]?.data?.id_asignado;
      const set = new Set<number>();
      if (idAsignado) {
        idAsignado.split(',').forEach((s: string) => {
          const n = parseInt(s.trim());
          if (!isNaN(n)) set.add(n);
        });
      }
      map.set(cid, set);
    }
    return map;
  }, [allCampanaIds, campanaQueries]);

  // === Lista plana de pares (inv, campaña) en el orden que recorre el wizard ===
  // Inv1 → todas sus campañas, luego Inv2 → todas sus campañas, etc.
  const allPairs = useMemo(() => {
    const out: Array<{ item: InventarioBasico; campana: CampanaActivaBulk; invIndex: number; pairIndexInInv: number; totalPairsInInv: number }> = [];
    for (let invIdx = 0; invIdx < items.length; invIdx++) {
      const inv = items[invIdx];
      const camps = campanasPorInv.get(inv.id) || [];
      camps.forEach((c, j) => {
        out.push({ item: inv, campana: c, invIndex: invIdx, pairIndexInInv: j, totalPairsInInv: camps.length });
      });
    }
    return out;
  }, [items, campanasPorInv]);

  // === Pre-seleccionar asignados de cada campaña (igual que el modal individual) ===
  const preselectedRef = useRef(new Set<string>());
  const allLoaded = historialQueries.every(q => q.isSuccess) && campanaQueries.every(q => q.isSuccess);
  useEffect(() => {
    if (!allUsers.length || !allLoaded || allPairs.length === 0) return;

    const isTrafico = (u: UserOption) =>
      u.area?.toLowerCase().includes('tráfico') || u.area?.toLowerCase().includes('trafico') ||
      u.puesto?.toLowerCase().includes('tráfico') || u.puesto?.toLowerCase().includes('trafico');
    const isAnalista = (u: UserOption) => u.puesto?.toLowerCase().includes('analista');

    const updates: Record<string, { analistas: UserOption[]; trafico: UserOption[] }> = {};
    for (const p of allPairs) {
      const key = `${p.item.id}::${p.campana.campana_id}`;
      if (preselectedRef.current.has(key)) continue;
      const ids = idsAsignadosPorCampana.get(p.campana.campana_id);
      if (!ids || ids.size === 0) { preselectedRef.current.add(key); continue; }
      const assigned = allUsers.filter(u => ids.has(u.id));
      const analistas = assigned.filter(isAnalista);
      const trafico = assigned.filter(isTrafico);
      if (analistas.length > 0 || trafico.length > 0) {
        updates[key] = { analistas, trafico };
      }
      preselectedRef.current.add(key);
    }
    if (Object.keys(updates).length > 0) {
      setPairSelections(prev => ({ ...prev, ...updates }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allUsers, allPairs, allLoaded]);

  // === Step actual: 0 = overview, 1..allPairs.length = par (inv, campaña) ===
  const totalSteps = allPairs.length;
  const currentPair = step >= 1 && step <= totalSteps ? allPairs[step - 1] : null;
  const currentKey = currentPair ? `${currentPair.item.id}::${currentPair.campana.campana_id}` : null;
  const currentIds = currentPair ? (idsAsignadosPorCampana.get(currentPair.campana.campana_id) ?? new Set<number>()) : new Set<number>();
  const hasCampAssignees = currentIds.size > 0;

  const analistasForCurrent = useMemo(() => {
    const allAnalistas = allUsers.filter(u => u.puesto?.toLowerCase().includes('analista'));
    if (!hasCampAssignees) return allAnalistas;
    const fromCamp = allAnalistas.filter(u => currentIds.has(u.id));
    return fromCamp.length > 0 ? fromCamp : allAnalistas;
  }, [allUsers, hasCampAssignees, currentIds]);

  const traficoForCurrent = useMemo(() => {
    const isTrafico = (u: UserOption) =>
      u.area?.toLowerCase().includes('tráfico') || u.area?.toLowerCase().includes('trafico') ||
      u.puesto?.toLowerCase().includes('tráfico') || u.puesto?.toLowerCase().includes('trafico');
    const allTrafico = allUsers.filter(isTrafico);
    if (!hasCampAssignees) return allTrafico;
    const fromCamp = allTrafico.filter(u => currentIds.has(u.id));
    return fromCamp.length > 0 ? fromCamp : allTrafico;
  }, [allUsers, hasCampAssignees, currentIds]);

  const currentAnalistas = currentKey ? pairSelections[currentKey]?.analistas ?? [] : [];
  const currentTrafico = currentKey ? pairSelections[currentKey]?.trafico ?? [] : [];

  // === Toggle helpers para los selectores ===
  const toggleAnalista = (u: UserOption) => {
    if (!currentKey) return;
    setPairSelections(prev => {
      const current = prev[currentKey] ?? { analistas: [], trafico: [] };
      const exists = current.analistas.some(x => x.id === u.id);
      return {
        ...prev,
        [currentKey]: {
          ...current,
          analistas: exists ? current.analistas.filter(x => x.id !== u.id) : [...current.analistas, u],
        },
      };
    });
  };

  const toggleTrafico = (u: UserOption) => {
    if (!currentKey) return;
    setPairSelections(prev => {
      const current = prev[currentKey] ?? { analistas: [], trafico: [] };
      const exists = current.trafico.some(x => x.id === u.id);
      return {
        ...prev,
        [currentKey]: {
          ...current,
          trafico: exists ? current.trafico.filter(x => x.id !== u.id) : [...current.trafico, u],
        },
      };
    });
  };

  // === Reset al abrir/cerrar ===
  const reset = () => {
    setMotivo('');
    setStep(0);
    setPairSelections({});
    setSearchAnalista('');
    setSearchTrafico('');
    preselectedRef.current.clear();
  };
  const handleClose = () => { reset(); onClose(); };

  // === Confirmar ===
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
    // Construir el payload por inventario para que el caller aplique los efectos
    // (toggleBlock + tareas + soft-delete reservas) en paralelo.
    const perItem = items.map(it => {
      const camps = campanasPorInv.get(it.id) || [];
      return {
        item: it,
        yaEstaBloquedo: it.estatus === 'Bloqueado',
        pairs: camps.map(c => ({
          campana: c,
          analistas: pairSelections[`${it.id}::${c.campana_id}`]?.analistas ?? [],
          trafico: pairSelections[`${it.id}::${c.campana_id}`]?.trafico ?? [],
        })),
      };
    });
    await onConfirm({ motivo, perItem });
    reset();
  };

  if (!isOpen) return null;

  const loadingHistorial = historialQueries.some(q => q.isLoading);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-zinc-900 border border-red-500/30 rounded-xl w-full max-w-md shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Ban className="h-5 w-5 text-red-400" />
            <h2 className="text-sm font-semibold text-white">
              Bloquear {items.length} inventarios
            </h2>
          </div>
          <button onClick={handleClose} className="text-zinc-500 hover:text-zinc-300"><X className="h-4 w-4" /></button>
        </div>

        {/* Step indicator (solo si hay parejas) */}
        {totalSteps > 0 && (
          <div className="px-5 pt-3 pb-1">
            <div className="flex items-center gap-1.5">
              {Array.from({ length: totalSteps + 1 }).map((_, i) => (
                <div key={i} className="flex items-center gap-1.5 flex-1">
                  <div className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? 'bg-orange-500' : 'bg-zinc-800'}`} />
                </div>
              ))}
            </div>
            <p className="text-[10px] text-zinc-500 mt-1.5">
              {step === 0
                ? 'Información general'
                : currentPair
                  ? `Inventario ${currentPair.invIndex + 1}/${items.length} — Campaña ${currentPair.pairIndexInInv + 1}/${currentPair.totalPairsInInv}`
                  : ''
              }
            </p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {step === 0 ? (
            /* ===== STEP 0: motivo + overview ===== */
            <>
              <div className="flex items-start gap-2.5 px-3 py-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-amber-300">Acción masiva</p>
                  <p className="text-xs text-amber-400/80 mt-0.5">
                    Se bloquearán {items.length} inventarios. Las reservas activas en cada uno
                    quedarán soft-deleted (las campañas pierden esas caras y los asesores recibirán
                    tareas para reasignarlas).
                  </p>
                </div>
              </div>

              {/* Overview: lista de inventarios con su count de campañas */}
              <div>
                <p className="text-xs text-zinc-400 mb-1.5 font-medium">Inventarios seleccionados</p>
                {loadingHistorial ? (
                  <div className="flex items-center gap-2 text-xs text-zinc-500 px-3 py-3 bg-zinc-800/40 rounded-lg">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando campañas afectadas…
                  </div>
                ) : (
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {items.map(it => {
                      const camps = campanasPorInv.get(it.id) || [];
                      const yaBloqueado = it.estatus === 'Bloqueado';
                      return (
                        <div
                          key={it.id}
                          className="flex items-center justify-between px-3 py-2 bg-zinc-800/60 border border-zinc-700 rounded-lg"
                        >
                          <div className="min-w-0">
                            <p className="text-xs text-white truncate font-mono">
                              #{it.id}
                              {it.codigo_unico && <span className="ml-1.5 text-zinc-400">{it.codigo_unico}</span>}
                            </p>
                            <p className="text-[10px] text-zinc-500 truncate">
                              {it.plaza || '—'}
                              {yaBloqueado && <span className="ml-1.5 text-red-400">(ya bloqueado)</span>}
                            </p>
                          </div>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${camps.length === 0 ? 'bg-emerald-500/15 text-emerald-300' : 'bg-orange-500/15 text-orange-300'}`}>
                            {camps.length === 0 ? 'libre' : `${camps.length} ${camps.length === 1 ? 'campaña' : 'campañas'}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {totalSteps > 0 && (
                  <p className="text-[10px] text-zinc-600 mt-2">
                    Total: {totalSteps} {totalSteps === 1 ? 'paso' : 'pasos'} siguientes (1 por campaña por inventario).
                  </p>
                )}
              </div>

              {/* Motivo */}
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Indicaciones <span className="text-red-400">*</span></label>
                <textarea
                  value={motivo}
                  onChange={e => setMotivo(e.target.value)}
                  rows={3}
                  placeholder="¿Por qué se bloquean estos inventarios? (mismo motivo para todos)"
                  className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-red-500/50 placeholder:text-zinc-600"
                />
              </div>
            </>
          ) : (
            /* ===== STEP 1..N: pareja (inv, campaña) ===== */
            currentPair && (
              <>
                {/* Inventario header */}
                <div className="px-3 py-2.5 bg-zinc-800/60 rounded-lg space-y-0.5">
                  <p className="text-xs text-zinc-400">
                    <span className="text-zinc-500">Inventario:</span>{' '}
                    <span className="text-white font-mono">#{currentPair.item.id}</span>
                    {currentPair.item.codigo_unico && <span className="ml-2 text-zinc-300">{currentPair.item.codigo_unico}</span>}
                  </p>
                  {currentPair.item.plaza && <p className="text-[10px] text-zinc-500">{currentPair.item.plaza}</p>}
                </div>

                {/* Campaña header */}
                <div className="px-3 py-2.5 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-purple-300 truncate">{currentPair.campana.campana_nombre}</p>
                      <p className="text-[10px] text-purple-400/80 mt-0.5 truncate">{currentPair.campana.cliente_nombre}</p>
                    </div>
                    <a
                      href={`/campanas/detail/${currentPair.campana.campana_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-400/60 hover:text-purple-300 flex-shrink-0 ml-2"
                      onClick={e => e.stopPropagation()}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1.5">Selecciona los analistas y tráfico responsables de esta campaña.</p>
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
                      users={analistasForCurrent}
                      selected={currentAnalistas}
                      onToggle={toggleAnalista}
                      search={searchAnalista}
                      onSearch={setSearchAnalista}
                    />
                    <UserSelector
                      label="Tráfico *"
                      users={traficoForCurrent}
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

          {/* Si NO hay parejas (todos disponibles sin campañas), confirmar directo desde step 0 */}
          {step === 0 && totalSteps === 0 ? (
            <button
              onClick={handleConfirm}
              disabled={isSubmitting || !motivo.trim() || loadingHistorial}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg transition-colors"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
              {isSubmitting ? 'Bloqueando...' : `Bloquear ${items.length} inventarios`}
            </button>
          ) : !isLastStep ? (
            <button
              onClick={handleNext}
              disabled={!canContinue || loadingHistorial}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg transition-colors"
            >
              {step === 0 ? 'Continuar' : 'Siguiente'}
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleConfirm}
              disabled={isSubmitting || !canContinue}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg transition-colors"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {isSubmitting ? 'Procesando...' : 'Confirmar y bloquear'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
