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
  constructor(private readonly productService: ProductService) {}

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
  ) {
    const { data, total } = await this.productService.findAll(
      tenantId,
      parseInt(page),
      parseInt(limit),
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
