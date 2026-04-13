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
  CreateOutletDto,
  OutletResponseDto,
  UpdateOutletDto,
} from './dto/outlet.dto';
import { OutletService } from './outlet.service';

@Controller('tenants/:tenantId/outlets')
export class OutletController {
  constructor(private readonly outletService: OutletService) {}

  @Post()
  async create(
    @Param('tenantId') tenantId: string,
    @Body() createOutletDto: CreateOutletDto,
  ) {
    const outlet = await this.outletService.create(tenantId, createOutletDto);
    return this.outletToResponse(outlet);
  }

  @Get()
  async findAll(
    @Param('tenantId') tenantId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const { data, total } = await this.outletService.findAll(
      tenantId,
      parseInt(page),
      parseInt(limit),
    );
    return {
      data: data.map((o) => this.outletToResponse(o)),
      total,
      page: parseInt(page),
      limit: parseInt(limit),
    };
  }

  @Get(':outletId')
  async findById(
    @Param('tenantId') tenantId: string,
    @Param('outletId') outletId: string,
  ) {
    const outlet = await this.outletService.findById(tenantId, outletId);
    return this.outletToResponse(outlet);
  }

  @Put(':outletId')
  async update(
    @Param('tenantId') tenantId: string,
    @Param('outletId') outletId: string,
    @Body() updateOutletDto: UpdateOutletDto,
  ) {
    const outlet = await this.outletService.update(
      tenantId,
      outletId,
      updateOutletDto,
    );
    return this.outletToResponse(outlet);
  }

  @Post(':outletId/set-default')
  @HttpCode(HttpStatus.OK)
  async setDefault(
    @Param('tenantId') tenantId: string,
    @Param('outletId') outletId: string,
  ) {
    const outlet = await this.outletService.setDefault(tenantId, outletId);
    return this.outletToResponse(outlet);
  }

  @Get('default')
  async getDefault(@Param('tenantId') tenantId: string) {
    const outlet = await this.outletService.getDefault(tenantId);
    return this.outletToResponse(outlet);
  }

  @Delete(':outletId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('tenantId') tenantId: string,
    @Param('outletId') outletId: string,
  ) {
    await this.outletService.delete(tenantId, outletId);
  }

  private outletToResponse(outlet: any): OutletResponseDto {
    return {
      _id: outlet._id?.toString(),
      tenantId: outlet.tenantId?.toString(),
      outletName: outlet.outletName,
      outletAbbr: outlet.outletAbbr,
      isDefault: outlet.isDefault,
      abbrLocked: outlet.abbrLocked,
      createdAt: outlet.createdAt,
      updatedAt: outlet.updatedAt,
    };
  }
}
