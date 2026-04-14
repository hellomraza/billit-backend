import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DeficitModule } from '../deficit/deficit.module';
import { StockModule } from '../stock/stock.module';
import { ProductController } from './product.controller';
import { Product, ProductSchema } from './product.schema';
import { ProductService } from './product.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema }]),
    DeficitModule,
    StockModule,
  ],
  providers: [ProductService],
  controllers: [ProductController],
  exports: [ProductService],
})
export class ProductModule {}
