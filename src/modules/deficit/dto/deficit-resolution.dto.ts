import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { AdjustmentReason, ResolutionMethod } from '../deficit.schema';

export class DeficitItemDto {
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
    type: String,
    description: 'Outlet ID',
    example: '507f1f77bcf86cd799439011',
  })
  outletId: string;

  @ApiProperty({
    type: String,
    description: 'Outlet name',
    example: 'Main Store',
  })
  outletName: string;

  @ApiProperty({
    type: Number,
    description: 'Pending deficit quantity',
    example: 5,
  })
  pendingQuantity: number;

  @ApiProperty({
    type: String,
    description: 'Related invoice ID',
    example: '507f1f77bcf86cd799439011',
    required: false,
  })
  linkedInvoiceId?: string;

  @ApiProperty({
    type: String,
    description: 'Created date',
    example: '2026-04-14T10:30:00.000Z',
  })
  createdAt: string;
}

export class DeficitGroupedByProductDto {
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
    description: 'Product deficit threshold',
    example: 10,
  })
  deficitThreshold: number;

  @ApiProperty({
    type: Number,
    description: 'Total pending deficit quantity across all outlets',
    example: 15,
  })
  totalPendingQuantity: number;

  @ApiProperty({
    type: Number,
    description: 'Number of pending deficit records',
    example: 3,
  })
  recordCount: number;

  @ApiProperty({
    description: 'Outlets with pending deficits',
    type: [Object],
  })
  outlets: Array<{
    outletId: string;
    outletName: string;
    pendingQuantity: number;
  }>;
}

export class ResolveStockAdditionDto {
  @ApiProperty({
    type: Number,
    description: 'Quantity of stock being added to resolve deficit',
    example: 5,
    minimum: 1,
  })
  @IsNotEmpty()
  @Min(1)
  quantity: number;

  @ApiProperty({
    type: String,
    description: 'Notes/reference for stock addition',
    example: 'Received from supplier',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ResolveAdjustmentDto {
  @ApiProperty({
    type: String,
    description: 'Adjustment reason',
    example: 'DAMAGE',
    enum: Object.values(AdjustmentReason),
  })
  @IsEnum(AdjustmentReason)
  @IsNotEmpty()
  reason: AdjustmentReason;

  @ApiProperty({
    type: String,
    description: 'Notes explaining the adjustment',
    example: 'Item was damaged during transport',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class DeficitResolvedResponseDto {
  @ApiProperty({
    type: String,
    description: 'Deficit record ID',
    example: '507f1f77bcf86cd799439011',
  })
  deficitId: string;

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
    type: String,
    description: 'Outlet ID',
    example: '507f1f77bcf86cd799439011',
  })
  outletId: string;

  @ApiProperty({
    type: String,
    description: 'Outlet name',
    example: 'Main Store',
  })
  outletName: string;

  @ApiProperty({
    type: Number,
    description: 'Original deficit quantity',
    example: 5,
  })
  deficitQuantity: number;

  @ApiProperty({
    type: String,
    description: 'Resolution method used',
    example: 'STOCK_ADDITION',
    enum: Object.values(ResolutionMethod),
  })
  resolutionMethod: ResolutionMethod;

  @ApiProperty({
    type: String,
    description: 'Adjustment reason (if applicable)',
    example: 'DAMAGE',
    required: false,
  })
  adjustmentReason?: string;

  @ApiProperty({
    type: String,
    description: 'Timestamp when deficit was resolved',
    example: '2026-04-14T10:30:00.000Z',
  })
  resolvedAt: string;

  @ApiProperty({
    type: String,
    description: 'Current status',
    example: 'RESOLVED',
  })
  status: string;
}

export class DeficitWarningStateDto {
  @ApiProperty({
    type: Boolean,
    description: 'Whether total pending deficit equals the threshold',
    example: false,
  })
  isAtThreshold: boolean;

  @ApiProperty({
    type: Boolean,
    description: 'Whether total pending deficit exceeds the threshold',
    example: true,
  })
  isAboveThreshold: boolean;

  @ApiProperty({
    type: Number,
    description: 'Percentage of threshold that pending deficit represents',
    example: 150,
  })
  percentageOfThreshold: number;
}

export class DeficitGroupedPendingRecordDto {
  @ApiProperty({
    type: String,
    description: 'Deficit record ID',
    example: '507f1f77bcf86cd799439011',
  })
  deficitId: string;

  @ApiProperty({
    type: String,
    description: 'Outlet name',
    example: 'Main Store',
  })
  outletName: string;

  @ApiProperty({
    type: Number,
    description: 'Pending deficit quantity for this record',
    example: 5,
  })
  quantity: number;

  @ApiProperty({
    type: String,
    description: 'Related invoice ID',
    example: '507f1f77bcf86cd799439011',
    required: false,
  })
  linkedInvoiceId?: string;

  @ApiProperty({
    type: String,
    description: 'Created date',
    example: '2026-04-14T10:30:00.000Z',
  })
  createdAt: string;
}

export class DeficitGroupedProductSummaryDto {
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
    description: 'Total pending deficit quantity across all outlets',
    example: 15,
  })
  totalPendingDeficit: number;

  @ApiProperty({
    type: Number,
    description: 'Count of pending deficit records',
    example: 3,
  })
  pendingRecordCount: number;

  @ApiProperty({
    type: String,
    description: 'Latest deficit record creation date',
    example: '2026-04-14T10:30:00.000Z',
  })
  latestDeficitDate: string;

  @ApiProperty({
    type: Number,
    description: 'Product deficit threshold',
    example: 10,
  })
  deficitThreshold: number;

  @ApiProperty({
    type: DeficitWarningStateDto,
    description: 'Warning state based on threshold',
  })
  warningState: DeficitWarningStateDto;

  @ApiProperty({
    type: [DeficitGroupedPendingRecordDto],
    description: 'Expandable list of pending deficit records by outlet',
  })
  pendingRecords: DeficitGroupedPendingRecordDto[];
}

export class DeficitListResponseDto {
  @ApiProperty({
    type: String,
    description: 'Deficit record ID',
    example: '507f1f77bcf86cd799439011',
  })
  deficitId: string;

  @ApiProperty({
    type: String,
    description: 'Product name',
    example: 'Laptop',
  })
  productName: string;

  @ApiProperty({
    type: String,
    description: 'Outlet name',
    example: 'Main Store',
  })
  outletName: string;

  @ApiProperty({
    type: Number,
    description: 'Pending deficit quantity',
    example: 5,
  })
  quantity: number;

  @ApiProperty({
    type: String,
    description: 'Current status',
    example: 'PENDING',
  })
  status: string;

  @ApiProperty({
    type: String,
    description: 'Created date',
    example: '2026-04-14T10:30:00.000Z',
  })
  createdAt: string;

  @ApiProperty({
    type: String,
    description: 'Related invoice ID',
    example: '507f1f77bcf86cd799439011',
    required: false,
  })
  linkedInvoiceId?: string;
}
