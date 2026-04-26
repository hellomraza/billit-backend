import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TenantValidationGuard } from '../../common/guards';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  OnboardingCompleteDto,
  OnboardingStatusDto,
  UpdateBusinessDto,
  UpdateGstDto,
  UpdateOnboardingOutletDto,
} from './dto/onboarding.dto';
import { OnboardingService } from './onboarding.service';

@ApiTags('Onboarding')
@Controller('tenants/:tenantId/onboarding')
@UseGuards(JwtAuthGuard, TenantValidationGuard)
@ApiBearerAuth('access-token')
export class OnboardingController {
  constructor(private onboardingService: OnboardingService) {}

  /**
   * Get onboarding status
   */
  @Get('status')
  @ApiOperation({
    summary: 'Get onboarding status',
    description: 'Check which steps of onboarding have been completed',
  })
  @ApiResponse({
    status: 200,
    description: 'Onboarding status',
    type: OnboardingStatusDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  async getStatus(@Param('tenantId') tenantId: string) {
    return await this.onboardingService.getStatus(tenantId);
  }

  /**
   * Update business information (step 1)
   */
  @Patch('business')
  @ApiOperation({
    summary: 'Update business information',
    description:
      'Set business name and abbreviation (abbreviation locked after first invoice)',
  })
  @ApiBody({ type: UpdateBusinessDto })
  @ApiResponse({
    status: 200,
    description: 'Business information updated',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 409,
    description: 'Business abbreviation is locked',
  })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  async updateBusiness(
    @Param('tenantId') tenantId: string,
    @Body() updateDto: UpdateBusinessDto,
  ) {
    return await this.onboardingService.updateBusiness(tenantId, updateDto);
  }

  /**
   * Update outlet information (step 2)
   */
  @Patch('outlet')
  @ApiOperation({
    summary: 'Update outlet information',
    description: 'Create or update default outlet information',
  })
  @ApiBody({ type: UpdateOnboardingOutletDto })
  @ApiResponse({
    status: 200,
    description: 'Outlet information updated',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  async updateOutlet(
    @Param('tenantId') tenantId: string,
    @Body() updateDto: UpdateOnboardingOutletDto,
  ) {
    return await this.onboardingService.updateOutlet(tenantId, updateDto);
  }

  /**
   * Update GST information (step 3)
   */
  @Patch('gst')
  @ApiOperation({
    summary: 'Update GST information',
    description: 'Set GST number and enable GST mode (optional step)',
  })
  @ApiBody({ type: UpdateGstDto })
  @ApiResponse({
    status: 200,
    description: 'GST information updated',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid GST number format',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  async updateGst(
    @Param('tenantId') tenantId: string,
    @Body() updateDto: UpdateGstDto,
  ) {
    return await this.onboardingService.updateGst(tenantId, updateDto);
  }

  /**
   * Mark onboarding as complete
   */
  @Post('complete')
  @ApiOperation({
    summary: 'Complete onboarding',
    description:
      'Mark onboarding as complete (requires business and outlet to be set)',
  })
  @ApiResponse({
    status: 200,
    description: 'Onboarding completed',
    type: OnboardingCompleteDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Required steps not completed',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  async complete(@Param('tenantId') tenantId: string) {
    return await this.onboardingService.completeOnboarding(tenantId);
  }
}
