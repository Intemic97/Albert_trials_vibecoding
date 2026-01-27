/**
 * Utilidad para generar UUIDs
 * 
 * Soporta tanto crypto.randomUUID() (HTTPS) como fallback
 * para contextos HTTP usando algoritmo compatible con UUID v4
 */

/**
 * Genera un UUID v4 compatible
 * 
 * @returns UUID string en formato xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 * 
 * @example
 * ```ts
 * const id = generateUUID();
 * console.log(id); // "550e8400-e29b-41d4-a716-446655440000"
 * ```
 */
export const generateUUID = (): string => {
  // Usar crypto.randomUUID() si está disponible (requiere HTTPS o localhost)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch (error) {
      // Fallback si falla por alguna razón
      console.warn('crypto.randomUUID() failed, using fallback', error);
    }
  }
  
  // Fallback para contextos HTTP o cuando crypto.randomUUID no está disponible
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Valida si una cadena es un UUID válido
 * 
 * @param uuid - Cadena a validar
 * @returns true si es un UUID válido
 * 
 * @example
 * ```ts
 * isValidUUID('550e8400-e29b-41d4-a716-446655440000'); // true
 * isValidUUID('invalid'); // false
 * ```
 */
export const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};
