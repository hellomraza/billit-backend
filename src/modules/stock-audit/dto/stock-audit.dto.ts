import { IsEnum, IsMongoId, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { ChangeType } from '../stock-audit.schema';

export class CreateStockAuditLogDto {
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
    description: 'Previous quantity before change',
    example: 100,
    type: 'number',
  })
  @IsNumber()
  @IsNotEmpty()
  previousQuantity: number;

  @ApiProperty({
    description: 'New quantity after change',
    example: 95,
    type: 'number',
  })
  @IsNumber()
  @IsNotEmpty()
  newQuantity: number;

  @ApiProperty({
    description: 'Type of change',
    example: 'SALE',
    enum: ['SALE', 'MANUAL_UPDATE'],
  })
  @IsEnum(ChangeType)
  @IsNotEmpty()
  changeType: ChangeType;

  @ApiProperty({
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
    description: 'Audit log ID (MongoDB ObjectId)',
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
    description: 'Previous quantity',
    example: 100,
    type: 'number',
  })
  previousQuantity: number;

  @ApiProperty({
    description: 'New quantity',
    example: 95,
    type: 'number',
  })
  newQuantity: number;

  @ApiProperty({
    description: 'Type of change',
    example: 'SALE',
    enum: ['SALE', 'MANUAL_UPDATE'],
  })
  changeType: ChangeType;

  @ApiProperty({
    description: 'Reference ID (invoice, etc.)',
    example: '507f1f77bcf86cd799439011',
    nullable: true,
  })
  referenceId?: string;

  @ApiProperty({
    description: 'Timestamp when change occurred',
    example: '2026-04-13T10:30:00.000Z',
  })
  changedAt: Date;

  @ApiProperty({
    description: 'Audit log creation timestamp',
    example: '2026-04-13T10:30:00.000Z',
  })
  createdAt: Date;
}
