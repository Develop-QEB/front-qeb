/**
 * screenContexts.ts
 *
 * Contextos de UI que se inyectan en el sistema prompt de QEBooh.
 * Clave: "<Pantalla>" o "<Pantalla>:<Modal>"
 * Valor: descripción en texto plano de lo que el usuario está viendo,
 *        sus campos, botones y cómo funciona cada uno.
 */

export const SCREEN_CONTEXTS: Record<string, string> = {

  // ─────────────────────────── DASHBOARD ───────────────────────────
  'Dashboard': `El usuario está en el Dashboard, la pantalla de inicio del sistema.
Elementos visibles:
- Tarjetas de métricas: Solicitudes totales, Propuestas activas, Campañas activas, Clientes registrados. Cada tarjeta muestra el número y una variación porcentual.
- Gráfica de solicitudes por mes (barras o líneas).
- Lista de actividad reciente: últimas solicitudes, propuestas y campañas modificadas.
- Accesos rápidos a los módulos principales.
Nota: el dashboard es de solo lectura, no tiene acciones de edición.`,

  // ─────────────────────────── SOLICITUDES ───────────────────────────
  'Solicitudes': `El usuario está en el módulo de Solicitudes, que es la lista de todas las solicitudes de espacios publicitarios.
Elementos visibles:
- Barra de búsqueda: busca por nombre de campaña, CUIC o cliente.
- Filtros: Estado (Todos, Pendiente, En revisión, Aprobada, Rechazada), Asesor, Fecha.
- Tabla de solicitudes con columnas: Nombre campaña, Cliente (razón social), Asesor, Período, Estado, Acciones.
- Botón "Nueva Solicitud" (esquina superior derecha, color morado): abre el modal para crear una solicitud.
- Cada fila tiene íconos de acción: Ver (ojo), Editar (lápiz), Cambiar estado, Eliminar.
- Botón de agrupación por campos como plaza o asesor.
- Paginación al fondo de la tabla.
El flujo normal: Ejecutivo crea solicitud → queda en Pendiente → Director la revisa → la Aprueba o Rechaza → si Aprobada se puede crear una Propuesta.`,

  'Solicitudes:Nueva Solicitud': `El usuario tiene abierto el modal "Nueva Solicitud". Es un formulario de 2 pasos.

PASO 1 - "CUIC y Asignados":
- Campo "Seleccionar CUIC": desplegable buscable que conecta con SAP. CUIC es el identificador único del cliente en el sistema SAP (como un código de cuenta de cliente). Al seleccionar un CUIC se autocompletan los siguientes campos.
- Campo "Razón Social": nombre legal del cliente, se llena automáticamente desde SAP, editable.
- Campo "Asesor": nombre del ejecutivo de cuenta asignado al cliente en SAP, editable.
- Campo "Categoría": categoría de negocio del cliente (ej: Retail, Automotriz), editable.
- Campo "Asignados": selector múltiple para agregar usuarios del equipo que trabajarán en esta solicitud. Botón "Limpiar todos" elimina todos los asignados.
- Botón "Siguiente": avanza al paso 2.

PASO 2 - "Campaña":
- Campo "Nombre de Campaña": texto libre, nombre identificador de la campaña.
- Selector de período: tabs "Catorcena" (períodos de 15 días) o "Mensual". Selector de año y número de catorcena/mes para inicio y fin.
- Campo "Descripción": texto largo describiendo la campaña.
- Campo "Notas": notas breves adicionales.
- Sección "Caras" (espacios publicitarios solicitados): lista de caras a agregar, cada cara tiene:
  - "Seleccionar artículo": elige el tipo de espacio (formato publicitario).
  - "Estado": Disponible, Reservado, etc.
  - "Formato": tipo de formato (espectacular, mural, etc.).
  - "Tipo": Tradicional o Digital.
  - "Período Inicio / Fin": catorcenas o meses específicos dentro del rango de la solicitud.
  - "Renta": número de caras (espacios) que el cliente paga en este artículo. No es dinero, es cantidad de inventario.
  - "Bonificación": número de caras bonificadas, es decir, espacios que se dan gratis al cliente como parte del trato comercial. No es un descuento en dinero, son caras adicionales sin costo.
  - "Tarifa Pública": número de caras a tarifa pública (precio de lista) en este artículo. Tampoco es dinero, es cantidad.
  - "NSE": nivel socioeconómico objetivo (botones de selección múltiple: A/B, C+, C, D+, D, E).
  - Botón "Eliminar" (rojo): elimina esa cara.
- Botón "Agregar Cara": añade una nueva fila de espacio a la solicitud.
- Botón "Guardar" (morado): guarda y crea la solicitud.
- Botón "Cancelar": cierra el modal sin guardar.`,

  'Solicitudes:Editar Solicitud': `El usuario tiene abierto el modal "Editar Solicitud". Contiene los mismos campos que "Nueva Solicitud" pero precargados con la información existente.
Campos adicionales:
- Botón "Refresh SAP": recarga los datos del cliente desde SAP (actualiza Razón Social, Asesor, Categoría).
- Todos los campos de las caras son editables.
- Botón "Guardar": guarda los cambios.
- Botón "Cancelar": descarta cambios y cierra.`,

  'Solicitudes:Ver Solicitud': `El usuario tiene abierto el modal de detalle de una solicitud (solo lectura).
Muestra toda la información de la solicitud: cliente, campaña, período, caras con sus detalles, estado actual, asignados, descripción, notas.
No permite editar directamente desde aquí.`,

  'Solicitudes:Cambiar Estado Solicitud': `El usuario tiene abierto el modal para cambiar el estado de una solicitud.
Opciones de estado disponibles: Pendiente, En revisión, Aprobada, Rechazada.
Campo de comentario/motivo (opcional): para explicar el motivo del cambio.
Botón "Confirmar": aplica el cambio de estado.
Botón "Cancelar": cierra sin cambiar.
Nota: solo usuarios con permiso de atender solicitudes pueden aprobar o rechazar.`,

  // ─────────────────────────── PROPUESTAS ───────────────────────────
  'Propuestas': `El usuario está en el módulo de Propuestas, lista de todas las propuestas comerciales.
Elementos visibles:
- Barra de búsqueda: busca por nombre, cliente o número.
- Filtros: Estado (Borrador, Enviada, Aprobada, Rechazada), Cliente, Asesor.
- Tabla con columnas: Nombre, Cliente, Período, Estado, Caras asignadas, Acciones.
- Botón "Nueva Propuesta": crea una propuesta (normalmente desde una solicitud aprobada).
- Acciones por fila: Ver detalle, Asignar inventario (mapa), Compartir con cliente, Cambiar estado.
Flujo: Solicitud aprobada → crear Propuesta → asignar inventario en mapa → enviar link al cliente → cliente aprueba o rechaza → si aprueba se crea una Campaña.`,

  'Propuestas:Asignar Inventario Propuesta': `El usuario tiene abierto el modal/pantalla de asignación de inventario para una propuesta.
Elementos visibles:
- Mapa interactivo: muestra todos los espacios publicitarios disponibles como puntos en el mapa.
  - Puntos verdes: espacios disponibles.
  - Puntos grises: espacios no disponibles o reservados.
  - Al hacer clic en un punto: muestra detalles del espacio (código, ubicación, formato, precio).
- Panel lateral con tabla de espacios disponibles y filtros.
- Filtros disponibles: Plaza/Ciudad, Formato, Tipo (Tradicional/Digital), Flujo/Contraflujo, Solo únicos, Solo completos, Solo isla.
- Barra de búsqueda: busca por código o dirección.
- Botón "Agrupar" (ícono de regla, color verde cuando activo): agrupa los espacios de la tabla por cercanía geográfica para facilitar la selección de espacios en una misma zona. Cuando se activa aparecen dos controles adicionales:
  - Selector de modo "Distancia" / "Listado":
    - Modo "Distancia": el sistema agrupa los espacios usando el algoritmo de distancia haversine (distancia real entre coordenadas GPS). Los espacios que estén dentro del radio configurado se asignan al mismo grupo.
    - Modo "Listado": agrupa los espacios secuencialmente según el orden de la lista, sin considerar ubicación geográfica.
  - Selector de distancia (solo en modo Distancia): 100m, 200m, 500m (default), 1km, 1.5km, 2km, 3km. Define el radio mínimo de separación entre grupos.
  - Campo numérico de tamaño de grupo: define cuántos espacios máximo hay por grupo (default 10, mínimo 2, máximo 50).
  - Cuando está activo, aparece una columna "Grupo" en la tabla que indica a qué grupo pertenece cada espacio (Grupo 1, Grupo 2, etc.).
- Botón "Filtro POI": filtra espacios cercanos a un Punto de Interés marcado en el mapa.
- Botón "Cargar CSV": carga una lista de códigos de espacios desde un archivo CSV.
- Botón "Asignar seleccionados": agrega los espacios marcados a la propuesta.
- Botón "Quitar seleccionados": elimina espacios ya asignados.
- Sección inferior "Reservados": lista de espacios ya asignados a esta propuesta, con los mismos controles de agrupación.
Tip: los espacios en gris con precio cruzado están reservados por otra propuesta.`,

  // ─────────────────────────── CAMPAÑAS ───────────────────────────
  'Campanas': `El usuario está en el módulo de Campañas, lista de todas las campañas activas y pasadas.
Elementos visibles:
- Barra de búsqueda: por nombre de campaña o cliente.
- Filtros: Estado (Activa, Pausada, Terminada, Cancelada), Plaza, Período.
- Tabla con columnas: Nombre, Cliente, Período inicio-fin, APS asignados, Estado, Acciones.
- Acciones por fila: Ver detalle (abre CampanaDetailPage), Editar, Cambiar estado, Gestión de artes (si tiene permiso).
Flujo: Propuesta aprobada por cliente → se crea Campaña → se asignan APS → se gestiona el arte (diseño) → se programa e imprime → se instala y valida.`,

  'Campanas:Editar Campaña': `El usuario tiene abierto el modal de asignación/edición de inventario de una campaña. Este modal tiene dos paneles principales:

Panel izquierdo - Mapa interactivo: muestra los espacios del inventario disponible y reservado con puntos en el mapa.

Panel derecho - Tabla de inventario disponible con:
- Barra de búsqueda por código o dirección.
- Filtros: Flujo/Contraflujo, Solo únicos, Solo completos, Solo digitales, Solo isla.
- Botón "Agrupar" (ícono de regla, verde cuando activo): agrupa los espacios de la tabla por cercanía geográfica. Útil para seleccionar espacios de una misma zona sin tener que buscarlos uno a uno. Al activarlo aparecen:
  - Selector de modo "Distancia" / "Listado":
    - Modo "Distancia": agrupa usando coordenadas GPS reales (algoritmo haversine). Los espacios más cercanos entre sí quedan en el mismo grupo.
    - Modo "Listado": agrupa secuencialmente por posición en la lista, sin tomar en cuenta ubicación geográfica.
  - Selector de distancia: 100m, 200m, 500m (default), 1km, 1.5km, 2km, 3km. Es el radio mínimo de separación entre grupos.
  - Campo de tamaño de grupo: cuántos espacios máximo por grupo (default 10, rango 2-50).
  - Columna "Grupo" en la tabla: muestra a qué grupo pertenece cada espacio (Grupo 1, Grupo 2...).
- Botón "Filtro POI": filtra espacios cercanos a un punto del mapa.
- Botón "Cargar CSV": importa lista de espacios desde archivo CSV.
- Botón "Reservar seleccionados": reserva los espacios seleccionados para la campaña.

Sección inferior - "Reservados": lista de espacios ya asignados a la campaña, con los mismos controles de agrupación por distancia.
Botón "Quitar reservas": libera espacios ya reservados.`,

  'Campanas:Nueva Incidencia': `El usuario tiene abierto el modal para reportar una incidencia en una campaña.
Campos:
- Tipo de incidencia: desplegable con categorías (daño, robo, mantenimiento, etc.).
- Descripción: texto libre describiendo el problema.
- Espacio afectado: selector del inventario de la campaña.
- Foto adjunta: permite subir imagen de la incidencia.
Botón "Reportar": guarda la incidencia.
Botón "Cancelar": cierra sin guardar.`,

  'Campanas:Cambiar Estado Campaña': `El usuario tiene abierto el modal para cambiar el estado de una campaña.
Estados disponibles: Activa, Pausada, En producción, Terminada, Cancelada.
Campo comentario: motivo del cambio (opcional).
Botón "Confirmar": aplica el cambio.`,

  'Campanas:Órdenes de Montaje': `El usuario tiene abierto el modal de Órdenes de Montaje para una campaña.
Muestra la lista de órdenes de instalación de los espacios publicitarios.
Cada orden tiene: espacio, dirección, fecha de instalación, responsable, estado.
Permite crear nuevas órdenes, marcarlas como completadas o cancelarlas.`,

  'Campanas:Re-impresión': `El usuario tiene abierto el modal de Re-impresión.
Se usa cuando un arte ya impreso necesita reimprimirse (por daño, cambio de arte, etc.).
Campos: espacio a reimprimir, motivo, prioridad, fecha límite.
Botón "Solicitar Re-impresión": crea la solicitud.`,

  // ─────────────────────────── DETALLE CAMPAÑA ───────────────────────────
  'Detalle de Campana': `El usuario está en la pantalla de detalle de una campaña específica.
Secciones visibles:
- Encabezado: nombre, cliente, período, estado actual, asesor responsable.
- Pestaña "Información": datos generales de la campaña, descripción, notas.
- Pestaña "Inventario": tabla de todos los espacios publicitarios reservados. Columnas: código, ubicación, plaza, formato, tipo, período, APS asignado.
  - Botón "Asignar APS": abre un selector para asignar un APS (proveedor de instalación/mantenimiento) a cada espacio.
  - Cada espacio tiene un indicador de arte: sin arte, arte pendiente, arte aprobado.
- Pestaña "Mapa": mapa con todos los espacios de la campaña marcados.
- Pestaña "Comentarios": historial de comentarios del equipo. Campo de texto para agregar nuevo comentario + botón Enviar.
- Botón "Gestión de Artes" (o icono de tarea): navega al módulo de gestión de artes de esta campaña.
- Botón "Editar campaña": abre modal de edición.
- Botón "Cambiar estado": cambia el estado de la campaña.
Nota: APS significa Agencia de Publicidad en Sitio, es el proveedor responsable de instalar y mantener el espacio.`,

  // ─────────────────────────── GESTIÓN DE ARTES ───────────────────────────
  'Gestion de Artes': `El usuario está en la pantalla de Gestión de Artes (también llamado Gestor de Tareas) de una campaña.
Esta pantalla es donde se lleva el seguimiento del proceso de arte publicitario.
Tiene 5 pestañas:

1. "Subir Artes":
   - Lista de espacios sin arte asignado.
   - Por cada espacio: botón "Subir Arte" para adjuntar el archivo de diseño (JPG, PNG o PDF, máx 10MB).
   - También se pueden arrastrar y soltar archivos.
   - Al subir, el arte queda en estado "Pendiente de revisión".

2. "Revisar y Aprobar":
   - Lista de artes subidos pendientes de revisión.
   - Por cada arte: preview de imagen, botón "Aprobar" (verde) y botón "Rechazar" (rojo).
   - Al rechazar: campo de texto para escribir el motivo del rechazo.
   - Solo usuarios con permiso de revisión pueden aprobar o rechazar.

3. "Programación":
   - Gestión de las órdenes de programación de instalación.
   - Tabla con espacios, fechas programadas, APS responsable, estado de la programación.
   - Botón "Crear orden de programación": selecciona espacios y asigna fechas.
   - Estados de programación: Por programar, Programado, Instalado.

4. "Impresiones":
   - Seguimiento del estado de impresión de cada arte aprobado.
   - Tabla con: espacio, arte, imprenta asignada, fecha solicitada, fecha entrega, estado.
   - Botón "Solicitar impresión": envía el arte a imprimir.
   - Estados: Pendiente, En impresión, Impreso, Entregado.
   - Botón "Re-impresión": solicita reimprimir un arte ya impreso.

5. "Validación/Testigo":
   - Registro fotográfico de la instalación como evidencia.
   - Por cada espacio: subir foto "testigo" que comprueba que el arte está instalado correctamente.
   - Al subir foto testigo: el espacio queda como Validado.
   - Botón "Subir Testigo": abre selector de imagen.`,

  // ─────────────────────────── INVENTARIOS ───────────────────────────
  'Inventarios': `El usuario está en el módulo de Inventarios, el catálogo de espacios publicitarios.
Elementos visibles:
- Barra de búsqueda: busca por código de inventario, dirección, municipio.
- Filtros: Tipo (espectacular, mural, valla, etc.), Plaza (ciudad), Estatus (Disponible, Reservado, Bloqueado, Vendido).
- Tabla principal con columnas: Código, Nombre/Ubicación, Plaza, Municipio, Tipo, Formato, Estatus, Precio, Acciones.
- Botón "Crear" (solo admins): crea un nuevo espacio en el inventario.
- Botón "Cargar CSV": carga masiva de inventario desde archivo CSV.
- Acciones por fila:
  - "Editar": modifica los datos del espacio.
  - "Historial": muestra en qué campañas y propuestas ha estado este espacio.
  - "Eliminar": elimina el espacio (solo si no tiene reservas activas).
Estatus explicados:
- Disponible: el espacio puede asignarse a propuestas nuevas.
- Reservado: está comprometido en una propuesta o campaña activa.
- Bloqueado: bloqueado manualmente por el administrador (no disponible).
- Vendido: cerrado como venta definitiva.`,

  // ─────────────────────────── CLIENTES ───────────────────────────
  'Clientes': `El usuario está en el módulo de Clientes.
Elementos visibles:
- Barra de búsqueda: busca por nombre de cliente, razón social o CUIC.
- Tabla con columnas: Nombre, Razón Social, CUIC, Asesor, Categoría, Solicitudes activas, Acciones.
- Botón "Registrar Cliente" (morado): abre el modal para crear un cliente nuevo.
- Acciones por fila: Ver detalle (ojo), Editar (lápiz), Eliminar (basurero).`,

  'Clientes:Registrar Cliente': `El usuario tiene abierto el modal "Registrar Cliente".
Campos:
- CUIC: código único del cliente en SAP. Si se ingresa un CUIC válido, se autocompletan los campos siguientes desde SAP.
- Razón Social: nombre legal de la empresa cliente.
- Nombre comercial: nombre por el que se conoce al cliente.
- Asesor: ejecutivo de cuenta asignado.
- Categoría: tipo de industria o negocio.
- Email: correo de contacto.
- Teléfono: número de contacto.
Botón "Guardar": crea el cliente.
Botón "Cancelar": cierra sin crear.
Nota: el CUIC es el identificador que vincula al cliente con el sistema SAP de la empresa. Sirve para que al crear solicitudes el sistema cargue automáticamente los datos del cliente.`,

  'Clientes:Ver Cliente': `El usuario tiene abierto el modal de detalle de un cliente (solo lectura).
Muestra toda la información del cliente: CUIC, razón social, asesor, categoría, historial de solicitudes y campañas asociadas.`,

  // ─────────────────────────── PROVEEDORES ───────────────────────────
  'Proveedores': `El usuario está en el módulo de Proveedores.
Lista de empresas o personas que proveen servicios (instalación, impresión, mantenimiento).
Elementos:
- Búsqueda por nombre o tipo de proveedor.
- Tabla: Nombre, Tipo de servicio, Contacto, Plaza, Estado, Acciones.
- Botón "Agregar Proveedor": crea un nuevo proveedor.
- Acciones: Editar, Eliminar.`,

  // ─────────────────────────── NOTIFICACIONES ───────────────────────────
  'Notificaciones': `El usuario está en el módulo de Notificaciones/Tareas.
Puede alternar entre dos vistas con los botones de vista en la esquina superior:
- Vista Lista: muestra todas las notificaciones y tareas en forma de lista cronológica.
  - Cada ítem muestra: tipo, descripción, módulo relacionado, fecha, estado (leída/no leída).
  - Botón de marcar como leída (ícono de check).
  - Filtros: Tipo (notificación, tarea), Estado (leída, no leída, pendiente), Módulo.
- Vista Kanban: muestra las tareas en columnas por estado (Pendiente, En progreso, Completada).
  - Las tarjetas se pueden arrastrar entre columnas para cambiar estado.
Botón "Marcar todas como leídas": marca todas las notificaciones como leídas.`,

  // ─────────────────────────── CORREOS ───────────────────────────
  'Correos': `El usuario está en el módulo de Correos, que muestra el historial de correos enviados automáticamente por el sistema.
Elementos:
- Tabla con columnas: Destinatario, Asunto, Módulo relacionado, Fecha de envío, Estado (enviado, fallido).
- Búsqueda por destinatario o asunto.
- Filtro por módulo o estado.
- Cada fila tiene botón "Ver detalle" para ver el contenido completo del correo.
Este módulo es de solo lectura; los correos se envían automáticamente cuando ocurren eventos como aprobación de propuestas, cambios de estado, etc.`,

  // ─────────────────────────── PERFIL ───────────────────────────
  'Perfil': `El usuario está en su página de Perfil.
Secciones:
- Foto de perfil: imagen actual del usuario con botón "Cambiar foto" (sube JPG/PNG).
- Información personal: Nombre completo (editable), Email (no editable, es el usuario de acceso), Teléfono (editable).
- Cambiar contraseña: campos "Contraseña actual", "Nueva contraseña", "Confirmar nueva contraseña". Botón "Actualizar contraseña".
- Preferencias: selector de tema (claro/oscuro).
Botón "Guardar cambios": guarda la información personal.`,

  // ─────────────────────────── ADMIN ───────────────────────────
  'Admin': `El usuario está en la sección de administración del sistema.
Solo accesible para usuarios con rol Administrador.
Opciones disponibles:
- "Usuarios" (/admin/usuarios): gestión de cuentas de usuario del sistema.
- "Historial QEBooh" (/admin/chatbot): historial de todas las conversaciones con el chatbot.`,

};

/**
 * Obtiene el contexto de UI para la pantalla y modal actuales.
 * Devuelve una cadena de texto o null si no hay contexto definido.
 */
export function getScreenContext(pantalla: string, modal: string | null): string | null {
  if (modal) {
    const key = `${pantalla}:${modal}`;
    if (SCREEN_CONTEXTS[key]) return SCREEN_CONTEXTS[key];
  }
  return SCREEN_CONTEXTS[pantalla] || null;
}
