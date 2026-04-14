import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
} from 'class-validator';
import { Types } from 'mongoose';
import {
  AdjustmentReason,
  DeficitStatus,
  ResolutionMethod,
} from '../deficit.schema';

export class CreateDeficitDto {
  @ApiProperty({
    description: 'Product ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  @IsNotEmpty()
  productId: Types.ObjectId;

  @ApiProperty({
    description: 'Outlet ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  @IsNotEmpty()
  outletId: Types.ObjectId;

  @ApiProperty({
    description: 'Deficit quantity',
    example: 5,
    type: 'number',
    minimum: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  quantity: number;

  @ApiProperty({
    description: 'Linked invoice ID (if deficit is from an invoice)',
    example: '507f1f77bcf86cd799439011',
    required: false,
  })
  @IsOptional()
  @IsMongoId()
  linkedInvoiceId?: Types.ObjectId;
}

export class ResolveDeficitDto {
  @ApiProperty({
    description: 'Resolution method',
    example: 'STOCK_ADDITION',
    enum: ['STOCK_ADDITION', 'ADJUSTMENT'],
  })
  @IsEnum(ResolutionMethod)
  @IsNotEmpty()
  resolutionMethod: ResolutionMethod;

  @ApiProperty({
    description: 'Adjustment reason (required if ADJUSTMENT is selected)',
    example: 'DAMAGE',
    enum: ['DAMAGE', 'LOSS', 'CORRECTION'],
    required: false,
  })
  @IsOptional()
  @IsEnum(AdjustmentReason)
  adjustmentReason?: AdjustmentReason;
}

export class DeficitResponseDto {
  @ApiProperty({
    description: 'Deficit record ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  _id: string;

  @ApiProperty({
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  tenantId: string;

  @ApiProperty({
    description: 'Product ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  productId: string;

  @ApiProperty({
    description: 'Outlet ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  outletId: string;

  @ApiProperty({
    description: 'Deficit quantity',
    example: 5,
    type: 'number',
  })
  quantity: number;

  @ApiProperty({
    description: 'Linked invoice ID',
    example: '507f1f77bcf86cd799439011',
    nullable: true,
  })
  linkedInvoiceId?: string;

  @ApiProperty({
    description: 'Deficit status',
    example: 'PENDING',
    enum: ['PENDING', 'RESOLVED'],
  })
  status: DeficitStatus;

  @ApiProperty({
    description: 'Resolution method',
    example: 'STOCK_ADDITION',
    enum: ['STOCK_ADDITION', 'ADJUSTMENT'],
    nullable: true,
  })
  resolutionMethod?: ResolutionMethod;

  @ApiProperty({
    description: 'Adjustment reason',
    example: 'DAMAGE',
    enum: ['DAMAGE', 'LOSS', 'CORRECTION'],
    nullable: true,
  })
  adjustmentReason?: AdjustmentReason;

  @ApiProperty({
    description: 'Resolution timestamp',
    example: '2026-04-13T10:30:00.000Z',
    nullable: true,
  })
  resolvedAt?: Date;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2026-04-13T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2026-04-13T10:30:00.000Z',
  })
  updatedAt: Date;
}
