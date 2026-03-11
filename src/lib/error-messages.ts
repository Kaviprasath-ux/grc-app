/**
 * User-friendly error messages for API responses.
 * Technical details are logged server-side only — never exposed to the client.
 */

/** Standard user-friendly messages by category */
export const USER_ERRORS = {
  // Generic
  GENERIC: 'Something went wrong. Please try again later.',
  NOT_FOUND: 'The requested resource was not found.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  FORBIDDEN: 'Access denied.',
  BAD_REQUEST: 'Invalid request. Please check your input and try again.',
  VALIDATION: 'Please check the form and correct any errors.',

  // Data operations
  FETCH_FAILED: 'Unable to load data. Please refresh the page and try again.',
  CREATE_FAILED: 'Unable to create the record. Please try again.',
  UPDATE_FAILED: 'Unable to update the record. Please try again.',
  DELETE_FAILED: 'Unable to delete the record. Please try again.',
  IMPORT_FAILED: 'Import failed. Please check your file format and try again.',

  // AI operations
  AI_SERVICE_UNAVAILABLE: 'AI service is temporarily unavailable. Please try again in a few minutes.',
  AI_PROCESSING_FAILED: 'AI processing encountered an issue. Please try again.',
  AI_JOB_SUBMIT_FAILED: 'Unable to submit the job. Please try again.',
  AI_STATUS_CHECK_FAILED: 'Unable to check the processing status. Please try again.',
  AI_RESULT_FAILED: 'Unable to retrieve the results. Please try again.',

  // File operations
  FILE_UPLOAD_FAILED: 'File upload failed. Please check the file and try again.',
  FILE_DOWNLOAD_FAILED: 'Unable to download the file. Please try again.',
  FILE_TOO_LARGE: 'The file is too large. Please reduce the file size and try again.',

  // External services
  EXTERNAL_SERVICE_ERROR: 'An external service is temporarily unavailable. Please try again later.',
  SCAN_SUBMIT_FAILED: 'Unable to submit the vendor scan. Please try again.',
  SCAN_STATUS_FAILED: 'Unable to check the scan status. Please try again.',

  // Reports
  REPORT_GENERATION_FAILED: 'Unable to generate the report. Please try again.',

  // Notifications
  NOTIFICATION_FAILED: 'Unable to send the notification. Please try again.',
} as const;

/**
 * Log the technical error server-side and return a user-friendly message.
 * Use this in catch blocks to avoid exposing internal details.
 */
export function safeError(error: unknown, context: string, userMessage?: string): string {
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`[${context}]`, msg);
  return userMessage || USER_ERRORS.GENERIC;
}
