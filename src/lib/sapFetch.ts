/**
 * fetch para las llamadas a SAP, con la sesión de QEB adjunta.
 *
 * Los catálogos de SAP ya no se piden a `sap.qeb.mx` desde el navegador: se
 * piden al backend de QEB (`/api/sap/...`), que es el único que habla con el
 * proxy. Por eso cada llamada tiene que llevar el token de sesión, igual que
 * cualquier otra llamada al backend.
 *
 * Es `fetch` a propósito, no el `api` de axios: los llamadores ya manejan
 * `response.ok`, `response.status` y `response.json()` a mano, y cambiarlos a
 * axios obligaría a reescribir todo ese manejo de errores.
 */
export async function sapFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = localStorage.getItem('accessToken');

  const headers = new Headers(init?.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(url, { ...init, headers });
}
