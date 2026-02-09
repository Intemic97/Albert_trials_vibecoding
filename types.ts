export type PropertyType = 'text' | 'number' | 'relation' | 'json' | 'file';

export type EntityType = 
  | 'generic'
  | 'plant'
  | 'equipment'
  | 'sensor'
  | 'material'
  | 'process'
  | 'safety';

export const ENTITY_TYPE_OPTIONS: { value: EntityType; label: string; iconName: string; description: string }[] = [
  { value: 'generic',   label: 'Generic',       iconName: 'Database',       description: 'General purpose entity' },
  { value: 'plant',     label: 'Plant / Area',   iconName: 'Factory',        description: 'Factory, plant, building, area' },
  { value: 'equipment', label: 'Equipment',      iconName: 'Gear',           description: 'Reactor, pump, valve, tank, motor' },
  { value: 'sensor',    label: 'Sensor',         iconName: 'Thermometer',    description: 'Sensor, instrument, meter, transmitter' },
  { value: 'material',  label: 'Material',       iconName: 'Flask',          description: 'Product, chemical, raw material, batch' },
  { value: 'process',   label: 'Process',        iconName: 'Lightning',      description: 'Process, operation, recipe, production' },
  { value: 'safety',    label: 'Safety',         iconName: 'ShieldCheck',    description: 'Alarm, inspection, incident, compliance' },
];

export interface Property {
  id: string;
  name: string;
  type: PropertyType;
  // If type is 'relation', this holds the ID of the related entity
  relatedEntityId?: string;
  // A sample value for visualization
  defaultValue?: string | number;
  // Unit for numeric properties (e.g. °C, bar, kg, m³/h, ppm)
  unit?: string;
  // Formula for calculated fields (e.g. "{Temperature} * 1.8 + 32")
  formula?: string;
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