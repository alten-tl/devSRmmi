import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Container } from '../infrastructure/container/Container';
import type { IClientService } from '../application/services/ClientService';
import type { ILogger } from '../application/ports/ILogger';
import { ErrorMiddleware } from '../shared/middlewares/ErrorMiddleware';
import { BaseHandler } from '../shared/middlewares/BaseHandler';
import { ResponseBuilder, type ApiResult } from '../shared/http/responseBuilder';
import { RequestContext } from '../shared/middlewares/RequestParser';
import { ValidationError } from '../domain/errors/AppError';
import { Database } from '../infrastructure/db/Database';

/** Clients facade: only orchestrates service + validation + responses. */
export class ClientsHandler extends BaseHandler {
  constructor(
    private readonly clientService: IClientService,
    logger: ILogger,
    errorMiddleware: ErrorMiddleware
  ) {
    super(logger, errorMiddleware);
    this.routes = {
      'POST /clients': (ctx) => this.create(ctx),
      'GET /clients/{id}': (ctx) => this.getById(ctx),
    };
  }

  public static fromContainer(container: Container): ClientsHandler {
    const logger = container.getLogger();
    return new ClientsHandler(
      container.getClientService(),
      logger,
      new ErrorMiddleware(logger)
    );
  }

  private async create(ctx: RequestContext): Promise<ApiResult> {
    if (ctx.body === undefined) {
      throw new ValidationError('Request body is required');
    }

    const client = await this.clientService.createClient(ctx.body);
    return ResponseBuilder.created({ client }, ctx.requestId);
  }

  private async getById(ctx: RequestContext): Promise<ApiResult> {
    const client = await this.clientService.getClientById(BaseHandler.extractId(ctx));
    return ResponseBuilder.ok({ client }, ctx.requestId);
  }
}

/** Entry point invoked by AWS Lambda (see template.yaml). */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const clientsHandler = ClientsHandler.fromContainer(Container.getInstance());

  try {
    return await clientsHandler.handle(event);
  } finally {
    if (process.env.IS_LOCAL === 'true') {
      await Database.close();
    }
  }
};