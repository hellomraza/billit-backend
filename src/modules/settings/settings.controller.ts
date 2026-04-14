import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  ChangePasswordSettingsDto,
  SettingsResponseDto,
  SuccessMessageDto,
  UpdateBusinessSettingsDto,
  UpdateGstSettingsDto,
} from './dto/settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('Settings')
@Controller('settings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  /**
   * Get current settings
   */
  @Get()
  @ApiOperation({
    summary: 'Get settings',
    description: 'Retrieve current tenant settings',
  })
  @ApiResponse({
    status: 200,
    description: 'Current settings',
    type: SettingsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getSettings(@Req() request: any) {
    const tenantId = request.user?.sub;
    return await this.settingsService.getSettings(tenantId);
  }

  /**
   * Update business settings
   */
  @Patch('business')
  @ApiOperation({
    summary: 'Update business settings',
    description:
      'Update business name (abbreviation locked after first invoice)',
  })
  @ApiBody({ type: UpdateBusinessSettingsDto })
  @ApiResponse({
    status: 200,
    description: 'Business settings updated',
    type: SuccessMessageDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async updateBusiness(
    @Req() request: any,
    @Body() updateDto: UpdateBusinessSettingsDto,
  ) {
    const tenantId = request.user?.sub;
    return await this.settingsService.updateBusinessSettings(
      tenantId,
      updateDto,
    );
  }

  /**
   * Update GST settings
   */
  @Patch('gst')
  @ApiOperation({
    summary: 'Update GST settings',
    description: 'Update GST number and enable/disable GST mode',
  })
  @ApiBody({ type: UpdateGstSettingsDto })
  @ApiResponse({
    status: 200,
    description: 'GST settings updated',
    type: SuccessMessageDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid GST number format',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async updateGst(
    @Req() request: any,
    @Body() updateDto: UpdateGstSettingsDto,
  ) {
    const tenantId = request.user?.sub;
    return await this.settingsService.updateGstSettings(tenantId, updateDto);
  }

  /**
   * Change password from settings
   */
  @Post('change-password')
  @ApiOperation({
    summary: 'Change password',
    description: 'Change password (requires current password)',
  })
  @ApiBody({ type: ChangePasswordSettingsDto })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
    type: SuccessMessageDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid current password or password does not meet requirements',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async changePassword(
    @Req() request: any,
    @Body() changePasswordDto: ChangePasswordSettingsDto,
  ) {
    const tenantId = request.user?.sub;
    return await this.settingsService.changePassword(
      tenantId,
      changePasswordDto,
    );
  }
}
