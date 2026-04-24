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
    description: 'Product name',
    example: 'Laptop',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Base price in INR',
    example: 50000,
    type: 'number',
  })
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  basePrice: number; // Will be converted to Decimal128

  @ApiProperty({
    description: 'GST rate percentage (0, 5, 12, 18, or 28)',
    example: 18,
    enum: [0, 5, 12, 18, 28],
  })
  @IsNumber()
  @IsNotEmpty()
  @IsIn([0, 5, 12, 18, 28])
  gstRate: number;

  @ApiProperty({
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
    description: 'Product name',
    example: 'Laptop Pro',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description: 'Base price in INR',
    example: 60000,
    type: 'number',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  basePrice?: number;

  @ApiProperty({
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
    description: 'Product ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  _id: string;

  @ApiProperty({
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  tenantId: string;

  @ApiProperty({
    description: 'Product name',
    example: 'Laptop',
  })
  name: string;

  @ApiProperty({
    description: 'Base price in INR',
    example: 50000,
    type: 'number',
  })
  basePrice: number;

  @ApiProperty({
    description: 'GST rate percentage',
    example: 18,
    enum: [0, 5, 12, 18, 28],
  })
  gstRate: number;

  @ApiProperty({
    description: 'Stock deficit threshold',
    example: 5,
  })
  deficitThreshold: number;

  @ApiProperty({
    description: 'Product deleted status',
    example: false,
  })
  isDeleted: boolean;

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

export class ProductWithStockResponseDto extends ProductResponseDto {
  @ApiProperty({
    description: 'Current stock level for the product',
    example: 50,
  })
  stock: number;
}
