import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';

export class ListInvoiceQueryDto {
  @ApiProperty({
    description: 'Page number for pagination',
    example: 1,
    type: 'number',
    minimum: 1,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of records per page',
    example: 20,
    type: 'number',
    minimum: 1,
    maximum: 100,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiProperty({
    description: 'Filter invoices from this date (ISO 8601 format: YYYY-MM-DD)',
    example: '2024-01-01',
    type: 'string',
    format: 'date',
    required: false,
  })
  @IsOptional()
  @IsDateString({
    strict: true,
    strictSeparator: true,
  })
  dateFrom?: string;

  @ApiProperty({
    description: 'Filter invoices until this date (ISO 8601 format: YYYY-MM-DD)',
    example: '2024-12-31',
    type: 'string',
    format: 'date',
    required: false,
  })
  @IsOptional()
  @IsDateString({
    strict: true,
    strictSeparator: true,
  })
  dateTo?: string;
}
