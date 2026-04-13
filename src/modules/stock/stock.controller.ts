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
  AdjustStockDto,
  CreateStockDto,
  StockResponseDto,
  UpdateStockDto,
} from './dto/stock.dto';
import { StockService } from './stock.service';

@Controller('tenants/:tenantId/stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Post()
  async create(
    @Param('tenantId') tenantId: string,
    @Body() createStockDto: CreateStockDto,
  ) {
    const stock = await this.stockService.create(tenantId, createStockDto);
    return this.stockToResponse(stock);
  }

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

  @Get(':stockId')
  async findById(
    @Param('tenantId') tenantId: string,
    @Param('stockId') stockId: string,
  ) {
    const stock = await this.stockService.findById(tenantId, stockId);
    return this.stockToResponse(stock);
  }

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
