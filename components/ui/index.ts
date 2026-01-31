/**
 * UI Components Library
 * 
 * Biblioteca de componentes reutilizables con diseño consistente.
 * Todos los componentes soportan el sistema de temas (light/dark mode).
 * 
 * @example
 * import { Button, Card, Input, Modal } from '@/components/ui';
 * 
 * @example
 * import { 
 *   Badge, StatusBadge,
 *   Dropdown, Menu,
 *   Toast, ToastContainer,
 *   Tabs, TabsList
 * } from '@/components/ui';
 */

// ============================================================================
// CORE COMPONENTS
// ============================================================================

// Button - Botones con variantes y estados
export { Button } from './Button';
export type { ButtonVariant, ButtonSize } from './Button';

// Card - Contenedores de contenido
export { Card, CardHeader, CardFooter } from './Card';
export type { CardVariant, CardPadding } from './Card';

// Input - Campos de formulario
export { Input, Textarea, Select } from './Input';
export type { InputSize } from './Input';

// Modal - Diálogos y ventanas modales
export { Modal, ConfirmDialog } from './Modal';
export type { ModalSize } from './Modal';

// ============================================================================
// DISPLAY COMPONENTS
// ============================================================================

// Badge - Etiquetas y estados
export { Badge, StatusBadge, Tag } from './Badge';
export type { BadgeVariant, BadgeSize, StatusType } from './Badge';

// EmptyState - Estados vacíos
export { EmptyState, InlineEmptyState } from './EmptyState';
export type { EmptyStateType } from './EmptyState';

// Skeleton - Loaders y placeholders
export { 
  Skeleton, 
  SkeletonText, 
  SkeletonCard, 
  SkeletonWorkflowCard,
  SkeletonTable, 
  SkeletonList, 
  SkeletonSidebar,
  SkeletonPage 
} from './Skeleton';

// Tooltip - Información contextual
export { Tooltip, TooltipTrigger } from './Tooltip';

// ============================================================================
// NAVIGATION COMPONENTS
// ============================================================================

// Dropdown - Menús desplegables
export { 
  Dropdown, 
  SelectDropdown, 
  Menu, 
  MenuItem, 
  MenuDivider 
} from './Dropdown';

// Tabs - Navegación por pestañas
export { 
  Tabs, 
  TabsList, 
  TabsTrigger, 
  TabsContent, 
  SimpleTabs 
} from './TabsUI';

// ============================================================================
// FEEDBACK COMPONENTS
// ============================================================================

// Toast - Notificaciones
export { Toast, ToastContainer, showToast } from './Toast';

// ============================================================================
// LAYOUT COMPONENTS
// ============================================================================

// SidePanel - Panel lateral deslizante
export { 
  SidePanel, 
  SidePanelContent, 
  SidePanelSection, 
  SidePanelDivider 
} from './SidePanel';
export type { SidePanelSize, SidePanelPosition } from './SidePanel';
