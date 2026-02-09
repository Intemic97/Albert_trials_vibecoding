const rawApiBase = import.meta.env.VITE_API_BASE || '/api';
const normalizedApiBase = rawApiBase.startsWith('http')
  ? rawApiBase
  : rawApiBase.startsWith('/')
    ? rawApiBase
    : `/${rawApiBase}`;

// Avoid accidental double trailing slash while preserving root "/"
export const API_BASE =
  normalizedApiBase.length > 1 && normalizedApiBase.endsWith('/')
    ? normalizedApiBase.slice(0, -1)
    : normalizedApiBase;

