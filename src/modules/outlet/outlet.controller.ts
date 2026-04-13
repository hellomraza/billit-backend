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
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CreateOutletDto,
  OutletResponseDto,
  UpdateOutletDto,
} from './dto/outlet.dto';
import { OutletService } from './outlet.service';

@ApiTags('Outlets')
@Controller('tenants/:tenantId/outlets')
export class OutletController {
  constructor(private readonly outletService: OutletService) {}

  @ApiOperation({ summary: 'Create a new outlet' })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 201,
    description: 'Outlet created successfully',
    type: OutletResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @Post()
  async create(
    @Param('tenantId') tenantId: string,
    @Body() createOutletDto: CreateOutletDto,
  ) {
    const outlet = await this.outletService.create(tenantId, createOutletDto);
    return this.outletToResponse(outlet);
  }

  @ApiOperation({ summary: 'Get all outlets for tenant (paginated)' })
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
    description: 'Paginated list of outlets',
    schema: {
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/OutletResponseDto' },
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

  @ApiOperation({ summary: 'Get outlet by ID' })
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
    description: 'Outlet found',
    type: OutletResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Outlet or tenant not found' })
  @Get(':outletId')
  async findById(
    @Param('tenantId') tenantId: string,
    @Param('outletId') outletId: string,
  ) {
    const outlet = await this.outletService.findById(tenantId, outletId);
    return this.outletToResponse(outlet);
  }

  @ApiOperation({ summary: 'Update outlet information' })
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
    description: 'Outlet updated successfully',
    type: OutletResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Outlet or tenant not found' })
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

  @ApiOperation({ summary: 'Set outlet as default for tenant' })
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
    description: 'Outlet set as default successfully',
    type: OutletResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Outlet or tenant not found' })
  @Post(':outletId/set-default')
  @HttpCode(HttpStatus.OK)
  async setDefault(
    @Param('tenantId') tenantId: string,
    @Param('outletId') outletId: string,
  ) {
    const outlet = await this.outletService.setDefault(tenantId, outletId);
    return this.outletToResponse(outlet);
  }

  @ApiOperation({ summary: 'Get default outlet for tenant' })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Default outlet found',
    type: OutletResponseDto,
  })
  @ApiResponse({ status: 404, description: 'No default outlet found' })
  @Get('default')
  async getDefault(@Param('tenantId') tenantId: string) {
    const outlet = await this.outletService.getDefault(tenantId);
    return this.outletToResponse(outlet);
  }

  @ApiOperation({ summary: 'Delete outlet' })
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
  @ApiResponse({ status: 204, description: 'Outlet deleted successfully' })
  @ApiResponse({ status: 404, description: 'Outlet or tenant not found' })
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
