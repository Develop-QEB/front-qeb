import { Circle, Clock, CheckCircle, AlertCircle, FileText, Send, Bell, Briefcase, Target, ClipboardList } from 'lucide-react';

// ============ CONFIGURACIÓN DE ESTATUS ============
export const STATUS_CONFIG = {
  'Activo': {
    color: 'text-amber-400',
    bg: 'bg-amber-500/20',
    border: 'border-amber-500/30',
    icon: Clock
  },
  'Atendido': {
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/20',
    border: 'border-emerald-500/30',
    icon: CheckCircle
  },
  'Pendiente': {
    color: 'text-blue-400',
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/30',
    icon: Circle
  },
  'Urgente': {
    color: 'text-red-400',
    bg: 'bg-red-500/20',
    border: 'border-red-500/30',
    icon: AlertCircle
  },
} as const;

// ============ CONFIGURACIÓN DE TIPOS DE TAREA ============
export const TIPO_CONFIG = {
  // Solicitudes - Azul
  'Solicitud': {
    color: 'text-blue-400',
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/30',
    icon: ClipboardList
  },
  'Atender solicitud': {
    color: 'text-blue-400',
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/30',
    icon: ClipboardList
  },

  // Propuestas - Púrpura
  'Propuesta': {
    color: 'text-purple-400',
    bg: 'bg-purple-500/20',
    border: 'border-purple-500/30',
    icon: FileText
  },
  'Seguimiento de propuesta': {
    color: 'text-purple-400',
    bg: 'bg-purple-500/20',
    border: 'border-purple-500/30',
    icon: FileText
  },

  // Campañas - Verde
  'Campaña': {
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/20',
    border: 'border-emerald-500/30',
    icon: Target
  },
  'Seguimiento Campaña': {
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/20',
    border: 'border-emerald-500/30',
    icon: Target
  },
  'Seguimiento de campaña': {
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/20',
    border: 'border-emerald-500/30',
    icon: Target
  },

  // Notificaciones - Cyan
  'Notificación': {
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/20',
    border: 'border-cyan-500/30',
    icon: Bell
  },
  'Notificación nueva': {
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/20',
    border: 'border-cyan-500/30',
    icon: Bell
  },

  // Tareas genéricas - Amber
  'Tarea': {
    color: 'text-amber-400',
    bg: 'bg-amber-500/20',
    border: 'border-amber-500/30',
    icon: Briefcase
  },

  // Envíos - Rosa
  'Envío': {
    color: 'text-pink-400',
    bg: 'bg-pink-500/20',
    border: 'border-pink-500/30',
    icon: Send
  },
} as const;

// Default para tipos no definidos
export const DEFAULT_TIPO_CONFIG = {
  color: 'text-zinc-400',
  bg: 'bg-zinc-500/20',
  border: 'border-zinc-500/30',
  icon: Circle
};

// Helper function para obtener config de tipo
export function getTipoConfig(tipo: string | null | undefined) {
  if (!tipo) return DEFAULT_TIPO_CONFIG;
  return TIPO_CONFIG[tipo as keyof typeof TIPO_CONFIG] || DEFAULT_TIPO_CONFIG;
}

// Helper function para obtener config de estatus
export function getStatusConfig(estatus: string | null | undefined) {
  if (!estatus) return STATUS_CONFIG['Activo'];
  return STATUS_CONFIG[estatus as keyof typeof STATUS_CONFIG] || STATUS_CONFIG['Activo'];
}

// Exportar tipos
export type TipoKey = keyof typeof TIPO_CONFIG;
export type StatusKey = keyof typeof STATUS_CONFIG;
