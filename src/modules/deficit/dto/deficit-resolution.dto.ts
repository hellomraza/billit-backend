import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { AdjustmentReason, ResolutionMethod } from '../deficit.schema';

export class DeficitItemDto {
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
    description: 'Outlet ID',
    example: '507f1f77bcf86cd799439011',
  })
  outletId: string;

  @ApiProperty({
    description: 'Outlet name',
    example: 'Main Store',
  })
  outletName: string;

  @ApiProperty({
    description: 'Pending deficit quantity',
    example: 5,
  })
  pendingQuantity: number;

  @ApiProperty({
    description: 'Related invoice ID',
    example: '507f1f77bcf86cd799439011',
    required: false,
  })
  linkedInvoiceId?: string;

  @ApiProperty({
    description: 'Created date',
    example: '2026-04-14T10:30:00.000Z',
  })
  createdAt: string;
}

export class DeficitGroupedByProductDto {
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
    description: 'Product deficit threshold',
    example: 10,
  })
  deficitThreshold: number;

  @ApiProperty({
    description: 'Total pending deficit quantity across all outlets',
    example: 15,
  })
  totalPendingQuantity: number;

  @ApiProperty({
    description: 'Number of pending deficit records',
    example: 3,
  })
  recordCount: number;

  @ApiProperty({
    description: 'Outlets with pending deficits',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        outletId: { type: 'string' },
        outletName: { type: 'string' },
        pendingQuantity: { type: 'number' },
      },
    },
  })
  outlets: Array<{
    outletId: string;
    outletName: string;
    pendingQuantity: number;
  }>;
}

export class ResolveStockAdditionDto {
  @ApiProperty({
    description: 'Quantity of stock being added to resolve deficit',
    example: 5,
    minimum: 1,
  })
  @IsNotEmpty()
  @Min(1)
  quantity: number;

  @ApiProperty({
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
    description: 'Adjustment reason',
    example: 'DAMAGE',
    enum: Object.values(AdjustmentReason),
  })
  @IsEnum(AdjustmentReason)
  @IsNotEmpty()
  reason: AdjustmentReason;

  @ApiProperty({
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
    description: 'Deficit record ID',
    example: '507f1f77bcf86cd799439011',
  })
  deficitId: string;

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
    description: 'Outlet ID',
    example: '507f1f77bcf86cd799439011',
  })
  outletId: string;

  @ApiProperty({
    description: 'Outlet name',
    example: 'Main Store',
  })
  outletName: string;

  @ApiProperty({
    description: 'Original deficit quantity',
    example: 5,
  })
  deficitQuantity: number;

  @ApiProperty({
    description: 'Resolution method used',
    example: 'STOCK_ADDITION',
    enum: Object.values(ResolutionMethod),
  })
  resolutionMethod: ResolutionMethod;

  @ApiProperty({
    description: 'Adjustment reason (if applicable)',
    example: 'DAMAGE',
    required: false,
  })
  adjustmentReason?: string;

  @ApiProperty({
    description: 'Timestamp when deficit was resolved',
    example: '2026-04-14T10:30:00.000Z',
  })
  resolvedAt: string;

  @ApiProperty({
    description: 'Current status',
    example: 'RESOLVED',
  })
  status: string;
}

export class DeficitWarningStateDto {
  @ApiProperty({
    description: 'Whether total pending deficit equals the threshold',
    example: false,
  })
  isAtThreshold: boolean;

  @ApiProperty({
    description: 'Whether total pending deficit exceeds the threshold',
    example: true,
  })
  isAboveThreshold: boolean;

  @ApiProperty({
    description: 'Percentage of threshold that pending deficit represents',
    example: 150,
  })
  percentageOfThreshold: number;
}

export class DeficitGroupedPendingRecordDto {
  @ApiProperty({
    description: 'Deficit record ID',
    example: '507f1f77bcf86cd799439011',
  })
  deficitId: string;

  @ApiProperty({
    description: 'Outlet name',
    example: 'Main Store',
  })
  outletName: string;

  @ApiProperty({
    description: 'Pending deficit quantity for this record',
    example: 5,
  })
  quantity: number;

  @ApiProperty({
    description: 'Related invoice ID',
    example: '507f1f77bcf86cd799439011',
    required: false,
  })
  linkedInvoiceId?: string;

  @ApiProperty({
    description: 'Created date',
    example: '2026-04-14T10:30:00.000Z',
  })
  createdAt: string;
}

export class DeficitGroupedProductSummaryDto {
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
    description: 'Total pending deficit quantity across all outlets',
    example: 15,
  })
  totalPendingDeficit: number;

  @ApiProperty({
    description: 'Count of pending deficit records',
    example: 3,
  })
  pendingRecordCount: number;

  @ApiProperty({
    description: 'Latest deficit record creation date',
    example: '2026-04-14T10:30:00.000Z',
  })
  latestDeficitDate: string;

  @ApiProperty({
    description: 'Product deficit threshold',
    example: 10,
  })
  deficitThreshold: number;

  @ApiProperty({
    description: 'Warning state based on threshold',
    type: DeficitWarningStateDto,
  })
  warningState: DeficitWarningStateDto;

  @ApiProperty({
    description: 'Expandable list of pending deficit records by outlet',
    type: 'array',
    items: { $ref: '#/components/schemas/DeficitGroupedPendingRecordDto' },
  })
  pendingRecords: DeficitGroupedPendingRecordDto[];
}

export class DeficitListResponseDto {
  @ApiProperty({
    description: 'Deficit record ID',
    example: '507f1f77bcf86cd799439011',
  })
  deficitId: string;

  @ApiProperty({
    description: 'Product name',
    example: 'Laptop',
  })
  productName: string;

  @ApiProperty({
    description: 'Outlet name',
    example: 'Main Store',
  })
  outletName: string;

  @ApiProperty({
    description: 'Pending deficit quantity',
    example: 5,
  })
  quantity: number;

  @ApiProperty({
    description: 'Current status',
    example: 'PENDING',
  })
  status: string;

  @ApiProperty({
    description: 'Created date',
    example: '2026-04-14T10:30:00.000Z',
  })
  createdAt: string;

  @ApiProperty({
    description: 'Related invoice ID',
    example: '507f1f77bcf86cd799439011',
    required: false,
  })
  linkedInvoiceId?: string;
}
