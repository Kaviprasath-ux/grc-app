// Shared validation helpers for form inputs across the GRC application

// For name/title/label fields - allows letters, numbers, spaces, hyphens
export const isValidName = (str: string): boolean => {
  if (!str.trim()) return true; // empty handled by required checks
  return /^[a-zA-Z0-9\s\-]+$/.test(str);
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
  return /^[a-zA-Z\s]+$/.test(str);
};

// For username fields
export const isAlphanumeric = (str: string): boolean => {
  if (!str.trim()) return true;
  return /^[a-zA-Z0-9_]+$/.test(str);
};
