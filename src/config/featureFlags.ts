/**
 * Feature flags de la app. Permiten desactivar funcionalidad nueva sin quitar el
 * código, para poder mergear a main mientras se prueba en una rama.
 */

/**
 * Selección masiva de circuitos (checkboxes + barra "Eliminar seleccionados") en
 * los modales de solicitudes, propuestas y campañas.
 *
 * Ponlo en `true` para habilitarlo. Mientras esté en `false` se ocultan los
 * checkboxes y la barra de acciones masivas; el borrado individual (bote de
 * basura) sigue funcionando normal.
 */
export const BULK_DELETE_ENABLED = true;
