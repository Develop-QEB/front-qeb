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

  // Propuestas
  canEditPropuestaStatus: boolean;
  allowedPropuestaStatuses: string[] | null; // null = todos, array = solo esos
  canAprobarPropuesta: boolean;
  canAsignarInventario: boolean;
  canCompartirPropuesta: boolean;
  canBuscarInventarioEnModal: boolean;

  // Campañas
  canEditCampanas: boolean;
  canEditDetalleCampana: boolean;
  canDeleteDetalleCampana: boolean;
  canEditGestionArtes: boolean;

  // Inventarios
  canCreateInventarios: boolean;
  canEditInventarios: boolean;
  canDeleteInventarios: boolean;
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

  canEditPropuestaStatus: true,
  allowedPropuestaStatuses: null, // null = todos los estatus
  canAprobarPropuesta: true,
  canAsignarInventario: true,
  canCompartirPropuesta: true,
  canBuscarInventarioEnModal: true,

  canEditCampanas: true,
  canEditDetalleCampana: true,
  canDeleteDetalleCampana: true,
  canEditGestionArtes: true,

  canCreateInventarios: true,
  canEditInventarios: true,
  canDeleteInventarios: true,
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
  'Administrador': {
    // Admin tiene todos los permisos por defecto
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
