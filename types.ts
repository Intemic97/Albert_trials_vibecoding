export type PropertyType = 'text' | 'number' | 'relation' | 'json' | 'file';

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
}

export type ViewState = 'list' | 'detail';