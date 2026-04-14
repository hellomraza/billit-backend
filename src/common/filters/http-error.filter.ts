import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Standard error response format
 */
interface ErrorResponse {
  statusCode: number;
  message: string;
  error: string;
  timestamp: string;
  path: string;
  details?: Record<string, any>;
}

/**
 * Global HTTP Exception Filter
 * Catches all HTTP exceptions and returns consistent error responses
 */
@Catch(HttpException)
export class HttpErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpErrorFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Extract error details
    let message = exception.message || 'Internal Server Error';
    let details: Record<string, any> | undefined;

    if (typeof exceptionResponse === 'object') {
      const responseBody = exceptionResponse as any;
      message = responseBody.message || message;

      // Preserve validation errors and other details
      if (responseBody.error) {
        details = {
          error: responseBody.error,
          ...('message' in responseBody && {
            validationErrors: responseBody.message,
          }),
        };
      }
    }

    const errorResponse: ErrorResponse = {
      statusCode: status,
      message,
      error: this.getErrorName(status),
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(details && { details }),
    };

    // Log errors
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url}`,
        exception.stack,
        'HttpErrorFilter',
      );
    } else if (status >= HttpStatus.BAD_REQUEST) {
      this.logger.warn(
        `${request.method} ${request.url} - ${status} ${message}`,
      );
    }

    response.status(status).json(errorResponse);
  }

  /**
   * Get human-readable error name from HTTP status code
   */
  private getErrorName(status: number): string {
    const errorMap: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'Bad Request',
      [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
      [HttpStatus.FORBIDDEN]: 'Forbidden',
      [HttpStatus.NOT_FOUND]: 'Not Found',
      [HttpStatus.CONFLICT]: 'Conflict',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'Validation Error',
      [HttpStatus.TOO_MANY_REQUESTS]: 'Too Many Requests',
      [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
      [HttpStatus.SERVICE_UNAVAILABLE]: 'Service Unavailable',
    };

    return errorMap[status] || 'Unknown Error';
  }
}
