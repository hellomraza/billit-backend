import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
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
    ]),
  ],
  providers: [PasswordResetService],
  controllers: [PasswordResetController],
  exports: [PasswordResetService],
})
export class PasswordResetModule {}
