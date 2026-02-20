// Definición de permisos por rol

export type UserRole =
  | 'Asesor Comercial'
  | 'Analista de Servicio al Cliente'
  | 'Director General'
  | 'Director Comercial'
  | 'Jefe Digital Comercial'
  | 'Especialista de BI'
  | 'Director de Desarrollo Digital'
  | 'Director Comercial Aeropuerto'
  | 'Gerente Comercial Aeropuerto'
  | 'Asesor Comercial Aeropuerto'
  | 'Analista de Aeropuerto'
  | 'Gerente de Tráfico'
  | 'Coordinador de tráfico'
  | 'Especialista de tráfico'
  | 'Auxiliar de tráfico'
  | 'Coordinador de Diseño'
  | 'Diseñadores'
  | 'Compradores'
  | 'Call Center CON'
  | 'Director de Operaciones'
  | 'Gerente de Operaciones CON'
  | 'Jefe de Operaciones Digital'
  | 'Gerente Digital (Operaciones)'
  | 'Gerentes de Operaciones Plazas (GDL y MTY)'
  | 'Jefes de Operaciones Plazas'
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
  canEditCampanaStatus: boolean; // Cambiar estatus en modal de campaña
  allowedCampanaStatuses: string[] | null; // null = todos los estatus permitidos, array = solo esos
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
  canSeeTabRevisarAprobar: boolean;
  canSeeTabTestigos: boolean;
  canSeeTabValidacionInstalacion: boolean;
  canCreateTareasGestionArtes: boolean; // Crear tareas en gestión de artes
  canResolveRevisionArtesTasks: boolean; // Resolver tareas de revisión de artes
  canResolveCorreccionTasks: boolean; // Resolver tareas de corrección de artes
  canOnlyOpenImpresionTasks: boolean; // Solo puede abrir tareas de tipo Impresión (oculta botón Abrir para otros tipos)
  canOnlyOpenRecepcionTasks: boolean; // Solo puede abrir tareas de tipo Recepción, Instalación, Testigo y Programación (para Operaciones)
  canOnlyOpenCorreccionTasks: boolean; // Solo puede abrir tareas de tipo Corrección
  canOnlyOpenOrdenProgramacionTasks: boolean; // Solo puede abrir tareas de tipo Orden de Programación (para Tráfico)
  cannotOpenCorreccionTasks: boolean; // No puede abrir tareas de tipo Corrección (para Diseñadores)
  canOpenTasks: boolean; // Puede abrir/ver detalle de tareas (false = solo visualización de la lista)
  canCreateOrdenProgramacion: boolean; // Puede crear tareas de Orden de Programación (para Tráfico)
  canCreateOrdenInstalacion: boolean; // Puede crear tareas de Orden de Instalación (para Tráfico)
  canOnlyOpenOrdenInstalacionTasks: boolean; // Solo puede abrir tareas de tipo Orden de Instalación (para Tráfico)
  canCreateInstalacionFromRecibido: boolean; // Crear tareas de Instalación desde tab Impresiones con estado recibido (Operaciones)

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
  canEditCampanaStatus: true,
  allowedCampanaStatuses: null, // null = todos
  canEditDetalleCampana: true,
  canDeleteDetalleCampana: true,
  canSeeGestionArtes: true,
  canEditGestionArtes: true,
  canResolveProduccionTasks: true,
  canSeeOrdenesMontajeButton: true,

  canSeeTabProgramacion: true,
  canSeeTabImpresiones: true,
  canSeeTabSubirArtes: true,
  canSeeTabRevisarAprobar: true,
  canSeeTabTestigos: true,
  canSeeTabValidacionInstalacion: true,
  canCreateTareasGestionArtes: true,
  canResolveRevisionArtesTasks: true,
  canResolveCorreccionTasks: true,
  canOnlyOpenImpresionTasks: false,
  canOnlyOpenRecepcionTasks: false,
  canOnlyOpenCorreccionTasks: false,
  canOnlyOpenOrdenProgramacionTasks: false,
  cannotOpenCorreccionTasks: false,
  canOpenTasks: true,
  canCreateOrdenProgramacion: false,
  canCreateOrdenInstalacion: false,
  canOnlyOpenOrdenInstalacionTasks: false,
  canCreateInstalacionFromRecibido: false, // Default false - solo Operaciones

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
    allowedPropuestaStatuses: ['Pase a ventas', 'Ajuste Cto-Cliente'],
    canBuscarInventarioEnModal: false,

    canEditCampanas: true,
    canEditDetalleCampana: false,
    canDeleteDetalleCampana: false,
    canEditGestionArtes: false,
    canOpenTasks: false, // No puede abrir tareas en Gestión de Artes

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
    canResolveCorreccionTasks: true, // SÍ puede resolver tareas de corrección de artes
    canOnlyOpenCorreccionTasks: true, // Solo puede abrir tareas de tipo Corrección e Instalación
    canOpenTasks: true,
    canCreateTareasGestionArtes: true, // Puede crear tareas de Instalación

    // Inventarios: Oculto (ya se oculta con canSeeInventarios: false)
    canCreateInventarios: false,
    canEditInventarios: false,
    canDeleteInventarios: false,
  },
  // ============================================================================
  // DIRECCIÓN
  // ============================================================================
  'Director General': {
    canSeeDashboard: false,
    canSeeClientes: true,
    canSeeProveedores: false,
    canSeeSolicitudes: true,
    canSeePropuestas: true,
    canSeeCampanas: true,
    canSeeInventarios: false,
    canSeeAdminUsuarios: false,

    canCreateClientes: false,
    canEditClientes: true,
    canDeleteClientes: false,

    canCreateProveedores: false,
    canEditProveedores: false,
    canDeleteProveedores: false,

    canCreateSolicitudes: false,
    canEditSolicitudes: false,
    canDeleteSolicitudes: false,
    canAtenderSolicitudes: false,
    canChangeEstadoSolicitud: false,

    canEditPropuestaStatus: false,
    allowedPropuestaStatuses: [],
    canAprobarPropuesta: true,
    canAsignarInventario: false,
    canEditResumenPropuesta: false,
    canCompartirPropuesta: true,
    canBuscarInventarioEnModal: false,

    canEditCampanas: false,
    canEditDetalleCampana: false,
    canDeleteDetalleCampana: false,
    canSeeGestionArtes: true,
    canEditGestionArtes: false,
    canResolveProduccionTasks: false,
    canSeeOrdenesMontajeButton: true,

    canSeeTabProgramacion: true,
    canSeeTabImpresiones: true,
    canSeeTabSubirArtes: false,
    canSeeTabRevisarAprobar: true,
    canSeeTabTestigos: true,
    canSeeTabValidacionInstalacion: true,
    canCreateTareasGestionArtes: false,
    canResolveRevisionArtesTasks: false,
    canOpenTasks: false,

    canCreateInventarios: false,
    canEditInventarios: false,
    canDeleteInventarios: false,

    canExportOrdenesMontaje: false,
  },
  'Director Comercial': {
    // Solo lectura - permisos pendientes de definición
    canSeeDashboard: false,
    canSeeClientes: true,
    canSeeProveedores: false,
    canSeeSolicitudes: true,
    canSeePropuestas: true,
    canSeeCampanas: true,
    canSeeInventarios: false,
    canSeeAdminUsuarios: false,

    canCreateClientes: false,
    canEditClientes: false,
    canDeleteClientes: false,

    canCreateProveedores: false,
    canEditProveedores: false,
    canDeleteProveedores: false,

    canCreateSolicitudes: false,
    canEditSolicitudes: false,
    canDeleteSolicitudes: false,
    canAtenderSolicitudes: false,
    canChangeEstadoSolicitud: false,

    canEditPropuestaStatus: false,
    allowedPropuestaStatuses: [],
    canAprobarPropuesta: false,
    canAsignarInventario: false,
    canEditResumenPropuesta: false,
    canCompartirPropuesta: false,
    canBuscarInventarioEnModal: false,

    canEditCampanas: false,
    canEditDetalleCampana: false,
    canDeleteDetalleCampana: false,
    canSeeGestionArtes: true,
    canEditGestionArtes: false,
    canResolveProduccionTasks: false,
    canSeeOrdenesMontajeButton: false,

    canSeeTabProgramacion: true,
    canSeeTabImpresiones: true,
    canSeeTabSubirArtes: false,
    canSeeTabRevisarAprobar: true,
    canSeeTabTestigos: true,
    canSeeTabValidacionInstalacion: true,
    canCreateTareasGestionArtes: false,
    canResolveRevisionArtesTasks: false,
    canOpenTasks: false,

    canCreateInventarios: false,
    canEditInventarios: false,
    canDeleteInventarios: false,

    canExportOrdenesMontaje: false,
  },
  // ============================================================================
  // COMERCIAL - NUEVOS
  // ============================================================================
  'Jefe Digital Comercial': {
    // Visualización general, sin Recepción de artes ni Facturación
    canSeeDashboard: false,
    canSeeClientes: true,
    canSeeProveedores: false,
    canSeeSolicitudes: true,
    canSeePropuestas: true,
    canSeeCampanas: true,
    canSeeInventarios: false,
    canSeeAdminUsuarios: false,

    canCreateClientes: false,
    canEditClientes: false,
    canDeleteClientes: false,

    canCreateProveedores: false,
    canEditProveedores: false,
    canDeleteProveedores: false,

    canCreateSolicitudes: false,
    canEditSolicitudes: false,
    canDeleteSolicitudes: false,
    canAtenderSolicitudes: false,
    canChangeEstadoSolicitud: false,

    canEditPropuestaStatus: false,
    allowedPropuestaStatuses: [],
    canAprobarPropuesta: false,
    canAsignarInventario: false,
    canEditResumenPropuesta: false,
    canCompartirPropuesta: true,
    canBuscarInventarioEnModal: false,

    canEditCampanas: false,
    canEditDetalleCampana: false,
    canDeleteDetalleCampana: false,
    canSeeGestionArtes: true,
    canEditGestionArtes: false,
    canResolveProduccionTasks: false,
    canSeeOrdenesMontajeButton: false,

    canSeeTabProgramacion: true,
    canSeeTabImpresiones: false,
    canSeeTabSubirArtes: false,
    canSeeTabRevisarAprobar: true,
    canSeeTabTestigos: false,
    canSeeTabValidacionInstalacion: false,
    canCreateTareasGestionArtes: false,
    canResolveRevisionArtesTasks: false,
    canOpenTasks: false,

    canCreateInventarios: false,
    canEditInventarios: false,
    canDeleteInventarios: false,

    canExportOrdenesMontaje: false,
  },
  'Especialista de BI': {
    // Visualización general amplia
    canSeeDashboard: false,
    canSeeClientes: true,
    canSeeProveedores: false,
    canSeeSolicitudes: true,
    canSeePropuestas: true,
    canSeeCampanas: true,
    canSeeInventarios: false,
    canSeeAdminUsuarios: false,

    canCreateClientes: false,
    canEditClientes: false,
    canDeleteClientes: false,

    canCreateProveedores: false,
    canEditProveedores: false,
    canDeleteProveedores: false,

    canCreateSolicitudes: false,
    canEditSolicitudes: false,
    canDeleteSolicitudes: false,
    canAtenderSolicitudes: false,
    canChangeEstadoSolicitud: false,

    canEditPropuestaStatus: false,
    allowedPropuestaStatuses: [],
    canAprobarPropuesta: false,
    canAsignarInventario: false,
    canEditResumenPropuesta: false,
    canCompartirPropuesta: true,
    canBuscarInventarioEnModal: false,

    canEditCampanas: false,
    canEditDetalleCampana: false,
    canDeleteDetalleCampana: false,
    canSeeGestionArtes: true,
    canEditGestionArtes: false,
    canResolveProduccionTasks: false,
    canSeeOrdenesMontajeButton: false,

    canSeeTabProgramacion: true,
    canSeeTabImpresiones: true,
    canSeeTabSubirArtes: false,
    canSeeTabRevisarAprobar: true,
    canSeeTabTestigos: false,
    canSeeTabValidacionInstalacion: false,
    canCreateTareasGestionArtes: false,
    canResolveRevisionArtesTasks: false,
    canOpenTasks: false,

    canCreateInventarios: false,
    canEditInventarios: false,
    canDeleteInventarios: false,

    canExportOrdenesMontaje: false,
  },
  'Director de Desarrollo Digital': {
    // Solo lectura - permisos PENDIENTES de definición
    canSeeDashboard: false,
    canSeeClientes: true,
    canSeeProveedores: false,
    canSeeSolicitudes: true,
    canSeePropuestas: true,
    canSeeCampanas: true,
    canSeeInventarios: false,
    canSeeAdminUsuarios: false,

    canCreateClientes: false,
    canEditClientes: false,
    canDeleteClientes: false,

    canCreateProveedores: false,
    canEditProveedores: false,
    canDeleteProveedores: false,

    canCreateSolicitudes: false,
    canEditSolicitudes: false,
    canDeleteSolicitudes: false,
    canAtenderSolicitudes: false,
    canChangeEstadoSolicitud: false,

    canEditPropuestaStatus: false,
    allowedPropuestaStatuses: [],
    canAprobarPropuesta: false,
    canAsignarInventario: false,
    canEditResumenPropuesta: false,
    canCompartirPropuesta: false,
    canBuscarInventarioEnModal: false,

    canEditCampanas: false,
    canEditDetalleCampana: false,
    canDeleteDetalleCampana: false,
    canSeeGestionArtes: true,
    canEditGestionArtes: false,
    canResolveProduccionTasks: false,
    canSeeOrdenesMontajeButton: false,

    canSeeTabProgramacion: true,
    canSeeTabImpresiones: true,
    canSeeTabSubirArtes: false,
    canSeeTabRevisarAprobar: true,
    canSeeTabTestigos: true,
    canSeeTabValidacionInstalacion: true,
    canCreateTareasGestionArtes: false,
    canResolveRevisionArtesTasks: false,
    canOpenTasks: false,

    canCreateInventarios: false,
    canEditInventarios: false,
    canDeleteInventarios: false,

    canExportOrdenesMontaje: false,
  },
  // ============================================================================
  // AEROPUERTO
  // ============================================================================
  'Director Comercial Aeropuerto': {
    // Mismos permisos que Asesor Comercial
    canSeeDashboard: false,
    canSeeInventarios: false,
    canSeeAdminUsuarios: false,

    canDeleteClientes: false,

    canCreateProveedores: false,
    canEditProveedores: false,
    canDeleteProveedores: false,

    // Puede cambiar estatus pero solo a estos valores
    allowedPropuestaStatuses: ['Pase a ventas', 'Ajuste Cto-Cliente'],
    canBuscarInventarioEnModal: false,

    canEditCampanas: true,
    canEditCampanaStatus: false, // No puede cambiar status en modal de campaña
    canEditDetalleCampana: false,
    canDeleteDetalleCampana: false,

    // Gestión de Artes: solo visualización, no puede resolver ni crear tareas
    canEditGestionArtes: false,
    canResolveProduccionTasks: false,
    canResolveRevisionArtesTasks: false,
    canCreateTareasGestionArtes: false,
    canOpenTasks: false,

    canCreateInventarios: false,
    canEditInventarios: false,
    canDeleteInventarios: false,
  },
  'Gerente Comercial Aeropuerto': {
    // Mismo perfil que Asesor Comercial
    canSeeDashboard: false,
    canSeeInventarios: false,
    canSeeAdminUsuarios: false,

    canDeleteClientes: false,

    canCreateProveedores: false,
    canEditProveedores: false,
    canDeleteProveedores: false,

    // Solicitudes: acceso total
    canCreateSolicitudes: true,
    canEditSolicitudes: true,
    canDeleteSolicitudes: true,
    canAtenderSolicitudes: true,
    canChangeEstadoSolicitud: true,

    allowedPropuestaStatuses: ['Pase a ventas', 'Ajuste Cto-Cliente'],
    canBuscarInventarioEnModal: false,

    canEditCampanas: true,
    canEditDetalleCampana: false,
    canDeleteDetalleCampana: false,
    canEditGestionArtes: false,

    canCreateInventarios: false,
    canEditInventarios: false,
    canDeleteInventarios: false,
  },
  'Asesor Comercial Aeropuerto': {
    // Solo lectura - permisos pendientes de definición
    canSeeDashboard: false,
    canSeeClientes: true,
    canSeeProveedores: false,
    canSeeSolicitudes: true,
    canSeePropuestas: true,
    canSeeCampanas: true,
    canSeeInventarios: false,
    canSeeAdminUsuarios: false,

    canCreateClientes: false,
    canEditClientes: false,
    canDeleteClientes: false,

    canCreateProveedores: false,
    canEditProveedores: false,
    canDeleteProveedores: false,

    // Solicitudes: acceso total
    canCreateSolicitudes: true,
    canEditSolicitudes: true,
    canDeleteSolicitudes: true,
    canAtenderSolicitudes: true,
    canChangeEstadoSolicitud: true,

    // Propuestas: mismos permisos que Asesor Comercial
    allowedPropuestaStatuses: ['Pase a ventas', 'Ajuste Cto-Cliente'],
    canBuscarInventarioEnModal: false,

    canEditCampanas: false,
    canEditDetalleCampana: false,
    canDeleteDetalleCampana: false,
    canSeeGestionArtes: true,
    canEditGestionArtes: false,
    canResolveProduccionTasks: false,
    canSeeOrdenesMontajeButton: false,

    canSeeTabProgramacion: true,
    canSeeTabImpresiones: true,
    canSeeTabSubirArtes: false,
    canSeeTabRevisarAprobar: true,
    canSeeTabTestigos: true,
    canSeeTabValidacionInstalacion: true,
    canCreateTareasGestionArtes: false,
    canResolveRevisionArtesTasks: false,
    canOpenTasks: false,

    canCreateInventarios: false,
    canEditInventarios: false,
    canDeleteInventarios: false,

    canExportOrdenesMontaje: false,
  },
  'Analista de Aeropuerto': {
    // Mismo perfil que Analista de Servicio al Cliente
    canSeeDashboard: false,
    canSeeInventarios: false,
    canSeeAdminUsuarios: false,

    canCreateClientes: false,
    canEditClientes: false,
    canDeleteClientes: false,

    canCreateProveedores: false,
    canEditProveedores: false,
    canDeleteProveedores: false,

    canCreateSolicitudes: false,
    canEditSolicitudes: false,
    canDeleteSolicitudes: false,
    canAtenderSolicitudes: false,
    canChangeEstadoSolicitud: false,

    canEditPropuestaStatus: false,
    allowedPropuestaStatuses: [],
    canAprobarPropuesta: false,
    canAsignarInventario: false,
    canCompartirPropuesta: true,
    canBuscarInventarioEnModal: false,

    canEditCampanas: false,
    canResolveProduccionTasks: false,
    canResolveRevisionArtesTasks: false,
    canResolveCorreccionTasks: true, // SÍ puede resolver tareas de corrección de artes
    canCreateTareasGestionArtes: true, // Puede crear tareas de Revisión de artes después de subir artes
    canOnlyOpenCorreccionTasks: true, // Solo puede abrir tareas de corrección e Instalación
    canOpenTasks: true,

    canCreateInventarios: false,
    canEditInventarios: false,
    canDeleteInventarios: false,
  },
  // ============================================================================
  // OPERACIONES - NUEVOS
  // ============================================================================
  'Call Center CON': {
    // Solo Recepción de artes - carga de reportes
    canSeeDashboard: false,
    canSeeClientes: false,
    canSeeProveedores: false,
    canSeeSolicitudes: false,
    canSeePropuestas: false,
    canSeeCampanas: true,
    canSeeInventarios: false,
    canSeeAdminUsuarios: false,

    canCreateClientes: false,
    canEditClientes: false,
    canDeleteClientes: false,

    canCreateProveedores: false,
    canEditProveedores: false,
    canDeleteProveedores: false,

    canCreateSolicitudes: false,
    canEditSolicitudes: false,
    canDeleteSolicitudes: false,
    canAtenderSolicitudes: false,
    canChangeEstadoSolicitud: false,

    canEditPropuestaStatus: false,
    allowedPropuestaStatuses: [],
    canAprobarPropuesta: false,
    canAsignarInventario: false,
    canEditResumenPropuesta: false,
    canCompartirPropuesta: false,
    canBuscarInventarioEnModal: false,

    canEditCampanas: false,
    canEditCampanaStatus: false, // Solo visualización de estatus
    canEditDetalleCampana: false,
    canDeleteDetalleCampana: false,
    canSeeGestionArtes: true,
    canEditGestionArtes: false,
    canResolveProduccionTasks: true,
    canSeeOrdenesMontajeButton: false,

    canSeeTabProgramacion: true,
    canSeeTabImpresiones: true,
    canSeeTabSubirArtes: false,
    canSeeTabRevisarAprobar: false,
    canSeeTabTestigos: true,
    canSeeTabValidacionInstalacion: true,
    canCreateTareasGestionArtes: false,
    canResolveRevisionArtesTasks: false,
    canOnlyOpenRecepcionTasks: true,
    canCreateInstalacionFromRecibido: true,

    canCreateInventarios: false,
    canEditInventarios: false,
    canDeleteInventarios: false,

    canExportOrdenesMontaje: false,
  },
  'Gerente de Operaciones CON': {
    // Solo lectura - permisos pendientes de definición
    canSeeDashboard: false,
    canSeeClientes: false,
    canSeeProveedores: false,
    canSeeSolicitudes: false,
    canSeePropuestas: false,
    canSeeCampanas: true,
    canSeeInventarios: false,
    canSeeAdminUsuarios: false,

    canCreateClientes: false,
    canEditClientes: false,
    canDeleteClientes: false,

    canCreateProveedores: false,
    canEditProveedores: false,
    canDeleteProveedores: false,

    canCreateSolicitudes: false,
    canEditSolicitudes: false,
    canDeleteSolicitudes: false,
    canAtenderSolicitudes: false,
    canChangeEstadoSolicitud: false,

    canEditPropuestaStatus: false,
    allowedPropuestaStatuses: [],
    canAprobarPropuesta: false,
    canAsignarInventario: false,
    canEditResumenPropuesta: false,
    canCompartirPropuesta: false,
    canBuscarInventarioEnModal: false,

    canEditCampanas: false,
    canEditCampanaStatus: false, // Solo visualización de estatus
    canEditDetalleCampana: false,
    canDeleteDetalleCampana: false,
    canSeeGestionArtes: true,
    canEditGestionArtes: false,
    canResolveProduccionTasks: false,
    canSeeOrdenesMontajeButton: false,

    canSeeTabProgramacion: true,
    canSeeTabImpresiones: true,
    canSeeTabSubirArtes: false,
    canSeeTabRevisarAprobar: false,
    canSeeTabTestigos: true,
    canSeeTabValidacionInstalacion: true,
    canCreateTareasGestionArtes: false,
    canResolveRevisionArtesTasks: false,
    canOpenTasks: false,

    canCreateInventarios: false,
    canEditInventarios: false,
    canDeleteInventarios: false,

    canExportOrdenesMontaje: false,
  },
  'Jefe de Operaciones Digital': {
    canSeeDashboard: false,
    canSeeClientes: false,
    canSeeProveedores: false,
    canSeeSolicitudes: false,
    canSeePropuestas: false,
    canSeeCampanas: true,
    canSeeInventarios: false,
    canSeeAdminUsuarios: false,

    canCreateClientes: false,
    canEditClientes: false,
    canDeleteClientes: false,

    canCreateProveedores: false,
    canEditProveedores: false,
    canDeleteProveedores: false,

    canCreateSolicitudes: false,
    canEditSolicitudes: false,
    canDeleteSolicitudes: false,
    canAtenderSolicitudes: false,
    canChangeEstadoSolicitud: false,

    canEditPropuestaStatus: false,
    allowedPropuestaStatuses: [],
    canAprobarPropuesta: false,
    canAsignarInventario: false,
    canEditResumenPropuesta: false,
    canCompartirPropuesta: false,
    canBuscarInventarioEnModal: false,

    // Campañas - solo visualización de estatus
    canEditCampanas: false,
    canEditDetalleCampana: false,
    canDeleteDetalleCampana: false,
    canEditCampanaStatus: false,
    canSeeGestionArtes: true,
    canSeeOrdenesMontajeButton: false,

    // Gestión de Artes - solo tab Programación, puede usarla y resolver tareas
    canEditGestionArtes: true,
    canResolveProduccionTasks: true,
    canSeeTabProgramacion: true,
    canSeeTabImpresiones: true,
    canSeeTabSubirArtes: false,
    canSeeTabRevisarAprobar: false,
    canSeeTabTestigos: false,
    canSeeTabValidacionInstalacion: false,
    canCreateTareasGestionArtes: false,
    canResolveRevisionArtesTasks: false,
    canOpenTasks: true,

    canCreateInventarios: false,
    canEditInventarios: false,
    canDeleteInventarios: false,

    canExportOrdenesMontaje: false,
  },
  'Gerente Digital (Operaciones)': {
    canSeeDashboard: false,
    canSeeClientes: false,
    canSeeProveedores: false,
    canSeeSolicitudes: false,
    canSeePropuestas: false,
    canSeeCampanas: true,
    canSeeInventarios: false,
    canSeeAdminUsuarios: false,

    canCreateClientes: false,
    canEditClientes: false,
    canDeleteClientes: false,

    canCreateProveedores: false,
    canEditProveedores: false,
    canDeleteProveedores: false,

    canCreateSolicitudes: false,
    canEditSolicitudes: false,
    canDeleteSolicitudes: false,
    canAtenderSolicitudes: false,
    canChangeEstadoSolicitud: false,

    canEditPropuestaStatus: false,
    allowedPropuestaStatuses: [],
    canAprobarPropuesta: false,
    canAsignarInventario: false,
    canEditResumenPropuesta: false,
    canCompartirPropuesta: false,
    canBuscarInventarioEnModal: false,

    // Campañas - solo visualización de estatus
    canEditCampanas: false,
    canEditDetalleCampana: false,
    canDeleteDetalleCampana: false,
    canEditCampanaStatus: false,
    canSeeGestionArtes: true,
    canSeeOrdenesMontajeButton: false,

    // Gestión de Artes - solo tab Programación, puede usarla y resolver tareas
    canEditGestionArtes: true,
    canResolveProduccionTasks: false,
    canSeeTabProgramacion: true,
    canSeeTabImpresiones: false,
    canSeeTabSubirArtes: false,
    canSeeTabRevisarAprobar: false,
    canSeeTabTestigos: false,
    canSeeTabValidacionInstalacion: false,
    canCreateTareasGestionArtes: false,
    canResolveRevisionArtesTasks: false,
    canOpenTasks: true,

    canCreateInventarios: false,
    canEditInventarios: false,
    canDeleteInventarios: false,

    canExportOrdenesMontaje: false,
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
    canSeeInventarios: true,
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
    allowedCampanaStatuses: ['Compartir'],
    canEditDetalleCampana: false, // Solo visualización en detalle
    canDeleteDetalleCampana: false, // No pueden quitar APs
    canSeeGestionArtes: true, // Puede ver gestor de tareas
    canEditGestionArtes: false,
    canResolveProduccionTasks: false,

    // Tabs de gestión de artes
    canSeeTabProgramacion: true,
    canSeeTabImpresiones: false,
    canSeeTabSubirArtes: false,
    canSeeTabRevisarAprobar: true, // Necesitan ver artes aprobados para seleccionar
    canSeeTabTestigos: false,
    canSeeTabValidacionInstalacion: true,
    canCreateTareasGestionArtes: false,
    canOpenTasks: true,
    canCreateOrdenProgramacion: true,
    canCreateOrdenInstalacion: true,
    canOnlyOpenOrdenProgramacionTasks: true,
    canOnlyOpenOrdenInstalacionTasks: true,

    // Inventarios - solo visualización
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
    canSeeInventarios: true,
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
    allowedCampanaStatuses: ['Compartir'],
    canEditDetalleCampana: false, // Solo visualización en detalle
    canDeleteDetalleCampana: false, // No pueden quitar APs
    canSeeGestionArtes: true, // Puede ver gestor de tareas
    canEditGestionArtes: false,
    canResolveProduccionTasks: false,

    // Tabs de gestión de artes
    canSeeTabProgramacion: true,
    canSeeTabImpresiones: false,
    canSeeTabSubirArtes: false,
    canSeeTabRevisarAprobar: true, // Necesitan ver artes aprobados para seleccionar
    canSeeTabTestigos: false,
    canSeeTabValidacionInstalacion: true,
    canCreateTareasGestionArtes: false,
    canOpenTasks: true,
    canCreateOrdenProgramacion: true,
    canCreateOrdenInstalacion: true,
    canOnlyOpenOrdenProgramacionTasks: true,
    canOnlyOpenOrdenInstalacionTasks: true,

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
    canSeeInventarios: true,
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
    allowedCampanaStatuses: ['Compartir'],
    canEditDetalleCampana: false, // Solo visualización en detalle
    canDeleteDetalleCampana: false, // No pueden quitar APs
    canSeeGestionArtes: true, // Puede ver gestor de tareas
    canEditGestionArtes: false,
    canResolveProduccionTasks: false,

    // Tabs de gestión de artes
    canSeeTabProgramacion: true,
    canSeeTabImpresiones: false,
    canSeeTabSubirArtes: false,
    canSeeTabRevisarAprobar: true, // Necesitan ver artes aprobados para seleccionar
    canSeeTabTestigos: false,
    canSeeTabValidacionInstalacion: true,
    canCreateTareasGestionArtes: false,
    canOpenTasks: true,
    canCreateOrdenProgramacion: true,
    canCreateOrdenInstalacion: true,
    canOnlyOpenOrdenProgramacionTasks: true,
    canOnlyOpenOrdenInstalacionTasks: true,

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
    canSeeInventarios: true,
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
    allowedCampanaStatuses: ['Compartir'],
    canEditDetalleCampana: false, // Solo visualización en detalle
    canDeleteDetalleCampana: false, // No pueden quitar APs
    canSeeGestionArtes: true, // Puede ver gestor de tareas
    canEditGestionArtes: false,
    canResolveProduccionTasks: false,

    // Tabs de gestión de artes
    canSeeTabProgramacion: true,
    canSeeTabImpresiones: false,
    canSeeTabSubirArtes: false,
    canSeeTabRevisarAprobar: true, // Necesitan ver artes aprobados para seleccionar
    canSeeTabTestigos: false,
    canSeeTabValidacionInstalacion: true,
    canCreateTareasGestionArtes: false,
    canOpenTasks: true,
    canCreateOrdenProgramacion: true,
    canCreateOrdenInstalacion: true,
    canOnlyOpenOrdenProgramacionTasks: true,
    canOnlyOpenOrdenInstalacionTasks: true,

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
    canEditCampanaStatus: false, // Solo visualización de estatus
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
    canSeeTabRevisarAprobar: true, // Sí pueden ver Revisar y Aprobar
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
    canEditCampanaStatus: false, // Solo visualización de estatus
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
    canSeeTabRevisarAprobar: true, // Sí pueden ver Revisar y Aprobar
    canSeeTabTestigos: false,
    canSeeTabValidacionInstalacion: false,
    canCreateTareasGestionArtes: false, // No pueden crear tareas
    canResolveRevisionArtesTasks: true, // Sí pueden resolver tareas de revisión de artes
    cannotOpenCorreccionTasks: true, // NO pueden abrir tareas de corrección

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
    canSeeProveedores: true, // Visible
    canSeeSolicitudes: false, // Oculto
    canSeePropuestas: false, // Oculto
    canSeeCampanas: true, // Visible
    canSeeInventarios: false, // Oculto
    canSeeAdminUsuarios: false, // Oculto

    // Clientes - oculto
    canCreateClientes: false,
    canEditClientes: false,
    canDeleteClientes: false,

    // Proveedores - acceso completo
    canCreateProveedores: true,
    canEditProveedores: true,
    canDeleteProveedores: true,

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
    canEditCampanaStatus: false, // Solo visualización de estatus
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
    canSeeTabRevisarAprobar: false, // Ocultar - Compradores solo ven Impresiones
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
  // ============================================================================
  // OPERACIONES
  // ============================================================================
  'Director de Operaciones': {
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
    canEditCampanas: false, // Ocultar botón editar
    canEditCampanaStatus: false, // Solo visualización de estatus
    canEditDetalleCampana: false, // No pueden asignar APs
    canDeleteDetalleCampana: false, // No pueden quitar APs
    canSeeGestionArtes: true, // Pueden ver gestión de artes
    canEditGestionArtes: false, // No pueden editar
    canResolveProduccionTasks: true, // Pueden resolver tareas de producción (solo Recepción)
    canSeeOrdenesMontajeButton: false, // Ocultar botón órdenes de montaje

    // Gestión de Artes - Tabs
    canSeeTabProgramacion: true,
    canSeeTabImpresiones: true,
    canSeeTabSubirArtes: false, // Oculto
    canSeeTabRevisarAprobar: false, // Operaciones no ve Revisar y Aprobar
    canSeeTabTestigos: true,
    canSeeTabValidacionInstalacion: true,
    canCreateTareasGestionArtes: false, // No pueden crear tareas
    canResolveRevisionArtesTasks: false, // No pueden resolver tareas de revisión
    canOnlyOpenRecepcionTasks: true, // Pueden abrir tareas de tipo Recepción, Instalación y Testigo
    canCreateInstalacionFromRecibido: true, // Pueden crear tareas de Instalación desde Impresiones recibido

    // Inventarios - oculto
    canCreateInventarios: false,
    canEditInventarios: false,
    canDeleteInventarios: false,

    // Órdenes de Montaje
    canExportOrdenesMontaje: false,
  },
  'Gerentes de Operaciones Plazas (GDL y MTY)': {
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
    canEditCampanas: false,
    canEditCampanaStatus: false, // Solo visualización de estatus
    canEditDetalleCampana: false,
    canDeleteDetalleCampana: false,
    canSeeGestionArtes: true,
    canEditGestionArtes: false,
    canResolveProduccionTasks: true,
    canSeeOrdenesMontajeButton: false,

    // Gestión de Artes - Tabs
    canSeeTabProgramacion: true,
    canSeeTabImpresiones: true,
    canSeeTabSubirArtes: false,
    canSeeTabRevisarAprobar: false, // Operaciones no ve Revisar y Aprobar
    canSeeTabTestigos: true,
    canSeeTabValidacionInstalacion: true,
    canCreateTareasGestionArtes: false,
    canResolveRevisionArtesTasks: false,
    canOnlyOpenRecepcionTasks: true,
    canCreateInstalacionFromRecibido: true, // Pueden crear tareas de Instalación desde Impresiones recibido

    // Inventarios - oculto
    canCreateInventarios: false,
    canEditInventarios: false,
    canDeleteInventarios: false,

    // Órdenes de Montaje
    canExportOrdenesMontaje: false,
  },
  'Jefes de Operaciones Plazas': {
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
    canEditCampanas: false,
    canEditCampanaStatus: false, // Solo visualización de estatus
    canEditDetalleCampana: false,
    canDeleteDetalleCampana: false,
    canSeeGestionArtes: true,
    canEditGestionArtes: false,
    canResolveProduccionTasks: true,
    canSeeOrdenesMontajeButton: false,

    // Gestión de Artes - Tabs
    canSeeTabProgramacion: true,
    canSeeTabImpresiones: true,
    canSeeTabSubirArtes: false,
    canSeeTabRevisarAprobar: false, // Operaciones no ve Revisar y Aprobar
    canSeeTabTestigos: true,
    canSeeTabValidacionInstalacion: true,
    canCreateTareasGestionArtes: false,
    canResolveRevisionArtesTasks: false,
    canOnlyOpenRecepcionTasks: true,
    canCreateInstalacionFromRecibido: true, // Pueden crear tareas de Instalación desde Impresiones recibido

    // Inventarios - oculto
    canCreateInventarios: false,
    canEditInventarios: false,
    canDeleteInventarios: false,

    // Órdenes de Montaje
    canExportOrdenesMontaje: false,
  },
  'Supervisores de Operaciones': {
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
    canEditCampanas: false,
    canEditDetalleCampana: false,
    canDeleteDetalleCampana: false,
    canSeeGestionArtes: true,
    canEditGestionArtes: false,
    canResolveProduccionTasks: true,
    canSeeOrdenesMontajeButton: false,

    // Gestión de Artes - Tabs
    canSeeTabProgramacion: true,
    canSeeTabImpresiones: true,
    canSeeTabSubirArtes: false,
    canSeeTabRevisarAprobar: false, // Operaciones no ve Revisar y Aprobar
    canSeeTabTestigos: true,
    canSeeTabValidacionInstalacion: true,
    canCreateTareasGestionArtes: false,
    canResolveRevisionArtesTasks: false,
    canOnlyOpenRecepcionTasks: true,
    canCreateInstalacionFromRecibido: true, // Pueden crear tareas de Instalación desde Impresiones recibido

    // Inventarios - oculto
    canCreateInventarios: false,
    canEditInventarios: false,
    canDeleteInventarios: false,

    // Órdenes de Montaje
    canExportOrdenesMontaje: false,
  },
  // ============================================================================
  // FACTURACIÓN Y COBRANZA
  // ============================================================================
  'Coordinador de Facturación y Cobranza': {
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

    // Campañas - solo visualización
    canEditCampanas: false, // Ocultar botón editar
    canEditDetalleCampana: false, // No pueden asignar APs
    canDeleteDetalleCampana: false, // No pueden quitar APs
    canSeeGestionArtes: true, // Pueden ver gestión de artes
    canEditGestionArtes: false, // Solo visualización
    canResolveProduccionTasks: false, // No pueden resolver tareas
    canSeeOrdenesMontajeButton: false, // Ocultar botón órdenes de montaje

    // Gestión de Artes - Solo visualización total
    canSeeTabProgramacion: true,
    canSeeTabImpresiones: true,
    canSeeTabSubirArtes: false, // No pueden subir artes
    canSeeTabRevisarAprobar: true,
    canSeeTabTestigos: true,
    canSeeTabValidacionInstalacion: true,
    canCreateTareasGestionArtes: false, // No pueden crear tareas
    canResolveRevisionArtesTasks: false, // No pueden resolver tareas de revisión
    canOnlyOpenImpresionTasks: false,
    canOnlyOpenRecepcionTasks: false,
    canOpenTasks: false, // No pueden abrir ninguna tarea - solo visualización

    // Inventarios - oculto
    canCreateInventarios: false,
    canEditInventarios: false,
    canDeleteInventarios: false,

    // Órdenes de Montaje
    canExportOrdenesMontaje: false,
  },
  'Mesa de Control': {
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

    // Campañas - solo visualización
    canEditCampanas: false,
    canEditDetalleCampana: false,
    canDeleteDetalleCampana: false,
    canSeeGestionArtes: true,
    canEditGestionArtes: false,
    canResolveProduccionTasks: false,
    canSeeOrdenesMontajeButton: false,

    // Gestión de Artes - Solo visualización total
    canSeeTabProgramacion: true,
    canSeeTabImpresiones: true,
    canSeeTabSubirArtes: false,
    canSeeTabRevisarAprobar: true,
    canSeeTabTestigos: true,
    canSeeTabValidacionInstalacion: true,
    canCreateTareasGestionArtes: false,
    canResolveRevisionArtesTasks: false,
    canOnlyOpenImpresionTasks: false,
    canOnlyOpenRecepcionTasks: false,
    canOpenTasks: false,

    // Inventarios - oculto
    canCreateInventarios: false,
    canEditInventarios: false,
    canDeleteInventarios: false,

    // Órdenes de Montaje
    canExportOrdenesMontaje: false,
  },
  'Analista de Facturación y Cobranza': {
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

    // Campañas - solo visualización
    canEditCampanas: false,
    canEditDetalleCampana: false,
    canDeleteDetalleCampana: false,
    canSeeGestionArtes: true,
    canEditGestionArtes: false,
    canResolveProduccionTasks: false,
    canSeeOrdenesMontajeButton: false,

    // Gestión de Artes - Solo visualización total
    canSeeTabProgramacion: true,
    canSeeTabImpresiones: true,
    canSeeTabSubirArtes: false,
    canSeeTabRevisarAprobar: true,
    canSeeTabTestigos: true,
    canSeeTabValidacionInstalacion: true,
    canCreateTareasGestionArtes: false,
    canResolveRevisionArtesTasks: false,
    canOnlyOpenImpresionTasks: false,
    canOnlyOpenRecepcionTasks: false,
    canOpenTasks: false,

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
