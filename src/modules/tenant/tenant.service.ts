import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcryptjs from 'bcryptjs';
import { ClientSession, Model } from 'mongoose';
import { CreateTenantDto, UpdateTenantDto } from './dto/tenant.dto';
import { Tenant } from './tenant.schema';

@Injectable()
export class TenantService {
  constructor(@InjectModel(Tenant.name) private tenantModel: Model<Tenant>) {}

  async create(createTenantDto: CreateTenantDto): Promise<Tenant> {
    // Check if email already exists
    const existingTenant = await this.tenantModel.findOne({
      email: createTenantDto.email,
    });
    if (existingTenant) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const hashedPassword = await bcryptjs.hash(createTenantDto.password, 10);

    // Create tenant
    const tenant = new this.tenantModel({
      email: createTenantDto.email,
      passwordHash: hashedPassword,
      businessName: createTenantDto.businessName,
      businessAbbr: createTenantDto.businessAbbr.toUpperCase(),
      gstNumber: createTenantDto.gstNumber || null,
      gstEnabled: createTenantDto.gstEnabled || false,
      abbrLocked: false,
    });

    return tenant.save();
  }

  async findById(id: string): Promise<Tenant> {
    const tenant = await this.tenantModel.findById(id).lean();
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return tenant;
  }

  async findByEmail(email: string): Promise<Tenant> {
    const tenant = await this.tenantModel.findOne({ email }).lean();
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return tenant;
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
  ): Promise<{ data: Tenant[]; total: number }> {
    const skip = (page - 1) * limit;
    const data = await this.tenantModel.find().skip(skip).limit(limit).lean();
    const total = await this.tenantModel.countDocuments();
    return { data, total };
  }

  async update(id: string, updateTenantDto: UpdateTenantDto): Promise<Tenant> {
    const tenant = await this.tenantModel.findByIdAndUpdate(
      id,
      updateTenantDto,
      {
        new: true,
        runValidators: true,
      },
    );

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async updatePassword(id: string, newPassword: string): Promise<Tenant> {
    const hashedPassword = await bcryptjs.hash(newPassword, 10);
    const tenant = await this.tenantModel.findByIdAndUpdate(
      id,
      { passwordHash: hashedPassword },
      { new: true, runValidators: true },
    );

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async verifyPassword(id: string, password: string): Promise<boolean> {
    const tenant = await this.tenantModel.findById(id);
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return bcryptjs.compare(password, tenant.passwordHash);
  }

  async delete(id: string): Promise<void> {
    const result = await this.tenantModel.findByIdAndDelete(id);
    if (!result) {
      throw new NotFoundException('Tenant not found');
    }
  }

  async lockAbbr(id: string): Promise<Tenant> {
    const tenant = await this.tenantModel.findByIdAndUpdate(
      id,
      { abbrLocked: true },
      { new: true },
    );
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return tenant;
  }

  async updateLockAbbr(
    id: string,
    locked: boolean,
    session?: ClientSession,
  ): Promise<Tenant> {
    const tenant = await this.tenantModel.findByIdAndUpdate(
      id,
      { abbrLocked: locked },
      { new: true, session },
    );
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return tenant;
  }
}
