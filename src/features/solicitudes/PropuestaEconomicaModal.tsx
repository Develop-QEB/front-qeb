import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X, Plus, Trash2, Save, Share2, FileSpreadsheet, FileText, FolderOpen, Loader2,
  CheckCircle2, AlertCircle, ArrowLeft, Copy, Wand2, Calculator, FilePlus2,
} from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import { useModalTracker } from '../../hooks/useModalTracker';
import { clientesService } from '../../services/clientes.service';
import {
  propuestaEconomicaService, PropuestaEconomica, PropuestaEconomicaData, LineaTarifa, LineaImpresion,
  SeccionTarifa, SECCIONES_TARIFA, Totales,
  nuevaLineaTarifa, nuevaLineaImpresion, propuestaVacia, limpiarPropuesta, validarPropuesta,
  descuentoDe, inversionPorPeriodo, inversionTotal, inversionImpresion,
  totalesTarifa, totalesImpresiones, totalesGenerales, impresionesDesdeViaPublica,
  moneda, porcentaje, nombreSugerido,
} from '../../services/propuestaEconomica.service';
import {
  VP_PLAZAS, VP_MEDIOS_POR_PLAZA, VP_PERIODOS, formatosViaPublica, periodoSugerido,
  AER_PLAZAS, AER_PLAZA_AICM, AER_PANTALLAS_AICM, AER_FORMATOS, AER_PERIODOS,
  WIFI_PLAZAS, WIFI_SOPORTE, WIFI_FORMATOS, WIFI_PERIODOS,
  IMP_PLAZAS, IMP_MATERIALES, mediosImpresion,
} from '../../config/propuestaEconomicaCatalogo';
import { exportPropuestaEconomicaExcel, exportPropuestaEconomicaPDF } from '../../utils/exportPropuestaEconomica';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Propuesta guardada a abrir (p. ej. desde un enlace compartido). */
  initial?: PropuestaEconomica;
}

/** Reglas de catálogo de cada tabla con tarifa (equivalen a las listas dependientes del Excel). */
interface ConfigSeccion {
  plazas: readonly string[];
  /** Lista de medios para la plaza, o null si el medio se escribe a mano. */
  medios: (plaza: string) => string[] | null;
  formatos: (plaza: string, medio: string) => string[];
  periodos: string[];
  periodoPara: (medio: string) => string;
  etiquetaUnidades: string;
}

const CONFIG: Record<SeccionTarifa, ConfigSeccion> = {
  viaPublica: {
    plazas: VP_PLAZAS,
    medios: plaza => VP_MEDIOS_POR_PLAZA[plaza] || [],
    formatos: formatosViaPublica,
    periodos: VP_PERIODOS,
    periodoPara: periodoSugerido,
    etiquetaUnidades: 'Caras/Unidades',
  },
  aeropuertos: {
    plazas: AER_PLAZAS,
    medios: plaza => (plaza === AER_PLAZA_AICM ? AER_PANTALLAS_AICM : null),
    formatos: (_p, medio) => (medio ? AER_FORMATOS : []),
    periodos: AER_PERIODOS,
    periodoPara: () => '',
    etiquetaUnidades: 'Caras/Unidades',
  },
  wifi: {
    plazas: WIFI_PLAZAS,
    medios: () => [WIFI_SOPORTE],
    formatos: (_p, medio) => (medio ? WIFI_FORMATOS : []),
    periodos: WIFI_PERIODOS,
    periodoPara: () => '',
    etiquetaUnidades: 'Caras/Unidades',
  },
};

/** Al cambiar plaza o medio, deja la fila consistente con el catálogo (como hacen las listas dependientes). */
function ajustarLinea(cfg: ConfigSeccion, l: LineaTarifa, cambio: Partial<LineaTarifa>): LineaTarifa {
  const next = { ...l, ...cambio };
  if ('plaza' in cambio) {
    const medios = cfg.medios(next.plaza);
    if (medios === null) next.medio = l.plaza === next.plaza ? next.medio : '';
    else if (medios.length === 1) next.medio = medios[0];
    else if (!medios.includes(next.medio)) next.medio = '';
  }
  if ('plaza' in cambio || 'medio' in cambio) {
    const formatos = cfg.formatos(next.plaza, next.medio);
    if (formatos.length === 1) next.formato = formatos[0];
    else if (!formatos.includes(next.formato)) next.formato = '';
    if (next.medio !== l.medio) {
      const sugerido = cfg.periodoPara(next.medio);
      if (sugerido) next.periodo = sugerido;
    }
  }
  return next;
}

export function PropuestaEconomicaModal({ isOpen, onClose, initial }: Props) {
  useModalTracker('Propuesta Económica', isOpen);
  const isDark = useThemeStore(s => s.theme) === 'dark';
  const user = useAuthStore(s => s.user);
  const queryClient = useQueryClient();

  const [data, setData] = useState<PropuestaEconomicaData>(() => initial?.data ?? propuestaVacia(user?.nombre || ''));
  const [nombre, setNombre] = useState(initial?.nombre ?? '');
  const [savedId, setSavedId] = useState<number | null>(initial?.id ?? null);
  // Abierta por enlace y de otro usuario: solo lectura hasta que la duplique.
  const [readOnly, setReadOnly] = useState(Boolean(initial && initial.is_owner === false));
  const [vista, setVista] = useState<'editor' | 'lista'>('editor');
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [exportando, setExportando] = useState<'excel' | 'pdf' | null>(null);
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), aviso.tipo === 'ok' ? 3500 : 7000);
    return () => clearTimeout(t);
  }, [aviso]);

  const { data: clientes } = useQuery({
    queryKey: ['clientes-full-propuesta-economica'],
    queryFn: async () => (await clientesService.getAllFull()).data || [],
    enabled: isOpen && !readOnly,
    staleTime: 5 * 60 * 1000,
  });

  const lista = useQuery({
    queryKey: ['propuestas-economicas'],
    queryFn: () => propuestaEconomicaService.list(),
    enabled: isOpen && vista === 'lista',
  });

  const guardar = useMutation({
    mutationFn: async () => {
      const limpia = limpiarPropuesta(data);
      const error = validarPropuesta(limpia);
      if (error) throw new Error(error);
      const n = nombre.trim() || nombreSugerido(limpia);
      const guardada = savedId
        ? await propuestaEconomicaService.update(savedId, n, limpia)
        : await propuestaEconomicaService.create(n, limpia);
      return guardada;
    },
    onSuccess: g => {
      setSavedId(g.id);
      setNombre(g.nombre);
      setData(g.data);
      queryClient.invalidateQueries({ queryKey: ['propuestas-economicas'] });
      setAviso({ tipo: 'ok', texto: 'Propuesta económica guardada.' });
    },
    onError: (e: Error) => setAviso({ tipo: 'error', texto: e.message }),
  });

  const eliminar = useMutation({
    mutationFn: (id: number) => propuestaEconomicaService.delete(id),
    onSuccess: (_r, id) => {
      queryClient.invalidateQueries({ queryKey: ['propuestas-economicas'] });
      setPendingDelete(null);
      if (id === savedId) setSavedId(null);
    },
    onError: (e: Error) => setAviso({ tipo: 'error', texto: e.message }),
  });

  const totales = useMemo(() => ({
    viaPublica: totalesTarifa(data.viaPublica),
    aeropuertos: totalesTarifa(data.aeropuertos),
    wifi: totalesTarifa(data.wifi),
    impresiones: totalesImpresiones(data.impresiones),
    general: totalesGenerales(data),
  }), [data]);

  if (!isOpen) return null;

  // ── Mutadores ──
  const set = <K extends keyof PropuestaEconomicaData>(k: K, v: PropuestaEconomicaData[K]) =>
    setData(d => ({ ...d, [k]: v }));
  const cambiarLinea = (sec: SeccionTarifa, id: string, cambio: Partial<LineaTarifa>) =>
    setData(d => ({ ...d, [sec]: d[sec].map(l => (l.id === id ? ajustarLinea(CONFIG[sec], l, cambio) : l)) }));
  const agregarLinea = (sec: SeccionTarifa) =>
    setData(d => {
      // Hereda periodo y periodos cotizados de la fila anterior: casi siempre son iguales en toda la tabla.
      const prev = d[sec][d[sec].length - 1];
      const base = nuevaLineaTarifa(prev ? { periodo: prev.periodo, periodosCotizados: prev.periodosCotizados } : {});
      return { ...d, [sec]: [...d[sec], sec === 'wifi' ? { ...base, medio: WIFI_SOPORTE } : base] };
    });
  const quitarLinea = (sec: SeccionTarifa, id: string) =>
    setData(d => ({ ...d, [sec]: d[sec].filter(l => l.id !== id) }));
  const cambiarImpresion = (id: string, cambio: Partial<LineaImpresion>) =>
    setData(d => ({ ...d, impresiones: d.impresiones.map(l => (l.id === id ? { ...l, ...cambio } : l)) }));

  const abrir = (p: PropuestaEconomica) => {
    setData(p.data); setNombre(p.nombre); setSavedId(p.id); setReadOnly(false); setVista('editor'); setAviso(null);
  };
  const nueva = () => {
    setData(propuestaVacia(user?.nombre || '')); setNombre(''); setSavedId(null); setReadOnly(false);
    setVista('editor'); setAviso(null);
  };
  const duplicar = () => {
    setSavedId(null); setReadOnly(false);
    setNombre(n => (n ? `${n} (copia)` : ''));
    setData(d => ({ ...d, asesor: user?.nombre || d.asesor }));
    setAviso({ tipo: 'ok', texto: 'Copia lista para editar. Guárdala para conservarla.' });
  };

  const compartir = async (id: number) => {
    const url = `${window.location.origin}/solicitudes/propuesta-economica/${id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      setAviso({ tipo: 'ok', texto: 'Enlace copiado. Cualquier usuario del sistema puede abrirlo.' });
    } catch {
      window.prompt('Copia el enlace:', url);
    }
  };

  const exportar = async (tipo: 'excel' | 'pdf') => {
    const limpia = limpiarPropuesta(data);
    const error = validarPropuesta(limpia);
    if (error) { setAviso({ tipo: 'error', texto: error }); return; }
    setExportando(tipo);
    try {
      const n = nombre.trim() || nombreSugerido(limpia);
      if (tipo === 'excel') await exportPropuestaEconomicaExcel(limpia, n);
      else await exportPropuestaEconomicaPDF(limpia, n);
    } catch (e) {
      console.error('Error exportando propuesta económica:', e);
      setAviso({ tipo: 'error', texto: `No se pudo generar el ${tipo === 'excel' ? 'Excel' : 'PDF'}.` });
    } finally {
      setExportando(null);
    }
  };

  // ── Estilos ──
  const c = {
    panel: isDark ? 'bg-zinc-900 border-purple-500/20' : 'bg-white border-purple-200',
    head: isDark ? 'border-purple-500/20 bg-gradient-to-r from-purple-900/20 to-fuchsia-900/10' : 'border-purple-200 bg-gradient-to-r from-purple-50 to-fuchsia-50',
    title: isDark ? 'text-white' : 'text-gray-900',
    muted: isDark ? 'text-zinc-400' : 'text-gray-500',
    label: isDark ? 'text-zinc-400' : 'text-gray-600',
    input: `w-full rounded-lg border px-2.5 py-1.5 text-sm outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${isDark ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500 focus:border-purple-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-purple-500'}`,
    cell: `w-full rounded-md border px-1.5 py-1 text-xs outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${isDark ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-600 focus:border-purple-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-purple-500'}`,
    calc: `px-1.5 py-1 text-xs text-right tabular-nums whitespace-nowrap ${isDark ? 'text-zinc-200' : 'text-gray-800'}`,
    th: `px-1.5 py-2 text-[11px] font-semibold text-center whitespace-nowrap ${isDark ? 'bg-[#0E2841] text-white' : 'bg-[#0E2841] text-white'}`,
    card: isDark ? 'border-zinc-700/70 bg-zinc-800/30' : 'border-gray-200 bg-gray-50/60',
    btn: `flex shrink-0 items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all disabled:opacity-50 disabled:cursor-not-allowed ${isDark ? 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700 hover:text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'}`,
    btnSoft: `flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50 ${isDark ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30 hover:bg-purple-500/25' : 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100'}`,
    btnPrimary: 'flex shrink-0 items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap text-white bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 shadow-lg shadow-purple-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed',
  };

  const ocupado = guardar.isPending || exportando !== null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className={`${c.panel} rounded-2xl border w-full max-w-[1500px] h-[94vh] overflow-hidden flex flex-col shadow-2xl shadow-purple-500/10`}>
        {/* Header */}
        <div className={`px-5 py-3.5 border-b ${c.head} flex flex-wrap items-center justify-between gap-3`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 shrink-0 rounded-xl ${isDark ? 'bg-purple-500/20' : 'bg-purple-100'} flex items-center justify-center`}>
              <Calculator className={`h-5 w-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
            </div>
            <div className="min-w-0">
              <h2 className={`text-lg font-semibold ${c.title}`}>Propuesta económica</h2>
              <p className={`text-xs truncate ${c.muted}`}>
                {vista === 'lista'
                  ? 'Propuestas guardadas'
                  : readOnly
                    ? 'Compartida contigo · solo lectura'
                    : savedId ? `Guardada · #${savedId}` : 'Nueva · sin guardar'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {vista === 'editor' ? (
              <>
                <button className={c.btn} onClick={() => setVista('lista')} title="Ver propuestas guardadas">
                  <FolderOpen className="h-4 w-4" /> Guardadas
                </button>
                <button className={c.btn} onClick={() => exportar('excel')} disabled={ocupado}>
                  {exportando === 'excel' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 text-emerald-500" />} Excel
                </button>
                <button className={c.btn} onClick={() => exportar('pdf')} disabled={ocupado}>
                  {exportando === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4 text-red-500" />} PDF
                </button>
                {savedId && (
                  <button className={c.btn} onClick={() => compartir(savedId)} title="Copiar enlace para compartir">
                    {copiedId === savedId ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Share2 className="h-4 w-4" />} Compartir
                  </button>
                )}
                {readOnly ? (
                  <button className={c.btnPrimary} onClick={duplicar}>
                    <Copy className="h-4 w-4" /> Duplicar para editar
                  </button>
                ) : (
                  <button className={c.btnPrimary} onClick={() => guardar.mutate()} disabled={ocupado}>
                    {guardar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {savedId ? 'Guardar cambios' : 'Guardar'}
                  </button>
                )}
              </>
            ) : (
              <>
                <button className={c.btn} onClick={() => setVista('editor')}>
                  <ArrowLeft className="h-4 w-4" /> Volver
                </button>
                <button className={c.btnPrimary} onClick={nueva}>
                  <FilePlus2 className="h-4 w-4" /> Nueva
                </button>
              </>
            )}
            <button onClick={onClose} className={`p-2 rounded-lg ${isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'}`}>
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {aviso && (
          <div className={`px-5 py-2 text-xs flex items-center gap-2 border-b ${aviso.tipo === 'ok'
            ? (isDark ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border-emerald-200')
            : (isDark ? 'bg-red-500/10 text-red-300 border-red-500/20' : 'bg-red-50 text-red-700 border-red-200')}`}>
            {aviso.tipo === 'ok' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
            {aviso.texto}
          </div>
        )}

        {vista === 'lista' ? (
          <div className="flex-1 overflow-y-auto p-5">
            {lista.isLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-purple-500" /></div>
            ) : lista.error ? (
              <div className={`flex flex-col items-center gap-2 py-12 text-sm ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                <AlertCircle className="h-6 w-6" /> Error al cargar las propuestas guardadas
              </div>
            ) : !lista.data?.length ? (
              <div className={`flex flex-col items-center gap-3 py-16 ${c.muted}`}>
                <Calculator className="h-10 w-10 opacity-40" />
                <p className="text-sm">Aún no tienes propuestas económicas guardadas</p>
              </div>
            ) : (
              <div className="space-y-2 max-w-4xl mx-auto">
                {lista.data.map(p => {
                  const tg = totalesGenerales(p.data);
                  return (
                    <div key={p.id} className={`rounded-xl border p-3 transition-all ${isDark ? 'border-zinc-700 bg-zinc-800/50 hover:border-purple-500/40' : 'border-gray-200 bg-white hover:border-purple-300'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <button onClick={() => abrir(p)} className="flex-1 text-left min-w-0">
                          <h3 className={`text-sm font-semibold truncate ${c.title}`}>{p.nombre}</h3>
                          <div className={`flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs ${c.muted}`}>
                            <span>{p.data.cliente || 'Sin cliente'}</span>
                            <span>·</span>
                            <span>{p.data.marca || 'Sin marca'}</span>
                            <span>·</span>
                            <span className={isDark ? 'text-purple-300' : 'text-purple-700'}>{moneda(tg.total)} con IVA</span>
                          </div>
                          <p className={`text-[10px] mt-1 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                            Actualizada: {new Date(p.fecha_actualizacion || p.fecha_creacion).toLocaleString('es-MX')}
                          </p>
                        </button>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => compartir(p.id)} title="Copiar enlace"
                            className={`p-1.5 rounded-md ${isDark ? 'hover:bg-purple-500/20 text-zinc-400 hover:text-purple-300' : 'hover:bg-purple-50 text-gray-500 hover:text-purple-700'}`}>
                            {copiedId === p.id ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Share2 className="h-4 w-4" />}
                          </button>
                          {pendingDelete === p.id ? (
                            <>
                              <button onClick={() => eliminar.mutate(p.id)} disabled={eliminar.isPending}
                                className={`px-2 py-1 rounded-md text-[10px] font-medium disabled:opacity-50 ${isDark ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}>
                                {eliminar.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Confirmar'}
                              </button>
                              <button onClick={() => setPendingDelete(null)}
                                className={`px-2 py-1 rounded-md text-[10px] ${isDark ? 'text-zinc-400 hover:bg-zinc-800' : 'text-gray-500 hover:bg-gray-100'}`}>
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <button onClick={() => setPendingDelete(p.id)} title="Eliminar"
                              className={`p-1.5 rounded-md ${isDark ? 'hover:bg-red-500/20 text-zinc-400 hover:text-red-300' : 'hover:bg-red-50 text-gray-500 hover:text-red-700'}`}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Datos generales */}
            <section className={`rounded-xl border p-4 ${c.card}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
                <Campo label="Nombre del asesor" className="xl:col-span-2" c={c}>
                  <input className={c.input} value={data.asesor} disabled={readOnly}
                    onChange={e => set('asesor', e.target.value)} />
                </Campo>
                <Campo label="Cliente" className="xl:col-span-2" c={c}>
                  <ClienteInput
                    value={data.cliente} disabled={readOnly} className={c.input} isDark={isDark}
                    clientes={clientes || []}
                    onChange={v => set('cliente', v)}
                    onPick={(cliente, marca) => setData(d => ({ ...d, cliente, marca: marca || d.marca }))}
                  />
                </Campo>
                <Campo label="Marca" className="xl:col-span-2" c={c}>
                  <input className={c.input} value={data.marca} disabled={readOnly}
                    onChange={e => set('marca', e.target.value)} />
                </Campo>
                <Campo label="Fecha de inicio" className="xl:col-span-1" c={c}>
                  <input type="date" className={c.input} value={data.fechaInicio} disabled={readOnly}
                    onChange={e => set('fechaInicio', e.target.value)} />
                </Campo>
                <Campo label="Fecha de cierre" className="xl:col-span-1" c={c}>
                  <input type="date" className={c.input} value={data.fechaFin} min={data.fechaInicio || undefined} disabled={readOnly}
                    onChange={e => set('fechaFin', e.target.value)} />
                </Campo>
                <Campo label="Nombre para guardar / archivo" className="xl:col-span-4" c={c}>
                  <input className={c.input} value={nombre} disabled={readOnly}
                    placeholder={nombreSugerido(data) || 'PROPUESTA MARCA 2027'}
                    onChange={e => setNombre(e.target.value)} />
                </Campo>
              </div>
            </section>

            {/* Tablas con tarifa */}
            {SECCIONES_TARIFA.map(s => {
              const cfg = CONFIG[s.key];
              const filas = data[s.key];
              return (
                <Seccion key={s.key} titulo={s.titulo} c={c} total={totales[s.key]} vacia={filas.length === 0}
                  accion={!readOnly && (
                    <button className={c.btnSoft} onClick={() => agregarLinea(s.key)}>
                      <Plus className="h-3.5 w-3.5" /> Agregar fila
                    </button>
                  )}>
                  <table className="w-full min-w-[1180px] border-collapse">
                    <thead>
                      <tr>
                        <th className={`${c.th} rounded-tl-lg w-[130px]`}>Plaza</th>
                        <th className={`${c.th} w-[210px]`}>Medio/Soporte</th>
                        <th className={`${c.th} w-[140px]`}>Formato</th>
                        <th className={`${c.th} w-[110px]`}>Tarifa Publicada</th>
                        <th className={`${c.th} w-[70px]`}>Descuento</th>
                        <th className={`${c.th} w-[110px]`}>Tarifa Aplicada</th>
                        <th className={`${c.th} w-[80px]`}>{cfg.etiquetaUnidades}</th>
                        <th className={`${c.th} w-[105px]`}>Periodo</th>
                        <th className={`${c.th} w-[80px]`}>Periodos Cotizados</th>
                        <th className={`${c.th} w-[120px]`}>Inversión por Periodo</th>
                        <th className={`${c.th} w-[120px]`}>Inversión total</th>
                        <th className={`${c.th} rounded-tr-lg w-[36px]`} />
                      </tr>
                    </thead>
                    <tbody>
                      {filas.map(l => {
                        const medios = cfg.medios(l.plaza);
                        const formatos = cfg.formatos(l.plaza, l.medio);
                        const excede = l.tarifaAplicada !== null && l.tarifaPublicada !== null && l.tarifaAplicada > l.tarifaPublicada;
                        return (
                          <tr key={l.id} className={`border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
                            <td className="p-1">
                              <Sel className={c.cell} value={l.plaza} options={cfg.plazas} disabled={readOnly}
                                onChange={v => cambiarLinea(s.key, l.id, { plaza: v })} />
                            </td>
                            <td className="p-1">
                              {medios === null ? (
                                <input className={c.cell} value={l.medio} disabled={readOnly || !l.plaza}
                                  placeholder={l.plaza ? 'Escribir manualmente' : ''}
                                  onChange={e => cambiarLinea(s.key, l.id, { medio: e.target.value })} />
                              ) : (
                                <Sel className={c.cell} value={l.medio} options={medios} disabled={readOnly || !l.plaza}
                                  onChange={v => cambiarLinea(s.key, l.id, { medio: v })} />
                              )}
                            </td>
                            <td className="p-1">
                              <Sel className={c.cell} value={l.formato} options={formatos} disabled={readOnly || !l.medio}
                                onChange={v => cambiarLinea(s.key, l.id, { formato: v })} />
                            </td>
                            <td className="p-1">
                              <Num className={c.cell} value={l.tarifaPublicada} disabled={readOnly} money
                                onChange={v => cambiarLinea(s.key, l.id, { tarifaPublicada: v })} />
                            </td>
                            <td className={`${c.calc} text-center`}>{porcentaje(descuentoDe(l)) || '—'}</td>
                            <td className="p-1">
                              <Num className={`${c.cell} ${excede ? '!border-red-500' : ''}`} value={l.tarifaAplicada} disabled={readOnly} money
                                title={excede ? 'La tarifa aplicada no puede ser mayor a la publicada' : undefined}
                                onChange={v => cambiarLinea(s.key, l.id, { tarifaAplicada: v })} />
                            </td>
                            <td className="p-1">
                              <Num className={c.cell} value={l.unidades} disabled={readOnly}
                                onChange={v => cambiarLinea(s.key, l.id, { unidades: v })} />
                            </td>
                            <td className="p-1">
                              <Sel className={c.cell} value={l.periodo} options={cfg.periodos} disabled={readOnly}
                                onChange={v => cambiarLinea(s.key, l.id, { periodo: v })} />
                            </td>
                            <td className="p-1">
                              <Num className={c.cell} value={l.periodosCotizados} disabled={readOnly}
                                onChange={v => cambiarLinea(s.key, l.id, { periodosCotizados: v })} />
                            </td>
                            <td className={c.calc}>{moneda(inversionPorPeriodo(l)) || '—'}</td>
                            <td className={`${c.calc} font-semibold`}>{moneda(inversionTotal(l)) || '—'}</td>
                            <td className="p-1 text-center">
                              {!readOnly && (
                                <button onClick={() => quitarLinea(s.key, l.id)} title="Quitar fila"
                                  className={`p-1 rounded-md ${isDark ? 'text-zinc-500 hover:text-red-300 hover:bg-red-500/20' : 'text-gray-400 hover:text-red-600 hover:bg-red-50'}`}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </Seccion>
              );
            })}

            {/* Impresiones */}
            <Seccion titulo="Impresiones" c={c} total={totales.impresiones} vacia={data.impresiones.length === 0}
              accion={!readOnly && (
                <div className="flex flex-wrap items-center gap-2">
                  <button className={c.btnSoft}
                    title="Una fila por cada fila de Vía Pública en formato Fijo, con caras + 30% adicional"
                    disabled={!data.viaPublica.some(l => l.plaza && l.formato === 'Fijo' && l.unidades)}
                    onClick={() => setData(d => ({ ...d, impresiones: impresionesDesdeViaPublica(d.viaPublica, d.impresiones) }))}>
                    <Wand2 className="h-3.5 w-3.5" /> Generar desde Vía Pública (+30%)
                  </button>
                  <button className={c.btnSoft}
                    onClick={() => setData(d => {
                      const prev = d.impresiones[d.impresiones.length - 1];
                      return { ...d, impresiones: [...d.impresiones, nuevaLineaImpresion(prev ? { medio: prev.medio, material: prev.material, tarifaAplicada: prev.tarifaAplicada } : {})] };
                    })}>
                    <Plus className="h-3.5 w-3.5" /> Agregar fila
                  </button>
                </div>
              )}>
              <table className="w-full min-w-[900px] border-collapse">
                <thead>
                  <tr>
                    <th className={`${c.th} rounded-tl-lg w-[160px]`}>Plaza</th>
                    <th className={`${c.th} w-[240px]`}>Medio/Soporte</th>
                    <th className={`${c.th} w-[220px]`}>Materiales</th>
                    <th className={`${c.th} w-[120px]`}>Tarifa Aplicada</th>
                    <th className={`${c.th} w-[100px]`}>Unidades</th>
                    <th className={`${c.th} w-[130px]`}>Inversión total</th>
                    <th className={`${c.th} rounded-tr-lg w-[36px]`} />
                  </tr>
                </thead>
                <tbody>
                  {data.impresiones.map(l => (
                    <tr key={l.id} className={`border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
                      <td className="p-1">
                        <Sel className={c.cell} value={l.plaza} options={IMP_PLAZAS} disabled={readOnly}
                          onChange={v => cambiarImpresion(l.id, { plaza: v })} />
                      </td>
                      <td className="p-1">
                        <Combo className={c.cell} value={l.medio} options={mediosImpresion(l.plaza)} disabled={readOnly}
                          onChange={v => cambiarImpresion(l.id, { medio: v })} />
                      </td>
                      <td className="p-1">
                        <Sel className={c.cell} value={l.material} options={IMP_MATERIALES} disabled={readOnly}
                          onChange={v => cambiarImpresion(l.id, { material: v })} />
                      </td>
                      <td className="p-1">
                        <Num className={c.cell} value={l.tarifaAplicada} disabled={readOnly} money
                          onChange={v => cambiarImpresion(l.id, { tarifaAplicada: v })} />
                      </td>
                      <td className="p-1">
                        <Num className={c.cell} value={l.unidades} disabled={readOnly}
                          onChange={v => cambiarImpresion(l.id, { unidades: v })} />
                      </td>
                      <td className={`${c.calc} font-semibold`}>{moneda(inversionImpresion(l)) || '—'}</td>
                      <td className="p-1 text-center">
                        {!readOnly && (
                          <button onClick={() => setData(d => ({ ...d, impresiones: d.impresiones.filter(x => x.id !== l.id) }))} title="Quitar fila"
                            className={`p-1 rounded-md ${isDark ? 'text-zinc-500 hover:text-red-300 hover:bg-red-500/20' : 'text-gray-400 hover:text-red-600 hover:bg-red-50'}`}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Seccion>

            {/* Total general + textos */}
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
              <section className={`rounded-xl border p-4 xl:col-span-3 ${c.card}`}>
                <h3 className={`text-sm font-semibold mb-2 ${c.title}`}>Observaciones</h3>
                <textarea className={`${c.input} min-h-[90px] resize-y`} value={data.observaciones} disabled={readOnly}
                  onChange={e => set('observaciones', e.target.value)} />
                <details className="mt-3">
                  <summary className={`text-xs cursor-pointer select-none ${c.muted}`}>Términos y condiciones (texto fijo del formato)</summary>
                  <p className={`mt-2 text-[11px] leading-relaxed whitespace-pre-wrap ${c.muted}`}>{data.terminos}</p>
                </details>
              </section>
              <section className="rounded-xl p-4 xl:col-span-2 bg-[#0E2841] text-white self-start">
                <h3 className="text-sm font-semibold mb-3">Valor Total Propuesta</h3>
                <FilaTotal label="SUB TOTAL General" valor={totales.general.subtotal} />
                <FilaTotal label="IVA General (16%)" valor={totales.general.iva} />
                <div className="border-t border-white/20 mt-2 pt-2">
                  <FilaTotal label="TOTAL General" valor={totales.general.total} grande />
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ───────────────────────── Piezas ─────────────────────────

type Clases = Record<string, string>;

function Campo({ label, className = '', c, children }: { label: string; className?: string; c: Clases; children: React.ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <span className={`block text-[11px] font-medium mb-1 ${c.label}`}>{label}</span>
      {children}
    </label>
  );
}

function Seccion({ titulo, c, total, vacia, accion, children }: {
  titulo: string; c: Clases; total: Totales; vacia: boolean; accion: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className={`rounded-xl border ${c.card}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <h3 className={`text-sm font-semibold ${c.title}`}>{titulo}</h3>
        {accion}
      </div>
      {vacia ? (
        <p className={`px-4 pb-4 text-xs ${c.muted}`}>Sin filas. Esta sección no aparecerá en el documento.</p>
      ) : (
        <>
          <div className="overflow-x-auto px-3">{children}</div>
          <div className="flex justify-end px-4 py-3">
            <div className="w-full max-w-xs rounded-lg overflow-hidden bg-[#0E2841] text-white px-3 py-2">
              <FilaTotal label="SUB TOTAL" valor={total.subtotal} />
              <FilaTotal label="IVA" valor={total.iva} />
              <FilaTotal label="TOTAL" valor={total.total} />
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function FilaTotal({ label, valor, grande }: { label: string; valor: number; grande?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 ${grande ? 'text-base font-bold' : 'text-xs font-semibold py-0.5'}`}>
      <span>{label}</span>
      <span className="tabular-nums">{moneda(valor)}</span>
    </div>
  );
}

function Sel({ value, options, onChange, className, disabled }: {
  value: string; options: readonly string[]; onChange: (v: string) => void; className: string; disabled?: boolean;
}) {
  // Si el valor guardado ya no está en el catálogo, se conserva visible en vez de perderse.
  const fuera = value && !options.includes(value);
  return (
    <select className={className} value={value} disabled={disabled} onChange={e => onChange(e.target.value)} title={value}>
      <option value="">—</option>
      {fuera && <option value={value}>{value}</option>}
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

/** Texto libre con sugerencias (equivale a las celdas "lista o escribir manualmente" del Excel). */
function Combo({ value, options, onChange, className, disabled }: {
  value: string; options: string[]; onChange: (v: string) => void; className: string; disabled?: boolean;
}) {
  const id = useId();
  return (
    <>
      <input className={className} value={value} list={id} disabled={disabled} onChange={e => onChange(e.target.value)} />
      <datalist id={id}>{options.map(o => <option key={o} value={o} />)}</datalist>
    </>
  );
}

/** Input numérico que maneja vacío como null; con `money` muestra el valor formateado al perder el foco. */
function Num({ value, onChange, className, disabled, money, title }: {
  value: number | null; onChange: (v: number | null) => void; className: string; disabled?: boolean; money?: boolean; title?: string;
}) {
  const [texto, setTexto] = useState<string | null>(null); // null = no se está editando
  const mostrado = texto !== null
    ? texto
    : value === null ? '' : money ? moneda(value) : String(value);
  return (
    <input
      className={`${className} text-right tabular-nums`}
      inputMode="decimal"
      value={mostrado}
      disabled={disabled}
      title={title}
      onFocus={e => { setTexto(value === null ? '' : String(value)); requestAnimationFrame(() => e.target.select()); }}
      onChange={e => {
        const t = e.target.value.replace(/[^0-9.]/g, '');
        setTexto(t);
        const n = t === '' || t === '.' ? null : Number(t);
        onChange(n !== null && Number.isFinite(n) ? n : null);
      }}
      onBlur={() => setTexto(null)}
    />
  );
}

interface ClienteOpcion { T0_U_Cliente?: string | null; T0_U_RazonSocial?: string | null; T2_U_Marca?: string | null }

/** Campo Cliente: texto libre con búsqueda en los clientes del sistema; al elegir uno llena también la marca. */
function ClienteInput({ value, onChange, onPick, clientes, className, disabled, isDark }: {
  value: string; onChange: (v: string) => void; onPick: (cliente: string, marca: string) => void;
  clientes: ClienteOpcion[]; className: string; disabled?: boolean; isDark: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const fuera = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [open]);

  const sugerencias = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!open || q.length < 2) return [];
    const vistos = new Set<string>();
    const out: { cliente: string; marca: string }[] = [];
    for (const cl of clientes) {
      const cliente = (cl.T0_U_Cliente || cl.T0_U_RazonSocial || '').trim();
      const marca = (cl.T2_U_Marca || '').trim();
      if (!cliente) continue;
      if (!cliente.toLowerCase().includes(q) && !marca.toLowerCase().includes(q)) continue;
      const k = `${cliente}|${marca}`;
      if (vistos.has(k)) continue;
      vistos.add(k);
      out.push({ cliente, marca });
      if (out.length >= 30) break;
    }
    return out;
  }, [clientes, value, open]);

  return (
    <div ref={ref} className="relative">
      <input className={className} value={value} disabled={disabled} placeholder="Buscar cliente o marca…"
        onFocus={() => setOpen(true)}
        onChange={e => { onChange(e.target.value); setOpen(true); }} />
      {sugerencias.length > 0 && (
        <div className={`absolute z-20 left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-lg border shadow-xl ${isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-200'}`}>
          {sugerencias.map(s => (
            <button key={`${s.cliente}|${s.marca}`} type="button"
              onClick={() => { onPick(s.cliente, s.marca); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-xs ${isDark ? 'text-zinc-200 hover:bg-purple-500/20' : 'text-gray-800 hover:bg-purple-50'}`}>
              <span className="font-medium">{s.cliente}</span>
              {s.marca && <span className={isDark ? 'text-zinc-400' : 'text-gray-500'}> · {s.marca}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
