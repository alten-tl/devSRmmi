import type { CreateVehicleInput, VehicleRow } from '../../types';

export interface IVehicleRepository {
  create(input: CreateVehicleInput): Promise<VehicleRow>;
  findById(id: string): Promise<VehicleRow | null>;
  findAllByClient(clientId: string): Promise<VehicleRow[]>;
}