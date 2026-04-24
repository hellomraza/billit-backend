import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
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
import {
  AdjustStockDto,
  CreateStockDto,
  StockResponseDto,
  UpdateStockDto,
} from './dto/stock.dto';
import { StockService } from './stock.service';

@UseGuards(JwtAuthGuard, TenantValidationGuard)
@ApiBearerAuth('access-token')
@ApiTags('Stock')
@Controller('tenants/:tenantId/stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @ApiOperation({ summary: 'Create a new stock record' })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 201,
    description: 'Stock record created successfully',
    type: StockResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @Post()
  async create(
    @Param('tenantId') tenantId: string,
    @Body() createStockDto: CreateStockDto,
  ) {
    const stock = await this.stockService.create(tenantId, createStockDto);
    return this.stockToResponse(stock);
  }

  @ApiOperation({ summary: 'Get all stock records for tenant (paginated)' })
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
    description: 'Paginated list of stock records',
    schema: {
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/StockResponseDto' },
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
    const { data, total } = await this.stockService.findAll(
      tenantId,
      parseInt(page),
      parseInt(limit),
    );
    return {
      data: data.map((s) => this.stockToResponse(s)),
      total,
      page: parseInt(page),
      limit: parseInt(limit),
    };
  }

  @ApiOperation({ summary: 'Get stock record by ID' })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiParam({
    name: 'stockId',
    description: 'Stock record ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Stock record found',
    type: StockResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Stock record or tenant not found' })
  @Get(':stockId')
  async findById(
    @Param('tenantId') tenantId: string,
    @Param('stockId') stockId: string,
  ) {
    const stock = await this.stockService.findById(tenantId, stockId);
    return this.stockToResponse(stock);
  }

  @ApiOperation({ summary: 'Get stock by product and outlet' })
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
    description: 'Stock found',
    type: StockResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Stock record or tenant not found' })
  @Get('product/:productId/outlet/:outletId')
  async findByProductAndOutlet(
    @Param('tenantId') tenantId: string,
    @Param('productId') productId: string,
    @Param('outletId') outletId: string,
  ) {
    const stock = await this.stockService.findByProductAndOutlet(
      tenantId,
      productId,
      outletId,
    );
    return this.stockToResponse(stock);
  }

  @ApiOperation({ summary: 'Get all stock records for an outlet' })
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
    description: 'List of stock records for outlet',
    schema: {
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/StockResponseDto' },
        },
      },
    },
  })
  @Get('outlet/:outletId')
  async findByOutlet(
    @Param('tenantId') tenantId: string,
    @Param('outletId') outletId: string,
  ) {
    const stocks = await this.stockService.findByOutlet(tenantId, outletId);
    return {
      data: stocks.map((s) => this.stockToResponse(s)),
    };
  }

  @ApiOperation({ summary: 'Get all stock records for a product' })
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
    description: 'List of stock records for product',
    schema: {
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/StockResponseDto' },
        },
      },
    },
  })
  @Get('product/:productId')
  async findByProduct(
    @Param('tenantId') tenantId: string,
    @Param('productId') productId: string,
  ) {
    const stocks = await this.stockService.findByProduct(tenantId, productId);
    return {
      data: stocks.map((s) => this.stockToResponse(s)),
    };
  }

  /**
   * UPDATE STOCK QUANTITY
   *
   * ENDPOINT DESIGN RATIONALE:
   * Stock in this system is outlet-scoped. Each product has separate stock quantities at each outlet.
   * Therefore, the stock record ID (not just productId) must be used to unambiguously identify which stock to update.
   *
   * REQUEST FLOW:
   * 1. Frontend finds the stock record: GET /tenants/:tenantId/stock/product/:productId/outlet/:outletId
   * 2. Frontend uses the returned stockId in the PUT request: PUT /tenants/:tenantId/stock/:stockId
   * 3. Backend creates audit log and updates stock atomically
   *
   * COMPLIANCE:
   * - Writes audit log entry (ChangeType.MANUAL_UPDATE) - See StockAuditLogService
   * - Updates stock record atomically
   * - Does not auto-resolve deficits
   * - Validates quantity is integer >= 0
   */
  @ApiOperation({ summary: 'Update stock quantity' })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiParam({
    name: 'stockId',
    description:
      'Stock record ID (MongoDB ObjectId) - Identifies a product-outlet combination',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Stock updated successfully',
    type: StockResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Stock record or tenant not found' })
  @Put(':stockId')
  async update(
    @Param('tenantId') tenantId: string,
    @Param('stockId') stockId: string,
    @Body() updateStockDto: UpdateStockDto,
  ) {
    const stock = await this.stockService.update(
      tenantId,
      stockId,
      updateStockDto,
    );
    return this.stockToResponse(stock);
  }

  @ApiOperation({ summary: 'Adjust stock quantity (increase or decrease)' })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiParam({
    name: 'stockId',
    description: 'Stock record ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Stock adjusted successfully',
    type: StockResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Stock record or tenant not found' })
  @Post(':stockId/adjust')
  @HttpCode(HttpStatus.OK)
  async adjust(
    @Param('tenantId') tenantId: string,
    @Param('stockId') stockId: string,
    @Body() adjustStockDto: AdjustStockDto,
  ) {
    // Get the stock to find product and outlet
    const stock = await this.stockService.findById(tenantId, stockId);
    const adjustedStock = await this.stockService.adjust(
      tenantId,
      stock.productId.toString(),
      stock.outletId.toString(),
      adjustStockDto,
    );
    return this.stockToResponse(adjustedStock);
  }

  @ApiOperation({ summary: 'Delete stock record' })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiParam({
    name: 'stockId',
    description: 'Stock record ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 204,
    description: 'Stock record deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Stock record or tenant not found' })
  @Delete(':stockId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('tenantId') tenantId: string,
    @Param('stockId') stockId: string,
  ) {
    await this.stockService.delete(tenantId, stockId);
  }

  private stockToResponse(stock: any): StockResponseDto {
    return {
      _id: stock._id?.toString(),
      tenantId: stock.tenantId?.toString(),
      productId: stock.productId?.toString(),
      outletId: stock.outletId?.toString(),
      quantity: stock.quantity,
      updatedAt: stock.updatedAt,
    };
  }
}
