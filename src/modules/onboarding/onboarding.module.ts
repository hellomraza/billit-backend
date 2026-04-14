import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OutletModule } from '../outlet/outlet.module';
import { Outlet, OutletSchema } from '../outlet/outlet.schema';
import { TenantModule } from '../tenant/tenant.module';
import { Tenant, TenantSchema } from '../tenant/tenant.schema';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Tenant.name, schema: TenantSchema },
      { name: Outlet.name, schema: OutletSchema },
    ]),
    TenantModule,
    OutletModule,
  ],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
