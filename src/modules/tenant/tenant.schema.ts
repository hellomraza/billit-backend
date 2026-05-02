import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Tenant extends Document {
  @Prop({ required: true, unique: true, lowercase: true, type: String })
  email: string;

  @Prop({ required: true, type: String })
  passwordHash: string;

  @Prop({ type: String })
  businessName: string;

  @Prop({ minlength: 3, maxlength: 6, uppercase: true, type: String })
  businessAbbr: string;

  @Prop({ type: String })
  gstNumber: string;

  @Prop({ default: false, type: Boolean })
  gstEnabled: boolean;

  @Prop({ default: false, type: Boolean })
  abbrLocked: boolean;

  @Prop({ default: false, type: Boolean })
  onboardingComplete: boolean;

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const TenantSchema = SchemaFactory.createForClass(Tenant);

// Indexes
TenantSchema.index({ email: 1 }, { unique: true });
