import { AppointmentDate } from '../value-objects/AppointmentDate';
import { AppointmentTime } from '../value-objects/AppointmentTime';
import { Comments } from '../value-objects/Comments';
import { ValidationError } from '../errors/AppError';
import type { AppointmentRow, AppointmentDetailRow, AppointmentDto, AppointmentStatus } from '../../types';

export interface AppointmentProps {
  id: string;
  clientId: string;
  vehicleId: string;
  date: AppointmentDate;
  time: AppointmentTime;
  comments: Comments;
  status: AppointmentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAppointmentProps {
  clientId: string;
  vehicleId: string;
  date: string;
  time: string;
  comments?: string | null;
}

export interface RescheduleAppointmentProps {
  date: string;
  time: string;
  comments?: string | null;
}

const VALID_STATUSES: readonly AppointmentStatus[] = ['ENABLED', 'DISABLED'];

/**
 * Appointment domain entity.
 * - `schedule` creates an ENABLED appointment.
 * - `reschedule` replaces date/time and bumps updatedAt.
 * - `disable` is the business state change (cancelation).
 */
export class Appointment {
  private readonly props: AppointmentProps;

  private constructor(props: AppointmentProps) {
    this.props = props;
  }

  public static create(input: CreateAppointmentProps): Appointment {
    const now = new Date();
    return new Appointment({
      id: '',
      clientId: input.clientId,
      vehicleId: input.vehicleId,
      date: AppointmentDate.create(input.date),
      time: AppointmentTime.create(input.time),
      comments: Comments.create(input.comments),
      status: 'ENABLED',
      createdAt: now,
      updatedAt: now,
    });
  }

  public static fromRow(row: AppointmentRow | AppointmentDetailRow): Appointment {
    return new Appointment({
      id: row.id,
      clientId: row.client_id,
      vehicleId: row.vehicle_id,
      date: AppointmentDate.create(row.date),
      time: AppointmentTime.create(row.time),
      comments: Comments.create(row.comments),
      status: Appointment.parseStatus(row.status),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }

  private static parseStatus(status: string): AppointmentStatus {
    if ((VALID_STATUSES as readonly string[]).includes(status)) {
      return status as AppointmentStatus;
    }
    throw new ValidationError(`Invalid appointment status: ${status}`, { field: 'status' });
  }

  public get id(): string {
    return this.props.id;
  }
  public get clientId(): string {
    return this.props.clientId;
  }
  public get vehicleId(): string {
    return this.props.vehicleId;
  }
  public get date(): string {
    return this.props.date.value;
  }
  public get time(): string {
    return this.props.time.value;
  }
  public get comments(): string | null {
    return this.props.comments.value;
  }
  public get status(): AppointmentStatus {
    return this.props.status;
  }
  public get createdAt(): Date {
    return this.props.createdAt;
  }
  public get updatedAt(): Date {
    return this.props.updatedAt;
  }

  public isEnabled(): boolean {
    return this.props.status === 'ENABLED';
  }

  public withIdentity(id: string): Appointment {
    return new Appointment({ ...this.props, id });
  }

  /** Reschedules the appointment (keeps identity and creation date). */
  public reschedule(changes: RescheduleAppointmentProps): Appointment {
    return new Appointment({
      ...this.props,
      date: AppointmentDate.create(changes.date),
      time: AppointmentTime.create(changes.time),
      comments:
        changes.comments !== undefined
          ? Comments.create(changes.comments)
          : this.props.comments,
      updatedAt: new Date(),
    });
  }

  /** Business cancelation: transitions to DISABLED and bumps updatedAt. */
  public disable(): Appointment {
    return new Appointment({
      ...this.props,
      status: 'DISABLED',
      updatedAt: new Date(),
    });
  }

  public toDto(): AppointmentDto {
    return {
      id: this.props.id,
      clientId: this.props.clientId,
      vehicleId: this.props.vehicleId,
      date: this.props.date.value,
      time: this.props.time.value,
      comments: this.props.comments.value,
      status: this.props.status,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
    };
  }
}