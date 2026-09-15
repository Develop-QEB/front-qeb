import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Ban, Check, CheckCircle2, ChevronDown, ChevronUp, ClipboardList, Loader2, MessageSquare, Send, X } from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import {
  desposteoService,
  DesposteoNota,
  DesposteoSolicitud,
  DesgloseAps,
  DesgloseCatorcena,
  DesglosePlazaFormato,
  SnapshotAPS,
  TIPO_NOTA_LABEL,
  ESTATUS_LABEL,
  EstatusDesposteo,
  puedeSolicitarDesposteo,
  puedeFiltrarDesposteo,
  puedeAprobarDesposteoFacturacion,
} from '../../services/desposteo.service';

// Modo del modal — determina que acciones muestra y a que endpoint pega.
//   solicitar: comercial crea una solicitud nueva (necesita campania+aps)
//   filtro:    gerente comercial da check o rechaza (necesita solicitud_id)
//   facturacion: coord facturacion aprueba o rechaza (necesita solicitud_id)
//   ver:       solo lectura (para notificaciones informativas)
export type ModoDesposteo = 'solicitar' | 'filtro' | 'facturacion' | 'ver';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  modo: ModoDesposteo;
  // Requeridos para 'solicitar':
  campaniaId?: number;
  aps?: number;
  // Requerido para 'filtro' | 'facturacion' | 'ver':
  solicitudId?: number;
  // Callback opcional al cerrar tras accion exitosa
  onDone?: () => void;
}

export function DesposteoModal({ isOpen, onClose, modo, campaniaId, aps, solicitudId, onDone }: Props) {
  const isDark = useThemeStore(s => s.theme) === 'dark';
  const user = useAuthStore(s => s.user);
  const qc = useQueryClient();

  const [nota, setNota] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [detallesVisible, setDetallesVisible] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setNota('');
      setError(null);
    }
  }, [isOpen]);

  // Cargar solicitud si aplica
  const detalleQuery = useQuery({
    queryKey: ['desposteo-detalle', solicitudId],
    queryFn: () => desposteoService.detalle(solicitudId!),
    enabled: isOpen && !!solicitudId,
  });

  // Historial de notas por (campania, aps) — usado en modo solicitar. Muestra
  // notas de intentos previos aunque no exista una solicitud abierta.
  const historialQuery = useQuery({
    queryKey: ['desposteo-historial', campaniaId, aps],
    queryFn: () => desposteoService.historial(campaniaId!, aps!),
    enabled: isOpen && modo === 'solicitar' && !!campaniaId && !!aps,
  });

  const solicitud = detalleQuery.data?.solicitud;
  const notasFromDetalle = detalleQuery.data?.notas || [];
  const notasHistorial = historialQuery.data || [];
  const notas: DesposteoNota[] = modo === 'solicitar' ? notasHistorial : notasFromDetalle;

  const snapshot: SnapshotAPS | null = useMemo(() => {
    if (!solicitud?.snapshot_aps) return null;
    try { return JSON.parse(solicitud.snapshot_aps) as SnapshotAPS; } catch { return null; }
  }, [solicitud]);

  // Campania/APS efectivos — vienen como props (modo solicitar) o del
  // snapshot/solicitud (modos filtro/facturacion/ver).
  const campaniaEfectiva = campaniaId ?? solicitud?.campania_id ?? snapshot?.campania_id ?? null;
  const apsEfectivo = aps ?? solicitud?.aps ?? snapshot?.aps ?? null;

  // Desglose enriquecido en vivo (catorcenas -> plaza/formato -> articulos).
  // Complementa el snapshot histórico con montos reales (tarifa * caras) y
  // agrupacion que Jos pidio ver estilo listado con APS.
  const desgloseQuery = useQuery({
    queryKey: ['desposteo-aps-detalle', campaniaEfectiva, apsEfectivo],
    queryFn: () => desposteoService.apsDetalle(campaniaEfectiva!, apsEfectivo!),
    enabled: isOpen && !!campaniaEfectiva && !!apsEfectivo,
  });
  const desglose = desgloseQuery.data || null;

  const invalidarTodo = () => {
    qc.invalidateQueries({ queryKey: ['desposteo-detalle', solicitudId] });
    qc.invalidateQueries({ queryKey: ['desposteo-historial', campaniaId, aps] });
    qc.invalidateQueries({ queryKey: ['desposteo-listado'] });
    // Refrescar tareas/notificaciones que muestran esta solicitud
    qc.invalidateQueries({ queryKey: ['notificaciones'] });
    qc.invalidateQueries({ queryKey: ['tareas'] });
  };

  const solicitarMut = useMutation({
    mutationFn: () => desposteoService.solicitar({ campania_id: campaniaId!, aps: aps!, nota }),
    onSuccess: () => { invalidarTodo(); onDone?.(); onClose(); },
    onError: (e: Error) => setError(e.message),
  });
  const filtroApruebaMut = useMutation({
    mutationFn: () => desposteoService.filtroAprobar(solicitudId!, nota || undefined),
    onSuccess: () => { invalidarTodo(); onDone?.(); onClose(); },
    onError: (e: Error) => setError(e.message),
  });
  const filtroRechazaMut = useMutation({
    mutationFn: () => desposteoService.filtroRechazar(solicitudId!, nota),
    onSuccess: () => { invalidarTodo(); onDone?.(); onClose(); },
    onError: (e: Error) => setError(e.message),
  });
  const factApruebaMut = useMutation({
    mutationFn: () => desposteoService.aprobar(solicitudId!, nota || undefined),
    onSuccess: () => { invalidarTodo(); onDone?.(); onClose(); },
    onError: (e: Error) => setError(e.message),
  });
  const factRechazaMut = useMutation({
    mutationFn: () => desposteoService.rechazar(solicitudId!, nota),
    onSuccess: () => { invalidarTodo(); onDone?.(); onClose(); },
    onError: (e: Error) => setError(e.message),
  });

  const anyPending =
    solicitarMut.isPending || filtroApruebaMut.isPending || filtroRechazaMut.isPending ||
    factApruebaMut.isPending || factRechazaMut.isPending;

  // Guards por rol para no dejar clickear si el modo no matchea al usuario
  const puedeAccion = useMemo(() => {
    if (modo === 'solicitar') return puedeSolicitarDesposteo(user?.rol);
    if (modo === 'filtro') return puedeFiltrarDesposteo(user?.rol);
    if (modo === 'facturacion') return puedeAprobarDesposteoFacturacion(user?.rol);
    return false;
  }, [modo, user?.rol]);

  if (!isOpen) return null;

  const titulo = modo === 'solicitar' ? 'Solicitar quitar posteo'
    : modo === 'filtro' ? 'Filtro gerente comercial — Desposteo'
    : modo === 'facturacion' ? 'Autorizar desposteo — Facturacion'
    : 'Detalle desposteo';

  const labelCls = `text-xs font-medium mb-1 block ${isDark ? 'text-zinc-400' : 'text-gray-500'}`;
  const textareaCls = `w-full rounded-lg border px-3 py-2 text-sm resize-none ${
    isDark ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500'
           : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400'
  }`;

  const handleSolicitar = () => {
    setError(null);
    if (!nota.trim()) { setError('La nota es obligatoria'); return; }
    solicitarMut.mutate();
  };
  const handleFiltroAprobar = () => { setError(null); filtroApruebaMut.mutate(); };
  const handleFiltroRechazar = () => {
    setError(null);
    if (!nota.trim()) { setError('Escribe el motivo del rechazo'); return; }
    filtroRechazaMut.mutate();
  };
  const handleFactAprobar = () => { setError(null); factApruebaMut.mutate(); };
  const handleFactRechazar = () => {
    setError(null);
    if (!nota.trim()) { setError('Escribe el motivo del rechazo'); return; }
    factRechazaMut.mutate();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className={`w-full max-w-3xl rounded-2xl shadow-2xl border max-h-[92vh] overflow-y-auto ${
        isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200'
      }`}>
        {/* Header */}
        <div className={`flex items-start justify-between px-5 py-4 border-b sticky top-0 z-10 ${
          isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center ${isDark ? 'bg-rose-500/15' : 'bg-rose-50'}`}>
              <Ban className={`h-5 w-5 ${isDark ? 'text-rose-300' : 'text-rose-600'}`} />
            </div>
            <div>
              <h3 className={`text-base font-semibold ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>{titulo}</h3>
              <p className={`mt-0.5 text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                {solicitud ? (
                  <>Solicitud #{solicitud.id} · Campana #{solicitud.campania_id} · APS {solicitud.aps} · <EstatusBadge estatus={solicitud.estatus} isDark={isDark} /></>
                ) : (
                  <>Campana #{campaniaId} · APS {aps}</>
                )}
              </p>
            </div>
          </div>
          <button onClick={onClose} className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-gray-100 text-gray-400'}`}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {detalleQuery.isLoading && (
            <div className={`flex items-center gap-2 text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
              <Loader2 className="h-3 w-3 animate-spin" /> Cargando detalle...
            </div>
          )}

          {/* Datos del posteo a cancelar — snapshot resumido + desglose vivo */}
          {(snapshot || desglose) && (
            <div className={`rounded-lg border ${isDark ? 'border-zinc-800 bg-zinc-800/40' : 'border-gray-200 bg-gray-50'}`}>
              <button
                type="button"
                onClick={() => setDetallesVisible(v => !v)}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}
              >
                <span className="flex items-center gap-2">
                  <ClipboardList className="h-3.5 w-3.5" /> Datos del posteo a cancelar
                </span>
                {detallesVisible ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
              {detallesVisible && (
                <div className="px-3 pb-3 space-y-3">
                  {desglose ? (
                    <DesgloseView desglose={desglose} isDark={isDark} />
                  ) : snapshot ? (
                    <SnapshotView snapshot={snapshot} isDark={isDark} />
                  ) : null}
                  {desgloseQuery.isLoading && (
                    <div className={`text-[11px] flex items-center gap-2 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                      <Loader2 className="h-3 w-3 animate-spin" /> Cargando desglose...
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Historial de notas / conversacion */}
          <div>
            <div className={`text-xs font-medium mb-2 flex items-center gap-2 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
              <MessageSquare className="h-3.5 w-3.5" />
              Hilo de notas ({notas.length})
            </div>
            {historialQuery.isLoading && (
              <div className={`text-xs flex items-center gap-2 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                <Loader2 className="h-3 w-3 animate-spin" /> Cargando historial...
              </div>
            )}
            {notas.length === 0 && !historialQuery.isLoading && !detalleQuery.isLoading && (
              <div className={`text-xs px-3 py-3 text-center rounded border ${isDark ? 'text-zinc-500 border-zinc-800' : 'text-gray-400 border-gray-200'}`}>
                Sin notas todavia. La conversacion inicia con tu primera nota.
              </div>
            )}
            <div className="space-y-2">
              {notas.map(n => <NotaCard key={n.id} nota={n} isDark={isDark} />)}
            </div>
          </div>

          {/* Nueva nota / accion */}
          {modo !== 'ver' && puedeAccion && (
            <div className={`pt-3 border-t ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
              <label className={labelCls}>
                {modo === 'solicitar'
                  ? 'Nota inicial (obligatoria) — explica por que necesitas quitar el posteo'
                  : (modo === 'filtro' || modo === 'facturacion')
                    ? 'Nota (obligatoria si rechazas, opcional si apruebas)'
                    : 'Nota'}
              </label>
              <textarea
                rows={3}
                value={nota}
                onChange={e => setNota(e.target.value)}
                className={textareaCls}
                placeholder={modo === 'solicitar' ? 'Motivo del desposteo...' : 'Comentario para el hilo...'}
                disabled={anyPending}
              />

              {error && (
                <div className={`mt-2 text-xs flex items-center gap-2 px-3 py-2 rounded ${
                  isDark ? 'bg-red-500/10 border border-red-500/30 text-red-300' : 'bg-red-50 border border-red-200 text-red-600'
                }`}>
                  <AlertCircle className="h-3 w-3 shrink-0" /> {error}
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2 justify-end">
                {modo === 'solicitar' && (
                  <button
                    onClick={handleSolicitar}
                    disabled={anyPending}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50"
                  >
                    {solicitarMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Solicitar desposteo
                  </button>
                )}
                {modo === 'filtro' && solicitud?.estatus === 'solicitado' && (
                  <>
                    <button
                      onClick={handleFiltroRechazar}
                      disabled={anyPending}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border disabled:opacity-50 ${
                        isDark ? 'border-red-500/40 text-red-300 hover:bg-red-500/10' : 'border-red-300 text-red-700 hover:bg-red-50'
                      }`}
                    >
                      {filtroRechazaMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                      Rechazar
                    </button>
                    <button
                      onClick={handleFiltroAprobar}
                      disabled={anyPending}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {filtroApruebaMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Dar check y enviar a facturacion
                    </button>
                  </>
                )}
                {modo === 'facturacion' && solicitud?.estatus === 'filtro_aprobado' && (
                  <>
                    <button
                      onClick={handleFactRechazar}
                      disabled={anyPending}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border disabled:opacity-50 ${
                        isDark ? 'border-red-500/40 text-red-300 hover:bg-red-500/10' : 'border-red-300 text-red-700 hover:bg-red-50'
                      }`}
                    >
                      {factRechazaMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                      Rechazar
                    </button>
                    <button
                      onClick={handleFactAprobar}
                      disabled={anyPending}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {factApruebaMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Aprobar desposteo
                    </button>
                  </>
                )}
              </div>

              {/* Estado terminal — no permite mas acciones */}
              {(modo === 'filtro' || modo === 'facturacion') && solicitud &&
                !((modo === 'filtro' && solicitud.estatus === 'solicitado') ||
                  (modo === 'facturacion' && solicitud.estatus === 'filtro_aprobado')) && (
                <div className={`mt-2 text-xs px-3 py-2 rounded ${
                  isDark ? 'bg-zinc-800/60 border border-zinc-700 text-zinc-400' : 'bg-gray-50 border border-gray-200 text-gray-500'
                }`}>
                  Esta solicitud ya no acepta esta accion (estatus actual: {ESTATUS_LABEL[solicitud.estatus]}).
                </div>
              )}
            </div>
          )}

          {modo !== 'ver' && !puedeAccion && (
            <div className={`text-xs px-3 py-2 rounded ${
              isDark ? 'bg-zinc-800/60 border border-zinc-700 text-zinc-400' : 'bg-gray-50 border border-gray-200 text-gray-500'
            }`}>
              Tu rol no puede ejecutar esta accion. Modal en solo lectura.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── SubComponentes ──────────────────────────────────────────────────────

function EstatusBadge({ estatus, isDark }: { estatus: EstatusDesposteo; isDark: boolean }) {
  const style: Record<EstatusDesposteo, string> = {
    solicitado: isDark ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' : 'bg-amber-50 text-amber-700 border-amber-200',
    filtro_aprobado: isDark ? 'bg-blue-500/15 text-blue-300 border-blue-500/30' : 'bg-blue-50 text-blue-700 border-blue-200',
    aprobado: isDark ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rechazado: isDark ? 'bg-red-500/15 text-red-300 border-red-500/30' : 'bg-red-50 text-red-700 border-red-200',
    ejecutado: isDark ? 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30' : 'bg-zinc-100 text-zinc-700 border-zinc-200',
  };
  return (
    <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border font-medium ${style[estatus]}`}>
      {ESTATUS_LABEL[estatus]}
    </span>
  );
}

function fmtMoney(n: number): string {
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
}

function SnapshotView({ snapshot, isDark }: { snapshot: SnapshotAPS; isDark: boolean }) {
  const kv = (k: string, v: React.ReactNode) => (
    <div className="flex items-baseline gap-2 text-xs">
      <span className={`w-32 shrink-0 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>{k}</span>
      <span className={isDark ? 'text-zinc-200' : 'text-gray-800'}>{v}</span>
    </div>
  );
  return (
    <div className="space-y-1">
      {kv('Campana', <>#{snapshot.campania_id} — {snapshot.campania_nombre}</>)}
      {kv('APS', <>{snapshot.aps}</>)}
      {snapshot.razon_social && kv('Razon social', snapshot.razon_social)}
      {snapshot.cliente_nombre && kv('Cliente', snapshot.cliente_nombre)}
      {kv('Monto estimado', <span className="font-semibold">{fmtMoney(snapshot.monto_estimado || 0)}</span>)}
      {snapshot.doc_entry && kv('Doc SAP', <>{snapshot.doc_entry}{snapshot.doc_num ? ` / ${snapshot.doc_num}` : ''}</>)}
      {snapshot.posted_at && kv('Posteado', new Date(snapshot.posted_at).toLocaleString('es-MX'))}
    </div>
  );
}

// Desglose enriquecido — jerarquia catorcena -> plaza/formato -> articulos.
// Imita el listado con APS del detalle de campana.
function DesgloseView({ desglose, isDark }: { desglose: DesgloseAps; isDark: boolean }) {
  const label = isDark ? 'text-zinc-500' : 'text-gray-500';
  const value = isDark ? 'text-zinc-200' : 'text-gray-800';
  const kv = (k: string, v: React.ReactNode) => (
    <div className="flex items-baseline gap-2 text-xs">
      <span className={`w-32 shrink-0 ${label}`}>{k}</span>
      <span className={value}>{v}</span>
    </div>
  );
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        {kv('Campana', <>#{desglose.campania_id} — {desglose.campania_nombre}</>)}
        {kv('APS', <>{desglose.aps}</>)}
        {desglose.razon_social && kv('Razon social', desglose.razon_social)}
        {desglose.cliente_nombre && kv('Cliente', desglose.cliente_nombre)}
        {desglose.cuic != null && kv('CUIC', String(desglose.cuic))}
        {desglose.marca && kv('Marca', desglose.marca)}
        {desglose.doc_entry && kv('Doc SAP', <>{desglose.doc_entry}{desglose.doc_num ? ` / ${desglose.doc_num}` : ''}</>)}
        {desglose.posted_at && kv('Posteado', new Date(desglose.posted_at).toLocaleString('es-MX'))}
        {kv('Total caras', <span className="font-semibold">{desglose.caras_total}</span>)}
        {kv('Inversion total', <span className={`font-semibold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>{fmtMoney(desglose.inversion_total)}</span>)}
      </div>
      {desglose.catorcenas.length > 0 && (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {desglose.catorcenas.map((c, i) => (
            <CatorcenaCard key={`${c.anio}-${c.numero}-${i}`} catorcena={c} apsPrincipal={desglose.aps} isDark={isDark} />
          ))}
        </div>
      )}
    </div>
  );
}

function CatorcenaCard({ catorcena, apsPrincipal, isDark }: {
  catorcena: DesgloseCatorcena;
  apsPrincipal: number;
  isDark: boolean;
}) {
  return (
    <div className={`rounded-md border ${isDark ? 'border-zinc-700 bg-zinc-800/50' : 'border-gray-200 bg-white'}`}>
      <div className={`flex items-center gap-3 px-3 py-2 border-b ${isDark ? 'border-zinc-700' : 'border-gray-200'}`}>
        <span className={`text-xs font-semibold ${isDark ? 'text-fuchsia-300' : 'text-fuchsia-700'}`}>
          Cat {catorcena.numero ?? '—'} / {catorcena.anio ?? '—'}
        </span>
        <span className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
          Caras: <span className={isDark ? 'text-zinc-200' : 'text-gray-800'}>{catorcena.caras_total}</span>
        </span>
        <span className={`text-[11px] ml-auto ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
          Inv: <span className={`font-medium ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>{fmtMoney(catorcena.inversion_total)}</span>
        </span>
      </div>
      <div className="p-2 space-y-2">
        {catorcena.plazas.map((p, i) => (
          <PlazaFormatoCard key={`${p.plaza}-${p.formato}-${i}`} bloque={p} apsPrincipal={apsPrincipal} isDark={isDark} />
        ))}
      </div>
    </div>
  );
}

function PlazaFormatoCard({ bloque, apsPrincipal, isDark }: {
  bloque: DesglosePlazaFormato;
  apsPrincipal: number;
  isDark: boolean;
}) {
  return (
    <div className={`rounded border ${isDark ? 'border-zinc-700' : 'border-gray-200'}`}>
      <div className={`flex items-center gap-2 px-2 py-1.5 border-b text-[11px] ${
        isDark ? 'border-zinc-700 bg-zinc-800/70' : 'border-gray-200 bg-gray-50'
      }`}>
        <span className={isDark ? 'text-zinc-500' : 'text-gray-500'}>Plaza:</span>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${isDark ? 'bg-zinc-700 text-zinc-100' : 'bg-gray-200 text-gray-800'}`}>{bloque.plaza}</span>
        <span className={isDark ? 'text-zinc-500' : 'text-gray-500'}>Formato:</span>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${isDark ? 'bg-fuchsia-500/20 text-fuchsia-200' : 'bg-fuchsia-100 text-fuchsia-800'}`}>{bloque.formato}</span>
        <span className={`ml-auto ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>APS:</span>
        <span className={`font-medium ${isDark ? 'text-zinc-100' : 'text-gray-800'}`}>{apsPrincipal}</span>
        <span className={`px-1 py-0.5 rounded text-[9px] font-semibold ${isDark ? 'bg-emerald-500/20 text-emerald-200' : 'bg-emerald-100 text-emerald-800'}`}>POST</span>
      </div>
      <div className="px-2 py-1 space-y-1">
        {bloque.articulos.map(a => (
          <div key={a.id} className={`flex items-center gap-2 text-[11px] px-1 py-1 rounded ${
            isDark ? 'hover:bg-zinc-800/60' : 'hover:bg-gray-50'
          }`}>
            <span className={`shrink-0 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Articulo:</span>
            <span className={`shrink-0 font-medium ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>{a.articulo || '—'}</span>
            {a.grupo_masivo_id != null && (
              <span className={`shrink-0 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>| Grupo {a.grupo_masivo_id}</span>
            )}
            {a.tipo && (
              <span className={`shrink-0 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>| {a.tipo}</span>
            )}
            <span className={`ml-auto shrink-0 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Caras: <span className={isDark ? 'text-zinc-200' : 'text-gray-800'}>{a.caras}</span></span>
            <span className={`shrink-0 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Tarifa: <span className={isDark ? 'text-zinc-200' : 'text-gray-800'}>{fmtMoney(a.tarifa_publica)}</span></span>
            <span className={`shrink-0 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Inv: <span className={`font-medium ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>{fmtMoney(a.inversion)}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}

function NotaCard({ nota, isDark }: { nota: DesposteoNota; isDark: boolean }) {
  const tono: Record<string, string> = {
    inicio: isDark ? 'border-fuchsia-500/30 bg-fuchsia-500/5' : 'border-fuchsia-200 bg-fuchsia-50/60',
    ajuste: isDark ? 'border-amber-500/30 bg-amber-500/5' : 'border-amber-200 bg-amber-50/60',
    aprobacion_gerente: isDark ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-emerald-200 bg-emerald-50/60',
    rechazo_gerente: isDark ? 'border-red-500/30 bg-red-500/5' : 'border-red-200 bg-red-50/60',
    aprobacion_facturacion: isDark ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-emerald-200 bg-emerald-50/60',
    rechazo_facturacion: isDark ? 'border-red-500/30 bg-red-500/5' : 'border-red-200 bg-red-50/60',
    ejecucion: isDark ? 'border-zinc-500/30 bg-zinc-500/5' : 'border-zinc-200 bg-zinc-50',
  };
  return (
    <div className={`rounded-lg border px-3 py-2 ${tono[nota.tipo] || (isDark ? 'border-zinc-700 bg-zinc-800/50' : 'border-gray-200 bg-white')}`}>
      <div className={`text-[11px] flex items-center gap-2 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
        <span className={`font-medium ${isDark ? 'text-zinc-200' : 'text-gray-800'}`}>{nota.usuario_nombre}</span>
        <span>·</span>
        <span>{TIPO_NOTA_LABEL[nota.tipo] || nota.tipo}</span>
        <span className="ml-auto">{new Date(nota.created_at).toLocaleString('es-MX')}</span>
      </div>
      <p className={`mt-1 text-xs whitespace-pre-wrap ${isDark ? 'text-zinc-200' : 'text-gray-800'}`}>{nota.nota}</p>
    </div>
  );
}
