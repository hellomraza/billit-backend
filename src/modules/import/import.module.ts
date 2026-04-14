import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductModule } from '../product/product.module';
import { Product, ProductSchema } from '../product/product.schema';
import { TenantModule } from '../tenant/tenant.module';
import { Tenant, TenantSchema } from '../tenant/tenant.schema';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
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
