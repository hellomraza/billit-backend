import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Tenant extends Document {
  @Prop({ required: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop()
  businessName: string;

  @Prop({ minlength: 3, maxlength: 6, uppercase: true })
  businessAbbr: string;

  @Prop()
  gstNumber: string;

  @Prop({ default: false })
  gstEnabled: boolean;

  @Prop({ default: false })
  abbrLocked: boolean;

  @Prop({ default: false })
  onboardingComplete: boolean;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const TenantSchema = SchemaFactory.createForClass(Tenant);

// Indexes
TenantSchema.index({ email: 1 }, { unique: true });
