import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ collection: 'refresh_sessions' })
export class RefreshSession extends Document {
  @Prop({ required: true, type: Types.ObjectId, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId })
  tenantId: Types.ObjectId;

  @Prop({ required: true, index: true })
  refreshTokenHash: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: false })
  isRevoked: boolean;

  @Prop({ default: () => new Date() })
  createdAt: Date;
}

export const RefreshSessionSchema =
  SchemaFactory.createForClass(RefreshSession);

// Create TTL index to auto-delete expired tokens
RefreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
RefreshSessionSchema.index({ userId: 1 });
RefreshSessionSchema.index({ refreshTokenHash: 1 });
