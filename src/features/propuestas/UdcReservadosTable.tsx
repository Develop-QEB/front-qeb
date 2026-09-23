import { useMemo, useState } from 'react';
import { Plane, Monitor, Search, Image as ImageIcon, X, ExternalLink, Clock, Users, ChevronDown, ChevronRight, Calendar, FileSpreadsheet } from 'lucide-react';
import type { InventarioReservado } from '../../services/propuestas.service';
import { udcFichaImg, udcFichaDe } from '../../lib/udc';

// Tarifa bruta unitaria (misma lógica que la vista de compartir): tarifa sin
// descuento por cara. $ MXN.
const tarifaBruta = (it: InventarioReservado): number =>
  Number((it as { tarifa_bruta_sc?: number | null }).tarifa_bruta_sc) || Number(it.tarifa_publica) || 0;
const fmtMXN = (n: number): string => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Tabla de "inventario reservado" para UDC (aeropuerto AICM) en la vista de
// compartir. Reemplaza al "Resumen de Circuitos" + mapa: los inventarios del
// aeropuerto no tienen geolocalización, así que se muestran como ficha técnica
// (pantalla · medida · formato · periodo · caras).

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function periodoLabel(it: InventarioReservado, tipoPeriodo?: string): string {
  if (tipoPeriodo === 'mensual' && it.inicio_periodo) {
    const p = it.inicio_periodo.split(/[-T]/);
    if (p.length >= 2) { const m = parseInt(p[1]) - 1; if (m >= 0 && m < 12) return `${MESES[m]} ${p[0]}`; }
  }
  if (it.numero_catorcena && it.anio_catorcena) return `Cat ${it.numero_catorcena} / ${it.anio_catorcena}`;
  return '—';
}

function ScreenPreview({ ancho, alto }: { ancho: number | null; alto: number | null }) {
  if (!ancho || !alto) {
    return <div className="w-[58px] h-[38px] rounded border border-dashed border-cyan-500/30" />;
  }
  const BW = 58, BH = 38;
  let w = BW, h = BW * alto / ancho;
  if (h > BH) { h = BH; w = BH * ancho / alto; }
  return (
    <div className="w-[58px] h-[38px] flex items-center justify-center">
      <div
        className="rounded-[3px] bg-gradient-to-br from-cyan-400 to-cyan-600 shadow-sm ring-1 ring-cyan-300/40"
        style={{ width: Math.max(8, w), height: Math.max(6, h) }}
        title={`${ancho} × ${alto}px`}
      />
    </div>
  );
}

function FilterChip({ active, onClick, children, isDark }: { active: boolean; onClick: () => void; children: React.ReactNode; isDark: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border ${active
        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
        : isDark
          ? 'bg-zinc-800/60 text-zinc-400 border-zinc-700/50 hover:text-zinc-200'
          : 'bg-gray-50 text-gray-500 border-gray-200 hover:text-gray-800'}`}
    >
      {children}
    </button>
  );
}

export function UdcReservadosTable({ items, isDark, tipoPeriodo }: { items: InventarioReservado[]; isDark: boolean; tipoPeriodo?: string }) {
  const [q, setQ] = useState('');
  const [periodoSel, setPeriodoSel] = useState<Set<string>>(new Set()); // vacío = todos
  const [tipoFilter, setTipoFilter] = useState<'all' | 'renta' | 'bonif'>('all');
  const [colapsados, setColapsados] = useState<Set<string>>(new Set());
  // Lightbox de la ficha técnica (imagen JPG de la pantalla).
  const [ficha, setFicha] = useState<{ src: string; titulo: string } | null>(null);

  const esBonif = (it: InventarioReservado) => (Number(it.caras_bonificadas) || 0) > 0;
  const esRenta = (it: InventarioReservado) => (Number(it.caras_renta) || 0) > 0;

  // Periodos (mes) disponibles, en orden cronológico.
  const periodos = useMemo(() => {
    const m = new Map<string, string>();
    items.forEach(it => {
      const label = periodoLabel(it, tipoPeriodo);
      const f = it.inicio_periodo || '';
      if (!m.has(label) || f < (m.get(label) || '')) m.set(label, f);
    });
    return Array.from(m.entries()).sort((a, b) => (a[1] || '').localeCompare(b[1] || '')).map(([l]) => l);
  }, [items, tipoPeriodo]);

  const hayBonif = useMemo(() => items.some(esBonif), [items]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter(it => {
      if (periodoSel.size > 0 && !periodoSel.has(periodoLabel(it, tipoPeriodo))) return false;
      if (tipoFilter === 'bonif' && !esBonif(it)) return false;
      if (tipoFilter === 'renta' && !esRenta(it)) return false;
      if (s && !`${it.articulo || ''} ${it.codigo_unico || ''} ${it.formato || ''} ${it.ancho}x${it.alto}`.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [items, q, periodoSel, tipoFilter, tipoPeriodo]);

  // Agrupado por periodo (mes), en orden cronológico.
  const grupos = useMemo(() => {
    const map = new Map<string, InventarioReservado[]>();
    filtered.forEach(it => {
      const k = periodoLabel(it, tipoPeriodo);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(it);
    });
    return periodos.filter(p => map.has(p)).map(p => [p, map.get(p)!] as [string, InventarioReservado[]]);
  }, [filtered, periodos, tipoPeriodo]);

  const togglePeriodo = (p: string) => setPeriodoSel(prev => { const n = new Set(prev); if (n.has(p)) n.delete(p); else n.add(p); return n; });
  const toggleColapso = (p: string) => setColapsados(prev => { const n = new Set(prev); if (n.has(p)) n.delete(p); else n.add(p); return n; });

  // Descargar Excel de los reservados (respetando filtros).
  const downloadExcel = () => {
    import('xlsx').then(XLSX => {
      const rows = filtered.map(it => {
        const f = udcFichaDe(it.codigo_unico);
        const ancho = it.ancho ?? f?.ancho ?? null;
        const alto = it.alto ?? f?.alto ?? null;
        const esBonif = (Number(it.caras_bonificadas) || 0) > 0 && (Number(it.caras_renta) || 0) === 0;
        const img = udcFichaImg(it.codigo_unico);
        return {
          Pantalla: it.codigo_unico || '',
          Zona: f?.zona || it.ubicacion || '',
          'Medida (px)': (ancho && alto) ? `${ancho} x ${alto}` : (f?.medida || ''),
          'Duración (seg)': f?.duracion ?? '',
          'Ficha técnica': img ? `${window.location.origin}${img}` : '',
          Tipo: esBonif ? 'Bonificación' : 'Renta',
          Periodo: periodoLabel(it, tipoPeriodo),
          Tarifa: tarifaBruta(it),
          Caras: it.caras_totales ?? 0,
        };
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Reservados UDC');
      XLSX.writeFile(wb, 'inventario_reservado_udc.xlsx');
    });
  };

  const th = `px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide ${isDark ? 'text-cyan-300/80' : 'text-cyan-700'}`;
  const td = `px-3 py-2.5 text-xs ${isDark ? 'text-zinc-300' : 'text-gray-700'}`;
  const mono = 'font-mono tabular-nums';

  return (
    <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-zinc-900 border-cyan-500/20' : 'bg-white border-cyan-200'}`}>
      {/* Header */}
      <div className={`px-5 py-4 border-b ${isDark ? 'border-cyan-500/20 bg-gradient-to-r from-cyan-600/10 to-sky-600/10' : 'border-cyan-100 bg-cyan-50/60'}`}>
        <div className="flex items-center justify-between gap-3">
          <h3 className={`text-sm font-semibold flex items-center gap-2 ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
            <Plane className="h-4 w-4" />
            Inventario reservado · UDC
            <span className={`text-xs font-normal ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>({items.length} pantalla{items.length !== 1 ? 's' : ''})</span>
          </h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} />
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Buscar pantalla…"
                className={`pl-8 pr-3 py-1.5 text-xs rounded-lg border w-48 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 ${isDark ? 'bg-zinc-800/70 border-zinc-700 text-white placeholder:text-zinc-500' : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400'}`}
              />
            </div>
            <button
              type="button"
              onClick={downloadExcel}
              disabled={filtered.length === 0}
              title="Descargar Excel de los reservados"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white shadow-sm transition-colors disabled:opacity-50"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
            </button>
          </div>
        </div>

        {/* Filtros: periodo (mes) + tipo */}
        {(periodos.length > 1 || hayBonif) && (
          <div className="flex items-center gap-2 flex-wrap mt-3">
            {periodos.length > 1 && (
              <>
                <span className={`text-[10px] uppercase font-semibold tracking-wide ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Periodo</span>
                <FilterChip active={periodoSel.size === 0} onClick={() => setPeriodoSel(new Set())} isDark={isDark}>Todos</FilterChip>
                {periodos.map(p => (
                  <FilterChip key={p} active={periodoSel.has(p)} onClick={() => togglePeriodo(p)} isDark={isDark}>{p}</FilterChip>
                ))}
              </>
            )}
            {hayBonif && (
              <>
                <span className={`h-4 w-px ${isDark ? 'bg-zinc-700' : 'bg-gray-300'}`} />
                <span className={`text-[10px] uppercase font-semibold tracking-wide ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Tipo</span>
                <FilterChip active={tipoFilter === 'all'} onClick={() => setTipoFilter('all')} isDark={isDark}>Todos</FilterChip>
                <FilterChip active={tipoFilter === 'renta'} onClick={() => setTipoFilter('renta')} isDark={isDark}>Renta</FilterChip>
                <FilterChip active={tipoFilter === 'bonif'} onClick={() => setTipoFilter('bonif')} isDark={isDark}>Bonificación</FilterChip>
              </>
            )}
          </div>
        )}
      </div>

      {/* Tabla */}
      {filtered.length === 0 ? (
        <div className={`flex flex-col items-center justify-center py-16 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
          <Monitor className="h-10 w-10 mb-2 opacity-30" />
          <p className="text-sm">{items.length === 0 ? 'Aún no hay pantallas reservadas' : 'Sin resultados para la búsqueda'}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={`${isDark ? 'bg-zinc-800/40' : 'bg-gray-50'} sticky top-0`}>
              <tr>
                <th className={th}></th>
                <th className={th}>Pantalla</th>
                <th className={th}>Medida</th>
                <th className={th}>Duración</th>
                <th className={th}>Ficha técnica</th>
                <th className={th}>Tipo</th>
                <th className={th}>Periodo</th>
                <th className={`${th} text-right`}>Tarifa</th>
                <th className={`${th} text-right`}>Caras</th>
              </tr>
            </thead>
            {grupos.map(([periodo, rows]) => {
              const abierto = !colapsados.has(periodo);
              const nCaras = rows.reduce((s, it) => s + (Number(it.caras_totales) || 0), 0);
              const invTotal = rows.reduce((s, it) => s + tarifaBruta(it) * (Number(it.caras_totales) || 0), 0);
              return (
              <tbody key={periodo}>
                <tr onClick={() => toggleColapso(periodo)} className={`cursor-pointer select-none ${isDark ? 'bg-zinc-800/70 hover:bg-zinc-800' : 'bg-cyan-50/80 hover:bg-cyan-100/70'}`}>
                  <td colSpan={10} className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {abierto ? <ChevronDown className="h-4 w-4 text-cyan-400" /> : <ChevronRight className="h-4 w-4 text-cyan-400" />}
                      <Calendar className="h-3.5 w-3.5 text-cyan-400" />
                      <span className={`text-sm font-semibold ${isDark ? 'text-cyan-200' : 'text-cyan-800'}`}>{periodo}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full ${isDark ? 'bg-cyan-500/15 text-cyan-300' : 'bg-cyan-100 text-cyan-700'}`}>{rows.length} pantalla{rows.length !== 1 ? 's' : ''} · {nCaras} cara{nCaras !== 1 ? 's' : ''}</span>
                      <div className="flex-1" />
                      <span className={`text-xs font-mono tabular-nums ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>{fmtMXN(invTotal)}</span>
                    </div>
                  </td>
                </tr>
                {abierto && rows.map((it, i) => {
                const f = udcFichaDe(it.codigo_unico);
                const ancho = it.ancho ?? f?.ancho ?? null;
                const alto = it.alto ?? f?.alto ?? null;
                const zona = f?.zona ?? null;
                const duracion = f?.duracion ?? null;
                const fichaSrc = udcFichaImg(it.codigo_unico);
                const fichaTitulo = it.codigo_unico || it.articulo || 'Ficha técnica';
                const nRenta = it.caras_renta ?? 0;
                const nBonif = it.caras_bonificadas ?? 0;
                return (
                <tr key={`${it.rsv_ids}-${i}`} className={`border-t ${isDark ? 'border-zinc-800 hover:bg-cyan-500/5' : 'border-gray-100 hover:bg-cyan-50/50'}`}>
                  <td className="px-3 py-2"><ScreenPreview ancho={ancho} alto={alto} /></td>
                  {/* Pantalla + zona */}
                  <td className="px-3 py-2.5">
                    <div className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{it.codigo_unico || '—'}</div>
                    {zona && <div className={`text-[10px] mt-0.5 ${isDark ? 'text-cyan-400/80' : 'text-cyan-700'}`}>{zona}</div>}
                  </td>
                  <td className={`${td} ${mono}`}>{ancho && alto ? `${ancho} × ${alto}` : 'Pte.'}</td>
                  {/* Duración */}
                  <td className={td}>
                    {duracion != null ? (
                      <span className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded ${isDark ? 'bg-cyan-500/10 text-cyan-300' : 'bg-cyan-50 text-cyan-700'}`}>
                        <Clock className="h-3 w-3" />{duracion} seg
                      </span>
                    ) : <span className={isDark ? 'text-zinc-600' : 'text-gray-400'}>—</span>}
                  </td>
                  {/* Ficha técnica */}
                  <td className="px-3 py-2">
                    {fichaSrc ? (
                      <button
                        type="button"
                        onClick={() => setFicha({ src: fichaSrc, titulo: fichaTitulo })}
                        title="Ver ficha técnica"
                        className={`group inline-flex items-center gap-2 rounded-lg border p-1 pr-2 transition-colors ${isDark ? 'border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20' : 'border-cyan-200 bg-cyan-50 hover:bg-cyan-100'}`}
                      >
                        <img
                          src={fichaSrc}
                          alt={fichaTitulo}
                          loading="lazy"
                          className="h-9 w-14 object-cover rounded-md ring-1 ring-black/10"
                        />
                        <span className={`text-[11px] font-medium ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>Ver ficha</span>
                      </button>
                    ) : (
                      <span className={`inline-flex items-center gap-1 text-[11px] ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
                        <ImageIcon className="h-3.5 w-3.5" /> —
                      </span>
                    )}
                  </td>
                  {/* Tipo (renta / bonificación) */}
                  <td className={td}>
                    <div className="flex flex-col gap-1 items-start">
                      {nRenta > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/25">
                          Renta{nRenta > 1 ? ` ×${nRenta}` : ''}
                        </span>
                      )}
                      {nBonif > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                          Bonificación{nBonif > 1 ? ` ×${nBonif}` : ''}
                        </span>
                      )}
                      {nRenta === 0 && nBonif === 0 && (
                        <span className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Digital</span>
                      )}
                    </div>
                  </td>
                  <td className={`${td} ${mono}`}>{periodoLabel(it, tipoPeriodo)}</td>
                  <td className={`${td} ${mono} text-right ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>{fmtMXN(tarifaBruta(it))}</td>
                  <td className={`${td} ${mono} text-right font-semibold`}>{it.caras_totales ?? 0}</td>
                </tr>
                );
              })}
              </tbody>
              );
            })}
          </table>
        </div>
      )}

      {/* Lightbox de la ficha técnica */}
      {ficha && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setFicha(null)}
        >
          <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 mb-2">
              <h4 className="text-white text-sm font-semibold flex items-center gap-2 min-w-0">
                <Plane className="h-4 w-4 text-cyan-400 shrink-0" />
                <span className="truncate">Ficha técnica · {ficha.titulo}</span>
              </h4>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={ficha.src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-white hover:bg-white/20 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Abrir
                </a>
                <button
                  type="button"
                  onClick={() => setFicha(null)}
                  className="p-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
                  title="Cerrar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="overflow-auto rounded-xl bg-white">
              <img src={ficha.src} alt={ficha.titulo} className="w-full h-auto" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
