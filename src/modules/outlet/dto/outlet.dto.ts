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
    description: 'Outlet name',
    example: 'Main Store',
  })
  @IsString()
  @IsNotEmpty()
  outletName: string;

  @ApiProperty({
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
    description: 'Outlet name',
    example: 'Main Store Updated',
    required: false,
  })
  @IsOptional()
  @IsString()
  outletName?: string;

  @ApiProperty({
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
    description: 'Outlet ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  _id: string;

  @ApiProperty({
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  tenantId: string;

  @ApiProperty({
    description: 'Outlet name',
    example: 'Main Store',
  })
  outletName: string;

  @ApiProperty({
    description: 'Outlet abbreviation',
    example: 'MAIN',
  })
  outletAbbr: string;

  @ApiProperty({
    description: 'Whether this is the default outlet',
    example: true,
  })
  isDefault: boolean;

  @ApiProperty({
    description: 'Whether abbreviation is locked',
    example: false,
  })
  abbrLocked: boolean;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2026-04-13T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2026-04-13T10:30:00.000Z',
  })
  updatedAt: Date;
}
