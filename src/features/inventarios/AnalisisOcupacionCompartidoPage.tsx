import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';
import { analisisOcupacionService, AnalisisOcupacion } from '../../services/analisisOcupacion.service';
import { AnalisisOcupacionModal } from './AnalisisOcupacionModal';

/**
 * Visor de un análisis de ocupación compartido por enlace, en modo solo lectura.
 *
 * Se usa para usuarios SIN acceso al módulo de inventario: cualquier usuario del
 * sistema puede abrir el enlace y ver la matriz, pero no editarla ni liberar
 * reservas. Los usuarios CON acceso a inventario abren el mismo enlace dentro de
 * InventariosPage, con todas las acciones de edición.
 */
export function AnalisisOcupacionCompartidoPage() {
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const { analisisId: analisisIdParam } = useParams<{ analisisId?: string }>();
  const navigate = useNavigate();

  const [analisis, setAnalisis] = useState<AnalisisOcupacion | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!analisisIdParam) return;
    const id = parseInt(analisisIdParam);
    if (Number.isNaN(id)) {
      setError('Enlace inválido');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const a = await analisisOcupacionService.get(id);
        if (cancelled) return;
        setAnalisis(a);
      } catch (err) {
        if (cancelled) return;
        console.error('Error abriendo análisis compartido:', err);
        setError('No se pudo abrir el análisis compartido. Es posible que ya no exista.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [analisisIdParam]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
        <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Cargando análisis compartido...</p>
      </div>
    );
  }

  if (error || !analisis) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDark ? 'bg-red-500/15' : 'bg-red-50'}`}>
          <AlertCircle className={`h-6 w-6 ${isDark ? 'text-red-300' : 'text-red-600'}`} />
        </div>
        <p className={`text-sm max-w-md ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>
          {error || 'No se encontró el análisis compartido.'}
        </p>
        <button
          onClick={() => navigate('/', { replace: true })}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${isDark ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30' : 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100'}`}
        >
          Volver al inicio
        </button>
      </div>
    );
  }

  return (
    <AnalisisOcupacionModal
      open
      readOnly
      initialAnalisis={analisis}
      onClose={() => navigate('/', { replace: true })}
    />
  );
}
