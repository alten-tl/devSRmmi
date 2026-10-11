import type {
  AppointmentDetailRow,
  AppointmentRow,
  AppointmentStatus,
  CreateAppointmentInput,
  UpdateAppointmentInput,
} from '../../types';

/**
 * Appointment persistence port. The `findConflict` method is the key piece to
 * validate slot availability before creating/rescheduling.
 */
export interface IAppointmentRepository {
  create(input: CreateAppointmentInput): Promise<AppointmentDetailRow>;
  findById(id: string): Promise<AppointmentDetailRow | null>;
  findByDate(date: string): Promise<AppointmentDetailRow[]>;
  /** Returns an ENABLED appointment occupying date+time, excluding a given id. */
  findConflict(date: string, time: string, excludeId?: string): Promise<AppointmentRow | null>;
  update(id: string, input: UpdateAppointmentInput): Promise<AppointmentDetailRow | null>;
  updateStatus(id: string, status: AppointmentStatus): Promise<AppointmentDetailRow | null>;
}