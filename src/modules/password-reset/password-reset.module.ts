import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  RefreshSession,
  RefreshSessionSchema,
} from '../auth/refresh-session.schema';
import { Tenant, TenantSchema } from '../tenant/tenant.schema';
import { PasswordResetController } from './password-reset.controller';
import {
  PasswordResetToken,
  PasswordResetTokenSchema,
} from './password-reset.schema';
import { PasswordResetService } from './password-reset.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PasswordResetToken.name, schema: PasswordResetTokenSchema },
      { name: Tenant.name, schema: TenantSchema },
      { name: RefreshSession.name, schema: RefreshSessionSchema },
    ]),
  ],
  providers: [PasswordResetService],
  controllers: [PasswordResetController],
  exports: [PasswordResetService],
})
export class PasswordResetModule {}
