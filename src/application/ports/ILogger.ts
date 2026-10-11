export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';

export interface LogContext {
  [key: string]: unknown;
}

/**
 * Logging port: the application depends on this abstraction, not on pino.
 * Allows swapping the logger in unit tests (DIP).
 */
export interface ILogger {
  fatal(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
  trace(message: string, context?: LogContext): void;
  child(context: LogContext): ILogger;
}
