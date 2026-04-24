import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
import { DeficitStatus } from '../deficit/deficit.schema';
import { DeficitService } from '../deficit/deficit.service';
import {
  CreateProductDto,
  ProductWithStockResponseDto,
  UpdateProductDto,
} from './dto/product.dto';
import { Product } from './product.schema';

@Injectable()
export class ProductService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<Product>,
    private readonly deficitService: DeficitService,
  ) {}

  async create(
    tenantId: string,
    createProductDto: CreateProductDto,
  ): Promise<Product> {
    const product = new this.productModel({
      tenantId: new Types.ObjectId(tenantId),
      name: createProductDto.name,
      basePrice: createProductDto.basePrice,
      gstRate: createProductDto.gstRate,
      deficitThreshold: createProductDto.deficitThreshold,
      isDeleted: false,
    });

    return product.save();
  }

  async findById(tenantId: string, productId: string): Promise<Product> {
    const product = await this.productModel.findOne({
      _id: new Types.ObjectId(productId),
      tenantId: new Types.ObjectId(tenantId),
      isDeleted: false,
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async findByTenant(tenantId: string): Promise<Product[]> {
    return this.productModel.find({
      tenantId: new Types.ObjectId(tenantId),
      isDeleted: false,
    });
  }

  async findAll(
    tenantId: string,
    outletId: string,
    page: number = 1,
    limit: number = 10,
    includeDeleted: boolean = false,
  ): Promise<{ data: ProductWithStockResponseDto[]; total: number }> {
    const skip = (page - 1) * limit;
    const matchStage: PipelineStage.Match['$match'] = {
      tenantId: new Types.ObjectId(tenantId),
    };

    // Only exclude deleted products if includeDeleted is false
    if (!includeDeleted) {
      matchStage.isDeleted = false;
    }

    // Aggregation pipeline to join products with their stock quantity for specific outlet
    const pipeline: PipelineStage[] = [
      { $match: { tenantId: new Types.ObjectId(tenantId), isDeleted: false } },
      {
        $lookup: {
          from: 'stocks', // collection name (IMPORTANT)
          let: { productId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$productId', '$$productId'] },
                    { $eq: ['$tenantId', new Types.ObjectId(tenantId)] },
                    { $eq: ['$outletId', new Types.ObjectId(outletId)] },
                  ],
                },
              },
            },

            { $project: { quantity: 1, _id: 0 } },
          ],
          as: 'stockData',
        },
      },
      {
        $addFields: {
          stock: { $ifNull: [{ $arrayElemAt: ['$stockData.quantity', 0] }, 0] },
        },
      },
      { $project: { stockData: 0 } },
      { $skip: skip },
      { $limit: limit },
    ];

    const data: ProductWithStockResponseDto[] =
      await this.productModel.aggregate(pipeline);

    // Get total count using aggregation pipeline
    const countPipeline: PipelineStage[] = [
      { $match: matchStage },
      { $count: 'total' },
    ];

    const countResult: { total: number }[] =
      await this.productModel.aggregate(countPipeline);
    const total = countResult.length > 0 ? countResult[0].total : 0;

    return { data, total };
  }

  async search(
    tenantId: string,
    searchText: string,
    outletId: string,
  ): Promise<ProductWithStockResponseDto[]> {
    // Use case-insensitive regex matching for partial product name matching
    // e.g., 'lap' matches 'Laptop', 'MacBook Pro', etc.
    const regex = new RegExp(searchText, 'i');

    // Aggregation pipeline to search products and join with their stock quantity for specific outlet
    const pipeline: PipelineStage[] = [
      {
        $match: {
          tenantId: new Types.ObjectId(tenantId),
          isDeleted: false,
          name: { $regex: regex },
        },
      },
      {
        $lookup: {
          from: 'stocks', // collection name (IMPORTANT)
          let: { productId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$productId', '$$productId'] },
                    { $eq: ['$tenantId', new Types.ObjectId(tenantId)] },
                    { $eq: ['$outletId', new Types.ObjectId(outletId)] },
                  ],
                },
              },
            },
            { $project: { quantity: 1, _id: 0 } },
          ],
          as: 'stockData',
        },
      },
      {
        $addFields: {
          stock: {
            $ifNull: [{ $arrayElemAt: ['$stockData.quantity', 0] }, 0],
          },
        },
      },
      { $project: { stockData: 0 } },
    ];

    return this.productModel.aggregate(pipeline);
  }

  async update(
    tenantId: string,
    productId: string,
    updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    const updateData: any = { ...updateProductDto };

    const product = await this.productModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(productId),
        tenantId: new Types.ObjectId(tenantId),
        isDeleted: false,
      },
      updateData,
      { new: true, runValidators: true },
    );

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async softDelete(tenantId: string, productId: string): Promise<Product> {
    // Check if product has pending deficits
    const pendingDeficits = await this.deficitService.findByProductAndStatus(
      tenantId,
      productId,
      DeficitStatus.PENDING,
    );

    if (pendingDeficits && pendingDeficits.length > 0) {
      throw new ConflictException({
        statusCode: 409,
        message: 'Cannot delete product with pending deficits',
        error: 'Conflict',
        details: {
          productId,
          pendingDeficitCount: pendingDeficits.length,
          reason:
            'Product must resolve all pending stock deficits before deletion',
        },
      });
    }

    const product = await this.productModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(productId),
        tenantId: new Types.ObjectId(tenantId),
        isDeleted: false,
      },
      { isDeleted: true },
      { new: true },
    );

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async restore(tenantId: string, productId: string): Promise<Product> {
    const product = await this.productModel.findOneAndUpdate(
      {
        _id: productId,
        tenantId: new Types.ObjectId(tenantId),
        isDeleted: true,
      },
      { isDeleted: false },
      { new: true },
    );

    if (!product) {
      throw new NotFoundException('Product not found or already active');
    }

    return product;
  }
}
