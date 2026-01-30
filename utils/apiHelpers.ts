/**
 * Utilidades para llamadas a API
 * 
 * Centraliza helpers comunes para fetch y manejo de respuestas
 */

/**
 * Interfaz para respuestas de error de la API
 */
export interface ApiErrorResponse {
  error: string;
  requiresVerification?: boolean;
  email?: string;
}

/**
 * Parsea la respuesta de un fetch, manejando tanto JSON como texto plano
 * 
 * @param res - Response del fetch
 * @returns Objeto parseado o error
 * 
 * @example
 * const res = await fetch('/api/endpoint');
 * const data = await parseResponse(res);
 */
export const parseResponse = async <T = unknown>(res: Response): Promise<T | ApiErrorResponse> => {
  const contentType = res.headers.get('content-type') || '';
  
  if (contentType.includes('application/json')) {
    try {
      return await res.json() as T;
    } catch (error) {
      return { error: 'Respuesta JSON inválida del servidor.' };
    }
  }
  
  const text = await res.text();
  return text ? { error: text } : { error: 'Respuesta vacía del servidor.' };
};

/**
 * Realiza una llamada fetch con configuración estándar
 * 
 * @param url - URL del endpoint
 * @param options - Opciones adicionales de fetch
 * @returns Response del fetch
 */
export const apiFetch = async (
  url: string, 
  options: RequestInit = {}
): Promise<Response> => {
  const defaultOptions: RequestInit = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };
  
  return fetch(url, { ...defaultOptions, ...options });
};

/**
 * Realiza una llamada GET
 */
export const apiGet = async <T>(url: string): Promise<T> => {
  const res = await apiFetch(url);
  if (!res.ok) {
    const error = await parseResponse<ApiErrorResponse>(res);
    throw new Error((error as ApiErrorResponse).error || 'Request failed');
  }
  return res.json();
};

/**
 * Realiza una llamada POST
 */
export const apiPost = async <T>(url: string, body: unknown): Promise<T> => {
  const res = await apiFetch(url, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const error = await parseResponse<ApiErrorResponse>(res);
    throw new Error((error as ApiErrorResponse).error || 'Request failed');
  }
  return res.json();
};

/**
 * Realiza una llamada PUT
 */
export const apiPut = async <T>(url: string, body: unknown): Promise<T> => {
  const res = await apiFetch(url, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const error = await parseResponse<ApiErrorResponse>(res);
    throw new Error((error as ApiErrorResponse).error || 'Request failed');
  }
  return res.json();
};

/**
 * Realiza una llamada DELETE
 */
export const apiDelete = async <T>(url: string): Promise<T> => {
  const res = await apiFetch(url, { method: 'DELETE' });
  if (!res.ok) {
    const error = await parseResponse<ApiErrorResponse>(res);
    throw new Error((error as ApiErrorResponse).error || 'Request failed');
  }
  return res.json();
};
