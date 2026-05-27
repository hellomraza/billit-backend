import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
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
              stockStatus: {
                type: 'string',
                enum: ['NEGATIVE', 'OUT_OF_STOCK', 'LOW'],
              },
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

  @ApiOperation({
    summary: 'Get product health categories (Fast/Slow/Dead/Normal)',
    description:
      'Computes and returns categorized lists of products based on sales performance in a given time window.',
  })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiQuery({
    name: 'window',
    description: 'Time window in days (7, 30, or 90)',
    example: 30,
    required: false,
    default: 30,
  })
  @ApiResponse({
    status: 200,
    description: 'Product health classification lists',
    schema: {
      properties: {
        window: { type: 'number' },
        categoriesAvailable: { type: 'boolean' },
        insufficientReason: {
          type: 'string',
          nullable: true,
          enum: ['INSUFFICIENT_PRODUCTS', 'INSUFFICIENT_DIFFERENTIATION', null],
        },
        fastSelling: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              productId: { type: 'string' },
              productName: { type: 'string' },
              avgDailySales: { type: 'number' },
              totalSoldInWindow: { type: 'number' },
            },
          },
        },
        slowSelling: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              productId: { type: 'string' },
              productName: { type: 'string' },
              avgDailySales: { type: 'number' },
              daysSinceLastSale: { type: 'number' },
            },
          },
        },
        deadStock: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              productId: { type: 'string' },
              productName: { type: 'string' },
              daysSinceLastSale: { type: 'number' },
              currentStock: { type: 'number' },
            },
          },
        },
        normal: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              productId: { type: 'string' },
              productName: { type: 'string' },
              avgDailySales: { type: 'number' },
              totalSoldInWindow: { type: 'number' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  @ApiResponse({ status: 401, description: 'Unauthorized — bad or missing JWT' })
  @ApiResponse({ status: 404, description: 'Tenant or default outlet not found' })
  @Get('product-health')
  async getProductHealth(
    @Param('tenantId') tenantId: string,
    @Query('window') windowQuery: string = '30',
  ) {
    const window = parseInt(windowQuery, 10);
    if (![7, 30, 90].includes(window)) {
      throw new BadRequestException('Window must be 7, 30, or 90');
    }
    return this.analyticsService.getProductHealth(tenantId, window);
  }
}
