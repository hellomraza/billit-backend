import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateBusinessDto {
  @ApiProperty({
    type: String,
    description: 'Business name (required)',
    example: 'ABC Retail Store',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  businessName: string;

  @ApiProperty({
    type: String,
    description:
      'Business abbreviation (3-6 uppercase alphanumeric characters, locked after first invoice)',
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
}

export class UpdateOnboardingOutletDto {
  @ApiProperty({
    type: String,
    description: 'Outlet name (required)',
    example: 'Main Store',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    type: String,
    description: 'Outlet abbreviation (3-6 uppercase alphanumeric characters)',
    example: 'OUT001',
    minLength: 3,
    maxLength: 6,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(6)
  @Matches(/^[A-Z0-9]+$/)
  abbr: string;

  @ApiProperty({
    type: String,
    description: 'Outlet address (optional)',
    example: '123 Main Street',
    required: false,
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({
    type: String,
    description: 'Outlet city (optional)',
    example: 'Mumbai',
    required: false,
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({
    type: String,
    description: 'Outlet state (optional)',
    example: 'Maharashtra',
    required: false,
  })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({
    type: String,
    description: 'Outlet PIN code (optional)',
    example: '400001',
    required: false,
  })
  @IsOptional()
  @IsString()
  pincode?: string;
}

export class UpdateGstDto {
  @ApiProperty({
    type: String,
    description: 'GST Identification Number (GSTIN)',
    example: '29AAHFU5055K1Z5',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9]{1}$/)
  gstNumber: string;
}

export class OnboardingStatusDto {
  @ApiProperty({
    type: Object,
    description: 'Current onboarding step status',
    example: {
      businessStep: true,
      outletStep: true,
      gstStep: false,
      completedAt: null,
    },
  })
  status: {
    businessStep?: boolean;
    outletStep?: boolean;
    gstStep?: boolean;
    completedAt?: Date;
  };
}

export class OnboardingCompleteDto {
  @ApiProperty({
    type: String,
    description: 'Success message',
    example: 'Onboarding completed successfully',
  })
  message: string;
}
