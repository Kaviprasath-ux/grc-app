const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates an email string. Returns an error message key (for i18n) or null if valid.
 * Checks: empty, contains spaces, format regex.
 */
export function validateEmail(email: string): string | null {
  if (!email.trim()) {
    return "Please Enter the Email";
  }
  if (/\s/.test(email)) {
    return "Email must not contain spaces";
  }
  if (!EMAIL_REGEX.test(email)) {
    return "Invalid email format";
  }
  return null;
}

/**
 * Returns true if the email has a valid format. For backend use.
 */
export function isValidEmailFormat(email: string): boolean {
  return EMAIL_REGEX.test(email) && !/\s/.test(email);
}
