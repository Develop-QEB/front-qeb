import { useMemo, useState } from 'react';
import { Plane, Monitor, Search, Layers } from 'lucide-react';
import type { InventarioReservado } from '../../services/propuestas.service';

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

export function UdcReservadosTable({ items, isDark, tipoPeriodo }: { items: InventarioReservado[]; isDark: boolean; tipoPeriodo?: string }) {
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(it =>
      `${it.articulo || ''} ${it.codigo_unico || ''} ${it.formato || ''} ${it.ancho}x${it.alto}`.toLowerCase().includes(s)
    );
  }, [items, q]);

  const th = `px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide ${isDark ? 'text-cyan-300/80' : 'text-cyan-700'}`;
  const td = `px-3 py-2.5 text-xs ${isDark ? 'text-zinc-300' : 'text-gray-700'}`;
  const mono = 'font-mono tabular-nums';

  return (
    <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-zinc-900 border-cyan-500/20' : 'bg-white border-cyan-200'}`}>
      {/* Header */}
      <div className={`px-5 py-4 border-b flex items-center justify-between gap-3 ${isDark ? 'border-cyan-500/20 bg-gradient-to-r from-cyan-600/10 to-sky-600/10' : 'border-cyan-100 bg-cyan-50/60'}`}>
        <h3 className={`text-sm font-semibold flex items-center gap-2 ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
          <Plane className="h-4 w-4" />
          Inventario reservado · UDC
          <span className={`text-xs font-normal ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>({items.length} pantalla{items.length !== 1 ? 's' : ''})</span>
        </h3>
        <div className="relative">
          <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar pantalla…"
            className={`pl-8 pr-3 py-1.5 text-xs rounded-lg border w-48 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 ${isDark ? 'bg-zinc-800/70 border-zinc-700 text-white placeholder:text-zinc-500' : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400'}`}
          />
        </div>
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
                <th className={th}>Formato</th>
                <th className={th}>Periodo</th>
                <th className={`${th} text-right`}>Caras</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((it, i) => (
                <tr key={`${it.rsv_ids}-${i}`} className={`border-t ${isDark ? 'border-zinc-800 hover:bg-cyan-500/5' : 'border-gray-100 hover:bg-cyan-50/50'}`}>
                  <td className="px-3 py-2"><ScreenPreview ancho={it.ancho} alto={it.alto} /></td>
                  <td className={`${td} font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{it.articulo || it.codigo_unico || '—'}</td>
                  <td className={`${td} ${mono}`}>{it.ancho && it.alto ? `${it.ancho} × ${it.alto}` : 'Pte.'}</td>
                  <td className={td}>
                    <span className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded ${isDark ? 'bg-cyan-500/10 text-cyan-300' : 'bg-cyan-50 text-cyan-700'}`}>
                      <Layers className="h-3 w-3" />{it.formato || it.tipo_de_mueble || 'Digital'}
                    </span>
                  </td>
                  <td className={`${td} ${mono}`}>{periodoLabel(it, tipoPeriodo)}</td>
                  <td className={`${td} ${mono} text-right font-semibold`}>{it.caras_totales ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
