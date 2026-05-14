import { useEffect } from 'react';
import axios from 'axios';
import { useMaintenanceStore } from '../store/maintenanceStore';
import { useAuthStore } from '../store/authStore';

// Polling cada 30s al endpoint público /api/auth/maintenance-status.
// Si detecta acceso_restringido=1 y el rol del usuario actual NO está en la
// whitelist, dispara el overlay automáticamente. Sin requerir que el user
// haga una request que devuelva 503.
//
// Similar al patrón useVersionCheck para mostrar UpdateNotificationModal.

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const POLL_INTERVAL = 30 * 1000; // 30s

export function useMaintenanceCheck() {
  const setMaintenance = useMaintenanceStore(s => s.setMaintenance);
  const clear = useMaintenanceStore(s => s.clear);
  const user = useAuthStore(s => s.user);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const { data } = await axios.get(`${API_URL}/auth/maintenance-status`, { timeout: 8000 });
        if (cancelled) return;
        const s = data?.data;
        if (!s) return;

        const restringido = Number(s.acceso_restringido) === 1;
        const allowed = String(s.roles_permitidos || '')
          .split(',')
          .map((r: string) => r.trim())
          .filter(Boolean);

        // Si el rol del user está en whitelist (o no hay user porque está en /login),
        // mostramos el modal igual cuando está restringido — así también ven el aviso
        // los no logueados que intentan entrar.
        const rolDelUser = user?.rol || '';
        const userIsWhitelisted = rolDelUser && allowed.includes(rolDelUser);

        if (restringido && !userIsWhitelisted) {
          setMaintenance(s.motivo || 'QEB en mantenimiento. Acceso temporalmente restringido.');
        } else {
          // Si ya no está restringido (o este user es whitelist), limpia el overlay.
          clear();
        }
      } catch {
        // silencioso — si falla la red, no hacemos nada
      }
    }

    // Primera check inmediata.
    check();

    // Re-check al volver a la pestaña.
    function onVisible() {
      if (document.visibilityState === 'visible') check();
    }
    document.addEventListener('visibilitychange', onVisible);

    const interval = setInterval(check, POLL_INTERVAL);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(interval);
    };
  }, [user?.rol, setMaintenance, clear]);
}
