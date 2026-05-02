import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';
import { Types } from 'mongoose';

export class CreateStockDto {
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
    description: 'Current inventory quantity',
    example: 100,
    type: Number,
    minimum: 0,
  })
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Type(() => Number)
  quantity: number;
}

export class UpdateStockDto {
  @ApiProperty({
    type: Number,
    description: 'New inventory quantity',
    example: 150,
  })
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  quantity: number;
}

export class StockResponseDto {
  @ApiProperty({
    type: String,
    description: 'Stock record ID (MongoDB ObjectId)',
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
    description: 'Current inventory quantity',
    example: 100,
  })
  quantity: number;

  @ApiProperty({
    type: Date,
    description: 'Last update timestamp',
    example: '2026-04-13T10:30:00.000Z',
  })
  updatedAt: Date;
}

export class AdjustStockDto {
  @ApiProperty({
    type: Number,
    description: 'Quantity to adjust (positive or negative)',
    example: 10,
  })
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  quantity: number;

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
