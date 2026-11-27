import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Check, CheckCircle2, ChevronDown, Loader2, Paintbrush, Search, Send, Trash2, X, Upload, FileImage, ClipboardList, Plus, Users, XCircle, Flag, ChevronRight, ExternalLink, Printer, Download } from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import {
  pruebasColorService,
  PruebaColor,
  EstatusPruebaColor,
  ESTATUS_LABEL,
  puedeGestionarPruebaColor,
  puedeCrearPruebaColor,
  puedeRevisarPruebaColor,
  AccionResolverTarea,
  TareaAsociadaPruebaColor,
  TipoPrueba,
} from '../../services/pruebasColor.service';
import { propuestasService, SolicitudCara } from '../../services/propuestas.service';
import { uploadsService } from '../../services/uploads.service';
import { campanasService } from '../../services/campanas.service';
import { notificacionesService } from '../../services/notificaciones.service';
import { formatDate } from '../../lib/utils';

// Valida que un string sea un URL http(s) real. Rechaza basura como
// 'asdasd', 'mailto:...', 'javascript:...' o paths relativos. Jos
// 2026-10-12: evitar que pegues cualquier cosa en el campo de link.
function esUrlValido(str: string): boolean {
  const s = str.trim();
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch { return false; }
}

// Jos 2026-10-23: slot individual del formulario "Nueva solicitud". Cada
// solicitud puede tener N artes y M circuitos; se envian como N*M pruebas
// (una por combinacion). Antes era 1 arte compartido por N circuitos.
interface SlotArte {
  // id local (no toca BD): keyed react render + remover slot especifico.
  id: string;
  file: File | null;
  url: string;        // url del upload; '' si no se ha subido
  enlaceExterno: string;
  nombreArte: string;
  uploading: boolean; // flag independiente por slot para subida en paralelo
}

let __slotArteSeq = 0;
function crearSlotArte(): SlotArte {
  __slotArteSeq += 1;
  return { id: `slot-${__slotArteSeq}`, file: null, url: '', enlaceExterno: '', nombreArte: '', uploading: false };
}

// Nombre de arte autogenerado a partir del filename. Elimina la extension
// y acorta a 120 chars (col nombre_arte en BD es VARCHAR 255 pero mantenemos
// un UX corto). El usuario puede editarlo luego.
function sanitizeNombreArte(filename: string): string {
  const sinExt = filename.replace(/\.[^./\\]+$/, '');
  return sinExt.slice(0, 120).trim() || 'Arte';
}

// Jos 2026-10-23: formato compacto de catorcena (periodo de pisada) para
// pintar en los dropdowns/listados de circuito. Devuelve "15 oct - 28 oct"
// o similar; cae a null si falta alguna fecha.
function formatPeriodo(inicio?: string | null, fin?: string | null): string | null {
  if (!inicio || !fin) return null;
  const toLocal = (s: string): Date | null => {
    // Soporta 'YYYY-MM-DD' y 'YYYY-MM-DDTHH:...' sin cambiarles la tz (parse local).
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  };
  const ini = toLocal(inicio);
  const f = toLocal(fin);
  if (!ini || !f) return null;
  const mes = (d: Date) => d.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '');
  const dia = (d: Date) => d.getDate();
  // Mismo mes → "15 - 28 oct". Distinto mes → "15 oct - 03 nov".
  if (ini.getMonth() === f.getMonth() && ini.getFullYear() === f.getFullYear()) {
    return `${dia(ini)} - ${dia(f)} ${mes(f)}`;
  }
  return `${dia(ini)} ${mes(ini)} - ${dia(f)} ${mes(f)}`;
}

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
  // Jos 2026-11-12: deep-link desde Mis Tareas / Notificaciones. Si viene,
  // al cargar la lista de tareas de la prueba se abre el modal de atender
  // esa tarea específica automáticamente (evita que el usuario tenga que
  // navegar y clickear la tarea manualmente).
  initialTareaId?: number;
}

// Modal reusable de Prueba de Color. Se usa desde 3 lugares:
// (1) listado de propuestas — sin initialScId (el usuario elige circuito).
// (2) listado de campañas — igual, sin initialScId.
// (3) gestión de artes (campaña con APS) — con initialScId preseleccionado.
export function PruebasColorModal({ isOpen, onClose, propuestaId, contextoNombre, initialScId, initialTab, initialTareaId }: Props) {
  const isDark = useThemeStore(s => s.theme) === 'dark';
  const user = useAuthStore(s => s.user);
  const queryClient = useQueryClient();
  const puedeGestionar = puedeGestionarPruebaColor(user?.rol);
  // Jos 2026-10-12: permisos separados para controlar la UI.
  const puedeCrear = puedeCrearPruebaColor(user?.rol);
  const puedeRevisar = puedeRevisarPruebaColor(user?.rol);

  // Multi-select de circuitos. Feedback Jos 2026-10-06: hay casos donde una
  // sola prueba de color aplica a varios circuitos (ej. mismo arte en Renta
  // + Bonificacion del mismo mueble). Al solicitar, se crea una prueba por
  // cada circuito seleccionado.
  const [scIds, setScIds] = useState<number[]>(initialScId ? [initialScId] : []);
  // Jos 2026-10-23: carga multiple. Antes era 1 arte compartido entre N
  // circuitos (N pruebas iguales). Ahora cada slot es un arte distinto, y al
  // enviar se crea el producto cartesiano (scIds x artes) -> N*M pruebas, cada
  // una con 1 arte. Cada slot mantiene su propio archivo subido + link + nombre.
  const [artes, setArtes] = useState<SlotArte[]>([crearSlotArte()]);
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Flag global: true si CUALQUIER slot esta subiendo archivo. Evita que el
  // usuario envie el formulario mientras hay un upload en vuelo.
  const subiendoAlguno = artes.some(a => a.uploading);

  // Tab activo del modal rediseñado (#252). Pestañas: 'pruebas' (listado de
  // pruebas existentes agrupadas por circuito) y 'nueva' (formulario de
  // solicitud limpio). Feedback Jos 2026-10-06: separar consulta de
  // creacion para que el usuario no vea el formulario mezclado con la
  // lista de pruebas ya solicitadas.
  const [activeTab, setActiveTab] = useState<'pruebas' | 'nueva'>('pruebas');
  // Jos 2026-10-23: pestana superior PC / RA. El modulo se renombra a
  // "Revision de Artes Anticipada" y ahora alberga los 2 flujos. El tipo se
  // persiste en pruebas_color.tipo y determina el comportamiento al aprobar
  // (RA vincula a biblioteca, PC no).
  const [activeFlujo, setActiveFlujo] = useState<TipoPrueba>('prueba_color');

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
      setArtes([crearSlotArte()]);
      setNotas('');
      setError(null);
      setActiveTab(initialTab || 'pruebas');
      // Jos 2026-10-23: al abrir, siempre arranca en el flujo original
      // (Prueba de color). El usuario cambia a Revision Anticipada con la
      // pestana superior si lo necesita.
      setActiveFlujo('prueba_color');
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
  // Jos 2026-11-12: cuando el deep-link trae initialTareaId (desde Mis
  // Tareas / Notificaciones), expandir todos los grupos de circuito para
  // que las PruebaCard se monten y puedan auto-abrir la tarea. Sin esto
  // los grupos quedan colapsados y nunca se renderiza la tarea. One-shot
  // con useRef para no re-expandir después de que el usuario colapse (bug
  // Akary "cada que pico tareas abre recepción"). Se resetea al cerrar
  // el modal (isOpen=false) o al limpiar el initialTareaId desde el padre.
  // Guardar el initialTareaId consumido (en vez de un boolean) para que un
  // deep-link nuevo (282092) que llega sin haber pasado por null — porque el
  // modal grande sigue montado desde el deep-link anterior (282087) — SÍ
  // vuelva a expandir los grupos. Feedback Akary 2026-11-13.
  const lastExpandedForTareaIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isOpen || !initialTareaId) {
      lastExpandedForTareaIdRef.current = null;
      return;
    }
    if (lastExpandedForTareaIdRef.current === initialTareaId) return;
    if (pruebasAll.length === 0) return;
    const scIdsPresentes = new Set<number>(pruebasAll.map(p => p.sc_id).filter((x): x is number => Number.isFinite(x)));
    if (scIdsPresentes.size > 0) {
      setExpandedGroups(scIdsPresentes);
      lastExpandedForTareaIdRef.current = initialTareaId;
    }
  }, [isOpen, initialTareaId, pruebasAll]);


  // Akary 2026-11-13: trackear qué initialTareaId ya se auto-abrió desde el
  // padre PruebasColorModal (que NO se desmonta al cambiar de tab). Las
  // PruebaCard y TareasAsociadasSection SÍ se desmontan al cambiar entre
  // 'Prueba de color ↔ Revisión Anticipada' o 'Tareas ↔ Nueva solicitud',
  // así que su useRef interno se perdía y reabría el submodal. Con el state
  // acá arriba el id consumido sobrevive al remount. Se resetea sólo cuando
  // el modal se cierra.
  const [lastAutoOpenedTareaId, setLastAutoOpenedTareaId] = useState<number | null>(null);
  useEffect(() => {
    if (!isOpen) setLastAutoOpenedTareaId(null);
  }, [isOpen]);
  const effectiveInitialTareaId = (initialTareaId != null && initialTareaId !== lastAutoOpenedTareaId)
    ? initialTareaId
    : undefined;

  // Akary 2026-11-13: cuando llega initialTareaId cuya prueba madre pertenece
  // al OTRO flujo (p.ej. deep-link de Revisión de artes de una Revisión
  // Anticipada mientras el modal arrancó en 'prueba_color'), cambiar la
  // pestaña antes de expandir. Sin esto el modal se queda en el flujo
  // default y muestra una prueba equivocada ("picas Ver Prueba de Color de
  // #282012 y te manda a la prueba 39 que no es").
  const switchedFlujoForTareaRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isOpen || !initialTareaId) {
      switchedFlujoForTareaRef.current = null;
      return;
    }
    if (switchedFlujoForTareaRef.current === initialTareaId) return;
    if (pruebasAll.length === 0) return;
    (async () => {
      try {
        const tarea = await notificacionesService.getById(initialTareaId);
        let pid: number | undefined;
        try {
          const c = tarea.contenido ? (typeof tarea.contenido === 'string' ? JSON.parse(tarea.contenido) : tarea.contenido) : null;
          pid = c?.pruebaColorId;
        } catch {}
        if (!pid) return;
        const prueba = pruebasAll.find(p => p.id === pid);
        if (!prueba) return;
        const flujo = (prueba.tipo || 'prueba_color') as TipoPrueba;
        setActiveFlujo(flujo);
        switchedFlujoForTareaRef.current = initialTareaId;
      } catch { /* silencioso */ }
    })();
  }, [isOpen, initialTareaId, pruebasAll]);

  // Jos 2026-10-23: contadores por flujo para los badges de la pestana
  // superior. Los registros viejos sin `tipo` cuentan como 'prueba_color'
  // (coincide con el default del back y del esquema).
  const countsPorFlujo = useMemo(() => {
    const c = { prueba_color: 0, revision_anticipada: 0 };
    for (const p of pruebasAll) {
      const t = (p.tipo || 'prueba_color') as TipoPrueba;
      if (t === 'revision_anticipada') c.revision_anticipada++;
      else c.prueba_color++;
    }
    return c;
  }, [pruebasAll]);
  // Jos 2026-10-23: cada pestana superior ve SOLO las pruebas de su tipo.
  const pruebasDelFlujo = useMemo(
    () => pruebasAll.filter(p => (p.tipo || 'prueba_color') === activeFlujo),
    [pruebasAll, activeFlujo],
  );
  const pruebas = useMemo(() => {
    if (scIds.length === 0) return pruebasDelFlujo; // sin filtro muestra todas
    const setScs = new Set(scIds);
    return pruebasDelFlujo.filter(p => setScs.has(p.sc_id));
  }, [pruebasDelFlujo, scIds]);

  // Jos 2026-11-24: crear multiples pruebas en UN solo batch — el back
  // agrupa todos los artes de un mismo circuito en UNA sola tarea de
  // Revisión (antes eran N tareas sueltas).
  const createMutation = useMutation({
    mutationFn: async (input: Parameters<typeof pruebasColorService.crearBatch>[0]) => {
      await pruebasColorService.crearBatch(input);
    },
    onSuccess: () => {
      setArtes([crearSlotArte()]);
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
    // Agrupa SOLO el flujo activo (ya filtrado en `pruebas`).
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
    // Jos 2026-10-23: incluir catorcena para contexto rapido.
    const periodo = formatPeriodo(c.inicio_periodo, c.fin_periodo);
    const base = `${c.articulo || 'Sin articulo'} · ${c.formato || 'Sin formato'} · ${c.ciudad || c.estados || 'Sin ciudad'}`;
    return periodo ? `${base} · ${periodo}` : base;
  }, [carasQuery.data, initialScId]);

  // Jos 2026-10-23: subida multi-archivo. Reemplaza el archivo del slot
  // indicado por el primer file, y los demas files se agregan como slots
  // nuevos al final. Nombre_arte se autogenera del filename si el slot no
  // tiene nombre todavia.
  const handleUploadFiles = async (slotId: string, files: File[]) => {
    if (!files.length) return;
    setError(null);
    // Marca el slot destino como "uploading" para feedback inmediato.
    setArtes(prev => prev.map(s => s.id === slotId ? { ...s, uploading: true } : s));
    try {
      // Sube todos en paralelo.
      const uploads = await Promise.all(
        files.map(f => uploadsService.uploadFile(f, 'pruebas-color').then(r => ({ file: f, url: r.url }))),
      );
      setArtes(prev => {
        const idx = prev.findIndex(s => s.id === slotId);
        if (idx === -1) return prev;
        const next = [...prev];
        // Primer upload reemplaza el slot destino.
        const first = uploads[0];
        next[idx] = {
          ...next[idx],
          file: first.file,
          url: first.url,
          // Autogenera nombre si estaba vacio: filename sin extension.
          nombreArte: next[idx].nombreArte || sanitizeNombreArte(first.file.name),
          uploading: false,
        };
        // Resto: slots nuevos al final.
        for (let i = 1; i < uploads.length; i++) {
          next.push({
            ...crearSlotArte(),
            file: uploads[i].file,
            url: uploads[i].url,
            nombreArte: sanitizeNombreArte(uploads[i].file.name),
          });
        }
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al subir archivo');
      setArtes(prev => prev.map(s => s.id === slotId ? { ...s, uploading: false } : s));
    }
  };

  const actualizarSlot = (slotId: string, patch: Partial<SlotArte>) => {
    setArtes(prev => prev.map(s => s.id === slotId ? { ...s, ...patch } : s));
  };
  const quitarSlot = (slotId: string) => {
    setArtes(prev => prev.length <= 1 ? prev : prev.filter(s => s.id !== slotId));
  };
  const agregarSlot = () => {
    setArtes(prev => [...prev, crearSlotArte()]);
  };

  if (!isOpen) return null;

  // Jos 2026-10-23: textos dependientes del flujo activo.
  const flujoLabels = activeFlujo === 'revision_anticipada'
    ? {
        singular: 'revisión anticipada',
        plural: 'revisiones anticipadas',
        solicitar: 'Solicitar revisión anticipada',
        solicitarPrimera: 'Solicitar primera revisión',
        emptyTitle: 'Aún no hay revisiones anticipadas',
        emptyFiltered: 'Sin revisiones anticipadas en los circuitos filtrados',
        sinPermiso: 'Tu rol no puede solicitar revisiones anticipadas.',
      }
    : {
        singular: 'prueba de color',
        plural: 'pruebas de color',
        solicitar: 'Solicitar prueba',
        solicitarPrimera: 'Solicitar primera prueba',
        emptyTitle: 'Aún no hay pruebas de color',
        emptyFiltered: 'Sin pruebas en los circuitos filtrados',
        sinPermiso: 'Tu rol no puede solicitar pruebas de color.',
      };

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
      <div className={`w-full max-w-4xl rounded-2xl shadow-2xl border max-h-[95dvh] flex flex-col max-lg:landscape:h-[100dvh] max-lg:landscape:max-h-[100dvh] max-lg:landscape:rounded-none max-lg:landscape:mx-0 ${
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
                Revisión de Artes Anticipada
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

        {/* Barra de FLUJO (Jos 2026-10-23) — pestana superior PC / RA. Cada
            flujo es independiente: contadores, listado y creacion. */}
        <div className={`px-5 pt-3 flex-shrink-0 ${isDark ? 'bg-zinc-900' : 'bg-white'}`}>
          <div className={`inline-flex rounded-lg border p-0.5 ${isDark ? 'bg-zinc-800/60 border-zinc-700' : 'bg-gray-50 border-gray-200'}`}>
            <FlujoButton
              active={activeFlujo === 'prueba_color'}
              onClick={() => setActiveFlujo('prueba_color')}
              isDark={isDark}
              label="Prueba de color"
              badge={countsPorFlujo.prueba_color}
            />
            <FlujoButton
              active={activeFlujo === 'revision_anticipada'}
              onClick={() => setActiveFlujo('revision_anticipada')}
              isDark={isDark}
              label="Revisión Anticipada"
              badge={countsPorFlujo.revision_anticipada}
            />
          </div>
        </div>

        {/* Barra de tabs (#252) — separar consulta de creacion para que el
            formulario no se mezcle con la lista de pruebas existentes. */}
        <div className={`flex items-stretch gap-1 px-5 pt-3 border-b flex-shrink-0 ${isDark ? 'border-zinc-800 bg-zinc-900' : 'border-gray-200 bg-white'}`}>
          <TabButton
            active={activeTab === 'pruebas'}
            onClick={() => setActiveTab('pruebas')}
            isDark={isDark}
            icon={<ClipboardList className="h-4 w-4" />}
            label="Tareas"
            badge={pruebasDelFlujo.length}
          />
          {puedeCrear && (
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
                      {circuitosSeleccionados.map(c => {
                        const periodo = formatPeriodo(c.inicio_periodo, c.fin_periodo);
                        return (
                          <span
                            key={c.id}
                            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] border ${isDark ? 'bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-500/40' : 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200'}`}
                            title={[c.articulo, c.formato, c.ciudad || c.estados, periodo].filter(Boolean).join(' · ')}
                          >
                            <span className="font-medium">#{c.id}</span>
                            <span className="truncate max-w-[180px]">{c.articulo || 'Sin articulo'}</span>
                            {periodo && (
                              <span className={`text-[10px] opacity-80 ${isDark ? 'text-fuchsia-100' : 'text-fuchsia-600'}`}>
                                {periodo}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => setScIds(prev => prev.filter(x => x !== c.id))}
                              className={isDark ? 'hover:text-fuchsia-50' : 'hover:text-fuchsia-900'}
                              title="Quitar"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        );
                      })}
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
                    {scIds.length > 0 ? flujoLabels.emptyFiltered : flujoLabels.emptyTitle}
                  </div>
                  {puedeGestionar && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('nueva')}
                      className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${isDark ? 'bg-fuchsia-500/15 text-fuchsia-300 hover:bg-fuchsia-500/25' : 'bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100'}`}
                    >
                      <Plus className="h-3 w-3" /> {flujoLabels.solicitarPrimera}
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
                              {(() => {
                                // Jos 2026-10-23: catorcena en el header del grupo.
                                const periodo = formatPeriodo(grupo.cara.inicio_periodo, grupo.cara.fin_periodo);
                                return periodo ? ` · ${periodo}` : '';
                              })()}
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
                            {/* Jos 2026-11-27: colapsar en UNA card las pruebas que comparten
                                tarea_revision_id (= mismo batch). Agrupa dentro del circuito. */}
                            {(() => {
                              const subgrupos: Array<{ key: string; pruebas: PruebaColor[] }> = [];
                              const porTarea = new Map<number, PruebaColor[]>();
                              const individuales: PruebaColor[] = [];
                              for (const p of grupo.pruebas) {
                                if (p.tarea_revision_id != null) {
                                  const arr = porTarea.get(p.tarea_revision_id) || [];
                                  arr.push(p);
                                  porTarea.set(p.tarea_revision_id, arr);
                                } else {
                                  individuales.push(p);
                                }
                              }
                              for (const [tareaId, arr] of porTarea.entries()) {
                                // Preservar orden: por version desc (mas reciente primero).
                                arr.sort((a, b) => b.version - a.version);
                                subgrupos.push({ key: `t${tareaId}`, pruebas: arr });
                              }
                              for (const p of individuales) {
                                subgrupos.push({ key: `p${p.id}`, pruebas: [p] });
                              }
                              // Ordenar subgrupos: el del arte mas reciente primero.
                              const tsPrueba = (p: PruebaColor) => (p.created_at ? new Date(p.created_at).getTime() : 0) || p.id;
                              subgrupos.sort((a, b) => {
                                const maxA = Math.max(...a.pruebas.map(tsPrueba));
                                const maxB = Math.max(...b.pruebas.map(tsPrueba));
                                return maxB - maxA;
                              });

                              return subgrupos.map(sg => {
                                if (sg.pruebas.length > 1) {
                                  return (
                                    <PruebaBatchCard
                                      key={sg.key}
                                      pruebas={sg.pruebas}
                                      cara={grupo.cara}
                                      isDark={isDark}
                                      puedeGestionar={puedeGestionar}
                                      puedeCrear={puedeCrear}
                                      puedeRevisar={puedeRevisar}
                                      isUpdating={updateEstatusMutation.isPending || deleteMutation.isPending}
                                      initialTareaId={effectiveInitialTareaId}
                                      onInitialTareaIdConsumed={(id) => setLastAutoOpenedTareaId(id)}
                                      onDelete={(pid) => {
                                        const p = sg.pruebas.find(x => x.id === pid);
                                        if (p && confirm(`¿Eliminar la prueba v${p.version} (${p.nombre_arte || 'sin nombre'})?`)) {
                                          deleteMutation.mutate(pid);
                                        }
                                      }}
                                    />
                                  );
                                }
                                const p = sg.pruebas[0];
                                return (
                                  <PruebaCard
                                    key={p.id}
                                    prueba={p}
                                    cara={grupo.cara}
                                    isDark={isDark}
                                    puedeGestionar={puedeGestionar}
                                    puedeCrear={puedeCrear}
                                    puedeRevisar={puedeRevisar}
                                    isUpdating={updateEstatusMutation.isPending || deleteMutation.isPending}
                                    totalVersiones={grupo.pruebas.length}
                                    initialTareaId={effectiveInitialTareaId}
                                    onInitialTareaIdConsumed={(id) => setLastAutoOpenedTareaId(id)}
                                    onDelete={() => {
                                      if (confirm(`¿Eliminar la prueba v${p.version}?`)) deleteMutation.mutate(p.id);
                                    }}
                                  />
                                );
                              });
                            })()}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'nueva' && puedeCrear && (
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
                        {circuitosSeleccionados.map(c => {
                          const periodo = formatPeriodo(c.inicio_periodo, c.fin_periodo);
                          return (
                            <span
                              key={c.id}
                              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] border ${isDark ? 'bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-500/40' : 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200'}`}
                              title={[c.articulo, c.formato, c.ciudad || c.estados, periodo].filter(Boolean).join(' · ')}
                            >
                              <span className="font-medium">#{c.id}</span>
                              <span className="truncate max-w-[180px]">{c.articulo || 'Sin articulo'}</span>
                              {periodo && (
                                <span className={`text-[10px] opacity-80 ${isDark ? 'text-fuchsia-100' : 'text-fuchsia-600'}`}>
                                  {periodo}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => setScIds(prev => prev.filter(x => x !== c.id))}
                                className={isDark ? 'hover:text-fuchsia-50' : 'hover:text-fuchsia-900'}
                                title="Quitar"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {(() => {
                      // Jos 2026-10-23: avisa total de pruebas que se crearan
                      // (producto cartesiano circuitos x artes con contenido).
                      const artesConContenido = artes.filter(a => a.url || a.enlaceExterno.trim()).length;
                      const artesTotal = Math.max(artesConContenido, 1);
                      const total = scIds.length * artesTotal;
                      if (total <= 1) return null;
                      return (
                        <p className={`mt-2 text-[11px] ${isDark ? 'text-amber-300/80' : 'text-amber-700'}`}>
                          Se crearán {total} pruebas ({scIds.length} circuito{scIds.length === 1 ? '' : 's'} × {artesTotal} arte{artesTotal === 1 ? '' : 's'}).
                        </p>
                      );
                    })()}
                  </>
                )}
              </div>

              <div className="space-y-3">
                {/* Jos 2026-10-23: carga multiple. Cada slot es un arte
                    independiente (archivo subido Y/O link + nombre). Al enviar
                    se crea el producto cartesiano (circuitos x artes). */}
                <div className="flex items-center justify-between">
                  <label className={labelCls}>Arte(s) *</label>
                  {artes.length > 1 && (
                    <span className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
                      {artes.length} artes
                    </span>
                  )}
                </div>
                <div className="space-y-3">
                  {artes.map((slot, idx) => {
                    const linkInvalido = slot.enlaceExterno.trim() && !esUrlValido(slot.enlaceExterno);
                    return (
                      <div
                        key={slot.id}
                        className={`rounded-lg border p-3 space-y-2 ${isDark ? 'bg-zinc-800/40 border-zinc-800' : 'bg-gray-50 border-gray-200'}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-[11px] font-semibold ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
                            Arte {idx + 1}
                          </span>
                          {artes.length > 1 && (
                            <button
                              type="button"
                              onClick={() => quitarSlot(slot.id)}
                              className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded ${isDark ? 'text-zinc-400 hover:text-red-300 hover:bg-red-500/10' : 'text-gray-500 hover:text-red-700 hover:bg-red-50'}`}
                              title="Quitar este arte"
                            >
                              <Trash2 className="h-3 w-3" /> Quitar
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <label
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer border transition-colors ${
                              isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800'
                                     : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                            } ${slot.uploading ? 'opacity-60 cursor-not-allowed' : ''}`}
                          >
                            {slot.uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            {slot.uploading ? 'Subiendo...' : slot.url ? 'Cambiar archivo' : 'Subir archivo(s)'}
                            <input
                              type="file"
                              multiple
                              className="hidden"
                              disabled={slot.uploading}
                              onChange={e => {
                                const files = Array.from(e.target.files || []);
                                if (files.length) handleUploadFiles(slot.id, files);
                                e.target.value = '';
                              }}
                            />
                          </label>
                          {slot.url && (
                            <a href={slot.url} target="_blank" rel="noreferrer" className={`text-xs underline truncate max-w-[260px] inline-flex items-center gap-1 ${isDark ? 'text-fuchsia-300' : 'text-fuchsia-700'}`} title={slot.file?.name || slot.url}>
                              <FileImage className="h-3 w-3" />
                              {slot.file?.name || 'archivo subido'}
                            </a>
                          )}
                        </div>
                        {/* Jos 2026-10-12: puede coexistir con el archivo subido. */}
                        <div>
                          <div className={`text-[10px] uppercase tracking-wide font-semibold mb-1 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
                            Y / o pega un link (Drive, Dropbox, etc.)
                          </div>
                          <input
                            type="url"
                            className={inputCls}
                            value={slot.enlaceExterno}
                            onChange={e => actualizarSlot(slot.id, { enlaceExterno: e.target.value })}
                            placeholder="https://drive.google.com/..."
                          />
                          {linkInvalido && (
                            <div className={`text-[11px] mt-1 flex items-center gap-1 ${isDark ? 'text-red-300' : 'text-red-600'}`}>
                              <AlertCircle className="h-3 w-3" /> Debe comenzar con http:// o https://
                            </div>
                          )}
                        </div>
                        <div>
                          <label className={labelCls}>Nombre del arte *</label>
                          <input
                            className={inputCls}
                            value={slot.nombreArte}
                            onChange={e => actualizarSlot(slot.id, { nombreArte: e.target.value })}
                            placeholder="Ej. Arte v1 - versión CMYK"
                          />
                        </div>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={agregarSlot}
                    className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-dashed transition-colors ${isDark ? 'border-zinc-700 text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200' : 'border-gray-300 text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}
                  >
                    <Plus className="h-3 w-3" /> Agregar otro arte
                  </button>
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

                <div className="flex flex-wrap justify-end gap-2 pt-1 max-lg:landscape:py-2 max-lg:landscape:px-3">
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
                      if (subiendoAlguno) { setError('Espera a que terminen las subidas en curso'); return; }
                      // Normalizar y validar cada slot. Solo se envian slots
                      // con archivo o link (slot vacio se ignora para no
                      // obligar al usuario a quitarlo manualmente).
                      const slotsValidos: Array<{ archivo: string; enlace: string | null; nombre: string }> = [];
                      for (let i = 0; i < artes.length; i++) {
                        const s = artes[i];
                        const enlaceLimpio = s.enlaceExterno.trim();
                        const tieneArchivo = !!s.url;
                        const tieneLink = !!enlaceLimpio;
                        if (!tieneArchivo && !tieneLink) continue; // slot vacio: skip
                        if (tieneLink && !esUrlValido(enlaceLimpio)) {
                          setError(`Arte ${i + 1}: el link no es válido (debe comenzar con http:// o https://)`);
                          return;
                        }
                        const nombreLimpio = s.nombreArte.trim();
                        if (!nombreLimpio) {
                          setError(`Arte ${i + 1}: el nombre del arte es requerido`);
                          return;
                        }
                        slotsValidos.push({ archivo: s.url || '', enlace: enlaceLimpio || null, nombre: nombreLimpio });
                      }
                      if (slotsValidos.length === 0) {
                        setError('Sube un archivo o pega un link en al menos un arte');
                        return;
                      }
                      try {
                        // Jos 2026-11-24: un solo request batch. El back
                        // agrupa todos los artes del mismo circuito en UNA
                        // tarea de Revision para que Diseno los apruebe/
                        // rechace individual o masivo.
                        const artes = scIds.flatMap(sc_id =>
                          slotsValidos.map(a => ({
                            sc_id,
                            archivo: a.archivo,
                            enlace_externo: a.enlace,
                            nombre_arte: a.nombre,
                            notas: notas.trim() || undefined,
                          })),
                        );
                        await createMutation.mutateAsync({
                          propuesta_id: propuestaId,
                          tipo: activeFlujo,
                          artes,
                        });
                        setActiveTab('pruebas');
                      } catch {
                        // onError ya setea el error en el estado
                      }
                    }}
                    disabled={
                      createMutation.isPending ||
                      subiendoAlguno ||
                      scIds.length === 0 ||
                      !artes.some(a => (a.url || a.enlaceExterno.trim()) && a.nombreArte.trim())
                    }
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {createMutation.isPending ? 'Guardando...' : flujoLabels.solicitar}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'nueva' && !puedeCrear && (
            <div className={`px-3 py-6 rounded-lg text-sm text-center ${isDark ? 'bg-zinc-800/60 border border-zinc-700 text-zinc-400' : 'bg-gray-50 border border-gray-200 text-gray-500'}`}>
              {flujoLabels.sinPermiso}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Pestana superior PC / RA (Jos 2026-10-23) ───────────────────────────
// Segmentada, no de linea inferior como TabButton. Sirve para dejar claro
// que es un cambio de FLUJO, no de vista dentro del mismo flujo.
function FlujoButton({ active, onClick, isDark, label, badge }: {
  active: boolean;
  onClick: () => void;
  isDark: boolean;
  label: string;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
        active
          ? (isDark ? 'bg-fuchsia-500/25 text-fuchsia-100 shadow-sm' : 'bg-white text-fuchsia-700 shadow-sm border border-fuchsia-200')
          : (isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-gray-500 hover:text-gray-800')
      }`}
    >
      {label}
      {typeof badge === 'number' && badge > 0 && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
          active
            ? (isDark ? 'bg-fuchsia-500/30 text-fuchsia-100' : 'bg-fuchsia-100 text-fuchsia-700')
            : (isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-gray-100 text-gray-600')
        }`}>
          {badge}
        </span>
      )}
    </button>
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
  cara,
  isDark,
  puedeGestionar,
  puedeCrear,
  puedeRevisar,
  isUpdating,
  onDelete,
  totalVersiones,
  initialTareaId,
  onInitialTareaIdConsumed,
}: {
  prueba: PruebaColor;
  cara: SolicitudCara | null;
  isDark: boolean;
  puedeGestionar: boolean;
  puedeCrear: boolean;
  puedeRevisar: boolean;
  isUpdating: boolean;
  onDelete: () => void;
  // Jos 2026-11-12: deep-link desde Notificaciones (pruebaColorTareaId).
  // Si la tarea existe en esta prueba se abre su modal automático.
  initialTareaId?: number;
  // Akary 2026-11-13: callback al padre PruebasColorModal cuando se auto-abre
  // el submodal, para que el padre marque ese id como consumido y no se
  // vuelva a abrir al remontar (bug cambio de tab + crear nueva solicitud).
  onInitialTareaIdConsumed?: (id: number) => void;
  // Jos 2026-10-23: total de versiones vivas de este arte en el circuito.
  // Permite pintar "v2 de 3" para dar contexto al revisor.
  totalVersiones?: number;
}) {
  // Jos 2026-11-24: botón para bajar en un ZIP todos los artes adjuntados en
  // las tareas de la prueba. Usa el mismo queryKey que TareasAsociadasSection
  // para reutilizar el cache de react-query (sin doble fetch).
  const tareasArtesQuery = useQuery({
    queryKey: ['pruebas-color', 'tareas', prueba.id],
    queryFn: () => pruebasColorService.listarTareas(prueba.id),
    staleTime: 10_000,
  });
  const [descargandoZip, setDescargandoZip] = useState(false);
  const handleDescargarZip = async () => {
    if (descargandoZip) return;
    try {
      setDescargandoZip(true);
      const tareas = tareasArtesQuery.data || [];
      await pruebasColorService.descargarArtesZip(prueba, tareas);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al descargar ZIP de artes');
    } finally {
      setDescargandoZip(false);
    }
  };
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
            v{prueba.version}{totalVersiones && totalVersiones > 1 ? ` de ${totalVersiones}` : ''}
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
        {/* Jos 2026-10-23: info completa del circuito para que el revisor
            no tenga que ir a propuestas a verificar que esta aprobando. */}
        {cara && (() => {
          const periodo = formatPeriodo(cara.inicio_periodo, cara.fin_periodo);
          const items: Array<[string, string]> = [];
          const plaza = cara.ciudad || cara.estados;
          if (plaza) items.push(['Plaza', plaza]);
          if (cara.formato) items.push(['Formato', cara.formato]);
          if (periodo) items.push(['Catorcena', periodo]);
          if (items.length === 0) return null;
          return (
            <div className={`text-[11px] flex flex-wrap gap-x-3 gap-y-1 rounded-md px-2 py-1.5 ${isDark ? 'bg-zinc-900/50 border border-zinc-800' : 'bg-gray-50 border border-gray-200'}`}>
              {items.map(([k, v]) => (
                <span key={k} className={isDark ? 'text-zinc-400' : 'text-gray-600'}>
                  <span className={isDark ? 'text-zinc-500' : 'text-gray-500'}>{k}:</span>{' '}
                  <span className={`font-medium ${isDark ? 'text-zinc-200' : 'text-gray-800'}`}>{v}</span>
                </span>
              ))}
            </div>
          );
        })()}

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
          {prueba.archivo && (
            <a href={prueba.archivo} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded border transition-colors ${isDark ? 'text-fuchsia-300 border-fuchsia-500/40 hover:bg-fuchsia-500/10' : 'text-fuchsia-700 border-fuchsia-300 hover:bg-fuchsia-50'}`}>
              <FileImage className="h-3 w-3" /> Ver arte
            </a>
          )}
          {prueba.enlace_externo && (
            <a href={prueba.enlace_externo} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded border transition-colors ${isDark ? 'text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/10' : 'text-cyan-700 border-cyan-300 hover:bg-cyan-50'}`}>
              <ExternalLink className="h-3 w-3" /> Abrir link
            </a>
          )}
          {/* Jos 2026-11-24: Descarga en ZIP de TODOS los artes adjuntados
              (arte principal + archivos de cada tarea + adjuntos de resolucion). */}
          <button
            type="button"
            onClick={handleDescargarZip}
            disabled={descargandoZip || tareasArtesQuery.isLoading}
            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded border transition-colors ${isDark ? 'text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/10' : 'text-emerald-700 border-emerald-300 hover:bg-emerald-50'} disabled:opacity-50`}
            title="Descargar todos los artes de esta prueba en un ZIP"
          >
            {descargandoZip ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
            {descargandoZip ? 'Preparando ZIP...' : 'Descargar artes (ZIP)'}
          </button>
        </div>
      </div>

      {/* Tareas asociadas: Revisión de artes + Seguimiento Prueba de color.
          Feedback Jos 2026-10-02: se consumen desde este modal para que el
          analista no tenga que ir al módulo de Tareas mientras la prueba
          vive en una propuesta. Al avanzar a campaña, estas mismas tareas
          se sincronizan al gestor de artes vía campania_id. */}
      <TareasAsociadasSection
        prueba={prueba}
        cara={cara}
        isDark={isDark}
        puedeGestionar={puedeGestionar}
        puedeCrear={puedeCrear}
        puedeRevisar={puedeRevisar}
        initialTareaId={initialTareaId}
        onInitialTareaIdConsumed={onInitialTareaIdConsumed}
      />
    </div>
  );
}

// ─── Card AGRUPADA: N pruebas que comparten tarea de Revisión (batch) ───
// Jos 2026-11-27: antes se pintaba UNA card por cada prueba del batch, lo
// que dejaba v1/v2/... con la MISMA tarea de Revisión duplicada. Ahora las
// N pruebas se colapsan en una sola card con la lista de artes adentro y
// UNA sola sección de tareas asociadas (tareasAsociadasSection reutilizada).
function PruebaBatchCard({
  pruebas,
  cara,
  isDark,
  puedeGestionar,
  puedeCrear,
  puedeRevisar,
  isUpdating,
  onDelete,
  initialTareaId,
  onInitialTareaIdConsumed,
}: {
  pruebas: PruebaColor[]; // N > 1, mismo tarea_revision_id
  cara: SolicitudCara | null;
  isDark: boolean;
  puedeGestionar: boolean;
  puedeCrear: boolean;
  puedeRevisar: boolean;
  isUpdating: boolean;
  onDelete: (pruebaId: number) => void;
  initialTareaId?: number;
  onInitialTareaIdConsumed?: (id: number) => void;
}) {
  // Representante del batch (usado para TareasAsociadasSection — carga las
  // tareas via listarTareas(pruebaId) que ya detecta pruebaColorIds array).
  const representante = pruebas[0];
  const totalArtes = pruebas.length;

  // Resumen de estatus del batch para el badge principal.
  const resumen = useMemo(() => {
    let aprobadas = 0, rechazadas = 0, pendientes = 0;
    for (const p of pruebas) {
      if (p.estatus === 'arte_aprobado' || p.estatus === 'aprobada' || p.estatus === 'enviada_proveedor') aprobadas++;
      else if (p.estatus === 'rechazada') rechazadas++;
      else pendientes++;
    }
    return { aprobadas, rechazadas, pendientes };
  }, [pruebas]);

  const estatusBadge = (() => {
    if (resumen.pendientes === totalArtes) {
      return { label: `Pendiente de revisión (${totalArtes})`, cls: isDark ? 'bg-amber-500/15 text-amber-200 border-amber-500/40' : 'bg-amber-50 text-amber-800 border-amber-300' };
    }
    if (resumen.aprobadas === totalArtes) {
      return { label: `Todas aprobadas (${totalArtes})`, cls: isDark ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40' : 'bg-emerald-50 text-emerald-800 border-emerald-300' };
    }
    if (resumen.rechazadas === totalArtes) {
      return { label: `Todas rechazadas (${totalArtes})`, cls: isDark ? 'bg-red-500/15 text-red-200 border-red-500/40' : 'bg-red-50 text-red-800 border-red-300' };
    }
    const partes: string[] = [];
    if (resumen.aprobadas) partes.push(`${resumen.aprobadas} aprobad${resumen.aprobadas === 1 ? 'o' : 'os'}`);
    if (resumen.rechazadas) partes.push(`${resumen.rechazadas} rechazad${resumen.rechazadas === 1 ? 'o' : 'os'}`);
    if (resumen.pendientes) partes.push(`${resumen.pendientes} pendiente${resumen.pendientes === 1 ? '' : 's'}`);
    return { label: partes.join(' · '), cls: isDark ? 'bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-500/40' : 'bg-fuchsia-50 text-fuchsia-800 border-fuchsia-300' };
  })();

  const artesEstatusStyle = (estatus: EstatusPruebaColor): string => {
    if (estatus === 'arte_aprobado' || estatus === 'aprobada' || estatus === 'enviada_proveedor')
      return isDark ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40' : 'bg-emerald-50 text-emerald-800 border-emerald-300';
    if (estatus === 'rechazada')
      return isDark ? 'bg-red-500/15 text-red-200 border-red-500/40' : 'bg-red-50 text-red-800 border-red-300';
    return isDark ? 'bg-amber-500/15 text-amber-200 border-amber-500/40' : 'bg-amber-50 text-amber-800 border-amber-300';
  };

  return (
    <div className={`rounded-lg border overflow-hidden ${isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-white border-gray-200'}`}>
      {/* Header batch: badge resumen + total artes + info solicitante */}
      <div className={`px-3 py-2.5 flex items-start justify-between gap-3 border-b ${isDark ? 'border-zinc-800 bg-zinc-900/40' : 'border-gray-100 bg-gray-50/60'}`}>
        <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
          <span className={`text-[11px] px-1.5 py-0.5 rounded font-bold ${isDark ? 'bg-fuchsia-500/20 text-fuchsia-200' : 'bg-fuchsia-100 text-fuchsia-700'}`}>
            Lote de {totalArtes} artes
          </span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${estatusBadge.cls}`}>
            {estatusBadge.label}
          </span>
        </div>
      </div>

      <div className="px-3 py-2.5 space-y-2">
        {/* Info del circuito */}
        {cara && (() => {
          const periodo = formatPeriodo(cara.inicio_periodo, cara.fin_periodo);
          const items: Array<[string, string]> = [];
          const plaza = cara.ciudad || cara.estados;
          if (plaza) items.push(['Plaza', plaza]);
          if (cara.formato) items.push(['Formato', cara.formato]);
          if (periodo) items.push(['Catorcena', periodo]);
          if (items.length === 0) return null;
          return (
            <div className={`text-[11px] flex flex-wrap gap-x-3 gap-y-1 rounded-md px-2 py-1.5 ${isDark ? 'bg-zinc-900/50 border border-zinc-800' : 'bg-gray-50 border border-gray-200'}`}>
              {items.map(([k, v]) => (
                <span key={k} className={isDark ? 'text-zinc-400' : 'text-gray-600'}>
                  <span className={isDark ? 'text-zinc-500' : 'text-gray-500'}>{k}:</span>{' '}
                  <span className={`font-medium ${isDark ? 'text-zinc-200' : 'text-gray-800'}`}>{v}</span>
                </span>
              ))}
            </div>
          );
        })()}

        <div className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
          Solicitado por <span className={isDark ? 'text-zinc-200' : 'text-gray-800'}>{representante.created_by_nombre}</span> · {formatDate(representante.created_at)}
        </div>

        {representante.notas && (
          <div className={`text-xs rounded-md px-2.5 py-1.5 whitespace-pre-wrap ${isDark ? 'bg-zinc-900/60 text-zinc-200 border border-zinc-800' : 'bg-gray-50 text-gray-700 border border-gray-200'}`}>
            {representante.notas}
          </div>
        )}

        {/* Lista compacta de los N artes del batch */}
        <div className={`rounded-md border divide-y ${isDark ? 'border-zinc-800 divide-zinc-800' : 'border-gray-200 divide-gray-200'}`}>
          {pruebas.map(p => (
            <div key={p.id} className={`px-2.5 py-2 flex items-center gap-2 flex-wrap ${isDark ? 'bg-zinc-900/30' : 'bg-white'}`}>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${isDark ? 'bg-fuchsia-500/20 text-fuchsia-200' : 'bg-fuchsia-100 text-fuchsia-700'}`}>
                v{p.version}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold shrink-0 ${artesEstatusStyle(p.estatus)}`}>
                {ESTATUS_LABEL[p.estatus]}
              </span>
              <span className={`text-xs font-medium truncate flex-1 min-w-[120px] ${isDark ? 'text-zinc-100' : 'text-gray-900'}`} title={p.nombre_arte || `Prueba #${p.id}`}>
                {p.nombre_arte || `Prueba #${p.id}`}
              </span>
              {p.archivo && (
                <a href={p.archivo} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded border shrink-0 ${isDark ? 'text-fuchsia-300 border-fuchsia-500/40 hover:bg-fuchsia-500/10' : 'text-fuchsia-700 border-fuchsia-300 hover:bg-fuchsia-50'}`}>
                  <FileImage className="h-3 w-3" /> Ver
                </a>
              )}
              {p.enlace_externo && (
                <a href={p.enlace_externo} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded border shrink-0 ${isDark ? 'text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/10' : 'text-cyan-700 border-cyan-300 hover:bg-cyan-50'}`}>
                  <ExternalLink className="h-3 w-3" /> Link
                </a>
              )}
              {puedeGestionar && (
                <button
                  onClick={() => onDelete(p.id)}
                  disabled={isUpdating}
                  className={`shrink-0 p-1 rounded transition-colors ${isDark ? 'text-zinc-500 hover:text-red-300 hover:bg-red-500/10' : 'text-gray-400 hover:text-red-600 hover:bg-red-50'} disabled:opacity-50`}
                  title={`Eliminar v${p.version}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* UNA sola sección de tareas asociadas para todo el batch (la query
          usa el id del representante, pero el back filtra también por
          contenido.pruebaColorIds, así que siempre devuelve la tarea batch). */}
      <TareasAsociadasSection
        prueba={representante}
        cara={cara}
        isDark={isDark}
        puedeGestionar={puedeGestionar}
        puedeCrear={puedeCrear}
        puedeRevisar={puedeRevisar}
        initialTareaId={initialTareaId}
        onInitialTareaIdConsumed={onInitialTareaIdConsumed}
        pruebasHermanas={pruebas}
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
  cara,
  isDark,
  puedeGestionar,
  puedeCrear,
  puedeRevisar,
  initialTareaId,
  onInitialTareaIdConsumed,
  pruebasHermanas,
}: {
  prueba: PruebaColor;
  cara: SolicitudCara | null;
  isDark: boolean;
  puedeGestionar: boolean;
  puedeCrear: boolean;
  puedeRevisar: boolean;
  initialTareaId?: number;
  onInitialTareaIdConsumed?: (id: number) => void;
  // Jos 2026-11-27: pruebas del mismo batch (si aplica) — para mostrar en
  // cada tarea del drawer a cuál arte específico corresponde (v4, v3, etc.).
  pruebasHermanas?: PruebaColor[];
}) {
  const pruebaId = prueba.id;
  const queryClient = useQueryClient();
  // [Fix #258 — modal dentro de modal] Jos: al clickear una tarea pendiente,
  // debe abrirse OTRO modal (overlay por encima del principal) con las
  // acciones de aprobar/rechazar/finalizar. El modal principal de prueba de
  // color NO tiene esas acciones directamente — solo las presenta cuando el
  // usuario explícitamente "abre" la tarea.
  // Jos 2026-11-12: initialTareaId (deep-link desde Mis Tareas) consumido
  // UNA sola vez via useRef para evitar re-apertura al cambiar de tab o
  // crear otra solicitud (bug Akary "cada que pico tareas abre recepción").
  // El ref se resetea cuando initialTareaId vuelve a undefined (modal se
  // cerró y el padre limpia el state), así el siguiente deep-link sí abre.
  // One-shot: consumir el initialTareaId cada vez que cambia su valor
  // (incluido el salto de 282087 → 282092). Se resetea cuando vuelve a null.
  const consumedInitialTareaIdRef = useRef<number | null>(null);
  const [openTareaId, setOpenTareaId] = useState<number | null>(null);
  useEffect(() => {
    if (initialTareaId == null) {
      consumedInitialTareaIdRef.current = null;
      return;
    }
    if (consumedInitialTareaIdRef.current !== initialTareaId) {
      consumedInitialTareaIdRef.current = initialTareaId;
      setOpenTareaId(initialTareaId);
      onInitialTareaIdConsumed?.(initialTareaId);
    }
  }, [initialTareaId]);

  const tareasQuery = useQuery({
    queryKey: ['pruebas-color', 'tareas', pruebaId],
    queryFn: () => pruebasColorService.listarTareas(pruebaId),
    staleTime: 10_000,
  });

  const resolver = useMutation({
    mutationFn: ({ tareaId, accion, comentario, archivo_adjunto, enlace_adjunto, pruebaIdObjetivo }: {
      tareaId: number;
      accion: AccionResolverTarea;
      comentario?: string;
      archivo_adjunto?: string | null;
      enlace_adjunto?: string | null;
      // Jos 2026-11-24: cuando la tarea agrupa N pruebas, apunta a cuál
      // se está resolviendo. En individual queda undefined.
      pruebaIdObjetivo?: number;
    }) => pruebasColorService.resolverTarea(pruebaId, tareaId, accion, comentario, { archivo_adjunto, enlace_adjunto }, pruebaIdObjetivo),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pruebas-color', 'tareas', pruebaId] });
      queryClient.invalidateQueries({ queryKey: ['pruebas-color'] });
      // Jos 2026-11-24: en batch no cerramos el modal automaticamente —
      // quedan más artes por resolver. El modal se cierra cuando el
      // usuario quiere, o cuando ya todas están resueltas y la tarea pasa
      // a Atendido/Rechazado.
      if (!variables.pruebaIdObjetivo) setOpenTareaId(null);
    },
    onError: (e: Error) => alert(e.message),
  });

  const tareas = tareasQuery.data || [];
  const tareaAbierta = tareas.find(t => t.id === openTareaId) || null;

  // Jos 2026-11-24: detectar si la tarea abierta agrupa N pruebas (batch).
  // Si sí, cargamos las N pruebas de la propuesta y filtramos por los ids
  // del contenido JSON para pasarlas al AtenderRevisionBatchModal.
  const contenidoBatch = useMemo(() => {
    if (!tareaAbierta || !tareaAbierta.contenido) return null;
    try {
      const c = JSON.parse(tareaAbierta.contenido);
      const ids = Array.isArray(c.pruebaColorIds)
        ? (c.pruebaColorIds as unknown[]).map(v => Number(v)).filter(n => Number.isFinite(n) && n > 0)
        : null;
      if (!ids || ids.length <= 1) return null;
      return { ids, propuestaId: Number(c.propuestaId) || prueba.propuesta_id };
    } catch { return null; }
  }, [tareaAbierta, prueba.propuesta_id]);

  const pruebasBatchQuery = useQuery({
    queryKey: ['pruebas-color', 'propuesta', contenidoBatch?.propuestaId, 'all-tipos'],
    queryFn: () => pruebasColorService.listar({ propuesta_id: contenidoBatch!.propuestaId }),
    staleTime: 10_000,
    enabled: !!contenidoBatch,
  });
  const pruebasDelBatch = useMemo<PruebaColor[]>(() => {
    if (!contenidoBatch || !pruebasBatchQuery.data) return [];
    const idSet = new Set(contenidoBatch.ids);
    return pruebasBatchQuery.data.filter(p => idSet.has(p.id));
  }, [contenidoBatch, pruebasBatchQuery.data]);
  // Jos 2026-10-12: la ultima tarea de Revision de artes (por id desc) es
  // la "activa"; si hay varias rechazadas, solo la mas reciente permite
  // reeditar. Las viejas son registro historico de rechazos anteriores.
  const idUltimaRevision = tareas
    .filter(t => t.tipo === 'Revisión de artes')
    .map(t => t.id)
    .sort((a, b) => b - a)[0];

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
          // Jos 2026-10-12: Aprobar/Rechazar solo Diseño; Finalizar solo Analista.
          const puedeAprobar = esRevision && t.estatus === 'Pendiente' && puedeRevisar;
          const puedeFinalizar = esSeguimiento && t.estatus === 'Pendiente' && puedeCrear;
          const tieneAcciones = puedeAprobar || puedeFinalizar;

          // Jos 2026-10-12: una tarea ya resuelta (Rechazado/Atendido/
          // Finalizada) tambien debe poder abrirse — en modo solo lectura —
          // para consultar el motivo que quedo guardado en la evidencia.
          // Jos 2026-11-27: si la tarea pertenece al batch (hermanas disponibles),
          // mostramos a QUÉ arte específico corresponde la tarea (v4, v3…).
          let arteAsociado: { version: number; nombre: string | null } | null = null;
          // Jos 2026-11-27: la tarea puede ser (a) individual con pruebaColorId
          // -> etiquetamos con v+nombre de esa prueba; (b) batch con
          // pruebaColorIds array -> mostramos "N artes" para avisar que agrupa.
          let countBatch: number | null = null;
          if (t.contenido) {
            try {
              const c = JSON.parse(t.contenido);
              if (Array.isArray(c.pruebaColorIds) && c.pruebaColorIds.length > 1) {
                countBatch = c.pruebaColorIds.length;
              } else if (pruebasHermanas && pruebasHermanas.length > 1) {
                const pid = Number(c.pruebaColorId);
                if (Number.isFinite(pid)) {
                  const p = pruebasHermanas.find(x => x.id === pid);
                  if (p) arteAsociado = { version: p.version, nombre: p.nombre_arte };
                }
              }
            } catch { /* ignore */ }
          }
          const nombreTarea = esRevision ? 'Revisión de artes' : esSeguimiento ? 'Seguimiento' : t.tipo;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setOpenTareaId(t.id)}
              className={`w-full rounded-lg border text-left transition-colors cursor-pointer ${isDark ? 'bg-zinc-800/60 border-zinc-700 hover:bg-zinc-800 hover:border-fuchsia-500/40' : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-fuchsia-300'}`}
              title={tieneAcciones ? 'Abrir tarea para atender' : 'Ver detalle de la tarea'}
            >
              <div className="px-2.5 py-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
                  <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${estadoColor(t.estatus)}`}>
                    {t.estatus || 'Sin estado'}
                  </span>
                  <span className={`text-xs font-medium truncate ${isDark ? 'text-zinc-100' : 'text-gray-800'}`} title={t.tipo || ''}>
                    {nombreTarea}
                  </span>
                  {arteAsociado && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium truncate max-w-[160px] ${isDark ? 'bg-fuchsia-500/15 text-fuchsia-200 border border-fuchsia-500/30' : 'bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200'}`} title={arteAsociado.nombre || ''}>
                      v{arteAsociado.version}{arteAsociado.nombre ? ` · ${arteAsociado.nombre}` : ''}
                    </span>
                  )}
                  {countBatch && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isDark ? 'bg-fuchsia-500/15 text-fuchsia-200 border border-fuchsia-500/30' : 'bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200'}`}>
                      {countBatch} artes
                    </span>
                  )}
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
        contenidoBatch ? (
          <AtenderRevisionBatchModal
            tarea={tareaAbierta}
            pruebas={pruebasDelBatch}
            isLoadingPruebas={pruebasBatchQuery.isLoading}
            cara={cara}
            isDark={isDark}
            puedeRevisar={puedeRevisar}
            onClose={() => setOpenTareaId(null)}
            // Jos 2026-11-24: usar mutateAsync para que el masivo pueda
            // serializar las resoluciones con await y evitar race en la
            // evidencia de la tarea (el back lee/escribe evidencia JSON).
            onResolverArte={async (pruebaIdObjetivo, accion, opts) => {
              await resolver.mutateAsync({
                tareaId: tareaAbierta.id,
                accion,
                comentario: opts?.comentario,
                archivo_adjunto: opts?.archivo_adjunto,
                enlace_adjunto: opts?.enlace_adjunto,
                pruebaIdObjetivo,
              });
            }}
            isSaving={resolver.isPending}
          />
        ) : (
          <AtenderTareaModal
            tarea={tareaAbierta}
            prueba={prueba}
            cara={cara}
            isDark={isDark}
            puedeCrear={puedeCrear}
            puedeRevisar={puedeRevisar}
            esUltimaRevision={tareaAbierta.id === idUltimaRevision}
            yaTieneImpresion={tareas.some(t => t.tipo === 'Impresión')}
            yaTieneRecepcion={tareas.some(t => t.tipo === 'Recepción')}
            onClose={() => setOpenTareaId(null)}
            onAprobar={(opts) => resolver.mutate({ tareaId: tareaAbierta.id, accion: 'aprobar', comentario: opts?.comentario, archivo_adjunto: opts?.archivo_adjunto, enlace_adjunto: opts?.enlace_adjunto })}
            onRechazar={(comentario, adjuntos) => resolver.mutate({ tareaId: tareaAbierta.id, accion: 'rechazar', comentario, archivo_adjunto: adjuntos?.archivo_adjunto, enlace_adjunto: adjuntos?.enlace_adjunto })}
            onFinalizar={() => resolver.mutate({ tareaId: tareaAbierta.id, accion: 'finalizar' })}
            isSaving={resolver.isPending}
          />
        )
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
  cara,
  isDark,
  puedeCrear,
  puedeRevisar,
  esUltimaRevision,
  yaTieneImpresion,
  yaTieneRecepcion,
  onClose,
  onAprobar,
  onRechazar,
  onFinalizar,
  isSaving,
}: {
  tarea: TareaAsociadaPruebaColor;
  prueba: PruebaColor;
  cara: SolicitudCara | null;
  isDark: boolean;
  puedeCrear: boolean;
  puedeRevisar: boolean;
  // true si esta es la tarea de Revision mas reciente de la prueba.
  // Rechazos viejos (de iteraciones anteriores) tienen esto en false.
  esUltimaRevision: boolean;
  // Jos 2026-11-12: true si ya existe una tarea de Impresion para esta prueba.
  // Se usa para deshabilitar el botón "Pedido de impresión" y evitar duplicados.
  yaTieneImpresion: boolean;
  // Jos 2026-11-12: true si ya existe una tarea de Recepción para esta prueba.
  // Se usa para ocultar el botón "Crear recepción" en la tarea Impresión.
  yaTieneRecepcion: boolean;
  onClose: () => void;
  // Jos 2026-10-29: en Revision Anticipada la aprobacion abre modal con
  // motivo + archivo + enlace (igual al rechazo pero en verde). Para PC
  // sigue siendo click directo sin modal.
  onAprobar: (opts?: { comentario?: string; archivo_adjunto?: string | null; enlace_adjunto?: string | null }) => void;
  onRechazar: (comentario?: string, adjuntos?: { archivo_adjunto?: string | null; enlace_adjunto?: string | null }) => void;
  onFinalizar: () => void;
  isSaving: boolean;
}) {
  const esRevision = tarea.tipo === 'Revisión de artes';
  const esSeguimiento = tarea.tipo === 'Seguimiento Prueba de color';
  const esImpresion = tarea.tipo === 'Impresión';
  const esRecepcion = tarea.tipo === 'Recepción';
  const esRevisionAnticipada = prueba.tipo === 'revision_anticipada';
  // Jos 2026-11-27: tareas tipo 'Prueba de Color' con requiereNuevaVersion
  // son el aviso al asesor de que su arte fue RECHAZADO. Render especial
  // con motivo + archivos de referencia + botón para subir nueva versión.
  // Soporta DOS variantes: (a) 1 arte rechazado (contenido raíz) y (b)
  // batch de N artes rechazados (contenido.artes array). El render pinta
  // una card por arte.
  type ArteRechazado = {
    pruebaColorId: number | null;
    version: number | null;
    nombreArte: string | null;
    scId: number | null;
    motivo: string;
    archivoAdjunto: string | null;
    enlaceAdjunto: string | null;
  };
  // Jos 2026-11-27: Seguimiento batch — N artes aprobados en una sola tarea.
  // El render lista cada arte con su motivo de aprobación (si lo hay) para
  // que el analista sepa qué va a avanzar al proveedor y pueda finalizar
  // todo el grupo de un solo click.
  type ArteSeguimiento = {
    pruebaColorId: number | null;
    version: number | null;
    nombreArte: string | null;
    arte: string | null;
    motivoAprobacion: string | null;
    aprobacionArchivo: string | null;
    aprobacionEnlace: string | null;
  };
  const avisoSeguimiento = useMemo((): { propuestaId: number | null; artes: ArteSeguimiento[] } | null => {
    if (tarea.tipo !== 'Seguimiento Prueba de color' || !tarea.contenido) return null;
    try {
      const c = JSON.parse(tarea.contenido) as {
        esBatch?: boolean;
        propuestaId?: number;
        artes?: Array<{
          pruebaColorId?: number;
          version?: number;
          nombreArte?: string | null;
          arte?: string | null;
          motivoAprobacion?: string | null;
          aprobacionArchivo?: string | null;
          aprobacionEnlace?: string | null;
        }>;
      };
      if (!c.esBatch || !Array.isArray(c.artes) || c.artes.length === 0) return null;
      return {
        propuestaId: c.propuestaId || null,
        artes: c.artes.map(a => ({
          pruebaColorId: a.pruebaColorId ?? null,
          version: a.version ?? null,
          nombreArte: a.nombreArte ?? null,
          arte: a.arte ?? null,
          motivoAprobacion: a.motivoAprobacion ?? null,
          aprobacionArchivo: a.aprobacionArchivo ?? null,
          aprobacionEnlace: a.aprobacionEnlace ?? null,
        })),
      };
    } catch { return null; }
  }, [tarea.tipo, tarea.contenido]);
  const avisoRechazo = useMemo((): { propuestaId: number | null; artes: ArteRechazado[] } | null => {
    if (tarea.tipo !== 'Prueba de Color' || !tarea.contenido) return null;
    try {
      const c = JSON.parse(tarea.contenido) as {
        pruebaColorId?: number;
        pruebaColorIds?: number[];
        scId?: number;
        propuestaId?: number;
        version?: number;
        requiereNuevaVersion?: boolean;
        esBatch?: boolean;
        motivoRechazo?: string;
        archivoAdjunto?: string;
        enlaceAdjunto?: string;
        artes?: Array<{
          pruebaColorId?: number;
          version?: number;
          scId?: number;
          nombreArte?: string | null;
          motivoRechazo?: string | null;
          archivoAdjunto?: string | null;
          enlaceAdjunto?: string | null;
        }>;
      };
      if (!c.requiereNuevaVersion) return null;
      // Variante batch
      if (c.esBatch && Array.isArray(c.artes) && c.artes.length > 0) {
        return {
          propuestaId: c.propuestaId || null,
          artes: c.artes.map(a => ({
            pruebaColorId: a.pruebaColorId ?? null,
            version: a.version ?? null,
            nombreArte: a.nombreArte ?? null,
            scId: a.scId ?? c.scId ?? null,
            motivo: a.motivoRechazo || '',
            archivoAdjunto: a.archivoAdjunto || null,
            enlaceAdjunto: a.enlaceAdjunto || null,
          })),
        };
      }
      // Variante individual (legacy / 1-arte)
      return {
        propuestaId: c.propuestaId || null,
        artes: [{
          pruebaColorId: c.pruebaColorId ?? null,
          version: c.version ?? null,
          nombreArte: null,
          scId: c.scId ?? null,
          motivo: c.motivoRechazo || '',
          archivoAdjunto: c.archivoAdjunto || null,
          enlaceAdjunto: c.enlaceAdjunto || null,
        }],
      };
    } catch { return null; }
  }, [tarea.tipo, tarea.contenido]);
  // Jos 2026-11-12: la tarea Recepción guarda la guía PDF en evidencia
  // (JSON) y la fecha estimada en fecha_fin. Las leemos para mostrar al
  // abrir el detalle (así el usuario puede revisar antes de atenderla).
  const recepcionGuiaPdfUrl = useMemo(() => {
    if (!esRecepcion || !tarea.evidencia) return null;
    try {
      const obj = JSON.parse(tarea.evidencia);
      return typeof obj?.guia_pdf === 'string' ? obj.guia_pdf : null;
    } catch { return null; }
  }, [esRecepcion, tarea.evidencia]);
  const recepcionFechaEstimada = esRecepcion ? tarea.fecha_fin : null;
  const numImpresionesRecibidas = useMemo(() => {
    if (!esRecepcion || !tarea.evidencia) return null;
    try {
      const obj = JSON.parse(tarea.evidencia);
      return typeof obj?.num_recibidas === 'number' ? obj.num_recibidas : null;
    } catch { return null; }
  }, [esRecepcion, tarea.evidencia]);
  const asignados = tarea.asignado ? tarea.asignado.split(',').map(s => s.trim()).filter(Boolean) : [];
  const [showRechazoInput, setShowRechazoInput] = useState(false);
  const [comentarioRechazo, setComentarioRechazo] = useState('');
  // Jos 2026-10-29: estado del modal de aprobacion en RA (motivo + archivo + enlace).
  const [showAprobacionInput, setShowAprobacionInput] = useState(false);
  const [comentarioAprobacion, setComentarioAprobacion] = useState('');
  const [aprobacionFile, setAprobacionFile] = useState<File | null>(null);
  const [aprobacionFileUrl, setAprobacionFileUrl] = useState<string | null>(null);
  const [aprobacionFileUploading, setAprobacionFileUploading] = useState(false);
  const [aprobacionEnlace, setAprobacionEnlace] = useState('');
  const handleUploadAprobacion = async (file: File) => {
    setAprobacionFileUploading(true);
    try {
      const res = await uploadsService.uploadFile(file, 'pruebas-color/aprobaciones');
      setAprobacionFile(file);
      setAprobacionFileUrl(res.url);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al subir archivo');
      setAprobacionFile(null);
      setAprobacionFileUrl(null);
    } finally {
      setAprobacionFileUploading(false);
    }
  };
  // Jos 2026-10-29: pedido de impresion desde la tarea Seguimiento.
  const [showPedidoImpresion, setShowPedidoImpresion] = useState(false);
  const [showRecepcion, setShowRecepcion] = useState(false);
  // Jos 2026-10-12: scroll automatico al abrir el form de rechazo para
  // que los campos de adjuntos sean visibles sin scroll manual.
  const rechazoFormRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (showRechazoInput && rechazoFormRef.current) {
      rechazoFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [showRechazoInput]);
  // Jos 2026-10-12: adjuntos opcionales del rechazo. Van al back y
  // aparecen en la notificacion al creador.
  const [rechazoFile, setRechazoFile] = useState<File | null>(null);
  const [rechazoFileUrl, setRechazoFileUrl] = useState<string | null>(null);
  const [rechazoFileUploading, setRechazoFileUploading] = useState(false);
  const [rechazoEnlace, setRechazoEnlace] = useState('');
  const handleUploadRechazo = async (file: File) => {
    setRechazoFileUploading(true);
    try {
      const res = await uploadsService.uploadFile(file, 'pruebas-color/rechazos');
      setRechazoFile(file);
      setRechazoFileUrl(res.url);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al subir archivo');
      setRechazoFile(null);
      setRechazoFileUrl(null);
    } finally {
      setRechazoFileUploading(false);
    }
  };
  // Lightbox del arte de la prueba — Jos pidió preview + click para abrir
  // el visor grande (reutiliza el patrón del modal de galeria de artes).
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Reenvio inline — Jos 2026-10-12: cuando la tarea es Revisión Rechazada,
  // el creador puede re-subir arte sobre la misma prueba (NO crea v2).
  // Se expone un formulario dentro del mismo modalsito.
  const [showReenviarForm, setShowReenviarForm] = useState(false);
  const [reenviarFile, setReenviarFile] = useState<File | null>(null);
  const [reenviarUrl, setReenviarUrl] = useState<string | null>(null);
  // Jos 2026-10-12: enlace independiente para que coexista con archivo subido.
  const [reenviarEnlace, setReenviarEnlace] = useState('');
  const [reenviarNombre, setReenviarNombre] = useState(prueba.nombre_arte || '');
  const [reenviarNotas, setReenviarNotas] = useState(prueba.notas || '');
  const [reenviarError, setReenviarError] = useState<string | null>(null);
  const [reenviarUploading, setReenviarUploading] = useState(false);
  const queryClientLocal = useQueryClient();
  // Jos 2026-11-12: marcar Recepción como recibida (Finalizada).
  // No pasa por resolverTareaAsociada porque ese endpoint solo acepta
  // finalizar sobre 'Seguimiento Prueba de color'. Usamos el PATCH de
  // campanas directo y refrescamos las queries del drawer.
  const [recibiendoRecepcion, setRecibiendoRecepcion] = useState(false);
  const [showConfirmarRecibidas, setShowConfirmarRecibidas] = useState(false);
  const [cantidadRecibidasInput, setCantidadRecibidasInput] = useState<string>('');
  useEffect(() => {
    if (showConfirmarRecibidas && tarea.num_impresiones != null) {
      setCantidadRecibidasInput(String(tarea.num_impresiones));
    }
  }, [showConfirmarRecibidas, tarea.num_impresiones]);
  const handleMarcarRecibida = async (cantidad: number) => {
    if (!prueba.campania_id) return;
    setRecibiendoRecepcion(true);
    try {
      const evidenciaPrev = (() => {
        try { return tarea.evidencia ? JSON.parse(tarea.evidencia) : {}; } catch { return {}; }
      })();
      const evidenciaNueva = JSON.stringify({ ...evidenciaPrev, num_recibidas: cantidad });
      await campanasService.updateTarea(prueba.campania_id, tarea.id, {
        estatus: 'Finalizada',
        evidencia: evidenciaNueva,
      });
      queryClientLocal.invalidateQueries({ queryKey: ['tareas-campana', prueba.campania_id] });
      queryClientLocal.invalidateQueries({ queryKey: ['campanas', prueba.campania_id, 'tareas'] });
      queryClientLocal.invalidateQueries({ queryKey: ['pruebas-color', 'tareas', prueba.id] });
      queryClientLocal.invalidateQueries({ queryKey: ['pruebas-color', 'propuesta', prueba.propuesta_id] });
      queryClientLocal.invalidateQueries({ queryKey: ['pruebas-color'] });
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'No se pudo marcar la recepción como recibida');
    } finally {
      setRecibiendoRecepcion(false);
    }
  };
  const reenviarMutation = useMutation({
    mutationFn: () => {
      const enlaceLimpio = reenviarEnlace.trim();
      if (!reenviarUrl && !enlaceLimpio) throw new Error('Sube un archivo o pega un link');
      if (enlaceLimpio && !esUrlValido(enlaceLimpio)) {
        throw new Error('El link del arte no es válido. Debe comenzar con http:// o https://');
      }
      return pruebasColorService.reenviar(prueba.id, {
        archivo: reenviarUrl || '',
        enlace_externo: enlaceLimpio || null,
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
      if (!motivo && !data.resueltaPor && !data.archivoAdjunto && !data.enlaceAdjunto) return null;
      return {
        motivo: typeof motivo === 'string' ? motivo : null,
        resueltaPor: data.resueltaPor || null,
        resueltaAt: data.resueltaAt || null,
        archivoAdjunto: typeof data.archivoAdjunto === 'string' ? data.archivoAdjunto : null,
        enlaceAdjunto: typeof data.enlaceAdjunto === 'string' ? data.enlaceAdjunto : null,
      };
    } catch { return null; }
  }, [tarea.evidencia]);

  const yaResuelta = tarea.estatus !== 'Pendiente';
  const esRechazada = (tarea.estatus || '').toLowerCase().includes('rechaz');
  const esAtendidaOk = ['atendido', 'finalizada'].includes((tarea.estatus || '').toLowerCase());
  // Jos 2026-10-12: solo permitir editar/reenviar si la prueba sigue
  // 'rechazada'. Si ya se reenvio (prueba -> revision_artes) la tarea
  // vieja rechazada queda como registro historico y no es editable.
  const puedeReenviar = esRechazada && esRevision && prueba.estatus === 'rechazada' && esUltimaRevision && puedeCrear;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-2xl rounded-xl border shadow-2xl flex flex-col max-h-[92dvh] max-lg:landscape:h-[100dvh] max-lg:landscape:max-h-[100dvh] max-lg:landscape:rounded-none max-lg:landscape:mx-0 ${isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-100' : 'bg-white border-gray-200 text-gray-900'}`}
      >
        {/* Header */}
        <div className={`shrink-0 px-5 py-3 flex items-start justify-between gap-3 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
          <div className="flex-1 min-w-0">
            <div className={`text-[10px] uppercase tracking-wide font-semibold ${isDark ? 'text-fuchsia-300' : 'text-fuchsia-700'}`}>
              {yaResuelta ? 'Detalle de la tarea' : 'Atender tarea'}
            </div>
            <div className="text-base font-semibold mt-0.5">
              {esRevision ? 'Revisión de artes' : esSeguimiento ? (esRevisionAnticipada ? 'Seguimiento Revisión Anticipada' : 'Seguimiento Prueba de color') : tarea.tipo}
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
          {/* Jos 2026-11-27: Seguimiento batch — lista de N artes aprobados.
              Al Finalizar la tarea, el back aprueba las N pruebas de una vez
              (onFinalizarTareaSeguimiento itera pruebaColorIds). */}
          {avisoSeguimiento && avisoSeguimiento.artes.length > 0 && (
            <div className={`rounded-xl p-3 border space-y-3 ${isDark ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-emerald-50/70 border-emerald-200'}`}>
              <div className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-2 ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                {avisoSeguimiento.artes.length} artes aprobados — listos para proveedor
              </div>
              <div className="space-y-2">
                {avisoSeguimiento.artes.map((arte, idx) => (
                  <div
                    key={arte.pruebaColorId ?? idx}
                    className={`rounded-lg p-2.5 border space-y-1.5 ${isDark ? 'bg-zinc-900/40 border-zinc-700' : 'bg-white border-gray-200'}`}
                  >
                    <div className="flex items-center gap-2">
                      {arte.arte && (
                        <img src={arte.arte} alt={arte.nombreArte || ''} className="h-10 w-10 object-cover rounded border border-zinc-700" />
                      )}
                      <div className={`text-[11px] font-semibold flex-1 min-w-0 ${isDark ? 'text-zinc-100' : 'text-gray-800'}`}>
                        <div>
                          {arte.version ? `v${arte.version}` : ''}
                          {arte.nombreArte ? ` · ${arte.nombreArte}` : ''}
                          {!arte.version && !arte.nombreArte ? `Arte #${arte.pruebaColorId}` : ''}
                        </div>
                      </div>
                    </div>
                    {arte.motivoAprobacion && (
                      <div>
                        <div className={`text-[10px] uppercase tracking-wide font-semibold mb-0.5 ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>Nota de aprobación</div>
                        <div className={`text-sm whitespace-pre-wrap ${isDark ? 'text-zinc-100' : 'text-gray-800'}`}>{arte.motivoAprobacion}</div>
                      </div>
                    )}
                    {(arte.aprobacionArchivo || arte.aprobacionEnlace) && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {arte.aprobacionArchivo && (
                          <a href={arte.aprobacionArchivo} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded border ${isDark ? 'text-emerald-200 border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20' : 'text-emerald-800 border-emerald-300 bg-emerald-50 hover:bg-emerald-100'}`}>
                            <FileImage className="h-3 w-3" /> Ver archivo
                          </a>
                        )}
                        {arte.aprobacionEnlace && (
                          <a href={arte.aprobacionEnlace} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded border ${isDark ? 'text-cyan-200 border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20' : 'text-cyan-800 border-cyan-300 bg-cyan-50 hover:bg-cyan-100'}`}>
                            <ExternalLink className="h-3 w-3" /> Abrir link
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Jos 2026-11-27: aviso de arte(s) rechazado(s). Soporta 1 o N artes:
              pinta una card por cada arte con su motivo, referencias y botón
              "Subir nueva versión" propio. */}
          {avisoRechazo && avisoRechazo.artes.length > 0 && (
            <div className={`rounded-xl p-3 border space-y-3 ${isDark ? 'bg-red-500/5 border-red-500/30' : 'bg-red-50/70 border-red-200'}`}>
              <div className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-2 ${isDark ? 'text-red-300' : 'text-red-700'}`}>
                <AlertCircle className="h-3.5 w-3.5" />
                {avisoRechazo.artes.length === 1 ? 'Prueba de color rechazada' : `${avisoRechazo.artes.length} artes rechazados`}
              </div>
              <div className="space-y-2">
                {avisoRechazo.artes.map((arte, idx) => (
                  <div
                    key={arte.pruebaColorId ?? idx}
                    className={`rounded-lg p-2.5 border space-y-1.5 ${isDark ? 'bg-zinc-900/40 border-zinc-700' : 'bg-white border-gray-200'}`}
                  >
                    <div className={`text-[11px] font-semibold ${isDark ? 'text-zinc-100' : 'text-gray-800'}`}>
                      {arte.version ? `v${arte.version}` : ''}
                      {arte.nombreArte ? ` · ${arte.nombreArte}` : ''}
                      {!arte.version && !arte.nombreArte ? `Arte #${arte.pruebaColorId}` : ''}
                    </div>
                    {arte.motivo && (
                      <div>
                        <div className={`text-[10px] uppercase tracking-wide font-semibold mb-0.5 ${isDark ? 'text-red-300' : 'text-red-700'}`}>Motivo del rechazo</div>
                        <div className={`text-sm whitespace-pre-wrap ${isDark ? 'text-zinc-100' : 'text-gray-800'}`}>{arte.motivo}</div>
                      </div>
                    )}
                    {(arte.archivoAdjunto || arte.enlaceAdjunto) && (
                      <div className="space-y-1">
                        <div className={`text-[10px] uppercase tracking-wide font-semibold ${isDark ? 'text-red-300' : 'text-red-700'}`}>Referencias</div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {arte.archivoAdjunto && (
                            <a href={arte.archivoAdjunto} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded border ${isDark ? 'text-fuchsia-200 border-fuchsia-500/40 bg-fuchsia-500/10 hover:bg-fuchsia-500/20' : 'text-fuchsia-800 border-fuchsia-300 bg-fuchsia-50 hover:bg-fuchsia-100'}`}>
                              <FileImage className="h-3 w-3" /> Ver archivo
                            </a>
                          )}
                          {arte.enlaceAdjunto && (
                            <a href={arte.enlaceAdjunto} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded border ${isDark ? 'text-cyan-200 border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20' : 'text-cyan-800 border-cyan-300 bg-cyan-50 hover:bg-cyan-100'}`}>
                              <ExternalLink className="h-3 w-3" /> Abrir link
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                    {avisoRechazo.propuestaId && arte.scId && (
                      <button
                        onClick={() => {
                          const url = `/propuestas?viewId=${avisoRechazo.propuestaId}&pruebaColorNuevaScId=${arte.scId}`;
                          onClose();
                          window.location.href = url;
                        }}
                        className={`mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${isDark ? 'border-fuchsia-500/60 text-fuchsia-100 bg-fuchsia-500/20 hover:bg-fuchsia-500/30' : 'border-fuchsia-400 text-fuchsia-800 bg-fuchsia-50 hover:bg-fuchsia-100'}`}
                      >
                        <Upload className="h-3.5 w-3.5" /> Subir nueva versión
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Plaza / circuito — Jos 2026-10-12: mismo detalle que se ve en el
              header del acordeon del modal padre, para que el revisor sepa de
              un vistazo donde va la prueba. */}
          <div className={`rounded-lg border px-3 py-2 flex items-center gap-2 flex-wrap ${isDark ? 'bg-fuchsia-500/5 border-fuchsia-500/30' : 'bg-fuchsia-50/60 border-fuchsia-200'}`}>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isDark ? 'bg-fuchsia-500/20 text-fuchsia-200' : 'bg-fuchsia-100 text-fuchsia-700'}`}>
              #{prueba.sc_id}
            </span>
            <span className={`text-xs font-semibold ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>
              {cara?.articulo || 'Circuito'}
            </span>
            {cara && (
              <span className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
                · {cara.formato || 'Sin formato'} · {cara.ciudad || cara.estados || 'Sin ciudad'}
              </span>
            )}
          </div>

          {/* Preview del arte asociado a la prueba. Click abre lightbox.
              Jos 2026-10-12: usamos tarea.archivo (el arte en el momento de
              esa tarea) y NO prueba.archivo, para que al abrir una tarea
              rechazada vieja se vea el arte original rechazado, no el que
              se subio despues en el reenvio. */}
          {(tarea.archivo || prueba.archivo) && (
            <div>
              <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-semibold mb-1.5 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                <FileImage className="h-3 w-3" /> Arte revisado en esta tarea
              </div>
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className={`relative w-full h-64 max-lg:landscape:h-32 rounded-lg overflow-hidden border transition-all group ${isDark ? 'border-zinc-700 bg-zinc-800 hover:border-fuchsia-500/60' : 'border-gray-300 bg-gray-50 hover:border-fuchsia-400'}`}
                title="Click para ver en grande"
              >
                <img
                  src={tarea.archivo || prueba.archivo}
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

          {/* Enlace externo adjunto a la prueba (Drive, Dropbox, etc.) —
              Jos 2026-10-12: puede venir junto con archivo o en lugar de el. */}
          {prueba.enlace_externo && (
            <div>
              <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-semibold mb-1 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                <ExternalLink className="h-3 w-3" /> Link externo del arte
              </div>
              <a
                href={prueba.enlace_externo}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded border transition-colors break-all ${isDark ? 'text-cyan-200 border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20' : 'text-cyan-800 border-cyan-300 bg-cyan-50 hover:bg-cyan-100'}`}
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate max-w-[380px]" title={prueba.enlace_externo}>{prueba.enlace_externo}</span>
              </a>
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
              {(resolucion.archivoAdjunto || resolucion.enlaceAdjunto) && (
                <div className="flex items-center gap-2 flex-wrap pt-1.5">
                  {resolucion.archivoAdjunto && (
                    <a href={resolucion.archivoAdjunto} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded border ${isDark ? 'text-fuchsia-200 border-fuchsia-500/40 bg-fuchsia-500/10 hover:bg-fuchsia-500/20' : 'text-fuchsia-800 border-fuchsia-300 bg-fuchsia-50 hover:bg-fuchsia-100'}`}>
                      <FileImage className="h-3 w-3" /> Ver archivo adjunto
                    </a>
                  )}
                  {resolucion.enlaceAdjunto && (
                    <a href={resolucion.enlaceAdjunto} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded border ${isDark ? 'text-cyan-200 border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20' : 'text-cyan-800 border-cyan-300 bg-cyan-50 hover:bg-cyan-100'}`}>
                      <ExternalLink className="h-3 w-3" /> Abrir link adjunto
                    </a>
                  )}
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

          {/* Aviso: la tarea rechazada ya se reenvio y no se puede volver a editar.
              Jos 2026-10-12.
              Caso A: la prueba paso a otro estatus (ej. 'revision_artes') tras reenvio.
              Caso B: la prueba volvio a 'rechazada' pero esta tarea es un rechazo
              viejo, no el actual (existe una tarea de Revision mas reciente). */}
          {esRechazada && esRevision && !esUltimaRevision && (
            <div className={`rounded-lg border px-3 py-2.5 text-xs flex items-start gap-2 ${isDark ? 'bg-amber-500/10 border-amber-500/40 text-amber-100' : 'bg-amber-50 border-amber-300 text-amber-800'}`}>
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                Este rechazo ya fue atendido en un reenvío posterior. No se puede volver a editar — se conserva como registro histórico.
              </div>
            </div>
          )}
          {esRechazada && esRevision && esUltimaRevision && prueba.estatus !== 'rechazada' && (
            <div className={`rounded-lg border px-3 py-2.5 text-xs flex items-start gap-2 ${isDark ? 'bg-amber-500/10 border-amber-500/40 text-amber-100' : 'bg-amber-50 border-amber-300 text-amber-800'}`}>
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                Esta prueba ya fue reenviada después del rechazo (actualmente está en <b>{ESTATUS_LABEL[prueba.estatus]}</b>). No se puede volver a editar este rechazo.
              </div>
            </div>
          )}

          {/* Formulario inline para reenviar la prueba rechazada — Jos 2026-10-12.
              Sobreescribe la MISMA prueba, no crea una v2 nueva. */}
          {showReenviarForm && puedeReenviar && (
            <div className={`rounded-lg border p-3 space-y-3 ${isDark ? 'bg-fuchsia-500/5 border-fuchsia-500/30' : 'bg-fuchsia-50/50 border-fuchsia-300'}`}>
              <div className={`text-[10px] uppercase tracking-wide font-semibold flex items-center gap-1.5 ${isDark ? 'text-fuchsia-300' : 'text-fuchsia-700'}`}>
                <Upload className="h-3 w-3" /> Reenviar a revisión
              </div>
              <div className={`text-[11px] ${isDark ? 'text-zinc-300' : 'text-gray-600'}`}>
                Sube el arte corregido. Se enviará la MISMA prueba a los mismos revisores (sin crear versión nueva).
              </div>

              <div>
                <label className={`text-[11px] font-semibold ${isDark ? 'text-zinc-200' : 'text-gray-800'}`}>Arte *</label>
                {reenviarFile && reenviarUrl ? (
                  <div className={`mt-1 flex items-center gap-2 text-xs rounded border px-2 py-1.5 ${isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-200' : 'bg-white border-gray-300 text-gray-700'}`}>
                    <FileImage className="h-3.5 w-3.5" />
                    <span className="truncate flex-1">{reenviarFile.name}</span>
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
                {/* Jos 2026-10-12: enlace independiente al archivo, pueden coexistir */}
                <div className={`text-[10px] uppercase tracking-wide font-semibold mt-2 mb-1 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
                  Y / o pega un link (Drive, Dropbox, etc.)
                </div>
                <input
                  type="url"
                  value={reenviarEnlace}
                  onChange={(e) => setReenviarEnlace(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className={`w-full text-xs rounded-md border px-2.5 py-1.5 outline-none ${isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-100 focus:border-fuchsia-500/60' : 'bg-white border-gray-300 text-gray-900 focus:border-fuchsia-400'}`}
                />
                {reenviarEnlace.trim() && !esUrlValido(reenviarEnlace) && (
                  <div className={`text-[11px] mt-1 flex items-center gap-1 ${isDark ? 'text-red-300' : 'text-red-600'}`}>
                    <AlertCircle className="h-3 w-3" /> Debe comenzar con http:// o https://
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

          {/* Jos 2026-10-29: cuando es Seguimiento de RA, mostrar el motivo
              de aprobacion y los adjuntos capturados por el diseñador en el
              modal de aprobacion. Se leen del contenido JSON de la tarea
              (motivoAprobacion / aprobacionArchivo / aprobacionEnlace). */}
          {esSeguimiento && (() => {
            if (!tarea.contenido) return null;
            let data: any = null;
            try { data = JSON.parse(tarea.contenido); } catch { return null; }
            const motivo = data?.motivoAprobacion;
            const archivo = data?.aprobacionArchivo;
            const enlace = data?.aprobacionEnlace;
            if (!motivo && !archivo && !enlace) return null;
            return (
              <div className={`text-xs rounded-md border px-3 py-2 space-y-2 ${isDark ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-100' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-semibold">
                  <CheckCircle2 className="h-3 w-3" /> Motivo de aprobación
                </div>
                {motivo && <div className="whitespace-pre-wrap">{motivo}</div>}
                {(archivo || enlace) && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {archivo && (
                      <a href={archivo} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border ${isDark ? 'border-emerald-500/40 hover:bg-emerald-500/20' : 'border-emerald-300 hover:bg-emerald-100'}`}>
                        <FileImage className="h-3 w-3" /> Archivo
                      </a>
                    )}
                    {enlace && (
                      <a href={enlace} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border ${isDark ? 'border-emerald-500/40 hover:bg-emerald-500/20' : 'border-emerald-300 hover:bg-emerald-100'}`}>
                        <ExternalLink className="h-3 w-3" /> Link
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Jos 2026-11-12: número de impresiones visible en Impresión Y
              Recepción (al crear la Recepción se arrastra el número de la
              Impresión para que Operaciones vea cuántas debe recibir). */}
          {(esImpresion || esRecepcion) && tarea.num_impresiones != null && (
            <div className={`rounded-md px-3 py-2 border flex items-center gap-2 ${isDark ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-100' : 'bg-indigo-50 border-indigo-200 text-indigo-900'}`}>
              <Printer className={`h-4 w-4 ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`} />
              <div className="flex-1">
                <div className={`text-[10px] font-semibold uppercase tracking-wide ${isDark ? 'text-indigo-200' : 'text-indigo-700'}`}>
                  {esRecepcion ? 'Impresiones a recibir' : 'Impresiones solicitadas'}
                </div>
                <div className="text-sm font-semibold">{tarea.num_impresiones}</div>
              </div>
            </div>
          )}
          {esRecepcion && numImpresionesRecibidas != null && (
            <div className={`rounded-md px-3 py-2 border flex items-center gap-2 ${isDark ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-100' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
              <CheckCircle2 className={`h-4 w-4 ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`} />
              <div className="flex-1">
                <div className={`text-[10px] font-semibold uppercase tracking-wide ${isDark ? 'text-emerald-200' : 'text-emerald-700'}`}>
                  Impresiones recibidas
                </div>
                <div className="text-sm font-semibold">{numImpresionesRecibidas}</div>
              </div>
            </div>
          )}

          {/* Jos 2026-11-12: en la tarea Recepción mostramos los datos que
              se capturaron al crearla (fecha estimada + PDF guía) para que
              Operaciones pueda revisar antes de registrar la recepción. */}
          {esRecepcion && (recepcionFechaEstimada || recepcionGuiaPdfUrl) && (
            <div className={`rounded-md px-3 py-2 border ${isDark ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-100' : 'bg-indigo-50 border-indigo-200 text-indigo-900'} space-y-1.5`}>
              <div className={`text-[10px] font-semibold uppercase tracking-wide ${isDark ? 'text-indigo-200' : 'text-indigo-700'}`}>
                Datos de la recepción
              </div>
              {recepcionFechaEstimada && (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className={`${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>Fecha estimada:</span>
                  <span className="font-medium">{new Date(recepcionFechaEstimada).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                </div>
              )}
              {recepcionGuiaPdfUrl && (
                <a
                  href={recepcionGuiaPdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded border ${isDark ? 'border-indigo-400/50 text-indigo-100 bg-indigo-500/15 hover:bg-indigo-500/25' : 'border-indigo-300 text-indigo-800 bg-white hover:bg-indigo-100'}`}
                >
                  <FileImage className="h-3 w-3" /> Ver guía del proveedor (PDF)
                </a>
              )}
            </div>
          )}

          {!yaResuelta && !esRecepcion && (
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
            <div ref={rechazoFormRef} className="space-y-1.5">
              <label className={`text-[11px] font-semibold ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>
                Motivo del rechazo *
              </label>
              <textarea
                value={comentarioRechazo}
                onChange={(e) => setComentarioRechazo(e.target.value)}
                rows={3}
                autoFocus
                placeholder="Describe por qué se rechaza la prueba..."
                className={`w-full text-xs rounded-md border px-2.5 py-1.5 outline-none transition-colors ${isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:border-fuchsia-500/60' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-fuchsia-400'}`}
              />

              {/* Jos 2026-10-12: adjuntos opcionales del rechazo. Pueden ir
                  archivo, link, ambos o ninguno. Se mandan al back y llegan
                  a la notificacion del creador. */}
              <div className="pt-2 space-y-2">
                <div className={`text-[11px] font-semibold ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>
                  Adjuntar (opcional)
                </div>
                {rechazoFile && rechazoFileUrl ? (
                  <div className={`flex items-center gap-2 text-xs rounded border px-2 py-1.5 ${isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-200' : 'bg-white border-gray-300 text-gray-700'}`}>
                    <FileImage className="h-3.5 w-3.5" />
                    <span className="truncate flex-1">{rechazoFile.name}</span>
                    <button
                      type="button"
                      onClick={() => { setRechazoFile(null); setRechazoFileUrl(null); }}
                      className={`text-[10px] font-medium ${isDark ? 'text-fuchsia-300 hover:text-fuchsia-200' : 'text-fuchsia-700 hover:text-fuchsia-900'}`}
                    >
                      Quitar
                    </button>
                  </div>
                ) : (
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadRechazo(f); }}
                    disabled={rechazoFileUploading}
                    className={`w-full text-[11px] file:mr-2 file:py-1 file:px-2 file:rounded file:border file:text-[11px] file:font-medium ${isDark ? 'text-zinc-300 file:bg-zinc-800 file:border-zinc-700 file:text-zinc-200' : 'text-gray-700 file:bg-white file:border-gray-300 file:text-gray-700'}`}
                  />
                )}
                {rechazoFileUploading && (
                  <div className={`flex items-center gap-1.5 text-[10px] ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                    <Loader2 className="h-3 w-3 animate-spin" /> Subiendo archivo...
                  </div>
                )}
                <input
                  type="url"
                  value={rechazoEnlace}
                  onChange={(e) => setRechazoEnlace(e.target.value)}
                  placeholder="O pega un link (Drive, Dropbox, etc.)"
                  className={`w-full text-xs rounded-md border px-2.5 py-1.5 outline-none ${isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-100 focus:border-fuchsia-500/60' : 'bg-white border-gray-300 text-gray-900 focus:border-fuchsia-400'}`}
                />
                {rechazoEnlace.trim() && !esUrlValido(rechazoEnlace) && (
                  <div className={`text-[11px] flex items-center gap-1 ${isDark ? 'text-red-300' : 'text-red-600'}`}>
                    <AlertCircle className="h-3 w-3" /> Debe comenzar con http:// o https://
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Jos 2026-10-29: formulario de aprobacion para RA (mismo patron
              que el rechazo pero en verde). En PC no se usa — ahi aprobar
              sigue siendo click directo sin modal. */}
          {showAprobacionInput && (
            <div className="space-y-1.5">
              <label className={`text-[11px] font-semibold ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>
                Motivo de aprobación *
              </label>
              <textarea
                value={comentarioAprobacion}
                onChange={(e) => setComentarioAprobacion(e.target.value)}
                rows={3}
                autoFocus
                placeholder="Describe la aprobación de la revisión anticipada..."
                className={`w-full text-xs rounded-md border px-2.5 py-1.5 outline-none transition-colors ${isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:border-emerald-500/60' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-emerald-400'}`}
              />
              <div className="pt-2 space-y-2">
                <div className={`text-[11px] font-semibold ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>
                  Adjuntar (opcional)
                </div>
                {aprobacionFile && aprobacionFileUrl ? (
                  <div className={`flex items-center gap-2 text-xs rounded border px-2 py-1.5 ${isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-200' : 'bg-white border-gray-300 text-gray-700'}`}>
                    <FileImage className="h-3.5 w-3.5" />
                    <span className="truncate flex-1">{aprobacionFile.name}</span>
                    <button
                      type="button"
                      onClick={() => { setAprobacionFile(null); setAprobacionFileUrl(null); }}
                      className={`text-[10px] font-medium ${isDark ? 'text-emerald-300 hover:text-emerald-200' : 'text-emerald-700 hover:text-emerald-900'}`}
                    >
                      Quitar
                    </button>
                  </div>
                ) : (
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadAprobacion(f); }}
                    disabled={aprobacionFileUploading}
                    className={`w-full text-[11px] file:mr-2 file:py-1 file:px-2 file:rounded file:border file:text-[11px] file:font-medium ${isDark ? 'text-zinc-300 file:bg-zinc-800 file:border-zinc-700 file:text-zinc-200' : 'text-gray-700 file:bg-white file:border-gray-300 file:text-gray-700'}`}
                  />
                )}
                {aprobacionFileUploading && (
                  <div className={`flex items-center gap-1.5 text-[10px] ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                    <Loader2 className="h-3 w-3 animate-spin" /> Subiendo archivo...
                  </div>
                )}
                <input
                  type="url"
                  value={aprobacionEnlace}
                  onChange={(e) => setAprobacionEnlace(e.target.value)}
                  placeholder="O pega un link (Drive, Dropbox, etc.)"
                  className={`w-full text-xs rounded-md border px-2.5 py-1.5 outline-none ${isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-100 focus:border-emerald-500/60' : 'bg-white border-gray-300 text-gray-900 focus:border-emerald-400'}`}
                />
                {aprobacionEnlace.trim() && !esUrlValido(aprobacionEnlace) && (
                  <div className={`text-[11px] flex items-center gap-1 ${isDark ? 'text-red-300' : 'text-red-600'}`}>
                    <AlertCircle className="h-3 w-3" /> Debe comenzar con http:// o https://
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer con acciones */}
        <div className={`shrink-0 px-5 py-3 max-lg:landscape:py-2 max-lg:landscape:px-3 flex flex-wrap items-center justify-end gap-2 border-t ${isDark ? 'border-zinc-800 bg-zinc-900/60' : 'border-gray-200 bg-gray-50/60'}`}>
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
                    disabled={reenviarMutation.isPending || reenviarUploading || (!reenviarUrl && !reenviarEnlace.trim())}
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
                  {/* Jos 2026-11-12: Descargar arte visible en el detalle de
                      la tarea Impresión (activa/finalizada) para reenviarlo
                      al proveedor en cualquier momento. */}
                  {esImpresion && (prueba.archivo || prueba.enlace_externo) && (
                    <a
                      href={prueba.archivo || prueba.enlace_externo || '#'}
                      target="_blank"
                      rel="noreferrer"
                      download={prueba.archivo ? (prueba.nombre_arte || `arte-prueba-${prueba.id}`) : undefined}
                      className={`text-xs font-semibold px-4 py-2 rounded border transition-colors inline-flex items-center gap-1 ${isDark ? 'border-emerald-500/60 text-emerald-100 bg-emerald-500/20 hover:bg-emerald-500/30' : 'border-emerald-400 text-emerald-800 bg-emerald-50 hover:bg-emerald-100'}`}
                    >
                      <Download className="h-3.5 w-3.5" /> Descargar arte
                    </a>
                  )}
                  {/* Jos 2026-11-12: Crear tarea Recepción desde aquí (como
                      en Gestor de Artes). PDF guía opcional, asignado hereda
                      de la tarea Impresión. Se oculta si ya existe Recepción. */}
                  {esImpresion && !yaTieneRecepcion && prueba.campania_id && (
                    <button
                      onClick={() => setShowRecepcion(true)}
                      disabled={isSaving}
                      className={`text-xs font-semibold px-4 py-2 rounded border transition-colors inline-flex items-center gap-1 ${isDark ? 'border-indigo-500/60 text-indigo-100 bg-indigo-500/20 hover:bg-indigo-500/30' : 'border-indigo-400 text-indigo-800 bg-indigo-50 hover:bg-indigo-100'} disabled:opacity-50`}
                    >
                      <ClipboardList className="h-3.5 w-3.5" /> Crear recepción
                    </button>
                  )}
                  {puedeReenviar && (
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
                onClick={() => {
                  const motivoLimpio = comentarioRechazo.trim();
                  if (!motivoLimpio) {
                    alert('El motivo del rechazo es obligatorio');
                    return;
                  }
                  const enlaceLimpio = rechazoEnlace.trim();
                  if (enlaceLimpio && !esUrlValido(enlaceLimpio)) {
                    alert('El link no es válido. Debe comenzar con http:// o https://');
                    return;
                  }
                  onRechazar(motivoLimpio, {
                    archivo_adjunto: rechazoFileUrl || null,
                    enlace_adjunto: enlaceLimpio || null,
                  });
                }}
                disabled={isSaving || rechazoFileUploading || !comentarioRechazo.trim()}
                className={`text-xs font-semibold px-3 py-1.5 rounded border transition-colors inline-flex items-center gap-1 ${isDark ? 'border-red-500/60 text-red-100 bg-red-500/20 hover:bg-red-500/30' : 'border-red-400 text-red-800 bg-red-50 hover:bg-red-100'} disabled:opacity-50`}
              >
                {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                Confirmar rechazo
              </button>
            </>
          ) : showAprobacionInput ? (
            <>
              <button
                onClick={() => { setShowAprobacionInput(false); setComentarioAprobacion(''); }}
                disabled={isSaving}
                className={`text-xs font-medium px-3 py-1.5 rounded border transition-colors ${isDark ? 'border-zinc-700 text-zinc-300 hover:bg-zinc-800' : 'border-gray-300 text-gray-700 hover:bg-gray-100'} disabled:opacity-50`}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const motivoLimpio = comentarioAprobacion.trim();
                  if (!motivoLimpio) {
                    alert('El motivo de aprobación es obligatorio');
                    return;
                  }
                  const enlaceLimpio = aprobacionEnlace.trim();
                  if (enlaceLimpio && !esUrlValido(enlaceLimpio)) {
                    alert('El link no es válido. Debe comenzar con http:// o https://');
                    return;
                  }
                  onAprobar({
                    comentario: motivoLimpio,
                    archivo_adjunto: aprobacionFileUrl || null,
                    enlace_adjunto: enlaceLimpio || null,
                  });
                }}
                disabled={isSaving || aprobacionFileUploading || !comentarioAprobacion.trim()}
                className={`text-xs font-semibold px-3 py-1.5 rounded border transition-colors inline-flex items-center gap-1 ${isDark ? 'border-emerald-500/60 text-emerald-100 bg-emerald-500/20 hover:bg-emerald-500/30' : 'border-emerald-400 text-emerald-800 bg-emerald-50 hover:bg-emerald-100'} disabled:opacity-50`}
              >
                {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                Confirmar aprobación
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
              {esRevision && puedeRevisar && (
                <>
                  <button
                    onClick={() => setShowRechazoInput(true)}
                    disabled={isSaving}
                    className={`text-xs font-semibold px-3 py-1.5 rounded border transition-colors inline-flex items-center gap-1 ${isDark ? 'border-red-500/50 text-red-200 bg-red-500/10 hover:bg-red-500/20' : 'border-red-400 text-red-800 bg-red-50 hover:bg-red-100'} disabled:opacity-50`}
                  >
                    <XCircle className="h-3 w-3" /> Rechazar
                  </button>
                  <button
                    onClick={() => setShowAprobacionInput(true)}
                    disabled={isSaving}
                    className={`text-xs font-semibold px-3 py-1.5 rounded border transition-colors inline-flex items-center gap-1 ${isDark ? 'border-emerald-500/60 text-emerald-100 bg-emerald-500/20 hover:bg-emerald-500/30' : 'border-emerald-400 text-emerald-800 bg-emerald-50 hover:bg-emerald-100'} disabled:opacity-50`}
                  >
                    {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                    Aprobar
                  </button>
                </>
              )}
              {esSeguimiento && puedeCrear && (
                <>
                  {/* Jos 2026-11-12: Pedido de impresion SOLO aplica al flujo de
                      Prueba de Color (no en Revision Anticipada; RA no imprime).
                      Ademas requiere que la prueba ya este vinculada a campania
                      (POST /campanas/:id/tareas exige campania_id). */}
                  {!esRevisionAnticipada && (
                    <button
                      onClick={() => setShowPedidoImpresion(true)}
                      disabled={isSaving || !prueba.campania_id || yaTieneImpresion}
                      title={
                        !prueba.campania_id
                          ? 'Disponible cuando la propuesta se apruebe como campaña'
                          : yaTieneImpresion
                            ? 'Ya se generó un pedido de impresión para esta prueba. No puedes crear otro.'
                            : 'Crear pedido de impresión al proveedor'
                      }
                      className={`text-xs font-semibold px-3 py-1.5 rounded border transition-colors inline-flex items-center gap-1 ${isDark ? 'border-indigo-500/60 text-indigo-100 bg-indigo-500/20 hover:bg-indigo-500/30' : 'border-indigo-400 text-indigo-800 bg-indigo-50 hover:bg-indigo-100'} disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <Printer className="h-3 w-3" /> {yaTieneImpresion ? 'Pedido de impresión ya enviado' : 'Pedido de impresión'}
                    </button>
                  )}
                  {/* Jos 2026-11-12: se quitó el botón "Finalizar" del
                      Seguimiento porque el seguimiento se da por cerrado
                      cuando se crea el Pedido de impresión; mantener el
                      botón confundía a los usuarios. */}
                  {/* Jos 2026-11-13: en Revisión Anticipada NO hay Pedido
                      de impresión, así que el único camino para cerrar el
                      seguimiento es un botón explícito "Finalizar". */}
                  {esRevisionAnticipada && !yaResuelta && (
                    <button
                      onClick={onFinalizar}
                      disabled={isSaving}
                      className={`text-xs font-semibold px-3 py-1.5 rounded border transition-colors inline-flex items-center gap-1 ${isDark ? 'border-emerald-500/60 text-emerald-100 bg-emerald-500/20 hover:bg-emerald-500/30' : 'border-emerald-400 text-emerald-800 bg-emerald-50 hover:bg-emerald-100'} disabled:opacity-50`}
                    >
                      {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                      Finalizar
                    </button>
                  )}
                </>
              )}
              {/* Jos 2026-11-12: botón único para la tarea Recepción =
                  "Marcar como recibida" (finaliza la tarea). Reemplaza al
                  genérico Aprobar/Finalizar porque Operaciones solo necesita
                  confirmar que llegó la impresión. */}
              {esRecepcion && !yaResuelta && (
                <button
                  onClick={() => setShowConfirmarRecibidas(true)}
                  disabled={isSaving || recibiendoRecepcion}
                  className={`text-xs font-semibold px-3 py-1.5 rounded border transition-colors inline-flex items-center gap-1 ${isDark ? 'border-emerald-500/60 text-emerald-100 bg-emerald-500/20 hover:bg-emerald-500/30' : 'border-emerald-400 text-emerald-800 bg-emerald-50 hover:bg-emerald-100'} disabled:opacity-50`}
                >
                  {recibiendoRecepcion ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                  Marcar como recibida
                </button>
              )}
              {/* Jos 2026-11-12: en el detalle de la tarea Impresión mostramos
                  botón para descargar el arte (que el usuario ya vio en el
                  submodal de crear pedido, pero también lo quiere acá para
                  reenviárselo al proveedor en cualquier momento). */}
              {esImpresion && (prueba.archivo || prueba.enlace_externo) && (
                <a
                  href={prueba.archivo || prueba.enlace_externo || '#'}
                  target="_blank"
                  rel="noreferrer"
                  download={prueba.archivo ? (prueba.nombre_arte || `arte-prueba-${prueba.id}`) : undefined}
                  className={`text-xs font-semibold px-3 py-1.5 rounded border transition-colors inline-flex items-center gap-1 ${isDark ? 'border-emerald-500/60 text-emerald-100 bg-emerald-500/20 hover:bg-emerald-500/30' : 'border-emerald-400 text-emerald-800 bg-emerald-50 hover:bg-emerald-100'}`}
                >
                  <Download className="h-3 w-3" /> Descargar arte
                </a>
              )}
            </>
          )}
        </div>
      </div>

      {/* Lightbox del arte — overlay por encima de todo (z-[90]) */}
      {lightboxOpen && (tarea.archivo || prueba.archivo) && (
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
            href={tarea.archivo || prueba.archivo}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 text-white text-xs font-medium hover:bg-black/80 transition-colors z-10"
            title="Abrir original en pestaña nueva"
          >
            <FileImage className="h-3.5 w-3.5" /> Abrir original
          </a>
          <img
            src={tarea.archivo || prueba.archivo}
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

      {/* Jos 2026-10-29: sub-modal pedido de impresion desde la tarea
          Seguimiento. Captura num_impresiones y crea tarea tipo 'Impresión'
          en la campania asociada via POST /campanas/:id/tareas. */}
      {showRecepcion && prueba.campania_id && (
        <RecepcionSubmodal
          tareaImpresion={tarea}
          prueba={prueba}
          cara={cara}
          isDark={isDark}
          onClose={() => setShowRecepcion(false)}
          onCreated={() => { setShowRecepcion(false); onClose(); }}
        />
      )}
      {showPedidoImpresion && prueba.campania_id && (
        <PedidoImpresionSubmodal
          prueba={prueba}
          cara={cara}
          tareaSeguimientoId={esSeguimiento ? tarea.id : null}
          isDark={isDark}
          onClose={() => setShowPedidoImpresion(false)}
          onCreated={() => { setShowPedidoImpresion(false); onClose(); }}
        />
      )}
      {showConfirmarRecibidas && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60"
          onClick={() => !recibiendoRecepcion && setShowConfirmarRecibidas(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm rounded-lg border shadow-xl ${isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-100' : 'bg-white border-gray-200 text-gray-900'}`}
          >
            <div className="p-4 border-b border-current/10">
              <h3 className="text-sm font-semibold">Confirmar recepción</h3>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                Registra cuántas impresiones llegaron. Se guarda al finalizar la tarea.
              </p>
            </div>
            <div className="p-4 space-y-3">
              {tarea.num_impresiones != null && (
                <div className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                  Solicitadas: <span className="font-semibold">{tarea.num_impresiones}</span>
                </div>
              )}
              <label className="block">
                <span className="text-xs font-medium">Impresiones recibidas</span>
                <input
                  type="number"
                  min={0}
                  value={cantidadRecibidasInput}
                  onChange={(e) => setCantidadRecibidasInput(e.target.value)}
                  disabled={recibiendoRecepcion}
                  autoFocus
                  className={`mt-1 w-full px-3 py-2 rounded border text-sm ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-gray-300'} focus:outline-none focus:ring-2 focus:ring-emerald-500/50`}
                />
              </label>
            </div>
            <div className="p-3 border-t border-current/10 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={recibiendoRecepcion}
                onClick={() => setShowConfirmarRecibidas(false)}
                className={`text-xs font-semibold px-3 py-1.5 rounded border ${isDark ? 'border-zinc-700 text-zinc-200 hover:bg-zinc-800' : 'border-gray-300 text-gray-700 hover:bg-gray-50'} disabled:opacity-50`}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={recibiendoRecepcion || cantidadRecibidasInput.trim() === '' || Number.isNaN(Number(cantidadRecibidasInput)) || Number(cantidadRecibidasInput) < 0}
                onClick={async () => {
                  const cantidad = Number(cantidadRecibidasInput);
                  await handleMarcarRecibida(cantidad);
                  setShowConfirmarRecibidas(false);
                }}
                className={`text-xs font-semibold px-3 py-1.5 rounded border inline-flex items-center gap-1 ${isDark ? 'border-emerald-500/60 text-emerald-100 bg-emerald-500/20 hover:bg-emerald-500/30' : 'border-emerald-400 text-emerald-800 bg-emerald-50 hover:bg-emerald-100'} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {recibiendoRecepcion ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                Confirmar recepción
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-modal: pedido de impresión desde Seguimiento ──────────────────
// Crea una tarea tipo 'Impresión' en la campaña con los datos de la prueba
// (arte, circuito, num_impresiones). Reusa POST /campanas/:id/tareas.
function PedidoImpresionSubmodal({
  prueba,
  cara,
  tareaSeguimientoId,
  isDark,
  onClose,
  onCreated,
}: {
  prueba: PruebaColor;
  cara: SolicitudCara | null;
  // Jos 2026-11-12: id de la tarea Seguimiento desde la que se abrió el
  // submodal. Al crear el pedido de impresión la marcamos Atendido para
  // que el seguimiento se cierre automáticamente (Akary: "la de seguimiento
  // que se marque como atendida después de crear la tarea de impresión").
  tareaSeguimientoId: number | null;
  isDark: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const queryClient = useQueryClient();
  const [numImpresiones, setNumImpresiones] = useState<number>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleCrear = async () => {
    const campaniaId = prueba.campania_id;
    if (!campaniaId) { setError('La prueba no está vinculada a una campaña'); return; }
    if (!numImpresiones || numImpresiones < 1) { setError('Captura al menos 1 impresión'); return; }
    setSaving(true);
    setError(null);
    try {
      const circuitoId = cara?.id || prueba.sc_id;
      const titulo = `Pedido de impresión - ${prueba.nombre_arte || `Prueba #${prueba.id}`}`;
      const descripcion = `Pedido de impresión generado desde Seguimiento Prueba de color #${prueba.id}.${prueba.nombre_arte ? ` Arte: ${prueba.nombre_arte}.` : ''}${cara?.articulo ? ` Circuito: ${cara.articulo}.` : ''}`;
      await campanasService.createTarea(campaniaId, {
        titulo,
        descripcion,
        tipo: 'Impresión',
        num_impresiones: numImpresiones,
        ids_reservas: circuitoId ? String(circuitoId) : undefined,
        evidencia: prueba.archivo || undefined,
        // Jos 2026-11-12: guardar pruebaColorId en contenido para que
        // listarTareasAsociadas pueda regresar esta tarea en el drawer
        // "TAREAS DE LA PRUEBA" (el filtro del back matchea por contenido.pruebaColorId).
        contenido: JSON.stringify({ pruebaColorId: prueba.id }),
      });
      // Jos 2026-11-12: la tarea Seguimiento ya cumplió su función (el
      // asesor confirmó que el cliente aprobó y mandamos a imprimir), la
      // cerramos automáticamente. Es tolerante al fallo porque el usuario
      // puede cerrarla a mano después si algo truena.
      if (tareaSeguimientoId) {
        try {
          await campanasService.updateTarea(campaniaId, tareaSeguimientoId, {
            estatus: 'Atendido',
          });
        } catch (e) {
          console.error('No se pudo marcar la tarea Seguimiento como Atendido:', e);
        }
      }
      // Jos 2026-11-12: tras crear el pedido, refrescar las listas de tareas
      // para que la tarea nueva (tipo 'Impresion') aparezca sin recargar.
      // Antes del fix el submodal cerraba pero nada se veia -> "no sucede nada".
      queryClient.invalidateQueries({ queryKey: ['tareas-campana', campaniaId] });
      queryClient.invalidateQueries({ queryKey: ['campanas', campaniaId, 'tareas'] });
      queryClient.invalidateQueries({ queryKey: ['pruebas-color', 'tareas', prueba.id] });
      queryClient.invalidateQueries({ queryKey: ['pruebas-color', 'propuesta', prueba.propuesta_id] });
      queryClient.invalidateQueries({ queryKey: ['pruebas-color'] });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear pedido de impresión');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/70"
      onClick={(e) => { e.stopPropagation(); onClose(); }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-sm rounded-xl shadow-2xl border overflow-hidden ${isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200'}`}
      >
        <div className={`px-4 py-3 border-b flex items-center justify-between ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
          <div className="flex items-center gap-2">
            <Printer className={`h-4 w-4 ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`} />
            <div>
              <div className={`text-sm font-semibold ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>Crear pedido de impresión</div>
              <div className={`text-[10px] ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Campaña #{prueba.campania_id}</div>
            </div>
          </div>
          <button onClick={onClose} className={`p-1 rounded ${isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-gray-100 text-gray-500'}`}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-4 py-3 space-y-3">
          <div className={`text-[11px] rounded px-2 py-1.5 ${isDark ? 'bg-zinc-800/60 text-zinc-300 border border-zinc-700' : 'bg-gray-50 text-gray-600 border border-gray-200'}`}>
            {prueba.nombre_arte || `Prueba #${prueba.id}`}{cara?.articulo ? ` · ${cara.articulo}` : ''}
          </div>
          {/* Jos 2026-11-12: botón para descargar el arte y mandarselo al
              proveedor desde este mismo submodal. Abre en nueva pestaña con
              download attr; si solo hay enlace externo (sin archivo subido),
              abre el enlace tal cual. */}
          {(prueba.archivo || prueba.enlace_externo) && (
            <a
              href={prueba.archivo || prueba.enlace_externo || '#'}
              target="_blank"
              rel="noreferrer"
              download={prueba.archivo ? (prueba.nombre_arte || `arte-prueba-${prueba.id}`) : undefined}
              className={`w-full text-xs font-semibold px-3 py-1.5 rounded border transition-colors inline-flex items-center justify-center gap-1.5 ${isDark ? 'border-emerald-500/60 text-emerald-100 bg-emerald-500/15 hover:bg-emerald-500/25' : 'border-emerald-400 text-emerald-800 bg-emerald-50 hover:bg-emerald-100'}`}
            >
              <Download className="h-3.5 w-3.5" /> Descargar arte
            </a>
          )}
          <div>
            <label className={`text-[11px] font-semibold ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}># de impresiones *</label>
            <input
              type="number"
              min={1}
              value={numImpresiones}
              onChange={(e) => setNumImpresiones(Math.max(1, parseInt(e.target.value) || 1))}
              className={`mt-1 w-full text-sm rounded-md border px-2.5 py-1.5 outline-none ${isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-100 focus:border-indigo-500/60' : 'bg-white border-gray-300 text-gray-900 focus:border-indigo-400'}`}
            />
          </div>
          {error && (
            <div className={`text-[11px] px-2 py-1 rounded ${isDark ? 'bg-red-500/15 text-red-200 border border-red-500/30' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {error}
            </div>
          )}
        </div>
        <div className={`px-4 py-3 border-t flex items-center justify-end gap-2 ${isDark ? 'border-zinc-800 bg-zinc-900/60' : 'border-gray-200 bg-gray-50/60'}`}>
          <button
            onClick={onClose}
            disabled={saving}
            className={`text-xs font-medium px-3 py-1.5 rounded border transition-colors ${isDark ? 'border-zinc-700 text-zinc-300 hover:bg-zinc-800' : 'border-gray-300 text-gray-700 hover:bg-gray-100'} disabled:opacity-50`}
          >
            Cancelar
          </button>
          <button
            onClick={handleCrear}
            disabled={saving}
            className={`text-xs font-semibold px-3 py-1.5 rounded border transition-colors inline-flex items-center gap-1 ${isDark ? 'border-indigo-500/60 text-indigo-100 bg-indigo-500/20 hover:bg-indigo-500/30' : 'border-indigo-400 text-indigo-800 bg-indigo-50 hover:bg-indigo-100'} disabled:opacity-50`}
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Printer className="h-3 w-3" />}
            Crear pedido
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-modal: crear recepción desde una tarea Impresión ──────────────
// Jos 2026-11-12: cuando ya se mandó a impresión y el proveedor va a
// entregar las impresiones, desde la tarea Impresión del drawer de Pruebas
// de Color se puede crear una tarea tipo Recepción (el asignado es el mismo
// que la Impresión, no se pregunta de nuevo). Se puede adjuntar PDF de guía
// del proveedor como evidencia.
function RecepcionSubmodal({
  tareaImpresion,
  prueba,
  cara,
  isDark,
  onClose,
  onCreated,
}: {
  tareaImpresion: TareaAsociadaPruebaColor;
  prueba: PruebaColor;
  cara: SolicitudCara | null;
  isDark: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const queryClient = useQueryClient();
  const [guiaPdfFile, setGuiaPdfFile] = useState<File | null>(null);
  const [guiaPdfUrl, setGuiaPdfUrl] = useState<string | null>(null);
  const [guiaUploading, setGuiaUploading] = useState(false);
  const [fechaRecepcion, setFechaRecepcion] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUploadGuia = async (file: File) => {
    setGuiaUploading(true);
    setError(null);
    try {
      const res = await campanasService.uploadTestigoFile(file);
      setGuiaPdfFile(file);
      setGuiaPdfUrl(res.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir el PDF');
      setGuiaPdfFile(null);
      setGuiaPdfUrl(null);
    } finally {
      setGuiaUploading(false);
    }
  };

  const handleCrear = async () => {
    const campaniaId = prueba.campania_id;
    if (!campaniaId) { setError('La prueba no está vinculada a una campaña'); return; }
    setSaving(true);
    setError(null);
    try {
      // 1. Marcar la tarea Impresión como Atendido (ya cumplió su propósito,
      //    la Recepción toma el relevo del seguimiento).
      await campanasService.updateTarea(campaniaId, tareaImpresion.id, {
        estatus: 'Atendido',
      });

      // 2. Crear tarea Recepción. Asignado = mismo que la Impresión (feedback
      //    Jos 2026-11-12: "que se siga asignando a la misma persona").
      const circuitoId = cara?.id || prueba.sc_id;
      const tituloRecep = `Recepción - ${prueba.nombre_arte || `Prueba #${prueba.id}`}`;
      const descripcionRecep = `Recepción de impresiones del pedido "${tareaImpresion.titulo || `Impresión #${tareaImpresion.id}`}".${prueba.nombre_arte ? ` Arte: ${prueba.nombre_arte}.` : ''}${cara?.articulo ? ` Circuito: ${cara.articulo}.` : ''} Por favor registra la cantidad recibida.`;
      // Evidencia tipo recepcion_normal + referencia al PDF guía si existe
      // (misma convención que usa TareaSeguimientoPage/CampanaDetailPage).
      const evidenciaObj: Record<string, unknown> = { tipo: 'recepcion_normal' };
      if (guiaPdfUrl) evidenciaObj.guia_pdf = guiaPdfUrl;
      await campanasService.createTarea(campaniaId, {
        titulo: tituloRecep,
        descripcion: descripcionRecep,
        tipo: 'Recepción',
        asignado: tareaImpresion.asignado || undefined,
        ids_reservas: circuitoId ? String(circuitoId) : undefined,
        evidencia: JSON.stringify(evidenciaObj),
        contenido: JSON.stringify({ pruebaColorId: prueba.id }),
        fecha_fin: fechaRecepcion || undefined,
        // Jos 2026-11-12: arrastrar el num_impresiones de la tarea Impresión
        // a la Recepción para que Operaciones vea cuántas debe recibir.
        num_impresiones: tareaImpresion.num_impresiones || undefined,
      });

      // 3. Refrescar las vistas que dependen de la lista de tareas.
      queryClient.invalidateQueries({ queryKey: ['tareas-campana', campaniaId] });
      queryClient.invalidateQueries({ queryKey: ['campanas', campaniaId, 'tareas'] });
      queryClient.invalidateQueries({ queryKey: ['pruebas-color', 'tareas', prueba.id] });
      queryClient.invalidateQueries({ queryKey: ['pruebas-color', 'propuesta', prueba.propuesta_id] });
      queryClient.invalidateQueries({ queryKey: ['pruebas-color'] });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear tarea de recepción');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/70"
      onClick={(e) => { e.stopPropagation(); onClose(); }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-sm rounded-xl shadow-2xl border overflow-hidden ${isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200'}`}
      >
        <div className={`px-4 py-3 border-b flex items-center justify-between ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
          <div className="flex items-center gap-2">
            <ClipboardList className={`h-4 w-4 ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`} />
            <div>
              <div className={`text-sm font-semibold ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>Crear tarea de recepción</div>
              <div className={`text-[10px] ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                {tareaImpresion.asignado ? `Asignada a ${tareaImpresion.asignado}` : 'Sin asignado'}
              </div>
            </div>
          </div>
          <button onClick={onClose} className={`p-1 rounded ${isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-gray-100 text-gray-500'}`}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-4 py-3 space-y-3">
          <div className={`text-[11px] rounded px-2 py-1.5 ${isDark ? 'bg-zinc-800/60 text-zinc-300 border border-zinc-700' : 'bg-gray-50 text-gray-600 border border-gray-200'}`}>
            {prueba.nombre_arte || `Prueba #${prueba.id}`}{cara?.articulo ? ` · ${cara.articulo}` : ''}
          </div>
          <div>
            <label className={`text-[11px] font-semibold ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>Fecha estimada de recepción</label>
            <input
              type="date"
              value={fechaRecepcion}
              onChange={(e) => setFechaRecepcion(e.target.value)}
              className={`mt-1 w-full text-sm rounded-md border px-2.5 py-1.5 outline-none ${isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-100 focus:border-indigo-500/60 [color-scheme:dark]' : 'bg-white border-gray-300 text-gray-900 focus:border-indigo-400'}`}
            />
          </div>
          <div>
            <label className={`text-[11px] font-semibold ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>Guía del proveedor (PDF opcional)</label>
            {guiaPdfFile && guiaPdfUrl ? (
              <div className={`mt-1 flex items-center gap-2 text-[11px] px-2 py-1.5 rounded border ${isDark ? 'bg-zinc-800/60 text-zinc-200 border-zinc-700' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                <FileImage className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate flex-1">{guiaPdfFile.name}</span>
                <button
                  onClick={() => { setGuiaPdfFile(null); setGuiaPdfUrl(null); }}
                  className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'hover:bg-zinc-700 text-zinc-300' : 'hover:bg-gray-200 text-gray-600'}`}
                >
                  Quitar
                </button>
              </div>
            ) : (
              <label className={`mt-1 flex items-center gap-2 text-[11px] px-2 py-1.5 rounded border cursor-pointer ${isDark ? 'bg-zinc-800/40 text-zinc-300 border-zinc-700 hover:bg-zinc-800/60' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'} ${guiaUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <Upload className="h-3.5 w-3.5" />
                <span>{guiaUploading ? 'Subiendo PDF...' : 'Seleccionar PDF'}</span>
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  disabled={guiaUploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadGuia(f);
                    e.target.value = '';
                  }}
                />
              </label>
            )}
          </div>
          {error && (
            <div className={`text-[11px] px-2 py-1 rounded ${isDark ? 'bg-red-500/15 text-red-200 border border-red-500/30' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {error}
            </div>
          )}
        </div>
        <div className={`px-4 py-3 border-t flex items-center justify-end gap-2 ${isDark ? 'border-zinc-800 bg-zinc-900/60' : 'border-gray-200 bg-gray-50/60'}`}>
          <button
            onClick={onClose}
            disabled={saving || guiaUploading}
            className={`text-xs font-medium px-3 py-1.5 rounded border transition-colors ${isDark ? 'border-zinc-700 text-zinc-300 hover:bg-zinc-800' : 'border-gray-300 text-gray-700 hover:bg-gray-100'} disabled:opacity-50`}
          >
            Cancelar
          </button>
          <button
            onClick={handleCrear}
            disabled={saving || guiaUploading}
            className={`text-xs font-semibold px-3 py-1.5 rounded border transition-colors inline-flex items-center gap-1 ${isDark ? 'border-indigo-500/60 text-indigo-100 bg-indigo-500/20 hover:bg-indigo-500/30' : 'border-indigo-400 text-indigo-800 bg-indigo-50 hover:bg-indigo-100'} disabled:opacity-50`}
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <ClipboardList className="h-3 w-3" />}
            Crear recepción
          </button>
        </div>
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
    const vw = window.innerWidth;
    const spaceBelow = vh - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    // Preferir abrir hacia abajo. Si abajo hay < 280px y arriba hay mas espacio,
    // abrir hacia arriba.
    const openUp = spaceBelow < 280 && spaceAbove > spaceBelow;
    // Jos 2026-11-10: el Math.max(200, ...) hacia overflow en viewports chicos
    // (celular landscape) porque forzaba 200px aunque solo hubiera 100px libres.
    // Ahora el min(200, espacioDisponible) respeta el viewport real.
    const available = openUp ? spaceAbove : spaceBelow;
    const maxHeight = Math.min(Math.max(160, available), vh - 16);
    // Clamp del width al viewport con 8px de margen a cada lado para que
    // nunca se salga por derecha en mobile.
    const maxPanelWidth = vw - 16;
    const panelWidth = Math.min(rect.width, maxPanelWidth);
    const panelLeft = Math.min(rect.left, vw - panelWidth - 8);
    setPanelStyle({
      position: 'fixed',
      left: Math.max(8, panelLeft),
      width: panelWidth,
      top: openUp ? undefined : rect.bottom + 4,
      bottom: openUp ? vh - rect.top + 4 : undefined,
      maxHeight,
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
              const periodo = formatPeriodo(c.inicio_periodo, c.fin_periodo);
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
                  <span className="min-w-0 flex-1">
                    <span className="truncate block">
                      <span className={`font-medium ${isDark ? 'text-fuchsia-300' : 'text-fuchsia-700'}`}>#{c.id}</span>
                      {' — '}
                      <span>{c.articulo || 'Sin articulo'}</span>
                      <span className={isDark ? 'text-zinc-500' : 'text-gray-500'}> · {c.formato || 'Sin formato'} · {c.ciudad || c.estados || 'Sin ciudad'}</span>
                    </span>
                    {/* Jos 2026-10-23: catorcena visible por circuito. */}
                    {periodo && (
                      <span className={`block mt-0.5 text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
                        Catorcena: {periodo}
                      </span>
                    )}
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

// ─── Modal de atención de tarea de Revisión en BATCH ────────────────────
// Jos 2026-11-24: cuando una tarea de Revisión agrupa N artes (varios artes
// del mismo circuito solicitados en un solo lote), este modal reemplaza al
// AtenderTareaModal individual. Diseño aprueba/rechaza cada arte por
// separado o en masivo; la tarea solo se cierra cuando TODOS están
// resueltos (lo hace el back automáticamente al llegar al último).
function AtenderRevisionBatchModal({
  tarea,
  pruebas,
  isLoadingPruebas,
  cara,
  isDark,
  puedeRevisar,
  onClose,
  onResolverArte,
  isSaving,
}: {
  tarea: TareaAsociadaPruebaColor;
  pruebas: PruebaColor[];
  isLoadingPruebas: boolean;
  cara: SolicitudCara | null;
  isDark: boolean;
  puedeRevisar: boolean;
  onClose: () => void;
  onResolverArte: (
    pruebaIdObjetivo: number,
    accion: 'aprobar' | 'rechazar',
    opts?: { comentario?: string; archivo_adjunto?: string | null; enlace_adjunto?: string | null },
  ) => Promise<void>;
  isSaving: boolean;
}) {
  // Jos 2026-11-27: sub-formulario de "marcado preliminar". El usuario
  // marca cada arte como aprobado/rechazado (con su motivo/reemplazo) en el
  // state local — NO se escribe en BD hasta clickear Finalizar. Así el
  // batch NO queda a medias en la BD (arte aprobado + Seguimiento creada)
  // mientras otros artes siguen pendientes.
  const [resolverForm, setResolverForm] = useState<
    | null
    | {
        modo: 'individual' | 'masivo';
        accion: 'aprobar' | 'rechazar';
        pruebaId?: number;
      }
  >(null);
  const [comentario, setComentario] = useState('');
  const [adjFile, setAdjFile] = useState<File | null>(null);
  const [adjFileUrl, setAdjFileUrl] = useState<string | null>(null);
  const [adjFileUploading, setAdjFileUploading] = useState(false);
  const [adjEnlace, setAdjEnlace] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Marcas locales: pruebaId → { accion, comentario, archivo_adjunto, enlace_adjunto }.
  // Se envían al back al clickear Finalizar.
  type MarcaLocal = {
    accion: 'aprobar' | 'rechazar';
    comentario?: string;
    archivo_adjunto: string | null;
    enlace_adjunto: string | null;
    archivo_adjunto_nombre?: string;
  };
  const [marcasLocales, setMarcasLocales] = useState<Map<number, MarcaLocal>>(new Map());
  const [finalizando, setFinalizando] = useState(false);
  const [finalizarError, setFinalizarError] = useState<string | null>(null);

  const resetForm = () => {
    setResolverForm(null);
    setComentario('');
    setAdjFile(null);
    setAdjFileUrl(null);
    setAdjEnlace('');
    setFormError(null);
  };

  const deshacerMarca = (pruebaId: number) => {
    setMarcasLocales(prev => {
      const next = new Map(prev);
      next.delete(pruebaId);
      return next;
    });
  };

  // Jos 2026-11-27: solo imagen (JPG/PNG) o video (MP4) como reemplazo.
  const TIPOS_REEMPLAZO_PERMITIDOS = ['image/jpeg', 'image/jpg', 'image/png', 'video/mp4'];
  const EXTENSIONES_PERMITIDAS_LABEL = 'JPG, PNG o MP4';
  const esTipoReemplazoPermitido = (file: File) => {
    const tipo = (file.type || '').toLowerCase();
    if (TIPOS_REEMPLAZO_PERMITIDOS.includes(tipo)) return true;
    // Fallback por extensión (algunos navegadores no setean MIME bien).
    const name = file.name.toLowerCase();
    return name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.mp4');
  };

  const handleUploadAdjunto = async (file: File) => {
    try {
      // Jos 2026-11-27: restringir a JPG/PNG/MP4 porque este archivo
      // REEMPLAZA al arte original — solo tiene sentido con imagen o video.
      if (!esTipoReemplazoPermitido(file)) {
        setFormError(`Solo se permite ${EXTENSIONES_PERMITIDAS_LABEL} como reemplazo del arte.`);
        return;
      }
      setAdjFileUploading(true);
      setFormError(null);
      const folder = resolverForm?.accion === 'rechazar' ? 'pruebas-color/rechazos' : 'pruebas-color/aprobaciones';
      const res = await uploadsService.uploadFile(file, folder);
      setAdjFile(file);
      setAdjFileUrl(res.url);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Error al subir archivo');
      setAdjFile(null);
      setAdjFileUrl(null);
    } finally {
      setAdjFileUploading(false);
    }
  };

  // Jos 2026-11-27: el sub-form se renderiza INLINE debajo del arte
  // seleccionado (acordeón) cuando es individual, o al final para masivo.
  // Esto deja claro qué arte se está resolviendo sin modal flotante.
  const renderSubForm = (contexto: 'individual' | 'masivo') => {
    if (!resolverForm || resolverForm.modo !== contexto) return null;
    const esMasivo = contexto === 'masivo';
    const pruebaObjetivo = !esMasivo ? pruebas.find(p => p.id === resolverForm.pruebaId) : null;
    return (
      <div className={`rounded-lg border p-3 space-y-2 ${resolverForm.accion === 'aprobar' ? (isDark ? 'bg-emerald-500/5 border-emerald-500/40' : 'bg-emerald-50 border-emerald-300') : (isDark ? 'bg-red-500/5 border-red-500/40' : 'bg-red-50 border-red-300')}`}>
        <div className={`text-xs font-semibold ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>
          {esMasivo
            ? `${resolverForm.accion === 'aprobar' ? 'Aprobar' : 'Rechazar'} todos los pendientes (${pruebasPendientes.length})`
            : `${resolverForm.accion === 'aprobar' ? 'Aprobar' : 'Rechazar'}: ${pruebaObjetivo?.nombre_arte || `Arte #${pruebaObjetivo?.id || ''}`}`}
        </div>
        <div>
          <label className={`text-[11px] font-medium mb-1 block ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
            Motivo {resolverForm.accion === 'rechazar' ? '*' : '(opcional)'}
          </label>
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            rows={3}
            placeholder={resolverForm.accion === 'rechazar' ? 'Describe el motivo del rechazo' : 'Comentario opcional'}
            className={`w-full text-xs p-2 rounded border resize-y ${isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500' : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400'}`}
          />
        </div>
        {/* Jos 2026-11-27: en masivo NO mostrar reemplazo ni enlace — son N artes
            distintos, un solo archivo/link no aplica a todos. Solo motivo. */}
        {!esMasivo && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={`text-[11px] font-medium mb-1 block ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
                {/* Jos 2026-11-27: "reemplazar" (no "adjuntar") — el archivo que
                    subas SUSTITUYE al arte original en biblioteca. */}
                Reemplazar arte ({EXTENSIONES_PERMITIDAS_LABEL}, opcional)
              </label>
              <input
                type="file"
                accept="image/jpeg,image/png,video/mp4,.jpg,.jpeg,.png,.mp4"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  if (f) handleUploadAdjunto(f);
                }}
                disabled={adjFileUploading}
                className={`block w-full text-[11px] ${isDark ? 'text-zinc-300' : 'text-gray-700'} file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[11px] file:font-medium ${isDark ? 'file:bg-zinc-700 file:text-zinc-100' : 'file:bg-gray-200 file:text-gray-800'}`}
              />
              {adjFileUploading && <Loader2 className="h-3 w-3 animate-spin mt-1" />}
              {adjFile && !adjFileUploading && <div className={`text-[10px] mt-0.5 truncate ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{adjFile.name}</div>}
            </div>
            <div>
              <label className={`text-[11px] font-medium mb-1 block ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>Enlace</label>
              <input
                type="url"
                value={adjEnlace}
                onChange={(e) => setAdjEnlace(e.target.value)}
                placeholder="https://..."
                className={`w-full text-xs p-1.5 rounded border ${isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500' : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400'}`}
              />
            </div>
          </div>
        )}
        {formError && (
          <div className={`text-[11px] px-2 py-1 rounded ${isDark ? 'bg-red-500/15 text-red-200 border border-red-500/30' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {formError}
          </div>
        )}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={resetForm}
            disabled={isSaving}
            className={`text-xs font-medium px-3 py-1.5 rounded border ${isDark ? 'border-zinc-700 text-zinc-300 hover:bg-zinc-800' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}
          >
            Cancelar
          </button>
          <button
            onClick={confirmarResolucion}
            disabled={isSaving || adjFileUploading}
            className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded border transition-colors ${resolverForm.accion === 'aprobar' ? (isDark ? 'border-emerald-500/60 text-emerald-100 bg-emerald-500/20 hover:bg-emerald-500/30' : 'border-emerald-400 text-emerald-800 bg-emerald-50 hover:bg-emerald-100') : (isDark ? 'border-red-500/60 text-red-100 bg-red-500/20 hover:bg-red-500/30' : 'border-red-400 text-red-800 bg-red-50 hover:bg-red-100')} disabled:opacity-50`}
          >
            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : resolverForm.accion === 'aprobar' ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
            Confirmar {resolverForm.accion === 'aprobar' ? 'aprobación' : 'rechazo'}
          </button>
        </div>
      </div>
    );
  };

  const pruebasPendientes = useMemo(
    () => pruebas.filter(p => p.estatus === 'revision_artes' || p.estatus === 'solicitada'),
    [pruebas],
  );
  const pruebasAprobadas = useMemo(() => pruebas.filter(p => p.estatus === 'arte_aprobado' || p.estatus === 'aprobada'), [pruebas]);
  const pruebasRechazadas = useMemo(() => pruebas.filter(p => p.estatus === 'rechazada'), [pruebas]);

  // Jos 2026-11-27: confirmar en el sub-form ahora solo MARCA LOCALMENTE.
  // Nada se escribe en BD aqui — la escritura ocurre al Finalizar.
  const confirmarResolucion = () => {
    if (!resolverForm) return;
    const comentarioTrim = comentario.trim();
    if (resolverForm.accion === 'rechazar' && !comentarioTrim) {
      setFormError('El motivo del rechazo es obligatorio');
      return;
    }
    const enlaceTrim = adjEnlace.trim();
    if (enlaceTrim && !esUrlValido(enlaceTrim)) {
      setFormError('El enlace no es un URL válido');
      return;
    }
    const marca: MarcaLocal = {
      accion: resolverForm.accion,
      comentario: comentarioTrim || undefined,
      archivo_adjunto: adjFileUrl || null,
      enlace_adjunto: enlaceTrim || null,
      archivo_adjunto_nombre: adjFile?.name,
    };
    setMarcasLocales(prev => {
      const next = new Map(prev);
      if (resolverForm.modo === 'individual' && resolverForm.pruebaId) {
        next.set(resolverForm.pruebaId, marca);
      } else if (resolverForm.modo === 'masivo') {
        // Masivo: marca todos los pendientes con la misma accion/motivo.
        for (const p of pruebasPendientes) {
          next.set(p.id, marca);
        }
      }
      return next;
    });
    resetForm();
  };

  // Jos 2026-11-27: Finalizar envía todas las marcas al back SECUENCIAL.
  // El back (con `diferirHooks=true`) solo dispara los side-effects al
  // resolver la ultima — asi los artes aprobados NO aparecen en biblioteca
  // ni se crea Seguimiento hasta que la revisión queda cerrada.
  const finalizarRevision = async () => {
    if (finalizando) return;
    setFinalizarError(null);
    // Validar que todas las pruebas pendientes tienen marca.
    const faltantes = pruebasPendientes.filter(p => !marcasLocales.has(p.id));
    if (faltantes.length > 0) {
      setFinalizarError(`Falta marcar ${faltantes.length} arte(s) antes de finalizar.`);
      return;
    }
    try {
      setFinalizando(true);
      for (const [pruebaId, marca] of marcasLocales.entries()) {
        await onResolverArte(pruebaId, marca.accion, {
          comentario: marca.comentario,
          archivo_adjunto: marca.archivo_adjunto,
          enlace_adjunto: marca.enlace_adjunto,
        });
      }
      // Al terminar, el modal se cierra desde fuera (el refetch invalida
      // la query y el parent detecta que la tarea ya no es batch pendiente).
      setMarcasLocales(new Map());
      onClose();
    } catch (e) {
      setFinalizarError(e instanceof Error ? e.message : 'Error al finalizar la revisión');
    } finally {
      setFinalizando(false);
    }
  };

  const estatusStyle = (estatus: string): string => {
    if (estatus === 'arte_aprobado' || estatus === 'aprobada')
      return isDark ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40' : 'bg-emerald-50 text-emerald-800 border-emerald-300';
    if (estatus === 'rechazada')
      return isDark ? 'bg-red-500/15 text-red-200 border-red-500/40' : 'bg-red-50 text-red-800 border-red-300';
    return isDark ? 'bg-amber-500/15 text-amber-200 border-amber-500/40' : 'bg-amber-50 text-amber-800 border-amber-300';
  };
  const estatusLabel = (estatus: string): string => {
    if (estatus === 'arte_aprobado') return 'Aprobado';
    if (estatus === 'aprobada') return 'Aprobado';
    if (estatus === 'rechazada') return 'Rechazado';
    if (estatus === 'solicitada' || estatus === 'revision_artes') return 'Pendiente';
    return estatus;
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-3xl rounded-xl border shadow-2xl flex flex-col max-h-[92dvh] max-lg:landscape:h-[100dvh] max-lg:landscape:max-h-[100dvh] max-lg:landscape:rounded-none max-lg:landscape:mx-0 ${isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-100' : 'bg-white border-gray-200 text-gray-900'}`}
      >
        {/* Header */}
        <div className={`shrink-0 px-5 py-3 flex items-start justify-between gap-3 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
          <div className="flex-1 min-w-0">
            <div className={`text-[10px] uppercase tracking-wide font-semibold ${isDark ? 'text-fuchsia-300' : 'text-fuchsia-700'}`}>
              Atender revisión — varios artes
            </div>
            <div className="text-base font-semibold mt-0.5">
              Revisión de {pruebas.length} artes
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {cara && (
            <div className={`rounded-lg border px-3 py-2 flex items-center gap-2 flex-wrap text-xs ${isDark ? 'bg-fuchsia-500/5 border-fuchsia-500/30' : 'bg-fuchsia-50/60 border-fuchsia-200'}`}>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isDark ? 'bg-fuchsia-500/20 text-fuchsia-200' : 'bg-fuchsia-100 text-fuchsia-700'}`}>
                #{cara.id}
              </span>
              {cara.articulo && <span>{cara.articulo}</span>}
              {cara.formato && <span className={isDark ? 'text-zinc-400' : 'text-gray-500'}>· {cara.formato}</span>}
              {cara.ciudad && <span className={isDark ? 'text-zinc-400' : 'text-gray-500'}>· {cara.ciudad}</span>}
            </div>
          )}

          {/* Contadores — pendientes efectivos = sin marca local */}
          {(() => {
            const marcadosAprobar = pruebas.filter(p => marcasLocales.get(p.id)?.accion === 'aprobar').length;
            const marcadosRechazar = pruebas.filter(p => marcasLocales.get(p.id)?.accion === 'rechazar').length;
            const pendientesSinMarca = pruebasPendientes.filter(p => !marcasLocales.has(p.id)).length;
            return (
              <div className={`flex items-center gap-2 text-[11px] flex-wrap`}>
                <span className={`px-2 py-0.5 rounded-full border font-medium ${isDark ? 'bg-amber-500/15 text-amber-200 border-amber-500/40' : 'bg-amber-50 text-amber-800 border-amber-300'}`}>
                  {pendientesSinMarca} sin marcar
                </span>
                <span className={`px-2 py-0.5 rounded-full border font-medium ${isDark ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40' : 'bg-emerald-50 text-emerald-800 border-emerald-300'}`}>
                  {marcadosAprobar + pruebasAprobadas.length} para aprobar
                </span>
                <span className={`px-2 py-0.5 rounded-full border font-medium ${isDark ? 'bg-red-500/15 text-red-200 border-red-500/40' : 'bg-red-50 text-red-800 border-red-300'}`}>
                  {marcadosRechazar + pruebasRechazadas.length} para rechazar
                </span>
              </div>
            );
          })()}

          {/* Botones masivos — también son marcas preliminares */}
          {puedeRevisar && pruebasPendientes.filter(p => !marcasLocales.has(p.id)).length > 0 && (
            <div className={`flex items-center gap-2 flex-wrap p-3 rounded-lg border ${isDark ? 'bg-zinc-800/60 border-zinc-700' : 'bg-gray-50 border-gray-200'}`}>
              <span className={`text-xs font-medium ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>Acciones masivas:</span>
              <button
                onClick={() => setResolverForm({ modo: 'masivo', accion: 'aprobar' })}
                disabled={finalizando}
                className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded border transition-colors ${isDark ? 'border-emerald-500/60 text-emerald-100 bg-emerald-500/20 hover:bg-emerald-500/30' : 'border-emerald-400 text-emerald-800 bg-emerald-50 hover:bg-emerald-100'} disabled:opacity-50`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Marcar todos para aprobar ({pruebasPendientes.length})
              </button>
              <button
                onClick={() => setResolverForm({ modo: 'masivo', accion: 'rechazar' })}
                disabled={finalizando}
                className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded border transition-colors ${isDark ? 'border-red-500/60 text-red-100 bg-red-500/20 hover:bg-red-500/30' : 'border-red-400 text-red-800 bg-red-50 hover:bg-red-100'} disabled:opacity-50`}
              >
                <XCircle className="h-3.5 w-3.5" /> Marcar todos para rechazar ({pruebasPendientes.length})
              </button>
            </div>
          )}

          {/* Lista de artes */}
          {isLoadingPruebas ? (
            <div className={`flex items-center justify-center py-8 text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Cargando artes...
            </div>
          ) : pruebas.length === 0 ? (
            <div className={`text-sm text-center py-8 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
              No se encontraron artes para esta revisión.
            </div>
          ) : (
            <div className="space-y-2">
              {pruebas.map((p) => {
                const esPendienteBD = p.estatus === 'revision_artes' || p.estatus === 'solicitada';
                const marcaLocal = marcasLocales.get(p.id);
                const estatusMostrado = marcaLocal
                  ? (marcaLocal.accion === 'aprobar' ? 'arte_aprobado' : 'rechazada')
                  : p.estatus;
                const etiquetaMarca = marcaLocal
                  ? (marcaLocal.accion === 'aprobar' ? 'Marcado para aprobar' : 'Marcado para rechazar')
                  : estatusLabel(p.estatus);
                const esPendienteEfectivo = esPendienteBD && !marcaLocal;
                // Jos 2026-11-27: resaltar la card del arte que se está
                // resolviendo + renderizar el sub-form inline debajo.
                const seleccionada = resolverForm?.modo === 'individual' && resolverForm.pruebaId === p.id;
                const bordeResaltado = seleccionada
                  ? (resolverForm?.accion === 'aprobar'
                      ? (isDark ? 'border-emerald-500/60 ring-1 ring-emerald-500/40' : 'border-emerald-400 ring-1 ring-emerald-300')
                      : (isDark ? 'border-red-500/60 ring-1 ring-red-500/40' : 'border-red-400 ring-1 ring-red-300'))
                  : marcaLocal
                    ? (marcaLocal.accion === 'aprobar'
                        ? (isDark ? 'border-emerald-500/40' : 'border-emerald-300')
                        : (isDark ? 'border-red-500/40' : 'border-red-300'))
                    : (isDark ? 'border-zinc-700' : 'border-gray-200');
                return (
                  <div key={p.id}>
                    <div
                      className={`rounded-lg border p-3 ${isDark ? 'bg-zinc-800/60' : 'bg-white'} ${bordeResaltado} transition-colors`}
                    >
                      <div className="flex items-start gap-3">
                        {p.archivo ? (
                          <a href={p.archivo} target="_blank" rel="noreferrer" className="shrink-0">
                            <img
                              src={p.archivo}
                              alt={p.nombre_arte || `Arte ${p.id}`}
                              className="w-16 h-16 object-cover rounded border border-zinc-700"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          </a>
                        ) : (
                          <div className={`w-16 h-16 rounded flex items-center justify-center shrink-0 ${isDark ? 'bg-zinc-800 border border-zinc-700' : 'bg-gray-100 border border-gray-200'}`}>
                            <FileImage className={`h-5 w-5 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${isDark ? 'bg-fuchsia-500/20 text-fuchsia-200' : 'bg-fuchsia-100 text-fuchsia-700'}`}>
                              v{p.version}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${estatusStyle(estatusMostrado)}`}>
                              {etiquetaMarca}
                            </span>
                            <span className={`text-sm font-semibold truncate ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>
                              {p.nombre_arte || `Arte #${p.id}`}
                            </span>
                          </div>
                          {p.notas && (
                            <div className={`text-[11px] mt-1 whitespace-pre-wrap ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
                              {p.notas}
                            </div>
                          )}
                          {marcaLocal && (
                            <div className={`text-[11px] mt-1 italic ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
                              {marcaLocal.comentario && <div>Motivo: {marcaLocal.comentario}</div>}
                              {marcaLocal.archivo_adjunto_nombre && <div>Reemplazo: {marcaLocal.archivo_adjunto_nombre}</div>}
                              {marcaLocal.enlace_adjunto && <div>Enlace: {marcaLocal.enlace_adjunto}</div>}
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            {p.archivo && (
                              <a href={p.archivo} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded border ${isDark ? 'text-fuchsia-300 border-fuchsia-500/40 hover:bg-fuchsia-500/10' : 'text-fuchsia-700 border-fuchsia-300 hover:bg-fuchsia-50'}`}>
                                <FileImage className="h-3 w-3" /> Ver arte
                              </a>
                            )}
                            {p.enlace_externo && (
                              <a href={p.enlace_externo} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded border ${isDark ? 'text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/10' : 'text-cyan-700 border-cyan-300 hover:bg-cyan-50'}`}>
                                <ExternalLink className="h-3 w-3" /> Link
                              </a>
                            )}
                            {puedeRevisar && esPendienteEfectivo && (
                              <>
                                <button
                                  onClick={() => { resetForm(); setResolverForm({ modo: 'individual', accion: 'aprobar', pruebaId: p.id }); }}
                                  disabled={finalizando}
                                  className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded border transition-colors ${isDark ? 'border-emerald-500/60 text-emerald-100 bg-emerald-500/20 hover:bg-emerald-500/30' : 'border-emerald-400 text-emerald-800 bg-emerald-50 hover:bg-emerald-100'} disabled:opacity-50`}
                                >
                                  <CheckCircle2 className="h-3 w-3" /> Aprobar
                                </button>
                                <button
                                  onClick={() => { resetForm(); setResolverForm({ modo: 'individual', accion: 'rechazar', pruebaId: p.id }); }}
                                  disabled={finalizando}
                                  className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded border transition-colors ${isDark ? 'border-red-500/60 text-red-100 bg-red-500/20 hover:bg-red-500/30' : 'border-red-400 text-red-800 bg-red-50 hover:bg-red-100'} disabled:opacity-50`}
                                >
                                  <XCircle className="h-3 w-3" /> Rechazar
                                </button>
                              </>
                            )}
                            {puedeRevisar && marcaLocal && !finalizando && (
                              <button
                                onClick={() => deshacerMarca(p.id)}
                                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded border transition-colors ${isDark ? 'border-zinc-600 text-zinc-300 hover:bg-zinc-700' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}
                              >
                                Deshacer marca
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Sub-form inline debajo del arte seleccionado */}
                    {seleccionada && (
                      <div className="mt-2 ml-4">
                        {renderSubForm('individual')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Sub-form masivo (al final de la lista) */}
          {renderSubForm('masivo')}
        </div>

        {/* Footer */}
        <div className={`shrink-0 px-5 py-3 flex items-center justify-between gap-2 border-t flex-wrap ${isDark ? 'border-zinc-800 bg-zinc-900/60' : 'border-gray-200 bg-gray-50/60'}`}>
          {/* Resumen a la izquierda */}
          {(() => {
            const pendientesSinMarca = pruebasPendientes.filter(p => !marcasLocales.has(p.id)).length;
            const marcados = marcasLocales.size;
            const total = pruebasPendientes.length;
            return (
              <div className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
                {total > 0 ? (
                  pendientesSinMarca > 0
                    ? <>Marca cada arte antes de finalizar <span className="font-semibold">({marcados} de {total})</span></>
                    : <span className={isDark ? 'text-emerald-300 font-semibold' : 'text-emerald-700 font-semibold'}>Todos los artes están marcados ✓</span>
                ) : <span>No hay artes pendientes</span>}
                {finalizarError && (
                  <div className={`mt-1 text-[11px] ${isDark ? 'text-red-300' : 'text-red-700'}`}>{finalizarError}</div>
                )}
              </div>
            );
          })()}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={finalizando}
              className={`text-xs font-semibold px-4 py-2 rounded border transition-colors ${isDark ? 'border-zinc-700 text-zinc-200 bg-zinc-800 hover:bg-zinc-700' : 'border-gray-300 text-gray-800 bg-white hover:bg-gray-50'} disabled:opacity-50`}
            >
              Cerrar
            </button>
            {puedeRevisar && pruebasPendientes.length > 0 && (() => {
              const pendientesSinMarca = pruebasPendientes.filter(p => !marcasLocales.has(p.id)).length;
              const puedeFinalizar = pendientesSinMarca === 0 && marcasLocales.size > 0;
              return (
                <button
                  onClick={finalizarRevision}
                  disabled={!puedeFinalizar || finalizando}
                  title={!puedeFinalizar ? 'Marca todos los artes antes de finalizar' : 'Aplica todas las resoluciones y cierra la tarea'}
                  className={`inline-flex items-center gap-1 text-xs font-semibold px-4 py-2 rounded border transition-colors ${isDark ? 'border-fuchsia-500/60 text-fuchsia-100 bg-fuchsia-500/20 hover:bg-fuchsia-500/30' : 'border-fuchsia-400 text-fuchsia-800 bg-fuchsia-50 hover:bg-fuchsia-100'} disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {finalizando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Flag className="h-3 w-3" />}
                  {finalizando ? 'Finalizando...' : 'Finalizar revisión'}
                </button>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
