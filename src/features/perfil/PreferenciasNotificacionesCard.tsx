import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Monitor, Mail, Loader2 } from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import { getPermissions, RolePermissions } from '../../lib/permissions';
import {
  notificacionesService,
  PreferenciasNotif,
  PreferenciaUpdateItem,
  CatalogoNotif,
} from '../../services/notificaciones.service';

// ¿Este tipo de tarea es relevante para el rol? Deriva de los permisos reales
// (getPermissions). Si el rol no puede recibir/abrir ese tipo, no se muestra el
// toggle. Las notificaciones (categorías) son universales y no se filtran aquí.
function tipoTareaVisible(clave: string, p: RolePermissions, rol?: string | null): boolean {
  if (rol === 'Administrador' || rol === 'DEV') return true;
  switch (clave) {
    case 'Autorización DG': return rol === 'Director General';
    case 'Autorización DCM': return rol === 'Director Comercial';
    case 'Resultado de autorización': return p.canSeePropuestas || p.canSeeSolicitudes;
    case 'Revisión de artes': return p.canResolveRevisionArtesTasks;
    case 'Corrección': return p.canResolveCorreccionTasks || p.canOnlyOpenCorreccionTasks;
    case 'Ajuste Cto Cliente': return p.canSeePropuestas;
    case 'Ajuste Comercial': return p.canSeeSolicitudes || p.canSeePropuestas;
    case 'Impresión': return p.canOnlyOpenImpresionTasks || p.canResolveProduccionTasks;
    case 'Instalación': return p.canResolveProduccionTasks || p.canOnlyOpenRecepcionTasks || p.canCreateInstalacionFromRecibido || p.canCreateOrdenInstalacion;
    case 'Recepción': return p.canResolveProduccionTasks || p.canOnlyOpenRecepcionTasks;
    case 'Producción': return p.canResolveProduccionTasks;
    case 'Programación': return p.canCreateOrdenProgramacion || p.canOnlyOpenOrdenProgramacionTasks || p.canSeeTabProgramacion;
    case 'Seguimiento': return p.canSeeSolicitudes || p.canSeePropuestas || p.canSeeCampanas;
    default: return true;
  }
}

type Clase = 'notificacion' | 'tarea' | '__global__';
type Canal = 'popup' | 'email';

interface PrefsData {
  preferencias: PreferenciasNotif;
  catalogo: CatalogoNotif;
}

// Lee el valor efectivo de un (canal, clase, clave) desde la matriz.
function getVal(prefs: PreferenciasNotif, canal: Canal, clase: Clase, clave: string): boolean {
  const m = prefs[canal];
  if (clase === '__global__') return m.master;
  if (clase === 'notificacion') return clave === '__all__' ? m.masterNotificacion : (m.notificacion[clave] ?? true);
  return clave === '__all__' ? m.masterTarea : (m.tarea[clave] ?? true);
}

// Aplica un cambio a la matriz (para update optimista).
function applyChange(prefs: PreferenciasNotif, item: PreferenciaUpdateItem): PreferenciasNotif {
  const next: PreferenciasNotif = {
    popup: { ...prefs.popup, notificacion: { ...prefs.popup.notificacion }, tarea: { ...prefs.popup.tarea } },
    email: { ...prefs.email, notificacion: { ...prefs.email.notificacion }, tarea: { ...prefs.email.tarea } },
  };
  const m = next[item.canal];
  if (item.clase === '__global__') m.master = item.habilitado;
  else if (item.clase === 'notificacion') {
    if (item.clave === '__all__') m.masterNotificacion = item.habilitado;
    else m.notificacion[item.clave] = item.habilitado;
  } else {
    if (item.clave === '__all__') m.masterTarea = item.habilitado;
    else m.tarea[item.clave] = item.habilitado;
  }
  return next;
}

function Switch({ checked, onChange, dimmed }: { checked: boolean; onChange: (v: boolean) => void; dimmed?: boolean }) {
  const isDark = useThemeStore((s) => s.theme === 'dark');
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${dimmed ? 'opacity-40' : ''} ${
        checked ? 'bg-purple-600' : isDark ? 'bg-zinc-700' : 'bg-gray-300'
      }`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  );
}

export function PreferenciasNotificacionesCard() {
  const isDark = useThemeStore((s) => s.theme === 'dark');
  const queryClient = useQueryClient();
  const rol = useAuthStore((s) => s.user?.rol);
  const perms = getPermissions(rol);

  const { data, isLoading } = useQuery<PrefsData>({
    queryKey: ['notif-preferencias'],
    queryFn: () => notificacionesService.getPreferencias(),
    staleTime: 10 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: (item: PreferenciaUpdateItem) => notificacionesService.updatePreferencias([item]),
    onMutate: async (item) => {
      await queryClient.cancelQueries({ queryKey: ['notif-preferencias'] });
      const prev = queryClient.getQueryData<PrefsData>(['notif-preferencias']);
      if (prev) {
        queryClient.setQueryData<PrefsData>(['notif-preferencias'], {
          ...prev,
          preferencias: applyChange(prev.preferencias, item),
        });
      }
      return { prev };
    },
    onError: (_err, _item, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['notif-preferencias'], ctx.prev);
    },
    onSuccess: (res) => {
      queryClient.setQueryData<PrefsData>(['notif-preferencias'], (old) =>
        old ? { ...old, preferencias: res.preferencias } : old
      );
    },
  });

  const cardCls = `rounded-2xl border p-6 ${isDark ? 'bg-zinc-900/50 border-zinc-800/50' : 'bg-white border-gray-200 shadow-sm'}`;
  const muted = isDark ? 'text-zinc-400' : 'text-gray-500';

  if (isLoading || !data) {
    return (
      <div className={cardCls}>
        <h3 className={`text-lg font-medium flex items-center gap-2 mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          <Bell className="h-5 w-5 text-purple-400" /> Preferencias de notificaciones
        </h3>
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
        </div>
      </div>
    );
  }

  const prefs = data.preferencias;

  const toggle = (canal: Canal, clase: Clase, clave: string, current: boolean) => {
    mutation.mutate({ canal, clase, clave, habilitado: !current });
  };

  // Una fila: etiqueta + switch popup + switch correo.
  // emailAplica=false oculta el switch de correo (ese tipo no envía correo).
  const Row = ({
    label, clase, clave, bold, popupDim, emailDim, emailAplica = true,
  }: {
    label: string; clase: Clase; clave: string; bold?: boolean; popupDim?: boolean; emailDim?: boolean; emailAplica?: boolean;
  }) => {
    const popupVal = getVal(prefs, 'popup', clase, clave);
    const emailVal = getVal(prefs, 'email', clase, clave);
    return (
      <div className={`grid grid-cols-[1fr_auto_auto] items-center gap-x-10 py-2 ${isDark ? 'border-zinc-800/40' : 'border-gray-100'}`}>
        <span className={`text-sm ${bold ? (isDark ? 'text-white font-medium' : 'text-gray-900 font-medium') : muted}`}>{label}</span>
        <div className="w-10 flex justify-center">
          <Switch checked={popupVal} dimmed={popupDim} onChange={() => toggle('popup', clase, clave, popupVal)} />
        </div>
        <div className="w-10 flex justify-center">
          {emailAplica
            ? <Switch checked={emailVal} dimmed={emailDim} onChange={() => toggle('email', clase, clave, emailVal)} />
            : <span className={`text-xs ${isDark ? 'text-zinc-700' : 'text-gray-300'}`}>—</span>}
        </div>
      </div>
    );
  };

  const notifMasterOffPopup = !prefs.popup.master || !prefs.popup.masterNotificacion;
  const notifMasterOffEmail = !prefs.email.master || !prefs.email.masterNotificacion;
  const tareaMasterOffPopup = !prefs.popup.master || !prefs.popup.masterTarea;
  const tareaMasterOffEmail = !prefs.email.master || !prefs.email.masterTarea;

  // Solo los tipos de tarea que el rol puede recibir (según permisos reales).
  const tareasVisibles = data.catalogo.tarea.filter((t) => tipoTareaVisible(t.clave, perms, rol));

  return (
    <div className={cardCls}>
      <div className="flex items-start justify-between mb-1">
        <h3 className={`text-lg font-medium flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          <Bell className="h-5 w-5 text-purple-400" /> Preferencias de notificaciones
        </h3>
        {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin text-purple-400 mt-1" />}
      </div>
      <p className={`text-sm mb-4 ${muted}`}>
        Elige qué notificaciones y tareas quieres recibir como ventana emergente y/o por correo.
      </p>

      {/* Encabezado de columnas */}
      <div className={`grid grid-cols-[1fr_auto_auto] items-center gap-x-10 pb-2 border-b mb-2 ${isDark ? 'border-zinc-800/60' : 'border-gray-200'}`}>
        <span />
        <div className="w-10 flex flex-col items-center gap-0.5">
          <Monitor className={`h-4 w-4 ${muted}`} />
          <span className={`text-[10px] ${muted}`}>Popup</span>
        </div>
        <div className="w-10 flex flex-col items-center gap-0.5">
          <Mail className={`h-4 w-4 ${muted}`} />
          <span className={`text-[10px] ${muted}`}>Correo</span>
        </div>
      </div>

      {/* Master global */}
      <Row label="Activar todo" clase="__global__" clave="__all__" bold />

      {/* Notificaciones */}
      <div className={`mt-4 mb-1 text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
        Notificaciones
      </div>
      <Row label="Todas las notificaciones" clase="notificacion" clave="__all__" bold
        popupDim={!prefs.popup.master} emailDim={!prefs.email.master} />
      {data.catalogo.notificacion.map((c) => (
        <Row key={`n-${c.clave}`} label={c.label} clase="notificacion" clave={c.clave}
          popupDim={notifMasterOffPopup} emailDim={notifMasterOffEmail} emailAplica={c.email !== false} />
      ))}

      {/* Tareas — solo los tipos que el rol puede recibir (según permisos) */}
      {tareasVisibles.length > 0 && (
        <>
          <div className={`mt-4 mb-1 text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
            Tareas
          </div>
          <Row label="Todas las tareas" clase="tarea" clave="__all__" bold
            popupDim={!prefs.popup.master} emailDim={!prefs.email.master} />
          {tareasVisibles.map((t) => (
            <Row key={`t-${t.clave}`} label={t.label} clase="tarea" clave={t.clave}
              popupDim={tareaMasterOffPopup} emailDim={tareaMasterOffEmail} emailAplica={t.email !== false} />
          ))}
        </>
      )}
    </div>
  );
}
