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
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CreateTenantDto,
  TenantResponseDto,
  UpdateTenantDto,
} from './dto/tenant.dto';
import { TenantService } from './tenant.service';

@ApiTags('Tenants')
@Controller('tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @ApiOperation({ summary: 'Create a new tenant account' })
  @ApiResponse({
    status: 201,
    description: 'Tenant created successfully',
    type: TenantResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input or email already exists',
  })
  @Post()
  async create(@Body() createTenantDto: CreateTenantDto) {
    const tenant = await this.tenantService.create(createTenantDto);
    return this.tenantToResponse(tenant);
  }

  @ApiOperation({ summary: 'Get all tenants (paginated)' })
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
    description: 'Paginated list of tenants',
    schema: {
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/TenantResponseDto' },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
      },
    },
  })
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

  @ApiOperation({ summary: 'Get tenant by ID' })
  @ApiParam({
    name: 'id',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Tenant found',
    type: TenantResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  @Get(':id')
  async findById(@Param('id') id: string) {
    const tenant = await this.tenantService.findById(id);
    return this.tenantToResponse(tenant);
  }

  @ApiOperation({ summary: 'Get tenant by email' })
  @ApiParam({
    name: 'email',
    description: 'Tenant email address',
    example: 'user@example.com',
  })
  @ApiResponse({
    status: 200,
    description: 'Tenant found',
    type: TenantResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  @Get('email/:email')
  async findByEmail(@Param('email') email: string) {
    const tenant = await this.tenantService.findByEmail(email);
    return this.tenantToResponse(tenant);
  }

  @ApiOperation({ summary: 'Update tenant information' })
  @ApiParam({
    name: 'id',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Tenant updated successfully',
    type: TenantResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateTenantDto: UpdateTenantDto,
  ) {
    const tenant = await this.tenantService.update(id, updateTenantDto);
    return this.tenantToResponse(tenant);
  }

  @ApiOperation({ summary: 'Change tenant password' })
  @ApiParam({
    name: 'id',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiBody({
    schema: {
      properties: {
        currentPassword: { type: 'string', example: 'oldPassword123' },
        newPassword: { type: 'string', example: 'newPassword123' },
      },
      required: ['currentPassword', 'newPassword'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
    type: TenantResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Current password is incorrect' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
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

  @ApiOperation({ summary: 'Lock business abbreviation from further changes' })
  @ApiParam({
    name: 'id',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Abbreviation locked successfully',
    type: TenantResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  @Post(':id/lock-abbr')
  @HttpCode(HttpStatus.OK)
  async lockAbbr(@Param('id') id: string) {
    const tenant = await this.tenantService.lockAbbr(id);
    return this.tenantToResponse(tenant);
  }

  @ApiOperation({ summary: 'Delete tenant account' })
  @ApiParam({
    name: 'id',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({ status: 204, description: 'Tenant deleted successfully' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
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
