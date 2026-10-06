import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Check, CheckCircle2, ChevronDown, Loader2, Paintbrush, Search, Send, Trash2, X, Upload, FileImage, ClipboardList, XCircle, Flag } from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import {
  pruebasColorService,
  PruebaColor,
  EstatusPruebaColor,
  ESTATUS_LABEL,
  TRANSICIONES,
  puedeGestionarPruebaColor,
  TareaAsociadaPruebaColor,
  AccionResolverTarea,
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
}

// Modal reusable de Prueba de Color. Se usa desde 3 lugares:
// (1) listado de propuestas — sin initialScId (el usuario elige circuito).
// (2) listado de campañas — igual, sin initialScId.
// (3) gestión de artes (campaña con APS) — con initialScId preseleccionado.
export function PruebasColorModal({ isOpen, onClose, propuestaId, contextoNombre, initialScId }: Props) {
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
    }
  }, [isOpen, initialScId]);

  // Circuitos de la propuesta (para el dropdown de selección).
  const carasQuery = useQuery({
    queryKey: ['propuesta-caras-prueba-color', propuestaId],
    queryFn: () => propuestasService.getCaras(propuestaId),
    enabled: isOpen && !!propuestaId,
  });

  // Pruebas de los circuitos seleccionados. Si hay varios circuitos, listamos
  // por propuesta y filtramos localmente — evita N fetches.
  const pruebasQuery = useQuery({
    queryKey: ['pruebas-color', 'propuesta', propuestaId],
    queryFn: () => pruebasColorService.listar({ propuesta_id: propuestaId }),
    enabled: isOpen && !!propuestaId && scIds.length > 0,
  });

  const pruebas = useMemo(() => {
    const all = pruebasQuery.data || [];
    if (scIds.length === 0) return [];
    const setScs = new Set(scIds);
    return all.filter(p => setScs.has(p.sc_id));
  }, [pruebasQuery.data, scIds]);

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

  const handleSubmit = () => {
    setError(null);
    if (scIds.length === 0) { setError('Selecciona al menos un circuito'); return; }
    if (!archivoUrl) { setError('Sube el arte de la prueba'); return; }
    if (!nombreArte.trim()) { setError('El nombre del arte es requerido'); return; }
    // Una prueba por circuito seleccionado.
    const inputs = scIds.map(sc_id => ({
      propuesta_id: propuestaId,
      sc_id,
      archivo: archivoUrl!,
      nombre_arte: nombreArte.trim(),
      notas: notas.trim() || undefined,
    }));
    createMutation.mutate(inputs);
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

        {/* Body — flex-1 con overflow interno para que el dropdown absolute
            no se corte pero el modal aun respete max-h-[92vh]. */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Selector circuito(s) - multi-select */}
          <div>
            <label className={labelCls}>Circuito(s)</label>
            {initialScId ? (
              <div className={`px-3 py-2 rounded-lg border text-sm ${isDark ? 'bg-zinc-800/60 border-zinc-700 text-zinc-300' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
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
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] border ${isDark ? 'bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-500/30' : 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200'}`}
                      >
                        <span className="font-medium">#{c.id}</span>
                        <span className="truncate max-w-[200px]">{c.articulo || 'Sin articulo'} · {c.formato || 'Sin formato'}</span>
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
              </>
            )}
          </div>

          {/* Lista de pruebas de los circuitos seleccionados. */}
          {scIds.length > 0 && (
            <div className="space-y-2">
              <div className={`text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                Pruebas previas de {scIds.length === 1 ? 'este circuito' : `los ${scIds.length} circuitos seleccionados`} ({pruebas.length})
              </div>
              {pruebasQuery.isLoading && (
                <div className={`px-3 py-3 text-xs flex items-center gap-2 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                  <Loader2 className="h-3 w-3 animate-spin" /> Cargando...
                </div>
              )}
              {!pruebasQuery.isLoading && pruebas.length === 0 && (
                <div className={`px-3 py-3 text-xs text-center rounded-lg border ${isDark ? 'text-zinc-500 border-zinc-800' : 'text-gray-400 border-gray-200'}`}>
                  Sin pruebas de color para este circuito todavía.
                </div>
              )}
              {pruebas.length > 0 && (
                <div className={`space-y-2 ${pruebas.length > 2 ? 'max-h-72 overflow-y-auto pr-1' : ''}`}>
                  {pruebas.map(p => (
                    <PruebaCard
                      key={p.id}
                      prueba={p}
                      isDark={isDark}
                      puedeGestionar={puedeGestionar}
                      isUpdating={updateEstatusMutation.isPending || deleteMutation.isPending}
                      onChangeEstatus={(nuevo) => updateEstatusMutation.mutate({ id: p.id, estatus: nuevo })}
                      onDelete={() => {
                        if (confirm(`¿Eliminar la prueba v${p.version}?`)) deleteMutation.mutate(p.id);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Nueva prueba */}
          {scIds.length > 0 && puedeGestionar && (
            <div className={`pt-3 border-t ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
              <div className={`text-sm font-medium mb-2 ${isDark ? 'text-fuchsia-300' : 'text-fuchsia-700'}`}>
                Nueva prueba
              </div>
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Arte *</label>
                  <div className="flex items-center gap-2">
                    <label
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer border ${
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
                      <a href={archivoUrl} target="_blank" rel="noreferrer" className={`text-xs underline truncate max-w-[220px] ${isDark ? 'text-fuchsia-300' : 'text-fuchsia-700'}`} title={archivoFile?.name || archivoUrl}>
                        <FileImage className="h-3 w-3 inline mr-1" />
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
                    isDark ? 'bg-red-500/10 border border-red-500/30 text-red-300' : 'bg-red-50 border border-red-200 text-red-600'
                  }`}>
                    <AlertCircle className="h-3 w-3 shrink-0" /> {error}
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    onClick={handleSubmit}
                    disabled={createMutation.isPending || !archivoUrl || !nombreArte.trim()}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {createMutation.isPending ? 'Guardando...' : 'Solicitar prueba de color'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {scIds.length > 0 && !puedeGestionar && (
            <div className={`px-3 py-2 rounded-lg text-xs ${isDark ? 'bg-zinc-800/60 border border-zinc-700 text-zinc-400' : 'bg-gray-50 border border-gray-200 text-gray-500'}`}>
              Tu rol no puede solicitar pruebas de color. Puedes ver las existentes arriba.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Card individual de una prueba de color ─────────────────────────────
function PruebaCard({
  prueba,
  isDark,
  puedeGestionar,
  isUpdating,
  onChangeEstatus,
  onDelete,
}: {
  prueba: PruebaColor;
  isDark: boolean;
  puedeGestionar: boolean;
  isUpdating: boolean;
  onChangeEstatus: (e: EstatusPruebaColor) => void;
  onDelete: () => void;
}) {
  const estatusStyle: Record<EstatusPruebaColor, string> = {
    solicitada: isDark ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' : 'bg-amber-50 text-amber-700 border-amber-200',
    revision_artes: isDark ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' : 'bg-amber-50 text-amber-700 border-amber-200',
    arte_aprobado: isDark ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' : 'bg-cyan-50 text-cyan-700 border-cyan-200',
    enviada_proveedor: isDark ? 'bg-blue-500/15 text-blue-300 border-blue-500/30' : 'bg-blue-50 text-blue-700 border-blue-200',
    aprobada: isDark ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rechazada: isDark ? 'bg-red-500/15 text-red-300 border-red-500/30' : 'bg-red-50 text-red-700 border-red-200',
  };
  const transiciones = TRANSICIONES[prueba.estatus] || [];

  return (
    <div className={`rounded-lg border p-3 ${isDark ? 'bg-zinc-800/40 border-zinc-800' : 'bg-gray-50 border-gray-200'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isDark ? 'bg-fuchsia-500/15 text-fuchsia-300' : 'bg-fuchsia-50 text-fuchsia-700'}`}>
            v{prueba.version}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${estatusStyle[prueba.estatus]}`}>
            {ESTATUS_LABEL[prueba.estatus]}
          </span>
          <span className={`text-xs font-medium truncate ${isDark ? 'text-zinc-200' : 'text-gray-800'}`}>
            {prueba.nombre_arte || `Prueba #${prueba.id}`}
          </span>
        </div>
        {puedeGestionar && transiciones.length > 0 && (
          <button
            onClick={onDelete}
            disabled={isUpdating}
            className={`p-1 rounded hover:bg-red-500/10 ${isDark ? 'text-zinc-500 hover:text-red-300' : 'text-gray-400 hover:text-red-600'} disabled:opacity-50`}
            title="Eliminar"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className={`mt-1 text-[11px] ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
        {prueba.created_by_nombre} · {formatDate(prueba.created_at)}
      </div>

      {prueba.notas && (
        <p className={`mt-2 text-xs whitespace-pre-wrap ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{prueba.notas}</p>
      )}

      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <a href={prueba.archivo} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1 text-xs underline ${isDark ? 'text-fuchsia-300' : 'text-fuchsia-700'}`}>
          <FileImage className="h-3 w-3" /> Ver arte
        </a>

        {puedeGestionar && transiciones.length > 0 && (
          <div className="flex items-center gap-1 ml-auto">
            {transiciones.map(t => (
              <button
                key={t}
                onClick={() => onChangeEstatus(t)}
                disabled={isUpdating}
                className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                  t === 'aprobada'
                    ? (isDark ? 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10' : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50')
                    : t === 'rechazada'
                      ? (isDark ? 'border-red-500/40 text-red-300 hover:bg-red-500/10' : 'border-red-300 text-red-700 hover:bg-red-50')
                      : (isDark ? 'border-blue-500/40 text-blue-300 hover:bg-blue-500/10' : 'border-blue-300 text-blue-700 hover:bg-blue-50')
                } disabled:opacity-50`}
                title={`Marcar como ${ESTATUS_LABEL[t]}`}
              >
                {t === 'aprobada' && <CheckCircle2 className="h-3 w-3 inline mr-1" />}
                {ESTATUS_LABEL[t]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tareas asociadas: Revisión de artes + Seguimiento Prueba de color.
          Feedback Jos 2026-10-02: se consumen desde este modal para que el
          analista no tenga que ir al módulo de Tareas mientras la prueba
          vive en una propuesta. Al avanzar a campaña, estas mismas tareas
          se sincronizan al gestor de artes vía campania_id. */}
      <TareasAsociadasSection
        pruebaId={prueba.id}
        isDark={isDark}
        puedeGestionar={puedeGestionar}
      />
    </div>
  );
}

// ─── Tareas asociadas a una prueba (Revisión + Seguimiento) ─────────────
// Feedback Jos 2026-10-02: la ventana de prueba de color las consume
// (listar + resolver) para que el analista no vaya al módulo Tareas.
function TareasAsociadasSection({
  pruebaId,
  isDark,
  puedeGestionar,
}: {
  pruebaId: number;
  isDark: boolean;
  puedeGestionar: boolean;
}) {
  const queryClient = useQueryClient();
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
      // La resolución puede haber cambiado el estatus de la prueba o creado otra tarea.
      queryClient.invalidateQueries({ queryKey: ['pruebas-color'] });
    },
    onError: (e: Error) => alert(e.message),
  });

  const tareas = tareasQuery.data || [];

  if (tareasQuery.isLoading) {
    return (
      <div className={`mt-3 pt-3 border-t text-[11px] flex items-center gap-2 ${isDark ? 'border-zinc-800 text-zinc-500' : 'border-gray-200 text-gray-500'}`}>
        <Loader2 className="h-3 w-3 animate-spin" /> Cargando tareas...
      </div>
    );
  }

  if (tareas.length === 0) return null;

  const estadoColor = (estatus: string | null) => {
    if (!estatus) return isDark ? 'bg-zinc-700/40 text-zinc-400' : 'bg-gray-100 text-gray-600';
    const e = estatus.toLowerCase();
    if (e.includes('finaliz') || e.includes('atendid') || e.includes('aprob')) return isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-700';
    if (e.includes('rechaz')) return isDark ? 'bg-red-500/15 text-red-300' : 'bg-red-50 text-red-700';
    return isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700';
  };

  return (
    <div className={`mt-3 pt-3 border-t ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
      <div className={`text-[11px] font-medium flex items-center gap-1.5 mb-2 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
        <ClipboardList className="h-3 w-3" /> Tareas asociadas ({tareas.length})
      </div>
      <div className="space-y-1.5">
        {tareas.map(t => {
          const esRevision = t.tipo === 'Revisión de artes';
          const esSeguimiento = t.tipo === 'Seguimiento Prueba de color';
          const puedeAprobar = esRevision && t.estatus === 'Pendiente' && puedeGestionar;
          const puedeFinalizar = esSeguimiento && t.estatus === 'Pendiente' && puedeGestionar;

          return (
            <div
              key={t.id}
              className={`rounded border px-2.5 py-1.5 text-[11px] ${isDark ? 'bg-zinc-900/40 border-zinc-800' : 'bg-white border-gray-200'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${estadoColor(t.estatus)}`}>
                    {t.estatus || 'Sin estado'}
                  </span>
                  <span className={`truncate ${isDark ? 'text-zinc-300' : 'text-gray-700'}`} title={t.tipo || ''}>
                    {esRevision ? 'Revisión de artes' : esSeguimiento ? 'Seguimiento' : t.tipo}
                  </span>
                </div>
                {(puedeAprobar || puedeFinalizar) && (
                  <div className="flex items-center gap-1 shrink-0">
                    {puedeAprobar && (
                      <>
                        <button
                          onClick={() => resolver.mutate({ tareaId: t.id, accion: 'aprobar' })}
                          disabled={resolver.isPending}
                          className={`px-1.5 py-0.5 rounded border transition-colors ${isDark ? 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10' : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'} disabled:opacity-50`}
                          title="Aprobar revisión"
                        >
                          <CheckCircle2 className="h-3 w-3 inline mr-0.5" /> Aprobar
                        </button>
                        <button
                          onClick={() => {
                            const comentario = prompt('Motivo del rechazo (opcional):') || undefined;
                            resolver.mutate({ tareaId: t.id, accion: 'rechazar', comentario });
                          }}
                          disabled={resolver.isPending}
                          className={`px-1.5 py-0.5 rounded border transition-colors ${isDark ? 'border-red-500/40 text-red-300 hover:bg-red-500/10' : 'border-red-300 text-red-700 hover:bg-red-50'} disabled:opacity-50`}
                          title="Rechazar revisión"
                        >
                          <XCircle className="h-3 w-3 inline mr-0.5" /> Rechazar
                        </button>
                      </>
                    )}
                    {puedeFinalizar && (
                      <button
                        onClick={() => resolver.mutate({ tareaId: t.id, accion: 'finalizar' })}
                        disabled={resolver.isPending}
                        className={`px-1.5 py-0.5 rounded border transition-colors ${isDark ? 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10' : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'} disabled:opacity-50`}
                        title="Finalizar seguimiento"
                      >
                        <Flag className="h-3 w-3 inline mr-0.5" /> Finalizar
                      </button>
                    )}
                  </div>
                )}
              </div>
              {t.asignado && (
                <div className={`mt-1 text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
                  → {t.asignado}
                </div>
              )}
            </div>
          );
        })}
      </div>
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
