import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X, Upload, Trash2, Save, Share2, Loader2, AlertCircle, CheckCircle2,
  ArrowLeft, ArrowRight, BarChart3, Calendar, ChevronDown,
  Building2, ExternalLink, Package, Download
} from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';
import { inventariosService } from '../../services/inventarios.service';
import { solicitudesService } from '../../services/solicitudes.service';
import {
  analisisOcupacionService,
  AnalisisOcupacion,
  CatorcenaRef,
  InventarioResumen,
  MatrizOcupacion,
  CampanaEnCelda,
  cellKeyOf,
} from '../../services/analisisOcupacion.service';

type Step = 'select' | 'periodos' | 'matriz';

interface AnalisisOcupacionModalProps {
  open: boolean;
  onClose: () => void;
  initialInventarios?: InventarioResumen[];
  initialAnalisis?: AnalisisOcupacion;
  onSaved?: (a: AnalisisOcupacion) => void;
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
}: AnalisisOcupacionModalProps) {
  const isDark = useThemeStore(s => s.theme) === 'dark';
  const queryClient = useQueryClient();

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

  const [cellDetail, setCellDetail] = useState<{
    inventario: InventarioResumen;
    catorcena: CatorcenaRef;
    campanas: CampanaEnCelda[];
  } | null>(null);

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
      setAnalisisNombre(owner ? initialAnalisis.nombre : `Copia de ${initialAnalisis.nombre}`);
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

      const check = await inventariosService.bulkCheck(nuevosCodigos);
      const idsEncontrados: number[] = [
        ...check.sobreescribibles.map(s => s.id).filter((x): x is number => x !== null),
        ...check.ocupados.map(o => o.id).filter((x): x is number => x !== null),
      ];

      // Fetch full data en paralelo
      const fetched = await Promise.all(
        idsEncontrados.map(async id => {
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
      const found = fetched.filter((x): x is InventarioResumen => x !== null);

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
              <div className={`w-10 h-10 rounded-xl ${isDark ? 'bg-purple-500/20' : 'bg-purple-50'} flex items-center justify-center`}>
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
          <div className="flex-1 overflow-auto p-5">
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
                onCellClick={(inv, cat, campanas) => setCellDetail({ inventario: inv, catorcena: cat, campanas })}
              />
            )}
          </div>

          {/* Footer */}
          <div className={`p-4 border-t ${isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-gray-200 bg-gray-50'} flex items-center justify-between gap-3`}>
            {step === 'matriz' ? (
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

      {/* Detail modal */}
      {cellDetail && (
        <CellDetailModal
          inventario={cellDetail.inventario}
          catorcena={cellDetail.catorcena}
          campanas={cellDetail.campanas}
          onClose={() => setCellDetail(null)}
          isDark={isDark}
        />
      )}
    </>
  );
}

// ===== Matrix View =====
function MatrizView({
  matriz,
  building,
  isDark,
  onCellClick,
}: {
  matriz: MatrizOcupacion | null;
  building: boolean;
  isDark: boolean;
  onCellClick: (inv: InventarioResumen, cat: CatorcenaRef, campanas: CampanaEnCelda[]) => void;
}) {
  if (building || !matriz) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
        <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Construyendo matriz de ocupación...</p>
      </div>
    );
  }

  return (
    <div className="overflow-auto">
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
          {matriz.inventarios.map(inv => (
            <tr key={inv.id} className={`border-b ${isDark ? 'border-zinc-800' : 'border-gray-100'}`}>
              <td className={`sticky left-0 z-10 px-3 py-2 ${isDark ? 'bg-zinc-900' : 'bg-white'} border-r ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
                <div className={`font-mono text-xs font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{inv.codigo_unico}</div>
                <div className={`text-[10px] mt-0.5 ${isDark ? 'text-zinc-500' : 'text-gray-500'} truncate max-w-[200px]`} title={inv.ubicacion || undefined}>
                  {inv.plaza || '-'} · {inv.mueble || '-'}
                </div>
              </td>
              {matriz.catorcenas.map(cat => {
                const celda = matriz.celdas[inv.id]?.[cellKeyOf(cat)];
                const ocupado = celda?.ocupado;
                const campanas = celda?.campanas || [];
                const ocupadoClass = isDark
                  ? 'bg-red-500/10 border-red-500/40 hover:bg-red-500/20 cursor-pointer'
                  : 'bg-red-50 border-red-200 hover:bg-red-100 cursor-pointer';
                const disponibleClass = isDark
                  ? 'bg-emerald-500/10 border-emerald-500/30 cursor-default'
                  : 'bg-emerald-50 border-emerald-200 cursor-default';
                // Cuando hay 1 sola ocupación: link directo. Si tiene campaña → detalle de campaña, si no → editar propuesta
                const single = campanas.length === 1 ? campanas[0] : null;
                const singleHref = single
                  ? single.campana_id
                    ? `/campanas/detail/${single.campana_id}`
                    : `/propuestas?viewId=${single.propuesta_id}`
                  : null;
                const singleLabel = single
                  ? single.campana_id
                    ? single.campana_nombre || `Campaña #${single.campana_id}`
                    : `Propuesta #${single.propuesta_id}`
                  : '';
                const clienteLabel = ocupado && campanas.length > 0
                  ? (campanas[0].cliente_nombre || 'Sin cliente')
                  : '';
                const cellInner = (
                  <>
                    <div className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide ${
                      ocupado
                        ? isDark ? 'text-red-300' : 'text-red-700'
                        : isDark ? 'text-emerald-300' : 'text-emerald-700'
                    }`}>
                      {ocupado ? 'Ocupado' : 'Disponible'}
                      {single && <ExternalLink className="h-2.5 w-2.5 opacity-70" />}
                    </div>
                    {ocupado && campanas.length > 0 && (
                      <>
                        <div
                          className={`text-[10px] mt-1 truncate ${single ? 'underline underline-offset-2' : ''} ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}
                          title={campanas.map(c => `${c.campana_nombre || `Propuesta #${c.propuesta_id}`} — ${c.cliente_nombre || 'Sin cliente'}`).join(', ')}
                        >
                          {singleLabel || (campanas[0].campana_nombre || `Propuesta #${campanas[0].propuesta_id}`)}
                          {campanas.length > 1 && (
                            <span className={isDark ? 'text-purple-400' : 'text-purple-600'}> +{campanas.length - 1}</span>
                          )}
                        </div>
                        <div
                          className={`text-[10px] mt-0.5 truncate ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}
                          title={clienteLabel}
                        >
                          {clienteLabel}
                        </div>
                      </>
                    )}
                  </>
                );

                return (
                  <td key={cellKeyOf(cat)} className="px-1.5 py-1.5 align-top">
                    {single && singleHref ? (
                      <a
                        href={singleHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={single.campana_id ? `Abrir campaña: ${singleLabel}` : `Editar propuesta #${single.propuesta_id}`}
                        className={`block w-full text-left rounded-md p-2 border transition-all ${ocupadoClass}`}
                      >
                        {cellInner}
                      </a>
                    ) : (
                      <button
                        onClick={() => ocupado && onCellClick(inv, cat, campanas)}
                        disabled={!ocupado}
                        title={ocupado && campanas.length > 1 ? `${campanas.length} ocupaciones — click para ver` : undefined}
                        className={`w-full text-left rounded-md p-2 border transition-all ${ocupado ? ocupadoClass : disponibleClass}`}
                      >
                        {cellInner}
                      </button>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ===== Cell Detail Modal =====
function CellDetailModal({
  inventario,
  catorcena,
  campanas,
  onClose,
  isDark,
}: {
  inventario: InventarioResumen;
  catorcena: CatorcenaRef;
  campanas: CampanaEnCelda[];
  onClose: () => void;
  isDark: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div
        className={`${isDark ? 'bg-zinc-900' : 'bg-white'} rounded-2xl border ${isDark ? 'border-purple-500/20' : 'border-purple-200'} w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl shadow-purple-500/10`}
        onClick={e => e.stopPropagation()}
      >
        <div className={`p-5 border-b ${isDark ? 'border-purple-500/20 bg-gradient-to-r from-purple-900/20 to-fuchsia-900/10' : 'border-purple-200 bg-gradient-to-r from-purple-50 to-fuchsia-50'} flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${isDark ? 'bg-purple-500/20' : 'bg-purple-50'} flex items-center justify-center`}>
              <Building2 className={`h-5 w-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
            </div>
            <div>
              <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {inventario.codigo_unico} · C{catorcena.numero}-{catorcena.anio}
              </h3>
              <p className={`text-xs ${isDark ? 'text-purple-300/60' : 'text-purple-500'}`}>
                {campanas.length} {campanas.length === 1 ? 'campaña' : 'campañas'} ocupando este periodo
              </p>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg ${isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'}`}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {campanas.map(c => (
            <div key={c.reserva_id} className={`rounded-xl border ${isDark ? 'border-zinc-700 bg-zinc-800/50' : 'border-gray-200 bg-white'} p-4`}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <h4 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{c.campana_nombre || '-'}</h4>
                  <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{c.cliente_nombre || 'Sin cliente'}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                  c.reserva_estatus === 'Aprobada'
                    ? isDark ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : isDark ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>{c.reserva_estatus}</span>
              </div>
              <div className={`grid grid-cols-2 gap-2 text-xs ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  {new Date(c.inicio_periodo).toLocaleDateString('es-MX')} – {new Date(c.fin_periodo).toLocaleDateString('es-MX')}
                </div>
                <div className="flex items-center gap-1.5">
                  <Package className="h-3 w-3" />
                  Reserva #{c.reserva_id}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                {c.campana_id ? (
                  <a
                    href={`/campanas/detail/${c.campana_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1 text-xs ${isDark ? 'text-purple-300 hover:text-purple-200' : 'text-purple-700 hover:text-purple-900'}`}
                  >
                    <ExternalLink className="h-3 w-3" />
                    Abrir campaña
                  </a>
                ) : c.propuesta_id ? (
                  <a
                    href={`/propuestas?viewId=${c.propuesta_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1 text-xs ${isDark ? 'text-purple-300 hover:text-purple-200' : 'text-purple-700 hover:text-purple-900'}`}
                  >
                    <ExternalLink className="h-3 w-3" />
                    Editar propuesta #{c.propuesta_id}
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
