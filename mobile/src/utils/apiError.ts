/**
 * Extracts a human-readable error message from any Axios / backend error.
 * Returns null when there is no error.
 *
 * Backend sends: { success: false, error: { code, message, details?: [{field, message}] } }
 * Validation errors carry a `details` array — we join those messages so the user
 * sees which specific field(s) failed instead of the generic "Validation failed".
 */
export function parseApiError(error: unknown): string | null {
  if (!error) return null;

  const err = error as any;

  // Structured backend error (response received)
  const backendError = err?.response?.data?.error;
  if (backendError) {
    // Validation error with field-level detail
    if (Array.isArray(backendError.details) && backendError.details.length > 0) {
      return backendError.details.map((d: any) => d.message as string).join('\n');
    }
    // Any other backend message (business rule, auth, not found, etc.)
    if (backendError.message) return backendError.message as string;
  }

  // No response at all = connectivity issue
  if (!err?.response) {
    if (err?.code === 'ECONNABORTED') return 'Request timed out. Please try again.';
    return 'No internet connection. Check your network and try again.';
  }

  return 'Something went wrong. Please try again.';
}
