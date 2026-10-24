export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: { field: string; issue: string }[] = [],
  ) {
    super(message);
  }
}

export function validationError(field: string, issue: string, message: string): ApiError {
  return new ApiError(422, "VALIDATION_FAILED", message, [{ field, issue }]);
}
