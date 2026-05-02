import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ collection: 'users' })
export class User extends Document {
  @Prop({ required: true, unique: true, index: true, type: String })
  email: string;

  @Prop({ required: true, type: String })
  passwordHash: string;

  @Prop({ required: true, type: Types.ObjectId, index: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true, type: String })
  ownerName: string;

  @Prop({ default: false, type: Boolean })
  isEmailVerified: boolean;

  @Prop({ type: Date })
  emailVerifiedAt?: Date;

  @Prop({ default: () => new Date(), type: Date })
  createdAt: Date;

  @Prop({ default: () => new Date(), type: Date })
  updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Create unique index on email
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ tenantId: 1 });
