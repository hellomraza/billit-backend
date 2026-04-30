import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { RefreshSessionSchema } from '../auth/refresh-session.schema';
import { Draft, DraftSchema } from '../draft/draft.schema';
import { TenantModule } from '../tenant/tenant.module';
import { Tenant, TenantSchema } from '../tenant/tenant.schema';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Tenant.name, schema: TenantSchema },
      { name: Draft.name, schema: DraftSchema },
      { name: 'RefreshSession', schema: RefreshSessionSchema },
    ]),
    TenantModule,
    AuthModule,
  ],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
