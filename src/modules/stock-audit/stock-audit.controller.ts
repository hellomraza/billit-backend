import { Controller, Get, Param, Query } from '@nestjs/common';
import { StockAuditLogService } from './stock-audit.service';

@Controller('tenants/:tenantId/stock-audit')
export class StockAuditController {
  constructor(private readonly stockAuditService: StockAuditLogService) {}

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

  @Get('outlet/:outletId')
  async findByOutlet(
    @Param('tenantId') tenantId: string,
    @Param('outletId') outletId: string,
  ) {
    const logs = await this.stockAuditService.findByOutlet(tenantId, outletId);
    return { data: logs };
  }

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
