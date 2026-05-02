import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class RefreshSession extends Document {
  @Prop({ required: true, type: Types.ObjectId, index: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true, type: String })
  tokenHash: string; // Hashed refresh token

  @Prop({ required: true, type: Date })
  expiresAt: Date;

  @Prop({ type: Date })
  revokedAt?: Date;

  @Prop({ type: String })
  userAgent?: string;

  @Prop({ type: String })
  ipAddress?: string;

  @Prop({ default: () => new Date(), type: Date })
  createdAt: Date;
}

export const RefreshSessionSchema =
  SchemaFactory.createForClass(RefreshSession);
RefreshSessionSchema.index({ tenantId: 1, expiresAt: 1 });
RefreshSessionSchema.index({ tokenHash: 1 });
