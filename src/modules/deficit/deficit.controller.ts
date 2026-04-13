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
import { AdjustmentReason, ResolutionMethod } from './deficit.schema';
import { DeficitService } from './deficit.service';

@Controller('tenants/:tenantId/deficits')
export class DeficitController {
  constructor(private readonly deficitService: DeficitService) {}

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

  @Get(':deficitId')
  async findById(
    @Param('tenantId') tenantId: string,
    @Param('deficitId') deficitId: string,
  ) {
    return this.deficitService.findById(tenantId, deficitId);
  }

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
