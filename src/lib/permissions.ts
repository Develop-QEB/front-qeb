// Definición de permisos por rol

export type UserRole =
  | 'Asesor Comercial'
  | 'Asesor Analista'
  | 'Analista de Servicio al Cliente'
  | 'Asesor Analista'
  | 'Director General'
  | 'Director Comercial'
  | 'Gerente Comercial'
  | 'Jefe Digital Comercial'
  | 'Especialista de BI'
  | 'Director de Desarrollo Digital'
  | 'Director Comercial Aeropuerto'
  | 'Gerente Comercial Aeropuerto'
  | 'Asesor Comercial Aeropuerto'
  | 'Analista de Aeropuerto'
  | 'Gerente de Trafico'
  | 'Coordinador de trafico'
  | 'Especialista de trafico'
  | 'Auxiliar de trafico'
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
  | 'Coordinador de Facturación'
  | 'Especialista de Facturación'
  // Nuevos roles (Matriz Roles QEB 2026-01-28) — agregados sin tocar los anteriores.
  // Perfil A — Transversales (full visibility, sin aprobar autorizaciones, con descarga)
  | 'Director General Adjunto'
  | 'Director Desarrollo de Nuevos Negocios'
  | 'Gerente Comercial Vía Pública'
  | 'Gerente Comercial Plazas'
  | 'Jefe de BI'
  // Perfil B — TI y Mejora Continua (admin completo)
  | 'Gerente de TI'
  | 'Especialista de TI'
  | 'Analista de TI'
  | 'Jefe de Mejora Continua'
  | 'Analista de Mejora Continua'
  // Perfil C — Plazas operativas (Campañas + Descarga ODM + Instalación)
  | 'Gerente de Operaciones GDL'
  | 'Gerente de Operaciones MTY'
  | 'Gerente Regional de Plazas'
  | 'Jefe Regional de Plazas'
  | 'Técnico en logística digital'
  | 'Jefe de Operaciones Oaxaca'
  | 'Jefe de Operaciones Acapulco'
  | 'Jefe de Operaciones Toluca'
  | 'Jefe de Operaciones Veracruz'
  | 'Jefe de Operaciones Pto. Vallarta'
  | 'Jefe de Operaciones Puebla'
  | 'Jefe de Operaciones Culiacán'
  | 'Jefe de Operaciones Mazatlán'
  | 'Jefe de Operaciones León'
  | 'Jefe de Operaciones Tijuana'
  | 'Jefe de Operaciones Mérida'
  | 'Administrador'
  | 'DEV';

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
  canEditCircuitoExistente: boolean; // Mostrar plumita (editar) en cada cara/circuito del modal Asignar Inventario
  canEditClienteEnFormularios: boolean; // Editar campo cliente (CUIC) en solicitudes y propuestas

  // Campañas
  canEditCampanas: boolean;
  canEditCampanaStatus: boolean; // Cambiar estatus en modal de campaña
  allowedCampanaStatuses: string[] | null; // null = todos los estatus permitidos, array = solo esos
  canEditDetalleCampana: boolean;
  canEditCaraFiltersOnEdit: boolean; // Editar estados, ciudades y formatos al editar una cara existente en propuestas
  canEditArticuloOnEdit: boolean; // Editar artículo SAP al editar una cara existente (solo si no hay reservas)
  canDeleteDetalleCampana: boolean;
  canDeleteCaraConReservas: boolean;
  canPostToSAP: boolean; // Ver y usar botón "Enviar a SAP" (POST) en detalle de campaña, independiente de canEditDetalleCampana
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
  canApproveArteSinRevisar: boolean; // Aprobar directamente artes "Sin revisar" desde tab Revisar y Aprobar
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

  // SAP
  canCancelPostSAP: boolean;

  // Historial de Acciones
  canSeeHistorialAcciones: boolean;
  canSeeAllHistorial: boolean;
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
  canEditCircuitoExistente: true,
  canEditClienteEnFormularios: false, // Solo asesores pueden editar el campo cliente en formularios

  canEditCampanas: true,
  canEditCampanaStatus: true,
  allowedCampanaStatuses: null, // null = todos
  canEditDetalleCampana: true,
  canEditCaraFiltersOnEdit: false,
  canEditArticuloOnEdit: false,
  canDeleteDetalleCampana: true,
  canDeleteCaraConReservas: true,
  canPostToSAP: false,
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
  canApproveArteSinRevisar: false, // Restrictivo por default: solo Diseñadores y Analistas lo activan
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

  canCancelPostSAP: false,

  canSeeHistorialAcciones: true,
  canSeeAllHistorial: false,
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
    allowedPropuestaStatuses: ['Pase a ventas', 'Ajuste Cto-Cliente', 'Descartada', 'Rechazada'],
    canBuscarInventarioEnModal: false,
    canEditClienteEnFormularios: true, // Puede editar campo cliente en solicitudes y propuestas
    canEditArticuloOnEdit: true, // Puede editar artículo SAP al editar circuito (si no hay reservas)

    canEditCampanas: true,
    canEditDetalleCampana: true, // Permitir edición de detalle para Gestor de Artes
    canDeleteDetalleCampana: false,
    canDeleteCaraConReservas: true,
    canEditGestionArtes: true,
    canResolveProduccionTasks: false,
    canResolveCorreccionTasks: true,
    canOnlyOpenCorreccionTasks: true,
    canOpenTasks: true,
    canCreateTareasGestionArtes: true,
    canResolveRevisionArtesTasks: true,

    canCreateInventarios: false,
    canEditInventarios: false,
    canDeleteInventarios: false,
  },
  'Asesor Analista': {
    // Combinación de permisos de Asesor Comercial + Analista de Servicio al Cliente
    canSeeDashboard: false,
    canSeeInventarios: false,
    canSeeAdminUsuarios: false,

    // Clientes: puede crear/editar (Asesor) pero no borrar
    canDeleteClientes: false,

    // Proveedores: sin acceso
    canCreateProveedores: false,
    canEditProveedores: false,
    canDeleteProveedores: false,

    // Solicitudes: acceso total (Asesor)
    // canCreateSolicitudes: true (default)
    // canEditSolicitudes: true (default)
    // canDeleteSolicitudes: true (default)
    // canAtenderSolicitudes: true (default)
    // canChangeEstadoSolicitud: true (default)

    // Propuestas: permisos de Asesor
    allowedPropuestaStatuses: ['Pase a ventas', 'Ajuste Cto-Cliente', 'Descartada', 'Rechazada'],
    canCompartirPropuesta: true,
    canBuscarInventarioEnModal: false,
    canEditClienteEnFormularios: true, // Asesor: puede editar campo cliente
    canEditArticuloOnEdit: true, // Asesor: puede editar artículo SAP

    // Campañas: puede editar (Asesor) + detalle campaña acceso total (Analista)
    canEditCampanas: true,
    canDeleteCaraConReservas: true,
    // canEditDetalleCampana: true (default — Analista)
    // canDeleteDetalleCampana: true (default — Analista)

    // Gestión de Artes: permisos de Analista
    // canEditGestionArtes: true (default — Analista)
    canResolveProduccionTasks: false,
    canResolveCorreccionTasks: true,
    canOnlyOpenCorreccionTasks: true,
    canOpenTasks: true,
    canCreateTareasGestionArtes: true,
    canApproveArteSinRevisar: true,

    // Inventarios: oculto
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
    canAsignarInventario: true, // No puede editar inventario, solo ver
    canCompartirPropuesta: true, // SÍ puede compartir
    canBuscarInventarioEnModal: false,
    canEditCircuitoExistente: false, // No puede editar circuitos existentes (plumita oculta)

    // Campañas: acceso a botones de detalle de campaña (Asignar/Quitar APS,
    // Pre Factura, Cortesía a Gestor y POST a SAP). Cancelar POST queda
    // reservado a TI/Admin.
    // CSV (Matriz QEB 2026-01-28): "No debe poder editar la información de
    // las campañas, ya que esta función corresponde únicamente al Asesor
    // Comercial". Por eso canEditCampanas (botón Editar info: nombre/fechas)
    // queda en false. Las acciones operativas (APS, SAP, prefactura) viven
    // bajo canEditDetalleCampana y siguen permitidas porque el CSV las
    // lista como responsabilidades del ASC.
    canEditCampanas: false,
    canEditDetalleCampana: true,
    canDeleteDetalleCampana: false,
    canPostToSAP: true,

    // Gestión de Artes: Puede hacer todo EXCEPTO resolver tareas de producción
    // canEditGestionArtes: true (por defecto)
    canResolveProduccionTasks: false,
    canResolveCorreccionTasks: true, // SÍ puede resolver tareas de corrección de artes
    canOnlyOpenCorreccionTasks: true, // Solo puede abrir tareas de tipo Corrección e Instalación
    canOpenTasks: true,
    canCreateTareasGestionArtes: true, // Puede crear tareas de Instalación
    canApproveArteSinRevisar: true,

    // Inventarios: Oculto (ya se oculta con canSeeInventarios: false)
    canCreateInventarios: false,
    canEditInventarios: false,
    canDeleteInventarios: false,
  },
  // ============================================================================
  // DIRECCIÓN
  // ============================================================================
  'Director General': {
    canSeeDashboard: true,
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
    // CSV (Matriz QEB 2026-01-28): ve todo (Dashboard, Clientes, Proveedores,
    // Solicitudes, Propuestas, Campañas, Inventarios), aprueba/rechaza
    // autorizaciones, descarga ODM/versionario.
    canSeeDashboard: true,
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
    canAprobarPropuesta: true, // CSV: aprueba/rechaza autorizaciones
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
    canSeeOrdenesMontajeButton: true, // CSV: descarga ODM/versionario

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

    canExportOrdenesMontaje: true, // CSV: descarga ODM/versionario
  },
  // Gerente Comercial: mismos permisos que Director Comercial PERO no recibe
  // tareas de autorización DCM (se filtra explícitamente en
  // back/services/autorizacion.service.ts para que no le lleguen).
  'Gerente Comercial': {
    canSeeDashboard: true,
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
    canSeeOrdenesMontajeButton: true, // CSV: descarga ODM/versionario

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

    canExportOrdenesMontaje: true, // CSV: descarga ODM/versionario
  },
  'Especialista de BI': {
    // Visualización general amplia
    canSeeDashboard: true,
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
    canSeeOrdenesMontajeButton: true, // CSV: descarga ODM/versionario

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

    canExportOrdenesMontaje: true, // CSV: descarga ODM/versionario
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
    allowedPropuestaStatuses: ['Pase a ventas', 'Ajuste Cto-Cliente', 'Descartada', 'Rechazada'],
    canBuscarInventarioEnModal: false,

    canEditCampanas: true,
    canEditCampanaStatus: false, // No puede cambiar status en modal de campaña
    canEditDetalleCampana: true,
    canDeleteDetalleCampana: false,

    // Gestión de Artes: habilitado para Asesores
    canEditGestionArtes: true,
    canResolveProduccionTasks: false,
    canResolveRevisionArtesTasks: true,
    canResolveCorreccionTasks: true,
    canCreateTareasGestionArtes: true,
    canOpenTasks: true,

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

    allowedPropuestaStatuses: ['Pase a ventas', 'Ajuste Cto-Cliente', 'Descartada', 'Rechazada'],
    canBuscarInventarioEnModal: false,

    canEditCampanas: true,
    canEditDetalleCampana: true,
    canDeleteDetalleCampana: false,
    canEditGestionArtes: true,
    canOpenTasks: true,
    canCreateTareasGestionArtes: true,
    canResolveRevisionArtesTasks: true,
    canResolveCorreccionTasks: true,

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
    allowedPropuestaStatuses: ['Pase a ventas', 'Ajuste Cto-Cliente', 'Descartada', 'Rechazada'],
    canBuscarInventarioEnModal: false,
    canEditClienteEnFormularios: true, // Puede editar campo cliente en solicitudes y propuestas
    canEditArticuloOnEdit: true, // Puede editar artículo SAP al editar circuito (si no hay reservas)

    canEditCampanas: true,
    canEditDetalleCampana: true,
    canDeleteDetalleCampana: false,
    canSeeGestionArtes: true,
    canEditGestionArtes: true,
    canResolveProduccionTasks: false,
    canSeeOrdenesMontajeButton: false,

    canSeeTabProgramacion: true,
    canSeeTabImpresiones: true,
    canSeeTabSubirArtes: false,
    canSeeTabRevisarAprobar: true,
    canSeeTabTestigos: true,
    canSeeTabValidacionInstalacion: true,
    canCreateTareasGestionArtes: true,
    canResolveRevisionArtesTasks: true,
    canResolveCorreccionTasks: true,
    canOpenTasks: true,

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
    canApproveArteSinRevisar: true,

    canCreateInventarios: false,
    canEditInventarios: false,
    canDeleteInventarios: false,
  },
  // ============================================================================
  // OPERACIONES - NUEVOS
  // ============================================================================
  'Call Center CON': {
    // Solo Recepción de artes - carga de reportes
    // CSV (Matriz QEB 2026-01-28): debe descargar ODM y versionario.
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
    canSeeOrdenesMontajeButton: true, // CSV: descarga ODM/versionario

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

    canExportOrdenesMontaje: true, // CSV: descarga ODM/versionario
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
    canSeeOrdenesMontajeButton: true, // CSV: descarga ODM/versionario

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

    canExportOrdenesMontaje: true, // CSV: descarga ODM/versionario
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
    canSeeOrdenesMontajeButton: true, // CSV: descarga ODM/versionario

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

    canExportOrdenesMontaje: true, // CSV: descarga ODM/versionario
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
    canSeeOrdenesMontajeButton: true, // CSV: descarga ODM/versionario

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

    canExportOrdenesMontaje: true, // CSV: descarga ODM/versionario
  },
  'Administrador': {
    // Admin tiene todos los permisos por defecto
    canEditClienteEnFormularios: true,
    canEditCaraFiltersOnEdit: true,
    canEditArticuloOnEdit: true,
    canCancelPostSAP: true,
    canSeeAllHistorial: true,
    canApproveArteSinRevisar: true,
  },
  'DEV': {
    // DEV tiene acceso total a todo
    canEditClienteEnFormularios: true,
    canEditCaraFiltersOnEdit: true,
    canEditArticuloOnEdit: true,
    canCancelPostSAP: true,
    canSeeHistorialAcciones: true,
    canSeeAllHistorial: true,
    canApproveArteSinRevisar: true,
  },
  'Gerente de Trafico': {
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

    // Propuestas
    canEditPropuestaStatus: true,
    allowedPropuestaStatuses: ['Abierto', 'Atendido', 'Ajuste Comercial'],
    canAprobarPropuesta: false,
    canAsignarInventario: true,
    canEditResumenPropuesta: true, // Puede editar campos en Resumen de Propuesta
    canCompartirPropuesta: true, // Puede ver y usar botón compartir
    canBuscarInventarioEnModal: true,

    // Campañas - pueden editar detalle (plaza/formato)
    canEditCampanas: true,
    allowedCampanaStatuses: ['Compartir', 'Rechazada'],
    canEditDetalleCampana: false, // No pueden asignar APS específico
    canEditCaraFiltersOnEdit: true,
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
  'Coordinador de trafico': {
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

    // Propuestas - pueden cambiar a Abierto, Atendido, Ajuste Comercial y Compartir
    canEditPropuestaStatus: true,
    allowedPropuestaStatuses: ['Abierto', 'Atendido', 'Ajuste Comercial'],
    canAprobarPropuesta: false,
    canAsignarInventario: true,
    canEditResumenPropuesta: true, // Puede editar campos en Resumen de Propuesta
    canCompartirPropuesta: true, // Puede ver y usar botón compartir
    canBuscarInventarioEnModal: true,

    // Campañas - pueden editar detalle (plaza/formato)
    canEditCampanas: true,
    allowedCampanaStatuses: ['Compartir', 'Rechazada'],
    canEditDetalleCampana: false, // No pueden asignar APS específico
    canEditCaraFiltersOnEdit: true,
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

    // Órdenes de Montaje - exportable
    canExportOrdenesMontaje: true,
  },
  'Especialista de trafico': {
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

    // Propuestas - pueden cambiar a Abierto, Atendido, Ajuste Comercial y Compartir
    canEditPropuestaStatus: true,
    allowedPropuestaStatuses: ['Abierto', 'Atendido', 'Ajuste Comercial'],
    canAprobarPropuesta: false,
    canAsignarInventario: true,
    canEditResumenPropuesta: true, // Puede editar campos en Resumen de Propuesta
    canCompartirPropuesta: true, // Puede ver y usar botón compartir
    canBuscarInventarioEnModal: true,

    // Campañas - pueden editar detalle (plaza/formato)
    canEditCampanas: true,
    allowedCampanaStatuses: ['Compartir', 'Rechazada'],
    canEditDetalleCampana: false, // No pueden asignar APS específico
    canEditCaraFiltersOnEdit: true,
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

    // Órdenes de Montaje - exportable
    canExportOrdenesMontaje: true,
  },
  'Auxiliar de trafico': {
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

    // Propuestas - pueden cambiar a Abierto, Atendido, Ajuste Comercial y Compartir
    canEditPropuestaStatus: true,
    allowedPropuestaStatuses: ['Abierto', 'Atendido', 'Ajuste Comercial'],
    canAprobarPropuesta: false,
    canAsignarInventario: true,
    canEditResumenPropuesta: true, // Puede editar campos en Resumen de Propuesta
    canCompartirPropuesta: true, // Puede ver y usar botón compartir
    canBuscarInventarioEnModal: true,

    // Campañas - pueden editar detalle (plaza/formato)
    canEditCampanas: true,
    allowedCampanaStatuses: ['Compartir', 'Rechazada'],
    canEditDetalleCampana: false, // No pueden asignar APS específico
    canEditCaraFiltersOnEdit: true,
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

    // Órdenes de Montaje - exportable
    canExportOrdenesMontaje: true,
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
    // CSV (Matriz QEB 2026-01-28): "Asignación de revisión de artes a otro
    // diseñador" → debe poder crear/asignar tareas de revisión.
    canCreateTareasGestionArtes: true,
    canResolveRevisionArtesTasks: true, // Sí pueden resolver tareas de revisión de artes

    // Inventarios - oculto
    canCreateInventarios: false,
    canEditInventarios: false,
    canDeleteInventarios: false,

    // Órdenes de Montaje - exportable
    canExportOrdenesMontaje: true,
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
    canApproveArteSinRevisar: true,
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
    canSeeOrdenesMontajeButton: true, // CSV: descarga ODM/versionario

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
    canExportOrdenesMontaje: true, // CSV: descarga ODM/versionario
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
    canSeeOrdenesMontajeButton: true, // CSV: descarga ODM/versionario

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
    canExportOrdenesMontaje: true, // CSV: descarga ODM/versionario
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
    canSeeOrdenesMontajeButton: true, // CSV: descarga ODM/versionario

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
    canExportOrdenesMontaje: true, // CSV: descarga ODM/versionario
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

  // Nuevos roles de Facturacion (Matriz Roles QEB IDs 39 y 40):
  // solo visibilidad total del modulo Campanas (Gestion de Artes en solo lectura),
  // sin edicion ni resolucion de tareas. Mismo perfil que Coord. Facturacion y Cobranza.
  'Coordinador de Facturación': {
    canSeeDashboard: false,
    canSeeClientes: false,
    canSeeProveedores: false,
    canSeeSolicitudes: false,
    canSeePropuestas: false,
    canSeeCampanas: true,
    canSeeInventarios: false,
    canSeeAdminUsuarios: false,

    canCreateClientes: false, canEditClientes: false, canDeleteClientes: false,
    canCreateProveedores: false, canEditProveedores: false, canDeleteProveedores: false,

    canCreateSolicitudes: false, canEditSolicitudes: false, canDeleteSolicitudes: false,
    canAtenderSolicitudes: false, canChangeEstadoSolicitud: false,

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
    canOnlyOpenImpresionTasks: false,
    canOnlyOpenRecepcionTasks: false,
    canOpenTasks: false,

    canCreateInventarios: false, canEditInventarios: false, canDeleteInventarios: false,

    canExportOrdenesMontaje: false,
  },
  'Especialista de Facturación': {
    canSeeDashboard: false,
    canSeeClientes: false,
    canSeeProveedores: false,
    canSeeSolicitudes: false,
    canSeePropuestas: false,
    canSeeCampanas: true,
    canSeeInventarios: false,
    canSeeAdminUsuarios: false,

    canCreateClientes: false, canEditClientes: false, canDeleteClientes: false,
    canCreateProveedores: false, canEditProveedores: false, canDeleteProveedores: false,

    canCreateSolicitudes: false, canEditSolicitudes: false, canDeleteSolicitudes: false,
    canAtenderSolicitudes: false, canChangeEstadoSolicitud: false,

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
    canOnlyOpenImpresionTasks: false,
    canOnlyOpenRecepcionTasks: false,
    canOpenTasks: false,

    canCreateInventarios: false, canEditInventarios: false, canDeleteInventarios: false,

    canExportOrdenesMontaje: false,
  },

  // ============================================================================
  // NUEVOS ROLES — Matriz QEB 2026-01-28
  // ============================================================================

  // Perfil A — Transversales: ven todo (Dashboard, Clientes, Proveedores,
  // Solicitudes, Propuestas, Campanas, Inventarios), pueden descargar
  // ODM/versionario. NO aprueban/rechazan autorizaciones (no son DG/DCM).
  'Director General Adjunto': {
    canSeeAdminUsuarios: false,
    canCreateClientes: false, canEditClientes: false, canDeleteClientes: false,
    canCreateProveedores: false, canEditProveedores: false, canDeleteProveedores: false,
    canCreateSolicitudes: false, canEditSolicitudes: false, canDeleteSolicitudes: false,
    canAtenderSolicitudes: false, canChangeEstadoSolicitud: false,
    canEditPropuestaStatus: false, allowedPropuestaStatuses: [],
    canAprobarPropuesta: false, canAsignarInventario: false, canEditResumenPropuesta: false,
    canCompartirPropuesta: true, canBuscarInventarioEnModal: false,
    canEditCampanas: false, canEditCampanaStatus: false,
    canEditDetalleCampana: false, canDeleteDetalleCampana: false,
    canSeeGestionArtes: true, canEditGestionArtes: false,
    canResolveProduccionTasks: false, canSeeOrdenesMontajeButton: true,
    canCreateTareasGestionArtes: false, canResolveRevisionArtesTasks: false,
    canCreateInventarios: false, canEditInventarios: false, canDeleteInventarios: false,
    canExportOrdenesMontaje: true,
  },
  'Director Desarrollo de Nuevos Negocios': {
    canSeeAdminUsuarios: false,
    canCreateClientes: false, canEditClientes: false, canDeleteClientes: false,
    canCreateProveedores: false, canEditProveedores: false, canDeleteProveedores: false,
    canCreateSolicitudes: false, canEditSolicitudes: false, canDeleteSolicitudes: false,
    canAtenderSolicitudes: false, canChangeEstadoSolicitud: false,
    canEditPropuestaStatus: false, allowedPropuestaStatuses: [],
    canAprobarPropuesta: false, canAsignarInventario: false, canEditResumenPropuesta: false,
    canCompartirPropuesta: true, canBuscarInventarioEnModal: false,
    canEditCampanas: false, canEditCampanaStatus: false,
    canEditDetalleCampana: false, canDeleteDetalleCampana: false,
    canSeeGestionArtes: true, canEditGestionArtes: false,
    canResolveProduccionTasks: false, canSeeOrdenesMontajeButton: true,
    canCreateTareasGestionArtes: false, canResolveRevisionArtesTasks: false,
    canCreateInventarios: false, canEditInventarios: false, canDeleteInventarios: false,
    canExportOrdenesMontaje: true,
  },
  'Gerente Comercial Vía Pública': {
    canSeeAdminUsuarios: false,
    canCreateClientes: false, canEditClientes: false, canDeleteClientes: false,
    canCreateProveedores: false, canEditProveedores: false, canDeleteProveedores: false,
    canCreateSolicitudes: false, canEditSolicitudes: false, canDeleteSolicitudes: false,
    canAtenderSolicitudes: false, canChangeEstadoSolicitud: false,
    canEditPropuestaStatus: false, allowedPropuestaStatuses: [],
    canAprobarPropuesta: false, canAsignarInventario: false, canEditResumenPropuesta: false,
    canCompartirPropuesta: true, canBuscarInventarioEnModal: false,
    canEditCampanas: false, canEditCampanaStatus: false,
    canEditDetalleCampana: false, canDeleteDetalleCampana: false,
    canSeeGestionArtes: true, canEditGestionArtes: false,
    canResolveProduccionTasks: false, canSeeOrdenesMontajeButton: true,
    canCreateTareasGestionArtes: false, canResolveRevisionArtesTasks: false,
    canCreateInventarios: false, canEditInventarios: false, canDeleteInventarios: false,
    canExportOrdenesMontaje: true,
  },
  'Gerente Comercial Plazas': {
    canSeeAdminUsuarios: false,
    canCreateClientes: false, canEditClientes: false, canDeleteClientes: false,
    canCreateProveedores: false, canEditProveedores: false, canDeleteProveedores: false,
    canCreateSolicitudes: false, canEditSolicitudes: false, canDeleteSolicitudes: false,
    canAtenderSolicitudes: false, canChangeEstadoSolicitud: false,
    canEditPropuestaStatus: false, allowedPropuestaStatuses: [],
    canAprobarPropuesta: false, canAsignarInventario: false, canEditResumenPropuesta: false,
    canCompartirPropuesta: true, canBuscarInventarioEnModal: false,
    canEditCampanas: false, canEditCampanaStatus: false,
    canEditDetalleCampana: false, canDeleteDetalleCampana: false,
    canSeeGestionArtes: true, canEditGestionArtes: false,
    canResolveProduccionTasks: false, canSeeOrdenesMontajeButton: true,
    canCreateTareasGestionArtes: false, canResolveRevisionArtesTasks: false,
    canCreateInventarios: false, canEditInventarios: false, canDeleteInventarios: false,
    canExportOrdenesMontaje: true,
  },
  'Jefe de BI': {
    canSeeAdminUsuarios: false,
    canCreateClientes: false, canEditClientes: false, canDeleteClientes: false,
    canCreateProveedores: false, canEditProveedores: false, canDeleteProveedores: false,
    canCreateSolicitudes: false, canEditSolicitudes: false, canDeleteSolicitudes: false,
    canAtenderSolicitudes: false, canChangeEstadoSolicitud: false,
    canEditPropuestaStatus: false, allowedPropuestaStatuses: [],
    canAprobarPropuesta: false, canAsignarInventario: false, canEditResumenPropuesta: false,
    canCompartirPropuesta: true, canBuscarInventarioEnModal: false,
    canEditCampanas: false, canEditCampanaStatus: false,
    canEditDetalleCampana: false, canDeleteDetalleCampana: false,
    canSeeGestionArtes: true, canEditGestionArtes: false,
    canResolveProduccionTasks: false, canSeeOrdenesMontajeButton: true,
    canCreateTareasGestionArtes: false, canResolveRevisionArtesTasks: false,
    canCreateInventarios: false, canEditInventarios: false, canDeleteInventarios: false,
    canExportOrdenesMontaje: true,
  },

  // Perfil B — TI + Mejora Continua: perfil de administrador completo
  // (visibilidad y edicion de todos los modulos, igual que 'Administrador').
  'Gerente de TI': {
    canEditClienteEnFormularios: true, canEditCaraFiltersOnEdit: true,
    canEditArticuloOnEdit: true, canCancelPostSAP: true,
    canSeeAllHistorial: true, canApproveArteSinRevisar: true,
  },
  'Especialista de TI': {
    canEditClienteEnFormularios: true, canEditCaraFiltersOnEdit: true,
    canEditArticuloOnEdit: true, canCancelPostSAP: true,
    canSeeAllHistorial: true, canApproveArteSinRevisar: true,
  },
  'Analista de TI': {
    canEditClienteEnFormularios: true, canEditCaraFiltersOnEdit: true,
    canEditArticuloOnEdit: true, canCancelPostSAP: true,
    canSeeAllHistorial: true, canApproveArteSinRevisar: true,
  },
  'Jefe de Mejora Continua': {
    canEditClienteEnFormularios: true, canEditCaraFiltersOnEdit: true,
    canEditArticuloOnEdit: true, canCancelPostSAP: true,
    canSeeAllHistorial: true, canApproveArteSinRevisar: true,
  },
  'Analista de Mejora Continua': {
    canEditClienteEnFormularios: true, canEditCaraFiltersOnEdit: true,
    canEditArticuloOnEdit: true, canCancelPostSAP: true,
    canSeeAllHistorial: true, canApproveArteSinRevisar: true,
  },

  // Perfil C — Plazas operativas: solo modulo Campanas, descarga ODM y
  // tareas de Instalacion. Mismo perfil que 'Director de Operaciones'.
  'Gerente de Operaciones GDL': {
    canSeeDashboard: false, canSeeClientes: false, canSeeProveedores: false,
    canSeeSolicitudes: false, canSeePropuestas: false, canSeeInventarios: false,
    canSeeAdminUsuarios: false,
    canCreateClientes: false, canEditClientes: false, canDeleteClientes: false,
    canCreateProveedores: false, canEditProveedores: false, canDeleteProveedores: false,
    canCreateSolicitudes: false, canEditSolicitudes: false, canDeleteSolicitudes: false,
    canAtenderSolicitudes: false, canChangeEstadoSolicitud: false,
    canEditPropuestaStatus: false, allowedPropuestaStatuses: [],
    canAprobarPropuesta: false, canAsignarInventario: false, canEditResumenPropuesta: false,
    canCompartirPropuesta: false, canBuscarInventarioEnModal: false,
    canEditCampanas: false, canEditCampanaStatus: false,
    canEditDetalleCampana: false, canDeleteDetalleCampana: false,
    canSeeGestionArtes: true, canEditGestionArtes: false,
    canResolveProduccionTasks: true, canSeeOrdenesMontajeButton: true,
    canSeeTabRevisarAprobar: false, canCreateTareasGestionArtes: false,
    canResolveRevisionArtesTasks: false, canOnlyOpenRecepcionTasks: true,
    canCreateInstalacionFromRecibido: true,
    canCreateInventarios: false, canEditInventarios: false, canDeleteInventarios: false,
    canExportOrdenesMontaje: true,
  },
  'Gerente de Operaciones MTY': {
    canSeeDashboard: false, canSeeClientes: false, canSeeProveedores: false,
    canSeeSolicitudes: false, canSeePropuestas: false, canSeeInventarios: false,
    canSeeAdminUsuarios: false,
    canCreateClientes: false, canEditClientes: false, canDeleteClientes: false,
    canCreateProveedores: false, canEditProveedores: false, canDeleteProveedores: false,
    canCreateSolicitudes: false, canEditSolicitudes: false, canDeleteSolicitudes: false,
    canAtenderSolicitudes: false, canChangeEstadoSolicitud: false,
    canEditPropuestaStatus: false, allowedPropuestaStatuses: [],
    canAprobarPropuesta: false, canAsignarInventario: false, canEditResumenPropuesta: false,
    canCompartirPropuesta: false, canBuscarInventarioEnModal: false,
    canEditCampanas: false, canEditCampanaStatus: false,
    canEditDetalleCampana: false, canDeleteDetalleCampana: false,
    canSeeGestionArtes: true, canEditGestionArtes: false,
    canResolveProduccionTasks: true, canSeeOrdenesMontajeButton: true,
    canSeeTabRevisarAprobar: false, canCreateTareasGestionArtes: false,
    canResolveRevisionArtesTasks: false, canOnlyOpenRecepcionTasks: true,
    canCreateInstalacionFromRecibido: true,
    canCreateInventarios: false, canEditInventarios: false, canDeleteInventarios: false,
    canExportOrdenesMontaje: true,
  },
  'Gerente Regional de Plazas': {
    canSeeDashboard: false, canSeeClientes: false, canSeeProveedores: false,
    canSeeSolicitudes: false, canSeePropuestas: false, canSeeInventarios: false,
    canSeeAdminUsuarios: false,
    canCreateClientes: false, canEditClientes: false, canDeleteClientes: false,
    canCreateProveedores: false, canEditProveedores: false, canDeleteProveedores: false,
    canCreateSolicitudes: false, canEditSolicitudes: false, canDeleteSolicitudes: false,
    canAtenderSolicitudes: false, canChangeEstadoSolicitud: false,
    canEditPropuestaStatus: false, allowedPropuestaStatuses: [],
    canAprobarPropuesta: false, canAsignarInventario: false, canEditResumenPropuesta: false,
    canCompartirPropuesta: false, canBuscarInventarioEnModal: false,
    canEditCampanas: false, canEditCampanaStatus: false,
    canEditDetalleCampana: false, canDeleteDetalleCampana: false,
    canSeeGestionArtes: true, canEditGestionArtes: false,
    canResolveProduccionTasks: true, canSeeOrdenesMontajeButton: true,
    canSeeTabRevisarAprobar: false, canCreateTareasGestionArtes: false,
    canResolveRevisionArtesTasks: false, canOnlyOpenRecepcionTasks: true,
    canCreateInstalacionFromRecibido: true,
    canCreateInventarios: false, canEditInventarios: false, canDeleteInventarios: false,
    canExportOrdenesMontaje: true,
  },
  'Jefe Regional de Plazas': {
    canSeeDashboard: false, canSeeClientes: false, canSeeProveedores: false,
    canSeeSolicitudes: false, canSeePropuestas: false, canSeeInventarios: false,
    canSeeAdminUsuarios: false,
    canCreateClientes: false, canEditClientes: false, canDeleteClientes: false,
    canCreateProveedores: false, canEditProveedores: false, canDeleteProveedores: false,
    canCreateSolicitudes: false, canEditSolicitudes: false, canDeleteSolicitudes: false,
    canAtenderSolicitudes: false, canChangeEstadoSolicitud: false,
    canEditPropuestaStatus: false, allowedPropuestaStatuses: [],
    canAprobarPropuesta: false, canAsignarInventario: false, canEditResumenPropuesta: false,
    canCompartirPropuesta: false, canBuscarInventarioEnModal: false,
    canEditCampanas: false, canEditCampanaStatus: false,
    canEditDetalleCampana: false, canDeleteDetalleCampana: false,
    canSeeGestionArtes: true, canEditGestionArtes: false,
    canResolveProduccionTasks: true, canSeeOrdenesMontajeButton: true,
    canSeeTabRevisarAprobar: false, canCreateTareasGestionArtes: false,
    canResolveRevisionArtesTasks: false, canOnlyOpenRecepcionTasks: true,
    canCreateInstalacionFromRecibido: true,
    canCreateInventarios: false, canEditInventarios: false, canDeleteInventarios: false,
    canExportOrdenesMontaje: true,
  },
  'Técnico en logística digital': {
    canSeeDashboard: false, canSeeClientes: false, canSeeProveedores: false,
    canSeeSolicitudes: false, canSeePropuestas: false, canSeeInventarios: false,
    canSeeAdminUsuarios: false,
    canCreateClientes: false, canEditClientes: false, canDeleteClientes: false,
    canCreateProveedores: false, canEditProveedores: false, canDeleteProveedores: false,
    canCreateSolicitudes: false, canEditSolicitudes: false, canDeleteSolicitudes: false,
    canAtenderSolicitudes: false, canChangeEstadoSolicitud: false,
    canEditPropuestaStatus: false, allowedPropuestaStatuses: [],
    canAprobarPropuesta: false, canAsignarInventario: false, canEditResumenPropuesta: false,
    canCompartirPropuesta: false, canBuscarInventarioEnModal: false,
    canEditCampanas: false, canEditCampanaStatus: false,
    canEditDetalleCampana: false, canDeleteDetalleCampana: false,
    canSeeGestionArtes: true, canEditGestionArtes: false,
    canResolveProduccionTasks: true, canSeeOrdenesMontajeButton: true,
    canSeeTabRevisarAprobar: false, canCreateTareasGestionArtes: false,
    canResolveRevisionArtesTasks: false, canOnlyOpenRecepcionTasks: true,
    canCreateInstalacionFromRecibido: true,
    canCreateInventarios: false, canEditInventarios: false, canDeleteInventarios: false,
    canExportOrdenesMontaje: true,
  },
  'Jefe de Operaciones Oaxaca': {
    canSeeDashboard: false, canSeeClientes: false, canSeeProveedores: false,
    canSeeSolicitudes: false, canSeePropuestas: false, canSeeInventarios: false,
    canSeeAdminUsuarios: false,
    canCreateClientes: false, canEditClientes: false, canDeleteClientes: false,
    canCreateProveedores: false, canEditProveedores: false, canDeleteProveedores: false,
    canCreateSolicitudes: false, canEditSolicitudes: false, canDeleteSolicitudes: false,
    canAtenderSolicitudes: false, canChangeEstadoSolicitud: false,
    canEditPropuestaStatus: false, allowedPropuestaStatuses: [],
    canAprobarPropuesta: false, canAsignarInventario: false, canEditResumenPropuesta: false,
    canCompartirPropuesta: false, canBuscarInventarioEnModal: false,
    canEditCampanas: false, canEditCampanaStatus: false,
    canEditDetalleCampana: false, canDeleteDetalleCampana: false,
    canSeeGestionArtes: true, canEditGestionArtes: false,
    canResolveProduccionTasks: true, canSeeOrdenesMontajeButton: true,
    canSeeTabRevisarAprobar: false, canCreateTareasGestionArtes: false,
    canResolveRevisionArtesTasks: false, canOnlyOpenRecepcionTasks: true,
    canCreateInstalacionFromRecibido: true,
    canCreateInventarios: false, canEditInventarios: false, canDeleteInventarios: false,
    canExportOrdenesMontaje: true,
  },
  'Jefe de Operaciones Acapulco': {
    canSeeDashboard: false, canSeeClientes: false, canSeeProveedores: false,
    canSeeSolicitudes: false, canSeePropuestas: false, canSeeInventarios: false,
    canSeeAdminUsuarios: false,
    canCreateClientes: false, canEditClientes: false, canDeleteClientes: false,
    canCreateProveedores: false, canEditProveedores: false, canDeleteProveedores: false,
    canCreateSolicitudes: false, canEditSolicitudes: false, canDeleteSolicitudes: false,
    canAtenderSolicitudes: false, canChangeEstadoSolicitud: false,
    canEditPropuestaStatus: false, allowedPropuestaStatuses: [],
    canAprobarPropuesta: false, canAsignarInventario: false, canEditResumenPropuesta: false,
    canCompartirPropuesta: false, canBuscarInventarioEnModal: false,
    canEditCampanas: false, canEditCampanaStatus: false,
    canEditDetalleCampana: false, canDeleteDetalleCampana: false,
    canSeeGestionArtes: true, canEditGestionArtes: false,
    canResolveProduccionTasks: true, canSeeOrdenesMontajeButton: true,
    canSeeTabRevisarAprobar: false, canCreateTareasGestionArtes: false,
    canResolveRevisionArtesTasks: false, canOnlyOpenRecepcionTasks: true,
    canCreateInstalacionFromRecibido: true,
    canCreateInventarios: false, canEditInventarios: false, canDeleteInventarios: false,
    canExportOrdenesMontaje: true,
  },
  'Jefe de Operaciones Toluca': {
    canSeeDashboard: false, canSeeClientes: false, canSeeProveedores: false,
    canSeeSolicitudes: false, canSeePropuestas: false, canSeeInventarios: false,
    canSeeAdminUsuarios: false,
    canCreateClientes: false, canEditClientes: false, canDeleteClientes: false,
    canCreateProveedores: false, canEditProveedores: false, canDeleteProveedores: false,
    canCreateSolicitudes: false, canEditSolicitudes: false, canDeleteSolicitudes: false,
    canAtenderSolicitudes: false, canChangeEstadoSolicitud: false,
    canEditPropuestaStatus: false, allowedPropuestaStatuses: [],
    canAprobarPropuesta: false, canAsignarInventario: false, canEditResumenPropuesta: false,
    canCompartirPropuesta: false, canBuscarInventarioEnModal: false,
    canEditCampanas: false, canEditCampanaStatus: false,
    canEditDetalleCampana: false, canDeleteDetalleCampana: false,
    canSeeGestionArtes: true, canEditGestionArtes: false,
    canResolveProduccionTasks: true, canSeeOrdenesMontajeButton: true,
    canSeeTabRevisarAprobar: false, canCreateTareasGestionArtes: false,
    canResolveRevisionArtesTasks: false, canOnlyOpenRecepcionTasks: true,
    canCreateInstalacionFromRecibido: true,
    canCreateInventarios: false, canEditInventarios: false, canDeleteInventarios: false,
    canExportOrdenesMontaje: true,
  },
  'Jefe de Operaciones Veracruz': {
    canSeeDashboard: false, canSeeClientes: false, canSeeProveedores: false,
    canSeeSolicitudes: false, canSeePropuestas: false, canSeeInventarios: false,
    canSeeAdminUsuarios: false,
    canCreateClientes: false, canEditClientes: false, canDeleteClientes: false,
    canCreateProveedores: false, canEditProveedores: false, canDeleteProveedores: false,
    canCreateSolicitudes: false, canEditSolicitudes: false, canDeleteSolicitudes: false,
    canAtenderSolicitudes: false, canChangeEstadoSolicitud: false,
    canEditPropuestaStatus: false, allowedPropuestaStatuses: [],
    canAprobarPropuesta: false, canAsignarInventario: false, canEditResumenPropuesta: false,
    canCompartirPropuesta: false, canBuscarInventarioEnModal: false,
    canEditCampanas: false, canEditCampanaStatus: false,
    canEditDetalleCampana: false, canDeleteDetalleCampana: false,
    canSeeGestionArtes: true, canEditGestionArtes: false,
    canResolveProduccionTasks: true, canSeeOrdenesMontajeButton: true,
    canSeeTabRevisarAprobar: false, canCreateTareasGestionArtes: false,
    canResolveRevisionArtesTasks: false, canOnlyOpenRecepcionTasks: true,
    canCreateInstalacionFromRecibido: true,
    canCreateInventarios: false, canEditInventarios: false, canDeleteInventarios: false,
    canExportOrdenesMontaje: true,
  },
  'Jefe de Operaciones Pto. Vallarta': {
    canSeeDashboard: false, canSeeClientes: false, canSeeProveedores: false,
    canSeeSolicitudes: false, canSeePropuestas: false, canSeeInventarios: false,
    canSeeAdminUsuarios: false,
    canCreateClientes: false, canEditClientes: false, canDeleteClientes: false,
    canCreateProveedores: false, canEditProveedores: false, canDeleteProveedores: false,
    canCreateSolicitudes: false, canEditSolicitudes: false, canDeleteSolicitudes: false,
    canAtenderSolicitudes: false, canChangeEstadoSolicitud: false,
    canEditPropuestaStatus: false, allowedPropuestaStatuses: [],
    canAprobarPropuesta: false, canAsignarInventario: false, canEditResumenPropuesta: false,
    canCompartirPropuesta: false, canBuscarInventarioEnModal: false,
    canEditCampanas: false, canEditCampanaStatus: false,
    canEditDetalleCampana: false, canDeleteDetalleCampana: false,
    canSeeGestionArtes: true, canEditGestionArtes: false,
    canResolveProduccionTasks: true, canSeeOrdenesMontajeButton: true,
    canSeeTabRevisarAprobar: false, canCreateTareasGestionArtes: false,
    canResolveRevisionArtesTasks: false, canOnlyOpenRecepcionTasks: true,
    canCreateInstalacionFromRecibido: true,
    canCreateInventarios: false, canEditInventarios: false, canDeleteInventarios: false,
    canExportOrdenesMontaje: true,
  },
  'Jefe de Operaciones Puebla': {
    canSeeDashboard: false, canSeeClientes: false, canSeeProveedores: false,
    canSeeSolicitudes: false, canSeePropuestas: false, canSeeInventarios: false,
    canSeeAdminUsuarios: false,
    canCreateClientes: false, canEditClientes: false, canDeleteClientes: false,
    canCreateProveedores: false, canEditProveedores: false, canDeleteProveedores: false,
    canCreateSolicitudes: false, canEditSolicitudes: false, canDeleteSolicitudes: false,
    canAtenderSolicitudes: false, canChangeEstadoSolicitud: false,
    canEditPropuestaStatus: false, allowedPropuestaStatuses: [],
    canAprobarPropuesta: false, canAsignarInventario: false, canEditResumenPropuesta: false,
    canCompartirPropuesta: false, canBuscarInventarioEnModal: false,
    canEditCampanas: false, canEditCampanaStatus: false,
    canEditDetalleCampana: false, canDeleteDetalleCampana: false,
    canSeeGestionArtes: true, canEditGestionArtes: false,
    canResolveProduccionTasks: true, canSeeOrdenesMontajeButton: true,
    canSeeTabRevisarAprobar: false, canCreateTareasGestionArtes: false,
    canResolveRevisionArtesTasks: false, canOnlyOpenRecepcionTasks: true,
    canCreateInstalacionFromRecibido: true,
    canCreateInventarios: false, canEditInventarios: false, canDeleteInventarios: false,
    canExportOrdenesMontaje: true,
  },
  'Jefe de Operaciones Culiacán': {
    canSeeDashboard: false, canSeeClientes: false, canSeeProveedores: false,
    canSeeSolicitudes: false, canSeePropuestas: false, canSeeInventarios: false,
    canSeeAdminUsuarios: false,
    canCreateClientes: false, canEditClientes: false, canDeleteClientes: false,
    canCreateProveedores: false, canEditProveedores: false, canDeleteProveedores: false,
    canCreateSolicitudes: false, canEditSolicitudes: false, canDeleteSolicitudes: false,
    canAtenderSolicitudes: false, canChangeEstadoSolicitud: false,
    canEditPropuestaStatus: false, allowedPropuestaStatuses: [],
    canAprobarPropuesta: false, canAsignarInventario: false, canEditResumenPropuesta: false,
    canCompartirPropuesta: false, canBuscarInventarioEnModal: false,
    canEditCampanas: false, canEditCampanaStatus: false,
    canEditDetalleCampana: false, canDeleteDetalleCampana: false,
    canSeeGestionArtes: true, canEditGestionArtes: false,
    canResolveProduccionTasks: true, canSeeOrdenesMontajeButton: true,
    canSeeTabRevisarAprobar: false, canCreateTareasGestionArtes: false,
    canResolveRevisionArtesTasks: false, canOnlyOpenRecepcionTasks: true,
    canCreateInstalacionFromRecibido: true,
    canCreateInventarios: false, canEditInventarios: false, canDeleteInventarios: false,
    canExportOrdenesMontaje: true,
  },
  'Jefe de Operaciones Mazatlán': {
    canSeeDashboard: false, canSeeClientes: false, canSeeProveedores: false,
    canSeeSolicitudes: false, canSeePropuestas: false, canSeeInventarios: false,
    canSeeAdminUsuarios: false,
    canCreateClientes: false, canEditClientes: false, canDeleteClientes: false,
    canCreateProveedores: false, canEditProveedores: false, canDeleteProveedores: false,
    canCreateSolicitudes: false, canEditSolicitudes: false, canDeleteSolicitudes: false,
    canAtenderSolicitudes: false, canChangeEstadoSolicitud: false,
    canEditPropuestaStatus: false, allowedPropuestaStatuses: [],
    canAprobarPropuesta: false, canAsignarInventario: false, canEditResumenPropuesta: false,
    canCompartirPropuesta: false, canBuscarInventarioEnModal: false,
    canEditCampanas: false, canEditCampanaStatus: false,
    canEditDetalleCampana: false, canDeleteDetalleCampana: false,
    canSeeGestionArtes: true, canEditGestionArtes: false,
    canResolveProduccionTasks: true, canSeeOrdenesMontajeButton: true,
    canSeeTabRevisarAprobar: false, canCreateTareasGestionArtes: false,
    canResolveRevisionArtesTasks: false, canOnlyOpenRecepcionTasks: true,
    canCreateInstalacionFromRecibido: true,
    canCreateInventarios: false, canEditInventarios: false, canDeleteInventarios: false,
    canExportOrdenesMontaje: true,
  },
  'Jefe de Operaciones León': {
    canSeeDashboard: false, canSeeClientes: false, canSeeProveedores: false,
    canSeeSolicitudes: false, canSeePropuestas: false, canSeeInventarios: false,
    canSeeAdminUsuarios: false,
    canCreateClientes: false, canEditClientes: false, canDeleteClientes: false,
    canCreateProveedores: false, canEditProveedores: false, canDeleteProveedores: false,
    canCreateSolicitudes: false, canEditSolicitudes: false, canDeleteSolicitudes: false,
    canAtenderSolicitudes: false, canChangeEstadoSolicitud: false,
    canEditPropuestaStatus: false, allowedPropuestaStatuses: [],
    canAprobarPropuesta: false, canAsignarInventario: false, canEditResumenPropuesta: false,
    canCompartirPropuesta: false, canBuscarInventarioEnModal: false,
    canEditCampanas: false, canEditCampanaStatus: false,
    canEditDetalleCampana: false, canDeleteDetalleCampana: false,
    canSeeGestionArtes: true, canEditGestionArtes: false,
    canResolveProduccionTasks: true, canSeeOrdenesMontajeButton: true,
    canSeeTabRevisarAprobar: false, canCreateTareasGestionArtes: false,
    canResolveRevisionArtesTasks: false, canOnlyOpenRecepcionTasks: true,
    canCreateInstalacionFromRecibido: true,
    canCreateInventarios: false, canEditInventarios: false, canDeleteInventarios: false,
    canExportOrdenesMontaje: true,
  },
  'Jefe de Operaciones Tijuana': {
    canSeeDashboard: false, canSeeClientes: false, canSeeProveedores: false,
    canSeeSolicitudes: false, canSeePropuestas: false, canSeeInventarios: false,
    canSeeAdminUsuarios: false,
    canCreateClientes: false, canEditClientes: false, canDeleteClientes: false,
    canCreateProveedores: false, canEditProveedores: false, canDeleteProveedores: false,
    canCreateSolicitudes: false, canEditSolicitudes: false, canDeleteSolicitudes: false,
    canAtenderSolicitudes: false, canChangeEstadoSolicitud: false,
    canEditPropuestaStatus: false, allowedPropuestaStatuses: [],
    canAprobarPropuesta: false, canAsignarInventario: false, canEditResumenPropuesta: false,
    canCompartirPropuesta: false, canBuscarInventarioEnModal: false,
    canEditCampanas: false, canEditCampanaStatus: false,
    canEditDetalleCampana: false, canDeleteDetalleCampana: false,
    canSeeGestionArtes: true, canEditGestionArtes: false,
    canResolveProduccionTasks: true, canSeeOrdenesMontajeButton: true,
    canSeeTabRevisarAprobar: false, canCreateTareasGestionArtes: false,
    canResolveRevisionArtesTasks: false, canOnlyOpenRecepcionTasks: true,
    canCreateInstalacionFromRecibido: true,
    canCreateInventarios: false, canEditInventarios: false, canDeleteInventarios: false,
    canExportOrdenesMontaje: true,
  },
  'Jefe de Operaciones Mérida': {
    canSeeDashboard: false, canSeeClientes: false, canSeeProveedores: false,
    canSeeSolicitudes: false, canSeePropuestas: false, canSeeInventarios: false,
    canSeeAdminUsuarios: false,
    canCreateClientes: false, canEditClientes: false, canDeleteClientes: false,
    canCreateProveedores: false, canEditProveedores: false, canDeleteProveedores: false,
    canCreateSolicitudes: false, canEditSolicitudes: false, canDeleteSolicitudes: false,
    canAtenderSolicitudes: false, canChangeEstadoSolicitud: false,
    canEditPropuestaStatus: false, allowedPropuestaStatuses: [],
    canAprobarPropuesta: false, canAsignarInventario: false, canEditResumenPropuesta: false,
    canCompartirPropuesta: false, canBuscarInventarioEnModal: false,
    canEditCampanas: false, canEditCampanaStatus: false,
    canEditDetalleCampana: false, canDeleteDetalleCampana: false,
    canSeeGestionArtes: true, canEditGestionArtes: false,
    canResolveProduccionTasks: true, canSeeOrdenesMontajeButton: true,
    canSeeTabRevisarAprobar: false, canCreateTareasGestionArtes: false,
    canResolveRevisionArtesTasks: false, canOnlyOpenRecepcionTasks: true,
    canCreateInstalacionFromRecibido: true,
    canCreateInventarios: false, canEditInventarios: false, canDeleteInventarios: false,
    canExportOrdenesMontaje: true,
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

  const specificPermissions = rolePermissions[role as UserRole];

  // Si el rol no existe en el mapa, dar permisos mínimos (no defaults de admin)
  if (!specificPermissions) {
    return {
      ...defaultPermissions,
      canSeeDashboard: true,
      canSeeClientes: false,
      canSeeProveedores: false,
      canSeeSolicitudes: false,
      canSeePropuestas: false,
      canSeeCampanas: false,
      canSeeInventarios: false,
      canSeeAdminUsuarios: false,
    };
  }

  return {
    ...defaultPermissions,
    ...specificPermissions,
  };
}

// Hook para usar en componentes
export function usePermissions(role: string | undefined | null): RolePermissions {
  return getPermissions(role);
}
