import api from './api';

/**
 * Ligas de propuesta que se comparten con el cliente.
 *
 * Antes la liga era `/cliente/propuesta/123` y el endpoint público aceptaba el
 * id tal cual: como el id es consecutivo, cualquiera podía recorrer desde 1 y
 * leer cliente, precio e inventario de todas las propuestas. Ahora la liga
 * lleva un token firmado por el backend (`?t=`), con caducidad.
 *
 * Quien tiene sesión pide el token con `pedirShareToken`. Las vistas de
 * cliente (que corren sin sesión) toman el token de su propia URL con
 * `shareTokenDeUrl` y lo arrastran a las peticiones y a las ligas que generan.
 */

/** Lee el token de la URL actual (o de un query string dado). */
export function shareTokenDeUrl(search?: string): string | null {
  const sp = new URLSearchParams(search ?? window.location.search);
  const t = sp.get('t');
  return t && t.length > 0 ? t : null;
}

/** Agrega `t=` a una URL, respetando si ya traía query string. */
export function conShareToken(url: string, token: string | null | undefined): string {
  if (!token) return url;
  return `${url}${url.includes('?') ? '&' : '?'}t=${encodeURIComponent(token)}`;
}

/** Pide al backend un token firmado para la propuesta. Requiere sesión. */
export async function pedirShareToken(propuestaId: number): Promise<string> {
  const { data } = await api.get<{ success: boolean; data: { token: string } }>(
    `/propuestas/${propuestaId}/share-link`
  );
  return data.data.token;
}
