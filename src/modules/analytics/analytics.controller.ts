import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TenantValidationGuard } from '../../common/guards';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics API')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, TenantValidationGuard)
@Controller('tenants/:tenantId/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @ApiOperation({
    summary: 'Get low stock products for tenant default outlet',
    description:
      'Returns all active products with stock quantity <= 10 at the tenant default outlet, sorted ascending.',
  })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'List of low stock products',
    schema: {
      properties: {
        lowStockProducts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              productId: { type: 'string' },
              productName: { type: 'string' },
              currentStock: { type: 'number' },
              stockStatus: { type: 'string', enum: ['NEGATIVE', 'OUT_OF_STOCK', 'LOW'] },
            },
          },
        },
        count: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized — bad or missing JWT' })
  @ApiResponse({ status: 404, description: 'Tenant or default outlet not found' })
  @Get('low-stock')
  async getLowStock(@Param('tenantId') tenantId: string) {
    return this.analyticsService.getLowStock(tenantId);
  }
}
