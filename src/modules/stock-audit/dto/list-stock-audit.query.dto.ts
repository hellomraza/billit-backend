import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';

export class ListStockAuditQueryDto {
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
    example: 10,
    type: 'number',
    minimum: 1,
    maximum: 100,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}

export class StockAuditReportQueryDto {
  @ApiProperty({
    description: 'Start date for report (ISO 8601 format: YYYY-MM-DD)',
    example: '2024-01-01',
    type: 'string',
    format: 'date',
  })
  @IsDateString({
    strict: true,
    strictSeparator: true,
  })
  startDate: string;

  @ApiProperty({
    description: 'End date for report (ISO 8601 format: YYYY-MM-DD)',
    example: '2024-01-31',
    type: 'string',
    format: 'date',
  })
  @IsDateString({
    strict: true,
    strictSeparator: true,
  })
  endDate: string;

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
    example: 10,
    type: 'number',
    minimum: 1,
    maximum: 100,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}
