import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { Model } from 'mongoose';
import { Draft } from '../draft/draft.schema';
import { Tenant } from '../tenant/tenant.schema';
import {
  ChangePasswordSettingsDto,
  UpdateBusinessSettingsDto,
  UpdateGstSettingsDto,
} from './dto/settings.dto';

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(Tenant.name) private tenantModel: Model<Tenant>,
    @InjectModel(Draft.name) private draftModel: Model<Draft>,
    @InjectModel('RefreshSession') private refreshSessionModel: any,
  ) {}

  /**
   * Get current settings for tenant
   */
  async getSettings(tenantId: string) {
    const tenant = await this.tenantModel.findById(tenantId);
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Count non-deleted drafts for this tenant
    const savedDraftCount = await this.draftModel.countDocuments({
      tenantId: tenant._id,
      isDeleted: false,
    });

    return {
      email: tenant.email,
      businessName: tenant.businessName,
      businessAbbr: tenant.businessAbbr,
      abbrLocked: tenant.abbrLocked,
      gstNumber: tenant.gstNumber,
      gstEnabled: tenant.gstEnabled,
      createdAt: tenant.createdAt,
      savedDraftCount,
    };
  }

  /**
   * Update business settings
   */
  async updateBusinessSettings(
    tenantId: string,
    updateDto: UpdateBusinessSettingsDto,
  ) {
    const tenant = await this.tenantModel.findById(tenantId);
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Update business name
    await this.tenantModel.findByIdAndUpdate(tenantId, {
      businessName: updateDto.businessName,
    });

    return { message: 'Business settings updated successfully' };
  }

  /**
   * Update GST settings
   */
  async updateGstSettings(tenantId: string, updateDto: UpdateGstSettingsDto) {
    const tenant = await this.tenantModel.findById(tenantId);
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Update GST number and enabled flag
    await this.tenantModel.findByIdAndUpdate(tenantId, {
      gstNumber: updateDto.gstNumber,
      gstEnabled: updateDto.gstEnabled,
    });

    return { message: 'GST settings updated successfully' };
  }

  /**
   * Change password from Settings
   */
  async changePassword(
    tenantId: string,
    changePasswordDto: ChangePasswordSettingsDto,
  ) {
    const tenant = await this.tenantModel.findById(tenantId);
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Verify current password
    const isCurrentValid = await bcrypt.compare(
      changePasswordDto.currentPassword,
      tenant.passwordHash,
    );
    if (!isCurrentValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Validate new password rules
    if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(changePasswordDto.newPassword)) {
      throw new BadRequestException(
        'Password must contain at least one letter and one number',
      );
    }

    // Hash and update new password
    const passwordHash = await bcrypt.hash(changePasswordDto.newPassword, 10);
    await this.tenantModel.findByIdAndUpdate(tenantId, { passwordHash });

    // Revoke all refresh sessions after password change
    await this.refreshSessionModel.updateMany(
      { tenantId, revokedAt: null },
      { revokedAt: new Date() },
    );

    return { message: 'Password changed successfully' };
  }
}
