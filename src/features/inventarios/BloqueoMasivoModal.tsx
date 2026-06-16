import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X, Upload, Trash2, Loader2, AlertCircle, CheckCircle2,
  ArrowLeft, ArrowRight, Ban, Calendar, ChevronDown,
  ExternalLink, Download, Filter, Search,
} from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import { inventariosService } from '../../services/inventarios.service';
import { solicitudesService, UserOption } from '../../services/solicitudes.service';
import { propuestasService } from '../../services/propuestas.service';
import { campanasService } from '../../services/campanas.service';
import {
  analisisOcupacionService,
  CampanaEnCelda,
  CatorcenaRef,
  InventarioResumen,
  MatrizOcupacion,
  cellKeyOf,
} from '../../services/analisisOcupacion.service';

type Step = 'select' | 'periodos' | 'matriz';

interface BloqueoMasivoModalProps {
  open: boolean;
  onClose: () => void;
  initialInventarios?: InventarioResumen[];
}

interface SkippedPropuesta {
  reserva_id: number;
  propuesta_id: number;
  inventario_codigo: string | null;
  catorcena: string;
}

interface BloqueoResultado {
  inventariosBloqueados: number;
  inventariosFallidos: number;
  tareasCreadas: number;
  tareasFallidas: number;
  skippedPropuestas: SkippedPropuesta[];
}

function parseCsvCodes(text: string): string[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };
  for (const ch of lines[0]) if (ch in counts) counts[ch]++;
  const sep = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[1] ?? 0) > 0
    ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
    : ',';

  const splitRow = (line: string): string[] =>
    line.split(sep).map(c => c.replace(/^"|"$/g, '').trim());

  const headerCells = splitRow(lines[0]).map(c => c.toLowerCase());
  const codigoIdx = headerCells.findIndex(h => h.includes('codigo') || h.includes('código'));
  const hasHeader = codigoIdx !== -1 || headerCells[0] === 'id';

  let targetCol = 0;
  if (codigoIdx !== -1) targetCol = codigoIdx;
  else if (headerCells[0] === 'id' && headerCells.length > 1) targetCol = 1;

  const startIdx = hasHeader ? 1 : 0;
  const codes = new Set<string>();
  for (let i = startIdx; i < lines.length; i++) {
    const cells = splitRow(lines[i]);
    const value = cells[targetCol]?.trim();
    if (value) codes.add(value);
  }
  return Array.from(codes);
}

const isTrafico = (u: UserOption) =>
  u.area?.toLowerCase().includes('tráfico') || u.area?.toLowerCase().includes('trafico') ||
  u.puesto?.toLowerCase().includes('tráfico') || u.puesto?.toLowerCase().includes('trafico');

const fmtFecha = (d: string) => new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });

// Fecha de hoy como 'YYYY-MM-DD' (local). Se compara contra el date-part del
// `fin_periodo` para decidir si una tarjeta ya está en el pasado.
const hoyISO = (): string => {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
};

// Una tarjeta es "pasada" si su período ya terminó (fin_periodo < hoy). Alinea
// con el filtro `sc.fin_periodo >= CURDATE()` del backend (toggleBlock): esas
// reservas NO se liberan, así que tampoco deben contar ni generar tareas.
// Comparamos por date-part del string ISO para evitar corrimientos de timezone.
const esPeriodoPasado = (fin: string | null | undefined): boolean => {
  if (!fin) return false; // sin fecha → conservador: no la descartamos
  return fin.slice(0, 10) < hoyISO();
};

const labelForCampana = (c: CampanaEnCelda): string => {
  if (c.campana_id) return c.campana_nombre || `Campaña #${c.campana_id}`;
  return `Propuesta #${c.propuesta_id}`;
};

export function BloqueoMasivoModal({ open, onClose, initialInventarios }: BloqueoMasivoModalProps) {
  const isDark = useThemeStore(s => s.theme) === 'dark';
  const user = useAuthStore(s => s.user);
  const userRole = user?.rol;
  const canBlock = userRole === 'DEV'
    || userRole === 'Gerente de Trafico'
    || userRole === 'Coordinador de trafico'
    || userRole === 'Especialista de trafico'
    || userRole === 'Auxiliar de trafico';

  const [step, setStep] = useState<Step>('select');
  const [inventarios, setInventarios] = useState<InventarioResumen[]>([]);
  const [codigosNoEncontrados, setCodigosNoEncontrados] = useState<string[]>([]);
  const [catorcenasSelected, setCatorcenasSelected] = useState<CatorcenaRef[]>([]);
  const [matriz, setMatriz] = useState<MatrizOcupacion | null>(null);
  const [building, setBuilding] = useState(false);

  const [csvProcessing, setCsvProcessing] = useState(false);
  const [csvFeedback, setCsvFeedback] = useState<{ encontrados: number; noEncontrados: number } | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const [yearSelected, setYearSelected] = useState<number>(new Date().getFullYear());

  const [selectedInventarios, setSelectedInventarios] = useState<Set<number>>(new Set());
  const [selectedReservas, setSelectedReservas] = useState<Set<number>>(new Set());
  const [bloqueadosLocal, setBloqueadosLocal] = useState<Set<number>>(new Set());

  const [confirmBloqueoOpen, setConfirmBloqueoOpen] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [bloqueando, setBloqueando] = useState(false);
  const [bloqueoResultado, setBloqueoResultado] = useState<BloqueoResultado | null>(null);
  const [resultadoOpen, setResultadoOpen] = useState(false);

  const { data: allUsers = [] } = useQuery({
    queryKey: ['solicitudes-users-bloqueo-masivo'],
    queryFn: () => solicitudesService.getUsers(undefined, false),
    enabled: open,
  });

  const traficoUsers = useMemo(() => allUsers.filter(isTrafico), [allUsers]);

  useEffect(() => {
    if (!open) return;
    setStep('select');
    setInventarios(initialInventarios || []);
    setCodigosNoEncontrados([]);
    setCatorcenasSelected([]);
    setMatriz(null);
    setSelectedInventarios(new Set());
    setSelectedReservas(new Set());
    setBloqueadosLocal(new Set());
    setCsvFeedback(null);
    setMotivo('');
    setConfirmBloqueoOpen(false);
    setBloqueoResultado(null);
    setResultadoOpen(false);
  }, [open, initialInventarios]);

  const handleDownloadTemplate = () => {
    const csv = 'Código Único\nEJEMPLO-001\nEJEMPLO-002\n';
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template-bloqueo-masivo.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCsvUpload = async (file: File) => {
    setCsvProcessing(true);
    setCsvFeedback(null);
    try {
      const buffer = await file.arrayBuffer();
      let text: string;
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      } catch {
        text = new TextDecoder('windows-1252').decode(buffer);
      }
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
      const codes = parseCsvCodes(text);
      if (codes.length === 0) {
        setCsvFeedback({ encontrados: 0, noEncontrados: 0 });
        return;
      }

      const existentes = new Set(inventarios.map(i => i.codigo_unico));
      const nuevosCodigos = codes.filter(c => !existentes.has(c));

      if (nuevosCodigos.length === 0) {
        setCsvFeedback({ encontrados: 0, noEncontrados: 0 });
        return;
      }

      const check = await inventariosService.bulkCheck(nuevosCodigos, true);
      const idsEncontrados: number[] = [
        ...check.sobreescribibles.map(s => s.id).filter((x): x is number => x !== null),
        ...check.ocupados.map(o => o.id).filter((x): x is number => x !== null),
      ];

      const CHUNK_SIZE = 50;
      const found: InventarioResumen[] = [];
      for (let i = 0; i < idsEncontrados.length; i += CHUNK_SIZE) {
        const chunk = idsEncontrados.slice(i, i + CHUNK_SIZE);
        const part = await Promise.all(
          chunk.map(async id => {
            try {
              const inv = await inventariosService.getById(id);
              return {
                id: inv.id,
                codigo_unico: inv.codigo_unico,
                ubicacion: inv.ubicacion,
                mueble: inv.mueble,
                plaza: inv.plaza,
                estado: inv.estado,
                tipo_de_cara: inv.tipo_de_cara,
                tradicional_digital: inv.tradicional_digital,
              } as InventarioResumen;
            } catch {
              return null;
            }
          })
        );
        for (const item of part) if (item) found.push(item);
      }

      setInventarios(prev => {
        const map = new Map(prev.map(p => [p.id, p]));
        found.forEach(f => map.set(f.id, f));
        return Array.from(map.values());
      });
      setCodigosNoEncontrados(prev => Array.from(new Set([...prev, ...check.nuevos])));
      setCsvFeedback({ encontrados: found.length, noEncontrados: check.nuevos.length });
    } catch (err) {
      setCsvFeedback({ encontrados: 0, noEncontrados: 0 });
      console.error('Error procesando CSV:', err);
    } finally {
      setCsvProcessing(false);
      if (csvInputRef.current) csvInputRef.current.value = '';
    }
  };

  const removeInventario = (id: number) => {
    setInventarios(prev => prev.filter(i => i.id !== id));
  };

  const removeCodigoNoEncontrado = (codigo: string) => {
    setCodigosNoEncontrados(prev => prev.filter(c => c !== codigo));
  };

  const { data: catorcenasYear, isLoading: loadingCatorcenas } = useQuery({
    queryKey: ['catorcenas', yearSelected],
    queryFn: () => solicitudesService.getCatorcenas(yearSelected),
    enabled: open && step === 'periodos',
  });

  const toggleCatorcena = (c: CatorcenaRef) => {
    setCatorcenasSelected(prev => {
      const exists = prev.some(p => p.numero === c.numero && p.anio === c.anio);
      if (exists) return prev.filter(p => !(p.numero === c.numero && p.anio === c.anio));
      return [...prev, c].sort((a, b) => a.anio - b.anio || a.numero - b.numero);
    });
  };

  const isSelectedCatorcena = (numero: number, anio: number) =>
    catorcenasSelected.some(c => c.numero === numero && c.anio === anio);

  const buildMatrizFor = useCallback(async (invs: InventarioResumen[], cats: CatorcenaRef[]) => {
    setBuilding(true);
    try {
      const m = await analisisOcupacionService.buildMatriz(invs, cats);
      setMatriz(m);
    } catch (err) {
      console.error('Error construyendo matriz:', err);
    } finally {
      setBuilding(false);
    }
  }, []);

  const goToMatriz = () => {
    setStep('matriz');
    setSelectedInventarios(new Set());
    setSelectedReservas(new Set());
    setBloqueadosLocal(new Set());
    void buildMatrizFor(inventarios, catorcenasSelected);
  };

  const refreshMatrix = async () => {
    setSelectedInventarios(new Set());
    setSelectedReservas(new Set());
    setBloqueadosLocal(new Set());
    await buildMatrizFor(inventarios, catorcenasSelected);
  };

  // === Inventarios a bloquear = union de filas seleccionadas + filas dueñas de tarjetas seleccionadas ===
  const inventariosObjetivo = useMemo(() => {
    if (!matriz) return new Set<number>();
    const out = new Set<number>(selectedInventarios);
    if (selectedReservas.size > 0) {
      for (const inv of matriz.inventarios) {
        const invCeldas = matriz.celdas[inv.id];
        if (!invCeldas) continue;
        outer: for (const celda of Object.values(invCeldas)) {
          for (const c of celda.campanas) {
            if (selectedReservas.has(c.reserva_id)) {
              out.add(inv.id);
              break outer;
            }
          }
        }
      }
    }
    // Excluir los que ya quedaron bloqueados en esta sesión
    for (const id of bloqueadosLocal) out.delete(id);
    return out;
  }, [matriz, selectedInventarios, selectedReservas, bloqueadosLocal]);

  // === Tarjetas afectadas: cards ACTUALES/FUTURAS en los inventarios objetivo ===
  // Se excluyen las de período ya vencido: el backend (toggleBlock) no las
  // libera, así que no deben contar ni generar tareas "Sustituir Inventario".
  const tarjetasAfectadas = useMemo(() => {
    if (!matriz) return [] as { card: CampanaEnCelda; inv: InventarioResumen; cat: CatorcenaRef }[];
    const out: { card: CampanaEnCelda; inv: InventarioResumen; cat: CatorcenaRef }[] = [];
    for (const inv of matriz.inventarios) {
      if (!inventariosObjetivo.has(inv.id)) continue;
      const invCeldas = matriz.celdas[inv.id];
      if (!invCeldas) continue;
      for (const cat of matriz.catorcenas) {
        const celda = invCeldas[cellKeyOf(cat)];
        if (!celda) continue;
        for (const card of celda.campanas) {
          if (esPeriodoPasado(card.fin_periodo)) continue;
          out.push({ card, inv, cat });
        }
      }
    }
    return out;
  }, [matriz, inventariosObjetivo]);

  const handleConfirmBloqueoMasivo = async () => {
    if (!matriz || inventariosObjetivo.size === 0) return;

    setBloqueando(true);
    const resultado: BloqueoResultado = {
      inventariosBloqueados: 0,
      inventariosFallidos: 0,
      tareasCreadas: 0,
      tareasFallidas: 0,
      skippedPropuestas: [],
    };
    const bloqueadosOk = new Set<number>();
    const fechaBloqueo = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const motivoTexto = motivo.trim();

    // 1) Bloquear inventarios. El back soft-deletea reservas con/sin APS.
    //    Loop secuencial para no saturar al backend (no hay endpoint bulk).
    for (const invId of inventariosObjetivo) {
      try {
        await inventariosService.toggleBlock(invId);
        bloqueadosOk.add(invId);
        resultado.inventariosBloqueados += 1;
      } catch (err) {
        console.error('Error bloqueando inventario', invId, err);
        resultado.inventariosFallidos += 1;
      }
    }

    // 2) Crear tareas "Sustituir Inventario" — una por cada tarjeta de cada
    //    inventario que sí pudo bloquearse. Tarjetas solo-propuesta se reportan.
    const traficoIds = traficoUsers.map(u => u.id);
    const traficoNombres = traficoUsers.map(u => u.nombre);

    const tareasJobs: Promise<void>[] = [];
    for (const { card, inv, cat } of tarjetasAfectadas) {
      if (!bloqueadosOk.has(inv.id)) continue;
      const catLabel = `C${cat.numero}-${cat.anio}`;
      if (!card.campana_id) {
        resultado.skippedPropuestas.push({
          reserva_id: card.reserva_id,
          propuesta_id: card.propuesta_id,
          inventario_codigo: inv.codigo_unico,
          catorcena: catLabel,
        });
        continue;
      }
      const rango = card.inicio_periodo && card.fin_periodo
        ? `${fmtFecha(card.inicio_periodo)} – ${fmtFecha(card.fin_periodo)}`
        : '';
      const descripcion = [
        `Inventario: #${inv.id}${inv.codigo_unico ? ` — ${inv.codigo_unico}` : ''}`,
        inv.ubicacion ? `Ubicación: ${inv.ubicacion}` : null,
        inv.plaza ? `Plaza: ${inv.plaza}` : null,
        `Catorcena: ${catLabel}${rango ? ` (${rango})` : ''}`,
        `Cliente: ${card.cliente_nombre || 'Sin cliente'}`,
        `Reserva #${card.reserva_id}`,
        '',
        `Editar campaña: ${window.location.origin}/campanas/detail/${card.campana_id}`,
        '',
        `Fecha de bloqueo: ${fechaBloqueo}`,
        motivoTexto ? `Motivo: ${motivoTexto}` : null,
        user ? `Bloqueado por: ${user.nombre}` : null,
      ].filter(Boolean).join('\n');

      tareasJobs.push(
        campanasService.createTarea(card.campana_id, {
          titulo: 'Sustituir Inventario',
          tipo: 'Sustituir Inventario',
          descripcion,
          ids_reservas: String(card.reserva_id),
          ...(user && {
            id_responsable: user.id,
            responsable: user.nombre,
          }),
          ...(traficoIds.length > 0 && {
            id_asignado: traficoIds.join(', '),
            asignado: traficoNombres.join(', '),
          }),
        })
          .then(() => { resultado.tareasCreadas += 1; })
          .catch(err => {
            console.error('Error creando tarea Sustituir Inventario', card.reserva_id, err);
            resultado.tareasFallidas += 1;
          })
      );
    }
    await Promise.all(tareasJobs);

    // 3) Marcar localmente para recolorear sin perder las tarjetas
    setBloqueadosLocal(prev => {
      const next = new Set(prev);
      for (const id of bloqueadosOk) next.add(id);
      return next;
    });
    setSelectedInventarios(new Set());
    setSelectedReservas(new Set());

    setBloqueoResultado(resultado);
    setBloqueando(false);
    setConfirmBloqueoOpen(false);
    setResultadoOpen(true);
  };

  // === Descarga CSV de la matriz ===
  const handleDownloadMatrizCsv = () => {
    if (!matriz) return;
    const rows: string[][] = [[
      'Inventario ID', 'Código Único', 'Mueble', 'Plaza', 'Ubicación',
      'Catorcena', 'Estatus', 'Tipo', 'Campaña ID', 'Campaña', 'Cliente',
      'Propuesta ID', 'Artículo', 'Reserva ID', 'APS', 'Inicio', 'Fin',
    ]];
    for (const inv of matriz.inventarios) {
      const invCeldas = matriz.celdas[inv.id];
      if (!invCeldas) continue;
      for (const cat of matriz.catorcenas) {
        const celda = invCeldas[cellKeyOf(cat)];
        const catLabel = `C${cat.numero}-${cat.anio}`;
        if (!celda || !celda.ocupado || celda.campanas.length === 0) {
          rows.push([
            String(inv.id), inv.codigo_unico || '', inv.mueble || '', inv.plaza || '', inv.ubicacion || '',
            catLabel, bloqueadosLocal.has(inv.id) ? 'Bloqueado' : 'Disponible', '', '', '', '', '', '', '', '', '', '',
          ]);
          continue;
        }
        for (const c of celda.campanas) {
          const esPropuesta = !c.campana_id;
          const estatus = bloqueadosLocal.has(inv.id)
            ? 'Bloqueado (recién)'
            : esPropuesta ? 'Reservado' : 'Ocupado';
          rows.push([
            String(inv.id), inv.codigo_unico || '', inv.mueble || '', inv.plaza || '', inv.ubicacion || '',
            catLabel, estatus, esPropuesta ? 'Propuesta' : 'Campaña',
            c.campana_id ? String(c.campana_id) : '', c.campana_nombre || '', c.cliente_nombre || '',
            c.propuesta_id ? String(c.propuesta_id) : '', c.articulo || '',
            String(c.reserva_id), c.aps != null ? String(c.aps) : '',
            c.inicio_periodo || '', c.fin_periodo || '',
          ]);
        }
      }
    }
    const escape = (s: string) => /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    const csv = rows.map(r => r.map(escape).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `matriz-bloqueo-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const canContinueFromSelect = inventarios.length > 0;
  const canContinueFromPeriodos = catorcenasSelected.length > 0;

  if (!open) return null;

  const stepIndex = step === 'select' ? 1 : step === 'periodos' ? 2 : 3;

  return (
    <>
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div
          className={`${isDark ? 'bg-zinc-900' : 'bg-white'} rounded-2xl border ${isDark ? 'border-rose-500/20' : 'border-rose-200'} w-full ${step === 'matriz' ? 'max-w-7xl' : 'max-w-3xl'} max-h-[92vh] overflow-hidden flex flex-col shadow-2xl shadow-rose-500/10`}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`p-5 border-b ${isDark ? 'border-rose-500/20 bg-gradient-to-r from-rose-900/20 via-red-900/10 to-rose-900/20' : 'border-rose-200 bg-gradient-to-r from-rose-50 via-red-50 to-rose-50'} flex items-center justify-between`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${isDark ? 'bg-rose-500/20' : 'bg-rose-50'} flex items-center justify-center`}>
                <Ban className={`h-5 w-5 ${isDark ? 'text-rose-400' : 'text-rose-600'}`} />
              </div>
              <div>
                <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Bloqueo Masivo de Inventario</h2>
                <p className={`text-xs ${isDark ? 'text-rose-300/50' : 'text-rose-400'}`}>
                  Paso {stepIndex} de 3 · {step === 'select' ? 'Inventarios' : step === 'periodos' ? 'Periodos' : 'Matriz'}
                </p>
              </div>
            </div>
            <button onClick={onClose} className={`p-2 rounded-lg ${isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'} transition-colors`}>
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Step indicators */}
          <div className={`flex items-center px-5 py-2 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'} gap-2 text-xs`}>
            {(['select', 'periodos', 'matriz'] as const).map((s, idx) => {
              const active = step === s;
              const done = stepIndex > idx + 1;
              return (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center font-semibold ${
                    active
                      ? isDark ? 'bg-rose-500 text-white' : 'bg-rose-600 text-white'
                      : done
                        ? isDark ? 'bg-emerald-500/30 text-emerald-300' : 'bg-emerald-100 text-emerald-700'
                        : isDark ? 'bg-zinc-800 text-zinc-500' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : idx + 1}
                  </div>
                  <span className={active ? (isDark ? 'text-rose-300 font-medium' : 'text-rose-700 font-medium') : isDark ? 'text-zinc-500' : 'text-gray-400'}>
                    {s === 'select' ? 'Inventarios' : s === 'periodos' ? 'Periodos' : 'Resultado'}
                  </span>
                  {idx < 2 && <ChevronDown className={`h-3 w-3 -rotate-90 ${isDark ? 'text-zinc-700' : 'text-gray-300'}`} />}
                </div>
              );
            })}
          </div>

          {/* Body */}
          <div className={`flex-1 p-5 min-h-0 ${step === 'matriz' ? 'overflow-hidden flex flex-col' : 'overflow-auto'}`}>
            {step === 'select' && (
              <div className="space-y-4">
                <div className={`rounded-xl border ${isDark ? 'border-zinc-700 bg-zinc-900/50' : 'border-gray-200 bg-gray-50'} p-4`}>
                  <div className="flex items-center justify-between mb-2 gap-3">
                    <div>
                      <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Carga masiva por CSV</h3>
                      <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Detecta la columna "Código Único" por el encabezado. Si no hay encabezado, usa la primera columna.</p>
                    </div>
                    <input
                      ref={csvInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) void handleCsvUpload(f);
                      }}
                    />
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={handleDownloadTemplate}
                        title="Descargar plantilla CSV con el formato esperado"
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${isDark ? 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'}`}
                      >
                        <Download className="h-3.5 w-3.5" />
                        Descargar template
                      </button>
                      <button
                        onClick={() => csvInputRef.current?.click()}
                        disabled={csvProcessing}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${isDark ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30' : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'} disabled:opacity-50`}
                      >
                        {csvProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                        {csvProcessing ? 'Procesando...' : 'Subir CSV'}
                      </button>
                    </div>
                  </div>
                  {csvFeedback && (
                    <div className={`mt-2 text-xs flex items-center gap-3 ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle2 className={`h-3.5 w-3.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                        {csvFeedback.encontrados} encontrados
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <AlertCircle className={`h-3.5 w-3.5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
                        {csvFeedback.noEncontrados} no encontrados
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      Inventarios seleccionados <span className={isDark ? 'text-rose-300' : 'text-rose-600'}>({inventarios.length})</span>
                    </h3>
                  </div>
                  {inventarios.length === 0 ? (
                    <div className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'} py-8 text-center border border-dashed ${isDark ? 'border-zinc-700' : 'border-gray-300'} rounded-lg`}>
                      Aún no hay inventarios. Selecciona en la tabla o sube un CSV.
                    </div>
                  ) : (
                    <div className={`rounded-lg border ${isDark ? 'border-zinc-700' : 'border-gray-200'} overflow-hidden max-h-72 overflow-y-auto`}>
                      <table className="w-full text-xs">
                        <thead className={`${isDark ? 'bg-zinc-800/80 text-zinc-400' : 'bg-gray-50 text-gray-500'} sticky top-0`}>
                          <tr>
                            <th className="px-3 py-2 text-left font-medium w-8">#</th>
                            <th className="px-3 py-2 text-left font-medium">Código</th>
                            <th className="px-3 py-2 text-left font-medium">Mueble</th>
                            <th className="px-3 py-2 text-left font-medium">Plaza</th>
                            <th className="px-3 py-2 text-left font-medium">Ubicación</th>
                            <th className="px-3 py-2 text-center font-medium w-10"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {inventarios.map((inv, idx) => (
                            <tr key={inv.id} className={`border-t ${isDark ? 'border-zinc-800' : 'border-gray-100'}`}>
                              <td className={`px-3 py-1.5 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{idx + 1}</td>
                              <td className={`px-3 py-1.5 font-mono ${isDark ? 'text-white' : 'text-gray-900'}`}>{inv.codigo_unico}</td>
                              <td className={`px-3 py-1.5 ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{inv.mueble || '-'}</td>
                              <td className={`px-3 py-1.5 ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{inv.plaza || '-'}</td>
                              <td className={`px-3 py-1.5 ${isDark ? 'text-zinc-400' : 'text-gray-500'} max-w-[260px] truncate`} title={inv.ubicacion || undefined}>{inv.ubicacion || '-'}</td>
                              <td className="px-3 py-1.5 text-center">
                                <button
                                  onClick={() => removeInventario(inv.id)}
                                  className={`p-1 rounded ${isDark ? 'text-zinc-500 hover:text-red-400 hover:bg-red-500/10' : 'text-gray-400 hover:text-red-600 hover:bg-red-50'}`}
                                  title="Quitar"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {codigosNoEncontrados.length > 0 && (
                  <div>
                    <h3 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
                      <AlertCircle className="h-4 w-4" />
                      Códigos no encontrados ({codigosNoEncontrados.length})
                    </h3>
                    <div className={`flex flex-wrap gap-1.5 p-3 rounded-lg border ${isDark ? 'border-amber-500/20 bg-amber-500/5' : 'border-amber-200 bg-amber-50'} max-h-32 overflow-y-auto`}>
                      {codigosNoEncontrados.map(c => (
                        <span key={c} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono ${isDark ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' : 'bg-white text-amber-700 border border-amber-200'}`}>
                          {c}
                          <button onClick={() => removeCodigoNoEncontrado(c)} className="hover:text-red-500">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 'periodos' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Calendar className={`h-4 w-4 ${isDark ? 'text-rose-400' : 'text-rose-600'}`} />
                  <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Año:</span>
                  <select
                    value={yearSelected}
                    onChange={e => setYearSelected(parseInt(e.target.value))}
                    className={`px-3 py-1.5 rounded-lg border text-sm ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-gray-200 text-gray-900'} focus:outline-none focus:ring-1 focus:ring-rose-500/50`}
                  >
                    {Array.from({ length: 6 }).map((_, i) => {
                      const y = new Date().getFullYear() - 2 + i;
                      return <option key={y} value={y}>{y}</option>;
                    })}
                  </select>
                  <span className={`ml-auto text-xs ${isDark ? 'text-rose-300' : 'text-rose-600'}`}>
                    {catorcenasSelected.length} seleccionadas
                  </span>
                </div>

                {loadingCatorcenas ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-rose-500" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {(catorcenasYear?.data || []).map(c => {
                      const selected = isSelectedCatorcena(c.numero_catorcena, c.a_o);
                      return (
                        <button
                          key={c.id}
                          onClick={() => toggleCatorcena({ numero: c.numero_catorcena, anio: c.a_o })}
                          className={`px-3 py-2 rounded-lg border text-xs text-left transition-all ${
                            selected
                              ? isDark ? 'bg-rose-500/20 border-rose-500 text-rose-200' : 'bg-rose-50 border-rose-500 text-rose-800'
                              : isDark ? 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-500' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
                          }`}
                        >
                          <div className="font-semibold">C{c.numero_catorcena}</div>
                          <div className={`text-[10px] mt-0.5 ${selected ? (isDark ? 'text-rose-300' : 'text-rose-600') : isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                            {new Date(c.fecha_inicio).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })} – {new Date(c.fecha_fin).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {catorcenasSelected.length > 0 && (
                  <div className={`rounded-lg border ${isDark ? 'border-rose-500/30 bg-rose-500/5' : 'border-rose-200 bg-rose-50/50'} p-3`}>
                    <div className={`text-xs font-medium mb-1.5 ${isDark ? 'text-rose-300' : 'text-rose-700'}`}>Periodos seleccionados</div>
                    <div className="flex flex-wrap gap-1.5">
                      {catorcenasSelected.map(c => (
                        <span key={`${c.anio}-${c.numero}`} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] ${isDark ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-white text-rose-700 border border-rose-200'}`}>
                          C{c.numero}-{c.anio}
                          <button onClick={() => toggleCatorcena(c)} className="hover:text-red-500">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 'matriz' && (
              <MatrizBloqueoView
                matriz={matriz}
                building={building}
                isDark={isDark}
                canBlock={canBlock}
                selectedInventarios={selectedInventarios}
                setSelectedInventarios={setSelectedInventarios}
                selectedReservas={selectedReservas}
                setSelectedReservas={setSelectedReservas}
                bloqueadosLocal={bloqueadosLocal}
                inventariosObjetivoCount={inventariosObjetivo.size}
                tarjetasAfectadasCount={tarjetasAfectadas.length}
                tarjetasAfectadasPropuestaCount={tarjetasAfectadas.filter(t => !t.card.campana_id).length}
                traficoCount={traficoUsers.length}
                onOpenConfirm={() => setConfirmBloqueoOpen(true)}
                onDownloadCsv={handleDownloadMatrizCsv}
                onRefresh={refreshMatrix}
              />
            )}
          </div>

          {/* Footer */}
          <div className={`p-4 border-t ${isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-gray-200 bg-gray-50'} flex items-center justify-between gap-3`}>
            <button
              onClick={onClose}
              className={`px-3 py-1.5 rounded-lg text-sm ${isDark ? 'text-zinc-400 hover:bg-zinc-800' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              {step === 'matriz' ? 'Cerrar' : 'Cancelar'}
            </button>
            <div className="flex items-center gap-2">
              {step === 'periodos' && (
                <button
                  onClick={() => setStep('select')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${isDark ? 'text-zinc-400 hover:bg-zinc-800' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Atrás
                </button>
              )}
              {step === 'matriz' && (
                <button
                  onClick={() => setStep('periodos')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${isDark ? 'text-zinc-400 hover:bg-zinc-800' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Cambiar periodos
                </button>
              )}
              {step === 'select' && (
                <button
                  onClick={() => setStep('periodos')}
                  disabled={!canContinueFromSelect}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium ${isDark ? 'bg-rose-500 text-white hover:bg-rose-600' : 'bg-rose-600 text-white hover:bg-rose-700'} disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  Continuar
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
              {step === 'periodos' && (
                <button
                  onClick={goToMatriz}
                  disabled={!canContinueFromPeriodos}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium ${isDark ? 'bg-rose-500 text-white hover:bg-rose-600' : 'bg-rose-600 text-white hover:bg-rose-700'} disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  Generar matriz
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmar bloqueo masivo */}
      {confirmBloqueoOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4"
          onClick={() => !bloqueando && setConfirmBloqueoOpen(false)}
        >
          <div
            className={`rounded-2xl border ${isDark ? 'bg-zinc-900 border-rose-500/30' : 'bg-white border-rose-200'} w-full max-w-md shadow-2xl`}
            onClick={e => e.stopPropagation()}
          >
            <div className={`p-5 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-rose-500/20' : 'bg-rose-50'}`}>
                  <Ban className={`h-5 w-5 ${isDark ? 'text-rose-300' : 'text-rose-600'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Bloquear {inventariosObjetivo.size} {inventariosObjetivo.size === 1 ? 'inventario' : 'inventarios'}
                  </h3>
                  <p className={`text-xs mt-1 ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
                    Se eliminarán automáticamente las reservas activas sobre estos inventarios (con o sin APS).
                    Las tarjetas no desaparecen de la matriz: se marcarán como bloqueadas para que puedas seguirlas reasignando.
                  </p>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <div className={`rounded-lg border p-3 space-y-1.5 ${isDark ? 'border-zinc-700 bg-zinc-800/50' : 'border-gray-200 bg-gray-50'}`}>
                <div className="flex justify-between">
                  <span className={isDark ? 'text-zinc-400' : 'text-gray-500'}>Inventarios a bloquear</span>
                  <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{inventariosObjetivo.size}</span>
                </div>
                <div className="flex justify-between">
                  <span className={isDark ? 'text-zinc-400' : 'text-gray-500'}>Tarjetas afectadas</span>
                  <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{tarjetasAfectadas.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className={isDark ? 'text-zinc-400' : 'text-gray-500'}>Tareas "Sustituir Inventario" a crear</span>
                  <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {tarjetasAfectadas.filter(t => t.card.campana_id).length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={isDark ? 'text-zinc-400' : 'text-gray-500'}>Usuarios de Tráfico que recibirán cada tarea</span>
                  <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{traficoUsers.length}</span>
                </div>
                {tarjetasAfectadas.filter(t => !t.card.campana_id).length > 0 && (
                  <div className={`flex items-start gap-1.5 pt-1.5 border-t ${isDark ? 'border-zinc-700' : 'border-gray-200'} ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>
                      {tarjetasAfectadas.filter(t => !t.card.campana_id).length} tarjeta(s) son de propuestas sin campaña confirmada. Se reportarán al final, no se les crea tarea.
                    </span>
                  </div>
                )}
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>
                  Motivo del bloqueo <span className={isDark ? 'text-zinc-500' : 'text-gray-400'}>(se incluye en cada tarea)</span>
                </label>
                <textarea
                  value={motivo}
                  onChange={e => setMotivo(e.target.value)}
                  rows={2}
                  placeholder="¿Por qué se bloquean estos inventarios?"
                  className={`w-full px-3 py-2 rounded-lg border text-sm resize-none ${isDark ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500' : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400'} focus:outline-none focus:ring-1 focus:ring-rose-500/50`}
                />
              </div>
              {traficoUsers.length === 0 && (
                <div className={`flex items-start gap-1.5 px-3 py-2 rounded-lg border ${isDark ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>No se encontraron usuarios con área o puesto "Tráfico". Las tareas se crearán sin asignados.</span>
                </div>
              )}
            </div>
            <div className={`p-4 border-t ${isDark ? 'border-zinc-800' : 'border-gray-200'} flex items-center justify-end gap-2`}>
              <button
                onClick={() => setConfirmBloqueoOpen(false)}
                disabled={bloqueando}
                className={`px-3 py-1.5 rounded-lg text-sm ${isDark ? 'text-zinc-400 hover:bg-zinc-800' : 'text-gray-600 hover:bg-gray-100'} disabled:opacity-50`}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmBloqueoMasivo}
                disabled={bloqueando || inventariosObjetivo.size === 0}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium ${isDark ? 'bg-rose-500 text-white hover:bg-rose-600' : 'bg-rose-600 text-white hover:bg-rose-700'} disabled:opacity-50`}
              >
                {bloqueando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                {bloqueando ? 'Bloqueando...' : 'Confirmar bloqueo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resultado del bloqueo */}
      {resultadoOpen && bloqueoResultado && (
        <div
          className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4"
          onClick={() => setResultadoOpen(false)}
        >
          <div
            className={`rounded-2xl border ${isDark ? 'bg-zinc-900 border-emerald-500/30' : 'bg-white border-emerald-200'} w-full max-w-lg shadow-2xl max-h-[80vh] overflow-hidden flex flex-col`}
            onClick={e => e.stopPropagation()}
          >
            <div className={`p-5 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'} flex items-center gap-3`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-emerald-500/20' : 'bg-emerald-50'}`}>
                <CheckCircle2 className={`h-5 w-5 ${isDark ? 'text-emerald-300' : 'text-emerald-600'}`} />
              </div>
              <div className="flex-1">
                <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Bloqueo completado</h3>
                <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
                  Las tarjetas afectadas siguen visibles en la matriz, ahora marcadas como bloqueadas.
                </p>
              </div>
            </div>
            <div className="p-5 space-y-3 text-xs overflow-y-auto">
              <div className={`grid grid-cols-2 gap-2`}>
                <ResultStat isDark={isDark} label="Inventarios bloqueados" value={bloqueoResultado.inventariosBloqueados} tone="emerald" />
                <ResultStat isDark={isDark} label="Inventarios fallidos" value={bloqueoResultado.inventariosFallidos} tone={bloqueoResultado.inventariosFallidos > 0 ? 'red' : 'zinc'} />
                <ResultStat isDark={isDark} label="Tareas creadas" value={bloqueoResultado.tareasCreadas} tone="emerald" />
                <ResultStat isDark={isDark} label="Tareas fallidas" value={bloqueoResultado.tareasFallidas} tone={bloqueoResultado.tareasFallidas > 0 ? 'red' : 'zinc'} />
              </div>
              {bloqueoResultado.skippedPropuestas.length > 0 && (
                <div>
                  <div className={`flex items-center gap-2 mb-1.5 ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span className="font-semibold">
                      {bloqueoResultado.skippedPropuestas.length} tarjeta(s) sin tarea (propuestas sin campaña)
                    </span>
                  </div>
                  <div className={`rounded-lg border ${isDark ? 'border-amber-500/30 bg-amber-500/5' : 'border-amber-200 bg-amber-50'} p-2 max-h-40 overflow-y-auto`}>
                    <ul className={`space-y-0.5 ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>
                      {bloqueoResultado.skippedPropuestas.map(s => (
                        <li key={s.reserva_id} className="flex items-center gap-2 text-[11px]">
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          <a
                            href={`/propuestas?viewId=${s.propuesta_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`hover:underline ${isDark ? 'text-amber-300' : 'text-amber-700'}`}
                          >
                            Propuesta #{s.propuesta_id}
                          </a>
                          <span className={isDark ? 'text-zinc-500' : 'text-gray-500'}>·</span>
                          <span className="font-mono">{s.inventario_codigo || 'sin código'}</span>
                          <span className={isDark ? 'text-zinc-500' : 'text-gray-500'}>·</span>
                          <span>{s.catorcena}</span>
                          <span className={isDark ? 'text-zinc-500' : 'text-gray-500'}>· res#{s.reserva_id}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
            <div className={`p-4 border-t ${isDark ? 'border-zinc-800' : 'border-gray-200'} flex items-center justify-end`}>
              <button
                onClick={() => setResultadoOpen(false)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium ${isDark ? 'bg-rose-500 text-white hover:bg-rose-600' : 'bg-rose-600 text-white hover:bg-rose-700'}`}
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ====== Helpers para resultado ======
function ResultStat({ isDark, label, value, tone }: { isDark: boolean; label: string; value: number; tone: 'emerald' | 'red' | 'zinc' }) {
  const toneClass = tone === 'emerald'
    ? isDark ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
    : tone === 'red'
      ? isDark ? 'bg-red-500/10 border-red-500/30 text-red-300' : 'bg-red-50 border-red-200 text-red-700'
      : isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-300' : 'bg-gray-50 border-gray-200 text-gray-600';
  return (
    <div className={`rounded-lg border px-3 py-2 ${toneClass}`}>
      <div className="text-[10px] uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-lg font-bold mt-0.5">{value}</div>
    </div>
  );
}

// ====== Matriz View ======
interface MatrizBloqueoViewProps {
  matriz: MatrizOcupacion | null;
  building: boolean;
  isDark: boolean;
  canBlock: boolean;
  selectedInventarios: Set<number>;
  setSelectedInventarios: (s: Set<number>) => void;
  selectedReservas: Set<number>;
  setSelectedReservas: (s: Set<number>) => void;
  bloqueadosLocal: Set<number>;
  inventariosObjetivoCount: number;
  tarjetasAfectadasCount: number;
  tarjetasAfectadasPropuestaCount: number;
  traficoCount: number;
  onOpenConfirm: () => void;
  onDownloadCsv: () => void;
  onRefresh: () => Promise<void> | void;
}

function MatrizBloqueoView({
  matriz,
  building,
  isDark,
  canBlock,
  selectedInventarios,
  setSelectedInventarios,
  selectedReservas,
  setSelectedReservas,
  bloqueadosLocal,
  inventariosObjetivoCount,
  onOpenConfirm,
  onDownloadCsv,
  onRefresh,
}: MatrizBloqueoViewProps) {
  const userRole = useAuthStore(s => s.user?.rol);
  const canRelease = userRole === 'DEV'
    || userRole === 'Gerente de Trafico'
    || userRole === 'Coordinador de trafico'
    || userRole === 'Especialista de trafico'
    || userRole === 'Auxiliar de trafico';

  const [campanaFilter, setCampanaFilter] = useState<Set<string>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');
  const filterRef = useRef<HTMLDivElement>(null);

  const [confirmRelease, setConfirmRelease] = useState<{
    card: CampanaEnCelda;
    inventario: InventarioResumen;
    catorcena: CatorcenaRef;
  } | null>(null);
  const [releasing, setReleasing] = useState(false);
  const [releaseError, setReleaseError] = useState<string | null>(null);

  useEffect(() => {
    if (!filterOpen) return;
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [filterOpen]);

  const allCampanas = useMemo(() => {
    if (!matriz) return [] as { label: string; cliente: string }[];
    const map = new Map<string, { label: string; cliente: string }>();
    for (const invCeldas of Object.values(matriz.celdas)) {
      for (const celda of Object.values(invCeldas)) {
        for (const c of celda.campanas) {
          const label = labelForCampana(c);
          if (!map.has(label)) {
            map.set(label, { label, cliente: c.cliente_nombre || 'Sin cliente' });
          }
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [matriz]);

  const filteredOptions = useMemo(() => {
    const q = filterSearch.trim().toLowerCase();
    if (!q) return allCampanas;
    return allCampanas.filter(o =>
      o.label.toLowerCase().includes(q) || o.cliente.toLowerCase().includes(q)
    );
  }, [allCampanas, filterSearch]);

  const isFiltered = campanaFilter.size > 0;

  const toggleCampana = (label: string) => {
    setCampanaFilter(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };
  const clearFilter = () => setCampanaFilter(new Set());
  const selectAllVisible = () =>
    setCampanaFilter(prev => {
      const next = new Set(prev);
      filteredOptions.forEach(o => next.add(o.label));
      return next;
    });

  const cardPasaFiltros = (c: CampanaEnCelda) => {
    if (isFiltered && !campanaFilter.has(labelForCampana(c))) return false;
    return true;
  };

  const inventariosFiltrados = useMemo(() => {
    if (!matriz) return [] as InventarioResumen[];
    if (!isFiltered) return matriz.inventarios;
    return matriz.inventarios.filter(inv => {
      const invCeldas = matriz.celdas[inv.id];
      if (!invCeldas) return false;
      for (const celda of Object.values(invCeldas)) {
        for (const c of celda.campanas) {
          if (campanaFilter.has(labelForCampana(c))) return true;
        }
      }
      return false;
    });
  }, [matriz, campanaFilter, isFiltered]);

  const toggleInventarioRow = (id: number) => {
    if (bloqueadosLocal.has(id)) return;
    const next = new Set(selectedInventarios);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedInventarios(next);
  };

  const toggleReserva = (id: number) => {
    const next = new Set(selectedReservas);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedReservas(next);
  };

  const seleccionablesIds = useMemo(
    () => inventariosFiltrados.filter(i => !bloqueadosLocal.has(i.id)).map(i => i.id),
    [inventariosFiltrados, bloqueadosLocal]
  );
  const allRowsSelected = seleccionablesIds.length > 0 && seleccionablesIds.every(id => selectedInventarios.has(id));
  const toggleAllRows = () => {
    if (allRowsSelected) {
      setSelectedInventarios(new Set());
    } else {
      setSelectedInventarios(new Set(seleccionablesIds));
    }
  };

  const handleConfirmRelease = async () => {
    if (!confirmRelease || !canRelease) return;
    if (confirmRelease.card.aps && confirmRelease.card.aps > 0) {
      setReleaseError(
        confirmRelease.card.posted
          ? 'Esta reserva tiene POST y no se puede eliminar'
          : 'Esta reserva tiene APS asignado y no se puede eliminar'
      );
      return;
    }
    setReleasing(true);
    setReleaseError(null);
    try {
      const { card } = confirmRelease;
      if (card.campana_id) {
        await campanasService.deleteReservas(card.campana_id, [card.reserva_id]);
      } else if (card.propuesta_id) {
        await propuestasService.deleteReservas(card.propuesta_id, [card.reserva_id]);
      } else {
        throw new Error('La reserva no tiene campaña ni propuesta asociada');
      }
      setConfirmRelease(null);
      await onRefresh();
    } catch (err) {
      setReleaseError(err instanceof Error ? err.message : 'Error al liberar la reserva');
    } finally {
      setReleasing(false);
    }
  };

  if (building || !matriz) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
        <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Construyendo matriz de ocupación...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <div ref={filterRef} className="relative">
          <button
            onClick={() => setFilterOpen(o => !o)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
              isFiltered
                ? isDark ? 'bg-rose-500/20 text-rose-200 border-rose-500/40 hover:bg-rose-500/30' : 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
                : isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
            title="Filtrar campañas en la matriz"
          >
            <Filter className="h-3.5 w-3.5" />
            <span>
              {isFiltered ? `${campanaFilter.size} de ${allCampanas.length} campañas` : `Filtrar campañas (${allCampanas.length})`}
            </span>
            {isFiltered && (
              <span
                role="button"
                onClick={e => { e.stopPropagation(); clearFilter(); }}
                className={`flex items-center justify-center rounded-full p-0.5 ${isDark ? 'hover:bg-rose-500/40' : 'hover:bg-rose-200'}`}
                title="Limpiar filtro"
              >
                <X className="h-3 w-3" />
              </span>
            )}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
          </button>
          {filterOpen && (
            <div className={`absolute z-30 mt-1 left-0 w-80 rounded-lg border shadow-xl ${isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200'}`}>
              <div className={`p-2 border-b ${isDark ? 'border-zinc-800' : 'border-gray-100'}`}>
                <div className={`flex items-center gap-2 px-2 py-1 rounded-md border ${isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-gray-50 border-gray-200'}`}>
                  <Search className={`h-3.5 w-3.5 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} />
                  <input
                    autoFocus
                    type="text"
                    value={filterSearch}
                    onChange={e => setFilterSearch(e.target.value)}
                    placeholder="Buscar campaña o cliente..."
                    className={`flex-1 bg-transparent text-xs outline-none ${isDark ? 'text-white placeholder:text-zinc-500' : 'text-gray-900 placeholder:text-gray-400'}`}
                  />
                  {filterSearch && (
                    <button onClick={() => setFilterSearch('')} className={isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-gray-400 hover:text-gray-600'}>
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between mt-2 text-[10px]">
                  <button
                    onClick={selectAllVisible}
                    disabled={filteredOptions.length === 0}
                    className={`px-2 py-0.5 rounded ${isDark ? 'text-rose-300 hover:bg-rose-500/15' : 'text-rose-700 hover:bg-rose-50'} disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    Seleccionar {filterSearch ? 'visibles' : 'todas'}
                  </button>
                  <button
                    onClick={clearFilter}
                    disabled={!isFiltered}
                    className={`px-2 py-0.5 rounded ${isDark ? 'text-zinc-400 hover:bg-zinc-800' : 'text-gray-600 hover:bg-gray-100'} disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    Limpiar
                  </button>
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto py-1">
                {filteredOptions.length === 0 ? (
                  <div className={`px-3 py-4 text-center text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Sin coincidencias</div>
                ) : (
                  filteredOptions.map(opt => {
                    const selected = campanaFilter.has(opt.label);
                    return (
                      <label key={opt.label} className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer text-xs ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-50'}`}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleCampana(opt.label)}
                          className="accent-rose-500 h-3.5 w-3.5 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className={`truncate ${isDark ? 'text-zinc-200' : 'text-gray-800'}`} title={opt.label}>{opt.label}</div>
                          <div className={`text-[10px] truncate ${isDark ? 'text-zinc-500' : 'text-gray-500'}`} title={opt.cliente}>{opt.cliente}</div>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {isFiltered && (
          <span className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
            Mostrando {inventariosFiltrados.length} de {matriz.inventarios.length} inventarios
          </span>
        )}

        <button
          onClick={onDownloadCsv}
          title="Descargar la matriz como CSV"
          className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}
        >
          <Download className="h-3.5 w-3.5" />
          Descargar CSV
        </button>

        {canBlock && (
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs ${isDark ? 'bg-rose-500/20 border-rose-500/40 text-rose-200' : 'bg-rose-50 border-rose-300 text-rose-800'}`}>
            <button
              onClick={toggleAllRows}
              disabled={seleccionablesIds.length === 0}
              className={`flex items-center gap-1 px-2 py-0.5 rounded font-medium ${isDark ? 'hover:bg-rose-500/30 disabled:opacity-40' : 'hover:bg-rose-100 disabled:opacity-40'}`}
              title={allRowsSelected ? 'Deseleccionar todas las filas' : 'Seleccionar todas las filas visibles'}
            >
              {allRowsSelected ? 'Deseleccionar filas' : `Seleccionar filas (${seleccionablesIds.length})`}
            </button>
            {inventariosObjetivoCount > 0 && (
              <>
                <span className={isDark ? 'text-rose-300/50' : 'text-rose-400'}>·</span>
                <span className="font-semibold">
                  {inventariosObjetivoCount} {inventariosObjetivoCount === 1 ? 'inv. objetivo' : 'invs. objetivo'}
                </span>
                <button
                  onClick={onOpenConfirm}
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded font-medium ${isDark ? 'bg-rose-500/40 text-rose-100 hover:bg-rose-500/60' : 'bg-rose-600 text-white hover:bg-rose-700'}`}
                >
                  <Ban className="h-3 w-3" />
                  Bloquear seleccionados
                </button>
                <button
                  onClick={() => { setSelectedInventarios(new Set()); setSelectedReservas(new Set()); }}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${isDark ? 'hover:bg-rose-500/30' : 'hover:bg-rose-100'}`}
                  title="Limpiar selección"
                >
                  <X className="h-3 w-3" />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {bloqueadosLocal.size > 0 && (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs ${isDark ? 'border-zinc-700 bg-zinc-800/60 text-zinc-300' : 'border-gray-200 bg-gray-50 text-gray-700'}`}>
          <Ban className={`h-3.5 w-3.5 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`} />
          <span>
            {bloqueadosLocal.size} {bloqueadosLocal.size === 1 ? 'inventario bloqueado' : 'inventarios bloqueados'} en esta sesión. Sus tarjetas siguen visibles en gris.
          </span>
          <button
            onClick={() => void onRefresh()}
            className={`ml-auto px-2 py-0.5 rounded font-medium ${isDark ? 'text-rose-300 hover:bg-rose-500/15' : 'text-rose-700 hover:bg-rose-50'}`}
            title="Reconstruir la matriz desde el servidor (las reservas eliminadas dejarán de aparecer)"
          >
            Reconstruir matriz
          </button>
        </div>
      )}

      <div className="flex-1 overflow-auto min-h-0">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className={`sticky left-0 top-0 z-20 px-3 py-2 text-left text-xs font-semibold border-b ${isDark ? 'border-rose-500/30 bg-zinc-900 text-rose-300' : 'border-rose-200 bg-white text-rose-700'} min-w-[220px]`}>
                <div className="flex items-center gap-2">
                  {canBlock && (
                    <input
                      type="checkbox"
                      checked={allRowsSelected}
                      onChange={toggleAllRows}
                      disabled={seleccionablesIds.length === 0}
                      className="accent-rose-500 h-3.5 w-3.5 shrink-0"
                      title="Seleccionar todas las filas"
                    />
                  )}
                  Inventario
                </div>
              </th>
              {matriz.catorcenas.map(c => (
                <th key={cellKeyOf(c)} className={`sticky top-0 z-10 px-3 py-2 text-center text-xs font-semibold border-b ${isDark ? 'border-rose-500/30 bg-zinc-900 text-rose-300' : 'border-rose-200 bg-white text-rose-700'} min-w-[120px]`}>
                  C{c.numero}-{c.anio}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {inventariosFiltrados.length === 0 && (
              <tr>
                <td colSpan={matriz.catorcenas.length + 1} className={`px-3 py-8 text-center text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                  Ningún inventario tiene las campañas seleccionadas.
                </td>
              </tr>
            )}
            {inventariosFiltrados.map(inv => {
              const isBloqueadoLocal = bloqueadosLocal.has(inv.id);
              const isRowSelected = selectedInventarios.has(inv.id);
              const rowBg = isBloqueadoLocal
                ? isDark ? 'bg-zinc-800/40' : 'bg-gray-100/60'
                : isRowSelected
                  ? isDark ? 'bg-rose-500/10' : 'bg-rose-50/60'
                  : isDark ? 'bg-zinc-900' : 'bg-white';
              return (
                <tr key={inv.id} className={`border-b ${isDark ? 'border-zinc-800' : 'border-gray-100'}`}>
                  <td className={`sticky left-0 z-10 px-3 py-2 ${rowBg} border-r ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
                    <div className="flex items-center gap-2">
                      {canBlock && (
                        <input
                          type="checkbox"
                          checked={isRowSelected}
                          onChange={() => toggleInventarioRow(inv.id)}
                          disabled={isBloqueadoLocal}
                          className="accent-rose-500 h-3.5 w-3.5 shrink-0"
                          title={isBloqueadoLocal ? 'Inventario ya bloqueado en esta sesión' : 'Seleccionar inventario para bloqueo'}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-mono text-xs font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{inv.codigo_unico}</span>
                          <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-medium border ${inv.tradicional_digital === 'Digital' ? (isDark ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' : 'bg-cyan-50 text-cyan-700 border-cyan-200') : (isDark ? 'bg-pink-500/20 text-pink-300 border-pink-500/30' : 'bg-pink-50 text-pink-700 border-pink-200')}`}>
                            {inv.tradicional_digital || 'Tradicional'}
                          </span>
                          {isBloqueadoLocal && (
                            <span className={`shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium border ${isDark ? 'bg-zinc-700/60 text-zinc-300 border-zinc-600' : 'bg-gray-200 text-gray-700 border-gray-300'}`}>
                              <Ban className="h-2.5 w-2.5" /> Bloqueado
                            </span>
                          )}
                        </div>
                        <div className={`text-[10px] mt-0.5 ${isDark ? 'text-zinc-500' : 'text-gray-500'} truncate max-w-[200px]`} title={inv.ubicacion || undefined}>
                          {inv.plaza || '-'} · {inv.mueble || '-'}
                        </div>
                      </div>
                    </div>
                  </td>
                  {matriz.catorcenas.map(cat => {
                    const celda = matriz.celdas[inv.id]?.[cellKeyOf(cat)];
                    const ocupado = celda?.ocupado;
                    const todasCampanas = celda?.campanas || [];
                    const algunFiltroActivo = isFiltered;
                    const campanas = algunFiltroActivo ? todasCampanas.filter(cardPasaFiltros) : todasCampanas;

                    if (!ocupado || todasCampanas.length === 0) {
                      const disponibleClass = isBloqueadoLocal
                        ? isDark ? 'bg-zinc-800/40 border-zinc-700' : 'bg-gray-100 border-gray-300'
                        : isDark ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200';
                      const txtClass = isBloqueadoLocal
                        ? isDark ? 'text-zinc-400' : 'text-gray-500'
                        : isDark ? 'text-emerald-300' : 'text-emerald-700';
                      return (
                        <td key={cellKeyOf(cat)} className="px-1.5 py-1.5 align-top">
                          <div className={`w-full rounded-md p-2 border ${disponibleClass}`}>
                            <div className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide ${txtClass}`}>
                              {isBloqueadoLocal ? 'Bloqueado' : 'Disponible'}
                            </div>
                          </div>
                        </td>
                      );
                    }

                    if (campanas.length === 0) {
                      const oculto = todasCampanas.length;
                      return (
                        <td key={cellKeyOf(cat)} className="px-1.5 py-1.5 align-top">
                          <div
                            className={`w-full rounded-md p-2 border border-dashed text-center ${isDark ? 'border-zinc-700 text-zinc-600' : 'border-gray-300 text-gray-400'}`}
                            title={`${oculto} campaña(s) ocultas por el filtro`}
                          >
                            <span className="text-[10px] font-medium">— {oculto} oculto{oculto > 1 ? 's' : ''}</span>
                          </div>
                        </td>
                      );
                    }

                    return (
                      <td key={cellKeyOf(cat)} className="px-1.5 py-1.5 align-top">
                        <div className="flex flex-col gap-1.5">
                          {campanas.map(c => {
                            const esPropuesta = !c.campana_id;
                            // Color base
                            let cardClass: string;
                            let statusLabel: string;
                            let statusTextClass: string;
                            if (isBloqueadoLocal) {
                              cardClass = isDark
                                ? 'bg-zinc-800/60 border-zinc-600 hover:bg-zinc-800'
                                : 'bg-gray-100 border-gray-300 hover:bg-gray-200';
                              statusLabel = 'Bloqueado';
                              statusTextClass = isDark ? 'text-zinc-300' : 'text-gray-600';
                            } else if (esPropuesta) {
                              cardClass = isDark
                                ? 'bg-amber-500/10 border-amber-500/40 hover:bg-amber-500/20'
                                : 'bg-amber-50 border-amber-200 hover:bg-amber-100';
                              statusLabel = 'Reservado';
                              statusTextClass = isDark ? 'text-amber-300' : 'text-amber-700';
                            } else {
                              cardClass = isDark
                                ? 'bg-red-500/10 border-red-500/40 hover:bg-red-500/20'
                                : 'bg-red-50 border-red-200 hover:bg-red-100';
                              statusLabel = 'Ocupado';
                              statusTextClass = isDark ? 'text-red-300' : 'text-red-700';
                            }
                            const href = esPropuesta ? `/propuestas?viewId=${c.propuesta_id}` : `/campanas/detail/${c.campana_id}`;
                            const label = esPropuesta ? `Propuesta #${c.propuesta_id}` : c.campana_nombre || `Campaña #${c.campana_id}`;
                            const clienteLabel = c.cliente_nombre || 'Sin cliente';
                            const rangoLabel = c.inicio_periodo && c.fin_periodo ? `${fmtFecha(c.inicio_periodo)} – ${fmtFecha(c.fin_periodo)}` : '';
                            const tieneAPSLocal = !!(c.aps && c.aps > 0);
                            const isCardSelected = selectedReservas.has(c.reserva_id);
                            const selectionRing = isCardSelected
                              ? (isDark ? 'ring-2 ring-rose-400 ring-offset-1 ring-offset-zinc-900' : 'ring-2 ring-rose-500 ring-offset-1 ring-offset-white')
                              : '';
                            const padLeft = canBlock && !isBloqueadoLocal ? 'pl-7' : '';
                            const padRight = canRelease ? 'pr-7' : '';
                            return (
                              <div key={c.reserva_id} className={`relative group/card rounded-md ${selectionRing} ${isBloqueadoLocal ? 'opacity-90' : ''}`}>
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={esPropuesta ? `Editar propuesta #${c.propuesta_id}` : `Abrir campaña: ${label}`}
                                  className={`block w-full text-left rounded-md p-2 ${padLeft} ${padRight} border transition-all cursor-pointer ${cardClass}`}
                                >
                                  <div className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide ${statusTextClass}`}>
                                    {statusLabel}
                                    {isBloqueadoLocal && <Ban className="h-2.5 w-2.5" />}
                                    <ExternalLink className="h-2.5 w-2.5 opacity-70" />
                                  </div>
                                  <div className={`text-[10px] mt-1 truncate underline underline-offset-2 ${isDark ? 'text-zinc-300' : 'text-gray-700'}`} title={label}>
                                    {label}
                                  </div>
                                  <div className={`text-[10px] mt-0.5 truncate ${isDark ? 'text-zinc-500' : 'text-gray-500'}`} title={clienteLabel}>
                                    {clienteLabel}
                                  </div>
                                  {c.articulo && (
                                    <div className={`text-[10px] mt-0.5 truncate font-mono ${isDark ? 'text-rose-300' : 'text-rose-700'}`} title={`Artículo SAP: ${c.articulo}`}>
                                      {c.articulo}
                                    </div>
                                  )}
                                  {rangoLabel && (
                                    <div className={`text-[10px] mt-0.5 truncate font-mono ${isDark ? 'text-zinc-400' : 'text-gray-600'}`} title={`Reserva #${c.reserva_id} · ${rangoLabel}`}>
                                      {rangoLabel} · #{c.reserva_id}
                                    </div>
                                  )}
                                </a>
                                {canBlock && !isBloqueadoLocal && (
                                  <input
                                    type="checkbox"
                                    checked={isCardSelected}
                                    onChange={() => toggleReserva(c.reserva_id)}
                                    onClick={e => e.stopPropagation()}
                                    title="Marcar para forzar bloqueo del inventario asociado"
                                    className="absolute top-1.5 left-1.5 h-3.5 w-3.5 cursor-pointer accent-rose-500"
                                  />
                                )}
                                {canRelease && !isBloqueadoLocal && (() => {
                                  const tooltipBloqueo = c.posted ? 'Tiene POST, no se puede eliminar' : 'Tiene APS asignado, no se puede eliminar';
                                  return (
                                    <button
                                      type="button"
                                      disabled={tieneAPSLocal}
                                      onClick={e => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (tieneAPSLocal) return;
                                        setConfirmRelease({ card: c, inventario: inv, catorcena: cat });
                                      }}
                                      title={tieneAPSLocal ? tooltipBloqueo : 'Liberar reserva (eliminar de la BD)'}
                                      className={`absolute top-1 right-1 p-1 rounded transition-all ${
                                        tieneAPSLocal
                                          ? `opacity-100 cursor-not-allowed ${isDark ? 'text-zinc-600' : 'text-gray-300'}`
                                          : `opacity-0 group-hover/card:opacity-100 focus:opacity-100 ${isDark ? 'text-zinc-400 hover:text-red-300 hover:bg-red-500/20' : 'text-gray-500 hover:text-red-600 hover:bg-red-100'}`
                                      }`}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  );
                                })()}
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {confirmRelease && (
        <div
          className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4"
          onClick={() => !releasing && setConfirmRelease(null)}
        >
          <div
            className={`rounded-2xl border ${isDark ? 'bg-zinc-900 border-red-500/30' : 'bg-white border-red-200'} w-full max-w-md shadow-2xl`}
            onClick={e => e.stopPropagation()}
          >
            <div className={`p-5 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-red-500/20' : 'bg-red-50'}`}>
                  <AlertCircle className={`h-5 w-5 ${isDark ? 'text-red-300' : 'text-red-600'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Liberar reserva</h3>
                  <p className={`text-xs mt-1 ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
                    Vas a eliminar la reserva de {confirmRelease.card.campana_id ? 'la campaña' : 'la propuesta'}.
                    Esta acción es irreversible.
                  </p>
                </div>
              </div>
            </div>
            <div className="p-5 text-xs space-y-1">
              <div className={isDark ? 'text-zinc-300' : 'text-gray-700'}>
                <span className={isDark ? 'text-zinc-500' : 'text-gray-500'}>Inventario:</span>{' '}
                <span className="font-mono">{confirmRelease.inventario.codigo_unico}</span>
              </div>
              <div className={isDark ? 'text-zinc-300' : 'text-gray-700'}>
                <span className={isDark ? 'text-zinc-500' : 'text-gray-500'}>Catorcena:</span>{' '}
                C{confirmRelease.catorcena.numero}-{confirmRelease.catorcena.anio}
              </div>
              <div className={isDark ? 'text-zinc-300' : 'text-gray-700'}>
                <span className={isDark ? 'text-zinc-500' : 'text-gray-500'}>Referencia:</span>{' '}
                {confirmRelease.card.campana_id
                  ? `Campaña #${confirmRelease.card.campana_id} — ${confirmRelease.card.campana_nombre || ''}`
                  : `Propuesta #${confirmRelease.card.propuesta_id}`}
              </div>
              {releaseError && (
                <div className={`mt-2 px-3 py-2 rounded-lg text-xs ${isDark ? 'bg-red-500/10 text-red-300 border border-red-500/30' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {releaseError}
                </div>
              )}
            </div>
            <div className={`p-4 border-t ${isDark ? 'border-zinc-800' : 'border-gray-200'} flex items-center justify-end gap-2`}>
              <button
                onClick={() => setConfirmRelease(null)}
                disabled={releasing}
                className={`px-3 py-1.5 rounded-lg text-sm ${isDark ? 'text-zinc-400 hover:bg-zinc-800' : 'text-gray-600 hover:bg-gray-100'} disabled:opacity-50`}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmRelease}
                disabled={releasing}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium ${isDark ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-red-600 text-white hover:bg-red-700'} disabled:opacity-50`}
              >
                {releasing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                {releasing ? 'Liberando...' : 'Liberar reserva'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
