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

  @ApiOperation({
    summary: 'Get deficit summary for tenant default outlet',
    description:
      'Returns a compact summary of pending deficits (pending product count, sum of pending quantities, indicator).',
  })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Deficit summary',
    schema: {
      properties: {
        pendingProductCount: { type: 'number' },
        totalPendingQuantity: { type: 'number' },
        hasDeficits: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized — bad or missing JWT' })
  @ApiResponse({ status: 404, description: 'Tenant or default outlet not found' })
  @Get('deficit-summary')
  async getDeficitSummary(@Param('tenantId') tenantId: string) {
    return this.analyticsService.getDeficitSummary(tenantId);
  }

  @ApiOperation({
    summary: 'Get revenue summary cards (net revenue, invoices count, refunds count, refund amounts, avg invoice)',
    description:
      'Returns the precomputed and live-merged metrics for the specified period.',
  })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiQuery({
    name: 'period',
    description: 'Time period to query (today, this_week, this_month, last7days, last30days, last90days, custom)',
    example: 'last30days',
    required: false,
    default: 'last30days',
  })
  @ApiQuery({
    name: 'dateFrom',
    description: 'Start date in YYYY-MM-DD format (required only when period = custom)',
    example: '2026-05-01',
    required: false,
  })
  @ApiQuery({
    name: 'dateTo',
    description: 'End date in YYYY-MM-DD format (required only when period = custom)',
    example: '2026-05-25',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Revenue summary cards data',
    schema: {
      properties: {
        period: { type: 'string' },
        startDate: { type: 'string' },
        endDate: { type: 'string' },
        totalNetRevenue: { type: 'number' },
        totalInvoices: { type: 'number' },
        totalRefundsCount: { type: 'number' },
        totalRefundsAmount: { type: 'number' },
        avgInvoiceValue: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  @ApiResponse({ status: 401, description: 'Unauthorized — bad or missing JWT' })
  @ApiResponse({ status: 404, description: 'Tenant or default outlet not found' })
  @Get('revenue-summary')
  async getRevenueSummary(
    @Param('tenantId') tenantId: string,
    @Query('period') period: string = 'last30days',
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.analyticsService.getRevenueSummary(
      tenantId,
      period,
      dateFrom,
      dateTo,
    );
  }

  @ApiOperation({
    summary: 'Get revenue chart data points grouped by day, week, or hour',
    description:
      'Returns daily, weekly, or hourly revenue metrics (net revenue, gross revenue, discounts, invoice count) for the period.',
  })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiQuery({
    name: 'period',
    description: 'Time period to query (today, this_week, this_month, last7days, last30days, last90days, custom)',
    example: 'last30days',
    required: false,
    default: 'last30days',
  })
  @ApiQuery({
    name: 'dateFrom',
    description: 'Start date in YYYY-MM-DD format (required only when period = custom)',
    example: '2026-05-01',
    required: false,
  })
  @ApiQuery({
    name: 'dateTo',
    description: 'End date in YYYY-MM-DD format (required only when period = custom)',
    example: '2026-05-25',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Revenue chart data points',
    schema: {
      properties: {
        aggregation: { type: 'string', enum: ['hourly', 'daily', 'weekly'] },
        dataPoints: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              netRevenue: { type: 'number' },
              grossRevenue: { type: 'number' },
              discounts: { type: 'number' },
              invoiceCount: { type: 'number' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  @ApiResponse({ status: 401, description: 'Unauthorized — bad or missing JWT' })
  @ApiResponse({ status: 404, description: 'Tenant or default outlet not found' })
  @Get('revenue-chart')
  async getRevenueChart(
    @Param('tenantId') tenantId: string,
    @Query('period') period: string = 'last30days',
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.analyticsService.getRevenueChart(
      tenantId,
      period,
      dateFrom,
      dateTo,
    );
  }

  @ApiOperation({
    summary: 'Get top products by net revenue',
    description:
      'Returns the top 10 products sorted by net revenue descending in the given period, merging historical data with today\'s live sales.',
  })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiQuery({
    name: 'period',
    description: 'Time period to query (today, this_week, this_month, last7days, last30days, last90days, custom)',
    example: 'last30days',
    required: false,
    default: 'last30days',
  })
  @ApiQuery({
    name: 'dateFrom',
    description: 'Start date in YYYY-MM-DD format (required only when period = custom)',
    example: '2026-05-01',
    required: false,
  })
  @ApiQuery({
    name: 'dateTo',
    description: 'End date in YYYY-MM-DD format (required only when period = custom)',
    example: '2026-05-25',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Top products by revenue',
    schema: {
      properties: {
        topProducts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              rank: { type: 'number' },
              productId: { type: 'string' },
              productName: { type: 'string' },
              netRevenue: { type: 'number' },
              unitsSold: { type: 'number' },
              percentOfTotal: { type: 'number' },
            },
          },
        },
        totalNetRevenue: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  @ApiResponse({ status: 401, description: 'Unauthorized — bad or missing JWT' })
  @ApiResponse({ status: 404, description: 'Tenant or default outlet not found' })
  @Get('top-products')
  async getTopProducts(
    @Param('tenantId') tenantId: string,
    @Query('period') period: string = 'last30days',
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.analyticsService.getTopProducts(
      tenantId,
      period,
      dateFrom,
      dateTo,
    );
  }

  @ApiOperation({
    summary: 'Get payment method breakdown of sales',
    description:
      'Returns a breakdown of sales (invoice counts, amounts, percentages) grouped by payment method (CASH, CARD, UPI) for a given period.',
  })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiQuery({
    name: 'period',
    description: 'Time period to query (today, this_week, this_month, last7days, last30days, last90days, custom)',
    example: 'last30days',
    required: false,
    default: 'last30days',
  })
  @ApiQuery({
    name: 'dateFrom',
    description: 'Start date in YYYY-MM-DD format (required only when period = custom)',
    example: '2026-05-01',
    required: false,
  })
  @ApiQuery({
    name: 'dateTo',
    description: 'End date in YYYY-MM-DD format (required only when period = custom)',
    example: '2026-05-25',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Payment method breakdown of sales',
    schema: {
      properties: {
        paymentBreakdown: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              paymentMethod: { type: 'string', enum: ['CASH', 'CARD', 'UPI'] },
              invoiceCount: { type: 'number' },
              totalAmount: { type: 'number' },
              percentage: { type: 'number' },
            },
          },
        },
        totalInvoices: { type: 'number' },
        totalAmount: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  @ApiResponse({ status: 401, description: 'Unauthorized — bad or missing JWT' })
  @ApiResponse({ status: 404, description: 'Tenant or default outlet not found' })
  @Get('payment-breakdown')
  async getPaymentBreakdown(
    @Param('tenantId') tenantId: string,
    @Query('period') period: string = 'last30days',
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.analyticsService.getPaymentBreakdown(
      tenantId,
      period,
      dateFrom,
      dateTo,
    );
  }

  @ApiOperation({
    summary: 'Get GST collected and GST vs non-GST invoice count',
    description:
      'Returns the total GST collected and counts of GST vs non-GST invoices within a specific period.',
  })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiQuery({
    name: 'period',
    description: 'Time period to query (today, this_week, this_month, last7days, last30days, last90days, custom)',
    example: 'last30days',
    required: false,
    default: 'last30days',
  })
  @ApiQuery({
    name: 'dateFrom',
    description: 'Start date in YYYY-MM-DD format (required only when period = custom)',
    example: '2026-05-01',
    required: false,
  })
  @ApiQuery({
    name: 'dateTo',
    description: 'End date in YYYY-MM-DD format (required only when period = custom)',
    example: '2026-05-25',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'GST summary collected data',
    schema: {
      properties: {
        totalGstCollected: { type: 'number' },
        gstInvoiceCount: { type: 'number' },
        nonGstInvoiceCount: { type: 'number' },
        hasGstData: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  @ApiResponse({ status: 401, description: 'Unauthorized — bad or missing JWT' })
  @ApiResponse({ status: 404, description: 'Tenant or default outlet not found' })
  @Get('gst-summary')
  async getGstSummary(
    @Param('tenantId') tenantId: string,
    @Query('period') period: string = 'last30days',
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.analyticsService.getGstSummary(
      tenantId,
      period,
      dateFrom,
      dateTo,
    );
  }
}

