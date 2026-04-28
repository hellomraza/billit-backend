import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TenantValidationGuard } from '../../common/guards';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdjustmentReason, ResolutionMethod } from './deficit.schema';
import { DeficitService } from './deficit.service';
import {
  DeficitListResponseDto,
  DeficitGroupedProductSummaryDto,
  ResolveAdjustmentDto,
  ResolveStockAdditionDto,
} from './dto/deficit-resolution.dto';
import {
  DeficitResponseDto,
  GetAllWithStatusQueryDto,
} from './dto/deficit.dto';

@UseGuards(JwtAuthGuard, TenantValidationGuard)
@ApiBearerAuth('access-token')
@ApiTags('Deficits')
@Controller('tenants/:tenantId/deficits')
export class DeficitController {
  constructor(private readonly deficitService: DeficitService) {}

  @ApiOperation({
    summary: 'Get all pending deficits grouped by product (paginated)',
    description:
      'Returns pending deficits grouped by product with aggregated quantities, threshold warnings, and expandable record details. Shows latest deficit date and total pending quantity per product.',
  })
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
  @ApiQuery({
    name: 'groupBy',
    required: false,
    enum: ['product', 'flat'],
    default: 'product',
    description: 'Group by product (grouped response) or flat list (legacy)',
  })
  @ApiResponse({
    status: 200,
    description:
      'Paginated list of deficits grouped by product with warning states',
    schema: {
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              productId: { type: 'string' },
              productName: { type: 'string' },
              totalPendingDeficit: { type: 'number' },
              pendingRecordCount: { type: 'number' },
              latestDeficitDate: { type: 'string' },
              deficitThreshold: { type: 'number' },
              warningState: {
                type: 'object',
                properties: {
                  isAtThreshold: { type: 'boolean' },
                  isAboveThreshold: { type: 'boolean' },
                  percentageOfThreshold: { type: 'number' },
                },
              },
              pendingRecords: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    deficitId: { type: 'string' },
                    outletName: { type: 'string' },
                    quantity: { type: 'number' },
                    linkedInvoiceId: { type: 'string' },
                    createdAt: { type: 'string' },
                  },
                },
              },
            },
          },
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
    @Query('groupBy') groupBy: 'product' | 'flat' = 'product',
  ) {
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (groupBy === 'flat') {
      // Legacy flat response
      const { data, total } = await this.deficitService.findAll(
        tenantId,
        pageNum,
        limitNum,
      );
      return {
        data,
        total,
        page: pageNum,
        limit: limitNum,
      };
    }

    // Grouped by product (default)
    const { data, total } = await this.deficitService.findAllGroupedByProduct(
      tenantId,
      pageNum,
      limitNum,
    );

    // Transform to response format with warning state
    const responseData = data.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      totalPendingDeficit: item.totalPendingDeficit,
      pendingRecordCount: item.pendingRecordCount,
      latestDeficitDate: item.latestDeficitDate.toISOString(),
      deficitThreshold: item.deficitThreshold,
      warningState: {
        isAtThreshold:
          item.totalPendingDeficit === item.deficitThreshold &&
          item.totalPendingDeficit > 0,
        isAboveThreshold: item.totalPendingDeficit > item.deficitThreshold,
        percentageOfThreshold: Math.round(
          (item.totalPendingDeficit / Math.max(item.deficitThreshold, 1)) * 100,
        ),
      },
      pendingRecords: item.records.map((record) => ({
        deficitId: record.deficitId,
        outletName: record.outletName,
        quantity: record.quantity,
        linkedInvoiceId: record.linkedInvoiceId,
        createdAt: record.createdAt.toISOString(),
      })),
    }));

    return {
      data: responseData,
      total,
      page: pageNum,
      limit: limitNum,
    };
  }

  @ApiOperation({
    summary: 'Get all pending deficits grouped by product with record details',
  })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description:
      'Pending deficits grouped by product with threshold warning state and expandable record details',
    type: DeficitGroupedProductSummaryDto,
    isArray: true,
  })
  @Get('grouped-by-product')
  async getGroupedByProduct(@Param('tenantId') tenantId: string) {
    const { data } = await this.deficitService.findAllGroupedByProduct(
      tenantId,
      1,
      Number.MAX_SAFE_INTEGER,
    );

    const groupedData = data.map((item) => {
      const pendingRecords = item.records.map((record) => ({
        deficitId: record.deficitId,
        outletName: record.outletName,
        quantity: record.quantity,
        linkedInvoiceId: record.linkedInvoiceId,
        createdAt: record.createdAt.toISOString(),
      }));

      return {
        productId: item.productId,
        productName: item.productName,
        totalPendingDeficit: item.totalPendingDeficit,
        pendingRecordCount: item.pendingRecordCount,
        latestDeficitDate: item.latestDeficitDate.toISOString(),
        deficitThreshold: item.deficitThreshold,
        warningState: {
          isAtThreshold:
            item.totalPendingDeficit === item.deficitThreshold &&
            item.totalPendingDeficit > 0,
          isAboveThreshold: item.totalPendingDeficit > item.deficitThreshold,
          percentageOfThreshold: Math.round(
            (item.totalPendingDeficit / Math.max(item.deficitThreshold, 1)) *
              100,
          ),
        },
        pendingRecords,
        records: pendingRecords,
      };
    });
    return { data: groupedData };
  }

  @ApiOperation({
    summary: 'Get all deficits with optional status filter (paginated)',
  })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'RESOLVED'],
    description: 'Filter by status',
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
    default: 20,
    description: 'Records per page',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated deficits list with status filter',
    type: DeficitListResponseDto,
  })
  @Get('with-status')
  async getAllWithStatus(
    @Param('tenantId') tenantId: string,
    @Query() { limit, page, status }: GetAllWithStatusQueryDto,
  ) {
    const { data, total } = await this.deficitService.findAllWithStatus(
      tenantId,
      status,
      page,
      limit,
    );
    return { data, total, page, limit };
  }

  @ApiOperation({ summary: 'Get deficit record by ID' })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiParam({
    name: 'deficitId',
    description: 'Deficit record ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Deficit record found',
    type: DeficitResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Deficit record or tenant not found',
  })
  @Get(':deficitId')
  async findById(
    @Param('tenantId') tenantId: string,
    @Param('deficitId') deficitId: string,
  ) {
    return this.deficitService.findById(tenantId, deficitId);
  }

  @ApiOperation({ summary: 'Get pending deficit records for a product' })
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
    description: 'List of pending deficit records for product',
    schema: {
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/DeficitResponseDto' },
        },
      },
    },
  })
  @Get('product/:productId')
  async findByProduct(
    @Param('tenantId') tenantId: string,
    @Param('productId') productId: string,
  ) {
    const deficits = await this.deficitService.findPendingByProduct(
      tenantId,
      productId,
    );
    return { data: deficits };
  }

  @ApiOperation({ summary: 'Get pending deficit records for an outlet' })
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
    description: 'List of pending deficit records for outlet',
    schema: {
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/DeficitResponseDto' },
        },
      },
    },
  })
  @Get('outlet/:outletId')
  async findByOutlet(
    @Param('tenantId') tenantId: string,
    @Param('outletId') outletId: string,
  ) {
    const deficits = await this.deficitService.findPendingByOutlet(
      tenantId,
      outletId,
    );
    return { data: deficits };
  }

  @ApiOperation({
    summary:
      'Get total pending deficit quantity for a product-outlet combination',
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
    description: 'Total pending quantity',
    schema: {
      properties: {
        totalQuantity: { type: 'number' },
      },
    },
  })
  @Get('product/:productId/outlet/:outletId/total-quantity')
  async getTotalPendingQuantity(
    @Param('tenantId') tenantId: string,
    @Param('productId') productId: string,
    @Param('outletId') outletId: string,
  ) {
    const totalQuantity = await this.deficitService.getTotalPendingQuantity(
      tenantId,
      productId,
      outletId,
    );
    return { totalQuantity };
  }

  @ApiOperation({
    summary: 'Resolve pending deficits for product by stock addition (FIFO)',
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
  @ApiBody({
    type: ResolveStockAdditionDto,
    description: 'Quantity to add for resolving deficits in FIFO order',
  })
  @ApiResponse({
    status: 200,
    description: 'Deficits resolved by stock addition',
    schema: {
      properties: {
        resolved: {
          type: 'array',
          items: { $ref: '#/components/schemas/DeficitResolvedResponseDto' },
        },
        totalResolved: { type: 'number' },
        remainingQuantity: { type: 'number' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Tenant or product not found',
  })
  @Patch('by-product/:productId/resolve-stock-addition')
  async resolveByStockAddition(
    @Param('tenantId') tenantId: string,
    @Param('productId') productId: string,
    @Body() dto: ResolveStockAdditionDto,
  ) {
    const resolved = await this.deficitService.resolveByStockAddition(
      tenantId,
      productId,
      null, // outletId - resolve across all outlets
      dto.quantity,
    );
    return {
      resolved,
      totalResolved: resolved.length,
    };
  }

  @ApiOperation({
    summary: 'Resolve pending deficits for product by adjustment (write-off)',
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
  @ApiBody({
    type: ResolveAdjustmentDto,
    description: 'Adjustment reason for resolving deficits',
  })
  @ApiResponse({
    status: 200,
    description: 'Deficits resolved by adjustment',
    schema: {
      properties: {
        resolved: {
          type: 'array',
          items: { $ref: '#/components/schemas/DeficitResolvedResponseDto' },
        },
        totalResolved: { type: 'number' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Tenant or product not found',
  })
  @Patch('by-product/:productId/resolve-adjustment')
  async resolveByAdjustment(
    @Param('tenantId') tenantId: string,
    @Param('productId') productId: string,
    @Body() dto: ResolveAdjustmentDto,
  ) {
    const resolved = await this.deficitService.resolveByAdjustment(
      tenantId,
      productId,
      null, // outletId - resolve across all outlets
      dto.reason,
    );
    return {
      resolved,
      totalResolved: resolved.length,
    };
  }

  @ApiOperation({ summary: 'Resolve a deficit record' })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiParam({
    name: 'deficitId',
    description: 'Deficit record ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiBody({
    schema: {
      properties: {
        resolutionMethod: {
          type: 'string',
          enum: ['STOCK_ADDITION', 'ADJUSTMENT'],
          example: 'STOCK_ADDITION',
        },
        adjustmentReason: {
          type: 'string',
          enum: ['DAMAGE', 'LOSS', 'CORRECTION'],
          example: 'DAMAGE',
          nullable: true,
        },
      },
      required: ['resolutionMethod'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Deficit record resolved successfully',
    type: DeficitResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Deficit record or tenant not found',
  })
  @Post(':deficitId/resolve')
  @HttpCode(HttpStatus.OK)
  async resolve(
    @Param('tenantId') tenantId: string,
    @Param('deficitId') deficitId: string,
    @Body()
    body: {
      resolutionMethod: ResolutionMethod;
      adjustmentReason?: AdjustmentReason;
    },
  ) {
    return this.deficitService.resolve(
      tenantId,
      deficitId,
      body.resolutionMethod,
      body.adjustmentReason,
    );
  }
}
