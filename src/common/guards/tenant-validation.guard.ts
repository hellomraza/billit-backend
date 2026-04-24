import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

/**
 * TenantValidationGuard ensures that the tenantId from the JWT token matches
 * the tenantId in the route parameter. This prevents users from accessing
 * data from other tenants by manipulating the URL.
 *
 * Usage: @UseGuards(JwtAuthGuard, TenantValidationGuard)
 */
@Injectable()
export class TenantValidationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // Extract tenantId from JWT token (stored as 'sub' claim)
    const tenantIdFromJwt = request.user?.sub;

    // Extract tenantId from route parameter
    const tenantIdFromRoute = request.params?.tenantId;

    if (!tenantIdFromJwt || !tenantIdFromRoute) {
      throw new ForbiddenException('Missing tenant context');
    }

    if (tenantIdFromJwt !== tenantIdFromRoute) {
      throw new ForbiddenException(
        "Tenant ID mismatch: you do not have access to this tenant's resources",
      );
    }

    return true;
  }
}
