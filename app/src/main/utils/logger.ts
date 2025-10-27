/**
 * Simple logger utility for service method calls
 * Provides structured logging with timing, context, and error tracking
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export interface LogContext {
  service: string;
  method: string;
  [key: string]: any;
}

export interface LogEntry {
  level: LogLevel;
  timestamp: string;
  context: LogContext;
  message?: string;
  error?: string;
  duration?: number;
}

class Logger {
  private logLevel: LogLevel = LogLevel.INFO;

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentIndex = levels.indexOf(this.logLevel);
    const requestedIndex = levels.indexOf(level);
    return requestedIndex >= currentIndex;
  }

  private formatLogEntry(entry: LogEntry): string {
    const parts = [
      `[${entry.timestamp}]`,
      `[${entry.level}]`,
      `[${entry.context.service}.${entry.context.method}]`,
    ];

    if (entry.message) {
      parts.push(entry.message);
    }

    if (entry.duration !== undefined) {
      parts.push(`(${entry.duration}ms)`);
    }

    if (entry.error) {
      parts.push(`ERROR: ${entry.error}`);
    }

    // Add additional context
    const extraContext = Object.entries(entry.context)
      .filter(([key]) => key !== 'service' && key !== 'method')
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
      .join(', ');

    if (extraContext) {
      parts.push(`{${extraContext}}`);
    }

    return parts.join(' ');
  }

  private log(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) {
      return;
    }

    const formatted = this.formatLogEntry(entry);

    switch (entry.level) {
      case LogLevel.ERROR:
        console.error(formatted);
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      case LogLevel.DEBUG:
        console.debug(formatted);
        break;
      default:
        console.log(formatted);
    }
  }

  debug(context: LogContext, message?: string): void {
    this.log({
      level: LogLevel.DEBUG,
      timestamp: new Date().toISOString(),
      context,
      message,
    });
  }

  info(context: LogContext, message?: string): void {
    this.log({
      level: LogLevel.INFO,
      timestamp: new Date().toISOString(),
      context,
      message,
    });
  }

  warn(context: LogContext, message?: string): void {
    this.log({
      level: LogLevel.WARN,
      timestamp: new Date().toISOString(),
      context,
      message,
    });
  }

  error(context: LogContext, error: Error | string): void {
    this.log({
      level: LogLevel.ERROR,
      timestamp: new Date().toISOString(),
      context,
      error: error instanceof Error ? error.message : error,
    });
  }

  /**
   * Wrap a service method with automatic logging and timing
   */
  async logServiceCall<T>(
    context: LogContext,
    fn: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();

    this.debug(context, 'Starting');

    try {
      const result = await fn();
      const duration = Date.now() - startTime;

      this.info({ ...context, duration }, 'Completed');

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.error({ ...context, duration }, error as Error);

      throw error;
    }
  }

  /**
   * Wrap a synchronous service method with automatic logging and timing
   */
  logServiceCallSync<T>(context: LogContext, fn: () => T): T {
    const startTime = Date.now();

    this.debug(context, 'Starting');

    try {
      const result = fn();
      const duration = Date.now() - startTime;

      this.info({ ...context, duration }, 'Completed');

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.error({ ...context, duration }, error as Error);

      throw error;
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Enable debug logging in development
if (process.env.NODE_ENV === 'development') {
  logger.setLogLevel(LogLevel.DEBUG);
}
