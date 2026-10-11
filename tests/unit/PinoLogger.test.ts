import { describe, expect, it } from 'vitest';
import { PinoLogger } from '../../src/infrastructure/logging/PinoLogger';

const silentOptions = { level: 'silent' as const, pretty: false, base: {} };

describe('PinoLogger', () => {
  it('implements every ILogger port operation', () => {
    const logger = new PinoLogger(silentOptions);

    expect(() => {
      logger.fatal('fatal', { x: 1 });
      logger.error('error', { x: 1 });
      logger.warn('warn', { x: 1 });
      logger.info('info', { x: 1 });
      logger.debug('debug', { x: 1 });
      logger.trace('trace', { x: 1 });
    }).not.toThrow();
  });

  it('does not fail when logging contexts with sensitive data', () => {
    const logger = new PinoLogger({ level: 'info', pretty: false, base: {} });

    expect(() => {
      logger.info('login attempt', { request: { password: 'hunter22', token: 'abc123' } });
    }).not.toThrow();
  });

  it('child() returns an independent instance with injected context', () => {
    const logger = new PinoLogger(silentOptions);
    const child = logger.child({ requestId: 'abc' });

    expect(child).toBeInstanceOf(PinoLogger);
    expect(child).not.toBe(logger);
  });
});