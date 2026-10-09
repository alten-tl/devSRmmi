import { describe, expect, it, vi } from 'vitest';
import { ErrorMiddleware } from '../../src/shared/middlewares/ErrorMiddleware';
import { ResponseBuilder } from '../../src/shared/http/responseBuilder';
import { HttpCode } from '../../src/shared/http/httpCodes';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../src/domain/errors/AppError';
import type { ILogger } from '../../src/application/ports/ILogger';

const loggerMock: ILogger = {
  fatal: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
  child: vi.fn(),
};

describe('ErrorMiddleware', () => {
  const middleware = new ErrorMiddleware(loggerMock);

  it('translates AppError with status and code', () => {
    const result = middleware.handle(new NotFoundError('Appointment'), 'req-1');
    expect(result.statusCode).toBe(HttpCode.NOT_FOUND);
    expect(JSON.parse(result.body).error.code).toBe('NOT_FOUND');
  });

  it('includes the issues array for ValidationError', () => {
    const result = middleware.handle(
      new ValidationError('Invalid payload', [{ field: 'date', message: 'must match format date' }]),
      'req-1'
    );
    const body = JSON.parse(result.body);
    expect(result.statusCode).toBe(HttpCode.UNPROCESSABLE_ENTITY);
    expect(body.error.issues[0].field).toBe('date');
  });

  it('business errors are logged as warn, not error', () => {
    middleware.handle(new ConflictError('busy'), 'req-1');
    expect(loggerMock.warn).toHaveBeenCalled();
    expect(loggerMock.error).not.toHaveBeenCalled();
  });

  it('unknown errors -> 500 without leaking details', () => {
    const result = middleware.handle(new Error('SELECT * FROM users; --'), 'req-1');
    expect(result.statusCode).toBe(HttpCode.INTERNAL_SERVER_ERROR);
    expect(result.body).not.toContain('SELECT');
    expect(loggerMock.error).toHaveBeenCalled();
  });

  it('does not expose internal messages in non-operational errors', () => {
    const result = middleware.handle(new Error('postgres connection failed'), 'req-1');
    expect(result.body).not.toContain('postgres');
  });
});

describe('ResponseBuilder', () => {
  it('ok builds the standard envelope with requestId and timestamp', () => {
    const result = ResponseBuilder.ok({ ping: 'pong' }, 'req-1');
    expect(result.statusCode).toBe(HttpCode.OK);
    const body = JSON.parse(result.body);
    expect(body).toMatchObject({ success: true, data: { ping: 'pong' }, requestId: 'req-1' });
    expect(body.timestamp).toBeDefined();
  });

  it('includes security and CORS headers', () => {
    const result = ResponseBuilder.ok({}, 'req-1');
    expect(result.headers['X-Content-Type-Options']).toBe('nosniff');
    expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(result.headers['X-Request-Id']).toBe('req-1');
  });

  it('noContent returns 204 without body', () => {
    const result = ResponseBuilder.noContent('req-1');
    expect(result.statusCode).toBe(HttpCode.NO_CONTENT);
    expect(result.body).toBe('');
  });
});