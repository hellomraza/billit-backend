import { Module } from '@nestjs/common';
import { OutletModule } from '../outlet/outlet.module';
import { TenantModule } from '../tenant/tenant.module';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

@Module({
  imports: [TenantModule, OutletModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
