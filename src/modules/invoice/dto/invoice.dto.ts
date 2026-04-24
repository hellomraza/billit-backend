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
    description: 'Product ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  @IsNotEmpty()
  productId: Types.ObjectId;

  @ApiProperty({
    description: 'Product name',
    example: 'Laptop',
  })
  @IsString()
  @IsNotEmpty()
  productName: string;

  @ApiProperty({
    description: 'Item quantity',
    example: 2,
    type: 'number',
  })
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  quantity: number;

  @ApiProperty({
    description: 'Unit price in INR',
    example: 50000,
    type: 'number',
  })
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  unitPrice: number; // Will be converted to Decimal128

  @ApiProperty({
    description: 'GST rate percentage',
    example: 18,
    type: 'number',
  })
  @IsNumber()
  @IsNotEmpty()
  gstRate: number;
}

export class CreateInvoiceDto {
  @ApiProperty({
    description: 'Outlet ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  @IsNotEmpty()
  outletId: Types.ObjectId;

  @ApiProperty({
    description: 'Client-generated unique invoice identifier',
    example: 'INV-2026-001',
  })
  @IsString()
  @IsNotEmpty()
  clientGeneratedId: string;

  @ApiProperty({
    description: 'Array of invoice line items',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        productId: { type: 'string', example: '507f1f77bcf86cd799439011' },
        productName: { type: 'string', example: 'Laptop' },
        quantity: { type: 'number', example: 2 },
        unitPrice: { type: 'number', example: 50000 },
        gstRate: { type: 'number', example: 18 },
      },
    },
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];

  @ApiProperty({
    description: 'Payment method',
    example: 'CASH',
    enum: ['CASH', 'CARD', 'UPI'],
  })
  @IsEnum(PaymentMethod)
  @IsNotEmpty()
  paymentMethod: PaymentMethod;

  @ApiProperty({
    description: 'Customer name',
    example: 'John Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiProperty({
    description: 'Customer phone number',
    example: '+91 9876543210',
    required: false,
  })
  @IsOptional()
  @IsString()
  customerPhone?: string;

  @ApiProperty({
    description: 'Whether this is a GST invoice',
    example: true,
    required: false,
    default: false,
  })
  @IsOptional()
  isGstInvoice?: boolean;

  @ApiProperty({
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
    description: 'Invoice ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  _id: string;

  @ApiProperty({
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  tenantId: string;

  @ApiProperty({
    description: 'Outlet ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  outletId: string;

  @ApiProperty({
    description: 'Auto-generated invoice number',
    example: 'INV-20260413-001',
  })
  invoiceNumber: string;

  @ApiProperty({
    description: 'Client-generated unique identifier',
    example: 'INV-2026-001',
  })
  clientGeneratedId: string;

  @ApiProperty({
    description: 'Invoice line items',
    type: 'array',
    items: { type: 'object' },
  })
  items: any[];

  @ApiProperty({
    description: 'Subtotal before tax in INR',
    example: 100000,
    type: 'number',
  })
  subtotal: number;

  @ApiProperty({
    description: 'Total GST amount in INR',
    example: 18000,
    type: 'number',
  })
  totalGstAmount: number;

  @ApiProperty({
    description: 'Grand total after tax in INR',
    example: 118000,
    type: 'number',
  })
  grandTotal: number;

  @ApiProperty({
    description: 'Payment method',
    example: 'CASH',
    enum: ['CASH', 'CARD', 'UPI'],
  })
  paymentMethod: PaymentMethod;

  @ApiProperty({
    description: 'Customer name',
    example: 'John Doe',
    nullable: true,
  })
  customerName?: string;

  @ApiProperty({
    description: 'Customer phone number',
    example: '+91 9876543210',
    nullable: true,
  })
  customerPhone?: string;

  @ApiProperty({
    description: 'Whether this is a GST invoice',
    example: true,
  })
  isGstInvoice: boolean;

  @ApiProperty({
    description: 'Tenant GST number (GSTIN)',
    example: '29AAHFU5055K1Z5',
    nullable: true,
  })
  tenantGstNumber?: string;

  @ApiProperty({
    description: 'Invoice deleted status',
    example: false,
  })
  isDeleted: boolean;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2026-04-13T10:30:00.000Z',
  })
  createdAt: Date;
}
