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
  @IsMongoId()
  @IsNotEmpty()
  productId: Types.ObjectId;

  @IsString()
  @IsNotEmpty()
  productName: string;

  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  quantity: number;

  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  unitPrice: number; // Will be converted to Decimal128

  @IsNumber()
  @IsNotEmpty()
  gstRate: number;
}

export class CreateInvoiceDto {
  @IsMongoId()
  @IsNotEmpty()
  outletId: Types.ObjectId;

  @IsString()
  @IsNotEmpty()
  clientGeneratedId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];

  @IsEnum(PaymentMethod)
  @IsNotEmpty()
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsOptional()
  isGstInvoice?: boolean;

  @IsOptional()
  @IsString()
  tenantGstNumber?: string;
}

export class InvoiceResponseDto {
  _id: string;
  tenantId: string;
  outletId: string;
  invoiceNumber: string;
  clientGeneratedId: string;
  items: any[];
  subtotal: number;
  totalGstAmount: number;
  grandTotal: number;
  paymentMethod: PaymentMethod;
  customerName?: string;
  customerPhone?: string;
  isGstInvoice: boolean;
  tenantGstNumber?: string;
  isDeleted: boolean;
  createdAt: Date;
}
