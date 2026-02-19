// Shared validation helpers for form inputs across the GRC application

// For name/title/label fields - allows letters (any language), spaces, hyphens, dots
export const isValidName = (str: string): boolean => {
  if (!str.trim()) return true; // empty handled by required checks
  return /^[\p{L}\s.\-]+$/u.test(str);
};

// For name fields that also allow numbers (e.g., risk names) - letters, numbers, spaces, hyphens, dots
export const isValidNameWithNumbers = (str: string): boolean => {
  if (!str.trim()) return true; // empty handled by required checks
  return /^[\p{L}\d\s.\-]+$/u.test(str);
};

// For strict digit-only fields (phone numbers, IDs)
export const isNumericOnly = (str: string): boolean => {
  if (!str && str !== "0") return true;
  return /^\d+$/.test(str);
};

// For score fields that may need decimals/negatives
export const isValidNumber = (value: string | number): boolean => {
  if (value === "" || value === null || value === undefined) return true;
  return !isNaN(Number(value));
};

// For person name fields (no numbers)
export const isAlphaWithSpaces = (str: string): boolean => {
  if (!str.trim()) return true;
  return /^[\p{L}\s]+$/u.test(str);
};

// For username fields
export const isAlphanumeric = (str: string): boolean => {
  if (!str.trim()) return true;
  return /^[a-zA-Z0-9_]+$/.test(str);
};
