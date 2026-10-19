/**
 * screenContexts.ts
 *
 * Contextos de UI que se inyectan en el sistema prompt de QEBooh.
 * Clave: "<Pantalla>" o "<Pantalla>:<Modal>"
 * Valor: descripción en texto plano de lo que el usuario está viendo,
 *        sus campos, botones y cómo funciona cada uno.
 *
 * Última actualización masiva: 2026-10-19 (Matriz 2026 completa, nuevos
 * módulos Desposteo / Pruebas de Color / Historial de Acciones / Actividad
 * Comercial, estatus canónicos, candados server-side y renames oct-2026).
 */

export const SCREEN_CONTEXTS: Record<string, string> = {

  // ─────────────────────────── DASHBOARD ───────────────────────────
  'Dashboard': `El usuario está en el Dashboard, la pantalla de inicio del sistema. IMPORTANTE: los Directores (Director General, Director Comercial, Director Comercial General, Director General Adjunto) NO aterrizan aquí al iniciar sesión; su landing por defecto es /notificaciones (tab Mis Autorizaciones). Si un Director te pregunta por el Dashboard, aclara que debe navegar manualmente.
Elementos visibles:
- Tarjetas KPI clickeables (filtran la tabla al hacer clic): Total inventario (rosa), Disponible (cyan), Reservado (amarillo), Vendido (verde), No Disponible (morado). El estatus 'No Disponible' antes se llamaba 'Bloqueado' (renombrado 2026-10-14); también se usa el sinónimo 'Inhabilitado'.
- Filtros: Plaza, Tipo, Estatus, Tradicional/Digital.
- Mapa Google Maps con círculos de densidad por plaza y pins individuales al hacer zoom > 11.
- Gráficas de barras y pie con distribución de estatus e inventario.
- Actualización en tiempo real por WebSocket.
Nota: el dashboard es de solo lectura, no tiene acciones de edición ni creación.`,

  // ─────────────────────────── SOLICITUDES ───────────────────────────
  'Solicitudes': `El usuario está en el módulo de Solicitudes, primera etapa del flujo comercial.
Columnas de tabla: ID (morado), Base SAP (CIMU/TEST/TRADE/UDC), CUIC, Cliente (razón social + CUIC + producto), Campaña, Marca, Presupuesto (verde MXN), Tipo Período (Catorcena/Mensual), Período Inicio, Período Fin, Asignado, Status, Acciones.
Estatus REALES del enum (NO uses nombres viejos como 'Pendiente' o 'En revisión'):
- Ingreso: recién creada, esperando revisión del equipo comercial.
- Análisis: en evaluación activa.
- Cierre: solicitud trabajada y cerrada (puede derivar en propuesta o quedar cerrada sin propuesta).
- Rechazada: no procede.
Filtro UDC: existe un filtro específico para solicitudes de la base SAP UDC (Aeropuerto AICM). Solo visible para roles del área Aeropuerto o Dirección.
Botones de acción por fila:
- Ver (ojo, morado): siempre disponible.
- Editar (lápiz): deshabilitado si estatus es Cierre o Rechazada.
- Atender (play, fucsia): convierte solicitud en propuesta. Solo habilitado cuando estatus permite avance comercial.
- Estatus (burbuja ámbar): abre modal de cambio + comentarios.
- Eliminar (basura, rojo): confirmación, no disponible si tiene propuesta derivada.
Herramientas: búsqueda, filtros avanzados combinables (AND), exportar CSV, botón 'Nueva Solicitud' (degradado morado-rosa).
Flujo real: Asesor Comercial crea solicitud (estatus Ingreso) > equipo comercial analiza > si procede se atiende y se genera Propuesta (estatus Cierre); si no, se Rechaza. La aprobación formal no se da en la solicitud sino en la propuesta.`,

  'Solicitudes:Nueva Solicitud': `El usuario tiene abierto el asistente 'Nueva Solicitud'. Son 4 PASOS (NO 2) con guardado automático de borrador si cierra sin terminar.

PASO 1 - Cliente:
- Botones filtro de base SAP: ALL, CIMU, TEST, TRADE, UDC (muestra conteo). UDC corresponde a Aeropuerto AICM.
- Buscar CUIC: dropdown con búsqueda por Marca/Producto/Razón Social/CUIC. Opción muestra Marca + CUIC + Producto.
- Asignados: multi-select con tags (nombre + área). El creador se agrega automáticamente. Botón 'Limpiar todos'.
- 'Siguiente' solo habilitado al elegir CUIC.
BORRADOR: si cierras sin guardar aparece banner 'Borrador restaurado' al reabrir, con opción de descartar.

PASO 2 - Campaña:
- Nombre de Campaña (requerido).
- Toggle Catorcena/Mensual. Dropdowns de año y período con filtrado mutuo para evitar rangos inválidos.
- Descripción (opcional), Notas (opcional).
- Archivo adjunto (opcional, imagen o PDF con preview).
- Checkbox 'Impresión IMU' (marca la solicitud como tipo IMU).

PASO 3 - Agregar Caras:
- Artículo SAP (dropdown; auto-llena Formato y Tarifa Pública). Puede ser IM (impresión), CT (cortesía), BF/CF (bonificación), o CF-#### (Mantenimiento Externo, nuevo oct-2026, se comporta como IM).
- Estado y Ciudades (cascada). Autodetección por nombre del artículo (PV, GDL, MTY).
- Formato (algunos formatos fuerzan Mensual).
- Tipo: Tradicional o Digital. Autodetección 'DIGITAL' en ItemName.
- Período Catorcena/Mensual. Nuevo oct-2026: Digital PB/CL puede ir también en Mensual (antes solo Catorcena) y aparece en UN+.
- Renta (label cambia a 'Impresiones' si IM/CF-####; deshabilitado si CT).
- Bonificación (label 'Cortesía' si CT; deshabilitado si IM/CF-####; máx = renta).
- Tarifa Pública (desde SAP U_IMU_PublicPrice, no puede ser 0 excepto CT/BF/CF).
- NSE: multi-toggle A/B, C+, C, D+, D, E.
EVALUACIÓN AUTOMÁTICA DE AUTORIZACIÓN al agregar/editar: el sistema detecta si cara requiere Autorización DG, DCM o DAE (UDC) y muestra toast. Para ventas con sap_database='UDC', aplica tabulador separado UDC con bandas DG/DAE; si la cara no tiene tabulador UDC se auto-aprueba.

PASO 4 - Resumen:
- Vista solo lectura: cliente, campaña, tabla de caras agrupada por catorcena/artículo, adjunto, asignados.
- 'Crear Solicitud' (verde) deshabilitado si falta CUIC, no hay caras, no hay asignados, o hay caras inválidas.
- Si hay autorizaciones pendientes: toast amarillo 'Solicitud creada. X cara(s) requieren autorización de DG/DCM/DAE'.

REGLA (recordar al asesor): Renta y Bonificación son CANTIDAD de espacios, NO dinero. Tarifa Pública es precio de lista por cara. Bonificación es espacios gratis dentro del mismo trato, Cortesía (CT) es un artículo aparte.`,

  'Solicitudes:Editar Solicitud': `El usuario tiene abierto el modal "Editar Solicitud". Contiene los mismos campos que "Nueva Solicitud" pero precargados con la información existente.
Campos adicionales:
- Botón "Refresh SAP": recarga los datos del cliente desde SAP (actualiza Razón Social, Asesor, Categoría).
- Todos los campos de las caras son editables.
- Botón "Guardar": guarda los cambios.
- Botón "Cancelar": descarta cambios y cierra.`,

  'Solicitudes:Ver Solicitud': `El usuario tiene abierto el modal de detalle de una solicitud (solo lectura).
Muestra toda la información de la solicitud: cliente, campaña, período, caras con sus detalles, estado actual, asignados, descripción, notas.
No permite editar directamente desde aquí.`,

  'Solicitudes:Cambiar Estado Solicitud': `El usuario tiene abierto el modal 'Cambiar estatus' de una solicitud.
Opciones del dropdown (enum real): Ingreso, Análisis, Cierre, Rechazada.
BLOQUEO: si la solicitud tiene caras con autorización_dg, autorización_dcm o autorización_dae en 'pendiente', aparece alerta roja 'Esta solicitud tiene X cara(s) pendientes de autorización' y NO se puede pasar a Cierre.
Comentarios cronológicos a la derecha con avatar + fecha + texto. Input + botón enviar (avión de papel). Los comentarios NO se pueden editar ni eliminar una vez enviados.
Solo roles con permiso canEditEstatusSolicitud (Asesor Comercial, Analista, Trafico, Dirección) pueden cambiar. Analista de Facturación no.`,

  // ─────────────────────────── PROPUESTAS ───────────────────────────
  'Propuestas': `El usuario está en el módulo de Propuestas (lista de propuestas comerciales).
VISTAS DISPONIBLES: toggle 'Tabla' / 'Versionario' en la esquina superior. Versionario agrupa dinámicamente por múltiples campos (asesor, cliente, catorcena, estatus, plaza) y recuerda la configuración en localStorage. Si el usuario no ve las columnas típicas probablemente está en Versionario.
Columnas de la tabla: ID (morado), Fecha Creación, Marca (badge SAP CIMU/TEST/TRADE/UDC), Creador (avatar), Campaña, Asignados (primeros 2 + '+N'), Inversión (ámbar, moneda), Inicio (badge 'Cat X / YYYY' o 'Ene 2024'), Fin, Estatus (badge clickeable), Acciones.

Estatus REALES del enum (NO uses 'Borrador', 'Enviada' ni 'Atendido' viejo):
- Ingreso: recién creada desde solicitud atendida. Trafico empieza a asignar inventario.
- Análisis: Trafico/Comercial trabajando el inventario.
- Ajuste Cto-Cliente: ajustes con cliente/contrato.
- Pase a ventas: lista para compartir y aprobar; detona cotización y creación de Campaña al aprobar.
- Rechazada: no procede.
- Descartada: cancelada internamente, se liberan reservas.

Botones de acción (4):
1. Aprobar (CheckCircle verde): solo visible con permiso canAprobarPropuesta; solo habilitado en 'Pase a ventas'. Abre ApproveModal.
2. Asignar Inventario (MapPinned magenta): con permiso canAsignarInventario abre AssignInventarioModal; sin permiso aparece como ícono de ojo (solo lectura).
3. Compartir (Share2 cyan): habilitado desde 'Pase a ventas' en adelante. Genera link PÚBLICO sin auth: /cliente/propuesta/:id y /cliente/propuesta/:id/mapa (vista con mapa separada).
4. Estatus (badge clickeable): abre StatusModal si tiene permiso.

BLOQUEOS CRÍTICOS:
- Estatus 'Ingreso' (equivalente al viejo 'Abierto'): bloquea botones para rol Asesor Comercial / Asesor Analista / Asesor Comercial Aeropuerto / Director Comercial Aeropuerto.
- En Ajuste Comercial solo Asesores Comerciales pueden reservar o eliminar inventario (regla 2026-09-17).
- Trafico NO puede editar tarifa_publica, costo ni cantidad de caras (candado server-side 2026-10-07). Si intenta, el backend rechaza.

Flujo real: Solicitud se atiende > se crea Propuesta en Ingreso > Trafico asigna inventario > se trabaja autorización DG/DCM si aplica > pasa a Pase a ventas > se comparte con cliente > se Aprueba > el sistema crea la Campaña automáticamente vía cotización.`,

  'Propuestas:Asignar Inventario Propuesta': `El usuario tiene abierto el modal/pantalla de asignación de inventario para una propuesta.
Panel izquierdo: Lista de 'caras' agrupadas por campos idénticos (artículo, ciudad, estados, tipo, NSE, formato, bonificación). Cada grupo muestra totales (Flujo, Contraflujo, Bonificación) e indicadores de completitud: check verde (completa), alerta amarilla (parcial), X roja (sin reservas).
Mapa interactivo: espacios como pins. Verde = disponible, naranja = reservado por esta propuesta, gris = reservado por otra o No Disponible/Inhabilitado.
Filtros: Plaza/Ciudad, Formato, Tipo (Tradicional/Digital), Flujo/Contraflujo, Solo únicos, Solo completos, Solo isla.
Agrupar por distancia: modo Distancia (haversine GPS, radios 100m-3km) o modo Listado; tamaño de grupo 2-50 (default 10).
Filtro POI, Carga CSV.

REGLAS IMPORTANTES DEL MODAL:
- Las reservas se guardan INCREMENTAL e INMEDIATAMENTE. No hay botón 'Guardar todo'. 'Conflicto de reserva' significa que otro usuario tomó ese espacio: refrescar.
- Hard-lock de estatus (2026-10-14): no se puede reservar ni reactivar inventario con estatus 'No Disponible' (antes 'Bloqueado') ni 'Inhabilitado'. El bot NO debe sugerir 'intenta de nuevo'; es candado definitivo.
- APS NO se asigna manualmente desde este modal ni desde ninguna parte del front: APS viene SIEMPRE de SAP (campo posted_aps en reservas). Para cancelar un APS ya posteado se usa el flujo de Desposteo.
- Reservar/eliminar en Ajuste Comercial: solo Asesores Comerciales. Trafico y demás roles verán los botones grises.
- Para eliminar un circuito de campaña activa se requiere Autorización de Eliminación (ver pantalla 'Autorizaciones de Eliminación').

Reservas Incompletas: desde 2026-08-25 ya NO bloquea pasar a 'Pase a ventas'; solo muestra aviso ámbar informativo. Artículos IM (impresión) nunca requieren reservas.

Direcciones Aprobadas: una cara ya autorizada conserva aprobación si costo/caras NO bajan y la tarifa cambia dentro de ±3%. Bajar caras requiere re-autorizar.`,

  // ─────────────────────────── CAMPAÑAS ───────────────────────────
  'Campanas': `El usuario está en el módulo de Campañas (lista de campañas activas y pasadas).
Estatus REALES del enum (no uses 'Activa' / 'Pausada' viejos): inactiva, Por iniciar, Aprobada, En Operación, Rechazada, Cancelada, Finalizada.
Columnas: ID, Período (badge dinámico: por iniciar/en curso/finalizada/cancelada/inactiva), Creador (avatar), Campaña, Marca (badge SAP CIMU/TEST/TRADE/UDC), Estatus (clickeable), Actividad, Fecha Inicio (Cat X / YYYY), Fecha Fin, APS (check/minus), Acciones.
Acciones por fila:
- Ver detalle (ojo): abre /campanas/detail/:id. Siempre disponible.
- Compartir (Share2): solo si la campaña tiene propuesta_id asociada.
- Editar (lápiz): visible con permiso canEditCampanas. DESHABILITADO si finalizada, cancelada o con APS ya asignados por SAP.
- Incidencia (triángulo): con permiso canSeeGestionArtes y período 'En curso' o estatus 'Aprobada'. Abre IncidenciaModal (Re-impresión o Bloqueo).

Vistas disponibles:
- Vista Tabla: lista paginada con filtros y agrupación hasta 2 niveles.
- Versionario (vista Catorcena): tarjetas por catorcena con campañas expandibles mostrando inventario y APS agrupado.

REGLA CRÍTICA (política QEB): las campañas NUNCA se eliminan. Para cancelar una campaña, cambiar el estatus a 'Rechazada' o 'Cancelada'. Al hacerlo se liberan automáticamente todas las reservas. Es IRREVERSIBLE.

Bote de circuitos: nunca se bloquea por autorización pendiente, solo los íconos de lápiz y 'agregar' se bloquean. En Campañas: Pase a ventas y aprobación formal SÍ bloquean si hay autorización DG/DCM/DAE pendiente.`,

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
Botón "Quitar reservas": libera espacios ya reservados.

RECORDATORIOS: Trafico NO puede editar tarifa/costo/caras (candado 2026-10-07). Hard-lock sobre inventario No Disponible/Inhabilitado (2026-10-14). Para eliminar un circuito se requiere Autorización de Eliminación.`,

  'Campanas:Nueva Incidencia': `El usuario tiene abierto IncidenciaModal.
Muestra nombre de campaña.
Tipo de Incidencia (dropdown): 'Re-impresión' o 'Bloqueo'.
- Si 'Bloqueo': navega a /inventarios con parámetros campanaId y campanaNombre para que Trafico/Admin bloquee el espacio afectado.
- Si 'Re-impresión': navega a /campanas/:id/tareas con parámetros incidencia=1, tipoIncidencia=Re-impresion, tab=testigo, subtab=instaladas, para abrir ReImpresionModal con los items ya instalados y poder solicitar reimprimir (motivos: Grafiti, Siniestro, Vandalismo, Daño por clima, Robo de material, Otro).
El modal solo se abre cuando la campaña está activa (En Operación) o Aprobada.`,

  'Campanas:Cambiar Estado Campaña': `El usuario tiene abierto StatusCampanaModal.
Dropdown de estatus disponibles (filtrados por permisos): Ajuste CTO Cliente, Atendido, Ajuste Comercial, Aprobada, Cancelada, Rechazada, Finalizada.
Vista previa del nuevo badge al seleccionar.
Sección de comentarios: lista cronológica con avatar + nombre + fecha + texto. Input + enviar (Enter o click). Actualización en tiempo real por WebSocket.
'Guardar Estatus' deshabilitado si no hubo cambio.
REGLA: las campañas NO se eliminan, solo se cambian a Rechazada o Cancelada. Al pasar a Rechazada/Cancelada se liberan todas las reservas y es IRREVERSIBLE.`,

  'Campanas:Órdenes de Montaje': `El usuario tiene abierto el modal de Órdenes de Montaje para una campaña.
Muestra la lista de órdenes de instalación con tabs: Ocupación VP, Digital, UN+, INVIAN VP, INVIAN Digital.
Cada orden tiene: espacio, dirección, fecha de instalación, responsable, estado.
Permite crear nuevas órdenes, marcarlas como completadas o cancelarlas.`,

  'Campanas:Re-impresión': `El usuario tiene abierto el modal de Re-impresión.
Se usa cuando un arte ya impreso necesita reimprimirse (por daño, cambio de arte, etc.).
Campos: espacio a reimprimir, motivo (Grafiti, Siniestro, Vandalismo, Daño por clima, Robo de material, Otro), prioridad, fecha límite.
Botón "Solicitar Re-impresión": crea la solicitud.`,

  // ─────────────────────────── DETALLE CAMPAÑA ───────────────────────────
  'Detalle de Campana': `El usuario está en la pantalla de detalle de una campaña (/campanas/detail/:id).
Header: nombre campaña, flecha de volver, badge de período, badge de estatus, cliente, asesor responsable.
Tarjetas tipo chips: período inicio/fin, creador, montos, categorías.
Mapa Google Maps con marcadores de los espacios de la campaña.
Tabla de inventario reservado con columnas: Código Único, Mueble/Formato, Ubicación, Plaza, Cara (F/CF), Período, APS, Estado del arte (sin arte / en revisión / aprobado), Estado de instalación.
Sección de comentarios en tiempo real.

APS - IMPORTANTE: APS NO se asigna manualmente. Aparece automáticamente desde SAP (posted_aps) cuando la campaña se postea. Si el usuario pregunta 'cómo asigno APS', aclarar que el flujo pasa por postear a SAP y que el campo se llena solo. Para cancelar un APS ya posteado existe el flujo de Desposteo (ver pantalla 'Desposteo').

Botones principales:
- 'Tareas de Seguimiento' (antes llamado 'Gestión de Artes'): navega a /campanas/:id/tareas, el gestor con 6 tabs.
- 'Editar campaña': abre modal de edición si cumple condiciones.
- 'Cambiar estatus': abre StatusCampanaModal.
- 'Órdenes de Montaje': abre OrdenesMontajeModal con tabs Ocupación VP, Digital, UN+, INVIAN VP, INVIAN Digital.
- 'Solicitar Desposteo' (según rol): abre DesposteoModal para iniciar el flujo de cancelación de POST SAP.`,

  // ─────────────────────────── TAREAS DE SEGUIMIENTO (ex Gestión de Artes) ───────────────────────────
  'Gestion de Artes': `El usuario está en la pantalla 'Tareas de Seguimiento' (ruta /campanas/:id/tareas; el título antiguo 'Gestión de Artes' ya no es el canónico). Es donde se lleva todo el proceso operativo post-aprobación.
Son 6 TABS (no 5), en este orden:

1. PROGRAMACIÓN (ícono Monitor): solo para espacios DIGITALES. Sub-tabs: En Programación / Programado. Crear orden de programación solo cuando el arte está aprobado. Campos: espacio, arte, fecha inicio/fin, horario, notas al proveedor.

2. IMPRESIONES (ícono Printer): solo para espacios TRADICIONALES. Sub-tabs: Orden de Impresión / En Impresión / Pendiente Recepción / Recibido. Se genera orden de compra al proveedor desde aquí para los artículos IM y CF-#### (Mantenimiento Externo).

3. SUBIR ARTES (ícono Upload): selecciona espacios y asigna artes. Modal AssignInventarioCampanaModal con 2 pasos: elegir imágenes de galería o subir/pegar URL, y agregar notas OBLIGATORIAS por imagen. Al asignar, el arte entra a 'en_revision'. Botón 'Limpiar Arte' (rojo, IRREVERSIBLE) resetea a 'Sin arte'.

4. REVISAR Y APROBAR (ícono Eye): revisa artes subidos y gestiona tareas de producción. Sub-filtros Sin Revisar / En Revisión / Aprobado / Rechazado. El flujo guarda evidencia en tarea.evidencia (JSON) con motivo, archivo adjunto o link, resueltaPor, resueltaAt. Permisos separados: 'crear tarea de revisión' (Analista) y 'resolver tarea de revisión' (Diseño). Un arte rechazado detona tarea de Corrección para el Analista; corregir regenera tarea de Revisión; ciclo hasta aprobar.

5. TESTIGOS (ícono Camera): sub-tabs Por Instalar / Instaladas / Testigo. En 'Instaladas' se abre modal para subir foto testigo (evidencia fotográfica de instalación). ReImpresionModal también se abre desde aquí para incidencias.

6. VALIDACIÓN INSTALACIÓN (ícono Camera o CheckCircle): subir y validar la foto testigo final. Sin testigo NO se puede marcar como instalado. Es el paso de cierre.

REGLA (recordar): El arte Rechazado requiere motivo específico Y adjunto (archivo o link). Un arte aprobado NO se puede 'desaprobar' sin crear una nueva tarea de Corrección. Pruebas de Color sigue un flujo paralelo distinto (ver pantalla 'Pruebas de Color').`,

  // ─────────────────────────── INVENTARIOS ───────────────────────────
  'Inventarios': `El usuario está en el módulo de Inventarios (/inventarios).
Columnas: ID, Código (formato MUPI-GDL-001_F con F=Flujo, CF=Contraflujo), Mueble (badge 'DIG' si digital), Formato, Ubicación, Plaza, Cara, Dimensiones, Actividad (Ocupado/Disponible), Estatus (Activo/No Disponible), Acciones.

ESTATUS REALES de inventario (usa 'No Disponible', NUNCA 'Bloqueado'):
- Activo/Disponible (verde): libre para asignar.
- Reservado (ámbar): comprometido en una propuesta/campaña.
- Ocupado (cyan): en uso activo con APS.
- Mantenimiento (gris): en reparación.
- No Disponible (rojo): bloqueado administrativamente, no se puede ocupar. Antes se llamaba 'Bloqueado' (renombrado 2026-10-14).
- Inhabilitado: variante dura, no se puede reactivar automáticamente.
HARD-LOCK (2026-10-14): no se puede reservar ni reactivar un inventario con estatus 'No Disponible' ni 'Inhabilitado'. Si el usuario reporta 'no puedo reservar este espacio', es por este candado.

Vistas: toggle Tabla / Mapa (Google Maps con pins coloreados).
Filtros: búsqueda (código/ubicación/municipio), Tipo, Estatus, Plaza. Combinables.
Acciones por fila: Editar, Historial (modal con todas las reservas pasadas), Eliminar (solo sin reservas activas).

MODALES ESPECIALIZADOS (visibles para Trafico/Admin):
- BloqueoMasivoModal: bloquea múltiples espacios a la vez con motivo y asignación de Analistas/Trafico.
- AuditoriaConflictosModal: audita conflictos de reservas duplicadas o inventario inconsistente.
- ReorganizarOcupacionModal: reorganiza qué espacios atienden qué campañas cuando hay conflicto.
- AnalisisOcupacionModal: análisis masivo de ocupación por período/plaza; se puede generar un link público /inventarios/analisis/:analisisId que comparte el análisis sin requerir permiso al módulo.
- Modal de Bloqueo individual (espacio en uso): obliga a motivo + lista de Analistas/Trafico. Al enviar genera tareas 'Ajuste Inventario Bloqueado' en cada campaña afectada.

Carga masiva CSV: subir, verificar, resultado (3 pasos). Campos requeridos: codigo_unico, tipo_de_mueble, tipo_de_cara (Flujo/Contraflujo), tradicional_digital, plaza, estado, municipio. Descarga de plantilla disponible.`,

  // ─────────────────────────── CLIENTES ───────────────────────────
  'Clientes': `El usuario está en el módulo Clientes.
Tarjetas resumen: Total Clientes, Agencias, Marcas, Categorías (números animados).
Pestañas (ampliadas en 2026): Base de Datos (clientes 'oficiales' QEB), CIMU, TEST, TRADE, UDC (Aeropuerto AICM). Las pestañas SAP tienen botón refrescar.
Columnas: CUIC, Cliente, Razón Social, Agencia, Marca, Acciones.
Herramientas: búsqueda, filtros avanzados (operadores: igual, distinto, contiene, no contiene), agrupación por Agencia/Marca/Categoría, exportar CSV.
Ver detalle (ojo morado): modal con CUIC, badge SAP, Razón Social, Asesor Comercial, Agencia, Marca y Producto, Categoría, Vigencias, IDs técnicos.

Agregar desde SAP:
1. Entrar a pestaña SAP (CIMU, TEST, TRADE o UDC).
2. Buscar el cliente.
3. Botón '+' verde.
4. Confirmar.
5. Cliente aparece en Base de Datos.
Solo roles con permiso agregan clientes. Asesor Comercial puede agregar pero NO eliminar.

Sincronización SAP (ClientesSyncModal): modal avanzado para sincronizar múltiples clientes desde SAP con mapeo de campos y resolución de duplicados. Solo para Admin/Dirección.`,

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

  // ─────────────────────────── NOTIFICACIONES Y TAREAS ───────────────────────────
  'Notificaciones': `El usuario está en el módulo Notificaciones y Tareas (/notificaciones).
IMPORTANTE: para los Directores (DG, DCM, Director Comercial General, Director General Adjunto, Director de Desarrollo de Nuevos Negocios) esta ES la pantalla de aterrizaje al iniciar sesión, no el Dashboard.

TABS DE LA PANTALLA (varían por rol):
- Mis Tareas: tareas asignadas al usuario (todos los roles).
- Mis Notas: bitácora de Dirección (crear/editar notas internas de gerencia con prioridad y visibilidad controlada vía NuevaNotaDireccionModal). Solo roles de Dirección.
- Mis Autorizaciones: tareas de Autorización DG/DCM/DAE pendientes. Solo Dirección y Filtro Autorización (Gerentes Comerciales).
- Nueva Actividad Comercial: botón que abre NuevaActividadComercialModal (ver pantalla 'Actividad Comercial'). Flag OCULTAR_ACTIVIDAD_COMERCIAL puede esconder este tab.

VISTAS DEL TAB 'Mis Tareas':
- Tablero (Kanban): columnas Pendiente / En Progreso / Completada. Drag & drop.
- Lista: tabla con ID, Tipo (badge), Título, Asignado, Fecha, Creador, Status, # Propuesta.
- Calendario: vista mensual con fechas límite.
- Notas: notas personales privadas del usuario.

Filtros rápidos: Todas / Sin finalizar / Finalizadas. Filtros avanzados con operadores y presets de fecha (Antes de hoy, Hoy, Mañana, Esta semana, Próxima semana, Próximos 14 días).
Agrupación multinivel: Estado, Tipo, Asignado, Responsable, Fecha.

TIPOS DE TAREAS que pueden aparecer (26+): Autorización DG, Autorización DCM, Autorización DAE, Filtro Autorización DG, Filtro Autorización DCM, Aprobación DG, Aprobación DCM, Rechazo DG, Rechazo DCM, Filtro Eliminación, Autorización Eliminación, Rechazo Eliminación, Aviso Eliminación, Solicitud, Atender solicitud, Propuesta, Seguimiento propuesta, Campaña, Seguimiento Campaña, Revisión de artes, Seguimiento Prueba de color, Corrección, Ajuste Cto-Cliente, Ajuste Comercial, Impresión, Producción, Orden de Programación, Orden de Instalación, Recepción, Recepción Parcial, Notificación, Actividad Comercial, Mención en Ticket, Filtro Desposteo, Autorización Desposteo. Cada tarea tiene su propio modal de resolución.`,

  'Notificaciones:NuevaActividadComercialModal': `El usuario tiene abierto NuevaActividadComercialModal (crear o editar una Actividad Comercial).
Es un tipo de tarea MANUAL que registran los Asesores para dejar constancia de leads, visitas, llamadas y seguimientos.

CAMPOS:
- ID_accion: lo asigna QEB al crear (identificador único).
- Asesor: el nombre del usuario que crea (automático).
- Tipo (dropdown): Lead, Campaña, Propuesta. Si eliges Lead el buscador de campaña/propuesta se BLOQUEA (no aplica).
- Buscar campaña (opcional): acepta nombre, ID, cliente o marca. Al seleccionar una campaña se autollenan cliente y marca pero siguen siendo editables.
- Cliente y Marca: campos independientes, editables aunque haya campaña vinculada.
- Año, Período (catorcena), Estatus (Abierto / Cerrado), Base (CIMU / TRADE / UDC): selectores manuales de clasificación.
- Descripción Actividad (texto libre, OBLIGATORIO).
- Fecha de creación (automática, formato dd/mm/yyyy hh:mm:ss am/pm).
- Programar recordatorio (opcional): detona una tarea de recordatorio en la fecha indicada.

COMPORTAMIENTO:
- Al guardar, se crea una tarea tipo 'Actividad Comercial' en Notificaciones y automáticamente se espeja en Historial de Acciones del ID vinculado (si hay campaña/propuesta/lead).
- Al editar una Actividad Comercial existente, aparece el botón 'Editar' en el modal lateral del drawer y en la lista. Reabre este mismo modal con todo precargado.
- Flag OCULTAR_ACTIVIDAD_COMERCIAL (en producción puede estar en true para esconder la feature). En dev/stage se habilita para QA.`,

  // ─────────────────────────── PRUEBAS DE COLOR ───────────────────────────
  'Pruebas de Color': `El usuario está en el flujo de Pruebas de Color (validación física del color de un arte antes de la impresión masiva).
Flujo (estatus del enum pruebas_color.status):
1. revision_artes: el Analista solicita una prueba de color; se le pide al Diseño generar el archivo.
2. arte_aprobado: Diseño aprueba el archivo interno de prueba.
3. enviada_proveedor: la prueba se envía físicamente al proveedor para impresión de muestra.
4. aprobada (terminal): el cliente/dirección validó la muestra impresa. La campaña puede continuar.

REGLAS CLAVE:
- Reenvío v2: si una prueba es rechazada, el reenvío NO crea un registro nuevo; actualiza el MISMO registro de pruebas_color incrementando la versión.
- Separación de permisos: 'crear prueba de color' lo hace Analista; 'revisar/aprobar/rechazar' lo hace Diseño o Dirección según la etapa.
- Adjuntos: cada prueba acepta archivo (JPG/PDF) Y enlace externo (ej. Google Drive). Pueden coexistir ambos en el mismo registro.
- Tareas generadas: 'Revisión de artes' (cuando se solicita) y 'Seguimiento Prueba de color' (cuando se envía al proveedor y se espera validación).
- Pruebas de Color es un flujo PARALELO a Tareas de Seguimiento normal; una campaña puede necesitar prueba o no según el cliente.`,

  'Pruebas de Color:PruebasColorModal': `El usuario tiene abierto PruebasColorModal (/campanas/:id/tareas con sub-tab Pruebas de Color).
Dos pestañas:
1. Listado de pruebas existentes (agrupadas por circuito con versión, estatus y adjuntos).
2. Formulario para solicitar nueva prueba.

CAMPOS DEL FORMULARIO:
- Circuito al que aplica (dropdown de reservas de la campaña).
- Archivo (JPG/PDF, max 10MB) y/o enlace externo (ej. Google Drive). Ambos pueden coexistir.
- Notas al Diseño/Proveedor.
- Checkbox 'Requiere nueva versión' (reenvío v2).

BOTONES SEGÚN ETAPA:
- Analista: 'Solicitar prueba', 'Reenviar v2'.
- Diseño: 'Aprobar arte interno', 'Rechazar con motivo + adjunto'.
- Proveedor/Dirección: 'Aprobar muestra física', 'Rechazar muestra'.

RECORDATORIO: al rechazar es OBLIGATORIO escribir motivo y subir archivo o link; se guarda en tarea.evidencia.`,

  // ─────────────────────────── DESPOSTEO ───────────────────────────
  'Desposteo': `El usuario está consultando o iniciando un flujo de Desposteo.
Desposteo = proceso formal para cancelar un APS ya posteado en SAP (p.ej. porque el cliente canceló, hubo un error de posteo, el espacio ya no está disponible). NUNCA se cancela un APS manualmente desde otra pantalla.

FLUJO:
1. SOLICITAR (Asesor Comercial): abre DesposteoModal modo 'solicitar', selecciona circuito/APS a despostear, elige motivo (Cancelación cliente, Error de posteo, Cambio de contrato, Siniestro, Otro) y agrega notas. Al enviar se congela un SNAPSHOT (precios, caras, APS, fechas) para auditoría — el snapshot no se modifica aunque la realidad cambie.
2. FILTRO GC (Gerente Comercial): recibe tarea 'Filtro Desposteo'; valida y aprueba o rechaza.
3. AUTORIZACIÓN FACTURACIÓN: recibe tarea 'Autorización Desposteo'; roles del área Facturación revisan impacto económico y autorizan.
4. EJECUCIÓN TI: TI corre el proceso de cancelación en SAP y marca el desposteo como 'ejecutado'.

ESTATUS (desposteo.status): solicitado, filtro_gc, pendiente_facturacion, autorizado, ejecutado, rechazado.

Roles clave: FACTURACION_ROLES = Analista de Facturación y Cobranza, Analista de Facturación, Coordinador de Facturación, Mesa de Control, Jefe de Facturación.

Si el usuario te pregunta 'cómo cancelo este APS': oriéntalo SIEMPRE a este flujo; NUNCA sugieras 'eliminar directo'.`,

  'Desposteo:DesposteoModal': `El usuario tiene abierto DesposteoModal. Tiene 4 MODOS según rol y etapa:

1. MODO SOLICITAR (Asesor): formulario con circuito/APS a despostear, motivo (dropdown), notas al proveedor, confirmación. Al enviar se crea el registro con snapshot congelado y la tarea 'Filtro Desposteo' se asigna al Gerente Comercial correspondiente.

2. MODO FILTRO (Gerente Comercial): ve el snapshot congelado + razón del asesor + comentarios cronológicos. Botones 'Aprobar filtro' (pasa a Facturación) o 'Rechazar' (motivo obligatorio).

3. MODO FACTURACIÓN (roles FACTURACION_ROLES): recibe el desposteo filtrado; ve snapshot + impacto facturación. Botones 'Autorizar' (crea tarea para TI de ejecutar en SAP) o 'Rechazar' (motivo obligatorio).

4. MODO VER (cualquier involucrado, lectura): muestra línea del tiempo con cada etapa + snapshot + evidencias. No permite editar.

El snapshot congelado incluye: APS actual, circuito, cliente, precios y caras al momento de solicitar. Es la fuente de verdad para auditoría — NO cambia aunque el inventario después se modifique.`,

  // ─────────────────────────── AUTORIZACIONES DE ELIMINACIÓN ───────────────────────────
  'Autorizaciones de Eliminación': `El usuario está en el flujo de Autorización de Eliminación de circuito.
IMPORTANTE: eliminar un circuito de una campaña activa NUNCA se hace directo. Siempre pasa por este flujo.

FLUJO:
1. SOLICITAR (Asesor Comercial): desde la pantalla de inventario/campaña, al intentar eliminar aparece modal pidiendo motivo. Al enviar se crea una tarea distintiva ROJA 'Filtro Eliminación' asignada al Gerente Comercial.
2. FILTRO GC: valida que la eliminación tenga sentido y la aprueba (pasa a Dirección) o la rechaza con 'Rechazo Eliminación'.
3. AUTORIZACIÓN DIRECCIÓN: Director (DG/DCM/DAE) autoriza. Si aprueba, se ejecuta la eliminación y se liberan las reservas; si rechaza, el circuito queda intacto y se dispara 'Aviso Eliminación' al asesor.

TAREAS DISTINTIVAS (todas en color rojo en Mis Tareas): Filtro Eliminación, Autorización Eliminación, Rechazo Eliminación, Aviso Eliminación.

ESTATUS (autorizacion_eliminacion.status): solicitada, filtro, aprobada, rechazada.

Si el usuario te pregunta 'cómo elimino este circuito': NUNCA sugieras eliminación directa; oriéntalo a este flujo.`,

  // ─────────────────────────── HISTORIAL DE ACCIONES ───────────────────────────
  'Historial de Acciones': `El usuario está en /historial-acciones, la pantalla de auditoría exhaustiva del sistema.
Solo visible para roles de Dirección, Administrador y DEV.

9 TIPOS DE ACCIÓN AUDITADOS:
1. Campaña: creación, cambio de estatus, edición, eliminación.
2. Propuesta: creación, cambio de estatus, aprobación, descarte.
3. Solicitud: creación, cambio de estatus, atender.
4. Inventario: reserva, liberación, bloqueo, reorganización.
5. Nota: creación/edición de notas de dirección.
6. Tarea: creación, resolución, reasignación.
7. Arte: subida, aprobación, rechazo (incluye Pruebas de Color).
8. Desposteo: solicitud, filtro, autorización, ejecución.
9. Autorización: DG/DCM/DAE y Autorización de Eliminación.

FILTROS: por tipo de acción, usuario que la hizo, rango de fechas, módulo relacionado, texto libre.
Vista: línea del tiempo con avatar + usuario + acción + ID relacionado + fecha + resumen.
Permite expandir cada entrada para ver detalles (antes/después, comentarios, adjuntos).

Si un Asesor pregunta 'quién cambió X': NO ve este historial; dile que contacte a su Director para consultarlo.`,

  // ─────────────────────────── CLIENTE: VISTA PÚBLICA DE PROPUESTA ───────────────────────────
  'Cliente Propuesta': `El usuario (CLIENTE EXTERNO) está en /cliente/propuesta/:id, la vista PÚBLICA de una propuesta compartida.
NO requiere autenticación: cualquiera con el link puede ver.

ELEMENTOS:
- Header: logo QEB, nombre de la propuesta, cliente, período.
- KPIs: total de caras, total inversión, plazas involucradas, formatos distintos.
- Tablas agrupadas por catorcena y por artículo: código, formato, ciudad, caras, tarifa.
- Gráficas: Top 10 ciudades, Top 10 formatos, distribución por NSE.
- Filtros y búsqueda rápida.
- Botón 'Ver mapa' → /cliente/propuesta/:id/mapa (vista con mapa interactivo).
- Botón 'Aprobar propuesta' / 'Solicitar ajustes' / 'Rechazar' (si la propuesta está en 'Pase a ventas').

Si el usuario que te consulta es un CLIENTE externo, mantén un tono comercial y evita jerga interna (no digas 'DG', 'cascada', 'posted_aps'). Si es un Asesor QEB preguntando sobre esta pantalla, puedes dar más detalle técnico.`,

  'Cliente Propuesta Mapa': `El usuario está en /cliente/propuesta/:id/mapa, la vista PÚBLICA de la propuesta con mapa interactivo.
No requiere auth.

- Mapa Google Maps con todos los circuitos de la propuesta marcados.
- Al hacer click en un pin: popup con código, ubicación, formato, foto si existe.
- Búsqueda POI (puntos de interés): el cliente puede escribir 'hospital', 'estadio', 'escuela', etc., y ver cuáles de los circuitos de la propuesta caen cerca.
- Filtros: plaza, formato, tipo (tradicional/digital).
- Toggle vuelta a la vista con tablas (/cliente/propuesta/:id).`,

  // ─────────────────────────── TICKETS ADMIN (MÚLTIPLES RUTAS) ───────────────────────────
  'Admin Tickets': `El usuario está en una de las pantallas administrativas de Tickets. Hay 4 pantallas distintas según rol:

1. /tickets (TicketsPage, pública para usuarios autenticados): formulario de alta de ticket (título, descripción, prioridad Baja/Normal/Alta/Urgente, captura opcional). Para TODOS los usuarios.

2. /admin/tickets-historial (HistorialTicketsPage, acceso TI y whitelist por email): historial exhaustivo de TODOS los tickets del sistema con filtros avanzados por área, estado, fecha, usuario y texto libre.

3. /dev/tickets (DevTicketsPage, equipo DEV): board interno del equipo DEV con prioridades, asignaciones, tiempos de respuesta y métricas de rendimiento. Solo visible para usuarios en el equipo DEV.

4. /admin/tickets-ranking (RankingTicketsPage, DEV y Admin): rankings de tickets resueltos por asesor/agente/tiempo de resolución. Dashboard competitivo del equipo de soporte.

5. /reportes-especiales (ReportesEspecialesPage, DEV/Admin): reportes personalizados que incluyen datos de tickets y métricas globales.

Si un usuario común te pregunta por 'tickets', dirígelo solo a /tickets. Si es DEV o TI, oriéntalo según la pantalla específica que necesite.`,

  // ─────────────────────────── ANÁLISIS COMPARTIDO DE OCUPACIÓN ───────────────────────────
  'Analisis Compartido de Ocupacion': `El usuario está en /inventarios/analisis/:analisisId, un link PÚBLICO que permite ver un análisis de ocupación sin tener permiso al módulo de Inventarios.

Se usa cuando Trafico/Dirección necesita compartir el análisis con alguien externo o con roles sin acceso directo a Inventarios.

ELEMENTOS:
- Encabezado: nombre del análisis, autor, fecha de generación.
- Tabla/mapa de ocupación por período y plaza.
- Métricas: espacios totales, ocupados, disponibles, % de ocupación por plaza.
- Filtros limitados (solo lectura).
- NO permite modificar inventario, solo visualizar.

El link se genera desde AnalisisOcupacionModal (dentro de Inventarios) por un rol con permiso al módulo.`,

  // ─────────────────────────── MANTENIMIENTO ───────────────────────────
  'Mantenimiento': `El usuario está en /mantenimiento, la pantalla de aviso que aparece cuando el sistema está en mantenimiento programado.
Mensaje al usuario explicando que el sistema está temporalmente fuera de servicio, con hora estimada de regreso (si está definida).
Botón 'Volver a intentar' para refrescar y verificar si el sistema ya está disponible.
Durante el mantenimiento TODAS las demás rutas redirigen aquí.`,

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
Campos editables:
- Foto de perfil: hover muestra ícono cámara. Acepta JPEG/JPG/PNG/GIF/WebP, máx 5 MB. Si no hay foto: avatar con inicial en degradado.
- Nombre completo: siempre editable.
- Teléfono: editable.
- Área y Puesto: SOLO editables por rol Administrador.
Campos NO editables: Correo electrónico (identificador de login). Para cambiarlo, contactar al administrador.

Cambiar contraseña: contraseña actual, nueva contraseña (mínimo 6 caracteres), confirmar. Botones ojo para mostrar/ocultar. Si se olvidó: usar 'Olvidé mi contraseña' en login o contactar al administrador.

Preferencias de Notificaciones (sección granular): por CADA tipo de tarea se puede activar/desactivar por canal:
- Email
- Push (navegador)
- SMS (si disponible)
Ejemplo: un asesor puede querer email de 'Seguimiento Campaña' pero push para 'Autorización DG'. Los Directores suelen activar push para 'Mis Autorizaciones' y 'Mis Notas'.`,

  // ─────────────────────────── ADMIN ───────────────────────────
  'Admin': `El usuario está en el panel de administración (solo roles Administrador, DEV y Gerente de Trafico para algunos sub-módulos).
Sub-módulos (rutas directas):
- /admin/usuarios: UsuariosAdminPage. CRUD de cuentas con CreateModal y EditModal. CASCADA obligatoria Área > Puesto > Rol: al elegir Área se filtran Puestos, al elegir Puesto se filtran Roles. El rol 'DEV' NUNCA se ofrece en la UI; solo se asigna por script. Desactivar vs Eliminar: eliminar es PERMANENTE, desactivar preserva historial.
- /admin/chatbot: Historial QEBooh. Log completo de conversaciones del chatbot con sesiones expandibles.
- /admin/tickets-historial: HistorialTicketsPage (TI/whitelist por email). Historial de todos los tickets del sistema con filtros avanzados.
- /admin/tickets-ranking: RankingTicketsPage (DEV y Admin). Rankings de tickets por asesor/agente/tiempo.
- /dev/tickets: DevTicketsPage (equipo DEV). Board interno del equipo DEV con prioridades, asignaciones y tiempos de respuesta.
- /reportes-especiales: ReportesEspecialesPage (DEV/Admin). Reportes personalizados.
- /historial-acciones: HistorialAccionesPage (Dirección, Admin, DEV). Auditoría exhaustiva (ver pantalla 'Historial de Acciones').`,

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
