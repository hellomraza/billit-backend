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
    description: 'Item quantity (must be >= 1)',
    example: 2,
    minimum: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  @Min(1)
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
  unitPrice: number;

  @ApiProperty({
    type: Number,
    description: 'GST rate percentage (0, 5, 12, 18, or 28)',
    example: 18,
    enum: [0, 5, 12, 18, 28],
  })
  @IsIn([0, 5, 12, 18, 28])
  @IsNotEmpty()
  gstRate: number;

  @ApiProperty({
    type: Boolean,
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
    type: String,
    description:
      'Client-generated unique invoice identifier (UUID for idempotency)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsNotEmpty()
  clientGeneratedId: string;

  @ApiProperty({
    type: String,
    description: 'Client-generated draft identifier (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440001',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  clientDraftId?: string;

  @ApiProperty({
    type: String,
    description: 'Outlet ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  @IsNotEmpty()
  outletId: Types.ObjectId;

  @ApiProperty({
    type: [InvoiceItemDto],
    description: 'Array of invoice line items (at least 1 required)',
    minItems: 1,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];

  @ApiProperty({
    type: String,
    description: 'Payment method',
    example: 'CASH',
    enum: ['CASH', 'CARD', 'UPI', 'CHEQUE', 'BANK_TRANSFER'],
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
    type: String,
    description: 'Product ID',
    example: '507f1f77bcf86cd799439011',
  })
  productId: string;

  @ApiProperty({
    type: String,
    description: 'Product name snapshot',
    example: 'Laptop',
  })
  productName: string;

  @ApiProperty({
    type: Number,
    description: 'Quantity sold',
    example: 2,
  })
  quantity: number;

  @ApiProperty({
    type: Number,
    description: 'Unit price snapshot at time of sale',
    example: 50000,
  })
  unitPrice: number;

  @ApiProperty({
    type: Number,
    description: 'GST rate snapshot',
    example: 18,
  })
  gstRate: number;

  @ApiProperty({
    type: Number,
    description: 'GST amount calculated',
    example: 9000,
  })
  gstAmount: number;

  @ApiProperty({
    type: Number,
    description: 'Line total (qty * price + gst)',
    example: 59000,
  })
  lineTotal: number;
}

export class CreateInvoiceResponseDto {
  @ApiProperty({
    type: String,
    description: 'Invoice ID',
    example: '507f1f77bcf86cd799439011',
  })
  invoiceId: string;

  @ApiProperty({
    type: String,
    description: 'Generated invoice number',
    example: 'ABC-OUT-20260414-00001',
  })
  invoiceNumber: string;

  @ApiProperty({
    type: String,
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
    type: Boolean,
    description: 'Whether GST was enabled for this invoice',
  })
  gstEnabled: boolean;

  @ApiProperty({
    type: Number,
    description: 'Subtotal (before GST)',
    example: 100000,
  })
  subtotal: number;

  @ApiProperty({
    type: Number,
    description: 'Total GST amount',
    example: 18000,
  })
  gstTotal: number;

  @ApiProperty({
    type: Number,
    description: 'Grand total (subtotal + gst)',
    example: 118000,
  })
  grandTotal: number;

  @ApiProperty({
    type: String,
    description: 'Payment method used',
    example: 'CASH',
  })
  paymentMethod: string;

  @ApiProperty({
    type: 'object',
    description: 'Customer details if provided',
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
    type: 'object',
    description: 'GST details if enabled',
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
    type: Boolean,
    description: 'Whether abbreviations were locked (first invoice)',
    example: false,
  })
  abbreviationsLocked: boolean;
}

export class InsufficientStockItemDto {
  @ApiProperty({
    type: String,
    description: 'Product ID',
    example: '507f1f77bcf86cd799439011',
  })
  productId: string;

  @ApiProperty({
    type: String,
    description: 'Product name',
    example: 'Laptop',
  })
  productName: string;

  @ApiProperty({
    type: Number,
    description: 'Requested quantity',
    example: 10,
  })
  requestedQuantity: number;

  @ApiProperty({
    type: Number,
    description: 'Current stock level',
    example: 5,
  })
  currentStock: number;

  @ApiProperty({
    type: Number,
    description: 'Deficit threshold for product',
    example: 10,
  })
  deficitThreshold: number;

  @ApiProperty({
    type: Number,
    description: 'Currently pending deficit quantity',
    example: 2,
  })
  currentDeficit: number;

  @ApiProperty({
    type: Boolean,
    description: 'Whether override is allowed',
    example: false,
  })
  canOverride: boolean;

  @ApiProperty({
    type: String,
    description: 'Reason why override cannot be applied',
    example: 'Deficit threshold already exceeded',
    required: false,
  })
  overrideBlockReason?: string;
}

export class StockInsufficientResponseDto {
  @ApiProperty({
    type: String,
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
    type: String,
    description: 'Error message',
    example:
      'Stock insufficient for some items. Review and retry with override flag.',
  })
  message: string;
}

export class OverrideBlockedResponseDto {
  @ApiProperty({
    type: String,
    description: 'Error code',
    example: 'OVERRIDE_BLOCKED',
  })
  error: string;

  @ApiProperty({
    type: [Object],
    description: 'Items blocked from override',
  })
  blockedItems: Array<{
    productId: string;
    productName: string;
    deficitThreshold: number;
    currentDeficit: number;
  }>;

  @ApiProperty({
    type: String,
    description: 'Error message',
    example: 'Override blocked because deficit threshold exceeded.',
  })
  message: string;
}

export class InvoiceListResponseDto {
  @ApiProperty({
    type: String,
    description: 'Invoice number',
    example: 'ABC-OUT-20260414-00001',
  })
  invoiceNumber: string;

  @ApiProperty({
    type: String,
    description: 'Invoice ID',
    example: '507f1f77bcf86cd799439011',
  })
  invoiceId: string;

  @ApiProperty({
    type: Boolean,
    description: 'Whether GST was enabled for this invoice',
    example: true,
  })
  gstEnabled: boolean;

  @ApiProperty({
    type: String,
    description: 'Creation date',
    example: '2026-04-14T10:30:00.000Z',
  })
  createdAt: string;

  @ApiProperty({
    type: String,
    description: 'Business name snapshot',
    example: 'ABC Retail',
  })
  businessName: string;

  @ApiProperty({
    type: Number,
    description: 'Number of items in invoice',
    example: 3,
  })
  itemCount: number;

  @ApiProperty({
    type: Number,
    description: 'Subtotal before GST',
    example: 100000,
  })
  subtotal: number;

  @ApiProperty({
    type: Number,
    description: 'Total GST',
    example: 18000,
  })
  gstTotal: number;

  @ApiProperty({
    type: Number,
    description: 'Grand total',
    example: 118000,
  })
  grandTotal: number;

  @ApiProperty({
    type: String,
    description: 'Payment method',
    example: 'CASH',
  })
  paymentMethod: string;

  @ApiProperty({
    type: String,
    description: 'Customer name if provided',
    example: 'John Doe',
    required: false,
  })
  customerName?: string;

  @ApiProperty({
    type: Number,
    description: 'Number of items that were overridden',
    example: 2,
  })
  deficitCount: number;
}

export class InvoiceDetailResponseDto {
  @ApiProperty({
    type: String,
    description: 'Invoice number',
    example: 'ABC-OUT-20260414-00001',
  })
  invoiceNumber: string;

  @ApiProperty({
    type: String,
    description: 'Invoice ID',
    example: '507f1f77bcf86cd799439011',
  })
  invoiceId: string;

  @ApiProperty({
    type: String,
    description: 'Creation timestamp',
    example: '2026-04-14T10:30:00.000Z',
  })
  createdAt: string;

  @ApiProperty({
    type: String,
    description: 'Business name snapshot',
    example: 'ABC Retail',
  })
  businessName: string;

  @ApiProperty({
    type: String,
    description: 'Business abbreviation snapshot',
    example: 'ABC',
  })
  businessAbbr: string;

  @ApiProperty({
    type: String,
    description: 'Outlet name snapshot',
    example: 'Main Store',
  })
  outletName: string;

  @ApiProperty({
    type: String,
    description: 'Outlet abbreviation snapshot',
    example: 'OUT',
  })
  outletAbbr: string;

  @ApiProperty({
    type: Boolean,
    description: 'Whether GST was enabled',
    example: true,
  })
  gstEnabled: boolean;

  @ApiProperty({
    type: String,
    description: 'Tenant GST number snapshot',
    example: '29AAHFU5055K1Z5',
  })
  tenantGSTNumber?: string;

  @ApiProperty({
    type: 'object',
    description: 'Customer details',
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
    type: String,
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
    type: Number,
    description: 'Subtotal',
    example: 100000,
  })
  subtotal: number;

  @ApiProperty({
    type: Number,
    description: 'Total GST',
    example: 18000,
  })
  gstTotal: number;

  @ApiProperty({
    type: Number,
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
