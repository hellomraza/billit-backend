import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Guard for endpoints called by cron-job.org.
 *
 * Two-layer security:
 *   1. IP allowlist — only cron-job.org's known server IPs are accepted.
 *   2. Bearer token  — Authorization: Bearer <CRON_SECRET>
 *
 * Both checks must pass. If either fails the request is rejected immediately.
 */
@Injectable()
export class CronAuthGuard implements CanActivate {
  private readonly logger = new Logger(CronAuthGuard.name);

  /** cron-job.org IP allowlist (https://cron-job.org/en/faq/) */
  private static readonly ALLOWED_IPS: ReadonlySet<string> = new Set([
    '116.203.134.67',
    '116.203.129.16',
    '23.88.105.37',
    '128.140.8.200',
    '91.99.23.109',
  ]);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();

    // ── 1. IP allowlist ────────────────────────────────────────────────────────
    const clientIp = this.extractIp(req);
    if (!CronAuthGuard.ALLOWED_IPS.has(clientIp)) {
      this.logger.warn(
        `[CronAuth] Rejected IP: ${clientIp} — not in allowlist`,
      );
      throw new ForbiddenException('IP not in cron allowlist');
    }

    // ── 2. Bearer token ────────────────────────────────────────────────────────
    const authHeader = req.headers['authorization'] ?? '';
    const [scheme, token] = authHeader.split(' ');

    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException(
        'Authorization: Bearer <CRON_SECRET> header required',
      );
    }

    const expectedSecret = this.configService.get<string>('CRON_SECRET');
    if (!expectedSecret) {
      this.logger.error('[CronAuth] CRON_SECRET env variable is not set!');
      throw new ForbiddenException('Cron secret not configured on server');
    }

    if (token !== expectedSecret) {
      this.logger.warn(
        `[CronAuth] Rejected request from ${clientIp} — invalid token`,
      );
      throw new UnauthorizedException('Invalid cron secret');
    }

    return true;
  }

  /**
   * Extract the real client IP, respecting X-Forwarded-For when behind a proxy.
   * Falls back to req.ip / req.socket.remoteAddress.
   */
  private extractIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      // X-Forwarded-For can be "client, proxy1, proxy2" — take the first value
      const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
      return first.split(',')[0].trim();
    }
    return req.ip ?? req.socket?.remoteAddress ?? '';
  }
}
