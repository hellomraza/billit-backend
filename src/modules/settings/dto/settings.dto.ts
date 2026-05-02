import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SettingsResponseDto {
  @ApiProperty({
    type: String,
    description: 'Tenant email',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    type: String,
    description: 'Business name',
    example: 'ABC Retail Store',
  })
  businessName: string;

  @ApiProperty({
    type: String,
    description: 'Business abbreviation (locked after first invoice)',
    example: 'ABC123',
  })
  businessAbbr: string;

  @ApiProperty({
    type: Boolean,
    description: 'Business abbreviation is locked',
    example: false,
  })
  abbrLocked: boolean;

  @ApiProperty({
    type: String,
    description: 'GST Identification Number',
    example: '29AAHFU5055K1Z5',
    nullable: true,
  })
  gstNumber?: string;

  @ApiProperty({
    type: Boolean,
    description: 'Whether GST is enabled',
    example: true,
  })
  gstEnabled: boolean;

  @ApiProperty({
    type: Date,
    description: 'Creation timestamp',
    example: '2026-04-13T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    type: Number,
    description: 'Count of saved (non-deleted) drafts',
    example: 3,
  })
  savedDraftCount: number;
}

export class UpdateBusinessSettingsDto {
  @ApiProperty({
    type: String,
    description: 'Business name',
    example: 'ABC Retail Store Updated',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  businessName: string;
}

export class UpdateGstSettingsDto {
  @ApiProperty({
    type: String,
    description: 'GST Identification Number (GSTIN)',
    example: '29AAHFU5055K1Z5',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9]{1}$/)
  gstNumber: string;

  @ApiProperty({
    type: Boolean,
    description: 'Enable or disable GST mode',
    example: true,
  })
  @IsBoolean()
  @IsNotEmpty()
  gstEnabled: boolean;
}

export class ChangePasswordSettingsDto {
  @ApiProperty({
    type: String,
    description: 'Current password',
    example: 'currentPassword123',
  })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({
    type: String,
    description: 'New password (min 8 chars, letter + number required)',
    example: 'newPassword456',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  newPassword: string;
}
