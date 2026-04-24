import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

/**
 * Request Logging Middleware
 * Logs all HTTP requests with method, path, status, and duration
 * Excludes health check and static asset requests
 */
@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, ip } = req;
    const startTime = Date.now();
    const logger = this.logger;

    // Skip logging for health checks and static assets
    if (
      originalUrl.includes('/health') ||
      originalUrl.includes('/swagger') ||
      originalUrl.includes('/api-docs')
    ) {
      return next();
    }

    // Capture the original send method
    const originalSend = res.send;

    // Override the send method to capture response details
    res.send = function (data: any) {
      const duration = Date.now() - startTime;
      const { statusCode } = res;
      const contentLength = res.get('content-length') || '0';

      // Color-code log based on status
      const statusColor =
        statusCode >= 500
          ? 'error'
          : statusCode >= 400
            ? 'warn'
            : statusCode >= 300
              ? 'log'
              : 'log';

      const logMessage = `${method} ${originalUrl} ${statusCode} - ${duration}ms [IP: ${ip}] [Size: ${contentLength}B]`;

      if (statusColor === 'error') {
        logger.error(logMessage);
      } else if (statusColor === 'warn') {
        logger.warn(logMessage);
      } else {
        logger.debug(logMessage);
      }

      // Call the original send method
      return originalSend.call(this, data);
    };

    next();
  }
}
