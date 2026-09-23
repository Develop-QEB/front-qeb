import { useMemo, useState } from 'react';
import { Plane, X, ExternalLink, MapPin } from 'lucide-react';
import udcMapaPA from './assets/udc-mapa-aicm-t1.jpg';
import udcMapaPB from './assets/udc-mapa-aicm-t1-pb.jpg';
import { UDC_MAPA_COORDS, UDC_MAPA_COORDS_PB, udcFichaImg, udcPantallaNum, udcFichaDe } from '../../lib/udc';

// Mapas del aeropuerto (AICM T1) con las pantallas. Cada plano trae TODOS sus
// puntos dibujados; aquí atenuamos la imagen (escala de grises) y encima
// superponemos un marcador VERDE solo en las pantallas RESERVADAS. Clic en un
// marcador → abre la ficha técnica. Se muestran los planos que tengan al menos
// una pantalla reservada (Planta Alta y/o Planta Baja). El emparejamiento es por
// número canónico (udcPantallaNum), así funciona con los códigos reales del
// inventario ("DIG- 20_…") y los de ficha ("DIGITAL 20").
const MAPAS = [
  { id: 'pa', titulo: 'Terminal 1 · Planta Alta', img: udcMapaPA, coords: UDC_MAPA_COORDS },
  { id: 'pb', titulo: 'Terminal 1 · Planta Baja', img: udcMapaPB, coords: UDC_MAPA_COORDS_PB },
];
const nombreDe = (num: string) => udcFichaDe(num)?.nombre ?? `DIGITAL ${num}`;
const enAlgunMapa = (num: string) => MAPAS.some(m => m.coords[num]);

export function UdcMapaAeropuerto({ reservados, isDark }: { reservados: Set<string>; isDark: boolean }) {
  const [ficha, setFicha] = useState<{ src: string; titulo: string } | null>(null);

  const reservadosUp = useMemo(
    () => new Set(Array.from(reservados).map(udcPantallaNum)),
    [reservados]
  );

  // Planos con al menos una pantalla reservada, con sus puntos ya marcados.
  const planos = useMemo(
    () => MAPAS.map(m => {
      const puntos = Object.entries(m.coords).map(([num, pos]) => ({
        num, nombre: nombreDe(num), x: pos.x, y: pos.y, reservado: reservadosUp.has(num),
      }));
      return { ...m, puntos, nRes: puntos.filter(p => p.reservado).length };
    }).filter(m => m.nRes > 0),
    [reservadosUp]
  );

  // Reservadas que no tienen punto en NINGÚN plano (Zona A, 1-A/1-B, T2…).
  const fueraDelMapa = useMemo(
    () => Array.from(reservadosUp).filter(n => !enAlgunMapa(n)).map(nombreDe).sort(),
    [reservadosUp]
  );
  const totalRes = reservadosUp.size;

  const abrirFicha = (nombre: string) => {
    const src = udcFichaImg(nombre);
    if (src) setFicha({ src, titulo: nombre });
  };

  return (
    <div className="space-y-5">
      {planos.length === 0 && (
        <div className={`rounded-lg border px-3 py-3 text-[11px] text-center ${isDark ? 'border-amber-500/30 bg-amber-500/10 text-amber-200' : 'border-amber-300 bg-amber-50 text-amber-800'}`}>
          Ninguna de las pantallas reservadas aparece en los planos disponibles (Planta Alta / Planta Baja).
        </div>
      )}

      {planos.map(plano => (
        <div key={plano.id}>
          <div className="flex items-center gap-2 mb-1.5">
            <MapPin className={`h-4 w-4 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} />
            <h4 className={`text-xs font-semibold ${isDark ? 'text-cyan-200' : 'text-cyan-800'}`}>{plano.titulo}</h4>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>
              {plano.nRes} reservada{plano.nRes !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="relative w-full min-w-[560px]">
            <img
              src={plano.img}
              alt={`Plano ${plano.titulo} del Aeropuerto de la Ciudad de México con la ubicación de las pantallas digitales`}
              className={`w-full rounded-lg select-none ${isDark ? 'bg-white/90 p-2' : ''}`}
              style={{ filter: 'grayscale(1) contrast(0.95) opacity(0.55)' }}
              draggable={false}
            />
            {plano.puntos.filter(p => p.reservado).map(p => {
              const src = udcFichaImg(p.nombre);
              return (
                <button
                  key={p.num}
                  type="button"
                  onClick={() => abrirFicha(p.nombre)}
                  title={`${p.nombre}${src ? ' — ver ficha técnica' : ''}`}
                  className="absolute -translate-x-1/2 -translate-y-1/2 group focus:outline-none"
                  style={{ left: `${p.x}%`, top: `${p.y}%` }}
                >
                  <span className="relative flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 ring-2 ring-white shadow-md group-hover:bg-emerald-400" />
                  </span>
                  <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-[18px] whitespace-nowrap px-1.5 py-0.5 rounded bg-black/80 text-white text-[9px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    {p.nombre}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Leyenda */}
      <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" />
          Reservado ({totalRes - fueraDelMapa.length})
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex h-3 w-3 rounded-full bg-zinc-400/60 ring-1 ring-white/60" />
          No reservado (atenuado)
        </span>
        <span className={isDark ? 'text-zinc-600' : 'text-gray-400'}>· Clic en un punto verde para ver su ficha técnica</span>
      </div>

      {fueraDelMapa.length > 0 && (
        <div className={`rounded-lg border px-3 py-2 text-[11px] ${isDark ? 'border-zinc-700 bg-zinc-800/40 text-zinc-400' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
          Reservadas sin plano disponible aún: <span className="font-medium">{fueraDelMapa.join(', ')}</span>.
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
