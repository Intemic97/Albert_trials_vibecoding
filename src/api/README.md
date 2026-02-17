# API layer

- **`client.ts`**: Cliente HTTP unificado. Usar `api.get<T>()`, `api.post<T>()`, `api.put<T>()`, `api.delete()` en lugar de `fetch(API_BASE + ...)`. Incluye base URL, `credentials: 'include'`, y manejo de 401 (emite `API_UNAUTHORIZED_EVENT`) y errores (lanza `ApiError` con status y mensaje).
- **`types.ts`**: DTOs compartidos para requests/respuestas (Entity, Record, Folder, Document, etc.). Útiles para tipar llamadas y documentar el contrato con el backend.

Uso:

```ts
import { api, ApiError, API_UNAUTHORIZED_EVENT } from '@/src/api';
import type { EntityDto, KnowledgeFolderDto } from '@/src/api';

const data = await api.get<EntityDto[]>('entities');
await api.post('entities', { name: 'New', properties: [] });
```

Para subida de archivos (FormData): `api.request('path', { method: 'POST', body: formData })`.

**Nota:** La carpeta está en `src/api/` para que Vite sirva estos módulos bajo `/src/api/...` y el proxy `/api` no los envíe al backend.
