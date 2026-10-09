export interface ValidationIssue {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  value?: Record<string, unknown>;
  issues: ValidationIssue[];
}

/**
 * Input validation port. The real implementation uses AJV, but services only
 * know this interface (DIP -> testable with doubles).
 */
export interface IValidator {
  validateCreateClient(input: unknown): ValidationResult;
  validateCreateVehicle(input: unknown): ValidationResult;
  validateCreateAppointment(input: unknown): ValidationResult;
  validateUpdateAppointment(input: unknown): ValidationResult;
  validateListAppointmentsQuery(input: unknown): ValidationResult;
  validateId(id: string): string;
}