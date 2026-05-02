import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
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
    type: String,
    description: 'Product ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  @IsNotEmpty()
  productId: Types.ObjectId;

  @ApiProperty({
    type: String,
    description: 'Outlet ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  @IsNotEmpty()
  outletId: Types.ObjectId;

  @ApiProperty({
    type: Number,
    description: 'Deficit quantity',
    example: 5,
    minimum: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  quantity: number;

  @ApiProperty({
    type: String,
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
    type: String,
    description: 'Resolution method',
    example: 'STOCK_ADDITION',
    enum: ['STOCK_ADDITION', 'ADJUSTMENT'],
  })
  @IsEnum(ResolutionMethod)
  @IsNotEmpty()
  resolutionMethod: ResolutionMethod;

  @ApiProperty({
    type: String,
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
    type: String,
    description: 'Deficit record ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  _id: string;

  @ApiProperty({
    type: String,
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  tenantId: string;

  @ApiProperty({
    type: String,
    description: 'Product ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  productId: string;

  @ApiProperty({
    type: String,
    description: 'Outlet ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  outletId: string;

  @ApiProperty({
    type: Number,
    description: 'Deficit quantity',
    example: 5,
  })
  quantity: number;

  @ApiProperty({
    type: String,
    description: 'Linked invoice ID',
    example: '507f1f77bcf86cd799439011',
    nullable: true,
  })
  linkedInvoiceId?: string;

  @ApiProperty({
    type: String,
    description: 'Deficit status',
    example: 'PENDING',
    enum: ['PENDING', 'RESOLVED'],
  })
  status: DeficitStatus;

  @ApiProperty({
    type: String,
    description: 'Resolution method',
    example: 'STOCK_ADDITION',
    enum: ['STOCK_ADDITION', 'ADJUSTMENT'],
    nullable: true,
  })
  resolutionMethod?: ResolutionMethod;

  @ApiProperty({
    type: String,
    description: 'Adjustment reason',
    example: 'DAMAGE',
    enum: ['DAMAGE', 'LOSS', 'CORRECTION'],
    nullable: true,
  })
  adjustmentReason?: AdjustmentReason;

  @ApiProperty({
    type: Date,
    description: 'Resolution timestamp',
    example: '2026-04-13T10:30:00.000Z',
    nullable: true,
  })
  resolvedAt?: Date;

  @ApiProperty({
    type: Date,
    description: 'Creation timestamp',
    example: '2026-04-13T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    type: Date,
    description: 'Last update timestamp',
    example: '2026-04-13T10:30:00.000Z',
  })
  updatedAt: Date;
}

export class GetAllWithStatusQueryDto {
  @ApiProperty({
    type: String,
    description: 'Filter deficits by status',
    example: 'PENDING',
    enum: ['PENDING', 'RESOLVED'],
    required: false,
  })
  @IsOptional()
  @IsEnum(DeficitStatus)
  status: DeficitStatus;

  @ApiProperty({
    type: Number,
    description: 'Page number for pagination',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page: number;

  @ApiProperty({
    type: Number,
    description: 'Number of records per page for pagination',
    example: 10,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit: number;
}
