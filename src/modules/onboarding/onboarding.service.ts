import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Outlet } from '../outlet/outlet.schema';
import { Tenant } from '../tenant/tenant.schema';
import {
  UpdateBusinessDto,
  UpdateGstDto,
  UpdateOnboardingOutletDto,
} from './dto/onboarding.dto';

@Injectable()
export class OnboardingService {
  constructor(
    @InjectModel(Tenant.name) private tenantModel: Model<Tenant>,
    @InjectModel(Outlet.name) private outletModel: Model<Outlet>,
  ) {}

  /**
   * Get onboarding status for a tenant
   */
  async getStatus(tenantId: string) {
    const tenant = await this.tenantModel.findById(tenantId);
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const outlet = await this.outletModel.findOne({
      tenantId,
    });

    return {
      businessStep: !!(tenant.businessName && tenant.businessAbbr),
      outletStep: !!outlet,
      gstStep: tenant.gstEnabled,
      completedAt: tenant.onboardingComplete ? new Date() : null,
    };
  }

  /**
   * Update business information
   */
  async updateBusiness(tenantId: string, updateDto: UpdateBusinessDto) {
    const tenant = await this.tenantModel.findById(tenantId);
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Check if businessAbbr is already locked
    if (tenant.abbrLocked && updateDto.businessAbbr !== tenant.businessAbbr) {
      throw new ConflictException(
        'Business abbreviation is locked and cannot be changed',
      );
    }

    // Update tenant
    await this.tenantModel.findByIdAndUpdate(tenantId, {
      businessName: updateDto.businessName,
      businessAbbr: updateDto.businessAbbr,
    });

    return { message: 'Business information updated' };
  }

  /**
   * Update outlet information (creates first outlet or updates existing)
   */
  async updateOutlet(tenantId: string, updateDto: UpdateOnboardingOutletDto) {
    const tenant = await this.tenantModel.findById(tenantId);
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Check if outlet already exists
    let outlet = await this.outletModel.findOne({
      tenantId,
    });

    if (!outlet) {
      // Create first outlet
      const newOutlet = new this.outletModel({
        tenantId: new Types.ObjectId(tenantId),
        outletName: updateDto.name,
        outletAbbr: updateDto.abbr?.toUpperCase(),
        address: updateDto.address,
        city: updateDto.city,
        state: updateDto.state,
        pincode: updateDto.pincode,
      });
      outlet = await newOutlet.save();
    } else {
      // Check if outletAbbr is already locked
      if (
        outlet.abbrLocked &&
        updateDto.abbr?.toUpperCase() !== outlet.outletAbbr
      ) {
        throw new ConflictException(
          'Outlet abbreviation is locked and cannot be changed',
        );
      }

      // Update existing outlet
      outlet.outletName = updateDto.name;
      outlet.outletAbbr = updateDto.abbr?.toUpperCase();
      outlet.address = updateDto.address;
      outlet.city = updateDto.city;
      outlet.state = updateDto.state;
      outlet.pincode = updateDto.pincode;
      await outlet.save();
    }

    return { message: 'Outlet information updated' };
  }

  /**
   * Update GST information
   */
  async updateGst(tenantId: string, updateDto: UpdateGstDto) {
    const tenant = await this.tenantModel.findById(tenantId);
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Update tenant with GST info
    await this.tenantModel.findByIdAndUpdate(tenantId, {
      gstNumber: updateDto.gstNumber,
      gstEnabled: true,
    });

    return { message: 'GST information updated' };
  }

  /**
   * Mark onboarding as complete
   */
  async completeOnboarding(tenantId: string) {
    const tenant = await this.tenantModel.findById(tenantId);
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Verify all required steps are done
    const outlet = await this.outletModel.findOne({
      tenantId,
    });

    if (!tenant.businessName || !tenant.businessAbbr) {
      throw new BadRequestException(
        'Business information must be completed first',
      );
    }

    if (!outlet) {
      throw new BadRequestException(
        'At least one outlet must be created first',
      );
    }

    // Mark as complete
    await this.tenantModel.findByIdAndUpdate(tenantId, {
      onboardingComplete: true,
    });

    return { message: 'Onboarding completed successfully' };
  }
}
