import { useEffect } from 'react';
import { Wrench } from 'lucide-react';
import { useMaintenanceStore } from '../store/maintenanceStore';
import { useAuthStore } from '../store/authStore';

// Overlay full-screen NO cerrable que aparece cuando el back devuelve
// 503/MAINTENANCE. Bloquea toda interacción con la app.
export function MaintenanceOverlay() {
  const { isInMaintenance, motivo, clear } = useMaintenanceStore();
  const logout = useAuthStore(s => s.logout);

  // Bloquea scroll del body cuando el overlay está activo.
  useEffect(() => {
    if (isInMaintenance) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [isInMaintenance]);

  if (!isInMaintenance) return null;

  const handleLogout = () => {
    clear();
    logout();
    window.location.href = '/login';
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-zinc-950/95 backdrop-blur-sm"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="max-w-md w-[90%] rounded-2xl border border-amber-500/40 bg-zinc-900 p-8 shadow-2xl text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mb-5">
          <Wrench className="w-8 h-8 text-amber-400" />
        </div>
        <h1 className="text-2xl font-bold text-zinc-100 mb-2">QEB en mantenimiento</h1>
        <p className="text-sm text-zinc-300 leading-relaxed mb-6">
          {motivo || 'Tu acceso está temporalmente restringido. Por favor espera a que el equipo técnico habilite nuevamente el sistema.'}
        </p>
        <p className="text-[11px] text-zinc-500 mb-4">
          Para dudas o urgencias contacta a <span className="text-zinc-300">sistemas / desarrollo</span>.
        </p>
        <button
          onClick={handleLogout}
          className="w-full px-4 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium border border-zinc-700 transition-colors"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
