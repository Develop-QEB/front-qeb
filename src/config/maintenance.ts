// Modo mantenimiento programado.
// true  -> usuarios fuera del whitelist son enviados a /mantenimiento.
// false -> comportamiento normal, no se redirige a nadie.
export const MAINTENANCE_MODE = true;

export const MAINTENANCE_TITLE = 'QEB esta en mantenimiento programado';

export const MAINTENANCE_MESSAGE =
  'Estamos realizando actualizaciones al sistema. El servicio estara disponible nuevamente a partir de las 12:00 a.m.';

export const isUserAllowedDuringMaintenance = (rol: string | undefined | null): boolean => {
  const cleaned = (rol ?? '').trim();
  if (!cleaned) return false;
  if (cleaned === 'Administrador') return true;
  if (cleaned === 'DEV') return true;
  return cleaned.toLowerCase().includes('rafico');
};
