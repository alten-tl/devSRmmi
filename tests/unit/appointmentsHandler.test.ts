import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { AppointmentsHandler } from '../../src/handlers/appointmentsHandler';
import { ErrorMiddleware } from '../../src/shared/middlewares/ErrorMiddleware';
import { HttpCode } from '../../src/shared/http/httpCodes';
import { ConflictError, NotFoundError } from '../../src/domain/errors/AppError';
import type { IAppointmentService } from '../../src/application/services/AppointmentService';
import type { ILogger } from '../../src/application/ports/ILogger';
import type { AppointmentDto } from '../../src/types';

const APPOINTMENT_ID = '55555555-5555-4555-8555-555555555555';

const appointmentServiceMock: IAppointmentService = {
  listAppointmentsByDate: vi.fn(),
  createAppointment: vi.fn(),
  updateAppointment: vi.fn(),
  cancelAppointment: vi.fn(),
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

const appointmentDto: AppointmentDto = {
  id: APPOINTMENT_ID,
  clientId: '11111111-1111-4111-8111-111111111111',
  vehicleId: '22222222-2222-4222-8222-222222222222',
  date: '2026-10-20',
  time: '09:00:00',
  comments: null,
  status: 'ENABLED',
  createdAt: '2026-10-09T10:00:00.000Z',
  updatedAt: '2026-10-09T10:00:00.000Z',
};

const event = (overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent =>
  ({
    httpMethod: 'GET',
    resource: '/appointments',
    path: '/appointments',
    headers: { 'content-type': 'application/json' },
    pathParameters: null,
    queryStringParameters: null,
    body: null,
    isBase64Encoded: false,
    requestContext: { requestId: 'req-1' },
    ...overrides,
  }) as unknown as APIGatewayProxyEvent;

describe('AppointmentsHandler (routing + middleware)', () => {
  let handler: AppointmentsHandler;

  beforeEach(() => {
    handler = new AppointmentsHandler(appointmentServiceMock, loggerMock, new ErrorMiddleware(loggerMock));
  });

  it('GET /appointments?date=... returns the day listings', async () => {
    appointmentServiceMock.listAppointmentsByDate.mockResolvedValue([appointmentDto]);

    const result = await handler.handle(
      event({ queryStringParameters: { date: '2026-10-20' } })
    );

    expect(result.statusCode).toBe(HttpCode.OK);
    const body = JSON.parse(result.body);
    expect(body.data.appointments).toHaveLength(1);
    expect(appointmentServiceMock.listAppointmentsByDate).toHaveBeenCalledWith('2026-10-20');
  });

  it('GET /appointments without ?date returns 422', async () => {
    const result = await handler.handle(event());

    expect(result.statusCode).toBe(HttpCode.UNPROCESSABLE_ENTITY);
    expect(appointmentServiceMock.listAppointmentsByDate).not.toHaveBeenCalled();
  });

  it('POST /appointments responds 201', async () => {
    appointmentServiceMock.createAppointment.mockResolvedValue(appointmentDto);

    const result = await handler.handle(
      event({
        httpMethod: 'POST',
        body: JSON.stringify({
          clientId: '11111111-1111-4111-8111-111111111111',
          vehicleId: '22222222-2222-4222-8222-222222222222',
          date: '2026-10-20',
          time: '09:00',
        }),
      })
    );

    expect(result.statusCode).toBe(HttpCode.CREATED);
    expect(JSON.parse(result.body).data.appointment.id).toBe(APPOINTMENT_ID);
  });

  it('POST /appointments without body responds 422', async () => {
    const result = await handler.handle(event({ httpMethod: 'POST' }));
    expect(result.statusCode).toBe(HttpCode.UNPROCESSABLE_ENTITY);
    expect(appointmentServiceMock.createAppointment).not.toHaveBeenCalled();
  });

  it('PUT /appointments/{id} reschedules and responds 200', async () => {
    appointmentServiceMock.updateAppointment.mockResolvedValue({
      ...appointmentDto,
      date: '2026-10-21',
      time: '11:30:00',
    });

    const result = await handler.handle(
      event({
        httpMethod: 'PUT',
        resource: '/appointments/{id}',
        pathParameters: { id: APPOINTMENT_ID },
        body: JSON.stringify({ date: '2026-10-21', time: '11:30' }),
      })
    );

    expect(result.statusCode).toBe(HttpCode.OK);
    expect(appointmentServiceMock.updateAppointment).toHaveBeenCalledWith(APPOINTMENT_ID, {
      date: '2026-10-21',
      time: '11:30',
    });
  });

  it('PATCH /appointments/{id}/cancel responds 200 with DISABLED', async () => {
    appointmentServiceMock.cancelAppointment.mockResolvedValue({
      ...appointmentDto,
      status: 'DISABLED',
    });

    const result = await handler.handle(
      event({
        httpMethod: 'PATCH',
        resource: '/appointments/{id}/cancel',
        pathParameters: { id: APPOINTMENT_ID },
      })
    );

    expect(result.statusCode).toBe(HttpCode.OK);
    expect(JSON.parse(result.body).data.appointment.status).toBe('DISABLED');
  });

  it('converts service ConflictError into 409', async () => {
    appointmentServiceMock.createAppointment.mockRejectedValue(
      new ConflictError('The slot is already booked')
    );

    const result = await handler.handle(
      event({ httpMethod: 'POST', body: JSON.stringify({ date: '2026-10-20' }) })
    );

    expect(result.statusCode).toBe(HttpCode.CONFLICT);
  });

  it('converts service NotFoundError into 404', async () => {
    appointmentServiceMock.cancelAppointment.mockRejectedValue(new NotFoundError('Appointment'));

    const result = await handler.handle(
      event({
        httpMethod: 'PATCH',
        resource: '/appointments/{id}/cancel',
        pathParameters: { id: APPOINTMENT_ID },
      })
    );

    expect(result.statusCode).toBe(HttpCode.NOT_FOUND);
    expect(JSON.parse(result.body).error.code).toBe('NOT_FOUND');
  });

  it('never exposes the stack trace in unexpected errors', async () => {
    appointmentServiceMock.createAppointment.mockRejectedValue(
      new Error('postgres://user:secretpassword@host:5432/db')
    );

    const result = await handler.handle(
      event({ httpMethod: 'POST', body: JSON.stringify({ date: '2026-10-20' }) })
    );

    expect(result.statusCode).toBe(HttpCode.INTERNAL_SERVER_ERROR);
    expect(result.body).not.toContain('secretpassword');
    expect(loggerMock.error).toHaveBeenCalled();
  });

  it('unknown routes respond 422 with the error envelope', async () => {
    const result = await handler.handle(event({ httpMethod: 'DELETE' }));
    expect(result.statusCode).toBe(HttpCode.UNPROCESSABLE_ENTITY);
    expect(JSON.parse(result.body).success).toBe(false);
  });

  it('OPTIONS responds 204 (CORS preflight)', async () => {
    const result = await handler.handle(event({ httpMethod: 'OPTIONS' }));
    expect(result.statusCode).toBe(HttpCode.NO_CONTENT);
    expect(result.headers['Access-Control-Allow-Methods']).toContain('PUT');
  });
});