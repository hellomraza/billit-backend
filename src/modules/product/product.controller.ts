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
} from '@nestjs/common';
import {
  CreateProductDto,
  ProductResponseDto,
  UpdateProductDto,
} from './dto/product.dto';
import { ProductService } from './product.service';

@Controller('tenants/:tenantId/products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

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

  @Get(':productId')
  async findById(
    @Param('tenantId') tenantId: string,
    @Param('productId') productId: string,
  ) {
    const product = await this.productService.findById(tenantId, productId);
    return this.productToResponse(product);
  }

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

  @Delete(':productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('tenantId') tenantId: string,
    @Param('productId') productId: string,
  ) {
    await this.productService.softDelete(tenantId, productId);
  }

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
