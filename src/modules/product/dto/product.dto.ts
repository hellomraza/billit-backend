import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty({
    type: String,
    description: 'Product name',
    example: 'Laptop',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    type: Number,
    description: 'Base price in INR',
    example: 50000,
  })
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  basePrice: number; // Will be converted to Decimal128

  @ApiProperty({
    type: Number,
    description: 'GST rate percentage (0, 5, 12, 18, or 28)',
    example: 18,
    enum: [0, 5, 12, 18, 28],
  })
  @IsNumber()
  @IsNotEmpty()
  @IsIn([0, 5, 12, 18, 28])
  gstRate: number;

  @ApiProperty({
    type: Number,
    description: 'Stock deficit threshold for alert',
    example: 5,
    minimum: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  @Type(() => Number)
  deficitThreshold: number;
}

export class UpdateProductDto {
  @ApiProperty({
    type: String,
    description: 'Product name',
    example: 'Laptop Pro',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    type: Number,
    description: 'Base price in INR',
    example: 60000,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  basePrice?: number;

  @ApiProperty({
    type: Number,
    description: 'GST rate percentage (0, 5, 12, 18, or 28)',
    example: 18,
    enum: [0, 5, 12, 18, 28],
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @IsIn([0, 5, 12, 18, 28])
  gstRate?: number;

  @ApiProperty({
    type: Number,
    description: 'Stock deficit threshold for alert',
    example: 10,
    minimum: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  deficitThreshold?: number;
}

export class ProductResponseDto {
  @ApiProperty({
    type: String,
    description: 'Product ID (MongoDB ObjectId)',
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
    description: 'Product name',
    example: 'Laptop',
  })
  name: string;

  @ApiProperty({
    type: Number,
    description: 'Base price in INR',
    example: 50000,
  })
  basePrice: number;

  @ApiProperty({
    type: Number,
    description: 'GST rate percentage',
    example: 18,
    enum: [0, 5, 12, 18, 28],
  })
  gstRate: number;

  @ApiProperty({
    type: Number,
    description: 'Stock deficit threshold',
    example: 5,
  })
  deficitThreshold: number;

  @ApiProperty({
    type: Boolean,
    description: 'Product deleted status',
    example: false,
  })
  isDeleted: boolean;

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

export class ProductWithStockResponseDto extends ProductResponseDto {
  @ApiProperty({
    type: Number,
    description: 'Current stock level for the product',
    example: 50,
  })
  stock: number;
}
