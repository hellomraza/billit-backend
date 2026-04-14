import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateTenantDto {
  @ApiProperty({
    description: 'Tenant email address (unique)',
    example: 'user@example.com',
    format: 'email',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Secure password (minimum 8 characters)',
    example: 'securePassword123',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @ApiProperty({
    description: 'Business name',
    example: 'ABC Retail Store',
  })
  @IsString()
  @IsNotEmpty()
  businessName: string;

  @ApiProperty({
    description:
      'Business abbreviation (3-6 uppercase alphanumeric characters)',
    example: 'ABC123',
    minLength: 3,
    maxLength: 6,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(6)
  @Matches(/^[A-Z0-9]+$/)
  businessAbbr: string;

  @ApiProperty({
    description: 'GST Identification Number (GSTIN)',
    example: '29AAHFU5055K1Z5',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9]{1}$/)
  gstNumber?: string;

  @ApiProperty({
    description: 'Whether GST is enabled for this tenant',
    example: true,
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  gstEnabled?: boolean;
}

export class UpdateTenantDto {
  @ApiProperty({
    description: 'Business name',
    example: 'ABC Retail Store Updated',
    required: false,
  })
  @IsOptional()
  @IsString()
  businessName?: string;

  @ApiProperty({
    description: 'GST Identification Number (GSTIN)',
    example: '29AAHFU5055K1Z5',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9]{1}$/)
  gstNumber?: string;

  @ApiProperty({
    description: 'Whether GST is enabled for this tenant',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  gstEnabled?: boolean;
}

export class TenantResponseDto {
  @ApiProperty({
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  _id: string;

  @ApiProperty({
    description: 'Tenant email',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'Business name',
    example: 'ABC Retail Store',
  })
  businessName: string;

  @ApiProperty({
    description: 'Business abbreviation',
    example: 'ABC123',
  })
  businessAbbr: string;

  @ApiProperty({
    description: 'GST Identification Number',
    example: '29AAHFU5055K1Z5',
    nullable: true,
  })
  gstNumber?: string;

  @ApiProperty({
    description: 'Whether GST is enabled',
    example: true,
  })
  gstEnabled: boolean;

  @ApiProperty({
    description: 'Whether business abbreviation is locked',
    example: false,
  })
  abbrLocked: boolean;

  @ApiProperty({
    description: 'Whether onboarding is complete',
    example: false,
  })
  onboardingComplete: boolean;

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
