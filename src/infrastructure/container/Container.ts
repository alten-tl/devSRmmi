import { ClientService, type IClientService } from '../../application/services/ClientService';
import { VehicleService, type IVehicleService } from '../../application/services/VehicleService';
import { AppointmentService, type IAppointmentService } from '../../application/services/AppointmentService';
import { AjvValidator } from '../validators/AjvValidator';
import { PostgresClientRepository } from '../repositories/PostgresClientRepository';
import { PostgresVehicleRepository } from '../repositories/PostgresVehicleRepository';
import { PostgresAppointmentRepository } from '../repositories/PostgresAppointmentRepository';
import { PinoLogger } from '../logging/PinoLogger';
import { loggerConfig } from '../../config';
import type { ILogger, LogLevel } from '../../application/ports/ILogger';
import type { IClientRepository } from '../../application/ports/IClientRepository';
import type { IVehicleRepository } from '../../application/ports/IVehicleRepository';
import type { IAppointmentRepository } from '../../application/ports/IAppointmentRepository';

/**
 * Dependency injection container (Service Locator / Factory).
 * The only place that knows the concrete implementations: if Postgres is
 * swapped for DynamoDB tomorrow, only this file changes (DIP).
 * All graphs are singletons per container and are reused across invocations.
 */
export class Container {
  private static instance: Container | undefined;
  private readonly logger: ILogger;
  private readonly validator: AjvValidator;
  private readonly clientRepository: IClientRepository;
  private readonly vehicleRepository: IVehicleRepository;
  private readonly appointmentRepository: IAppointmentRepository;
  private readonly clientService: IClientService;
  private readonly vehicleService: IVehicleService;
  private readonly appointmentService: IAppointmentService;

  private constructor(logger?: ILogger) {
    this.logger =
      logger ??
      new PinoLogger({
        level: loggerConfig.level as LogLevel,
        pretty: loggerConfig.pretty,
        base: {},
      });
    this.validator = new AjvValidator();
    this.clientRepository = new PostgresClientRepository(this.logger);
    this.vehicleRepository = new PostgresVehicleRepository(this.logger);
    this.appointmentRepository = new PostgresAppointmentRepository(this.logger);
    this.clientService = new ClientService(this.clientRepository, this.validator, this.logger);
    this.vehicleService = new VehicleService(
      this.vehicleRepository,
      this.clientRepository,
      this.validator,
      this.logger
    );
    this.appointmentService = new AppointmentService(
      this.appointmentRepository,
      this.clientRepository,
      this.vehicleRepository,
      this.validator,
      this.logger
    );
  }

  public static getInstance(): Container {
    Container.instance ??= new Container();
    return Container.instance;
  }

  public getLogger(): ILogger {
    return this.logger;
  }

  public getValidator(): AjvValidator {
    return this.validator;
  }

  public getClientService(): IClientService {
    return this.clientService;
  }

  public getVehicleService(): IVehicleService {
    return this.vehicleService;
  }

  public getAppointmentService(): IAppointmentService {
    return this.appointmentService;
  }
}