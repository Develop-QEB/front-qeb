import { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  X, Search, Loader2, ArrowLeft, ArrowRight, Upload, Download, AlertCircle,
  CheckCircle2, ChevronDown, ChevronRight, ExternalLink, RefreshCw, FileText,
  Calendar, Building2, AlertTriangle, Layers,
} from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';
import { campanasService } from '../../services/campanas.service';
import {
  reorganizarOcupacionService,
  CampanaRO,
  CatorcenaRefRO,
  CircuitoFormatoRO,
  ComparacionResult,
  ItemComparacion,
  InventarioCircuitoSinCsv,
  OcupacionExterna,
  AgregarItemInput,
} from '../../services/reorganizarOcupacion.service';

type Step = 'buscar' | 'circuitos' | 'detalle' | 'comparar' | 'confirmar';

interface Props {
  open: boolean;
  onClose: () => void;
}

// Parseo CSV. Detecta separador y la columna "Código Único" por header.
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

function fmtDate(d: string | Date | undefined | null): string {
  if (!d) return '-';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function ReorganizarOcupacionModal({ open, onClose }: Props) {
  const isDark = useThemeStore(s => s.theme) === 'dark';

  const [step, setStep] = useState<Step>('buscar');

  // Step 1
  const [campanaQuery, setCampanaQuery] = useState('');
  const [campanaQueryDebounced, setCampanaQueryDebounced] = useState('');
  const [campanaSelected, setCampanaSelected] = useState<CampanaRO | null>(null);
  const [showDropdownCampana, setShowDropdownCampana] = useState(false);
  const [catorcenaSelected, setCatorcenaSelected] = useState<CatorcenaRefRO | null>(null);
  const campanaInputRef = useRef<HTMLInputElement>(null);
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);

  // Step 2
  const [circuitoSeleccionado, setCircuitoSeleccionado] = useState<CircuitoFormatoRO | null>(null);
  const [circuitosExpand, setCircuitosExpand] = useState<Record<number, boolean>>({});

  // Step 3
  const [csvCodigos, setCsvCodigos] = useState<string[]>([]);
  const [csvFeedbackMsg, setCsvFeedbackMsg] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // Step 4: selecciones manuales
  // grupoA: codigo_unico → sustituye_reserva_id (del listado en_circuito_sin_csv)
  const [grupoASel, setGrupoASel] = useState<Map<string, number>>(new Map());
  // grupoB: codigo_unico → { sustituye_reserva_id, reserva_origen_id }
  const [grupoBSel, setGrupoBSel] = useState<Map<string, { sustituye_reserva_id: number; reserva_origen_id: number }>>(new Map());
  const [grupoBDescargado, setGrupoBDescargado] = useState(false);

  // Mensajes de error
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ----- Reset al abrir -----
  useEffect(() => {
    if (!open) return;
    setStep('buscar');
    setCampanaQuery('');
    setCampanaQueryDebounced('');
    setCampanaSelected(null);
    setCatorcenaSelected(null);
    setCircuitoSeleccionado(null);
    setCircuitosExpand({});
    setCsvCodigos([]);
    setCsvFeedbackMsg(null);
    setGrupoASel(new Map());
    setGrupoBSel(new Map());
    setGrupoBDescargado(false);
    setErrorMsg(null);
    setSuccessMsg(null);
  }, [open]);

  // ----- Debounce búsqueda campaña -----
  useEffect(() => {
    const t = setTimeout(() => setCampanaQueryDebounced(campanaQuery), 350);
    return () => clearTimeout(t);
  }, [campanaQuery]);

  // ----- Recalcular posición del dropdown del autocomplete -----
  useLayoutEffect(() => {
    if (!showDropdownCampana) {
      setDropdownRect(null);
      return;
    }
    const update = () => {
      const el = campanaInputRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setDropdownRect({ top: r.bottom + 4, left: r.left, width: r.width });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [showDropdownCampana, campanaQueryDebounced, step]);

  // ----- Búsqueda de campañas -----
  const { data: campanasFound, isLoading: loadingCampanas } = useQuery({
    queryKey: ['ro-campanas', campanaQueryDebounced],
    queryFn: () => campanasService.getAll({ search: campanaQueryDebounced, limit: 20 }),
    enabled: open && campanaQueryDebounced.length >= 2,
  });

  // ----- Catorcenas de la campaña seleccionada -----
  const { data: catorcenasData, isLoading: loadingCatorcenas } = useQuery({
    queryKey: ['ro-catorcenas', campanaSelected?.id],
    queryFn: () => reorganizarOcupacionService.getCatorcenasDeCampana(campanaSelected!.id),
    enabled: open && !!campanaSelected,
  });

  // ----- Circuitos por catorcena -----
  const { data: circuitosData, isLoading: loadingCircuitos, refetch: refetchCircuitos } = useQuery({
    queryKey: ['ro-circuitos', campanaSelected?.id, catorcenaSelected?.numero, catorcenaSelected?.anio],
    queryFn: () => reorganizarOcupacionService.getCircuitosPorCatorcena(
      campanaSelected!.id,
      catorcenaSelected!.numero,
      catorcenaSelected!.anio,
    ),
    enabled: false,
  });

  // ----- Comparar CSV vs circuito -----
  const [comparacion, setComparacion] = useState<ComparacionResult | null>(null);
  const compararMutation = useMutation({
    mutationFn: (vars: { scId: number; codigos: string[] }) =>
      reorganizarOcupacionService.comparar(vars.scId, vars.codigos),
    onSuccess: data => {
      setComparacion(data);
      setStep('comparar');
      setErrorMsg(null);
    },
    onError: (err: unknown) => {
      setErrorMsg(err instanceof Error ? err.message : 'Error al comparar');
    },
  });

  // ----- Aplicar reorganización -----
  const aplicarMutation = useMutation({
    mutationFn: (vars: { scId: number; agregar: AgregarItemInput[] }) =>
      reorganizarOcupacionService.aplicar(vars.scId, vars.agregar),
    onSuccess: data => {
      setSuccessMsg(
        `Reorganización aplicada: ${data.reservas_creadas} creadas, ${data.reservas_sustituidas} sustituidas, ${data.reservas_liberadas} liberadas.`,
      );
      setErrorMsg(null);
    },
    onError: (err: unknown) => {
      setErrorMsg(err instanceof Error ? err.message : 'Error al aplicar');
    },
  });

  // ----- Handlers -----
  const handleSelectCampana = (c: { id: number; nombre: string; cotizacion_id?: number | null }) => {
    setCampanaSelected({ id: c.id, nombre: c.nombre, cotizacion_id: c.cotizacion_id });
    setCampanaQuery(c.nombre);
    setShowDropdownCampana(false);
    setCatorcenaSelected(null);
  };

  const handleBuscarCircuitos = async () => {
    if (!campanaSelected || !catorcenaSelected) return;
    setErrorMsg(null);
    await refetchCircuitos();
    setStep('circuitos');
  };

  const handleSelectCircuito = (c: CircuitoFormatoRO) => {
    setCircuitoSeleccionado(c);
    setCsvCodigos([]);
    setCsvFeedbackMsg(null);
    setGrupoASel(new Map());
    setGrupoBSel(new Map());
    setGrupoBDescargado(false);
    setComparacion(null);
    setStep('detalle');
  };

  const handleCsvUpload = async (file: File) => {
    if (!circuitoSeleccionado) return;
    setCsvFeedbackMsg(null);
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
        setCsvFeedbackMsg('El CSV no tiene códigos válidos');
        return;
      }
      if (codes.length > circuitoSeleccionado.caras_totales) {
        setCsvFeedbackMsg(
          `El CSV tiene ${codes.length} códigos pero el circuito solo soporta ${circuitoSeleccionado.caras_totales}. Reduce el listado.`,
        );
        return;
      }

      setCsvCodigos(codes);
      setCsvFeedbackMsg(`${codes.length} códigos cargados (máximo ${circuitoSeleccionado.caras_totales})`);
    } catch (err) {
      console.error('Error parseando CSV:', err);
      setCsvFeedbackMsg('No se pudo leer el archivo');
    } finally {
      if (csvInputRef.current) csvInputRef.current.value = '';
    }
  };

  const handleComparar = () => {
    if (!circuitoSeleccionado || csvCodigos.length === 0) return;
    compararMutation.mutate({
      scId: circuitoSeleccionado.solicitud_caras_id,
      codigos: csvCodigos,
    });
  };

  // Agrupar items de comparación
  const grupos = useMemo(() => {
    if (!comparacion) return { enCircEnCsv: [], grupoA: [], grupoB: [], noEncontrados: [] };
    const noEnc = comparacion.items.filter(i => !i.existe);
    const grupoA = comparacion.items.filter(i => i.existe && i.estado === 'disponible');
    const grupoB = comparacion.items.filter(i => i.existe && i.estado === 'ocupado_en_otra');
    const enCircEnCsv = comparacion.items.filter(i => i.existe && i.estado === 'en_circuito');
    return { enCircEnCsv, grupoA, grupoB, noEncontrados: noEnc };
  }, [comparacion]);

  // Reservas del circuito que quedan disponibles para sustituir (las "sin CSV")
  // Quitamos las ya seleccionadas como destino de Grupo A o Grupo B
  const reservasDisponiblesParaSustituir = useMemo(() => {
    if (!comparacion) return [];
    const usadas = new Set<number>();
    for (const v of grupoASel.values()) usadas.add(v);
    for (const v of grupoBSel.values()) usadas.add(v.sustituye_reserva_id);
    return comparacion.en_circuito_sin_csv.filter(r => !usadas.has(r.reserva_id));
  }, [comparacion, grupoASel, grupoBSel]);

  const handleDescargarGrupoB = () => {
    if (!comparacion) return;
    const rows: string[] = ['codigo_unico,campana_id,campana_nombre,cliente,reserva_id,propuesta_id,solicitud_caras_id,articulo,inicio_periodo,fin_periodo'];
    for (const item of grupos.grupoB) {
      for (const o of item.ocupaciones || []) {
        const safe = (v: string | number | null | undefined) =>
          v == null ? '' : String(v).replace(/"/g, '""');
        rows.push(
          [
            `"${safe(item.codigo_unico)}"`,
            safe(o.campana_id),
            `"${safe(o.campana_nombre)}"`,
            `"${safe(o.cliente_nombre)}"`,
            safe(o.reserva_id),
            safe(o.propuesta_id),
            safe(o.solicitud_caras_id),
            `"${safe(o.articulo)}"`,
            safe(typeof o.inicio_periodo === 'string' ? o.inicio_periodo.slice(0, 10) : ''),
            safe(typeof o.fin_periodo === 'string' ? o.fin_periodo.slice(0, 10) : ''),
          ].join(','),
        );
      }
    }
    const csv = rows.join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `grupo-b-ocupados-${comparacion.circuito.solicitud_caras_id}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setGrupoBDescargado(true);
  };

  // Payload final para aplicar
  const payloadAplicar: AgregarItemInput[] = useMemo(() => {
    if (!comparacion) return [];
    const items: AgregarItemInput[] = [];
    // Grupo A
    for (const it of grupos.grupoA) {
      const sustituye = grupoASel.get(it.codigo_unico);
      if (sustituye && it.inventario) {
        items.push({
          inventario_id: it.inventario.id,
          reserva_origen_id: null,
          sustituye_reserva_id: sustituye,
        });
      }
    }
    // Grupo B
    for (const it of grupos.grupoB) {
      const sel = grupoBSel.get(it.codigo_unico);
      if (sel && it.inventario) {
        items.push({
          inventario_id: it.inventario.id,
          reserva_origen_id: sel.reserva_origen_id,
          sustituye_reserva_id: sel.sustituye_reserva_id,
        });
      }
    }
    return items;
  }, [comparacion, grupos.grupoA, grupos.grupoB, grupoASel, grupoBSel]);

  const handleAplicar = () => {
    if (!circuitoSeleccionado || payloadAplicar.length === 0) return;
    aplicarMutation.mutate({
      scId: circuitoSeleccionado.solicitud_caras_id,
      agregar: payloadAplicar,
    });
  };

  // ----- Render -----
  if (!open) return null;

  const stepIndex =
    step === 'buscar' ? 1 :
    step === 'circuitos' ? 2 :
    step === 'detalle' ? 3 :
    step === 'comparar' ? 4 : 5;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className={`${isDark ? 'bg-zinc-900' : 'bg-white'} rounded-2xl border ${isDark ? 'border-cyan-500/20' : 'border-cyan-200'} w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl shadow-cyan-500/10`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`p-5 border-b ${isDark ? 'border-cyan-500/20 bg-gradient-to-r from-cyan-900/20 via-teal-900/10 to-cyan-900/20' : 'border-cyan-200 bg-gradient-to-r from-cyan-50 via-teal-50 to-cyan-50'} flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${isDark ? 'bg-cyan-500/20' : 'bg-cyan-50'} flex items-center justify-center`}>
              <RefreshCw className={`h-5 w-5 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} />
            </div>
            <div>
              <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Revisar por Campaña</h2>
              <p className={`text-xs ${isDark ? 'text-cyan-300/50' : 'text-cyan-500'}`}>
                Paso {stepIndex} de 5 · DEV
              </p>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg ${isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'}`}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step indicators */}
        <div className={`flex items-center px-5 py-2 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'} gap-2 text-xs overflow-x-auto`}>
          {(['buscar', 'circuitos', 'detalle', 'comparar', 'confirmar'] as const).map((s, idx) => {
            const active = step === s;
            const done = stepIndex > idx + 1;
            const label = s === 'buscar' ? 'Buscar' : s === 'circuitos' ? 'Circuitos' : s === 'detalle' ? 'Circuito + CSV' : s === 'comparar' ? 'Comparar' : 'Confirmar';
            return (
              <div key={s} className="flex items-center gap-2 shrink-0">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center font-semibold ${
                  active
                    ? isDark ? 'bg-cyan-500 text-white' : 'bg-cyan-600 text-white'
                    : done
                      ? isDark ? 'bg-emerald-500/30 text-emerald-300' : 'bg-emerald-100 text-emerald-700'
                      : isDark ? 'bg-zinc-800 text-zinc-500' : 'bg-gray-100 text-gray-400'
                }`}>
                  {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : idx + 1}
                </div>
                <span className={active ? (isDark ? 'text-cyan-300 font-medium' : 'text-cyan-700 font-medium') : isDark ? 'text-zinc-500' : 'text-gray-400'}>
                  {label}
                </span>
                {idx < 4 && <ChevronRight className={`h-3 w-3 ${isDark ? 'text-zinc-700' : 'text-gray-300'}`} />}
              </div>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-5">
          {errorMsg && (
            <div className={`mb-3 p-3 rounded-lg border ${isDark ? 'bg-red-500/10 border-red-500/30 text-red-300' : 'bg-red-50 border-red-200 text-red-700'} text-sm flex items-start gap-2`}>
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {step === 'buscar' && (
            <div className="space-y-4">
              <div>
                <label className={`text-xs font-semibold ${isDark ? 'text-zinc-400' : 'text-gray-600'} block mb-1.5`}>
                  Campaña
                </label>
                <div className="relative">
                  <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} />
                  <input
                    ref={campanaInputRef}
                    type="text"
                    value={campanaQuery}
                    onChange={e => {
                      setCampanaQuery(e.target.value);
                      setShowDropdownCampana(true);
                      if (campanaSelected && e.target.value !== campanaSelected.nombre) {
                        setCampanaSelected(null);
                        setCatorcenaSelected(null);
                      }
                    }}
                    onFocus={() => setShowDropdownCampana(true)}
                    placeholder="Buscar campaña por nombre, marca, cliente o id..."
                    className={`w-full pl-10 pr-3 py-2.5 rounded-lg border text-sm ${isDark ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500' : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400'} focus:outline-none focus:ring-1 focus:ring-cyan-500/50`}
                  />
                </div>
                {showDropdownCampana && campanaQueryDebounced.length >= 2 && dropdownRect && createPortal(
                  <>
                    <div className="fixed inset-0 z-[60]" onClick={() => setShowDropdownCampana(false)} />
                    <div
                      style={{ position: 'fixed', top: dropdownRect.top, left: dropdownRect.left, width: dropdownRect.width }}
                      className={`max-h-64 overflow-auto rounded-lg border ${isDark ? 'border-zinc-700 bg-zinc-900' : 'border-gray-200 bg-white'} shadow-2xl z-[70]`}
                    >
                      {loadingCampanas && (
                        <div className={`p-3 text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'} flex items-center gap-2`}>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando...
                        </div>
                      )}
                      {!loadingCampanas && campanasFound?.data?.length === 0 && (
                        <div className={`p-3 text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Sin resultados</div>
                      )}
                      {!loadingCampanas && campanasFound?.data?.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => handleSelectCampana({ id: c.id, nombre: c.nombre, cotizacion_id: (c as { cotizacion_id?: number | null }).cotizacion_id })}
                          className={`w-full text-left px-3 py-2 text-sm border-b ${isDark ? 'border-zinc-800 hover:bg-zinc-800 text-zinc-200' : 'border-gray-100 hover:bg-gray-50 text-gray-800'}`}
                        >
                          <div className="font-medium">{c.nombre}</div>
                          <div className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
                            ID #{c.id} {(c as { cliente_nombre?: string }).cliente_nombre ? `· ${(c as { cliente_nombre?: string }).cliente_nombre}` : ''}
                          </div>
                        </button>
                      ))}
                    </div>
                  </>,
                  document.body,
                )}
              </div>

              {campanaSelected && (
                <div>
                  <label className={`text-xs font-semibold ${isDark ? 'text-zinc-400' : 'text-gray-600'} block mb-1.5`}>
                    Catorcena
                  </label>
                  {loadingCatorcenas ? (
                    <div className="flex items-center gap-2 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" /> Cargando catorcenas...
                    </div>
                  ) : catorcenasData?.catorcenas?.length === 0 ? (
                    <div className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'} p-3 rounded border border-dashed ${isDark ? 'border-zinc-700' : 'border-gray-300'}`}>
                      Esta campaña no tiene catorcenas asignadas.
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                      {catorcenasData?.catorcenas?.map(c => {
                        const sel = catorcenaSelected?.numero === c.numero && catorcenaSelected?.anio === c.anio;
                        return (
                          <button
                            key={`${c.anio}-${c.numero}`}
                            onClick={() => setCatorcenaSelected(c)}
                            className={`px-3 py-2 rounded-lg border text-xs text-center transition-all ${sel
                              ? isDark ? 'bg-cyan-500/20 border-cyan-500 text-cyan-200' : 'bg-cyan-50 border-cyan-500 text-cyan-800'
                              : isDark ? 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-500' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
                            }`}
                          >
                            <div className="font-semibold">Cat {c.numero}</div>
                            <div className={`text-[10px] mt-0.5 ${sel ? (isDark ? 'text-cyan-300' : 'text-cyan-600') : isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                              {c.anio}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 'circuitos' && (
            <div className="space-y-3">
              {loadingCircuitos ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-cyan-500" />
                </div>
              ) : !circuitosData?.circuitos || circuitosData.circuitos.length === 0 ? (
                <div className={`text-sm ${isDark ? 'text-zinc-500' : 'text-gray-500'} text-center py-8`}>
                  No hay circuitos para esta catorcena.
                </div>
              ) : (
                <>
                  <div className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'} mb-2`}>
                    Cat {catorcenaSelected?.numero} / {catorcenaSelected?.anio} ·{' '}
                    {circuitosData.circuitos.length} circuitos
                  </div>
                  {circuitosData.circuitos.map(c => {
                    const expanded = circuitosExpand[c.solicitud_caras_id];
                    return (
                      <div key={c.solicitud_caras_id} className={`rounded-lg border ${isDark ? 'border-zinc-700' : 'border-gray-200'}`}>
                        <div className={`flex items-center justify-between p-3 ${isDark ? 'bg-zinc-800/40' : 'bg-gray-50'}`}>
                          <button
                            onClick={() => setCircuitosExpand(prev => ({ ...prev, [c.solicitud_caras_id]: !expanded }))}
                            className="flex items-center gap-2 flex-1 text-left"
                          >
                            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            <div>
                              <div className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {c.formato || 'Sin formato'} · {c.articulo || 'sin artículo'}
                              </div>
                              <div className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
                                {fmtDate(c.inicio_periodo)} – {fmtDate(c.fin_periodo)} · {c.tipo || 'Tradicional'}
                              </div>
                            </div>
                          </button>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${isDark ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30' : 'bg-cyan-50 text-cyan-700 border border-cyan-200'}`}>
                              {c.inventarios_actuales}/{c.caras_totales}
                            </span>
                            <button
                              onClick={() => handleSelectCircuito(c)}
                              className={`text-xs font-medium px-3 py-1 rounded-md ${isDark ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30' : 'bg-cyan-50 text-cyan-700 border border-cyan-200 hover:bg-cyan-100'}`}
                            >
                              Seleccionar
                            </button>
                          </div>
                        </div>
                        {expanded && (
                          <div className={`p-3 border-t ${isDark ? 'border-zinc-700' : 'border-gray-200'}`}>
                            {c.inventarios.length === 0 ? (
                              <div className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Sin inventarios.</div>
                            ) : (
                              <div className="overflow-auto max-h-64">
                                <table className="w-full text-xs">
                                  <thead className={`${isDark ? 'text-zinc-400 bg-zinc-800/40' : 'text-gray-500 bg-gray-50'} sticky top-0`}>
                                    <tr>
                                      <th className="px-2 py-1 text-left font-medium">Código</th>
                                      <th className="px-2 py-1 text-left font-medium">Mueble</th>
                                      <th className="px-2 py-1 text-left font-medium">Plaza</th>
                                      <th className="px-2 py-1 text-left font-medium">Ubicación</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {c.inventarios.map(inv => (
                                      <tr key={inv.reserva_id} className={`border-t ${isDark ? 'border-zinc-800' : 'border-gray-100'}`}>
                                        <td className={`px-2 py-1 font-mono ${isDark ? 'text-white' : 'text-gray-900'}`}>{inv.codigo_unico}</td>
                                        <td className={`px-2 py-1 ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{inv.mueble || '-'}</td>
                                        <td className={`px-2 py-1 ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{inv.plaza || '-'}</td>
                                        <td className={`px-2 py-1 ${isDark ? 'text-zinc-500' : 'text-gray-500'} truncate max-w-[260px]`} title={inv.ubicacion || undefined}>{inv.ubicacion || '-'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {step === 'detalle' && circuitoSeleccionado && (
            <div className="space-y-4">
              <div className={`rounded-lg border ${isDark ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-cyan-200 bg-cyan-50/40'} p-3`}>
                <div className="flex items-center gap-3 flex-wrap">
                  <Layers className={`h-4 w-4 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} />
                  <div className="flex-1">
                    <div className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {circuitoSeleccionado.formato} · {circuitoSeleccionado.articulo}
                    </div>
                    <div className={`text-[11px] ${isDark ? 'text-cyan-300/70' : 'text-cyan-700/80'}`}>
                      {fmtDate(circuitoSeleccionado.inicio_periodo)} – {fmtDate(circuitoSeleccionado.fin_periodo)} · {circuitoSeleccionado.inventarios_actuales}/{circuitoSeleccionado.caras_totales} caras
                    </div>
                  </div>
                </div>
              </div>

              <div className={`rounded-lg border ${isDark ? 'border-zinc-700' : 'border-gray-200'} overflow-hidden`}>
                <div className={`px-3 py-2 text-xs font-semibold ${isDark ? 'bg-zinc-800/40 text-zinc-300' : 'bg-gray-50 text-gray-700'}`}>
                  Inventarios actuales del circuito
                </div>
                <div className="overflow-auto max-h-72">
                  <table className="w-full text-xs">
                    <thead className={`${isDark ? 'text-zinc-400 bg-zinc-800/30' : 'text-gray-500 bg-gray-50'} sticky top-0`}>
                      <tr>
                        <th className="px-2 py-1 text-left font-medium">Código</th>
                        <th className="px-2 py-1 text-left font-medium">Mueble</th>
                        <th className="px-2 py-1 text-left font-medium">Plaza</th>
                        <th className="px-2 py-1 text-left font-medium">Ubicación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {circuitoSeleccionado.inventarios.map(inv => (
                        <tr key={inv.reserva_id} className={`border-t ${isDark ? 'border-zinc-800' : 'border-gray-100'}`}>
                          <td className={`px-2 py-1 font-mono ${isDark ? 'text-white' : 'text-gray-900'}`}>{inv.codigo_unico}</td>
                          <td className={`px-2 py-1 ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{inv.mueble || '-'}</td>
                          <td className={`px-2 py-1 ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{inv.plaza || '-'}</td>
                          <td className={`px-2 py-1 ${isDark ? 'text-zinc-500' : 'text-gray-500'} truncate max-w-[260px]`} title={inv.ubicacion || undefined}>{inv.ubicacion || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className={`rounded-lg border ${isDark ? 'border-zinc-700 bg-zinc-900/40' : 'border-gray-200 bg-gray-50'} p-4`}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Cargar CSV de comparación</div>
                    <div className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
                      Máximo {circuitoSeleccionado.caras_totales} códigos. Detecta columna "Código Único".
                    </div>
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
                  <button
                    onClick={() => csvInputRef.current?.click()}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${isDark ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30' : 'bg-cyan-50 text-cyan-700 border border-cyan-200 hover:bg-cyan-100'}`}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Subir CSV
                  </button>
                </div>
                {csvFeedbackMsg && (
                  <div className={`mt-2 text-xs ${csvCodigos.length > 0 ? (isDark ? 'text-emerald-300' : 'text-emerald-700') : (isDark ? 'text-amber-300' : 'text-amber-700')}`}>
                    {csvFeedbackMsg}
                  </div>
                )}
                {csvCodigos.length > 0 && (
                  <div className={`mt-2 max-h-24 overflow-y-auto flex flex-wrap gap-1`}>
                    {csvCodigos.slice(0, 50).map(c => (
                      <span key={c} className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-white text-gray-700 border border-gray-200'}`}>{c}</span>
                    ))}
                    {csvCodigos.length > 50 && (
                      <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>+{csvCodigos.length - 50} más</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 'comparar' && comparacion && (
            <div className="space-y-4">
              {/* Resumen */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <SummaryCard isDark={isDark} color="emerald" label="En circuito y CSV" value={grupos.enCircEnCsv.length} />
                <SummaryCard isDark={isDark} color="amber" label="En circuito (saldrá)" value={comparacion.en_circuito_sin_csv.length} />
                <SummaryCard isDark={isDark} color="cyan" label="Grupo A - Disponibles" value={grupos.grupoA.length} />
                <SummaryCard isDark={isDark} color="red" label="Grupo B - Ocupados otra" value={grupos.grupoB.length} />
              </div>

              {/* No encontrados */}
              {grupos.noEncontrados.length > 0 && (
                <div className={`rounded-lg border ${isDark ? 'border-amber-500/30 bg-amber-500/5' : 'border-amber-200 bg-amber-50/50'} p-3`}>
                  <div className={`text-xs font-semibold mb-1 ${isDark ? 'text-amber-300' : 'text-amber-700'} flex items-center gap-1`}>
                    <AlertCircle className="h-3.5 w-3.5" /> Códigos no encontrados en BD ({grupos.noEncontrados.length})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {grupos.noEncontrados.map(it => (
                      <span key={it.codigo_unico} className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-white text-amber-700 border border-amber-200'}`}>{it.codigo_unico}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Grupo A */}
              <SectionGroup
                isDark={isDark}
                title="Grupo A — Disponibles para agregar"
                description="No están en otra campaña en esta catorcena. Selecciona manualmente cuál inventario actual del circuito sustituye cada uno."
                color="cyan"
                items={grupos.grupoA}
                renderItem={it => {
                  const sustituyeId = grupoASel.get(it.codigo_unico);
                  return (
                    <ItemGrupo
                      key={it.codigo_unico}
                      isDark={isDark}
                      item={it}
                      reservasDisponibles={reservasDisponiblesParaSustituir}
                      reservaSeleccionada={sustituyeId}
                      onSelectReserva={rid => {
                        setGrupoASel(prev => {
                          const next = new Map(prev);
                          if (rid == null) next.delete(it.codigo_unico);
                          else next.set(it.codigo_unico, rid);
                          return next;
                        });
                      }}
                    />
                  );
                }}
              />

              {/* Grupo B */}
              <div className={`rounded-lg border ${isDark ? 'border-red-500/30 bg-red-500/5' : 'border-red-200 bg-red-50/40'} p-4`}>
                <div className="flex items-center justify-between mb-2 gap-3">
                  <div>
                    <div className={`text-sm font-semibold ${isDark ? 'text-red-300' : 'text-red-700'}`}>Grupo B — Ocupados en otra campaña ({grupos.grupoB.length})</div>
                    <div className={`text-[11px] ${isDark ? 'text-red-300/70' : 'text-red-600/80'}`}>
                      Al sustituir, se liberan de su campaña origen (silenciosamente). Descarga el CSV antes para tener registro.
                    </div>
                  </div>
                  <button
                    onClick={handleDescargarGrupoB}
                    disabled={grupos.grupoB.length === 0}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${grupoBDescargado
                      ? isDark ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : isDark ? 'bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30' : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                    } disabled:opacity-50`}
                  >
                    {grupoBDescargado ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
                    {grupoBDescargado ? 'CSV descargado' : 'Descargar CSV Grupo B'}
                  </button>
                </div>
                {!grupoBDescargado && grupos.grupoB.length > 0 && (
                  <div className={`text-[11px] mb-2 px-2 py-1 rounded ${isDark ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-700'} flex items-center gap-1.5`}>
                    <AlertTriangle className="h-3 w-3" />
                    Tienes que descargar el CSV antes de poder seleccionar sustitutos del Grupo B.
                  </div>
                )}
                <div className="space-y-2">
                  {grupos.grupoB.map(it => {
                    const sel = grupoBSel.get(it.codigo_unico);
                    return (
                      <ItemGrupoB
                        key={it.codigo_unico}
                        isDark={isDark}
                        item={it}
                        reservasDisponibles={reservasDisponiblesParaSustituir}
                        seleccion={sel}
                        bloqueado={!grupoBDescargado}
                        onChange={val => {
                          setGrupoBSel(prev => {
                            const next = new Map(prev);
                            if (val == null) next.delete(it.codigo_unico);
                            else next.set(it.codigo_unico, val);
                            return next;
                          });
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 'confirmar' && (
            <div className="space-y-4">
              <div className={`rounded-lg border ${isDark ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-cyan-200 bg-cyan-50/40'} p-4`}>
                <div className={`text-sm font-semibold mb-2 ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>Resumen de la operación</div>
                <ul className={`text-sm ${isDark ? 'text-zinc-300' : 'text-gray-700'} space-y-1 list-disc list-inside`}>
                  <li>Campaña destino: <span className="font-semibold">{campanaSelected?.nombre}</span></li>
                  <li>Circuito destino: <span className="font-mono">{circuitoSeleccionado?.formato} · {circuitoSeleccionado?.articulo}</span></li>
                  <li>Catorcena: Cat {catorcenaSelected?.numero}/{catorcenaSelected?.anio}</li>
                  <li>Reservas a crear: <span className="font-semibold">{payloadAplicar.length}</span></li>
                  <li>Reservas a sustituir (salen del circuito destino): <span className="font-semibold">{payloadAplicar.length}</span></li>
                  <li>Reservas a liberar (Grupo B): <span className="font-semibold">{payloadAplicar.filter(p => p.reserva_origen_id !== null).length}</span></li>
                </ul>
              </div>

              {successMsg && (
                <div className={`p-3 rounded-lg border ${isDark ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'} text-sm flex items-start gap-2`}>
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`p-4 border-t ${isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-gray-200 bg-gray-50'} flex items-center justify-between gap-3`}>
          <button
            onClick={onClose}
            className={`px-3 py-1.5 rounded-lg text-sm ${isDark ? 'text-zinc-400 hover:bg-zinc-800' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            Cerrar
          </button>
          <div className="flex items-center gap-2">
            {step !== 'buscar' && step !== 'confirmar' && (
              <button
                onClick={() => {
                  if (step === 'circuitos') setStep('buscar');
                  else if (step === 'detalle') setStep('circuitos');
                  else if (step === 'comparar') setStep('detalle');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${isDark ? 'text-zinc-400 hover:bg-zinc-800' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Atrás
              </button>
            )}
            {step === 'buscar' && (
              <button
                onClick={handleBuscarCircuitos}
                disabled={!campanaSelected || !catorcenaSelected || loadingCircuitos}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium ${isDark ? 'bg-cyan-500 text-white hover:bg-cyan-600' : 'bg-cyan-600 text-white hover:bg-cyan-700'} disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {loadingCircuitos ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                Buscar
              </button>
            )}
            {step === 'detalle' && (
              <button
                onClick={handleComparar}
                disabled={csvCodigos.length === 0 || compararMutation.isPending}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium ${isDark ? 'bg-cyan-500 text-white hover:bg-cyan-600' : 'bg-cyan-600 text-white hover:bg-cyan-700'} disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {compararMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                Comparar
              </button>
            )}
            {step === 'comparar' && (
              <button
                onClick={() => setStep('confirmar')}
                disabled={payloadAplicar.length === 0}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium ${isDark ? 'bg-cyan-500 text-white hover:bg-cyan-600' : 'bg-cyan-600 text-white hover:bg-cyan-700'} disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                Continuar ({payloadAplicar.length}) <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
            {step === 'confirmar' && !successMsg && (
              <>
                <button
                  onClick={() => setStep('comparar')}
                  className={`px-3 py-1.5 rounded-lg text-sm ${isDark ? 'text-zinc-400 hover:bg-zinc-800' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  <ArrowLeft className="h-3.5 w-3.5 inline" /> Atrás
                </button>
                <button
                  onClick={handleAplicar}
                  disabled={aplicarMutation.isPending || payloadAplicar.length === 0}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40`}
                >
                  {aplicarMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  Aplicar reorganización
                </button>
              </>
            )}
            {step === 'confirmar' && successMsg && (
              <button
                onClick={onClose}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium ${isDark ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}
              >
                Cerrar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Subcomponentes
// =============================================================================

function SummaryCard({ isDark, color, label, value }: { isDark: boolean; color: 'emerald' | 'amber' | 'cyan' | 'red'; label: string; value: number }) {
  const colorMap = {
    emerald: isDark ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300' : 'border-emerald-200 bg-emerald-50/50 text-emerald-700',
    amber: isDark ? 'border-amber-500/30 bg-amber-500/5 text-amber-300' : 'border-amber-200 bg-amber-50/50 text-amber-700',
    cyan: isDark ? 'border-cyan-500/30 bg-cyan-500/5 text-cyan-300' : 'border-cyan-200 bg-cyan-50/50 text-cyan-700',
    red: isDark ? 'border-red-500/30 bg-red-500/5 text-red-300' : 'border-red-200 bg-red-50/50 text-red-700',
  };
  return (
    <div className={`rounded-lg border p-3 ${colorMap[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-[11px] opacity-80">{label}</div>
    </div>
  );
}

function SectionGroup({
  isDark, title, description, color, items, renderItem,
}: {
  isDark: boolean;
  title: string;
  description: string;
  color: 'cyan';
  items: ItemComparacion[];
  renderItem: (i: ItemComparacion) => React.ReactNode;
}) {
  return (
    <div className={`rounded-lg border ${isDark ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-cyan-200 bg-cyan-50/40'} p-4`}>
      <div className="mb-2">
        <div className={`text-sm font-semibold ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>{title} ({items.length})</div>
        <div className={`text-[11px] ${isDark ? 'text-cyan-300/70' : 'text-cyan-600/80'}`}>{description}</div>
      </div>
      <div className="space-y-2">
        {items.length === 0 ? (
          <div className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'} italic`}>Sin elementos en este grupo.</div>
        ) : (
          items.map(renderItem)
        )}
      </div>
    </div>
  );
}

function ItemGrupo({
  isDark, item, reservasDisponibles, reservaSeleccionada, onSelectReserva,
}: {
  isDark: boolean;
  item: ItemComparacion;
  reservasDisponibles: InventarioCircuitoSinCsv[];
  reservaSeleccionada: number | undefined;
  onSelectReserva: (id: number | null) => void;
}) {
  return (
    <div className={`rounded-md border ${isDark ? 'border-zinc-700 bg-zinc-900/40' : 'border-gray-200 bg-white'} p-2 flex items-center gap-3`}>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-mono ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.codigo_unico}</div>
        <div className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
          {item.inventario?.plaza || '-'} · {item.inventario?.mueble || '-'}
        </div>
      </div>
      <select
        value={reservaSeleccionada ?? ''}
        onChange={e => onSelectReserva(e.target.value ? Number(e.target.value) : null)}
        className={`text-xs px-2 py-1 rounded border ${isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-200' : 'bg-white border-gray-200 text-gray-800'} min-w-[200px]`}
      >
        <option value="">Sustituir por... (elige cuál sale)</option>
        {reservaSeleccionada && (
          // Mantener la opción seleccionada visible aunque ya no esté en disponibles
          <option value={reservaSeleccionada}>(actual: reserva #{reservaSeleccionada})</option>
        )}
        {reservasDisponibles.map(r => (
          <option key={r.reserva_id} value={r.reserva_id}>{r.codigo_unico} · res#{r.reserva_id}</option>
        ))}
      </select>
    </div>
  );
}

function ItemGrupoB({
  isDark, item, reservasDisponibles, seleccion, bloqueado, onChange,
}: {
  isDark: boolean;
  item: ItemComparacion;
  reservasDisponibles: InventarioCircuitoSinCsv[];
  seleccion: { sustituye_reserva_id: number; reserva_origen_id: number } | undefined;
  bloqueado: boolean;
  onChange: (val: { sustituye_reserva_id: number; reserva_origen_id: number } | null) => void;
}) {
  const ocup: OcupacionExterna | undefined = item.ocupaciones?.[0];
  return (
    <div className={`rounded-md border ${isDark ? 'border-zinc-700 bg-zinc-900/40' : 'border-gray-200 bg-white'} p-2`}>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-mono ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.codigo_unico}</div>
          <div className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
            Ocupado en: <span className="font-medium">{ocup?.campana_nombre || `Campaña #${ocup?.campana_id}`}</span> · {ocup?.cliente_nombre || ''}
          </div>
        </div>
        <select
          value={seleccion?.sustituye_reserva_id ?? ''}
          disabled={bloqueado || !ocup}
          onChange={e => {
            const val = e.target.value ? Number(e.target.value) : null;
            if (val == null || !ocup) onChange(null);
            else onChange({ sustituye_reserva_id: val, reserva_origen_id: ocup.reserva_id });
          }}
          className={`text-xs px-2 py-1 rounded border min-w-[220px] ${isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-200' : 'bg-white border-gray-200 text-gray-800'} disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <option value="">Sustituir por... (elige cuál sale)</option>
          {seleccion?.sustituye_reserva_id && (
            <option value={seleccion.sustituye_reserva_id}>(actual: reserva #{seleccion.sustituye_reserva_id})</option>
          )}
          {reservasDisponibles.map(r => (
            <option key={r.reserva_id} value={r.reserva_id}>{r.codigo_unico} · res#{r.reserva_id}</option>
          ))}
        </select>
      </div>
      {item.ocupaciones && item.ocupaciones.length > 1 && (
        <div className={`text-[10px] mt-1 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
          Hay {item.ocupaciones.length} ocupaciones activas. Se liberará la primera (res#{ocup?.reserva_id}).
        </div>
      )}
    </div>
  );
}
