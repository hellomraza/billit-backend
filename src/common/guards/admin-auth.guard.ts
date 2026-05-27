import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Guard for administrative endpoints.
 *
 * Verifies that the client provided the correct secret key in the
 * X-Admin-Secret request header matching process.env.ADMIN_SECRET.
 */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  private readonly logger = new Logger(AdminAuthGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const adminSecretHeader = req.headers['x-admin-secret'];

    const expectedSecret = this.configService.get<string>('ADMIN_SECRET');
    if (!expectedSecret) {
      this.logger.error('[AdminAuth] ADMIN_SECRET env variable is not set!');
      throw new ForbiddenException('Admin secret not configured on server');
    }

    if (!adminSecretHeader) {
      this.logger.warn('[AdminAuth] Rejected request: missing X-Admin-Secret header');
      throw new ForbiddenException('Missing X-Admin-Secret header');
    }

    if (adminSecretHeader !== expectedSecret) {
      this.logger.warn('[AdminAuth] Rejected request: invalid X-Admin-Secret header');
      throw new ForbiddenException('Invalid admin secret');
    }

    return true;
  }
}
