/**
 * API layer: client and shared types.
 * Usage:
 *   import { api, ApiError, API_UNAUTHORIZED_EVENT } from '@/src/api';
 *   import type { EntityDto, EntityRecordDto, KnowledgeFolderDto } from '@/src/api';
 */

export { api, request, ApiError, API_UNAUTHORIZED_EVENT } from './client';
export type { RequestOptions } from './client';
export * from './types';
