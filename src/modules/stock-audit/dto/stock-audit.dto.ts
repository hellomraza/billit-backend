import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
} from 'class-validator';
import { Types } from 'mongoose';
import { ChangeType } from '../stock-audit.schema';

export class CreateStockAuditLogDto {
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
    description: 'Previous quantity before change',
    example: 100,
  })
  @IsNumber()
  @IsNotEmpty()
  previousQuantity: number;

  @ApiProperty({
    type: Number,
    description: 'New quantity after change',
    example: 95,
  })
  @IsNumber()
  @IsNotEmpty()
  newQuantity: number;

  @ApiProperty({
    type: String,
    description: 'Type of change',
    example: 'SALE',
    enum: ['SALE', 'MANUAL_UPDATE'],
  })
  @IsEnum(ChangeType)
  @IsNotEmpty()
  changeType: ChangeType;

  @ApiProperty({
    type: String,
    description: 'Reference ID (e.g., invoice ID)',
    example: '507f1f77bcf86cd799439011',
    required: false,
  })
  @IsOptional()
  @IsMongoId()
  referenceId?: Types.ObjectId;
}

export class StockAuditLogResponseDto {
  @ApiProperty({
    type: String,
    description: 'Audit log ID (MongoDB ObjectId)',
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
    description: 'Previous quantity',
    example: 100,
  })
  previousQuantity: number;

  @ApiProperty({
    type: Number,
    description: 'New quantity',
    example: 95,
  })
  newQuantity: number;

  @ApiProperty({
    type: String,
    description: 'Type of change',
    example: 'SALE',
    enum: ['SALE', 'MANUAL_UPDATE'],
  })
  changeType: ChangeType;

  @ApiProperty({
    type: String,
    description: 'Reference ID (invoice, etc.)',
    example: '507f1f77bcf86cd799439011',
    nullable: true,
  })
  referenceId?: string;

  @ApiProperty({
    type: Date,
    description: 'Timestamp when change occurred',
    example: '2026-04-13T10:30:00.000Z',
  })
  changedAt: Date;

  @ApiProperty({
    type: Date,
    description: 'Audit log creation timestamp',
    example: '2026-04-13T10:30:00.000Z',
  })
  createdAt: Date;
}
