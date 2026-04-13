import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateOutletDto, UpdateOutletDto } from './dto/outlet.dto';
import { Outlet } from './outlet.schema';

@Injectable()
export class OutletService {
  constructor(@InjectModel(Outlet.name) private outletModel: Model<Outlet>) {}

  async create(
    tenantId: string,
    createOutletDto: CreateOutletDto,
  ): Promise<Outlet> {
    const outlet = new this.outletModel({
      tenantId: new Types.ObjectId(tenantId),
      ...createOutletDto,
    });
    return outlet.save();
  }

  async findById(tenantId: string, outletId: string): Promise<Outlet> {
    const outlet = await this.outletModel.findOne({
      _id: outletId,
      tenantId: new Types.ObjectId(tenantId),
    });

    if (!outlet) {
      throw new NotFoundException('Outlet not found');
    }

    return outlet;
  }

  async findByTenant(tenantId: string): Promise<Outlet[]> {
    return this.outletModel.find({
      tenantId: new Types.ObjectId(tenantId),
    });
  }

  async findAll(
    tenantId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ data: Outlet[]; total: number }> {
    const skip = (page - 1) * limit;
    const query = { tenantId: new Types.ObjectId(tenantId) };

    const data = await this.outletModel.find(query).skip(skip).limit(limit);
    const total = await this.outletModel.countDocuments(query);

    return { data, total };
  }

  async update(
    tenantId: string,
    outletId: string,
    updateOutletDto: UpdateOutletDto,
  ): Promise<Outlet> {
    const outlet = await this.outletModel.findOneAndUpdate(
      { _id: outletId, tenantId: new Types.ObjectId(tenantId) },
      updateOutletDto,
      { new: true, runValidators: true },
    );

    if (!outlet) {
      throw new NotFoundException('Outlet not found');
    }

    return outlet;
  }

  async delete(tenantId: string, outletId: string): Promise<void> {
    const result = await this.outletModel.findOneAndDelete({
      _id: outletId,
      tenantId: new Types.ObjectId(tenantId),
    });

    if (!result) {
      throw new NotFoundException('Outlet not found');
    }
  }

  async setDefault(tenantId: string, outletId: string): Promise<Outlet> {
    // Unset default for all outlets of this tenant
    await this.outletModel.updateMany(
      { tenantId: new Types.ObjectId(tenantId) },
      { isDefault: false },
    );

    // Set the specified outlet as default
    const outlet = await this.outletModel.findOneAndUpdate(
      { _id: outletId, tenantId: new Types.ObjectId(tenantId) },
      { isDefault: true },
      { new: true },
    );

    if (!outlet) {
      throw new NotFoundException('Outlet not found');
    }

    return outlet;
  }

  async getDefault(tenantId: string): Promise<Outlet> {
    const outlet = await this.outletModel.findOne({
      tenantId: new Types.ObjectId(tenantId),
      isDefault: true,
    });

    if (!outlet) {
      throw new NotFoundException('No default outlet found for this tenant');
    }

    return outlet;
  }
}
