import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ListProductQueryDto {
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

export class SearchProductQueryDto {
  @ApiProperty({
    description: 'Search query string to match against product names',
    example: 'laptop',
    type: 'string',
  })
  @IsString()
  q: string;

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

export class GetProductStockQueryDto {
  @ApiProperty({
    description: 'Outlet ID (MongoDB ObjectId) to filter stock by outlet',
    example: '507f1f77bcf86cd799439011',
    type: 'string',
  })
  @IsString()
  outletId: string;
}
