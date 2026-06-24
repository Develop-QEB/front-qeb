import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X, Upload, Trash2, Save, Share2, Loader2, AlertCircle, CheckCircle2,
  ArrowLeft, ArrowRight, BarChart3, Calendar, ChevronDown,
  ExternalLink, Download, Filter, Search
} from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import { inventariosService } from '../../services/inventarios.service';
import { solicitudesService } from '../../services/solicitudes.service';
import { propuestasService } from '../../services/propuestas.service';
import { campanasService } from '../../services/campanas.service';
import {
  analisisOcupacionService,
  AnalisisOcupacion,
  CampanaEnCelda,
  CatorcenaRef,
  InventarioResumen,
  MatrizOcupacion,
  cellKeyOf,
} from '../../services/analisisOcupacion.service';

type Step = 'select' | 'periodos' | 'matriz';

interface AnalisisOcupacionModalProps {
  open: boolean;
  onClose: () => void;
  initialInventarios?: InventarioResumen[];
  initialAnalisis?: AnalisisOcupacion;
  onSaved?: (a: AnalisisOcupacion) => void;
  /**
   * Modo solo lectura: usado al abrir un enlace compartido desde un usuario sin
   * acceso al módulo de inventario. Oculta guardar, compartir, cambiar periodos
   * y todas las acciones de edición/liberación sobre la matriz.
   */
  readOnly?: boolean;
}

function parseCsvCodes(text: string): string[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  // Detectar separador (coma, punto y coma o tabulación)
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };
  for (const ch of lines[0]) if (ch in counts) counts[ch]++;
  const sep = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[1] ?? 0) > 0
    ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
    : ',';

  const splitRow = (line: string): string[] =>
    line.split(sep).map(c => c.replace(/^"|"$/g, '').trim());

  const headerCells = splitRow(lines[0]).map(c => c.toLowerCase());
  // Buscar la columna "código único" / "codigo unico" / "codigo"
  const codigoIdx = headerCells.findIndex(h => h.includes('codigo') || h.includes('código'));
  const hasHeader = codigoIdx !== -1 || headerCells[0] === 'id';

  // Si encontramos header con "codigo", usar esa columna.
  // Si el primer header es "id" y hay >1 columnas, asumir que la 2ª es el código.
  // En cualquier otro caso, usar la primera columna.
  let targetCol = 0;
  if (codigoIdx !== -1) {
    targetCol = codigoIdx;
  } else if (headerCells[0] === 'id' && headerCells.length > 1) {
    targetCol = 1;
  }

  const startIdx = hasHeader ? 1 : 0;
  const codes = new Set<string>();
  for (let i = startIdx; i < lines.length; i++) {
    const cells = splitRow(lines[i]);
    const value = cells[targetCol]?.trim();
    if (value) codes.add(value);
  }
  return Array.from(codes);
}

export function AnalisisOcupacionModal({
  open,
  onClose,
  initialInventarios,
  initialAnalisis,
  onSaved,
  readOnly = false,
}: AnalisisOcupacionModalProps) {
  const isDark = useThemeStore(s => s.theme) === 'dark';
  const queryClient = useQueryClient();
  const userRole = useAuthStore(s => s.user?.rol);
  // Selección múltiple (botón oculto): solo DEV. Nunca en modo solo lectura.
  const canBulkSelect = !readOnly && userRole === 'DEV';

  const [selectionMode, setSelectionMode] = useState(false);

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

  const [analisisId, setAnalisisId] = useState<number | null>(null);
  const [analisisNombre, setAnalisisNombre] = useState('');
  const [savingAnalisis, setSavingAnalisis] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState<boolean>(true);

  const [shareCopied, setShareCopied] = useState(false);

  // Reset al abrir
  useEffect(() => {
    if (!open) return;
    if (initialAnalisis) {
      const owner = initialAnalisis.is_owner !== false;
      setStep('matriz');
      setInventarios(initialAnalisis.inventarios);
      setCodigosNoEncontrados(initialAnalisis.codigosNoEncontrados);
      setCatorcenasSelected(initialAnalisis.catorcenas);
      setAnalisisId(initialAnalisis.id);
      setAnalisisNombre(owner || readOnly ? initialAnalisis.nombre : `Copia de ${initialAnalisis.nombre}`);
      setIsOwner(owner);
      // Construir matriz al abrir
      void buildMatrizFor(initialAnalisis.inventarios, initialAnalisis.catorcenas);
    } else {
      setStep('select');
      setInventarios(initialInventarios || []);
      setCodigosNoEncontrados([]);
      setCatorcenasSelected([]);
      setMatriz(null);
      setAnalisisId(null);
      setAnalisisNombre('');
      setIsOwner(true);
    }
    setCsvFeedback(null);
    setSaveError(null);
    setShareCopied(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialAnalisis?.id]);

  const handleDownloadTemplate = () => {
    const csv = 'Código Único\nEJEMPLO-001\nEJEMPLO-002\n';
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template-analisis-ocupacion.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCsvUpload = async (file: File) => {
    setCsvProcessing(true);
    setCsvFeedback(null);
    try {
      // Excel en español suele guardar CSV en Windows-1252; intentamos UTF-8 estricto
      // y caemos a windows-1252 si encontramos bytes inválidos.
      const buffer = await file.arrayBuffer();
      let text: string;
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      } catch {
        text = new TextDecoder('windows-1252').decode(buffer);
      }
      // Quita BOM residual por si acaso
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
      const codes = parseCsvCodes(text);
      if (codes.length === 0) {
        setCsvFeedback({ encontrados: 0, noEncontrados: 0 });
        return;
      }

      // Excluir códigos que ya están en la selección
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

      // Fetch full data en lotes para no saturar la red ni el servidor.
      // Con miles de IDs, Promise.all en paralelo provoca timeouts silenciosos
      // que se traducen en `null` y se filtran fuera, perdiendo registros.
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

      // Combinar sin duplicados
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
    void buildMatrizFor(inventarios, catorcenasSelected);
  };

  const handleSave = async () => {
    if (!analisisNombre.trim()) {
      setSaveError('Pon un nombre al análisis antes de guardar');
      return;
    }
    setSaveError(null);
    setSavingAnalisis(true);
    try {
      const payload = {
        nombre: analisisNombre.trim(),
        inventarios,
        catorcenas: catorcenasSelected,
        codigosNoEncontrados,
      };
      const saved = analisisId && isOwner
        ? await analisisOcupacionService.update(analisisId, payload)
        : await analisisOcupacionService.create(payload);
      setAnalisisId(saved.id);
      setIsOwner(true);
      // Invalidar cache de la lista para que aparezca al instante en "Guardados"
      queryClient.invalidateQueries({ queryKey: ['analisis-ocupacion'] });
      onSaved?.(saved);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSavingAnalisis(false);
    }
  };

  const handleShare = async () => {
    if (!analisisId) {
      setSaveError('Guarda el análisis primero para poder compartirlo');
      return;
    }
    const url = `${window.location.origin}/inventarios/analisis/${analisisId}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      window.prompt('Copia el enlace:', url);
    }
  };

  const canContinueFromSelect = inventarios.length > 0;
  const canContinueFromPeriodos = catorcenasSelected.length > 0;

  if (!open) return null;

  const stepIndex = step === 'select' ? 1 : step === 'periodos' ? 2 : 3;

  return (
    <>
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div
          className={`${isDark ? 'bg-zinc-900' : 'bg-white'} rounded-2xl border ${isDark ? 'border-purple-500/20' : 'border-purple-200'} w-full ${step === 'matriz' ? 'max-w-7xl' : 'max-w-3xl'} max-h-[92vh] overflow-hidden flex flex-col shadow-2xl shadow-purple-500/10`}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`p-5 border-b ${isDark ? 'border-purple-500/20 bg-gradient-to-r from-purple-900/20 via-fuchsia-900/10 to-purple-900/20' : 'border-purple-200 bg-gradient-to-r from-purple-50 via-fuchsia-50 to-purple-50'} flex items-center justify-between`}>
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl ${isDark ? 'bg-purple-500/20' : 'bg-purple-50'} flex items-center justify-center`}
                onClick={() => {
                  if (step !== 'matriz' || !canBulkSelect) return;
                  setSelectionMode(s => !s);
                }}
              >
                <BarChart3 className={`h-5 w-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
              </div>
              <div>
                <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Análisis de Ocupación</h2>
                <p className={`text-xs ${isDark ? 'text-purple-300/50' : 'text-purple-400'}`}>
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
                      ? isDark ? 'bg-purple-500 text-white' : 'bg-purple-600 text-white'
                      : done
                        ? isDark ? 'bg-emerald-500/30 text-emerald-300' : 'bg-emerald-100 text-emerald-700'
                        : isDark ? 'bg-zinc-800 text-zinc-500' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : idx + 1}
                  </div>
                  <span className={active ? (isDark ? 'text-purple-300 font-medium' : 'text-purple-700 font-medium') : isDark ? 'text-zinc-500' : 'text-gray-400'}>
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
                {/* CSV upload */}
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
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${isDark ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30' : 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100'} disabled:opacity-50`}
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

                {/* Lista de inventarios encontrados */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      Inventarios seleccionados <span className={isDark ? 'text-purple-300' : 'text-purple-600'}>({inventarios.length})</span>
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

                {/* Códigos no encontrados */}
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
                  <Calendar className={`h-4 w-4 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                  <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Año:</span>
                  <select
                    value={yearSelected}
                    onChange={e => setYearSelected(parseInt(e.target.value))}
                    className={`px-3 py-1.5 rounded-lg border text-sm ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-gray-200 text-gray-900'} focus:outline-none focus:ring-1 focus:ring-purple-500/50`}
                  >
                    {Array.from({ length: 6 }).map((_, i) => {
                      const y = new Date().getFullYear() - 2 + i;
                      return <option key={y} value={y}>{y}</option>;
                    })}
                  </select>
                  <span className={`ml-auto text-xs ${isDark ? 'text-purple-300' : 'text-purple-600'}`}>
                    {catorcenasSelected.length} seleccionadas
                  </span>
                </div>

                {loadingCatorcenas ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
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
                              ? isDark ? 'bg-purple-500/20 border-purple-500 text-purple-200' : 'bg-purple-50 border-purple-500 text-purple-800'
                              : isDark ? 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-500' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
                          }`}
                        >
                          <div className="font-semibold">C{c.numero_catorcena}</div>
                          <div className={`text-[10px] mt-0.5 ${selected ? (isDark ? 'text-purple-300' : 'text-purple-600') : isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                            {new Date(c.fecha_inicio).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })} – {new Date(c.fecha_fin).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {catorcenasSelected.length > 0 && (
                  <div className={`rounded-lg border ${isDark ? 'border-purple-500/30 bg-purple-500/5' : 'border-purple-200 bg-purple-50/50'} p-3`}>
                    <div className={`text-xs font-medium mb-1.5 ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>Periodos seleccionados</div>
                    <div className="flex flex-wrap gap-1.5">
                      {catorcenasSelected.map(c => (
                        <span key={`${c.anio}-${c.numero}`} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] ${isDark ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-white text-purple-700 border border-purple-200'}`}>
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
              <MatrizView
                matriz={matriz}
                building={building}
                isDark={isDark}
                onRefresh={() => buildMatrizFor(inventarios, catorcenasSelected)}
                selectionMode={selectionMode}
                readOnly={readOnly}
              />
            )}
          </div>

          {/* Footer */}
          <div className={`p-4 border-t ${isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-gray-200 bg-gray-50'} flex items-center justify-between gap-3`}>
            {step === 'matriz' && readOnly ? (
              <div className="flex items-center gap-2 flex-1">
                <span className={`text-sm font-medium truncate max-w-md ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {analisisNombre}
                </span>
                <span
                  title="Estás viendo un análisis compartido en modo solo lectura."
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${isDark ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30' : 'bg-purple-50 text-purple-700 border border-purple-200'}`}
                >
                  Solo lectura
                </span>
                <div className="ml-auto">
                  <button
                    onClick={onClose}
                    className={`px-3 py-1.5 rounded-lg text-sm ${isDark ? 'text-zinc-400 hover:bg-zinc-800' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            ) : step === 'matriz' ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="text"
                  value={analisisNombre}
                  onChange={e => setAnalisisNombre(e.target.value)}
                  placeholder="Nombre del análisis..."
                  className={`flex-1 max-w-xs px-3 py-1.5 rounded-lg border text-sm ${isDark ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500' : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400'} focus:outline-none focus:ring-1 focus:ring-purple-500/50`}
                />
                {!isOwner && (
                  <span
                    title="Estás viendo un análisis compartido. Al guardar se creará una copia en tu cuenta."
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${isDark ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}
                  >
                    Compartido
                  </span>
                )}
                <button
                  onClick={handleSave}
                  disabled={savingAnalisis}
                  title={!isOwner ? 'Crea una copia en tu cuenta' : analisisId ? 'Actualizar análisis' : 'Guardar análisis'}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${isDark ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'} disabled:opacity-50`}
                >
                  {savingAnalisis ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  {!isOwner ? 'Guardar copia' : analisisId ? 'Actualizar' : 'Guardar'}
                </button>
                <button
                  onClick={handleShare}
                  disabled={!analisisId}
                  title={!analisisId ? 'Guarda primero para compartir' : 'Copiar enlace'}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${isDark ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30' : 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100'} disabled:opacity-50`}
                >
                  {shareCopied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
                  {shareCopied ? 'Copiado' : 'Compartir'}
                </button>
                {saveError && <span className={`text-xs ${isDark ? 'text-red-400' : 'text-red-600'}`}>{saveError}</span>}
                <div className="ml-auto">
                  <button
                    onClick={() => setStep('periodos')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${isDark ? 'text-zinc-400 hover:bg-zinc-800' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Cambiar periodos
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  onClick={onClose}
                  className={`px-3 py-1.5 rounded-lg text-sm ${isDark ? 'text-zinc-400 hover:bg-zinc-800' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  Cancelar
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
                  {step === 'select' && (
                    <button
                      onClick={() => setStep('periodos')}
                      disabled={!canContinueFromSelect}
                      className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium ${isDark ? 'bg-purple-500 text-white hover:bg-purple-600' : 'bg-purple-600 text-white hover:bg-purple-700'} disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      Continuar
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {step === 'periodos' && (
                    <button
                      onClick={goToMatriz}
                      disabled={!canContinueFromPeriodos}
                      className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium ${isDark ? 'bg-purple-500 text-white hover:bg-purple-600' : 'bg-purple-600 text-white hover:bg-purple-700'} disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      Generar matriz
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

    </>
  );
}

// ===== Matrix View =====
const labelForCampana = (c: CampanaEnCelda): string => {
  if (c.campana_id) return c.campana_nombre || `Campaña #${c.campana_id}`;
  return `Propuesta #${c.propuesta_id}`;
};

// Un inventario Tradicional solo admite 1 campaña por catorcena; los Digitales admiten varias.
const esDigital = (inv?: InventarioResumen): boolean => inv?.tradicional_digital === 'Digital';
const conflictoKey = (invId: number, cellKey: string): string => `${invId}|${cellKey}`;

function MatrizView({
  matriz,
  building,
  isDark,
  onRefresh,
  selectionMode,
  readOnly = false,
}: {
  matriz: MatrizOcupacion | null;
  building: boolean;
  isDark: boolean;
  onRefresh: () => Promise<void> | void;
  selectionMode: boolean;
  readOnly?: boolean;
}) {
  const userRole = useAuthStore(s => s.user?.rol);
  // En modo solo lectura nadie puede liberar reservas, sin importar el rol.
  const canRelease = !readOnly && (
    userRole === 'DEV'
    || userRole === 'Gerente de Trafico'
    || userRole === 'Coordinador de trafico'
    || userRole === 'Especialista de trafico'
    || userRole === 'Auxiliar de trafico'
  );

  const [showDuplicados, setShowDuplicados] = useState(false);
  const [soloDuplicados, setSoloDuplicados] = useState(false);
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

  // Selección múltiple (por reserva_id)
  const [selectedReservas, setSelectedReservas] = useState<Set<number>>(new Set());
  const [confirmBulkOpen, setConfirmBulkOpen] = useState(false);
  const [bulkReleasing, setBulkReleasing] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const toggleReservaSelected = (reservaId: number) => {
    setSelectedReservas(prev => {
      const next = new Set(prev);
      if (next.has(reservaId)) next.delete(reservaId);
      else next.add(reservaId);
      return next;
    });
  };
  const clearSelection = () => setSelectedReservas(new Set());

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

  // Lookup de las cards actualmente seleccionadas (resolviendo reserva_id contra la matriz)
  const selectedCards = useMemo(() => {
    if (!matriz || selectedReservas.size === 0) return [] as { card: CampanaEnCelda; inventarioId: number }[];
    const out: { card: CampanaEnCelda; inventarioId: number }[] = [];
    for (const [invIdStr, invCeldas] of Object.entries(matriz.celdas)) {
      for (const celda of Object.values(invCeldas)) {
        for (const c of celda.campanas) {
          if (selectedReservas.has(c.reserva_id)) {
            out.push({ card: c, inventarioId: Number(invIdStr) });
          }
        }
      }
    }
    return out;
  }, [matriz, selectedReservas]);

  const handleBulkRelease = async () => {
    if (!canRelease || selectedCards.length === 0) return;
    setBulkReleasing(true);
    setBulkError(null);
    try {
      // Agrupar por campana_id y propuesta_id para minimizar requests
      const byCampana = new Map<number, number[]>();
      const byPropuesta = new Map<number, number[]>();
      for (const { card } of selectedCards) {
        if (card.aps && card.aps > 0) continue; // defensivo: nunca debería entrar aquí
        if (card.campana_id) {
          const list = byCampana.get(card.campana_id) || [];
          list.push(card.reserva_id);
          byCampana.set(card.campana_id, list);
        } else if (card.propuesta_id) {
          const list = byPropuesta.get(card.propuesta_id) || [];
          list.push(card.reserva_id);
          byPropuesta.set(card.propuesta_id, list);
        }
      }

      const errores: string[] = [];
      for (const [campanaId, reservaIds] of byCampana) {
        try {
          await campanasService.deleteReservas(campanaId, reservaIds);
        } catch (err) {
          const axiosErr = err as { response?: { data?: { error?: string } } };
          const msg = axiosErr?.response?.data?.error || (err instanceof Error ? err.message : 'error');
          errores.push(`Campaña #${campanaId}: ${msg}`);
        }
      }
      for (const [propuestaId, reservaIds] of byPropuesta) {
        try {
          await propuestasService.deleteReservas(propuestaId, reservaIds);
        } catch (err) {
          const axiosErr = err as { response?: { data?: { error?: string } } };
          const msg = axiosErr?.response?.data?.error || (err instanceof Error ? err.message : 'error');
          errores.push(`Propuesta #${propuestaId}: ${msg}`);
        }
      }

      await onRefresh();

      if (errores.length === 0) {
        setConfirmBulkOpen(false);
        clearSelection();
      } else {
        setBulkError(errores.join(' · '));
        clearSelection(); // los IDs viejos ya no aplican
      }
    } finally {
      setBulkReleasing(false);
    }
  };

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

  // Si se apaga el modo selección desde fuera, limpia la selección actual
  useEffect(() => {
    if (!selectionMode) setSelectedReservas(new Set());
  }, [selectionMode]);

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


  const invById = useMemo(() => {
    const m = new Map<number, InventarioResumen>();
    if (matriz) for (const inv of matriz.inventarios) m.set(inv.id, inv);
    return m;
  }, [matriz]);

  // Conflictos: celdas de inventarios Tradicionales con 2+ tarjetas.
  // Un Tradicional solo puede tener una campaña por catorcena; los Digitales se excluyen.
  const conflictoCeldas = useMemo(() => {
    const set = new Set<string>();
    if (!matriz) return set;
    for (const [invIdStr, invCeldas] of Object.entries(matriz.celdas)) {
      if (esDigital(invById.get(Number(invIdStr)))) continue;
      for (const [cellKey, celda] of Object.entries(invCeldas)) {
        if (celda.campanas.length >= 2) set.add(conflictoKey(Number(invIdStr), cellKey));
      }
    }
    return set;
  }, [matriz, invById]);

  // Lista de conflictos (sitio × catorcena) para el panel informativo.
  const conflictos = useMemo(() => {
    if (!matriz) return [] as { inv: InventarioResumen; cat: CatorcenaRef; count: number }[];
    const out: { inv: InventarioResumen; cat: CatorcenaRef; count: number }[] = [];
    for (const inv of matriz.inventarios) {
      if (esDigital(inv)) continue;
      const invCeldas = matriz.celdas[inv.id];
      if (!invCeldas) continue;
      for (const cat of matriz.catorcenas) {
        const celda = invCeldas[cellKeyOf(cat)];
        if (celda && celda.campanas.length >= 2) out.push({ inv, cat, count: celda.campanas.length });
      }
    }
    return out;
  }, [matriz]);

  const inventariosFiltrados = useMemo(() => {
    if (!matriz) return [] as InventarioResumen[];
    if (!isFiltered && !soloDuplicados) return matriz.inventarios;
    return matriz.inventarios.filter(inv => {
      const invCeldas = matriz.celdas[inv.id];
      if (!invCeldas) return false;
      for (const cat of matriz.catorcenas) {
        const cellKey = cellKeyOf(cat);
        const celda = invCeldas[cellKey];
        if (!celda) continue;
        if (soloDuplicados && !conflictoCeldas.has(conflictoKey(inv.id, cellKey))) continue;
        for (const c of celda.campanas) {
          if (isFiltered && !campanaFilter.has(labelForCampana(c))) continue;
          return true;
        }
      }
      return false;
    });
  }, [matriz, campanaFilter, isFiltered, soloDuplicados, conflictoCeldas]);

  // Cards visibles y liberables (sin APS, dentro de los filtros activos)
  const selectableCards = useMemo(() => {
    if (!matriz) return [] as CampanaEnCelda[];
    const out: CampanaEnCelda[] = [];
    for (const inv of inventariosFiltrados) {
      const invCeldas = matriz.celdas[inv.id];
      if (!invCeldas) continue;
      for (const cat of matriz.catorcenas) {
        const cellKey = cellKeyOf(cat);
        const celda = invCeldas[cellKey];
        if (!celda) continue;
        if (soloDuplicados && !conflictoCeldas.has(conflictoKey(inv.id, cellKey))) continue;
        for (const c of celda.campanas) {
          if (c.aps && c.aps > 0) continue;
          if (isFiltered && !campanaFilter.has(labelForCampana(c))) continue;
          out.push(c);
        }
      }
    }
    return out;
  }, [matriz, inventariosFiltrados, campanaFilter, isFiltered, soloDuplicados, conflictoCeldas]);

  const allSelectableSelected = selectableCards.length > 0
    && selectableCards.every(c => selectedReservas.has(c.reserva_id));

  const toggleSelectAll = () => {
    if (allSelectableSelected) {
      clearSelection();
    } else {
      setSelectedReservas(new Set(selectableCards.map(c => c.reserva_id)));
    }
  };

  if (building || !matriz) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
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
                ? isDark
                  ? 'bg-purple-500/20 text-purple-200 border-purple-500/40 hover:bg-purple-500/30'
                  : 'bg-purple-50 text-purple-700 border-purple-300 hover:bg-purple-100'
                : isDark
                  ? 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
            title="Filtrar campañas en la matriz"
          >
            <Filter className="h-3.5 w-3.5" />
            <span>
              {isFiltered
                ? `${campanaFilter.size} de ${allCampanas.length} campañas`
                : `Filtrar campañas (${allCampanas.length})`}
            </span>
            {isFiltered && (
              <span
                role="button"
                onClick={e => { e.stopPropagation(); clearFilter(); }}
                className={`flex items-center justify-center rounded-full p-0.5 ${isDark ? 'hover:bg-purple-500/40' : 'hover:bg-purple-200'}`}
                title="Limpiar filtro"
              >
                <X className="h-3 w-3" />
              </span>
            )}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
          </button>
          {filterOpen && (
            <div
              className={`absolute z-30 mt-1 left-0 w-80 rounded-lg border shadow-xl ${
                isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200'
              }`}
            >
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
                    className={`px-2 py-0.5 rounded ${isDark ? 'text-purple-300 hover:bg-purple-500/15' : 'text-purple-700 hover:bg-purple-50'} disabled:opacity-40 disabled:cursor-not-allowed`}
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
                  <div className={`px-3 py-4 text-center text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                    Sin coincidencias
                  </div>
                ) : (
                  filteredOptions.map(opt => {
                    const selected = campanaFilter.has(opt.label);
                    return (
                      <label
                        key={opt.label}
                        className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer text-xs ${
                          isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleCampana(opt.label)}
                          className="accent-purple-500 h-3.5 w-3.5 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className={`truncate ${isDark ? 'text-zinc-200' : 'text-gray-800'}`} title={opt.label}>
                            {opt.label}
                          </div>
                          <div className={`text-[10px] truncate ${isDark ? 'text-zinc-500' : 'text-gray-500'}`} title={opt.cliente}>
                            {opt.cliente}
                          </div>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
        {(isFiltered || soloDuplicados) && (
          <span className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
            Mostrando {inventariosFiltrados.length} de {matriz.inventarios.length} inventarios
          </span>
        )}
        {canRelease && selectionMode && (
          <div className={`ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs ${
            isDark
              ? 'bg-purple-500/20 border-purple-500/40 text-purple-200'
              : 'bg-purple-50 border-purple-300 text-purple-800'
          }`}>
            <button
              onClick={toggleSelectAll}
              disabled={selectableCards.length === 0}
              className={`flex items-center gap-1 px-2 py-0.5 rounded font-medium ${
                isDark ? 'hover:bg-purple-500/30 disabled:opacity-40' : 'hover:bg-purple-100 disabled:opacity-40'
              }`}
              title={allSelectableSelected ? 'Deseleccionar todas' : 'Seleccionar todas las visibles y liberables'}
            >
              {allSelectableSelected
                ? 'Deseleccionar todas'
                : `Seleccionar todas (${selectableCards.length})`}
            </button>
            {selectedReservas.size > 0 && (
              <>
                <span className={`${isDark ? 'text-purple-300/50' : 'text-purple-400'}`}>·</span>
                <span className="font-semibold">
                  {selectedReservas.size} {selectedReservas.size === 1 ? 'seleccionada' : 'seleccionadas'}
                </span>
                <button
                  onClick={() => setConfirmBulkOpen(true)}
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded font-medium ${
                    isDark ? 'bg-red-500/30 text-red-200 hover:bg-red-500/40' : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  <Trash2 className="h-3 w-3" />
                  Liberar
                </button>
                <button
                  onClick={clearSelection}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${
                    isDark ? 'hover:bg-purple-500/30' : 'hover:bg-purple-100'
                  }`}
                  title="Limpiar selección"
                >
                  <X className="h-3 w-3" />
                </button>
              </>
            )}
          </div>
        )}
      </div>
      {conflictos.length > 0 && (
        <div className={`rounded-lg border ${isDark ? 'border-amber-500/30 bg-amber-500/5' : 'border-amber-200 bg-amber-50'} text-xs`}>
          <div className="flex items-stretch">
            <button
              onClick={() => setShowDuplicados(s => !s)}
              className={`flex-1 flex items-center gap-2 px-3 py-2 ${isDark ? 'text-amber-300 hover:bg-amber-500/10' : 'text-amber-700 hover:bg-amber-100/50'} rounded-l-lg transition-colors`}
              title="Inventarios Tradicionales con 2 o más campañas en la misma catorcena"
            >
              <AlertCircle className="h-3.5 w-3.5" />
              <span className="font-semibold">
                {conflictos.length} {conflictos.length === 1 ? 'celda con conflicto' : 'celdas con conflicto'}
              </span>
              <span className={`${isDark ? 'text-amber-400/70' : 'text-amber-600/80'}`}>
                (Tradicional con 2+ campañas en una catorcena)
              </span>
              <ChevronDown className={`h-3.5 w-3.5 ml-auto transition-transform ${showDuplicados ? 'rotate-180' : ''}`} />
            </button>
            <button
              onClick={() => setSoloDuplicados(s => !s)}
              title="Mostrar solo las celdas en conflicto"
              className={`flex items-center gap-1.5 px-3 py-2 border-l text-xs font-medium rounded-r-lg transition-colors ${
                soloDuplicados
                  ? isDark
                    ? 'bg-amber-500/30 border-amber-500/40 text-amber-100'
                    : 'bg-amber-200 border-amber-300 text-amber-900'
                  : isDark
                    ? 'border-amber-500/30 text-amber-300 hover:bg-amber-500/10'
                    : 'border-amber-200 text-amber-700 hover:bg-amber-100/60'
              }`}
            >
              {soloDuplicados ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Filter className="h-3.5 w-3.5" />}
              Solo conflictos
            </button>
          </div>
          {showDuplicados && (
            <div className={`px-3 pb-2 pt-1 max-h-44 overflow-y-auto border-t ${isDark ? 'border-amber-500/20' : 'border-amber-200/60'}`}>
              <ul className="space-y-1">
                {conflictos.map(({ inv, cat, count }) => (
                  <li key={`${inv.id}-${cellKeyOf(cat)}`} className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>
                    <span className="font-mono font-medium">{inv.codigo_unico || `#${inv.id}`}</span>
                    <span className={isDark ? 'text-zinc-500' : 'text-gray-500'}>· C{cat.numero}-{cat.anio}</span>
                    <span className={isDark ? 'text-zinc-500' : 'text-gray-500'}>· {inv.plaza || '-'}</span>
                    <span
                      title="Cantidad de campañas en esta celda (un Tradicional solo debería tener una)"
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${isDark ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' : 'bg-white text-amber-700 border-amber-200'}`}
                    >
                      {count} campañas
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <div className="flex-1 overflow-auto min-h-0">
        <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className={`sticky left-0 top-0 z-20 px-3 py-2 text-left text-xs font-semibold border-b ${isDark ? 'border-purple-500/30 bg-zinc-900 text-purple-300' : 'border-purple-200 bg-white text-purple-700'} min-w-[200px]`}>
              Inventario
            </th>
            {matriz.catorcenas.map(c => (
              <th key={cellKeyOf(c)} className={`sticky top-0 z-10 px-3 py-2 text-center text-xs font-semibold border-b ${isDark ? 'border-purple-500/30 bg-zinc-900 text-purple-300' : 'border-purple-200 bg-white text-purple-700'} min-w-[120px]`}>
                C{c.numero}-{c.anio}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {inventariosFiltrados.length === 0 && (
            <tr>
              <td
                colSpan={matriz.catorcenas.length + 1}
                className={`px-3 py-8 text-center text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}
              >
                Ningún inventario tiene las campañas seleccionadas.
              </td>
            </tr>
          )}
          {inventariosFiltrados.map(inv => (
            <tr key={inv.id} className={`border-b ${isDark ? 'border-zinc-800' : 'border-gray-100'}`}>
              <td className={`sticky left-0 z-10 px-3 py-2 ${isDark ? 'bg-zinc-900' : 'bg-white'} border-r ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
                <div className="flex items-center gap-1.5">
                  <span className={`font-mono text-xs font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{inv.codigo_unico}</span>
                  <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-medium border ${inv.tradicional_digital === 'Digital' ? (isDark ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' : 'bg-cyan-50 text-cyan-700 border-cyan-200') : (isDark ? 'bg-pink-500/20 text-pink-300 border-pink-500/30' : 'bg-pink-50 text-pink-700 border-pink-200')}`}>
                    {inv.tradicional_digital || 'Tradicional'}
                  </span>
                </div>
                <div className={`text-[10px] mt-0.5 ${isDark ? 'text-zinc-500' : 'text-gray-500'} truncate max-w-[200px]`} title={inv.ubicacion || undefined}>
                  {inv.plaza || '-'} · {inv.mueble || '-'}
                </div>
              </td>
              {matriz.catorcenas.map(cat => {
                const cellKey = cellKeyOf(cat);
                const celda = matriz.celdas[inv.id]?.[cellKey];
                const ocupado = celda?.ocupado;
                const todasCampanas = celda?.campanas || [];
                const esConflicto = conflictoCeldas.has(conflictoKey(inv.id, cellKey));
                const campanas = (() => {
                  if (soloDuplicados && !esConflicto) return [] as CampanaEnCelda[];
                  if (isFiltered) return todasCampanas.filter(c => campanaFilter.has(labelForCampana(c)));
                  return todasCampanas;
                })();

                if (!ocupado || todasCampanas.length === 0) {
                  const disponibleClass = isDark
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-emerald-50 border-emerald-200';
                  return (
                    <td key={cellKeyOf(cat)} className="px-1.5 py-1.5 align-top">
                      <div className={`w-full rounded-md p-2 border ${disponibleClass}`}>
                        <div className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                          Disponible
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
                      {esConflicto && (
                        <div
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700'}`}
                          title="Inventario Tradicional con más de una campaña en esta catorcena"
                        >
                          <AlertCircle className="h-2.5 w-2.5" />
                          Conflicto · {todasCampanas.length}
                        </div>
                      )}
                      {campanas.map(c => {
                        const esPropuesta = !c.campana_id;
                        const cardClass = esPropuesta
                          ? isDark
                            ? 'bg-amber-500/10 border-amber-500/40 hover:bg-amber-500/20'
                            : 'bg-amber-50 border-amber-200 hover:bg-amber-100'
                          : isDark
                            ? 'bg-red-500/10 border-red-500/40 hover:bg-red-500/20'
                            : 'bg-red-50 border-red-200 hover:bg-red-100';
                        const statusLabel = esPropuesta ? 'Reservado' : 'Ocupado';
                        const statusTextClass = esPropuesta
                          ? isDark ? 'text-amber-300' : 'text-amber-700'
                          : isDark ? 'text-red-300' : 'text-red-700';
                        const href = esPropuesta
                          ? `/propuestas?viewId=${c.propuesta_id}`
                          : `/campanas/detail/${c.campana_id}`;
                        const label = esPropuesta
                          ? `Propuesta #${c.propuesta_id}`
                          : c.campana_nombre || `Campaña #${c.campana_id}`;
                        const clienteLabel = c.cliente_nombre || 'Sin cliente';
                        const fmt = (d: string) => new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
                        const rangoLabel = c.inicio_periodo && c.fin_periodo
                          ? `${fmt(c.inicio_periodo)} – ${fmt(c.fin_periodo)}`
                          : '';
                        const tieneAPSLocal = !!(c.aps && c.aps > 0);
                        const bloqueadoLocal = tieneAPSLocal;
                        const seleccionable = canRelease && !bloqueadoLocal;
                        const isSelected = selectionMode && selectedReservas.has(c.reserva_id);
                        const selectionRing = isSelected
                          ? (isDark ? 'ring-2 ring-purple-400 ring-offset-1 ring-offset-zinc-900' : 'ring-2 ring-purple-500 ring-offset-1 ring-offset-white')
                          : '';
                        const padLeft = selectionMode && seleccionable ? 'pl-7' : '';
                        const padRight = canRelease ? 'pr-7' : '';
                        return (
                          <div key={c.reserva_id} className={`relative group/card rounded-md ${selectionRing}`}>
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={esPropuesta ? `Editar propuesta #${c.propuesta_id}` : `Abrir campaña: ${label}`}
                              className={`block w-full text-left rounded-md p-2 ${padLeft} ${padRight} border transition-all cursor-pointer ${cardClass}`}
                            >
                              <div className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide ${statusTextClass}`}>
                                {statusLabel}
                                <ExternalLink className="h-2.5 w-2.5 opacity-70" />
                              </div>
                              <div
                                className={`text-[10px] mt-1 truncate underline underline-offset-2 ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}
                                title={label}
                              >
                                {label}
                              </div>
                              <div
                                className={`text-[10px] mt-0.5 truncate ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}
                                title={clienteLabel}
                              >
                                {clienteLabel}
                              </div>
                              {c.articulo && (
                                <div
                                  className={`text-[10px] mt-0.5 truncate font-mono ${isDark ? 'text-purple-300' : 'text-purple-700'}`}
                                  title={`Artículo SAP: ${c.articulo}`}
                                >
                                  {c.articulo}
                                </div>
                              )}
                              {rangoLabel && (
                                <div
                                  className={`text-[10px] mt-0.5 truncate font-mono ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}
                                  title={`Reserva #${c.reserva_id} · ${rangoLabel}`}
                                >
                                  {rangoLabel} · #{c.reserva_id}
                                </div>
                              )}
                            </a>
                            {seleccionable && selectionMode && (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleReservaSelected(c.reserva_id)}
                                onClick={e => e.stopPropagation()}
                                title="Seleccionar para liberación en lote"
                                className="absolute top-1.5 left-1.5 h-3.5 w-3.5 cursor-pointer accent-purple-500"
                              />
                            )}
                            {canRelease && (() => {
                              const tooltipBloqueo = c.posted
                                ? 'Tiene POST, no se puede eliminar'
                                : 'Tiene APS asignado, no se puede eliminar';
                              return (
                                <button
                                  type="button"
                                  disabled={bloqueadoLocal}
                                  onClick={e => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (bloqueadoLocal) return;
                                    setConfirmRelease({ card: c, inventario: inv, catorcena: cat });
                                  }}
                                  title={bloqueadoLocal ? tooltipBloqueo : 'Liberar reserva (eliminar de la BD)'}
                                  className={`absolute top-1 right-1 p-1 rounded transition-all ${
                                    bloqueadoLocal
                                      ? `opacity-100 cursor-not-allowed ${isDark ? 'text-zinc-600' : 'text-gray-300'}`
                                      : `opacity-0 group-hover/card:opacity-100 focus:opacity-100 ${
                                          isDark
                                            ? 'text-zinc-400 hover:text-red-300 hover:bg-red-500/20'
                                            : 'text-gray-500 hover:text-red-600 hover:bg-red-100'
                                        }`
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
          ))}
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
                  <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    ¿Liberar esta reserva?
                  </h3>
                  <p className={`text-xs mt-1 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                    Se eliminará la reserva de la base de datos. Esta acción no se puede deshacer.
                  </p>
                </div>
              </div>
            </div>
            <div className={`p-5 space-y-2 text-xs ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>
              {(() => {
                const { card, inventario, catorcena } = confirmRelease;
                const esPropuesta = !card.campana_id;
                const fmt = (d: string) => new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
                const rango = card.inicio_periodo && card.fin_periodo
                  ? `${fmt(card.inicio_periodo)} – ${fmt(card.fin_periodo)}`
                  : '';
                const rows: { k: string; v: string }[] = [
                  { k: esPropuesta ? 'Propuesta' : 'Campaña', v: esPropuesta ? `#${card.propuesta_id}` : (card.campana_nombre || `#${card.campana_id}`) },
                  { k: 'Cliente', v: card.cliente_nombre || 'Sin cliente' },
                  { k: 'Inventario', v: inventario.codigo_unico || `#${inventario.id}` },
                  { k: 'Catorcena', v: `C${catorcena.numero}-${catorcena.anio}` },
                ];
                if (rango) rows.push({ k: 'Periodo', v: rango });
                if (card.articulo) rows.push({ k: 'Artículo', v: card.articulo });
                rows.push({ k: 'Reserva', v: `#${card.reserva_id}` });
                return rows.map(r => (
                  <div key={r.k} className="flex items-start gap-2">
                    <span className={`min-w-[80px] ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>{r.k}:</span>
                    <span className="flex-1 font-medium break-words">{r.v}</span>
                  </div>
                ));
              })()}
              {releaseError && (
                <div className={`mt-3 px-3 py-2 rounded-lg text-xs ${isDark ? 'bg-red-500/15 text-red-300 border border-red-500/30' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {releaseError}
                </div>
              )}
            </div>
            <div className={`p-4 border-t ${isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-gray-200 bg-gray-50'} flex items-center justify-end gap-2`}>
              <button
                onClick={() => setConfirmRelease(null)}
                disabled={releasing}
                className={`px-3 py-1.5 rounded-lg text-sm ${isDark ? 'text-zinc-300 hover:bg-zinc-800' : 'text-gray-700 hover:bg-gray-100'} disabled:opacity-50`}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmRelease}
                disabled={releasing}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${isDark ? 'bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30' : 'bg-red-600 text-white hover:bg-red-700'} disabled:opacity-50`}
              >
                {releasing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                {releasing ? 'Liberando...' : 'Sí, liberar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmBulkOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4"
          onClick={() => !bulkReleasing && setConfirmBulkOpen(false)}
        >
          <div
            className={`rounded-2xl border ${isDark ? 'bg-zinc-900 border-red-500/30' : 'bg-white border-red-200'} w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]`}
            onClick={e => e.stopPropagation()}
          >
            <div className={`p-5 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-red-500/20' : 'bg-red-50'}`}>
                  <AlertCircle className={`h-5 w-5 ${isDark ? 'text-red-300' : 'text-red-600'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    ¿Liberar {selectedCards.length} {selectedCards.length === 1 ? 'reserva' : 'reservas'}?
                  </h3>
                  <p className={`text-xs mt-1 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                    Se eliminarán de la base de datos. Esta acción no se puede deshacer.
                  </p>
                </div>
              </div>
            </div>
            <div className={`p-5 overflow-y-auto text-xs ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>
              <ul className="space-y-1.5">
                {selectedCards.slice(0, 15).map(({ card }) => {
                  const esP = !card.campana_id;
                  const nombre = esP ? `Propuesta #${card.propuesta_id}` : (card.campana_nombre || `Campaña #${card.campana_id}`);
                  return (
                    <li key={card.reserva_id} className="flex items-start gap-2">
                      <span className={`shrink-0 inline-block w-1.5 h-1.5 mt-1.5 rounded-full ${esP ? 'bg-amber-400' : 'bg-red-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-medium">{nombre}</div>
                        <div className={`text-[10px] truncate ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
                          {card.cliente_nombre || 'Sin cliente'} · C{card.numero_catorcena}-{card.anio_catorcena} · #{card.reserva_id}
                        </div>
                      </div>
                    </li>
                  );
                })}
                {selectedCards.length > 15 && (
                  <li className={`text-[11px] italic ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
                    … y {selectedCards.length - 15} más
                  </li>
                )}
              </ul>
              {bulkError && (
                <div className={`mt-3 px-3 py-2 rounded-lg text-xs whitespace-pre-line ${isDark ? 'bg-red-500/15 text-red-300 border border-red-500/30' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {bulkError}
                </div>
              )}
            </div>
            <div className={`p-4 border-t ${isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-gray-200 bg-gray-50'} flex items-center justify-end gap-2`}>
              <button
                onClick={() => setConfirmBulkOpen(false)}
                disabled={bulkReleasing}
                className={`px-3 py-1.5 rounded-lg text-sm ${isDark ? 'text-zinc-300 hover:bg-zinc-800' : 'text-gray-700 hover:bg-gray-100'} disabled:opacity-50`}
              >
                Cancelar
              </button>
              <button
                onClick={handleBulkRelease}
                disabled={bulkReleasing || selectedCards.length === 0}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${isDark ? 'bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30' : 'bg-red-600 text-white hover:bg-red-700'} disabled:opacity-50`}
              >
                {bulkReleasing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                {bulkReleasing ? 'Liberando...' : `Sí, liberar ${selectedCards.length}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

