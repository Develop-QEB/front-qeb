import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Check, CheckCircle2, ChevronDown, Loader2, Paintbrush, Search, Send, Trash2, X, Upload, FileImage, ClipboardList, Plus, Users, XCircle, Flag, ChevronRight } from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import {
  pruebasColorService,
  PruebaColor,
  EstatusPruebaColor,
  ESTATUS_LABEL,
  puedeGestionarPruebaColor,
  AccionResolverTarea,
  TareaAsociadaPruebaColor,
} from '../../services/pruebasColor.service';
import { propuestasService, SolicitudCara } from '../../services/propuestas.service';
import { uploadsService } from '../../services/uploads.service';
import { formatDate } from '../../lib/utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  propuestaId: number;
  // Nombre visible en el header (nombre de campaña o razón social).
  contextoNombre?: string;
  // Si viene preseleccionado, el dropdown de circuito se deshabilita y la
  // vista arranca en ese circuito (caso: abrir desde gestión de artes).
  initialScId?: number;
  // Jos 2026-10-12: abrir en el tab 'nueva' con el formulario listo para
  // subir una v2 (caso: analista entra desde la tarea de rechazo).
  initialTab?: 'pruebas' | 'nueva';
}

// Modal reusable de Prueba de Color. Se usa desde 3 lugares:
// (1) listado de propuestas — sin initialScId (el usuario elige circuito).
// (2) listado de campañas — igual, sin initialScId.
// (3) gestión de artes (campaña con APS) — con initialScId preseleccionado.
export function PruebasColorModal({ isOpen, onClose, propuestaId, contextoNombre, initialScId, initialTab }: Props) {
  const isDark = useThemeStore(s => s.theme) === 'dark';
  const user = useAuthStore(s => s.user);
  const queryClient = useQueryClient();
  const puedeGestionar = puedeGestionarPruebaColor(user?.rol);

  // Multi-select de circuitos. Feedback Jos 2026-10-06: hay casos donde una
  // sola prueba de color aplica a varios circuitos (ej. mismo arte en Renta
  // + Bonificacion del mismo mueble). Al solicitar, se crea una prueba por
  // cada circuito seleccionado.
  const [scIds, setScIds] = useState<number[]>(initialScId ? [initialScId] : []);
  const [archivoFile, setArchivoFile] = useState<File | null>(null);
  const [archivoUrl, setArchivoUrl] = useState<string | null>(null);
  const [nombreArte, setNombreArte] = useState('');
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Tab activo del modal rediseñado (#252). Pestañas: 'pruebas' (listado de
  // pruebas existentes agrupadas por circuito) y 'nueva' (formulario de
  // solicitud limpio). Feedback Jos 2026-10-06: separar consulta de
  // creacion para que el usuario no vea el formulario mezclado con la
  // lista de pruebas ya solicitadas.
  const [activeTab, setActiveTab] = useState<'pruebas' | 'nueva'>('pruebas');

  // Acordeon de grupos por circuito. Jos 2026-10-12: por defecto TODOS
  // minimizados; el usuario expande solo el circuito que le interesa.
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const toggleGroup = (scId: number) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(scId)) next.delete(scId); else next.add(scId);
      return next;
    });
  };


  // Reset al abrir/cerrar
  useEffect(() => {
    if (isOpen) {
      setScIds(initialScId ? [initialScId] : []);
      setArchivoFile(null);
      setArchivoUrl(null);
      setNombreArte('');
      setNotas('');
      setError(null);
      setUploading(false);
      setActiveTab(initialTab || 'pruebas');
      // Si abrimos directo en 'nueva' con circuito preseleccionado,
      // tambien expandimos ese grupo del acordeon.
      setExpandedGroups(initialScId ? new Set([initialScId]) : new Set());
    }
  }, [isOpen, initialScId, initialTab]);

  // Circuitos de la propuesta (para el dropdown de selección).
  const carasQuery = useQuery({
    queryKey: ['propuesta-caras-prueba-color', propuestaId],
    queryFn: () => propuestasService.getCaras(propuestaId),
    enabled: isOpen && !!propuestaId,
  });

  // Pruebas de la propuesta. Fetch siempre que el modal este abierto para
  // que el usuario vea las pruebas existentes al reabrir sin tener que
  // reseleccionar circuito (feedback Jos 2026-10-06).
  const pruebasQuery = useQuery({
    queryKey: ['pruebas-color', 'propuesta', propuestaId],
    queryFn: () => pruebasColorService.listar({ propuesta_id: propuestaId }),
    enabled: isOpen && !!propuestaId,
  });

  const pruebasAll = useMemo(() => pruebasQuery.data || [], [pruebasQuery.data]);
  const pruebas = useMemo(() => {
    if (scIds.length === 0) return pruebasAll; // sin filtro muestra todas
    const setScs = new Set(scIds);
    return pruebasAll.filter(p => setScs.has(p.sc_id));
  }, [pruebasAll, scIds]);

  // Crear multiples pruebas (una por circuito seleccionado) en paralelo.
  const createMutation = useMutation({
    mutationFn: async (inputs: Array<Parameters<typeof pruebasColorService.crear>[0]>) => {
      await Promise.all(inputs.map(i => pruebasColorService.crear(i)));
    },
    onSuccess: () => {
      setArchivoFile(null);
      setArchivoUrl(null);
      setNombreArte('');
      setNotas('');
      // Jos 2026-10-12: resetear scIds para que el tab Pruebas muestre
      // TODAS las pruebas (incluidas aprobadas/rechazadas de otros
      // circuitos) y no solo las del circuito que se acaba de elegir.
      setScIds(initialScId ? [initialScId] : []);
      queryClient.invalidateQueries({ queryKey: ['pruebas-color', 'propuesta', propuestaId] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const updateEstatusMutation = useMutation({
    mutationFn: ({ id, estatus }: { id: number; estatus: EstatusPruebaColor }) =>
      pruebasColorService.actualizarEstatus(id, estatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pruebas-color', 'propuesta', propuestaId] });
    },
    onError: (e: Error) => alert(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: pruebasColorService.eliminar,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pruebas-color', 'propuesta', propuestaId] });
    },
    onError: (e: Error) => alert(e.message),
  });

  const circuitosSeleccionados = useMemo(() => {
    const caras = carasQuery.data || [];
    return scIds.map(id => caras.find(c => c.id === id)).filter(Boolean) as SolicitudCara[];
  }, [carasQuery.data, scIds]);

  // Agrupacion de pruebas por circuito para el tab "Pruebas". Mantiene el
  // orden de circuitos de la propuesta y pone al final cualquier prueba
  // con sc_id no encontrado en caras.
  //
  // Jos 2026-10-12: dentro de cada grupo las pruebas van ordenadas de
  // MAS RECIENTE a MAS VIEJA. Pendientes/revisión suelen ser las ultimas
  // creadas, por eso quedaban abajo en el orden natural del back.
  const pruebasPorCircuito = useMemo(() => {
    const caras = carasQuery.data || [];
    const porId = new Map<number, { cara: SolicitudCara | null; pruebas: PruebaColor[] }>();
    for (const p of pruebas) {
      const prev = porId.get(p.sc_id) || { cara: caras.find(c => c.id === p.sc_id) || null, pruebas: [] };
      prev.pruebas.push(p);
      porId.set(p.sc_id, prev);
    }
    const tsPrueba = (p: PruebaColor) => (p.created_at ? new Date(p.created_at).getTime() : 0) || p.id;
    const ordenarPorRecencia = (arr: PruebaColor[]) =>
      [...arr].sort((a, b) => {
        const diff = tsPrueba(b) - tsPrueba(a);
        return diff !== 0 ? diff : b.id - a.id;
      });
    // Jos 2026-10-12: ordenar grupos por su prueba mas reciente (desc),
    // asi el circuito donde se acaba de crear la nueva prueba sale arriba
    // aunque este mas abajo en el orden original de los circuitos.
    const grupos: Array<{ scId: number; cara: SolicitudCara | null; pruebas: PruebaColor[] }> = [];
    for (const [scId, g] of porId.entries()) {
      grupos.push({ scId, cara: g.cara, pruebas: ordenarPorRecencia(g.pruebas) });
    }
    grupos.sort((a, b) => {
      const maxA = Math.max(...a.pruebas.map(tsPrueba));
      const maxB = Math.max(...b.pruebas.map(tsPrueba));
      return maxB - maxA;
    });
    return grupos;
  }, [pruebas, carasQuery.data]);

  const circuitoLabel = useMemo(() => {
    // Se usa cuando initialScId esta set — un solo circuito.
    const c = (carasQuery.data || []).find(x => x.id === initialScId);
    if (!c) return '';
    return `${c.articulo || 'Sin articulo'} · ${c.formato || 'Sin formato'} · ${c.ciudad || c.estados || 'Sin ciudad'}`;
  }, [carasQuery.data, initialScId]);

  const handleUploadFile = async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const res = await uploadsService.uploadFile(file, 'pruebas-color');
      setArchivoFile(file);
      setArchivoUrl(res.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al subir archivo');
      setArchivoFile(null);
      setArchivoUrl(null);
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  const inputCls = `w-full rounded-lg border px-3 py-2 text-sm ${
    isDark ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600'
           : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400'
  }`;
  const labelCls = `text-xs font-medium mb-1 block ${isDark ? 'text-zinc-400' : 'text-gray-500'}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      {/* Feedback usuario 2026-09-25: el dropdown de "Selecciona un circuito"
          se cortaba porque el modal contenedor tenia overflow-y-auto y el
          panel absolute quedaba clippeado. Fix definitivo: el CircuitoCombobox
          usa position:fixed calculado por getBoundingClientRect (ver mas
          abajo), asi NUNCA se corta sin importar el tamaño del modal. Aqui
          solo se ajusta el layout a flex-col con el scroll en el body para
          que sea consistente. */}
      <div className={`w-full max-w-4xl rounded-2xl shadow-2xl border max-h-[95vh] flex flex-col ${
        isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200'
      }`}>
        {/* Header */}
        <div className={`flex items-start justify-between px-5 py-4 border-b flex-shrink-0 ${
          isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center ${
              isDark ? 'bg-fuchsia-500/15' : 'bg-fuchsia-50'
            }`}>
              <Paintbrush className={`h-5 w-5 ${isDark ? 'text-fuchsia-300' : 'text-fuchsia-600'}`} />
            </div>
            <div>
              <h3 className={`text-base font-semibold ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>
                Prueba de color
              </h3>
              <p className={`mt-0.5 text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                Propuesta #{propuestaId}{contextoNombre ? ` · ${contextoNombre}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-gray-100 text-gray-400'}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Barra de tabs (#252) — separar consulta de creacion para que el
            formulario no se mezcle con la lista de pruebas existentes. */}
        <div className={`flex items-stretch gap-1 px-5 pt-3 border-b flex-shrink-0 ${isDark ? 'border-zinc-800 bg-zinc-900' : 'border-gray-200 bg-white'}`}>
          <TabButton
            active={activeTab === 'pruebas'}
            onClick={() => setActiveTab('pruebas')}
            isDark={isDark}
            icon={<ClipboardList className="h-4 w-4" />}
            label="Pruebas"
            badge={pruebasAll.length}
          />
          {puedeGestionar && (
            <TabButton
              active={activeTab === 'nueva'}
              onClick={() => setActiveTab('nueva')}
              isDark={isDark}
              icon={<Plus className="h-4 w-4" />}
              label="Nueva solicitud"
            />
          )}
        </div>

        {/* Body — flex-1 con overflow interno para que el dropdown absolute
            no se corte pero el modal aun respete max-h-[92vh]. */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {activeTab === 'pruebas' && (
            <div className="space-y-4">
              {/* Filtro de circuitos (colapsable visualmente). Siempre
                  visible pero compacto arriba del listado. */}
              {!initialScId && (carasQuery.data || []).length > 1 && (
                <div className={`rounded-lg border p-3 ${isDark ? 'bg-zinc-800/40 border-zinc-800' : 'bg-gray-50 border-gray-200'}`}>
                  <div className={`text-[11px] font-medium mb-1.5 flex items-center justify-between ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                    <span>Filtrar por circuito</span>
                    {scIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setScIds([])}
                        className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`}
                      >
                        Limpiar filtro
                      </button>
                    )}
                  </div>
                  <CircuitoCombobox
                    caras={carasQuery.data || []}
                    isLoading={carasQuery.isLoading}
                    selectedIds={scIds}
                    onToggle={(id) => setScIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                    onClear={() => setScIds([])}
                    isDark={isDark}
                  />
                  {circuitosSeleccionados.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {circuitosSeleccionados.map(c => (
                        <span
                          key={c.id}
                          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] border ${isDark ? 'bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-500/40' : 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200'}`}
                        >
                          <span className="font-medium">#{c.id}</span>
                          <span className="truncate max-w-[180px]">{c.articulo || 'Sin articulo'}</span>
                          <button
                            type="button"
                            onClick={() => setScIds(prev => prev.filter(x => x !== c.id))}
                            className={isDark ? 'hover:text-fuchsia-50' : 'hover:text-fuchsia-900'}
                            title="Quitar"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {initialScId && (
                <div className={`px-3 py-2 rounded-lg border text-sm flex items-center gap-2 ${isDark ? 'bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-200' : 'bg-fuchsia-50 border-fuchsia-200 text-fuchsia-800'}`}>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isDark ? 'bg-fuchsia-500/20' : 'bg-fuchsia-100'}`}>Circuito</span>
                  <span className="truncate">{circuitoLabel || `#${initialScId}`}</span>
                </div>
              )}

              {/* Loader / vacío */}
              {pruebasQuery.isLoading && (
                <div className={`py-10 text-center text-sm flex items-center justify-center gap-2 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                  <Loader2 className="h-4 w-4 animate-spin" /> Cargando pruebas...
                </div>
              )}
              {!pruebasQuery.isLoading && pruebas.length === 0 && (
                <div className={`py-10 px-6 text-center rounded-lg border-2 border-dashed ${isDark ? 'border-zinc-800 text-zinc-500' : 'border-gray-200 text-gray-400'}`}>
                  <Paintbrush className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <div className="text-sm font-medium mb-1">
                    {scIds.length > 0 ? 'Sin pruebas en los circuitos filtrados' : 'Aún no hay pruebas de color'}
                  </div>
                  {puedeGestionar && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('nueva')}
                      className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${isDark ? 'bg-fuchsia-500/15 text-fuchsia-300 hover:bg-fuchsia-500/25' : 'bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100'}`}
                    >
                      <Plus className="h-3 w-3" /> Solicitar primera prueba
                    </button>
                  )}
                </div>
              )}

              {/* Listado agrupado por circuito — acordeon colapsable */}
              {pruebas.length > 0 && (
                <div className="space-y-3">
                  {pruebasPorCircuito.map(grupo => {
                    const colapsado = !expandedGroups.has(grupo.scId);
                    const resumenEstatus = (() => {
                      const counts: Record<string, number> = {};
                      for (const p of grupo.pruebas) counts[p.estatus] = (counts[p.estatus] || 0) + 1;
                      return counts;
                    })();
                    return (
                      <div key={grupo.scId} className={`rounded-lg border overflow-hidden ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
                        <button
                          type="button"
                          onClick={() => toggleGroup(grupo.scId)}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${isDark ? 'bg-zinc-900/60 hover:bg-zinc-800/80' : 'bg-gray-50 hover:bg-gray-100'}`}
                          title={colapsado ? 'Expandir grupo' : 'Colapsar grupo'}
                        >
                          <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${isDark ? 'text-fuchsia-300' : 'text-fuchsia-600'} ${colapsado ? '-rotate-90' : ''}`} />
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isDark ? 'bg-fuchsia-500/15 text-fuchsia-300' : 'bg-fuchsia-50 text-fuchsia-700'}`}>#{grupo.scId}</span>
                          <span className={`text-xs font-semibold ${isDark ? 'text-zinc-200' : 'text-gray-800'}`}>
                            {grupo.cara?.articulo || 'Circuito'}
                          </span>
                          {grupo.cara && (
                            <span className={`text-[11px] truncate ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
                              · {grupo.cara.formato || 'Sin formato'} · {grupo.cara.ciudad || grupo.cara.estados || 'Sin ciudad'}
                            </span>
                          )}
                          <span className={`ml-auto shrink-0 text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-gray-100 text-gray-600'}`}>
                            {grupo.pruebas.length} {grupo.pruebas.length === 1 ? 'prueba' : 'pruebas'}
                          </span>
                          {colapsado && (
                            <span className={`shrink-0 flex items-center gap-1 text-[10px] ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                              {Object.entries(resumenEstatus).slice(0, 3).map(([est, n]) => (
                                <span key={est} className={`px-1.5 py-0.5 rounded border ${isDark ? 'border-zinc-700' : 'border-gray-200'}`}>
                                  {ESTATUS_LABEL[est as EstatusPruebaColor] || est}: {n}
                                </span>
                              ))}
                            </span>
                          )}
                        </button>
                        {!colapsado && (
                          <div className={`px-3 py-2 space-y-2 ${isDark ? 'bg-zinc-950/40' : 'bg-white'}`}>
                            {grupo.pruebas.map(p => (
                              <PruebaCard
                                key={p.id}
                                prueba={p}
                                isDark={isDark}
                                puedeGestionar={puedeGestionar}
                                isUpdating={updateEstatusMutation.isPending || deleteMutation.isPending}
                                onDelete={() => {
                                  if (confirm(`¿Eliminar la prueba v${p.version}?`)) deleteMutation.mutate(p.id);
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'nueva' && puedeGestionar && (
            <div className="space-y-4">
              <div className={`rounded-lg border p-3 ${isDark ? 'bg-zinc-800/40 border-zinc-800' : 'bg-gray-50 border-gray-200'}`}>
                <label className={labelCls}>Circuito(s) a solicitar *</label>
                {initialScId ? (
                  <div className={`px-3 py-2 rounded-lg border text-sm ${isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-200' : 'bg-white border-gray-300 text-gray-800'}`}>
                    {circuitoLabel || `Circuito #${initialScId}`}
                  </div>
                ) : (
                  <>
                    <CircuitoCombobox
                      caras={carasQuery.data || []}
                      isLoading={carasQuery.isLoading}
                      selectedIds={scIds}
                      onToggle={(id) => setScIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                      onClear={() => setScIds([])}
                      isDark={isDark}
                    />
                    {circuitosSeleccionados.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {circuitosSeleccionados.map(c => (
                          <span
                            key={c.id}
                            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] border ${isDark ? 'bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-500/40' : 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200'}`}
                          >
                            <span className="font-medium">#{c.id}</span>
                            <span className="truncate max-w-[180px]">{c.articulo || 'Sin articulo'}</span>
                            <button
                              type="button"
                              onClick={() => setScIds(prev => prev.filter(x => x !== c.id))}
                              className={isDark ? 'hover:text-fuchsia-50' : 'hover:text-fuchsia-900'}
                              title="Quitar"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    {scIds.length > 1 && (
                      <p className={`mt-2 text-[11px] ${isDark ? 'text-amber-300/80' : 'text-amber-700'}`}>
                        Se creará una prueba por cada circuito seleccionado ({scIds.length} en total).
                      </p>
                    )}
                  </>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Arte *</label>
                  <div className="flex items-center gap-2">
                    <label
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer border transition-colors ${
                        isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700'
                               : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      } ${uploading ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {uploading ? 'Subiendo...' : archivoUrl ? 'Cambiar archivo' : 'Subir archivo'}
                      <input
                        type="file"
                        className="hidden"
                        disabled={uploading}
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) handleUploadFile(f);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    {archivoUrl && (
                      <a href={archivoUrl} target="_blank" rel="noreferrer" className={`text-xs underline truncate max-w-[260px] inline-flex items-center gap-1 ${isDark ? 'text-fuchsia-300' : 'text-fuchsia-700'}`} title={archivoFile?.name || archivoUrl}>
                        <FileImage className="h-3 w-3" />
                        {archivoFile?.name || 'archivo subido'}
                      </a>
                    )}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Nombre del arte *</label>
                  <input className={inputCls} value={nombreArte} onChange={e => setNombreArte(e.target.value)} placeholder="Ej. Arte v1 - versión CMYK" />
                </div>
                <div>
                  <label className={labelCls}>Notas (opcional)</label>
                  <textarea className={`${inputCls} resize-none`} rows={3} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Instrucciones para el proveedor, especificaciones de color, etc." />
                </div>

                {error && (
                  <div className={`text-xs flex items-center gap-2 px-3 py-2 rounded ${
                    isDark ? 'bg-red-500/10 border border-red-500/30 text-red-300' : 'bg-red-50 border border-red-200 text-red-700'
                  }`}>
                    <AlertCircle className="h-3 w-3 shrink-0" /> {error}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setActiveTab('pruebas')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border ${isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={async () => {
                      setError(null);
                      if (scIds.length === 0) { setError('Selecciona al menos un circuito'); return; }
                      if (!archivoUrl) { setError('Sube el arte de la prueba'); return; }
                      if (!nombreArte.trim()) { setError('El nombre del arte es requerido'); return; }
                      try {
                        const inputs = scIds.map(sc_id => ({
                          propuesta_id: propuestaId,
                          sc_id,
                          archivo: archivoUrl!,
                          nombre_arte: nombreArte.trim(),
                          notas: notas.trim() || undefined,
                        }));
                        await createMutation.mutateAsync(inputs);
                        setActiveTab('pruebas');
                      } catch {
                        // onError ya setea el error en el estado
                      }
                    }}
                    disabled={createMutation.isPending || !archivoUrl || !nombreArte.trim() || scIds.length === 0}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {createMutation.isPending ? 'Guardando...' : 'Solicitar prueba'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'nueva' && !puedeGestionar && (
            <div className={`px-3 py-6 rounded-lg text-sm text-center ${isDark ? 'bg-zinc-800/60 border border-zinc-700 text-zinc-400' : 'bg-gray-50 border border-gray-200 text-gray-500'}`}>
              Tu rol no puede solicitar pruebas de color.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Boton de tab reutilizable (#252) ───────────────────────────────────
function TabButton({ active, onClick, isDark, icon, label, badge }: {
  active: boolean;
  onClick: () => void;
  isDark: boolean;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
        active
          ? (isDark ? 'border-fuchsia-400 text-fuchsia-200' : 'border-fuchsia-600 text-fuchsia-700')
          : (isDark ? 'border-transparent text-zinc-400 hover:text-zinc-200' : 'border-transparent text-gray-500 hover:text-gray-800')
      }`}
    >
      {icon}
      {label}
      {typeof badge === 'number' && badge > 0 && (
        <span className={`ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
          active
            ? (isDark ? 'bg-fuchsia-500/20 text-fuchsia-200' : 'bg-fuchsia-100 text-fuchsia-700')
            : (isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-gray-100 text-gray-600')
        }`}>
          {badge}
        </span>
      )}
    </button>
  );
}

// ─── Card individual de una prueba de color ─────────────────────────────
// Rediseño #252: jerarquia clara entre "la prueba" (arte) y "la tarea
// asociada" (revision asignada). Mejor contraste en metadata y notas.
function PruebaCard({
  prueba,
  isDark,
  puedeGestionar,
  isUpdating,
  onDelete,
}: {
  prueba: PruebaColor;
  isDark: boolean;
  puedeGestionar: boolean;
  isUpdating: boolean;
  onDelete: () => void;
}) {
  const estatusStyle: Record<EstatusPruebaColor, string> = {
    solicitada: isDark ? 'bg-amber-500/15 text-amber-200 border-amber-500/40' : 'bg-amber-50 text-amber-800 border-amber-300',
    revision_artes: isDark ? 'bg-amber-500/15 text-amber-200 border-amber-500/40' : 'bg-amber-50 text-amber-800 border-amber-300',
    arte_aprobado: isDark ? 'bg-cyan-500/15 text-cyan-200 border-cyan-500/40' : 'bg-cyan-50 text-cyan-800 border-cyan-300',
    enviada_proveedor: isDark ? 'bg-blue-500/15 text-blue-200 border-blue-500/40' : 'bg-blue-50 text-blue-800 border-blue-300',
    aprobada: isDark ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40' : 'bg-emerald-50 text-emerald-800 border-emerald-300',
    rechazada: isDark ? 'bg-red-500/15 text-red-200 border-red-500/40' : 'bg-red-50 text-red-800 border-red-300',
  };
  // [Fix #258] Las transiciones de estatus (Aprobar/Rechazar directo) se
  // quitan del modal; viven en la tarea abierta.

  return (
    <div className={`rounded-lg border overflow-hidden ${isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-white border-gray-200'}`}>
      {/* Header: version + estatus + nombre + eliminar */}
      <div className={`px-3 py-2.5 flex items-start justify-between gap-3 border-b ${isDark ? 'border-zinc-800 bg-zinc-900/40' : 'border-gray-100 bg-gray-50/60'}`}>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className={`text-[11px] px-1.5 py-0.5 rounded font-bold ${isDark ? 'bg-fuchsia-500/20 text-fuchsia-200' : 'bg-fuchsia-100 text-fuchsia-700'}`}>
            v{prueba.version}
          </span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${estatusStyle[prueba.estatus]}`}>
            {ESTATUS_LABEL[prueba.estatus]}
          </span>
          <span className={`text-sm font-semibold truncate ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>
            {prueba.nombre_arte || `Prueba #${prueba.id}`}
          </span>
        </div>
        {puedeGestionar && (
          <button
            onClick={onDelete}
            disabled={isUpdating}
            className={`shrink-0 p-1 rounded transition-colors ${isDark ? 'text-zinc-500 hover:text-red-300 hover:bg-red-500/10' : 'text-gray-400 hover:text-red-600 hover:bg-red-50'} disabled:opacity-50`}
            title="Eliminar"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Cuerpo: metadata + notas + acciones del arte */}
      <div className="px-3 py-2.5 space-y-2">
        <div className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
          Solicitada por <span className={isDark ? 'text-zinc-200' : 'text-gray-800'}>{prueba.created_by_nombre}</span> · {formatDate(prueba.created_at)}
        </div>

        {prueba.notas && (
          <div className={`text-xs rounded-md px-2.5 py-1.5 whitespace-pre-wrap ${isDark ? 'bg-zinc-900/60 text-zinc-200 border border-zinc-800' : 'bg-gray-50 text-gray-700 border border-gray-200'}`}>
            {prueba.notas}
          </div>
        )}

        {/* [Fix #258] Jos: las acciones aprobar/rechazar NO deben estar como
            botones directos aqui. Deben ser herramientas de la tarea abierta.
            En el modal solo mostramos "Ver arte" + estatus visual (ya pintado
            en el header de la card). */}
        <div className="flex items-center gap-2 flex-wrap pt-0.5">
          <a href={prueba.archivo} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded border transition-colors ${isDark ? 'text-fuchsia-300 border-fuchsia-500/40 hover:bg-fuchsia-500/10' : 'text-fuchsia-700 border-fuchsia-300 hover:bg-fuchsia-50'}`}>
            <FileImage className="h-3 w-3" /> Ver arte
          </a>
        </div>
      </div>

      {/* Tareas asociadas: Revisión de artes + Seguimiento Prueba de color.
          Feedback Jos 2026-10-02: se consumen desde este modal para que el
          analista no tenga que ir al módulo de Tareas mientras la prueba
          vive en una propuesta. Al avanzar a campaña, estas mismas tareas
          se sincronizan al gestor de artes vía campania_id. */}
      <TareasAsociadasSection
        prueba={prueba}
        isDark={isDark}
        puedeGestionar={puedeGestionar}
      />
    </div>
  );
}

// ─── Tareas asociadas a una prueba (Revisión + Seguimiento) ─────────────
// [Fix #258 — expand inline] Jos: las acciones aprobar/rechazar/finalizar
// NO deben ser botones directos del modal; deben vivir dentro de la "tarea
// abierta". Implementacion: cada tarea es clickeable y al expandirla aparece
// el panel con las acciones (resolver). El estado colapsado solo muestra el
// estatus visual + lista de asignados.
function TareasAsociadasSection({
  prueba,
  isDark,
  puedeGestionar,
}: {
  prueba: PruebaColor;
  isDark: boolean;
  puedeGestionar: boolean;
}) {
  const pruebaId = prueba.id;
  const queryClient = useQueryClient();
  // [Fix #258 — modal dentro de modal] Jos: al clickear una tarea pendiente,
  // debe abrirse OTRO modal (overlay por encima del principal) con las
  // acciones de aprobar/rechazar/finalizar. El modal principal de prueba de
  // color NO tiene esas acciones directamente — solo las presenta cuando el
  // usuario explícitamente "abre" la tarea.
  const [openTareaId, setOpenTareaId] = useState<number | null>(null);

  const tareasQuery = useQuery({
    queryKey: ['pruebas-color', 'tareas', pruebaId],
    queryFn: () => pruebasColorService.listarTareas(pruebaId),
    staleTime: 10_000,
  });

  const resolver = useMutation({
    mutationFn: ({ tareaId, accion, comentario }: { tareaId: number; accion: AccionResolverTarea; comentario?: string }) =>
      pruebasColorService.resolverTarea(pruebaId, tareaId, accion, comentario),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pruebas-color', 'tareas', pruebaId] });
      queryClient.invalidateQueries({ queryKey: ['pruebas-color'] });
      setOpenTareaId(null);
    },
    onError: (e: Error) => alert(e.message),
  });

  const tareas = tareasQuery.data || [];
  const tareaAbierta = tareas.find(t => t.id === openTareaId) || null;

  if (tareasQuery.isLoading) {
    return (
      <div className={`px-3 py-2 border-t text-[11px] flex items-center gap-2 ${isDark ? 'border-zinc-800 text-zinc-400' : 'border-gray-200 text-gray-500'}`}>
        <Loader2 className="h-3 w-3 animate-spin" /> Cargando tareas...
      </div>
    );
  }

  if (tareas.length === 0) return null;

  const estadoColor = (estatus: string | null) => {
    if (!estatus) return isDark ? 'bg-zinc-700/60 text-zinc-200' : 'bg-gray-100 text-gray-700';
    const e = estatus.toLowerCase();
    if (e.includes('finaliz') || e.includes('atendid') || e.includes('aprob')) return isDark ? 'bg-emerald-500/20 text-emerald-200' : 'bg-emerald-100 text-emerald-800';
    if (e.includes('rechaz')) return isDark ? 'bg-red-500/20 text-red-200' : 'bg-red-100 text-red-800';
    return isDark ? 'bg-amber-500/20 text-amber-200' : 'bg-amber-100 text-amber-800';
  };

  return (
    <div className={`border-t ${isDark ? 'border-zinc-800 bg-zinc-900/30' : 'border-gray-200 bg-gray-50/50'}`}>
      <div className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide flex items-center gap-1.5 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
        <ClipboardList className="h-3 w-3" /> Tareas de la prueba ({tareas.length})
      </div>
      <div className={`px-3 pb-3 space-y-1.5`}>
        {tareas.map(t => {
          const esRevision = t.tipo === 'Revisión de artes';
          const esSeguimiento = t.tipo === 'Seguimiento Prueba de color';
          const asignados = t.asignado ? t.asignado.split(',').map(s => s.trim()).filter(Boolean) : [];
          const asignadosMostrar = asignados.slice(0, 2);
          const extra = asignados.length - asignadosMostrar.length;
          const puedeAprobar = esRevision && t.estatus === 'Pendiente' && puedeGestionar;
          const puedeFinalizar = esSeguimiento && t.estatus === 'Pendiente' && puedeGestionar;
          const tieneAcciones = puedeAprobar || puedeFinalizar;

          // Jos 2026-10-12: una tarea ya resuelta (Rechazado/Atendido/
          // Finalizada) tambien debe poder abrirse — en modo solo lectura —
          // para consultar el motivo que quedo guardado en la evidencia.
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setOpenTareaId(t.id)}
              className={`w-full rounded-lg border text-left transition-colors cursor-pointer ${isDark ? 'bg-zinc-800/60 border-zinc-700 hover:bg-zinc-800 hover:border-fuchsia-500/40' : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-fuchsia-300'}`}
              title={tieneAcciones ? 'Abrir tarea para atender' : 'Ver detalle de la tarea'}
            >
              <div className="px-2.5 py-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${estadoColor(t.estatus)}`}>
                    {t.estatus || 'Sin estado'}
                  </span>
                  <span className={`text-xs font-medium truncate ${isDark ? 'text-zinc-100' : 'text-gray-800'}`} title={t.tipo || ''}>
                    {esRevision ? 'Revisión de artes' : esSeguimiento ? 'Seguimiento' : t.tipo}
                  </span>
                </div>
                <ChevronRight className={`h-3.5 w-3.5 shrink-0 ${isDark ? 'text-fuchsia-300' : 'text-fuchsia-600'}`} />
              </div>
              {asignados.length > 0 && (
                <div className={`px-2.5 pb-2 flex items-center gap-1.5 text-[11px] ${isDark ? 'text-zinc-300' : 'text-gray-600'}`}>
                  <Users className={`h-3 w-3 shrink-0 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} />
                  <span className="truncate" title={asignados.join(', ')}>
                    {asignadosMostrar.join(', ')}
                    {extra > 0 && (
                      <span className={`ml-1 font-medium ${isDark ? 'text-fuchsia-300' : 'text-fuchsia-700'}`}>+{extra} más</span>
                    )}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Modal secundario de atención de tarea.
          [Fix #258] Jos: debe abrirse "otro modal" encima del principal con la
          info de la tarea + acciones aprobar/rechazar/finalizar. Overlay con
          z-index mayor al principal (z-[80]) y stop-propagation al clickear el
          contenido para que no cierre el modal padre. */}
      {tareaAbierta && (
        <AtenderTareaModal
          tarea={tareaAbierta}
          prueba={prueba}
          isDark={isDark}
          onClose={() => setOpenTareaId(null)}
          onAprobar={() => resolver.mutate({ tareaId: tareaAbierta.id, accion: 'aprobar' })}
          onRechazar={(comentario) => resolver.mutate({ tareaId: tareaAbierta.id, accion: 'rechazar', comentario })}
          onFinalizar={() => resolver.mutate({ tareaId: tareaAbierta.id, accion: 'finalizar' })}
          isSaving={resolver.isPending}
        />
      )}
    </div>
  );
}

// ─── Modal secundario: atender tarea de prueba de color ─────────────────
// [Fix #258] Overlay por encima del modal principal con info + acciones.
// Reutilizable: también puede invocarse desde el drawer de notificaciones.
function AtenderTareaModal({
  tarea,
  prueba,
  isDark,
  onClose,
  onAprobar,
  onRechazar,
  onFinalizar,
  isSaving,
}: {
  tarea: TareaAsociadaPruebaColor;
  prueba: PruebaColor;
  isDark: boolean;
  onClose: () => void;
  onAprobar: () => void;
  onRechazar: (comentario?: string) => void;
  onFinalizar: () => void;
  isSaving: boolean;
}) {
  const esRevision = tarea.tipo === 'Revisión de artes';
  const esSeguimiento = tarea.tipo === 'Seguimiento Prueba de color';
  const asignados = tarea.asignado ? tarea.asignado.split(',').map(s => s.trim()).filter(Boolean) : [];
  const [showRechazoInput, setShowRechazoInput] = useState(false);
  const [comentarioRechazo, setComentarioRechazo] = useState('');
  // Lightbox del arte de la prueba — Jos pidió preview + click para abrir
  // el visor grande (reutiliza el patrón del modal de galeria de artes).
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Reenvio inline — Jos 2026-10-12: cuando la tarea es Revisión Rechazada,
  // el creador puede re-subir arte sobre la misma prueba (NO crea v2).
  // Se expone un formulario dentro del mismo modalsito.
  const [showReenviarForm, setShowReenviarForm] = useState(false);
  const [reenviarFile, setReenviarFile] = useState<File | null>(null);
  const [reenviarUrl, setReenviarUrl] = useState<string | null>(null);
  const [reenviarNombre, setReenviarNombre] = useState(prueba.nombre_arte || '');
  const [reenviarNotas, setReenviarNotas] = useState(prueba.notas || '');
  const [reenviarError, setReenviarError] = useState<string | null>(null);
  const [reenviarUploading, setReenviarUploading] = useState(false);
  const queryClientLocal = useQueryClient();
  const reenviarMutation = useMutation({
    mutationFn: () => {
      if (!reenviarUrl) throw new Error('Sube el archivo del arte primero');
      return pruebasColorService.reenviar(prueba.id, {
        archivo: reenviarUrl,
        nombre_arte: reenviarNombre.trim() || undefined,
        notas: reenviarNotas.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClientLocal.invalidateQueries({ queryKey: ['pruebas-color', 'tareas', prueba.id] });
      queryClientLocal.invalidateQueries({ queryKey: ['pruebas-color'] });
      onClose();
    },
    onError: (e: Error) => setReenviarError(e.message),
  });
  const handleUploadReenviar = async (file: File) => {
    setReenviarError(null);
    setReenviarUploading(true);
    try {
      const res = await uploadsService.uploadFile(file, 'pruebas-color');
      setReenviarFile(file);
      setReenviarUrl(res.url);
    } catch (e) {
      setReenviarError(e instanceof Error ? e.message : 'Error al subir archivo');
      setReenviarFile(null);
      setReenviarUrl(null);
    } finally {
      setReenviarUploading(false);
    }
  };

  // Resolucion persistida en tarea.evidencia (back guarda motivoRechazo o
  // comentarioResolucion + resueltaPor + resueltaAt al atender la tarea).
  // Jos 2026-10-12: al reabrir una tarea ya resuelta se debe mostrar quien
  // la atendio, cuando y el motivo capturado.
  const resolucion = useMemo(() => {
    if (!tarea.evidencia) return null;
    try {
      const data = JSON.parse(tarea.evidencia);
      const motivo = data.motivoRechazo || data.comentarioResolucion || null;
      if (!motivo && !data.resueltaPor) return null;
      return {
        motivo: typeof motivo === 'string' ? motivo : null,
        resueltaPor: data.resueltaPor || null,
        resueltaAt: data.resueltaAt || null,
      };
    } catch { return null; }
  }, [tarea.evidencia]);

  const yaResuelta = tarea.estatus !== 'Pendiente';
  const esRechazada = (tarea.estatus || '').toLowerCase().includes('rechaz');
  const esAtendidaOk = ['atendido', 'finalizada'].includes((tarea.estatus || '').toLowerCase());

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-2xl rounded-xl border shadow-2xl flex flex-col max-h-[92vh] ${isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-100' : 'bg-white border-gray-200 text-gray-900'}`}
      >
        {/* Header */}
        <div className={`shrink-0 px-5 py-3 flex items-start justify-between gap-3 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
          <div className="flex-1 min-w-0">
            <div className={`text-[10px] uppercase tracking-wide font-semibold ${isDark ? 'text-fuchsia-300' : 'text-fuchsia-700'}`}>
              {yaResuelta ? 'Detalle de la tarea' : 'Atender tarea'}
            </div>
            <div className="text-base font-semibold mt-0.5">
              {esRevision ? 'Revisión de artes' : esSeguimiento ? 'Seguimiento Prueba de color' : tarea.tipo}
            </div>
            <div className={`text-[11px] mt-0.5 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
              Tarea #{tarea.id} · {tarea.estatus || 'Sin estado'}
            </div>
          </div>
          <button
            onClick={onClose}
            className={`shrink-0 p-1 rounded transition-colors ${isDark ? 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body (scrolleable para que crezca sin desbordar) */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Preview del arte asociado a la prueba. Click abre lightbox. */}
          {prueba.archivo && (
            <div>
              <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-semibold mb-1.5 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                <FileImage className="h-3 w-3" /> Arte de la prueba
              </div>
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className={`relative w-full h-64 rounded-lg overflow-hidden border transition-all group ${isDark ? 'border-zinc-700 bg-zinc-800 hover:border-fuchsia-500/60' : 'border-gray-300 bg-gray-50 hover:border-fuchsia-400'}`}
                title="Click para ver en grande"
              >
                <img
                  src={prueba.archivo}
                  alt={prueba.nombre_arte || `Prueba #${prueba.id}`}
                  className="w-full h-full object-contain"
                />
                <div className={`absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? 'bg-black/40' : 'bg-black/30'}`}>
                  <span className="text-xs font-semibold text-white px-2.5 py-1 rounded bg-black/60 inline-flex items-center gap-1">
                    <Search className="h-3 w-3" /> Ver en grande
                  </span>
                </div>
              </button>
              {prueba.nombre_arte && (
                <div className={`text-[11px] mt-1 truncate ${isDark ? 'text-zinc-400' : 'text-gray-500'}`} title={prueba.nombre_arte}>
                  v{prueba.version} · {prueba.nombre_arte}
                </div>
              )}
            </div>
          )}

          {/* Resolucion previa — solo si la tarea ya fue atendida.
              Muestra motivo capturado, quien y cuando. */}
          {yaResuelta && resolucion && (
            <div className={`rounded-lg border px-3 py-2.5 ${esRechazada ? (isDark ? 'bg-red-500/10 border-red-500/40' : 'bg-red-50 border-red-200') : esAtendidaOk ? (isDark ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-emerald-50 border-emerald-200') : (isDark ? 'bg-zinc-800/60 border-zinc-700' : 'bg-gray-50 border-gray-200')}`}>
              <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-semibold mb-1.5 ${esRechazada ? (isDark ? 'text-red-200' : 'text-red-800') : esAtendidaOk ? (isDark ? 'text-emerald-200' : 'text-emerald-800') : (isDark ? 'text-zinc-300' : 'text-gray-600')}`}>
                {esRechazada ? <XCircle className="h-3 w-3" /> : esAtendidaOk ? <CheckCircle2 className="h-3 w-3" /> : <Flag className="h-3 w-3" />}
                {esRechazada ? 'Motivo del rechazo' : esAtendidaOk ? 'Resolución' : 'Detalle'}
              </div>
              {resolucion.motivo && (
                <div className={`text-sm whitespace-pre-wrap ${isDark ? 'text-zinc-100' : 'text-gray-800'}`}>
                  {resolucion.motivo}
                </div>
              )}
              <div className={`text-[11px] mt-1.5 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                {resolucion.resueltaPor && <>Atendida por <span className={isDark ? 'text-zinc-200' : 'text-gray-700'}>{resolucion.resueltaPor}</span></>}
                {resolucion.resueltaAt && <> · {new Date(resolucion.resueltaAt).toLocaleString('es-MX')}</>}
              </div>
            </div>
          )}
          {yaResuelta && !resolucion && (
            <div className={`rounded-lg border px-3 py-2.5 text-xs ${isDark ? 'bg-zinc-800/60 border-zinc-700 text-zinc-400' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
              Esta tarea ya fue atendida.
            </div>
          )}

          {/* Formulario inline para reenviar la prueba rechazada — Jos 2026-10-12.
              Sobreescribe la MISMA prueba, no crea una v2 nueva. */}
          {showReenviarForm && esRechazada && esRevision && (
            <div className={`rounded-lg border p-3 space-y-3 ${isDark ? 'bg-fuchsia-500/5 border-fuchsia-500/30' : 'bg-fuchsia-50/50 border-fuchsia-300'}`}>
              <div className={`text-[10px] uppercase tracking-wide font-semibold flex items-center gap-1.5 ${isDark ? 'text-fuchsia-300' : 'text-fuchsia-700'}`}>
                <Upload className="h-3 w-3" /> Reenviar a revisión
              </div>
              <div className={`text-[11px] ${isDark ? 'text-zinc-300' : 'text-gray-600'}`}>
                Sube el arte corregido. Se enviará la MISMA prueba a los mismos revisores (sin crear versión nueva).
              </div>

              <div>
                <label className={`text-[11px] font-semibold ${isDark ? 'text-zinc-200' : 'text-gray-800'}`}>Arte *</label>
                {reenviarUrl ? (
                  <div className={`mt-1 flex items-center gap-2 text-xs rounded border px-2 py-1.5 ${isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-200' : 'bg-white border-gray-300 text-gray-700'}`}>
                    <FileImage className="h-3.5 w-3.5" />
                    <span className="truncate flex-1">{reenviarFile?.name || 'arte.jpg'}</span>
                    <button
                      type="button"
                      onClick={() => { setReenviarFile(null); setReenviarUrl(null); }}
                      className={`text-[10px] font-medium ${isDark ? 'text-fuchsia-300 hover:text-fuchsia-200' : 'text-fuchsia-700 hover:text-fuchsia-900'}`}
                    >
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadReenviar(f); }}
                    disabled={reenviarUploading}
                    className={`mt-1 w-full text-[11px] file:mr-2 file:py-1 file:px-2 file:rounded file:border file:text-[11px] file:font-medium ${isDark ? 'text-zinc-300 file:bg-zinc-800 file:border-zinc-700 file:text-zinc-200' : 'text-gray-700 file:bg-white file:border-gray-300 file:text-gray-700'}`}
                  />
                )}
                {reenviarUploading && (
                  <div className={`mt-1 flex items-center gap-1.5 text-[10px] ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                    <Loader2 className="h-3 w-3 animate-spin" /> Subiendo arte...
                  </div>
                )}
              </div>

              <div>
                <label className={`text-[11px] font-semibold ${isDark ? 'text-zinc-200' : 'text-gray-800'}`}>Nombre del arte</label>
                <input
                  type="text"
                  value={reenviarNombre}
                  onChange={(e) => setReenviarNombre(e.target.value)}
                  placeholder="Ej. prueba 5 corregida"
                  className={`mt-1 w-full text-xs rounded-md border px-2.5 py-1.5 outline-none ${isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-100 focus:border-fuchsia-500/60' : 'bg-white border-gray-300 text-gray-900 focus:border-fuchsia-400'}`}
                />
              </div>

              <div>
                <label className={`text-[11px] font-semibold ${isDark ? 'text-zinc-200' : 'text-gray-800'}`}>Notas (opcional)</label>
                <textarea
                  value={reenviarNotas}
                  onChange={(e) => setReenviarNotas(e.target.value)}
                  rows={2}
                  placeholder="Cambios aplicados..."
                  className={`mt-1 w-full text-xs rounded-md border px-2.5 py-1.5 outline-none ${isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-100 focus:border-fuchsia-500/60' : 'bg-white border-gray-300 text-gray-900 focus:border-fuchsia-400'}`}
                />
              </div>

              {reenviarError && (
                <div className={`text-[11px] px-2 py-1 rounded ${isDark ? 'bg-red-500/15 text-red-200 border border-red-500/30' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {reenviarError}
                </div>
              )}
            </div>
          )}

          {asignados.length > 0 && (
            <div>
              <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-semibold mb-1 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                <Users className="h-3 w-3" /> Asignados ({asignados.length})
              </div>
              <div className={`text-xs ${isDark ? 'text-zinc-200' : 'text-gray-700'}`}>{asignados.join(', ')}</div>
            </div>
          )}

          {!yaResuelta && (
            <div className={`text-xs rounded-md px-3 py-2 ${isDark ? 'bg-zinc-800/60 text-zinc-300 border border-zinc-700' : 'bg-gray-50 text-gray-600 border border-gray-200'}`}>
              {esRevision
                ? 'Aprobar permite al arte avanzar a producción. Rechazar devuelve la prueba al diseñador con un comentario.'
                : esSeguimiento
                  ? 'Marca la tarea de seguimiento como finalizada una vez atendida la aprobación del cliente.'
                  : 'Elige una acción para resolver esta tarea.'}
            </div>
          )}

          {/* Formulario de rechazo (solo cuando el usuario pulsa Rechazar) */}
          {showRechazoInput && (
            <div className="space-y-1.5">
              <label className={`text-[11px] font-semibold ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>
                Motivo del rechazo (opcional)
              </label>
              <textarea
                value={comentarioRechazo}
                onChange={(e) => setComentarioRechazo(e.target.value)}
                rows={3}
                autoFocus
                placeholder="Describe por qué se rechaza la prueba..."
                className={`w-full text-xs rounded-md border px-2.5 py-1.5 outline-none transition-colors ${isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:border-fuchsia-500/60' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-fuchsia-400'}`}
              />
            </div>
          )}
        </div>

        {/* Footer con acciones */}
        <div className={`shrink-0 px-5 py-3 flex items-center justify-end gap-2 border-t ${isDark ? 'border-zinc-800 bg-zinc-900/60' : 'border-gray-200 bg-gray-50/60'}`}>
          {yaResuelta ? (
            // Tarea ya atendida: Cerrar + "Subir arte / Reenviar" si fue rechazada.
            // Jos 2026-10-12: el creador puede editar la MISMA prueba inline en
            // este mismo modal (no se crea v2).
            <>
              {showReenviarForm ? (
                <>
                  <button
                    onClick={() => { setShowReenviarForm(false); setReenviarError(null); }}
                    disabled={reenviarMutation.isPending}
                    className={`text-xs font-medium px-3 py-1.5 rounded border transition-colors ${isDark ? 'border-zinc-700 text-zinc-300 hover:bg-zinc-800' : 'border-gray-300 text-gray-700 hover:bg-gray-100'} disabled:opacity-50`}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => reenviarMutation.mutate()}
                    disabled={reenviarMutation.isPending || !reenviarUrl || reenviarUploading}
                    className={`text-xs font-semibold px-4 py-2 rounded border transition-colors inline-flex items-center gap-1 ${isDark ? 'border-fuchsia-500/60 text-fuchsia-100 bg-fuchsia-500/20 hover:bg-fuchsia-500/30' : 'border-fuchsia-400 text-fuchsia-800 bg-fuchsia-50 hover:bg-fuchsia-100'} disabled:opacity-50`}
                  >
                    {reenviarMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    Reenviar a revisión
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={onClose}
                    className={`text-xs font-semibold px-4 py-2 rounded border transition-colors ${isDark ? 'border-zinc-700 text-zinc-200 bg-zinc-800 hover:bg-zinc-700' : 'border-gray-300 text-gray-800 bg-white hover:bg-gray-50'}`}
                  >
                    Cerrar
                  </button>
                  {esRechazada && esRevision && (
                    <button
                      onClick={() => setShowReenviarForm(true)}
                      className={`text-xs font-semibold px-4 py-2 rounded border transition-colors inline-flex items-center gap-1 ${isDark ? 'border-fuchsia-500/60 text-fuchsia-100 bg-fuchsia-500/20 hover:bg-fuchsia-500/30' : 'border-fuchsia-400 text-fuchsia-800 bg-fuchsia-50 hover:bg-fuchsia-100'}`}
                    >
                      <Upload className="h-3.5 w-3.5" /> Subir arte corregido
                    </button>
                  )}
                </>
              )}
            </>
          ) : showRechazoInput ? (
            <>
              <button
                onClick={() => { setShowRechazoInput(false); setComentarioRechazo(''); }}
                disabled={isSaving}
                className={`text-xs font-medium px-3 py-1.5 rounded border transition-colors ${isDark ? 'border-zinc-700 text-zinc-300 hover:bg-zinc-800' : 'border-gray-300 text-gray-700 hover:bg-gray-100'} disabled:opacity-50`}
              >
                Cancelar
              </button>
              <button
                onClick={() => onRechazar(comentarioRechazo.trim() || undefined)}
                disabled={isSaving}
                className={`text-xs font-semibold px-3 py-1.5 rounded border transition-colors inline-flex items-center gap-1 ${isDark ? 'border-red-500/60 text-red-100 bg-red-500/20 hover:bg-red-500/30' : 'border-red-400 text-red-800 bg-red-50 hover:bg-red-100'} disabled:opacity-50`}
              >
                {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                Confirmar rechazo
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                disabled={isSaving}
                className={`text-xs font-medium px-3 py-1.5 rounded border transition-colors ${isDark ? 'border-zinc-700 text-zinc-300 hover:bg-zinc-800' : 'border-gray-300 text-gray-700 hover:bg-gray-100'} disabled:opacity-50`}
              >
                Cerrar
              </button>
              {esRevision && (
                <>
                  <button
                    onClick={() => setShowRechazoInput(true)}
                    disabled={isSaving}
                    className={`text-xs font-semibold px-3 py-1.5 rounded border transition-colors inline-flex items-center gap-1 ${isDark ? 'border-red-500/50 text-red-200 bg-red-500/10 hover:bg-red-500/20' : 'border-red-400 text-red-800 bg-red-50 hover:bg-red-100'} disabled:opacity-50`}
                  >
                    <XCircle className="h-3 w-3" /> Rechazar
                  </button>
                  <button
                    onClick={onAprobar}
                    disabled={isSaving}
                    className={`text-xs font-semibold px-3 py-1.5 rounded border transition-colors inline-flex items-center gap-1 ${isDark ? 'border-emerald-500/60 text-emerald-100 bg-emerald-500/20 hover:bg-emerald-500/30' : 'border-emerald-400 text-emerald-800 bg-emerald-50 hover:bg-emerald-100'} disabled:opacity-50`}
                  >
                    {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                    Aprobar
                  </button>
                </>
              )}
              {esSeguimiento && (
                <button
                  onClick={onFinalizar}
                  disabled={isSaving}
                  className={`text-xs font-semibold px-3 py-1.5 rounded border transition-colors inline-flex items-center gap-1 ${isDark ? 'border-emerald-500/60 text-emerald-100 bg-emerald-500/20 hover:bg-emerald-500/30' : 'border-emerald-400 text-emerald-800 bg-emerald-50 hover:bg-emerald-100'} disabled:opacity-50`}
                >
                  {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Flag className="h-3 w-3" />}
                  Finalizar
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Lightbox del arte — overlay por encima de todo (z-[90]) */}
      {lightboxOpen && prueba.archivo && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/90"
          onClick={(e) => { e.stopPropagation(); setLightboxOpen(false); }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setLightboxOpen(false); }}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors z-10"
            title="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
          <a
            href={prueba.archivo}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 text-white text-xs font-medium hover:bg-black/80 transition-colors z-10"
            title="Abrir original en pestaña nueva"
          >
            <FileImage className="h-3.5 w-3.5" /> Abrir original
          </a>
          <img
            src={prueba.archivo}
            alt={prueba.nombre_arte || `Prueba #${prueba.id}`}
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-full object-contain rounded shadow-2xl"
          />
          {prueba.nombre_arte && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-black/60 text-white text-xs font-medium"
            >
              v{prueba.version} · {prueba.nombre_arte}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Combobox de circuitos con búsqueda ─────────────────────────────────
// Selector custom (no select nativo) con input de búsqueda. Filtra por ID,
// artículo, formato, ciudad y estado. Cierra con click afuera o Escape.
function CircuitoCombobox({
  caras,
  isLoading,
  selectedIds,
  onToggle,
  onClear,
  isDark,
}: {
  caras: SolicitudCara[];
  isLoading: boolean;
  selectedIds: number[];
  onToggle: (id: number) => void;
  onClear: () => void;
  isDark: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reposicionar el panel via getBoundingClientRect + position:fixed cada vez
  // que abre — asi nunca se corta por overflow del modal contenedor.
  // Feedback usuario 2026-09-25.
  const positionPanel = () => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const vh = window.innerHeight;
    const spaceBelow = vh - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    // Preferir abrir hacia abajo. Si abajo hay < 280px y arriba hay mas espacio,
    // abrir hacia arriba.
    const openUp = spaceBelow < 280 && spaceAbove > spaceBelow;
    setPanelStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      top: openUp ? undefined : rect.bottom + 4,
      bottom: openUp ? vh - rect.top + 4 : undefined,
      maxHeight: openUp ? Math.max(200, spaceAbove) : Math.max(200, spaceBelow),
    });
  };

  useEffect(() => {
    if (!open) return;
    positionPanel();
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideContainer = containerRef.current?.contains(target);
      const insidePanel = panelRef.current?.contains(target);
      if (!insideContainer && !insidePanel) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onResize = () => positionPanel();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    // Auto-focus del input de búsqueda al abrir.
    setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return caras;
    return caras.filter(c => {
      const parts = [
        String(c.id),
        c.articulo || '',
        c.formato || '',
        c.ciudad || '',
        c.estados || '',
        c.tipo || '',
      ].join(' ').toLowerCase();
      return parts.includes(q);
    });
  }, [caras, query]);

  const selectedCount = selectedIds.length;
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const labelFor = (c: SolicitudCara) =>
    `#${c.id} — ${c.articulo || 'Sin articulo'} · ${c.formato || 'Sin formato'} · ${c.ciudad || c.estados || 'Sin ciudad'}`;

  const btnCls = `w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm text-left ${
    isDark ? 'bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-800/80'
           : 'bg-white border-gray-300 text-gray-900 hover:bg-gray-50'
  }`;
  // Panel del dropdown: position:fixed calculado en positionPanel() para que
  // NUNCA se corte por overflow del modal contenedor. z-[200] para ganarle
  // a cualquier modal/overlay padre.
  const panelCls = `z-[200] rounded-lg border shadow-xl flex flex-col overflow-hidden ${
    isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200'
  }`;
  const searchCls = `w-full bg-transparent outline-none text-sm ${
    isDark ? 'text-white placeholder:text-zinc-500' : 'text-gray-900 placeholder:text-gray-400'
  }`;

  const btnLabel = selectedCount === 0
    ? (isLoading ? 'Cargando circuitos...' : 'Selecciona uno o varios circuitos...')
    : (selectedCount === 1
        ? labelFor(caras.find(c => c.id === selectedIds[0]) || caras[0])
        : `${selectedCount} circuitos seleccionados`);

  return (
    <div ref={containerRef} className="relative">
      <button ref={btnRef} type="button" onClick={() => setOpen(o => !o)} className={btnCls}>
        <span className={`truncate ${selectedCount === 0 ? (isDark ? 'text-zinc-500' : 'text-gray-400') : ''}`}>
          {btnLabel}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {selectedCount > 0 && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onClear(); setOpen(false); setQuery(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onClear(); setOpen(false); setQuery(''); } }}
              className={`p-0.5 rounded cursor-pointer ${isDark ? 'hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200' : 'hover:bg-gray-200 text-gray-500 hover:text-gray-700'}`}
              title="Quitar todos los circuitos"
              aria-label="Quitar todos los circuitos seleccionados"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''} ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} />
        </div>
      </button>

      {open && (
        <div ref={panelRef} className={panelCls} style={panelStyle}>
          <div className={`flex items-center gap-2 px-3 py-2 border-b flex-shrink-0 ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
            <Search className={`h-4 w-4 shrink-0 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar por #ID, articulo, formato, ciudad..."
              className={searchCls}
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} className={isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-gray-400 hover:text-gray-600'} title="Limpiar">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto py-1">
            {isLoading && (
              <div className={`px-3 py-4 text-xs text-center flex items-center justify-center gap-2 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                <Loader2 className="h-3 w-3 animate-spin" /> Cargando circuitos...
              </div>
            )}
            {!isLoading && filtered.length === 0 && (
              <div className={`px-3 py-4 text-xs text-center ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                {caras.length === 0 ? 'La propuesta no tiene circuitos.' : 'Sin coincidencias.'}
              </div>
            )}
            {filtered.map(c => {
              const isSel = selectedSet.has(c.id);
              return (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => { onToggle(c.id); /* no cerramos para permitir multi */ }}
                  className={`w-full text-left px-3 py-2 text-xs flex items-start gap-2 transition-colors ${
                    isSel
                      ? (isDark ? 'bg-fuchsia-500/15 text-fuchsia-200' : 'bg-fuchsia-50 text-fuchsia-900')
                      : (isDark ? 'text-zinc-200 hover:bg-zinc-800' : 'text-gray-800 hover:bg-gray-50')
                  }`}
                >
                  <span className={`w-4 h-4 shrink-0 mt-0.5 rounded border flex items-center justify-center ${
                    isSel
                      ? (isDark ? 'bg-fuchsia-600 border-fuchsia-600' : 'bg-fuchsia-600 border-fuchsia-600')
                      : (isDark ? 'border-zinc-600' : 'border-gray-300')
                  }`}>
                    {isSel && <Check className="h-3 w-3 text-white" />}
                  </span>
                  <span className="truncate">
                    <span className={`font-medium ${isDark ? 'text-fuchsia-300' : 'text-fuchsia-700'}`}>#{c.id}</span>
                    {' — '}
                    <span>{c.articulo || 'Sin articulo'}</span>
                    <span className={isDark ? 'text-zinc-500' : 'text-gray-500'}> · {c.formato || 'Sin formato'} · {c.ciudad || c.estados || 'Sin ciudad'}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className={`px-3 py-1.5 text-[10px] border-t ${isDark ? 'border-zinc-800 text-zinc-500' : 'border-gray-200 text-gray-400'}`}>
            {filtered.length} de {caras.length} circuito(s)
          </div>
        </div>
      )}
    </div>
  );
}
