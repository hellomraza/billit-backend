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
  @IsMongoId()
  @IsNotEmpty()
  productId: Types.ObjectId;

  @IsMongoId()
  @IsNotEmpty()
  outletId: Types.ObjectId;

  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Type(() => Number)
  quantity: number;
}

export class UpdateStockDto {
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  quantity: number;
}

export class StockResponseDto {
  _id: string;
  tenantId: string;
  productId: string;
  outletId: string;
  quantity: number;
  updatedAt: Date;
}

export class AdjustStockDto {
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  quantity: number;

  @IsOptional()
  @IsMongoId()
  referenceId?: Types.ObjectId;
}
