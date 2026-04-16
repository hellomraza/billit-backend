import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';

export enum DeficitGroupBy {
  PRODUCT = 'product',
  FLAT = 'flat',
}

export class ListDeficitQueryDto {
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

  @ApiProperty({
    description: 'Group deficits by product or show flat list',
    example: 'product',
    enum: DeficitGroupBy,
    required: false,
  })
  @IsOptional()
  @IsEnum(DeficitGroupBy)
  groupBy?: DeficitGroupBy = DeficitGroupBy.PRODUCT;
}

export class ListDeficitReportQueryDto {
  @ApiProperty({
    description: 'Filter by deficit resolution status',
    example: 'open',
    type: 'string',
    enum: ['open', 'resolved', 'all'],
    required: false,
  })
  @IsOptional()
  status?: string;

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
}
