import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Types } from 'mongoose';
import { PaymentMethod } from '../invoice.schema';

export class InvoiceItemDto {
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
    description: 'Product name',
    example: 'Laptop',
  })
  @IsString()
  @IsNotEmpty()
  productName: string;

  @ApiProperty({
    type: Number,
    description: 'Item quantity',
    example: 2,
  })
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  quantity: number;

  @ApiProperty({
    type: Number,
    description: 'Unit price in INR',
    example: 50000,
  })
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  unitPrice: number; // Will be converted to Decimal128

  @ApiProperty({
    type: Number,
    description: 'GST rate percentage',
    example: 18,
  })
  @IsNumber()
  @IsNotEmpty()
  gstRate: number;
}

export class CreateInvoiceDto {
  @ApiProperty({
    type: String,
    description: 'Outlet ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  @IsNotEmpty()
  outletId: Types.ObjectId;

  @ApiProperty({
    type: String,
    description: 'Client-generated unique invoice identifier',
    example: 'INV-2026-001',
  })
  @IsString()
  @IsNotEmpty()
  clientGeneratedId: string;

  @ApiProperty({
    type: [InvoiceItemDto],
    description: 'Array of invoice line items',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];

  @ApiProperty({
    type: String,
    description: 'Payment method',
    example: 'CASH',
    enum: ['CASH', 'CARD', 'UPI'],
  })
  @IsEnum(PaymentMethod)
  @IsNotEmpty()
  paymentMethod: PaymentMethod;

  @ApiProperty({
    type: String,
    description: 'Customer name',
    example: 'John Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiProperty({
    type: String,
    description: 'Customer phone number',
    example: '+91 9876543210',
    required: false,
  })
  @IsOptional()
  @IsString()
  customerPhone?: string;

  @ApiProperty({
    type: Boolean,
    description: 'Whether this is a GST invoice',
    example: true,
    required: false,
    default: false,
  })
  @IsOptional()
  isGstInvoice?: boolean;

  @ApiProperty({
    type: String,
    description: 'Tenant GST number (GSTIN)',
    example: '29AAHFU5055K1Z5',
    required: false,
  })
  @IsOptional()
  @IsString()
  tenantGstNumber?: string;
}

export class InvoiceResponseDto {
  @ApiProperty({
    type: String,
    description: 'Invoice ID (MongoDB ObjectId)',
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
    description: 'Outlet ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  outletId: string;

  @ApiProperty({
    type: String,
    description: 'Auto-generated invoice number',
    example: 'INV-20260413-001',
  })
  invoiceNumber: string;

  @ApiProperty({
    type: String,
    description: 'Client-generated unique identifier',
    example: 'INV-2026-001',
  })
  clientGeneratedId: string;

  @ApiProperty({
    type: Array,
    description: 'Invoice line items',
  })
  items: any[];

  @ApiProperty({
    type: Number,
    description: 'Subtotal before tax in INR',
    example: 100000,
  })
  subtotal: number;

  @ApiProperty({
    type: Number,
    description: 'Total GST amount in INR',
    example: 18000,
  })
  totalGstAmount: number;

  @ApiProperty({
    type: Number,
    description: 'Grand total after tax in INR',
    example: 118000,
  })
  grandTotal: number;

  @ApiProperty({
    type: String,
    description: 'Payment method',
    example: 'CASH',
    enum: ['CASH', 'CARD', 'UPI'],
  })
  paymentMethod: PaymentMethod;

  @ApiProperty({
    type: String,
    description: 'Customer name',
    example: 'John Doe',
    nullable: true,
  })
  customerName?: string;

  @ApiProperty({
    type: String,
    description: 'Customer phone number',
    example: '+91 9876543210',
    nullable: true,
  })
  customerPhone?: string;

  @ApiProperty({
    type: Boolean,
    description: 'Whether this is a GST invoice',
    example: true,
  })
  isGstInvoice: boolean;

  @ApiProperty({
    type: String,
    description: 'Tenant GST number (GSTIN)',
    example: '29AAHFU5055K1Z5',
    nullable: true,
  })
  tenantGstNumber?: string;

  @ApiProperty({
    type: Boolean,
    description: 'Invoice deleted status',
    example: false,
  })
  isDeleted: boolean;

  @ApiProperty({
    type: Date,
    description: 'Creation timestamp',
    example: '2026-04-13T10:30:00.000Z',
  })
  createdAt: Date;
}
