import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { Product } from './product.schema';

@Injectable()
export class ProductService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<Product>,
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
      _id: productId,
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
  ): Promise<{ data: Product[]; total: number }> {
    const skip = (page - 1) * limit;
    const query = { tenantId: new Types.ObjectId(tenantId), isDeleted: false };

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
        _id: productId,
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
    const product = await this.productModel.findOneAndUpdate(
      {
        _id: productId,
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
