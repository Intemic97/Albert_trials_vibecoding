# Patrones de UX

> Confirmaciones destructivas, estados de carga y error en flujos críticos.

## 1. Confirmaciones destructivas

**Objetivo**: No usar `window.confirm()`. Usar el mismo componente (`ConfirmDialog`) y mensajes con i18n.

**Cómo**:
- Hook **`useDestructiveConfirm`** (en `hooks/useDestructiveConfirm.tsx`).
- Devuelve `confirmDestructive({ title, description? })` que resuelve `true`/`false`.
- Renderizar `<DestructiveConfirmDialog />` una vez en el árbol (p. ej. en el layout o en el componente que dispara las acciones).

**Ejemplo**:
```tsx
const { confirmDestructive, DestructiveConfirmDialog } = useDestructiveConfirm();

const handleDelete = async (item: Item) => {
  const ok = await confirmDestructive({
    title: t('messages.confirmDelete', { name: item.name }),
    description: t('messages.confirmDeleteDescription'),
  });
  if (!ok) return;
  try {
    await api.delete(`items/${item.id}`);
    success('Deleted');
  } catch (e) {
    showError('Failed to delete');
  }
};

// En el JSX:
return (
  <>
    {/* ... */}
    <DestructiveConfirmDialog />
  </>
);
```

**Textos**: Usar claves i18n (p. ej. `knowledgeBase.confirmDeleteEntity`) para título y descripción.

---

## 2. Flujos críticos: carga y error

**Objetivo**: Patrón claro en crear entidad, ejecutar workflow, subir CSV, etc.: spinner + mensaje mientras carga; en error, mensaje claro + opción de reintentar.

**Patrón**:
1. **Cargando**: Mostrar spinner (p. ej. `SpinnerGap`) y un texto breve (“Creando…”, “Subiendo…”, “Ejecutando…”).
2. **Éxito**: Toast de éxito (ya se usa `success()` de `useNotifications`).
3. **Error**: Toast de error con `showError()`. En pantallas donde el usuario permanece en el mismo formulario, opcionalmente un botón “Reintentar” que vuelve a lanzar la misma acción.

**Implementación**:
- El estado `loading` (o `isSubmitting`) ya se usa en muchos sitios; mantenerlo y bloquear el botón o el formulario mientras sea `true`.
- En catch: `showError(mensaje)`; si tiene sentido, guardar en estado `lastError` y mostrar un botón “Reintentar” que llame de nuevo a la función y limpie `lastError`.

**Ejemplo mínimo**:
```tsx
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

const doSubmit = async () => {
  setLoading(true);
  setError(null);
  try {
    await api.post('...', data);
    success('Saved');
  } catch (e) {
    const msg = e instanceof ApiError ? e.message : 'Request failed';
    setError(msg);
    showError(msg);
  } finally {
    setLoading(false);
  }
};

// En UI: botón deshabilitado si loading; si error, mostrar mensaje + botón "Reintentar" que llama a doSubmit.
```

No es obligatorio un hook `useCriticalFlow`; con estado local `loading` + `error` y el toast es suficiente. Si se quiere reutilizar, se puede extraer un hook que devuelva `{ run, loading, error, retry }`.
