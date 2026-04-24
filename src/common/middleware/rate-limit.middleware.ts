import { HttpStatus, Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

/**
 * Simple Rate Limiter Middleware
 * Implements basic in-memory rate limiting per IP address
 * For production, use express-rate-limit or similar package with Redis backend
 */
@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly requestCounts = new Map<string, Array<number>>();
  private readonly windowMs = 60 * 1000; // 1 minute window
  private readonly maxRequests = 100; // 100 requests per minute per IP

  use(req: Request, res: Response, next: NextFunction) {
    // Skip rate limiting for health checks and public endpoints
    if (
      req.path === '/health' ||
      req.path === '/health/live' ||
      req.path === '/health/ready' ||
      req.path === '/api'
    ) {
      return next();
    }

    const ip = this.getClientIp(req);
    const now = Date.now();

    // Get request timestamps for this IP
    let requests = this.requestCounts.get(ip) || [];

    // Remove old requests outside the window
    requests = requests.filter((timestamp) => now - timestamp < this.windowMs);

    // Check if limit exceeded
    if (requests.length >= this.maxRequests) {
      const retryAfterMs = Math.ceil(this.windowMs / 1000);
      res.set('Retry-After', retryAfterMs.toString());
      res.set('X-RateLimit-Limit', this.maxRequests.toString());
      res.set('X-RateLimit-Remaining', '0');
      res.set('X-RateLimit-Reset', new Date(now + this.windowMs).toISOString());

      return res.status(HttpStatus.TOO_MANY_REQUESTS).json({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Too many requests, please try again later',
        error: 'Rate limit exceeded',
        retryAfter: retryAfterMs,
        timestamp: new Date().toISOString(),
        path: req.url,
      });
    }

    // Add current request timestamp
    requests.push(now);
    this.requestCounts.set(ip, requests);

    // Clean up old IPs from memory (every 100 requests)
    if (Math.random() < 0.01) {
      this.cleanupOldEntries();
    }

    // Set rate limit info headers
    res.set('X-RateLimit-Limit', this.maxRequests.toString());
    res.set(
      'X-RateLimit-Remaining',
      Math.max(0, this.maxRequests - requests.length).toString(),
    );
    res.set('X-RateLimit-Reset', new Date(now + this.windowMs).toISOString());

    next();
  }

  /**
   * Get client IP address from request
   */
  private getClientIp(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown'
    );
  }

  /**
   * Clean up old entries to prevent memory leaks
   */
  private cleanupOldEntries(): void {
    const now = Date.now();
    for (const [ip, requests] of this.requestCounts.entries()) {
      const validRequests = requests.filter((t) => now - t < this.windowMs);
      if (validRequests.length === 0) {
        this.requestCounts.delete(ip);
      } else {
        this.requestCounts.set(ip, validRequests);
      }
    }
  }
}
