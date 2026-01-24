// Definición de permisos por rol

export type UserRole =
  | 'Asesor Comercial'
  | 'Gerente Digital Programático'
  | 'Analista de Servicio al Cliente'
  | 'Gerente de Tráfico'
  | 'Coordinador de tráfico'
  | 'Especialista de tráfico'
  | 'Auxiliar de tráfico'
  | 'Coordinador de Diseño'
  | 'Diseñadores'
  | 'Compradores'
  | 'Director de Operaciones'
  | 'Gerentes de Operaciones Plazas y CON'
  | 'Jefes de Operaciones Plazas y CON'
  | 'Supervisores de Operaciones'
  | 'Coordinador de Facturación y Cobranza'
  | 'Mesa de Control'
  | 'Analista de Facturación y Cobranza'
  | 'Administrador';

export interface RolePermissions {
  // Secciones visibles
  canSeeDashboard: boolean;
  canSeeClientes: boolean;
  canSeeProveedores: boolean;
  canSeeSolicitudes: boolean;
  canSeePropuestas: boolean;
  canSeeCampanas: boolean;
  canSeeInventarios: boolean;
  canSeeAdminUsuarios: boolean;

  // Clientes
  canCreateClientes: boolean;
  canEditClientes: boolean;
  canDeleteClientes: boolean;

  // Proveedores
  canCreateProveedores: boolean;
  canEditProveedores: boolean;
  canDeleteProveedores: boolean;

  // Solicitudes
  canCreateSolicitudes: boolean;
  canEditSolicitudes: boolean;
  canDeleteSolicitudes: boolean;
  canAtenderSolicitudes: boolean;
  canChangeEstadoSolicitud: boolean; // Cambiar estado en modal (si es false, solo puede ver y comentar)

  // Propuestas
  canEditPropuestaStatus: boolean;
  allowedPropuestaStatuses: string[] | null; // null = todos, array = solo esos
  canAprobarPropuesta: boolean;
  canAsignarInventario: boolean;
  canEditResumenPropuesta: boolean; // Editar campos en Resumen de Propuesta del modal
  canCompartirPropuesta: boolean;
  canBuscarInventarioEnModal: boolean;

  // Campañas
  canEditCampanas: boolean;
  canEditDetalleCampana: boolean;
  canDeleteDetalleCampana: boolean;
  canSeeGestionArtes: boolean; // Ver página de Gestión de Artes
  canEditGestionArtes: boolean;
  canResolveProduccionTasks: boolean; // Resolver/completar tareas de producción (Impresión, Recepción, Instalación)
  canSeeOrdenesMontajeButton: boolean; // Ver botón de órdenes de montaje en campañas

  // Gestión de Artes - Tabs
  canSeeTabProgramacion: boolean;
  canSeeTabImpresiones: boolean;
  canSeeTabSubirArtes: boolean;
  canSeeTabTestigos: boolean;
  canSeeTabValidacionInstalacion: boolean;
  canCreateTareasGestionArtes: boolean; // Crear tareas en gestión de artes
  canResolveRevisionArtesTasks: boolean; // Resolver tareas de revisión de artes
  canOnlyOpenImpresionTasks: boolean; // Solo puede abrir tareas de tipo Impresión (oculta botón Abrir para otros tipos)

  // Inventarios
  canCreateInventarios: boolean;
  canEditInventarios: boolean;
  canDeleteInventarios: boolean;

  // Órdenes de Montaje
  canExportOrdenesMontaje: boolean;
}

// Permisos por defecto (acceso total - para Admin)
const defaultPermissions: RolePermissions = {
  canSeeDashboard: true,
  canSeeClientes: true,
  canSeeProveedores: true,
  canSeeSolicitudes: true,
  canSeePropuestas: true,
  canSeeCampanas: true,
  canSeeInventarios: true,
  canSeeAdminUsuarios: true,

  canCreateClientes: true,
  canEditClientes: true,
  canDeleteClientes: true,

  canCreateProveedores: true,
  canEditProveedores: true,
  canDeleteProveedores: true,

  canCreateSolicitudes: true,
  canEditSolicitudes: true,
  canDeleteSolicitudes: true,
  canAtenderSolicitudes: true,
  canChangeEstadoSolicitud: true,

  canEditPropuestaStatus: true,
  allowedPropuestaStatuses: null, // null = todos los estatus
  canAprobarPropuesta: true,
  canAsignarInventario: true,
  canEditResumenPropuesta: true,
  canCompartirPropuesta: true,
  canBuscarInventarioEnModal: true,

  canEditCampanas: true,
  canEditDetalleCampana: true,
  canDeleteDetalleCampana: true,
  canSeeGestionArtes: true,
  canEditGestionArtes: true,
  canResolveProduccionTasks: true,
  canSeeOrdenesMontajeButton: true,

  canSeeTabProgramacion: true,
  canSeeTabImpresiones: true,
  canSeeTabSubirArtes: true,
  canSeeTabTestigos: true,
  canSeeTabValidacionInstalacion: true,
  canCreateTareasGestionArtes: true,
  canResolveRevisionArtesTasks: true,
  canOnlyOpenImpresionTasks: false,

  canCreateInventarios: true,
  canEditInventarios: true,
  canDeleteInventarios: true,

  canExportOrdenesMontaje: true,
};

// Permisos específicos por rol
const rolePermissions: Partial<Record<UserRole, Partial<RolePermissions>>> = {
  'Asesor Comercial': {
    canSeeDashboard: false,
    canSeeInventarios: false,
    canSeeAdminUsuarios: false,

    canDeleteClientes: false,

    canCreateProveedores: false,
    canEditProveedores: false,
    canDeleteProveedores: false,

    // Puede cambiar estatus pero solo a estos valores
    allowedPropuestaStatuses: ['Por aprobar', 'Pase a ventas', 'Ajuste Cto-Cliente'],
    canBuscarInventarioEnModal: false,

    canEditCampanas: false,
    canEditDetalleCampana: false,
    canDeleteDetalleCampana: false,
    canEditGestionArtes: false,

    canCreateInventarios: false,
    canEditInventarios: false,
    canDeleteInventarios: false,
  },
  'Gerente Digital Programático': {
    canSeeDashboard: false,
    canSeeInventarios: false,
    canSeeAdminUsuarios: false,

    canDeleteClientes: false,

    canCreateProveedores: false,
    canEditProveedores: false,
    canDeleteProveedores: false,

    // Puede cambiar estatus pero solo a estos valores
    allowedPropuestaStatuses: ['Por aprobar', 'Pase a ventas', 'Ajuste Cto-Cliente'],
    canBuscarInventarioEnModal: false,

    canEditCampanas: false,
    canEditDetalleCampana: false,
    canDeleteDetalleCampana: false,
    canEditGestionArtes: false,

    canCreateInventarios: false,
    canEditInventarios: false,
    canDeleteInventarios: false,
  },
  'Analista de Servicio al Cliente': {
    // Dashboard: Oculto
    canSeeDashboard: false,
    // Inventarios: Oculto
    canSeeInventarios: false,
    // Admin Usuarios: Oculto
    canSeeAdminUsuarios: false,

    // Clientes: Solo visualización
    canCreateClientes: false,
    canEditClientes: false,
    canDeleteClientes: false,

    // Proveedores: Solo visualización
    canCreateProveedores: false,
    canEditProveedores: false,
    canDeleteProveedores: false,

    // Solicitudes: Solo visualización (ver detalles y comentar, pero no cambiar estado)
    canCreateSolicitudes: false,
    canEditSolicitudes: false,
    canDeleteSolicitudes: false,
    canAtenderSolicitudes: false,
    canChangeEstadoSolicitud: false, // Solo puede ver y comentar, no cambiar estado

    // Propuestas: Solo visualización (excepto compartir)
    canEditPropuestaStatus: false,
    allowedPropuestaStatuses: [],
    canAprobarPropuesta: false,
    canAsignarInventario: false, // No puede editar inventario, solo ver
    canCompartirPropuesta: true, // SÍ puede compartir
    canBuscarInventarioEnModal: false,

    // Campañas: Ocultar botón editar (pero Detalle Campaña tiene acceso total)
    canEditCampanas: false,
    // canEditDetalleCampana: true (por defecto)
    // canDeleteDetalleCampana: true (por defecto)

    // Gestión de Artes: Puede hacer todo EXCEPTO resolver tareas de producción
    // canEditGestionArtes: true (por defecto)
    canResolveProduccionTasks: false,

    // Inventarios: Oculto (ya se oculta con canSeeInventarios: false)
    canCreateInventarios: false,
    canEditInventarios: false,
    canDeleteInventarios: false,
  },
  'Administrador': {
    // Admin tiene todos los permisos por defecto
  },
  'Gerente de Tráfico': {
    // Secciones visibles
    canSeeDashboard: true,
    canSeeClientes: false,
    canSeeProveedores: false,
    canSeeSolicitudes: false,
    canSeePropuestas: true,
    canSeeCampanas: true,
    canSeeInventarios: false,
    canSeeAdminUsuarios: true,

    // Clientes - oculto
    canCreateClientes: false,
    canEditClientes: false,
    canDeleteClientes: false,

    // Proveedores - oculto
    canCreateProveedores: false,
    canEditProveedores: false,
    canDeleteProveedores: false,

    // Solicitudes - oculto
    canCreateSolicitudes: false,
    canEditSolicitudes: false,
    canDeleteSolicitudes: false,
    canAtenderSolicitudes: false,
    canChangeEstadoSolicitud: false,

    // Propuestas - pueden cambiar a Abierto, Atendido y Compartir
    canEditPropuestaStatus: true,
    allowedPropuestaStatuses: ['Abierto', 'Atendido'],
    canAprobarPropuesta: false,
    canAsignarInventario: true,
    canEditResumenPropuesta: false, // Solo visualización en Resumen de Propuesta
    canCompartirPropuesta: true, // Puede ver y usar botón compartir
    canBuscarInventarioEnModal: true,

    // Campañas - pueden hacer todo excepto detalle
    canEditCampanas: true,
    canEditDetalleCampana: false, // Solo visualización en detalle
    canDeleteDetalleCampana: false, // No pueden quitar APs
    canSeeGestionArtes: false, // Gestión de artes oculto
    canEditGestionArtes: false,
    canResolveProduccionTasks: false,

    // Inventarios - oculto
    canCreateInventarios: false,
    canEditInventarios: false,
    canDeleteInventarios: false,
  },
  'Coordinador de tráfico': {
    // Secciones visibles
    canSeeDashboard: true,
    canSeeClientes: false,
    canSeeProveedores: false,
    canSeeSolicitudes: false,
    canSeePropuestas: true,
    canSeeCampanas: true,
    canSeeInventarios: false,
    canSeeAdminUsuarios: false,

    // Clientes - oculto
    canCreateClientes: false,
    canEditClientes: false,
    canDeleteClientes: false,

    // Proveedores - oculto
    canCreateProveedores: false,
    canEditProveedores: false,
    canDeleteProveedores: false,

    // Solicitudes - oculto
    canCreateSolicitudes: false,
    canEditSolicitudes: false,
    canDeleteSolicitudes: false,
    canAtenderSolicitudes: false,
    canChangeEstadoSolicitud: false,

    // Propuestas - pueden cambiar a Abierto, Atendido y Compartir
    canEditPropuestaStatus: true,
    allowedPropuestaStatuses: ['Abierto', 'Atendido'],
    canAprobarPropuesta: false,
    canAsignarInventario: true,
    canEditResumenPropuesta: false, // Solo visualización en Resumen de Propuesta
    canCompartirPropuesta: true, // Puede ver y usar botón compartir
    canBuscarInventarioEnModal: true,

    // Campañas - pueden hacer todo excepto detalle
    canEditCampanas: true,
    canEditDetalleCampana: false, // Solo visualización en detalle
    canDeleteDetalleCampana: false, // No pueden quitar APs
    canSeeGestionArtes: false, // Gestión de artes oculto
    canEditGestionArtes: false,
    canResolveProduccionTasks: false,

    // Inventarios - oculto
    canCreateInventarios: false,
    canEditInventarios: false,
    canDeleteInventarios: false,

    // Órdenes de Montaje - solo visualización
    canExportOrdenesMontaje: false,
  },
  'Especialista de tráfico': {
    // Secciones visibles
    canSeeDashboard: true,
    canSeeClientes: false,
    canSeeProveedores: false,
    canSeeSolicitudes: false,
    canSeePropuestas: true,
    canSeeCampanas: true,
    canSeeInventarios: false,
    canSeeAdminUsuarios: false,

    // Clientes - oculto
    canCreateClientes: false,
    canEditClientes: false,
    canDeleteClientes: false,

    // Proveedores - oculto
    canCreateProveedores: false,
    canEditProveedores: false,
    canDeleteProveedores: false,

    // Solicitudes - oculto
    canCreateSolicitudes: false,
    canEditSolicitudes: false,
    canDeleteSolicitudes: false,
    canAtenderSolicitudes: false,
    canChangeEstadoSolicitud: false,

    // Propuestas - pueden cambiar a Abierto, Atendido y Compartir
    canEditPropuestaStatus: true,
    allowedPropuestaStatuses: ['Abierto', 'Atendido'],
    canAprobarPropuesta: false,
    canAsignarInventario: true,
    canEditResumenPropuesta: false, // Solo visualización en Resumen de Propuesta
    canCompartirPropuesta: true, // Puede ver y usar botón compartir
    canBuscarInventarioEnModal: true,

    // Campañas - pueden hacer todo excepto detalle
    canEditCampanas: true,
    canEditDetalleCampana: false, // Solo visualización en detalle
    canDeleteDetalleCampana: false, // No pueden quitar APs
    canSeeGestionArtes: false, // Gestión de artes oculto
    canEditGestionArtes: false,
    canResolveProduccionTasks: false,

    // Inventarios - oculto
    canCreateInventarios: false,
    canEditInventarios: false,
    canDeleteInventarios: false,

    // Órdenes de Montaje - solo visualización
    canExportOrdenesMontaje: false,
  },
  'Auxiliar de tráfico': {
    // Secciones visibles
    canSeeDashboard: true,
    canSeeClientes: false,
    canSeeProveedores: false,
    canSeeSolicitudes: false,
    canSeePropuestas: true,
    canSeeCampanas: true,
    canSeeInventarios: false,
    canSeeAdminUsuarios: false,

    // Clientes - oculto
    canCreateClientes: false,
    canEditClientes: false,
    canDeleteClientes: false,

    // Proveedores - oculto
    canCreateProveedores: false,
    canEditProveedores: false,
    canDeleteProveedores: false,

    // Solicitudes - oculto
    canCreateSolicitudes: false,
    canEditSolicitudes: false,
    canDeleteSolicitudes: false,
    canAtenderSolicitudes: false,
    canChangeEstadoSolicitud: false,

    // Propuestas - pueden cambiar a Abierto, Atendido y Compartir
    canEditPropuestaStatus: true,
    allowedPropuestaStatuses: ['Abierto', 'Atendido'],
    canAprobarPropuesta: false,
    canAsignarInventario: true,
    canEditResumenPropuesta: false, // Solo visualización en Resumen de Propuesta
    canCompartirPropuesta: true, // Puede ver y usar botón compartir
    canBuscarInventarioEnModal: true,

    // Campañas - pueden hacer todo excepto detalle
    canEditCampanas: true,
    canEditDetalleCampana: false, // Solo visualización en detalle
    canDeleteDetalleCampana: false, // No pueden quitar APs
    canSeeGestionArtes: false, // Gestión de artes oculto
    canEditGestionArtes: false,
    canResolveProduccionTasks: false,

    // Inventarios - oculto
    canCreateInventarios: false,
    canEditInventarios: false,
    canDeleteInventarios: false,

    // Órdenes de Montaje - solo visualización
    canExportOrdenesMontaje: false,
  },
  'Coordinador de Diseño': {
    // Secciones visibles
    canSeeDashboard: false,
    canSeeClientes: false,
    canSeeProveedores: false,
    canSeeSolicitudes: false,
    canSeePropuestas: false,
    canSeeCampanas: true,
    canSeeInventarios: false,
    canSeeAdminUsuarios: false,

    // Clientes - oculto
    canCreateClientes: false,
    canEditClientes: false,
    canDeleteClientes: false,

    // Proveedores - oculto
    canCreateProveedores: false,
    canEditProveedores: false,
    canDeleteProveedores: false,

    // Solicitudes - oculto
    canCreateSolicitudes: false,
    canEditSolicitudes: false,
    canDeleteSolicitudes: false,
    canAtenderSolicitudes: false,
    canChangeEstadoSolicitud: false,

    // Propuestas - oculto
    canEditPropuestaStatus: false,
    allowedPropuestaStatuses: [],
    canAprobarPropuesta: false,
    canAsignarInventario: false,
    canEditResumenPropuesta: false,
    canCompartirPropuesta: false,
    canBuscarInventarioEnModal: false,

    // Campañas
    canEditCampanas: false, // No pueden editar campaña
    canEditDetalleCampana: false, // No pueden asignar APs
    canDeleteDetalleCampana: false, // No pueden quitar APs
    canSeeGestionArtes: true, // Sí pueden ver gestión de artes
    canEditGestionArtes: true,
    canResolveProduccionTasks: false, // No pueden resolver tareas de producción
    canSeeOrdenesMontajeButton: false, // Ocultar botón órdenes de montaje

    // Gestión de Artes - Tabs
    canSeeTabProgramacion: false,
    canSeeTabImpresiones: false,
    canSeeTabSubirArtes: false,
    canSeeTabTestigos: false,
    canSeeTabValidacionInstalacion: false,
    canCreateTareasGestionArtes: false, // No pueden crear tareas
    canResolveRevisionArtesTasks: true, // Sí pueden resolver tareas de revisión de artes

    // Inventarios - oculto
    canCreateInventarios: false,
    canEditInventarios: false,
    canDeleteInventarios: false,

    // Órdenes de Montaje
    canExportOrdenesMontaje: false,
  },
  'Diseñadores': {
    // Secciones visibles
    canSeeDashboard: false,
    canSeeClientes: false,
    canSeeProveedores: false,
    canSeeSolicitudes: false,
    canSeePropuestas: false,
    canSeeCampanas: true,
    canSeeInventarios: false,
    canSeeAdminUsuarios: false,

    // Clientes - oculto
    canCreateClientes: false,
    canEditClientes: false,
    canDeleteClientes: false,

    // Proveedores - oculto
    canCreateProveedores: false,
    canEditProveedores: false,
    canDeleteProveedores: false,

    // Solicitudes - oculto
    canCreateSolicitudes: false,
    canEditSolicitudes: false,
    canDeleteSolicitudes: false,
    canAtenderSolicitudes: false,
    canChangeEstadoSolicitud: false,

    // Propuestas - oculto
    canEditPropuestaStatus: false,
    allowedPropuestaStatuses: [],
    canAprobarPropuesta: false,
    canAsignarInventario: false,
    canEditResumenPropuesta: false,
    canCompartirPropuesta: false,
    canBuscarInventarioEnModal: false,

    // Campañas
    canEditCampanas: false, // No pueden editar campaña
    canEditDetalleCampana: false, // No pueden asignar APs
    canDeleteDetalleCampana: false, // No pueden quitar APs
    canSeeGestionArtes: true, // Sí pueden ver gestión de artes
    canEditGestionArtes: true,
    canResolveProduccionTasks: false, // No pueden resolver tareas de producción
    canSeeOrdenesMontajeButton: false, // Ocultar botón órdenes de montaje

    // Gestión de Artes - Tabs
    canSeeTabProgramacion: false,
    canSeeTabImpresiones: false,
    canSeeTabSubirArtes: false,
    canSeeTabTestigos: false,
    canSeeTabValidacionInstalacion: false,
    canCreateTareasGestionArtes: false, // No pueden crear tareas
    canResolveRevisionArtesTasks: true, // Sí pueden resolver tareas de revisión de artes

    // Inventarios - oculto
    canCreateInventarios: false,
    canEditInventarios: false,
    canDeleteInventarios: false,

    // Órdenes de Montaje
    canExportOrdenesMontaje: false,
  },
  'Compradores': {
    // Secciones visibles
    canSeeDashboard: false, // Oculto
    canSeeClientes: false, // Oculto
    canSeeProveedores: false, // Oculto
    canSeeSolicitudes: false, // Oculto
    canSeePropuestas: false, // Oculto
    canSeeCampanas: true, // Visible
    canSeeInventarios: false, // Oculto
    canSeeAdminUsuarios: false, // Oculto

    // Clientes - oculto
    canCreateClientes: false,
    canEditClientes: false,
    canDeleteClientes: false,

    // Proveedores - oculto
    canCreateProveedores: false,
    canEditProveedores: false,
    canDeleteProveedores: false,

    // Solicitudes - oculto
    canCreateSolicitudes: false,
    canEditSolicitudes: false,
    canDeleteSolicitudes: false,
    canAtenderSolicitudes: false,
    canChangeEstadoSolicitud: false,

    // Propuestas - oculto
    canEditPropuestaStatus: false,
    allowedPropuestaStatuses: [],
    canAprobarPropuesta: false,
    canAsignarInventario: false,
    canEditResumenPropuesta: false,
    canCompartirPropuesta: false,
    canBuscarInventarioEnModal: false,

    // Campañas
    canEditCampanas: false, // Ocultar botón editar
    canEditDetalleCampana: false, // No pueden asignar APS
    canDeleteDetalleCampana: false, // No pueden quitar APS
    canSeeGestionArtes: true, // Pueden ver gestión de artes
    canEditGestionArtes: false, // No pueden editar
    canResolveProduccionTasks: true, // SÍ pueden resolver tareas de producción (Impresión)
    canSeeOrdenesMontajeButton: false, // Ocultar botón órdenes de montaje

    // Gestión de Artes - Tabs
    canSeeTabProgramacion: false, // Ocultar
    canSeeTabImpresiones: true, // VISIBLE - solo este tab
    canSeeTabSubirArtes: false, // Ocultar
    canSeeTabTestigos: false, // Ocultar
    canSeeTabValidacionInstalacion: false, // Ocultar
    canCreateTareasGestionArtes: false, // No pueden crear tareas
    canResolveRevisionArtesTasks: false, // No pueden resolver tareas de revisión
    canOnlyOpenImpresionTasks: true, // Solo pueden abrir tareas de tipo Impresión

    // Inventarios - oculto
    canCreateInventarios: false,
    canEditInventarios: false,
    canDeleteInventarios: false,

    // Órdenes de Montaje
    canExportOrdenesMontaje: false,
  },
};

export function getPermissions(role: string | undefined | null): RolePermissions {
  if (!role) {
    // Sin rol, permisos mínimos
    return {
      ...defaultPermissions,
      canSeeDashboard: false,
      canSeeClientes: false,
      canSeeProveedores: false,
      canSeeSolicitudes: false,
      canSeePropuestas: false,
      canSeeCampanas: false,
      canSeeInventarios: false,
      canSeeAdminUsuarios: false,
    };
  }

  const specificPermissions = rolePermissions[role as UserRole] || {};

  return {
    ...defaultPermissions,
    ...specificPermissions,
  };
}

// Hook para usar en componentes
export function usePermissions(role: string | undefined | null): RolePermissions {
  return getPermissions(role);
}
