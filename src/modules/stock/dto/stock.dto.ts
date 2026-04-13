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
    description: 'Current inventory quantity',
    example: 100,
    minimum: 0,
    type: 'number',
  })
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Type(() => Number)
  quantity: number;
}

export class UpdateStockDto {
  @ApiProperty({
    description: 'New inventory quantity',
    example: 150,
    type: 'number',
  })
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  quantity: number;
}

export class StockResponseDto {
  @ApiProperty({
    description: 'Stock record ID (MongoDB ObjectId)',
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
    description: 'Current inventory quantity',
    example: 100,
    type: 'number',
  })
  quantity: number;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2026-04-13T10:30:00.000Z',
  })
  updatedAt: Date;
}

export class AdjustStockDto {
  @ApiProperty({
    description: 'Quantity to adjust (positive or negative)',
    example: 10,
    type: 'number',
  })
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  quantity: number;

  @ApiProperty({
    description: 'Reference ID (e.g., invoice ID)',
    example: '507f1f77bcf86cd799439011',
    required: false,
  })
  @IsOptional()
  @IsMongoId()
  referenceId?: Types.ObjectId;
}
