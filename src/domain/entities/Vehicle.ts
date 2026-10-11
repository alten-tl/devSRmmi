import { Vin } from '../value-objects/Vin';
import { LicensePlate } from '../value-objects/LicensePlate';
import { VehicleYear } from '../value-objects/VehicleYear';
import { ValidationError } from '../errors/AppError';
import { assertSafeString, collapseWhitespace, stripControlCharacters } from '../../shared/utils/sanitize';
import type { VehicleRow, VehicleDto } from '../../types';

const MAX_COLOR_LENGTH = 40;
const MAX_MODEL_LENGTH = 60;

export interface VehicleProps {
  id: string;
  clientId: string;
  vin: Vin;
  licensePlate: LicensePlate;
  color: string;
  year: VehicleYear;
  model: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateVehicleProps {
  clientId: string;
  vin: string;
  licensePlate: string;
  color: string;
  year: number;
  model: string;
}

export class Vehicle {
  private readonly props: VehicleProps;

  private constructor(props: VehicleProps) {
    this.props = props;
  }

  public static create(input: CreateVehicleProps): Vehicle {
    const now = new Date();
    return new Vehicle({
      id: '',
      clientId: input.clientId,
      vin: Vin.create(input.vin),
      licensePlate: LicensePlate.create(input.licensePlate),
      color: Vehicle.normalizeText(input.color, 'color', MAX_COLOR_LENGTH),
      year: VehicleYear.create(input.year),
      model: Vehicle.normalizeText(input.model, 'model', MAX_MODEL_LENGTH),
      createdAt: now,
      updatedAt: now,
    });
  }

  public static fromRow(row: VehicleRow): Vehicle {
    return new Vehicle({
      id: row.id,
      clientId: row.client_id,
      vin: Vin.create(row.vin),
      licensePlate: LicensePlate.create(row.license_plate),
      color: row.color,
      year: VehicleYear.create(row.year),
      model: row.model,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }

  private static normalizeText(value: string, field: string, maxLength: number): string {
    if (typeof value !== 'string') {
      throw new ValidationError(`Field "${field}" must be a string`, { field });
    }

    const cleaned = collapseWhitespace(stripControlCharacters(value));
    if (cleaned.length === 0) {
      throw new ValidationError(`Field "${field}" cannot be empty`, { field });
    }

    assertSafeString(cleaned, field, maxLength);
    return cleaned;
  }

  public get id(): string {
    return this.props.id;
  }
  public get clientId(): string {
    return this.props.clientId;
  }
  public get vin(): string {
    return this.props.vin.value;
  }
  public get licensePlate(): string {
    return this.props.licensePlate.value;
  }
  public get color(): string {
    return this.props.color;
  }
  public get year(): number {
    return this.props.year.value;
  }
  public get model(): string {
    return this.props.model;
  }
  public get createdAt(): Date {
    return this.props.createdAt;
  }
  public get updatedAt(): Date {
    return this.props.updatedAt;
  }

  public withIdentity(id: string): Vehicle {
    return new Vehicle({ ...this.props, id });
  }

  public belongsTo(clientId: string): boolean {
    return this.props.clientId === clientId;
  }

  public toDto(): VehicleDto {
    return {
      id: this.props.id,
      clientId: this.props.clientId,
      vin: this.props.vin.value,
      licensePlate: this.props.licensePlate.value,
      color: this.props.color,
      year: this.props.year.value,
      model: this.props.model,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
    };
  }
}