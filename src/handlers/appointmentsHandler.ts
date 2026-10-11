import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Container } from '../infrastructure/container/Container';
import type { IAppointmentService } from '../application/services/AppointmentService';
import type { ILogger } from '../application/ports/ILogger';
import { ErrorMiddleware } from '../shared/middlewares/ErrorMiddleware';
import { BaseHandler } from '../shared/middlewares/BaseHandler';
import { ResponseBuilder, type ApiResult } from '../shared/http/responseBuilder';
import { RequestContext } from '../shared/middlewares/RequestParser';
import { ValidationError } from '../domain/errors/AppError';
import { Database } from '../infrastructure/db/Database';

/**
 * Appointments facade: exposes the 4 required use cases.
 *  - GET  /appointments?date=YYYY-MM-DD  -> listing by date
 *  - POST /appointments                  -> new appointment (validates free slot)
 *  - PUT  /appointments/{id}             -> reschedules date/time (validates slot)
 *  - PATCH /appointments/{id}/cancel     -> cancel (status DISABLED)
 */
export class AppointmentsHandler extends BaseHandler {
  constructor(
    private readonly appointmentService: IAppointmentService,
    logger: ILogger,
    errorMiddleware: ErrorMiddleware
  ) {
    super(logger, errorMiddleware);
    this.routes = {
      'GET /appointments': (ctx) => this.listByDate(ctx),
      'POST /appointments': (ctx) => this.create(ctx),
      'PUT /appointments/{id}': (ctx) => this.update(ctx),
      'PATCH /appointments/{id}/cancel': (ctx) => this.cancel(ctx),
    };
  }

  public static fromContainer(container: Container): AppointmentsHandler {
    const logger = container.getLogger();
    return new AppointmentsHandler(
      container.getAppointmentService(),
      logger,
      new ErrorMiddleware(logger)
    );
  }

  private async listByDate(ctx: RequestContext): Promise<ApiResult> {
    const date = ctx.query.date;
    if (date === undefined) {
      throw new ValidationError('Query parameter "date" is required (YYYY-MM-DD)');
    }

    const appointments = await this.appointmentService.listAppointmentsByDate(date);
    return ResponseBuilder.ok({ appointments }, ctx.requestId);
  }

  private async create(ctx: RequestContext): Promise<ApiResult> {
    if (ctx.body === undefined) {
      throw new ValidationError('Request body is required');
    }

    const appointment = await this.appointmentService.createAppointment(ctx.body);
    return ResponseBuilder.created({ appointment }, ctx.requestId);
  }

  private async update(ctx: RequestContext): Promise<ApiResult> {
    if (ctx.body === undefined) {
      throw new ValidationError('Request body is required');
    }

    const appointment = await this.appointmentService.updateAppointment(
      BaseHandler.extractId(ctx),
      ctx.body
    );
    return ResponseBuilder.ok({ appointment }, ctx.requestId);
  }

  private async cancel(ctx: RequestContext): Promise<ApiResult> {
    const appointment = await this.appointmentService.cancelAppointment(BaseHandler.extractId(ctx));
    return ResponseBuilder.ok({ appointment }, ctx.requestId);
  }
}

/** Entry point invoked by AWS Lambda (see template.yaml). */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const appointmentsHandler = AppointmentsHandler.fromContainer(Container.getInstance());

  try {
    return await appointmentsHandler.handle(event);
  } finally {
    if (process.env.IS_LOCAL === 'true') {
      await Database.close();
    }
  }
};