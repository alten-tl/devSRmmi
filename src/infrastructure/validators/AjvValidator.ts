import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import type { IValidator, ValidationResult } from '../../application/ports/IValidator';
import { ValidationError } from '../../domain/errors/AppError';
import { isValidUuid } from '../../shared/utils/uuid';

const CONTROL_CHARS_PATTERN_REGEX = /[\u0000-\u001F\u007F]/;
const NO_SQL_META_PATTERN = '^[^"\'`;\\\\<>]*$';
const VIN_PATTERN = '^[A-HJ-NPR-Z0-9]{17}$';
const LICENSE_PLATE_PATTERN = '^[A-Z0-9]{2,4}-?[A-Z0-9]{2,4}$';
const TIMEZONE_PATTERN = '^[A-Za-z_+.,\\-/: ]{1,64}$';
// HH:MM or HH:MM:SS (24h). The 'time' format of ajv-formats requires RFC3339 timezone.
const TIME_24_PATTERN = '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$';

const createClientSchema = {
  $id: 'createClient',
  type: 'object',
  additionalProperties: false,
  required: ['name', 'timezone', 'address'],
  properties: {
    name: { type: 'string', minLength: 2, maxLength: 100, pattern: NO_SQL_META_PATTERN },
    timezone: { type: 'string', minLength: 1, maxLength: 64, pattern: TIMEZONE_PATTERN },
    address: { type: 'string', minLength: 5, maxLength: 200, pattern: NO_SQL_META_PATTERN },
  },
} as const;

const createVehicleSchema = {
  $id: 'createVehicle',
  type: 'object',
  additionalProperties: false,
  required: ['clientId', 'vin', 'licensePlate', 'color', 'year', 'model'],
  properties: {
    clientId: { type: 'string', format: 'uuid' },
    vin: { type: 'string', pattern: VIN_PATTERN },
    licensePlate: { type: 'string', pattern: LICENSE_PLATE_PATTERN },
    color: { type: 'string', minLength: 2, maxLength: 40, pattern: NO_SQL_META_PATTERN },
    year: { type: 'integer', minimum: 1900, maximum: new Date().getUTCFullYear() + 1 },
    model: { type: 'string', minLength: 1, maxLength: 60, pattern: NO_SQL_META_PATTERN },
  },
} as const;

const createAppointmentSchema = {
  $id: 'createAppointment',
  type: 'object',
  additionalProperties: false,
  required: ['clientId', 'vehicleId', 'date', 'time'],
  properties: {
    clientId: { type: 'string', format: 'uuid' },
    vehicleId: { type: 'string', format: 'uuid' },
    date: { type: 'string', format: 'date' },
    time: { type: 'string', pattern: TIME_24_PATTERN },
    comments: { type: ['string', 'null'], maxLength: 500 },
  },
} as const;

const updateAppointmentSchema = {
  $id: 'updateAppointment',
  type: 'object',
  additionalProperties: false,
  required: ['date', 'time'],
  properties: {
    date: { type: 'string', format: 'date' },
    time: { type: 'string', pattern: TIME_24_PATTERN },
    comments: { type: ['string', 'null'], maxLength: 500 },
  },
} as const;

const listAppointmentsQuerySchema = {
  $id: 'listAppointmentsQuery',
  type: 'object',
  additionalProperties: false,
  required: ['date'],
  properties: {
    date: { type: 'string', format: 'date' },
  },
} as const;

const mapErrors = (errors: ErrorObject[] | null | undefined): ValidationResult['issues'] =>
  (errors ?? []).map((error) => ({
    field: error.instancePath.replace(/^\//, '') || 'body',
    message: `${error.message ?? 'invalid'}${
      error.params && 'additionalProperty' in error.params
        ? ` (${String((error.params as { additionalProperty: string }).additionalProperty)})`
        : ''
    }`,
  }));

/**
 * IValidator port implementation using AJV (compile-once).
 * additionalProperties:false + patterns + formats close the door to mass
 * assignment, payloads with embedded SQL and invalid dates/times.
 */
export class AjvValidator implements IValidator {
  private readonly ajv: Ajv;
  private readonly createClientSchema: ValidateFunction;
  private readonly createVehicleSchema: ValidateFunction;
  private readonly createAppointmentSchema: ValidateFunction;
  private readonly updateAppointmentSchema: ValidateFunction;
  private readonly listAppointmentsQuerySchema: ValidateFunction;

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      coerceTypes: false,
      useDefaults: true,
      removeAdditional: false,
      strict: true,
    });
    addFormats(this.ajv);

    this.createClientSchema = this.ajv.compile(createClientSchema);
    this.createVehicleSchema = this.ajv.compile(createVehicleSchema);
    this.createAppointmentSchema = this.ajv.compile(createAppointmentSchema);
    this.updateAppointmentSchema = this.ajv.compile(updateAppointmentSchema);
    this.listAppointmentsQuerySchema = this.ajv.compile(listAppointmentsQuerySchema);
  }

  public validateCreateClient(input: unknown): ValidationResult {
    return this.run(this.createClientSchema, input);
  }

  public validateCreateVehicle(input: unknown): ValidationResult {
    return this.run(this.createVehicleSchema, input);
  }

  public validateCreateAppointment(input: unknown): ValidationResult {
    return this.run(this.createAppointmentSchema, input);
  }

  public validateUpdateAppointment(input: unknown): ValidationResult {
    return this.run(this.updateAppointmentSchema, input);
  }

  public validateListAppointmentsQuery(input: unknown): ValidationResult {
    return this.run(this.listAppointmentsQuerySchema, input);
  }

  public validateId(id: string): string {
    if (CONTROL_CHARS_PATTERN_REGEX.test(id) || !isValidUuid(id)) {
      throw new ValidationError('id must be a valid UUID v4', { field: 'pathParameters.id' });
    }
    return id;
  }

  private run(schema: ValidateFunction, input: unknown): ValidationResult {
    const valid = schema(input);
    return valid
      ? { isValid: true, value: input as Record<string, unknown>, issues: [] }
      : { isValid: false, issues: mapErrors(schema.errors) };
  }
}