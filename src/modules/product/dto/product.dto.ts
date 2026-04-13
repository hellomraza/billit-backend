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
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  basePrice: number; // Will be converted to Decimal128

  @IsNumber()
  @IsNotEmpty()
  @IsIn([0, 5, 12, 18, 28])
  gstRate: number;

  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  @Type(() => Number)
  deficitThreshold: number;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  basePrice?: number;

  @IsOptional()
  @IsNumber()
  @IsIn([0, 5, 12, 18, 28])
  gstRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  deficitThreshold?: number;
}

export class ProductResponseDto {
  _id: string;
  tenantId: string;
  name: string;
  basePrice: number;
  gstRate: number;
  deficitThreshold: number;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
