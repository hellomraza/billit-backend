import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
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
    description: 'Item quantity (must be >= 1)',
    example: 2,
    type: 'number',
    minimum: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  @Min(1)
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
  unitPrice: number;

  @ApiProperty({
    description: 'GST rate percentage (0, 5, 12, 18, or 28)',
    example: 18,
    type: 'number',
    enum: [0, 5, 12, 18, 28],
  })
  @IsIn([0, 5, 12, 18, 28])
  @IsNotEmpty()
  gstRate: number;

  @ApiProperty({
    description:
      'Override stock insufficiency for this item (set in second request)',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  override?: boolean;
}

export class CreateInvoiceDto {
  @ApiProperty({
    description:
      'Client-generated unique invoice identifier (UUID for idempotency)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsNotEmpty()
  clientGeneratedId: string;

  @ApiProperty({
    description: 'Client-generated draft identifier (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440001',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  clientDraftId?: string;

  @ApiProperty({
    description: 'Outlet ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  @IsNotEmpty()
  outletId: Types.ObjectId;

  @ApiProperty({
    description: 'Array of invoice line items (at least 1 required)',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        productId: { type: 'string', example: '507f1f77bcf86cd799439011' },
        productName: { type: 'string', example: 'Laptop' },
        quantity: { type: 'number', example: 2, minimum: 1 },
        unitPrice: { type: 'number', example: 50000 },
        gstRate: { type: 'number', example: 18, enum: [0, 5, 12, 18, 28] },
        override: { type: 'boolean', example: false },
      },
    },
    minItems: 1,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];

  @ApiProperty({
    description: 'Payment method',
    example: 'CASH',
    enum: ['CASH', 'CARD', 'UPI', 'CHEQUE', 'BANK_TRANSFER'],
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
    description: 'Override tenant GST setting for this invoice',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  gstEnabled?: boolean;
}

// Response DTOs

export class InvoiceItemResponseDto {
  @ApiProperty({
    description: 'Product ID',
    example: '507f1f77bcf86cd799439011',
  })
  productId: string;

  @ApiProperty({
    description: 'Product name snapshot',
    example: 'Laptop',
  })
  productName: string;

  @ApiProperty({
    description: 'Quantity sold',
    example: 2,
  })
  quantity: number;

  @ApiProperty({
    description: 'Unit price snapshot at time of sale',
    example: 50000,
  })
  unitPrice: number;

  @ApiProperty({
    description: 'GST rate snapshot',
    example: 18,
  })
  gstRate: number;

  @ApiProperty({
    description: 'GST amount calculated',
    example: 9000,
  })
  gstAmount: number;

  @ApiProperty({
    description: 'Line total (qty * price + gst)',
    example: 59000,
  })
  lineTotal: number;
}

export class CreateInvoiceResponseDto {
  @ApiProperty({
    description: 'Invoice ID',
    example: '507f1f77bcf86cd799439011',
  })
  invoiceId: string;

  @ApiProperty({
    description: 'Generated invoice number',
    example: 'ABC-OUT-20260414-00001',
  })
  invoiceNumber: string;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2026-04-14T10:30:00.000Z',
  })
  createdAt: string;

  @ApiProperty({
    description: 'Invoice items with snapshots',
    type: [InvoiceItemResponseDto],
  })
  items: InvoiceItemResponseDto[];

  @ApiProperty({
    description: 'Whether GST was enabled for this invoice',
    type: 'boolean',
  })
  gstEnabled: boolean;

  @ApiProperty({
    description: 'Subtotal (before GST)',
    example: 100000,
  })
  subtotal: number;

  @ApiProperty({
    description: 'Total GST amount',
    example: 18000,
  })
  gstTotal: number;

  @ApiProperty({
    description: 'Grand total (subtotal + gst)',
    example: 118000,
  })
  grandTotal: number;

  @ApiProperty({
    description: 'Payment method used',
    example: 'CASH',
  })
  paymentMethod: string;

  @ApiProperty({
    description: 'Customer details if provided',
    type: 'object',
    properties: {
      name: { type: 'string' },
      phone: { type: 'string' },
    },
  })
  customerDetails?: {
    name: string;
    phone: string;
  };

  @ApiProperty({
    description: 'GST details if enabled',
    type: 'object',
    properties: {
      tenantGSTNumber: { type: 'string' },
      gstEnabled: { type: 'boolean' },
    },
  })
  gstDetails?: {
    tenantGSTNumber?: string;
    gstEnabled: boolean;
  };

  @ApiProperty({
    description: 'Whether abbreviations were locked (first invoice)',
    example: false,
  })
  abbreviationsLocked: boolean;
}

export class InsufficientStockItemDto {
  @ApiProperty({
    description: 'Product ID',
    example: '507f1f77bcf86cd799439011',
  })
  productId: string;

  @ApiProperty({
    description: 'Product name',
    example: 'Laptop',
  })
  productName: string;

  @ApiProperty({
    description: 'Requested quantity',
    example: 10,
  })
  requestedQuantity: number;

  @ApiProperty({
    description: 'Current stock level',
    example: 5,
  })
  currentStock: number;

  @ApiProperty({
    description: 'Deficit threshold for product',
    example: 10,
  })
  deficitThreshold: number;

  @ApiProperty({
    description: 'Currently pending deficit quantity',
    example: 2,
  })
  currentDeficit: number;

  @ApiProperty({
    description: 'Whether override is allowed',
    example: false,
  })
  canOverride: boolean;

  @ApiProperty({
    description: 'Reason why override cannot be applied',
    example: 'Deficit threshold already exceeded',
    required: false,
  })
  overrideBlockReason?: string;
}

export class StockInsufficientResponseDto {
  @ApiProperty({
    description: 'Error code',
    example: 'STOCK_INSUFFICIENT',
  })
  error: string;

  @ApiProperty({
    description: 'insufficient items details',
    type: [InsufficientStockItemDto],
  })
  insufficientItems: InsufficientStockItemDto[];

  @ApiProperty({
    description: 'Error message',
    example:
      'Stock insufficient for some items. Review and retry with override flag.',
  })
  message: string;
}

export class OverrideBlockedResponseDto {
  @ApiProperty({
    description: 'Error code',
    example: 'OVERRIDE_BLOCKED',
  })
  error: string;

  @ApiProperty({
    description: 'Items blocked from override',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        productId: { type: 'string' },
        productName: { type: 'string' },
        deficitThreshold: { type: 'number' },
        currentDeficit: { type: 'number' },
      },
    },
  })
  blockedItems: Array<{
    productId: string;
    productName: string;
    deficitThreshold: number;
    currentDeficit: number;
  }>;

  @ApiProperty({
    description: 'Error message',
    example: 'Override blocked because deficit threshold exceeded.',
  })
  message: string;
}

export class InvoiceListResponseDto {
  @ApiProperty({
    description: 'Invoice number',
    example: 'ABC-OUT-20260414-00001',
  })
  invoiceNumber: string;

  @ApiProperty({
    description: 'Invoice ID',
    example: '507f1f77bcf86cd799439011',
  })
  invoiceId: string;

  @ApiProperty({
    description: 'Whether GST was enabled for this invoice',
    example: true,
  })
  gstEnabled: boolean;

  @ApiProperty({
    description: 'Creation date',
    example: '2026-04-14T10:30:00.000Z',
  })
  createdAt: string;

  @ApiProperty({
    description: 'Business name snapshot',
    example: 'ABC Retail',
  })
  businessName: string;

  @ApiProperty({
    description: 'Number of items in invoice',
    example: 3,
  })
  itemCount: number;

  @ApiProperty({
    description: 'Subtotal before GST',
    example: 100000,
  })
  subtotal: number;

  @ApiProperty({
    description: 'Total GST',
    example: 18000,
  })
  gstTotal: number;

  @ApiProperty({
    description: 'Grand total',
    example: 118000,
  })
  grandTotal: number;

  @ApiProperty({
    description: 'Payment method',
    example: 'CASH',
  })
  paymentMethod: string;

  @ApiProperty({
    description: 'Customer name if provided',
    example: 'John Doe',
    required: false,
  })
  customerName?: string;

  @ApiProperty({
    description: 'Number of items that were overridden',
    example: 2,
  })
  deficitCount: number;
}

export class InvoiceDetailResponseDto {
  @ApiProperty({
    description: 'Invoice number',
    example: 'ABC-OUT-20260414-00001',
  })
  invoiceNumber: string;

  @ApiProperty({
    description: 'Invoice ID',
    example: '507f1f77bcf86cd799439011',
  })
  invoiceId: string;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2026-04-14T10:30:00.000Z',
  })
  createdAt: string;

  @ApiProperty({
    description: 'Business name snapshot',
    example: 'ABC Retail',
  })
  businessName: string;

  @ApiProperty({
    description: 'Business abbreviation snapshot',
    example: 'ABC',
  })
  businessAbbr: string;

  @ApiProperty({
    description: 'Outlet name snapshot',
    example: 'Main Store',
  })
  outletName: string;

  @ApiProperty({
    description: 'Outlet abbreviation snapshot',
    example: 'OUT',
  })
  outletAbbr: string;

  @ApiProperty({
    description: 'Whether GST was enabled',
    example: true,
  })
  gstEnabled: boolean;

  @ApiProperty({
    description: 'Tenant GST number snapshot',
    example: '29AAHFU5055K1Z5',
  })
  tenantGSTNumber?: string;

  @ApiProperty({
    description: 'Customer details',
    type: 'object',
    properties: {
      name: { type: 'string' },
      phone: { type: 'string' },
    },
  })
  customerDetails?: {
    name: string;
    phone: string;
  };

  @ApiProperty({
    description: 'Payment method',
    example: 'CASH',
  })
  paymentMethod: string;

  @ApiProperty({
    description: 'Invoice items with all snapshots',
    type: [InvoiceItemResponseDto],
  })
  items: InvoiceItemResponseDto[];

  @ApiProperty({
    description: 'Subtotal',
    example: 100000,
  })
  subtotal: number;

  @ApiProperty({
    description: 'Total GST',
    example: 18000,
  })
  gstTotal: number;

  @ApiProperty({
    description: 'Grand total',
    example: 118000,
  })
  grandTotal: number;

  @ApiProperty({
    description: 'Items that were overridden',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        productId: { type: 'string' },
        productName: { type: 'string' },
        quantity: { type: 'number' },
        currentResolutionStatus: {
          type: 'string',
          enum: ['PENDING', 'RESOLVED'],
        },
      },
    },
  })
  deficitItems: Array<{
    productId: string;
    productName: string;
    quantity: number;
    currentResolutionStatus: 'PENDING' | 'RESOLVED';
  }>;
}
