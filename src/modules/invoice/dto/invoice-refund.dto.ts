import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Types } from 'mongoose';

export class RefundItemDto {
  @ApiProperty({
    description: 'Product ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  @IsNotEmpty()
  productId: Types.ObjectId;

  @ApiProperty({
    description: 'Quantity to refund (must be >= 1)',
    example: 1,
    type: 'number',
    minimum: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  @Type(() => Number)
  quantity: number;
}

export class CreateRefundDto {
  @ApiProperty({
    description: 'Client-generated unique invoice identifier for the refund',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsNotEmpty()
  clientGeneratedId: string;

  @ApiProperty({
    description: 'Optional reason for the refund',
    example: 'Customer changed mind',
    required: false,
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  refundReason?: string;

  @ApiProperty({
    description:
      'Optional itemized refund payload. When omitted, the full bill is refunded.',
    type: [RefundItemDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RefundItemDto)
  items?: RefundItemDto[];
}

export class RefundViolationItemDto {
  @ApiProperty({ description: 'Product ID' })
  productId: string;

  @ApiProperty({ description: 'Product name' })
  productName: string;

  @ApiProperty({ description: 'Maximum quantity that can be refunded' })
  maxReturnableQty: number;

  @ApiProperty({ description: 'Quantity requested to refund' })
  requestedQty: number;
}

export class RefundViolationResponseDto {
  @ApiProperty({ example: 'REFUND_VALIDATION_FAILED' })
  error: string;

  @ApiProperty({ type: [RefundViolationItemDto] })
  violations: RefundViolationItemDto[];

  @ApiProperty({
    example: 'Some items exceed the maximum returnable quantity.',
  })
  message: string;
}
