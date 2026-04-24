import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';
import { Outlet, OutletSchema } from '../outlet/outlet.schema';
import { ProductModule } from '../product/product.module';
import { Product, ProductSchema } from '../product/product.schema';
import { Stock, StockSchema } from '../stock/stock.schema';
import { TenantModule } from '../tenant/tenant.module';
import { Tenant, TenantSchema } from '../tenant/tenant.schema';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';

@Module({
  imports: [
    MulterModule.register({
      limits: {
        fileSize: 5 * 1024 * 1024, // 5 MB
      },
    }),
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Stock.name, schema: StockSchema },
      { name: Outlet.name, schema: OutletSchema },
      { name: Tenant.name, schema: TenantSchema },
    ]),
    ProductModule,
    TenantModule,
  ],
  controllers: [ImportController],
  providers: [ImportService],
  exports: [ImportService],
})
export class ImportModule {}
