import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DeficitStatus } from '../deficit/deficit.schema';
import { DeficitService } from '../deficit/deficit.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
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
    console.log(`Finding product with ID ${productId} for tenant ${tenantId}`); // Debug log
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
    page: number = 1,
    limit: number = 10,
    includeDeleted: boolean = false,
  ): Promise<{ data: Product[]; total: number }> {
    const skip = (page - 1) * limit;
    const query: any = { tenantId: new Types.ObjectId(tenantId) };

    // Only exclude deleted products if includeDeleted is false
    if (!includeDeleted) {
      query.isDeleted = false;
    }

    const data = await this.productModel.find(query).skip(skip).limit(limit);
    const total = await this.productModel.countDocuments(query);

    return { data, total };
  }

  async search(tenantId: string, searchText: string): Promise<Product[]> {
    return this.productModel.find(
      {
        tenantId: new Types.ObjectId(tenantId),
        isDeleted: false,
        $text: { $search: searchText },
      },
      { score: { $meta: 'textScore' } },
    );
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
