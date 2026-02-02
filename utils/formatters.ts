/**
 * Utilidades de formateo generales
 * 
 * Funciones para formatear números, strings y otros datos
 */

/**
 * Formatea un número con separadores de miles
 * 
 * @param num - Número a formatear
 * @param decimals - Número de decimales (default: 0)
 * @returns String formateado
 * 
 * @example
 * formatNumber(1234567); // "1,234,567"
 * formatNumber(1234.567, 2); // "1,234.57"
 */
export const formatNumber = (num: number | null | undefined, decimals = 0): string => {
  if (num === null || num === undefined) return '-';
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

/**
 * Formatea un número como porcentaje
 * 
 * @param value - Valor (0-1 o 0-100 según isNormalized)
 * @param decimals - Número de decimales
 * @param isNormalized - Si el valor está normalizado (0-1)
 * @returns String con formato de porcentaje
 * 
 * @example
 * formatPercent(0.75); // "75%"
 * formatPercent(75, 1, false); // "75.0%"
 */
export const formatPercent = (
  value: number | null | undefined, 
  decimals = 0, 
  isNormalized = true
): string => {
  if (value === null || value === undefined) return '-';
  const percent = isNormalized ? value * 100 : value;
  return `${percent.toFixed(decimals)}%`;
};

/**
 * Formatea bytes a unidad legible
 * 
 * @param bytes - Número de bytes
 * @param decimals - Número de decimales
 * @returns String con unidad apropiada
 * 
 * @example
 * formatBytes(1024); // "1 KB"
 * formatBytes(1048576); // "1 MB"
 */
export const formatBytes = (bytes: number | null | undefined, decimals = 1): string => {
  if (bytes === null || bytes === undefined || bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
};

/**
 * Formatea un número como moneda
 * 
 * @param amount - Cantidad
 * @param currency - Código de moneda (default: EUR)
 * @param locale - Locale (default: es-ES)
 * @returns String formateado como moneda
 * 
 * @example
 * formatCurrency(1234.56); // "1.234,56 €"
 * formatCurrency(1234.56, 'USD', 'en-US'); // "$1,234.56"
 */
export const formatCurrency = (
  amount: number | null | undefined,
  currency = 'EUR',
  locale = 'es-ES'
): string => {
  if (amount === null || amount === undefined) return '-';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
};

/**
 * Trunca un string a una longitud máxima
 * 
 * @param str - String a truncar
 * @param maxLength - Longitud máxima
 * @param suffix - Sufijo a añadir (default: "...")
 * @returns String truncado
 * 
 * @example
 * truncateString("Hello World", 8); // "Hello..."
 */
export const truncateString = (
  str: string | null | undefined,
  maxLength: number,
  suffix = '...'
): string => {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - suffix.length) + suffix;
};

/**
 * Capitaliza la primera letra de un string
 * 
 * @param str - String a capitalizar
 * @returns String con primera letra mayúscula
 * 
 * @example
 * capitalize("hello world"); // "Hello world"
 */
export const capitalize = (str: string | null | undefined): string => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

/**
 * Convierte a title case (primera letra de cada palabra en mayúscula)
 * 
 * @param str - String a convertir
 * @returns String en title case
 * 
 * @example
 * toTitleCase("hello world"); // "Hello World"
 */
export const toTitleCase = (str: string | null | undefined): string => {
  if (!str) return '';
  return str.replace(/\w\S*/g, (txt) => 
    txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()
  );
};

/**
 * Convierte camelCase a texto legible
 * 
 * @param str - String en camelCase
 * @returns String con espacios
 * 
 * @example
 * camelToReadable("firstName"); // "First Name"
 */
export const camelToReadable = (str: string | null | undefined): string => {
  if (!str) return '';
  return str
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
};

/**
 * Convierte snake_case a texto legible
 * 
 * @param str - String en snake_case
 * @returns String con espacios y capitalizado
 * 
 * @example
 * snakeToReadable("first_name"); // "First Name"
 */
export const snakeToReadable = (str: string | null | undefined): string => {
  if (!str) return '';
  return str
    .split('_')
    .map(word => capitalize(word))
    .join(' ');
};

/**
 * Genera iniciales de un nombre
 * 
 * @param name - Nombre completo
 * @param maxInitials - Máximo de iniciales (default: 2)
 * @returns Iniciales
 * 
 * @example
 * getInitials("John Doe"); // "JD"
 * getInitials("John Michael Doe", 3); // "JMD"
 */
export const getInitials = (
  name: string | null | undefined,
  maxInitials = 2
): string => {
  if (!name) return '';
  return name
    .split(' ')
    .filter(word => word.length > 0)
    .slice(0, maxInitials)
    .map(word => word[0].toUpperCase())
    .join('');
};

/**
 * Pluraliza una palabra según cantidad
 * 
 * @param count - Cantidad
 * @param singular - Forma singular
 * @param plural - Forma plural (default: singular + 's')
 * @returns String con número y palabra pluralizada
 * 
 * @example
 * pluralize(1, "item"); // "1 item"
 * pluralize(5, "item"); // "5 items"
 * pluralize(5, "child", "children"); // "5 children"
 */
export const pluralize = (
  count: number,
  singular: string,
  plural?: string
): string => {
  const word = count === 1 ? singular : (plural || `${singular}s`);
  return `${count} ${word}`;
};

/**
 * Formatea un array como lista legible
 * 
 * @param items - Array de strings
 * @param conjunction - Conjunción (default: "and")
 * @returns String con items separados por comas y conjunción
 * 
 * @example
 * formatList(["a", "b", "c"]); // "a, b and c"
 * formatList(["a", "b", "c"], "or"); // "a, b or c"
 */
export const formatList = (
  items: string[],
  conjunction = 'and'
): string => {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} ${conjunction} ${items[1]}`;
  
  const last = items.pop();
  return `${items.join(', ')} ${conjunction} ${last}`;
};
