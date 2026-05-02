import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';

export enum DeficitGroupBy {
  PRODUCT = 'product',
  FLAT = 'flat',
}

export class ListDeficitQueryDto {
  @ApiProperty({
    type: Number,
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    type: Number,
    description: 'Number of records per page',
    example: 10,
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
    type: String,
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
    type: String,
    description: 'Filter by deficit resolution status',
    example: 'open',
    enum: ['open', 'resolved', 'all'],
    required: false,
  })
  @IsOptional()
  status?: string;

  @ApiProperty({
    type: Number,
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    type: Number,
    description: 'Number of records per page',
    example: 20,
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
