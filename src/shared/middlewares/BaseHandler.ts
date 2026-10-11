import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { ILogger } from '../../application/ports/ILogger';
import { ErrorMiddleware } from '../middlewares/ErrorMiddleware';
import { parseRequest, type RequestContext } from '../middlewares/RequestParser';
import { ResponseBuilder, type ApiResult } from '../http/responseBuilder';
import { generateRequestId } from '../utils/uuid';
import { ValidationError } from '../../domain/errors/AppError';

export type RouteHandler = (ctx: RequestContext) => Promise<ApiResult>;

/**
 * Base class for Lambda handlers (Template Method pattern).
 * Centralizes: event parsing, requestId assignment, routing by HTTP method +
 * resource, error handling and cross-cutting logging.
 * Subclasses only declare their route table (SRP / OCP).
 */
export abstract class BaseHandler {
  protected routes: Record<string, RouteHandler> = {};

  protected constructor(
    protected readonly logger: ILogger,
    protected readonly errorMiddleware: ErrorMiddleware
  ) {}

  public async handle(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const requestId = event.requestContext?.requestId ?? generateRequestId();
    const startedAt = Date.now();

    this.logger.info('Incoming request', {
      requestId,
      method: event.httpMethod,
      path: event.resource,
    });

    if ((event.httpMethod ?? '').toUpperCase() === 'OPTIONS') {
      return ResponseBuilder.noContent(requestId) as APIGatewayProxyResult;
    }

    try {
      const context = parseRequest(event, requestId);
      const path = BaseHandler.normalizePath(context.path);
      const route = this.routes[`${context.method} ${path}`];

      if (!route) {
        throw new ValidationError(`Route ${context.method} ${context.path} not found`);
      }

      const result = await route(context);

      this.logger.info('Request completed', {
        requestId,
        statusCode: result.statusCode,
        durationMs: Date.now() - startedAt,
      });

      return result as APIGatewayProxyResult;
    } catch (error) {
      return this.errorMiddleware.handle(error, requestId) as APIGatewayProxyResult;
    }
  }

  protected static extractId(ctx: RequestContext, name = 'id'): string {
    const id = ctx.params[name];
    if (!id) {
      throw new ValidationError(`Missing path parameter: ${name}`);
    }
    return id;
  }

  private static normalizePath(path: string): string {
    return path.replace(/\/+$/, '') || path;
  }
}