import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { ClientsHandler } from '../../src/handlers/clientsHandler';
import { ErrorMiddleware } from '../../src/shared/middlewares/ErrorMiddleware';
import { HttpCode } from '../../src/shared/http/httpCodes';
import { NotFoundError } from '../../src/domain/errors/AppError';
import type { IClientService } from '../../src/application/services/ClientService';
import type { ILogger } from '../../src/application/ports/ILogger';

const CLIENT_ID = '11111111-1111-4111-8111-111111111111';

const clientServiceMock: IClientService = {
  createClient: vi.fn(),
  getClientById: vi.fn(),
};

const loggerMock: ILogger = {
  fatal: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
  child: vi.fn(),
};

const event = (overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent =>
  ({
    httpMethod: 'POST',
    resource: '/clients',
    path: '/clients',
    headers: { 'content-type': 'application/json' },
    pathParameters: null,
    queryStringParameters: null,
    body: null,
    isBase64Encoded: false,
    requestContext: { requestId: 'req-1' },
    ...overrides,
  }) as unknown as APIGatewayProxyEvent;

describe('ClientsHandler', () => {
  let handler: ClientsHandler;

  beforeEach(() => {
    handler = new ClientsHandler(clientServiceMock, loggerMock, new ErrorMiddleware(loggerMock));
  });

  it('POST /clients responds 201', async () => {
    clientServiceMock.createClient.mockResolvedValue({
      id: CLIENT_ID,
      name: 'Ana Lopez',
      timezone: 'America/Bogota',
      address: 'Calle 1 # 2-3',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = await handler.handle(
      event({
        body: JSON.stringify({
          name: 'Ana Lopez',
          timezone: 'America/Bogota',
          address: 'Calle 1 # 2-3',
        }),
      })
    );

    expect(result.statusCode).toBe(HttpCode.CREATED);
    expect(JSON.parse(result.body).data.client.id).toBe(CLIENT_ID);
  });

  it('GET /clients/{id} responds 200', async () => {
    clientServiceMock.getClientById.mockResolvedValue({
      id: CLIENT_ID,
      name: 'Ana Lopez',
      timezone: 'America/Bogota',
      address: 'Calle 1 # 2-3',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = await handler.handle(
      event({ httpMethod: 'GET', resource: '/clients/{id}', pathParameters: { id: CLIENT_ID } })
    );

    expect(result.statusCode).toBe(HttpCode.OK);
    expect(clientServiceMock.getClientById).toHaveBeenCalledWith(CLIENT_ID);
  });

  it('propagates NotFoundError as 404', async () => {
    clientServiceMock.getClientById.mockRejectedValue(new NotFoundError('Client'));

    const result = await handler.handle(
      event({ httpMethod: 'GET', resource: '/clients/{id}', pathParameters: { id: CLIENT_ID } })
    );

    expect(result.statusCode).toBe(HttpCode.NOT_FOUND);
  });
});