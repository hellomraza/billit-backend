import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ collection: 'password_reset_tokens' })
export class PasswordResetToken extends Document {
  @Prop({ required: true, type: Types.ObjectId, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, type: String })
  tokenHash: string;

  @Prop({ required: true, type: Date })
  expiresAt: Date;

  @Prop({ default: false, type: Boolean })
  isUsed: boolean;

  @Prop({ default: () => new Date(), type: Date })
  createdAt: Date;
}

export const PasswordResetTokenSchema =
  SchemaFactory.createForClass(PasswordResetToken);

// Create TTL index to auto-delete expired tokens
PasswordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
PasswordResetTokenSchema.index({ userId: 1 });
