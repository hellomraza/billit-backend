import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { DraftPaymentMethod } from '../draft.schema';

export class DraftItemDto {
  @ApiProperty({
    type: String,
    description: 'Product ID from client state',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({
    type: String,
    description: 'Product display name',
    example: 'Rice 1kg',
  })
  @IsString()
  @IsNotEmpty()
  productName: string;

  @ApiProperty({
    type: Number,
    description: 'Requested quantity',
    example: 2,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({
    type: Number,
    description: 'Unit price snapshot',
    example: 60,
  })
  @IsNumber()
  unitPrice: number;

  @ApiProperty({
    type: Number,
    description: 'GST rate',
    example: 5,
  })
  @IsNumber()
  gstRate: number;
}

export class SyncDraftDto {
  @ApiProperty({
    type: String,
    description: 'Client-generated draft idempotency key',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  clientDraftId: string;

  @ApiProperty({
    type: String,
    description: 'Outlet ID (Mongo ObjectId as string)',
    example: '507f1f77bcf86cd799439011',
  })
  @IsString()
  @IsNotEmpty()
  outletId: string;

  @ApiProperty({
    type: String,
    description: 'Tab label',
    example: 'Bill 1',
    required: false,
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  tabLabel?: string | null;

  @ApiProperty({
    description: 'Draft items',
    type: [DraftItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DraftItemDto)
  items: DraftItemDto[];

  @ApiProperty({
    type: String,
    description: 'Customer name',
    example: 'John Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  customerName?: string | null;

  @ApiProperty({
    type: String,
    description: 'Customer phone',
    example: '+919999999999',
    required: false,
  })
  @IsOptional()
  @IsString()
  customerPhone?: string | null;

  @ApiProperty({
    type: String,
    description: 'Payment method',
    enum: DraftPaymentMethod,
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsEnum(DraftPaymentMethod)
  paymentMethod?: DraftPaymentMethod | null;
}
