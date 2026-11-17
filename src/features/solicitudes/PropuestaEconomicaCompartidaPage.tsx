import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertCircle } from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';
import { propuestaEconomicaService } from '../../services/propuestaEconomica.service';
import { PropuestaEconomicaModal } from './PropuestaEconomicaModal';

/**
 * Abre una propuesta económica por enlace (/solicitudes/propuesta-economica/:id).
 * Cualquier usuario del sistema puede verla y descargarla; solo su autor la
 * edita. Los demás la ven en solo lectura y pueden duplicarla.
 */
export function PropuestaEconomicaCompartidaPage() {
  const isDark = useThemeStore(s => s.theme) === 'dark';
  const { propuestaId } = useParams<{ propuestaId: string }>();
  const navigate = useNavigate();
  const id = parseInt(propuestaId || '', 10);
  const cerrar = () => navigate('/solicitudes', { replace: true });

  const { data, isLoading, error } = useQuery({
    queryKey: ['propuesta-economica', id],
    queryFn: () => propuestaEconomicaService.get(id),
    enabled: !Number.isNaN(id),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
        <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Cargando propuesta económica...</p>
      </div>
    );
  }

  if (Number.isNaN(id) || error || !data) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4 text-center">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDark ? 'bg-red-500/15' : 'bg-red-50'}`}>
          <AlertCircle className={`h-6 w-6 ${isDark ? 'text-red-300' : 'text-red-600'}`} />
        </div>
        <p className={`text-sm max-w-md ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>
          No se pudo abrir la propuesta económica. Es posible que el enlace sea inválido o que ya no exista.
        </p>
        <button
          onClick={cerrar}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${isDark ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30' : 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100'}`}
        >
          Volver
        </button>
      </div>
    );
  }

  return <PropuestaEconomicaModal isOpen initial={data} onClose={cerrar} />;
}
