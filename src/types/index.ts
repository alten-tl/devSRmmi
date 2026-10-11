export type AppointmentStatus = 'ENABLED' | 'DISABLED';

export interface ClientRow {
  id: string;
  name: string;
  timezone: string;
  address: string;
  created_at: Date;
  updated_at: Date;
}

export interface VehicleRow {
  id: string;
  client_id: string;
  vin: string;
  license_plate: string;
  color: string;
  year: number;
  model: string;
  created_at: Date;
  updated_at: Date;
}

export interface AppointmentRow {
  id: string;
  client_id: string;
  vehicle_id: string;
  date: string;
  time: string;
  comments: string | null;
  status: AppointmentStatus;
  created_at: Date;
  updated_at: Date;
}

/** Appointment row enriched with client and vehicle data (JOIN). */
export interface AppointmentDetailRow extends AppointmentRow {
  client_name: string;
  client_timezone: string;
  client_address: string;
  vehicle_vin: string;
  vehicle_license_plate: string;
  vehicle_color: string;
  vehicle_year: number;
  vehicle_model: string;
}

export interface CreateClientInput {
  name: string;
  timezone: string;
  address: string;
}

export interface CreateVehicleInput {
  clientId: string;
  vin: string;
  licensePlate: string;
  color: string;
  year: number;
  model: string;
}

export interface CreateAppointmentInput {
  clientId: string;
  vehicleId: string;
  date: string;
  time: string;
  comments?: string | null;
}

export interface UpdateAppointmentInput {
  date: string;
  time: string;
  comments?: string | null;
}

export interface ListAppointmentsQuery {
  date: string;
}

export interface ClientDto {
  id: string;
  name: string;
  timezone: string;
  address: string;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleDto {
  id: string;
  clientId: string;
  vin: string;
  licensePlate: string;
  color: string;
  year: number;
  model: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentDto {
  id: string;
  clientId: string;
  vehicleId: string;
  date: string;
  time: string;
  comments: string | null;
  status: AppointmentStatus;
  createdAt: string;
  updatedAt: string;
  client?: ClientDto;
  vehicle?: VehicleDto;
}