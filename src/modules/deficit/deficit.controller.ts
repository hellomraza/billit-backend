import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdjustmentReason, ResolutionMethod } from './deficit.schema';
import { DeficitService } from './deficit.service';
import { DeficitResponseDto } from './dto/deficit.dto';

@ApiTags('Deficits')
@Controller('tenants/:tenantId/deficits')
export class DeficitController {
  constructor(private readonly deficitService: DeficitService) {}

  @ApiOperation({ summary: 'Get all deficit records for tenant (paginated)' })
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
    description: 'Paginated list of deficit records',
    schema: {
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/DeficitResponseDto' },
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
    const { data, total } = await this.deficitService.findAll(
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
