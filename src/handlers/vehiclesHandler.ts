import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Container } from '../infrastructure/container/Container';
import type { IVehicleService } from '../application/services/VehicleService';
import type { ILogger } from '../application/ports/ILogger';
import { ErrorMiddleware } from '../shared/middlewares/ErrorMiddleware';
import { BaseHandler } from '../shared/middlewares/BaseHandler';
import { ResponseBuilder, type ApiResult } from '../shared/http/responseBuilder';
import { RequestContext } from '../shared/middlewares/RequestParser';
import { ValidationError } from '../domain/errors/AppError';
import { Database } from '../infrastructure/db/Database';

/** Vehicles facade: only orchestrates service + validation + responses. */
export class VehiclesHandler extends BaseHandler {
  constructor(
    private readonly vehicleService: IVehicleService,
    logger: ILogger,
    errorMiddleware: ErrorMiddleware
  ) {
    super(logger, errorMiddleware);
    this.routes = {
      'POST /vehicles': (ctx) => this.create(ctx),
      'GET /vehicles/{id}': (ctx) => this.getById(ctx),
      'GET /clients/{id}/vehicles': (ctx) => this.listByClient(ctx),
    };
  }

  public static fromContainer(container: Container): VehiclesHandler {
    const logger = container.getLogger();
    return new VehiclesHandler(
      container.getVehicleService(),
      logger,
      new ErrorMiddleware(logger)
    );
  }

  private async create(ctx: RequestContext): Promise<ApiResult> {
    if (ctx.body === undefined) {
      throw new ValidationError('Request body is required');
    }

    const vehicle = await this.vehicleService.createVehicle(ctx.body);
    return ResponseBuilder.created({ vehicle }, ctx.requestId);
  }

  private async getById(ctx: RequestContext): Promise<ApiResult> {
    const vehicle = await this.vehicleService.getVehicleById(BaseHandler.extractId(ctx));
    return ResponseBuilder.ok({ vehicle }, ctx.requestId);
  }

  private async listByClient(ctx: RequestContext): Promise<ApiResult> {
    const vehicles = await this.vehicleService.listVehiclesByClient(
      BaseHandler.extractId(ctx, 'id')
    );
    return ResponseBuilder.ok({ vehicles }, ctx.requestId);
  }
}

/** Entry point invoked by AWS Lambda (see template.yaml). */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const vehiclesHandler = VehiclesHandler.fromContainer(Container.getInstance());

  try {
    return await vehiclesHandler.handle(event);
  } finally {
    if (process.env.IS_LOCAL === 'true') {
      await Database.close();
    }
  }
};