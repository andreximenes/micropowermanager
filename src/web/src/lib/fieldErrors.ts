import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

import { ApiError } from '@/api/client';

/** Puts Laravel's 422 messages next to the form fields they belong to, keyed by request field. */
export function showFieldErrors<T extends FieldValues>(
  error: Error,
  setError: UseFormSetError<T>,
  fieldOf: Record<string, Path<T>>,
): void {
  if (!(error instanceof ApiError)) {
    return;
  }
  for (const [field, messages] of Object.entries(error.fieldErrors)) {
    const formField = fieldOf[field];
    if (formField && messages[0]) {
      setError(formField, { type: 'server', message: messages[0] });
    }
  }
}
