import {
  BadRequestException,
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
  CreateTenantDto,
  TenantResponseDto,
  UpdateTenantDto,
} from './dto/tenant.dto';
import { TenantService } from './tenant.service';

@Controller('tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Post()
  async create(@Body() createTenantDto: CreateTenantDto) {
    const tenant = await this.tenantService.create(createTenantDto);
    return this.tenantToResponse(tenant);
  }

  @Get()
  async findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const { data, total } = await this.tenantService.findAll(
      parseInt(page),
      parseInt(limit),
    );
    return {
      data: data.map((t) => this.tenantToResponse(t)),
      total,
      page: parseInt(page),
      limit: parseInt(limit),
    };
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const tenant = await this.tenantService.findById(id);
    return this.tenantToResponse(tenant);
  }

  @Get('email/:email')
  async findByEmail(@Param('email') email: string) {
    const tenant = await this.tenantService.findByEmail(email);
    return this.tenantToResponse(tenant);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateTenantDto: UpdateTenantDto,
  ) {
    const tenant = await this.tenantService.update(id, updateTenantDto);
    return this.tenantToResponse(tenant);
  }

  @Post(':id/change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Param('id') id: string,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    const tenant = await this.tenantService.findById(id);
    const isPasswordValid = await this.tenantService.verifyPassword(
      id,
      body.currentPassword,
    );

    if (!isPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const updatedTenant = await this.tenantService.updatePassword(
      id,
      body.newPassword,
    );
    return this.tenantToResponse(updatedTenant);
  }

  @Post(':id/lock-abbr')
  @HttpCode(HttpStatus.OK)
  async lockAbbr(@Param('id') id: string) {
    const tenant = await this.tenantService.lockAbbr(id);
    return this.tenantToResponse(tenant);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.tenantService.delete(id);
  }

  private tenantToResponse(tenant: any): TenantResponseDto {
    return {
      _id: tenant._id?.toString(),
      email: tenant.email,
      businessName: tenant.businessName,
      businessAbbr: tenant.businessAbbr,
      gstNumber: tenant.gstNumber,
      gstEnabled: tenant.gstEnabled,
      abbrLocked: tenant.abbrLocked,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }
}
