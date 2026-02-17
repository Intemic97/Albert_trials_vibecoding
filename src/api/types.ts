/**
 * Shared API DTOs: request/response shapes for resources.
 * Use these in the frontend and keep the contract clear; backend (JS) can follow the same shapes.
 */

// Re-export domain types that match API responses
export type { Entity, Property, EntityType, PropertyType } from '../../types';

// --- Entities ---

export interface EntityDto {
    id: string;
    name: string;
    description?: string;
    lastEdited?: string;
    author?: string;
    entityType?: string;
    properties: PropertyDto[];
}

export interface PropertyDto {
    id: string;
    name: string;
    type: string;
    relatedEntityId?: string | null;
    defaultValue?: string | number;
    unit?: string | null;
    formula?: string | null;
}

export interface CreateEntityBody {
    id?: string;
    name: string;
    description?: string;
    entityType?: string;
    author?: string;
    lastEdited?: string;
    properties?: { id: string; name: string; type: string; defaultValue?: string }[];
}

export interface UpdateEntityBody {
    name?: string;
    description?: string;
    entityType?: string;
}

// --- Records ---

export interface EntityRecordDto {
    id: string;
    entityId: string;
    values: Record<string, string>;
    createdAt?: string;
    updatedAt?: string;
}

export interface CreateRecordBody {
    values: Record<string, string>;
}

export interface CreateRecordsBody {
    records?: CreateRecordBody[];
}

// --- Knowledge Base ---

export interface KnowledgeFolderDto {
    id: string;
    name: string;
    description?: string | null;
    color?: string | null;
    parentId?: string | null;
    documentIds: string[];
    entityIds: string[];
    createdAt: string;
    updatedAt: string;
    createdBy: string;
}

export interface KnowledgeDocumentDto {
    id: string;
    name: string;
    type: string;
    size: number;
    summary?: string | null;
    tags?: string[] | null;
    createdAt: string;
    folderId?: string | null;
}

export interface CreateFolderBody {
    name: string;
    description?: string;
    color?: string;
    parentId?: string | null;
    documentIds?: string[];
    entityIds?: string[];
    createdBy?: string;
}

export interface UpdateFolderBody {
    name?: string;
    description?: string;
    color?: string;
    parentId?: string | null;
}

export interface FolderAddRemoveBody {
    type: 'entity' | 'document';
    itemId: string;
}

// --- Auth (for reference) ---

export interface UserDto {
    id: string;
    name: string;
    email: string;
    orgId: string;
    profilePhoto?: string;
    companyRole?: string;
    locale?: 'es' | 'en';
    isAdmin?: boolean;
    onboardingCompleted?: boolean;
}

export interface AuthMeResponse {
    user: UserDto;
}

// --- Generic API responses ---

export interface MessageResponse {
    message: string;
}

export interface IdResponse {
    id: string;
}
