import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
import { UpdateStockDto } from '../stock/dto/stock.dto';
import { StockService } from '../stock/stock.service';
import {
  CreateProductDto,
  ProductResponseDto,
  UpdateProductDto,
} from './dto/product.dto';
import { ProductService } from './product.service';

@UseGuards(JwtAuthGuard, TenantValidationGuard)
@ApiBearerAuth('access-token')
@ApiTags('Products')
@Controller('tenants/:tenantId/products')
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly stockService: StockService,
  ) {}

  @ApiOperation({ summary: 'Create a new product' })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 201,
    description: 'Product created successfully',
    type: ProductResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @Post()
  async create(
    @Param('tenantId') tenantId: string,
    @Body() createProductDto: CreateProductDto,
  ) {
    const product = await this.productService.create(
      tenantId,
      createProductDto,
    );
    return this.productToResponse(product);
  }

  @ApiOperation({ summary: 'Get all products for tenant (paginated)' })
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
    name: 'includeDeleted',
    required: false,
    default: false,
    description: 'Include soft-deleted products',
    example: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of products',
    schema: {
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/ProductResponseDto' },
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
    @Query('includeDeleted') includeDeleted: string = 'false',
  ) {
    const { data, total } = await this.productService.findAll(
      tenantId,
      parseInt(page),
      parseInt(limit),
      includeDeleted === 'true',
    );
    return {
      data: data.map((p) => this.productToResponse(p)),
      total,
      page: parseInt(page),
      limit: parseInt(limit),
    };
  }

  @ApiOperation({ summary: 'Search products by name' })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiQuery({
    name: 'q',
    required: true,
    description: 'Search query text',
    example: 'Laptop',
  })
  @ApiResponse({
    status: 200,
    description: 'Search results',
    schema: {
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/ProductResponseDto' },
        },
      },
    },
  })
  @Get('search')
  async search(
    @Param('tenantId') tenantId: string,
    @Query('q') searchText: string,
  ) {
    const products = await this.productService.search(tenantId, searchText);
    return {
      data: products.map((p) => this.productToResponse(p)),
    };
  }

  @ApiOperation({ summary: 'Get product by ID' })
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
    description: 'Product found',
    type: ProductResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Product or tenant not found' })
  @Get(':productId')
  async findById(
    @Param('tenantId') tenantId: string,
    @Param('productId') productId: string,
  ) {
    const product = await this.productService.findById(tenantId, productId);
    return this.productToResponse(product);
  }

  @ApiOperation({ summary: 'Update product information' })
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
    description: 'Product updated successfully',
    type: ProductResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Product or tenant not found' })
  @Put(':productId')
  async update(
    @Param('tenantId') tenantId: string,
    @Param('productId') productId: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    const product = await this.productService.update(
      tenantId,
      productId,
      updateProductDto,
    );
    return this.productToResponse(product);
  }

  /**
   * UPDATE PRODUCT STOCK AT OUTLET
   *
   * CONTRACT COMPLIANCE (Section 10.7: Manual Stock Update):
   * Route: PATCH /products/:id/stock (as per contract)
   *
   * NOTE ON OUTLET SCOPING:
   * Stock in this system is outlet-scoped. Each product has independent stock at each outlet.
   * Therefore, this endpoint requires an outletId query parameter to specify which outlet's stock to update.
   *
   * RULES:
   * - New quantity must be integer >= 0
   * - Writes stock audit log entry (ChangeType.MANUAL_UPDATE)
   * - Updates the stock record atomically
   * - Does not auto-resolve deficits
   *
   * REQUEST FLOW:
   * 1. API call: PATCH /tenants/:tenantId/products/:productId/stock?outletId=:outletId
   * 2. Body: { "quantity": <number> }
   * 3. Internally routes to: StockService.update() on the product-outlet stock record
   * 4. Response: Updated stock record with audit log created
   */
  @ApiOperation({
    summary: 'Update stock quantity for a product at a specific outlet',
    description:
      'Contract endpoint (10.7). Updates stock for product at outlet. Creates audit log and updates atomically. Stock is outlet-scoped - outletId is required.',
  })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiParam({
    name: 'productId',
    description: 'Product ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439012',
  })
  @ApiQuery({
    name: 'outletId',
    description:
      'Outlet ID (MongoDB ObjectId) - Required to specify which outlet stock to update',
    example: '507f1f77bcf86cd799439013',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Stock updated successfully with audit log created',
    schema: {
      properties: {
        data: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            tenantId: { type: 'string' },
            productId: { type: 'string' },
            outletId: { type: 'string' },
            quantity: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid input (quantity not integer >= 0 or outletId missing)',
  })
  @ApiResponse({
    status: 404,
    description: 'Stock record not found (product not in stock at this outlet)',
  })
  @Patch(':productId/stock')
  @HttpCode(HttpStatus.OK)
  async updateStock(
    @Param('tenantId') tenantId: string,
    @Param('productId') productId: string,
    @Query('outletId') outletId: string,
    @Body() updateStockDto: UpdateStockDto,
  ) {
    // Find the stock record for this product-outlet combination
    const stock = await this.stockService.findByProductAndOutlet(
      tenantId,
      productId,
      outletId,
    );

    // Update the stock record (audit log created automatically by StockService.update)
    const updatedStock = await this.stockService.update(
      tenantId,
      stock._id.toString(),
      updateStockDto,
    );

    return {
      data: {
        _id: updatedStock._id,
        tenantId: updatedStock.tenantId,
        productId: updatedStock.productId,
        outletId: updatedStock.outletId,
        quantity: updatedStock.quantity,
      },
    };
  }

  @ApiOperation({ summary: 'Soft delete product (mark as deleted)' })
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
  @ApiResponse({ status: 204, description: 'Product deleted successfully' })
  @ApiResponse({ status: 404, description: 'Product or tenant not found' })
  @Delete(':productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('tenantId') tenantId: string,
    @Param('productId') productId: string,
  ) {
    await this.productService.softDelete(tenantId, productId);
  }

  @ApiOperation({ summary: 'Restore previously deleted product' })
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
    description: 'Product restored successfully',
    type: ProductResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Product or tenant not found' })
  @Post(':productId/restore')
  @HttpCode(HttpStatus.OK)
  async restore(
    @Param('tenantId') tenantId: string,
    @Param('productId') productId: string,
  ) {
    const product = await this.productService.restore(tenantId, productId);
    return this.productToResponse(product);
  }

  private productToResponse(product: any): ProductResponseDto {
    return {
      _id: product._id?.toString(),
      tenantId: product.tenantId?.toString(),
      name: product.name,
      basePrice: product.basePrice
        ? parseFloat(product.basePrice.toString())
        : 0,
      gstRate: product.gstRate,
      deficitThreshold: product.deficitThreshold,
      isDeleted: product.isDeleted,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }
}
