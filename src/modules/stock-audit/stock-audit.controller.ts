import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
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
import { StockAuditLogService } from './stock-audit.service';

@UseGuards(JwtAuthGuard, TenantValidationGuard)
@ApiBearerAuth('access-token')
@ApiTags('Stock Audit')
@Controller('tenants/:tenantId/stock-audit')
export class StockAuditController {
  constructor(private readonly stockAuditService: StockAuditLogService) {}

  @ApiOperation({ summary: 'Get all stock audit logs for tenant (paginated)' })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    default: 1,
    description: 'Page number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    default: 10,
    description: 'Records per page',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of stock audit logs',
    schema: {
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/StockAuditLogResponseDto' },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
      },
    },
  })
  @Get()
  async findAll(
    @Param('tenantId') tenantId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const { data, total } = await this.stockAuditService.findAll(
      tenantId,
      parseInt(page),
      parseInt(limit),
    );
    return {
      data,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
    };
  }

  @ApiOperation({ summary: 'Get stock audit logs for a product' })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiParam({
    name: 'productId',
    description: 'Product ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'List of stock audit logs for product',
    schema: {
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/StockAuditLogResponseDto' },
        },
      },
    },
  })
  @Get('product/:productId')
  async findByProduct(
    @Param('tenantId') tenantId: string,
    @Param('productId') productId: string,
  ) {
    const logs = await this.stockAuditService.findByProduct(
      tenantId,
      productId,
    );
    return { data: logs };
  }

  @ApiOperation({ summary: 'Get stock audit logs for an outlet' })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiParam({
    name: 'outletId',
    description: 'Outlet ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'List of stock audit logs for outlet',
    schema: {
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/StockAuditLogResponseDto' },
        },
      },
    },
  })
  @Get('outlet/:outletId')
  async findByOutlet(
    @Param('tenantId') tenantId: string,
    @Param('outletId') outletId: string,
  ) {
    const logs = await this.stockAuditService.findByOutlet(tenantId, outletId);
    return { data: logs };
  }

  @ApiOperation({
    summary: 'Get stock audit logs for a product-outlet combination',
  })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiParam({
    name: 'productId',
    description: 'Product ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiParam({
    name: 'outletId',
    description: 'Outlet ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'List of stock audit logs for product-outlet pair',
    schema: {
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/StockAuditLogResponseDto' },
        },
      },
    },
  })
  @Get('product/:productId/outlet/:outletId')
  async findByProductAndOutlet(
    @Param('tenantId') tenantId: string,
    @Param('productId') productId: string,
    @Param('outletId') outletId: string,
  ) {
    const logs = await this.stockAuditService.findByProductAndOutlet(
      tenantId,
      productId,
      outletId,
    );
    return { data: logs };
  }

  @ApiOperation({
    summary: 'Get sales history for an outlet within date range',
  })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiParam({
    name: 'outletId',
    description: 'Outlet ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiQuery({
    name: 'startDate',
    required: true,
    description: 'Start date (ISO format)',
    example: '2026-04-01T00:00:00.000Z',
  })
  @ApiQuery({
    name: 'endDate',
    required: true,
    description: 'End date (ISO format)',
    example: '2026-04-30T23:59:59.999Z',
  })
  @ApiResponse({
    status: 200,
    description: 'Sales history for the outlet',
    schema: {
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/StockAuditLogResponseDto' },
        },
      },
    },
  })
  @Get('sales-history/:outletId')
  async getSalesHistory(
    @Param('tenantId') tenantId: string,
    @Param('outletId') outletId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const logs = await this.stockAuditService.getSalesHistory(
      tenantId,
      outletId,
      new Date(startDate),
      new Date(endDate),
    );
    return { data: logs };
  }
}
