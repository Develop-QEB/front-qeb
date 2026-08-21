import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X, AlertTriangle, Loader2, Calendar, Search, Download, BarChart3, CheckCircle2,
} from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';
import { solicitudesService } from '../../services/solicitudes.service';
import { inventariosService, ConflictoOcupacionRow } from '../../services/inventarios.service';
import { CatorcenaRef, InventarioResumen } from '../../services/analisisOcupacion.service';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Abre el análisis de ocupación precargado con los sitios en conflicto. */
  onOpenEnMatriz: (inventarios: InventarioResumen[]) => void;
}

/**
 * Auditoría de conflictos sobre TODO el inventario. Solo rol DEV.
 *
 * Un inventario Tradicional solo admite una campaña por catorcena. Detectar esos
 * choques recorriendo la matriz obliga a cargar el historial de cada sitio, que
 * a escala de ~18,600 no termina. Aquí se resuelve con agregados en el backend
 * (`/inventarios/conflictos`), sin construir matriz ni pedir una lista de
 * inventarios.
 */
export function AuditoriaConflictosModal({ open, onClose, onOpenEnMatriz }: Props) {
  const isDark = useThemeStore(s => s.theme) === 'dark';

  const [yearSelected, setYearSelected] = useState<number>(new Date().getFullYear());
  const [catorcenasSelected, setCatorcenasSelected] = useState<CatorcenaRef[]>([]);
  const [resultado, setResultado] = useState<ConflictoOcupacionRow[] | null>(null);
  const [corriendo, setCorriendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [exportando, setExportando] = useState(false);
  // "choque" = 2+ campañas distintas peleando la cara (problema de venta).
  // "duplicado" = una sola campaña con varias reservas sobre la misma cara
  // (problema de armado). Se limpian distinto, conviene no mezclarlos.
  const [tipo, setTipo] = useState<'todos' | 'choque' | 'duplicado'>('todos');

  const { data: catorcenasYear, isLoading: loadingCatorcenas } = useQuery({
    queryKey: ['catorcenas', yearSelected],
    queryFn: () => solicitudesService.getCatorcenas(yearSelected),
    enabled: open,
  });

  const toggleCatorcena = (c: CatorcenaRef) => {
    setResultado(null);
    setCatorcenasSelected(prev => {
      const exists = prev.some(p => p.numero === c.numero && p.anio === c.anio);
      if (exists) return prev.filter(p => !(p.numero === c.numero && p.anio === c.anio));
      return [...prev, c].sort((a, b) => a.anio - b.anio || a.numero - b.numero);
    });
  };

  const seleccionarTodasDelAnio = () => {
    setResultado(null);
    const todas = (catorcenasYear?.data || []).map(c => ({ numero: c.numero_catorcena, anio: c.a_o }));
    setCatorcenasSelected(prev => {
      const map = new Map(prev.map(p => [`${p.anio}-${p.numero}`, p]));
      todas.forEach(t => map.set(`${t.anio}-${t.numero}`, t));
      return Array.from(map.values()).sort((a, b) => a.anio - b.anio || a.numero - b.numero);
    });
  };

  const handleAuditar = async () => {
    if (catorcenasSelected.length === 0) return;
    setCorriendo(true);
    setError(null);
    setResultado(null);
    try {
      // Sin `ids`: el backend audita el inventario completo.
      const rows = await inventariosService.getConflictosOcupacion(catorcenasSelected);
      setResultado(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al auditar conflictos');
    } finally {
      setCorriendo(false);
    }
  };

  const conteos = useMemo(() => {
    const base = { todos: 0, choque: 0, duplicado: 0 };
    if (!resultado) return base;
    base.todos = resultado.length;
    for (const r of resultado) {
      if (r.origenes >= 2) base.choque++;
      else base.duplicado++;
    }
    return base;
  }, [resultado]);

  const filtrados = useMemo(() => {
    if (!resultado) return [];
    const q = busqueda.trim().toLowerCase();
    return resultado.filter(r => {
      if (tipo === 'choque' && r.origenes < 2) return false;
      if (tipo === 'duplicado' && r.origenes >= 2) return false;
      if (!q) return true;
      return (r.codigo_unico || '').toLowerCase().includes(q)
        || (r.plaza || '').toLowerCase().includes(q)
        || (r.mueble || '').toLowerCase().includes(q)
        || (r.ubicacion || '').toLowerCase().includes(q);
    });
  }, [resultado, busqueda, tipo]);

  // Un sitio puede chocar en varias catorcenas: para el análisis interesa una
  // fila por inventario, no una por celda.
  const inventariosUnicos = useMemo(() => {
    const map = new Map<number, InventarioResumen>();
    for (const r of filtrados) {
      if (map.has(r.inventario_id)) continue;
      map.set(r.inventario_id, {
        id: r.inventario_id,
        codigo_unico: r.codigo_unico,
        ubicacion: r.ubicacion,
        mueble: r.mueble,
        plaza: r.plaza,
        tradicional_digital: r.tradicional_digital,
      });
    }
    return Array.from(map.values());
  }, [filtrados]);

  /**
   * Exporta a .xlsx lo que está en pantalla: respeta la pestaña activa y la
   * búsqueda, para que el archivo coincida con lo que el usuario ve.
   *
   * `exceljs` se importa dinámicamente: pesa bastante y no tiene por qué entrar
   * al bundle de Inventarios solo por un botón que casi nadie toca.
   */
  const handleExportExcel = async () => {
    if (!filtrados.length) return;
    setExportando(true);
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      wb.created = new Date();

      const sheet = wb.addWorksheet('Conflictos');
      sheet.columns = [
        { header: 'Código', key: 'codigo', width: 36 },
        { header: 'Catorcena', key: 'cat', width: 11 },
        { header: 'Año', key: 'anio', width: 8 },
        { header: 'Tipo', key: 'tipo', width: 12 },
        { header: 'Reservas', key: 'n', width: 10 },
        { header: 'Campañas', key: 'origenes', width: 11 },
        { header: 'Plaza', key: 'plaza', width: 22 },
        { header: 'Mueble', key: 'mueble', width: 16 },
        { header: 'Ubicación', key: 'ubicacion', width: 52 },
      ];

      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB45309' } };
      headerRow.height = 22;

      for (const r of filtrados) {
        const esChoque = r.origenes >= 2;
        const row = sheet.addRow({
          codigo: r.codigo_unico || `#${r.inventario_id}`,
          cat: `C${r.numero_catorcena}`,
          anio: r.anio,
          tipo: esChoque ? 'Choque' : 'Duplicado',
          // Numéricos de verdad, para poder ordenar y filtrar en Excel.
          n: r.n,
          origenes: r.origenes,
          plaza: r.plaza || '',
          mueble: r.mueble || '',
          ubicacion: r.ubicacion || '',
        });
        if (esChoque) {
          row.getCell('tipo').font = { bold: true, color: { argb: 'FFB91C1C' } };
          row.getCell('tipo').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        }
      }

      sheet.autoFilter = { from: 'A1', to: `I${filtrados.length + 1}` };
      sheet.views = [{ state: 'frozen', ySplit: 1 }];

      // Hoja de contexto: sin esto el archivo no dice sobre qué se corrió.
      const resumen = wb.addWorksheet('Resumen');
      resumen.columns = [{ width: 34 }, { width: 60 }];
      const periodos = catorcenasSelected.map(c => `C${c.numero}-${c.anio}`).join(', ');
      const filas: [string, string | number][] = [
        ['Auditoría de conflictos de ocupación', ''],
        ['Generado', new Date().toLocaleString('es-MX')],
        ['Periodos auditados', periodos],
        ['Alcance', 'Todo el inventario (solo Tradicional)'],
        ['', ''],
        ['Celdas con 2+ reservas (total)', conteos.todos],
        ['Choque de campañas', conteos.choque],
        ['Duplicados de una misma campaña', conteos.duplicado],
        ['Inventarios afectados', new Set((resultado ?? []).map(r => r.inventario_id)).size],
        ['', ''],
        ['Filas en este archivo', filtrados.length],
        ['Filtro aplicado', tipo === 'todos' ? 'Todos' : tipo === 'choque' ? 'Choque de campañas' : 'Duplicados'],
        ['Búsqueda', busqueda || '(ninguna)'],
        ['', ''],
        ['Choque', 'Campañas distintas ocupando la misma cara: hay que liberar una.'],
        ['Duplicado', 'Una sola campaña con varias reservas sobre la misma cara: error de armado.'],
      ];
      filas.forEach(([k, v]) => resumen.addRow([k, v]));
      resumen.getRow(1).font = { bold: true, size: 13 };
      [6, 7, 8, 9].forEach(i => { resumen.getRow(i).font = { bold: true }; });

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const sufijo = tipo === 'todos' ? '' : `-${tipo}`;
      a.download = `conflictos-ocupacion${sufijo}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar el Excel');
    } finally {
      setExportando(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className={`${isDark ? 'bg-zinc-900' : 'bg-white'} rounded-2xl border ${isDark ? 'border-amber-500/20' : 'border-amber-200'} w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl shadow-amber-500/10`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`p-5 border-b ${isDark ? 'border-amber-500/20 bg-gradient-to-r from-amber-900/20 to-orange-900/10' : 'border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50'} flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${isDark ? 'bg-amber-500/20' : 'bg-amber-50'} flex items-center justify-center`}>
              <AlertTriangle className={`h-5 w-5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
            </div>
            <div>
              <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Auditoría de Conflictos</h2>
              <p className={`text-xs ${isDark ? 'text-amber-300/50' : 'text-amber-500'}`}>
                Tradicionales con 2+ reservas en la misma catorcena · todo el inventario
              </p>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg ${isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'}`}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Selección de periodos */}
        <div className={`p-4 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'} space-y-3`}>
          <div className="flex items-center gap-3 flex-wrap">
            <Calendar className={`h-4 w-4 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
            <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Año:</span>
            <select
              value={yearSelected}
              onChange={e => setYearSelected(parseInt(e.target.value))}
              className={`px-3 py-1.5 rounded-lg border text-sm ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-gray-200 text-gray-900'} focus:outline-none focus:ring-1 focus:ring-amber-500/50`}
            >
              {Array.from({ length: 6 }).map((_, i) => {
                const y = new Date().getFullYear() - 2 + i;
                return <option key={y} value={y}>{y}</option>;
              })}
            </select>
            <button
              onClick={seleccionarTodasDelAnio}
              disabled={loadingCatorcenas}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium ${isDark ? 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'} disabled:opacity-50`}
            >
              Todas las del año
            </button>
            {catorcenasSelected.length > 0 && (
              <button
                onClick={() => { setCatorcenasSelected([]); setResultado(null); }}
                className={`px-2.5 py-1 rounded-lg text-xs ${isDark ? 'text-zinc-400 hover:bg-zinc-800' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                Limpiar
              </button>
            )}
            <span className={`ml-auto text-xs ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>
              {catorcenasSelected.length} seleccionadas
            </span>
          </div>

          {loadingCatorcenas ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {(catorcenasYear?.data || []).map(c => {
                const selected = catorcenasSelected.some(s => s.numero === c.numero_catorcena && s.anio === c.a_o);
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleCatorcena({ numero: c.numero_catorcena, anio: c.a_o })}
                    className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
                      selected
                        ? isDark ? 'bg-amber-500/20 border-amber-500 text-amber-200' : 'bg-amber-50 border-amber-500 text-amber-800'
                        : isDark ? 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-500' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    C{c.numero_catorcena}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={handleAuditar}
              disabled={catorcenasSelected.length === 0 || corriendo}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${isDark ? 'bg-amber-500 text-zinc-900 hover:bg-amber-400' : 'bg-amber-600 text-white hover:bg-amber-700'} disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {corriendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
              {corriendo ? 'Auditando...' : 'Auditar todo el inventario'}
            </button>
            {error && <span className={`text-xs ${isDark ? 'text-red-400' : 'text-red-600'}`}>{error}</span>}
          </div>
        </div>

        {/* Resultados */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {corriendo ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16">
              <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
              <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                Revisando todas las reservas de los periodos seleccionados...
              </p>
            </div>
          ) : resultado === null ? (
            <div className={`flex-1 flex flex-col items-center justify-center gap-3 py-16 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
              <AlertTriangle className="h-10 w-10 opacity-30" />
              <p className="text-sm">Selecciona los periodos y corre la auditoría.</p>
            </div>
          ) : resultado.length === 0 ? (
            <div className={`flex-1 flex flex-col items-center justify-center gap-3 py-16 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
              <CheckCircle2 className="h-10 w-10" />
              <p className="text-sm font-medium">Sin conflictos en los periodos seleccionados</p>
              <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                Ningún inventario Tradicional tiene más de una reserva por catorcena.
              </p>
            </div>
          ) : (
            <>
              <div className={`px-4 py-2.5 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'} flex items-center gap-2 flex-wrap`}>
                <span className={`text-sm font-semibold ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
                  {resultado.length.toLocaleString('es-MX')} {resultado.length === 1 ? 'celda en conflicto' : 'celdas en conflicto'}
                </span>
                <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
                  en {new Set(resultado.map(r => r.inventario_id)).size.toLocaleString('es-MX')} inventarios
                </span>
                <div className={`flex items-center rounded-lg border overflow-hidden ${isDark ? 'border-zinc-700' : 'border-gray-300'}`}>
                  {([
                    { k: 'todos' as const, label: 'Todos', n: conteos.todos, title: 'Todas las celdas con 2+ reservas' },
                    { k: 'choque' as const, label: 'Choque de campañas', n: conteos.choque, title: 'Dos o más campañas distintas peleando la misma cara: hay que liberar una' },
                    { k: 'duplicado' as const, label: 'Duplicados', n: conteos.duplicado, title: 'Una sola campaña con varias reservas sobre la misma cara: error de armado' },
                  ]).map(opt => (
                    <button
                      key={opt.k}
                      onClick={() => setTipo(opt.k)}
                      title={opt.title}
                      className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                        tipo === opt.k
                          ? isDark ? 'bg-amber-500/25 text-amber-200' : 'bg-amber-100 text-amber-800'
                          : isDark ? 'text-zinc-400 hover:bg-zinc-800' : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {opt.label} ({opt.n.toLocaleString('es-MX')})
                    </button>
                  ))}
                </div>
                <div className={`flex items-center gap-2 px-2 py-1 rounded-md border ml-2 ${isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-gray-50 border-gray-200'}`}>
                  <Search className={`h-3.5 w-3.5 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} />
                  <input
                    type="text"
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                    placeholder="Buscar código, plaza, mueble..."
                    className={`bg-transparent text-xs outline-none w-52 ${isDark ? 'text-white placeholder:text-zinc-500' : 'text-gray-900 placeholder:text-gray-400'}`}
                  />
                  {busqueda && (
                    <button onClick={() => setBusqueda('')} className={isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-gray-400 hover:text-gray-600'}>
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => void handleExportExcel()}
                    disabled={exportando || filtrados.length === 0}
                    title="Descarga lo que estás viendo (respeta la pestaña y la búsqueda)"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${isDark ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'} disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    {exportando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    {exportando ? 'Generando...' : 'Exportar Excel'}
                  </button>
                  <button
                    onClick={() => onOpenEnMatriz(inventariosUnicos)}
                    disabled={inventariosUnicos.length === 0}
                    title="Abre el análisis de ocupación con los sitios en conflicto ya cargados"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${isDark ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30' : 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100'} disabled:opacity-40`}
                  >
                    <BarChart3 className="h-3.5 w-3.5" />
                    Abrir en análisis ({inventariosUnicos.length.toLocaleString('es-MX')})
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto min-h-0">
                <table className="w-full text-xs">
                  <thead className={`${isDark ? 'bg-zinc-900 text-amber-300' : 'bg-white text-amber-700'} sticky top-0 z-10`}>
                    <tr className={`border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
                      <th className="px-3 py-2 text-left font-semibold">Código</th>
                      <th className="px-3 py-2 text-left font-semibold w-28">Catorcena</th>
                      <th className="px-3 py-2 text-center font-semibold w-32">Tipo</th>
                      <th className="px-3 py-2 text-center font-semibold w-20" title="Reservas vivas en la celda">Reservas</th>
                      <th className="px-3 py-2 text-center font-semibold w-24" title="Campañas o propuestas distintas">Campañas</th>
                      <th className="px-3 py-2 text-left font-semibold">Plaza</th>
                      <th className="px-3 py-2 text-left font-semibold">Mueble</th>
                      <th className="px-3 py-2 text-left font-semibold">Ubicación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.map(r => (
                      <tr
                        key={`${r.inventario_id}-${r.anio}-${r.numero_catorcena}`}
                        className={`border-b ${isDark ? 'border-zinc-800/60 hover:bg-zinc-800/40' : 'border-gray-100 hover:bg-gray-50'}`}
                      >
                        <td className={`px-3 py-1.5 font-mono font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{r.codigo_unico || `#${r.inventario_id}`}</td>
                        <td className={`px-3 py-1.5 ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>C{r.numero_catorcena}-{r.anio}</td>
                        <td className="px-3 py-1.5 text-center">
                          {r.origenes >= 2 ? (
                            <span
                              title="Campañas distintas peleando la misma cara"
                              className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${isDark ? 'bg-red-500/15 text-red-300 border-red-500/30' : 'bg-red-50 text-red-700 border-red-200'}`}
                            >
                              Choque
                            </span>
                          ) : (
                            <span
                              title="Una sola campaña con varias reservas sobre la misma cara"
                              className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${isDark ? 'bg-zinc-700/50 text-zinc-300 border-zinc-600' : 'bg-gray-100 text-gray-600 border-gray-300'}`}
                            >
                              Duplicado
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${isDark ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                            {r.n}
                          </span>
                        </td>
                        <td className={`px-3 py-1.5 text-center font-medium ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{r.origenes}</td>
                        <td className={`px-3 py-1.5 ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>{r.plaza || '-'}</td>
                        <td className={`px-3 py-1.5 ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>{r.mueble || '-'}</td>
                        <td className={`px-3 py-1.5 ${isDark ? 'text-zinc-500' : 'text-gray-500'} max-w-[280px] truncate`} title={r.ubicacion || undefined}>{r.ubicacion || '-'}</td>
                      </tr>
                    ))}
                    {filtrados.length === 0 && (
                      <tr>
                        <td colSpan={8} className={`px-3 py-8 text-center ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                          {busqueda ? `Sin coincidencias para "${busqueda}"` : 'Sin celdas de este tipo'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
