import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateOutletDto {
  @ApiProperty({
    type: String,
    description: 'Outlet name',
    example: 'Main Store',
  })
  @IsString()
  @IsNotEmpty()
  outletName: string;

  @ApiProperty({
    type: String,
    description: 'Outlet abbreviation (3-6 characters)',
    example: 'MAIN',
    minLength: 3,
    maxLength: 6,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(6)
  outletAbbr: string;

  @ApiProperty({
    type: Boolean,
    description: 'Whether this is the default outlet',
    example: false,
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateOutletDto {
  @ApiProperty({
    type: String,
    description: 'Outlet name',
    example: 'Main Store Updated',
    required: false,
  })
  @IsOptional()
  @IsString()
  outletName?: string;

  @ApiProperty({
    type: String,
    description: 'Outlet abbreviation (3-6 characters)',
    example: 'MAIN',
    minLength: 3,
    maxLength: 6,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(6)
  outletAbbr?: string;

  @ApiProperty({
    type: Boolean,
    description: 'Whether this is the default outlet',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class OutletResponseDto {
  @ApiProperty({
    type: String,
    description: 'Outlet ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  _id: string;

  @ApiProperty({
    type: String,
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  tenantId: string;

  @ApiProperty({
    type: String,
    description: 'Outlet name',
    example: 'Main Store',
  })
  outletName: string;

  @ApiProperty({
    type: String,
    description: 'Outlet abbreviation',
    example: 'MAIN',
  })
  outletAbbr: string;

  @ApiProperty({
    type: Boolean,
    description: 'Whether this is the default outlet',
    example: true,
  })
  isDefault: boolean;

  @ApiProperty({
    type: Boolean,
    description: 'Whether abbreviation is locked',
    example: false,
  })
  abbrLocked: boolean;

  @ApiProperty({
    type: Date,
    description: 'Creation timestamp',
    example: '2026-04-13T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    type: Date,
    description: 'Last update timestamp',
    example: '2026-04-13T10:30:00.000Z',
  })
  updatedAt: Date;
}
