import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Container } from '../infrastructure/container/Container';
import { ErrorMiddleware } from '../shared/middlewares/ErrorMiddleware';
import { BaseHandler } from '../shared/middlewares/BaseHandler';
import { ResponseBuilder, type ApiResult } from '../shared/http/responseBuilder';
import type { RequestContext } from '../shared/middlewares/RequestParser';
import { Database } from '../infrastructure/db/Database';
import type { ILogger } from '../application/ports/ILogger';

/** Healthcheck: verifies connectivity with the database. */
export class HealthHandler extends BaseHandler {
  constructor(logger: ILogger, errorMiddleware: ErrorMiddleware) {
    super(logger, errorMiddleware);
    this.routes = {
      'GET /health': (ctx) => this.check(ctx),
    };
  }

  public static fromContainer(container: Container): HealthHandler {
    return new HealthHandler(container.getLogger(), new ErrorMiddleware(container.getLogger()));
  }

  private async check(_ctx: RequestContext): Promise<ApiResult> {
    const healthy = await Database.healthCheck(this.logger);
    return ResponseBuilder.ok({ status: healthy ? 'ok' : 'degraded', database: healthy }, 'health');
  }
}

/** Entry point invoked by AWS Lambda (see template.yaml). */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const healthHandler = HealthHandler.fromContainer(Container.getInstance());

  try {
    return await healthHandler.handle(event);
  } finally {
    if (process.env.IS_LOCAL === 'true') {
      await Database.close();
    }
  }
};