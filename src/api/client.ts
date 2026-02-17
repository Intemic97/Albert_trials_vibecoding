/**
 * Central API client: base URL, credentials, unified 401/error handling.
 * Use api.get<T>(), api.post<T>(), api.put<T>(), api.delete() instead of raw fetch(API_BASE + ...).
 */

import { API_BASE } from '../../config';

export const API_UNAUTHORIZED_EVENT = 'api:unauthorized';

export class ApiError extends Error {
    constructor(
        message: string,
        public status: number,
        public body?: unknown
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

function buildUrl(path: string): string {
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${API_BASE}${p}`;
}

async function parseErrorResponse(res: Response): Promise<{ message: string; body?: unknown }> {
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        try {
            const data = await res.json();
            const message = typeof data?.error === 'string' ? data.error : res.statusText || 'Request failed';
            return { message, body: data };
        } catch {
            return { message: res.statusText || 'Request failed' };
        }
    }
    const text = await res.text();
    return { message: text || res.statusText || 'Request failed', body: text };
}

export interface RequestOptions extends Omit<RequestInit, 'credentials'> {
    /** Skip parsing JSON on success (return undefined for 204/empty) */
    skipJson?: boolean;
}

/**
 * Low-level request. Uses API_BASE, always sends credentials: 'include'.
 * On 401 dispatches API_UNAUTHORIZED_EVENT and throws ApiError.
 * On !res.ok throws ApiError with status and server message.
 */
export async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
    const { skipJson, ...init } = options;
    const url = buildUrl(path);
    const body = init.body;
    const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
    if (body != null && !(body instanceof FormData) && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(url, {
        ...init,
        credentials: 'include',
        headers,
    });

    if (res.status === 401) {
        window.dispatchEvent(new CustomEvent(API_UNAUTHORIZED_EVENT));
        const { message } = await parseErrorResponse(res);
        throw new ApiError(message || 'Unauthorized', 401);
    }

    if (!res.ok) {
        const { message, body } = await parseErrorResponse(res);
        throw new ApiError(message, res.status, body);
    }

    if (res.status === 204 || res.headers.get('content-length') === '0') {
        return undefined as T;
    }

    if (skipJson) {
        return undefined as T;
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
        return (await res.text()) as T;
    }

    return res.json() as Promise<T>;
}

export const api = {
    get<T = unknown>(path: string, init?: RequestInit): Promise<T> {
        return request<T>(path, { ...init, method: 'GET' });
    },

    post<T = unknown>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
        return request<T>(path, { ...init, method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined });
    },

    put<T = unknown>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
        return request<T>(path, { ...init, method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined });
    },

    delete(path: string, init?: RequestInit): Promise<void> {
        return request<void>(path, { ...init, method: 'DELETE', skipJson: true });
    },

    /** Raw request for file uploads (FormData) etc. Caller can override headers. */
    request<T = unknown>(path: string, options?: RequestOptions): Promise<T> {
        return request<T>(path, options);
    },
};

export default api;
