export type PropertyType = 'text' | 'number' | 'relation' | 'json' | 'file';

export type EntityType = 
  | 'generic'
  | 'plant'
  | 'equipment'
  | 'sensor'
  | 'material'
  | 'process'
  | 'safety';

export const ENTITY_TYPE_OPTIONS: { value: EntityType; label: string; icon: string; description: string }[] = [
  { value: 'generic',   label: 'Generic',       icon: '📋', description: 'General purpose entity' },
  { value: 'plant',     label: 'Plant / Area',   icon: '🏭', description: 'Factory, plant, building, area' },
  { value: 'equipment', label: 'Equipment',      icon: '⚙️', description: 'Reactor, pump, valve, tank, motor' },
  { value: 'sensor',    label: 'Sensor',         icon: '📡', description: 'Sensor, instrument, meter, transmitter' },
  { value: 'material',  label: 'Material',       icon: '🧪', description: 'Product, chemical, raw material, batch' },
  { value: 'process',   label: 'Process',        icon: '⚡', description: 'Process, operation, recipe, production' },
  { value: 'safety',    label: 'Safety',         icon: '🛡️', description: 'Alarm, inspection, incident, compliance' },
];

export interface Property {
  id: string;
  name: string;
  type: PropertyType;
  // If type is 'relation', this holds the ID of the related entity
  relatedEntityId?: string;
  // A sample value for visualization
  defaultValue?: string | number;
}

export interface Entity {
  id: string;
  name: string;
  description: string;
  lastEdited: string;
  author: string;
  properties: Property[];
  entityType?: EntityType;
}

export type ViewState = 'list' | 'detail';