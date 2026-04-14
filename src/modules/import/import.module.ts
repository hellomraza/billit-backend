import { Module } from '@nestjs/common';
import { ProductModule } from '../product/product.module';
import { TenantModule } from '../tenant/tenant.module';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';

@Module({
  imports: [ProductModule, TenantModule],
  controllers: [ImportController],
  providers: [ImportService],
  exports: [ImportService],
})
export class ImportModule {}
