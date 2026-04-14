import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { DatabaseService } from '../../database/database.service';
import { ChangeType } from '../stock-audit/stock-audit.schema';
import { StockAuditLogService } from '../stock-audit/stock-audit.service';
import {
  AdjustStockDto,
  CreateStockDto,
  UpdateStockDto,
} from './dto/stock.dto';
import { Stock } from './stock.schema';

@Injectable()
export class StockService {
  constructor(
    @InjectModel(Stock.name) private stockModel: Model<Stock>,
    private databaseService: DatabaseService,
    private stockAuditLogService: StockAuditLogService,
  ) {}

  async create(
    tenantId: string,
    createStockDto: CreateStockDto,
  ): Promise<Stock> {
    const stock = new this.stockModel({
      tenantId: new Types.ObjectId(tenantId),
      productId: createStockDto.productId,
      outletId: createStockDto.outletId,
      quantity: createStockDto.quantity,
    });

    return stock.save();
  }

  async findById(tenantId: string, stockId: string): Promise<Stock> {
    const stock = await this.stockModel.findOne({
      _id: stockId,
      tenantId: new Types.ObjectId(tenantId),
    });

    if (!stock) {
      throw new NotFoundException('Stock record not found');
    }

    return stock;
  }

  async findByProductAndOutlet(
    tenantId: string,
    productId: string,
    outletId: string,
    session?: ClientSession,
  ): Promise<Stock> {
    const stock = await this.stockModel
      .findOne({
        tenantId: new Types.ObjectId(tenantId),
        productId: new Types.ObjectId(productId),
        outletId: new Types.ObjectId(outletId),
      })
      .session(session || null);

    if (!stock) {
      throw new NotFoundException('Stock record not found');
    }

    return stock;
  }

  async findByOutlet(tenantId: string, outletId: string): Promise<Stock[]> {
    return this.stockModel.find({
      tenantId: new Types.ObjectId(tenantId),
      outletId: new Types.ObjectId(outletId),
    });
  }

  async findByProduct(tenantId: string, productId: string): Promise<Stock[]> {
    return this.stockModel.find({
      tenantId: new Types.ObjectId(tenantId),
      productId: new Types.ObjectId(productId),
    });
  }

  async findAll(
    tenantId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ data: Stock[]; total: number }> {
    const skip = (page - 1) * limit;
    const query = { tenantId: new Types.ObjectId(tenantId) };

    const data = await this.stockModel.find(query).skip(skip).limit(limit);
    const total = await this.stockModel.countDocuments(query);

    return { data, total };
  }

  async update(
    tenantId: string,
    stockId: string,
    updateStockDto: UpdateStockDto,
  ): Promise<Stock> {
    // Fetch the old stock to capture previous quantity for audit log
    const oldStock = await this.stockModel.findOne({
      _id: stockId,
      tenantId: new Types.ObjectId(tenantId),
    });

    if (!oldStock) {
      throw new NotFoundException('Stock record not found');
    }

    // Update the stock
    const stock = await this.stockModel.findOneAndUpdate(
      { _id: stockId, tenantId: new Types.ObjectId(tenantId) },
      { quantity: updateStockDto.quantity },
      { new: true, runValidators: true },
    );

    if (!stock) {
      throw new NotFoundException('Stock record not found');
    }

    // Create audit log for manual stock update
    await this.stockAuditLogService.create(
      tenantId,
      oldStock.productId.toString(),
      oldStock.outletId.toString(),
      oldStock.quantity,
      updateStockDto.quantity,
      ChangeType.MANUAL_UPDATE,
      new Types.ObjectId(stockId),
    );

    return stock;
  }

  async adjust(
    tenantId: string,
    productId: string,
    outletId: string,
    adjustStockDto: AdjustStockDto,
  ): Promise<Stock> {
    const stock = await this.stockModel.findOneAndUpdate(
      {
        tenantId: new Types.ObjectId(tenantId),
        productId: new Types.ObjectId(productId),
        outletId: new Types.ObjectId(outletId),
      },
      { $inc: { quantity: adjustStockDto.quantity } },
      { new: true, upsert: true },
    );

    return stock;
  }

  async delete(tenantId: string, stockId: string): Promise<void> {
    const result = await this.stockModel.findOneAndDelete({
      _id: stockId,
      tenantId: new Types.ObjectId(tenantId),
    });

    if (!result) {
      throw new NotFoundException('Stock record not found');
    }
  }

  async decrementStock(
    tenantId: string,
    productId: string,
    outletId: string,
    quantity: number,
    session?: ClientSession,
  ): Promise<Stock> {
    const stock = await this.stockModel.findOneAndUpdate(
      {
        tenantId: new Types.ObjectId(tenantId),
        productId: new Types.ObjectId(productId),
        outletId: new Types.ObjectId(outletId),
      },
      { $inc: { quantity: -quantity } },
      { new: true, session },
    );

    if (!stock) {
      throw new NotFoundException('Stock record not found');
    }

    return stock;
  }

  async incrementStock(
    tenantId: string,
    productId: string,
    outletId: string,
    quantity: number,
    session?: ClientSession,
  ): Promise<Stock> {
    const stock = await this.stockModel.findOneAndUpdate(
      {
        tenantId: new Types.ObjectId(tenantId),
        productId: new Types.ObjectId(productId),
        outletId: new Types.ObjectId(outletId),
      },
      { $inc: { quantity } },
      { new: true, session },
    );

    if (!stock) {
      throw new NotFoundException('Stock record not found');
    }

    return stock;
  }
}
