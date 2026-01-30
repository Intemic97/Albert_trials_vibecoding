# Guía del Sistema de Temas (Dark Mode)

## Resumen

Este proyecto implementa un sistema de temas completo con soporte para modo claro, oscuro y preferencia del sistema. El diseño oscuro está inspirado en Notion.

## Archivos del Sistema

```
├── theme.ts                    # Tokens de color (light + dark)
├── context/ThemeContext.tsx    # Contexto y hooks de React
├── index.html                  # Variables CSS globales
└── THEME_GUIDE.md              # Esta guía
```

## Uso Básico

### 1. Usar Variables CSS (Recomendado)

Las variables CSS están disponibles globalmente y cambian automáticamente con el tema:

```tsx
// En className (con Tailwind arbitrary values)
<div className="bg-[var(--bg-primary)] text-[var(--text-primary)]">
  Contenido
</div>

// En style
<div style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)' }}>
  Contenido
</div>
```

### 2. Usar el Hook useTheme

```tsx
import { useTheme } from '../context/ThemeContext';

function MyComponent() {
  const { mode, setMode, isDark, toggleTheme } = useTheme();
  
  return (
    <button onClick={toggleTheme}>
      {isDark ? 'Cambiar a claro' : 'Cambiar a oscuro'}
    </button>
  );
}
```

## Variables CSS Disponibles

### Fondos
| Variable | Light | Dark | Uso |
|----------|-------|------|-----|
| `--bg-primary` | #F8F8F8 | #191919 | Fondo principal de la app |
| `--bg-secondary` | #FFFFFF | #202020 | Fondo de cards elevadas |
| `--bg-tertiary` | #F0F0F0 | #2F2F2F | Fondo de elementos secundarios |
| `--bg-card` | #FFFFFF | #252525 | Cards y contenedores |
| `--bg-modal` | #FFFFFF | #252525 | Modales |
| `--bg-input` | #FFFFFF | #2F2F2F | Campos de formulario |
| `--bg-hover` | rgba(0,0,0,0.03) | rgba(255,255,255,0.03) | Estado hover |
| `--bg-active` | rgba(0,0,0,0.05) | rgba(255,255,255,0.05) | Estado activo |
| `--bg-selected` | #464545 | #37352F | Elementos seleccionados |

### Texto
| Variable | Light | Dark | Uso |
|----------|-------|------|-----|
| `--text-primary` | #37352F | #E8E8E8 | Texto principal |
| `--text-secondary` | #6B6B6B | #A0A0A0 | Texto secundario |
| `--text-tertiary` | #9B9B9B | #6B6B6B | Texto terciario/placeholders |
| `--text-muted` | #B4B4B4 | #505050 | Texto muy sutil |
| `--text-inverse` | #FFFFFF | #191919 | Texto sobre fondos oscuros/claros |
| `--text-on-selected` | #F8F8F8 | #E8E8E8 | Texto sobre elementos seleccionados |

### Bordes
| Variable | Light | Dark | Uso |
|----------|-------|------|-----|
| `--border-light` | #E8E8E8 | #333333 | Bordes sutiles |
| `--border-medium` | #D0D0D0 | #404040 | Bordes normales |
| `--border-dark` | #B0B0B0 | #505050 | Bordes prominentes |
| `--border-focus` | #464545 | #5C5C5C | Bordes en estado focus |

### Sidebar
| Variable | Uso |
|----------|-----|
| `--sidebar-bg` | Fondo del sidebar |
| `--sidebar-text` | Texto del sidebar |
| `--sidebar-text-hover` | Texto en hover |
| `--sidebar-text-active` | Texto activo/seleccionado |
| `--sidebar-bg-hover` | Fondo en hover |
| `--sidebar-bg-active` | Fondo activo/seleccionado |
| `--sidebar-border` | Bordes del sidebar |
| `--sidebar-icon` | Color de iconos |
| `--sidebar-icon-active` | Color de iconos activos |
| `--sidebar-section-label` | Labels de sección |

### Acentos
| Variable | Light | Dark | Uso |
|----------|-------|------|-----|
| `--accent-primary` | #2383E2 | #529CCA | Color principal de acción |
| `--accent-success` | #0F766E | #2DD4BF | Éxito/confirmación |
| `--accent-warning` | #D97706 | #FBBF24 | Advertencia |
| `--accent-error` | #DC2626 | #F87171 | Error |
| `--accent-info` | #0EA5E9 | #38BDF8 | Información |

### Otros
| Variable | Uso |
|----------|-----|
| `--shadow-sm` | Sombra pequeña |
| `--shadow-md` | Sombra mediana |
| `--shadow-lg` | Sombra grande |
| `--logo-filter` | Filtro CSS para el logo |
| `--theme-transition` | Transición para cambios de tema |

## Migración de Componentes

### Antes (colores hardcodeados)
```tsx
<div className="bg-white border-slate-200 text-slate-700">
  <h1 className="text-slate-800">Título</h1>
  <p className="text-slate-500">Descripción</p>
</div>
```

### Después (con variables de tema)
```tsx
<div className="bg-[var(--bg-card)] border-[var(--border-light)] text-[var(--text-primary)]">
  <h1 className="text-[var(--text-primary)]">Título</h1>
  <p className="text-[var(--text-secondary)]">Descripción</p>
</div>
```

## Mapeo de Colores Tailwind a Variables

| Tailwind Class | Variable CSS |
|----------------|--------------|
| `bg-white` | `bg-[var(--bg-card)]` |
| `bg-slate-50` | `bg-[var(--bg-tertiary)]` |
| `bg-[#F8F8F8]` | `bg-[var(--bg-primary)]` |
| `text-slate-700` | `text-[var(--text-primary)]` |
| `text-slate-500` | `text-[var(--text-secondary)]` |
| `text-slate-400` | `text-[var(--text-tertiary)]` |
| `border-slate-200` | `border-[var(--border-light)]` |
| `border-slate-300` | `border-[var(--border-medium)]` |

## Toggle de Tema

El toggle de tema está disponible en **Settings > General > Appearance**. Opciones:
- **Light**: Modo claro
- **Dark**: Modo oscuro  
- **System**: Sigue la preferencia del sistema operativo

## Persistencia

La preferencia del usuario se guarda en `localStorage` con la clave `intemic-theme-mode`.

## Transiciones

Todos los cambios de tema incluyen una transición suave de 200ms para:
- `background-color`
- `color`
- `border-color`

Usa la clase `transition-colors duration-200` para elementos que deben animar.

## Testing

Para probar el dark mode:
1. Ve a Settings > General
2. Selecciona "Dark" en Appearance
3. Verifica que todos los elementos cambien correctamente
4. Prueba "System" y cambia la preferencia del OS
