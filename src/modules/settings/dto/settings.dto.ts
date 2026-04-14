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
    description: 'Business abbreviation (locked after first invoice)',
    example: 'ABC123',
  })
  businessAbbr: string;

  @ApiProperty({
    description: 'Business abbreviation is locked',
    example: false,
  })
  abbrLocked: boolean;

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
    description: 'Creation timestamp',
    example: '2026-04-13T10:30:00.000Z',
  })
  createdAt: Date;
}

export class UpdateBusinessSettingsDto {
  @ApiProperty({
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
    description: 'GST Identification Number (GSTIN)',
    example: '29AAHFU5055K1Z5',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9]{1}$/)
  gstNumber: string;

  @ApiProperty({
    description: 'Enable or disable GST mode',
    example: true,
  })
  @IsBoolean()
  @IsNotEmpty()
  gstEnabled: boolean;
}

export class ChangePasswordSettingsDto {
  @ApiProperty({
    description: 'Current password',
    example: 'currentPassword123',
  })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({
    description: 'New password (min 8 chars, letter + number required)',
    example: 'newPassword456',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  newPassword: string;
}

export class SuccessMessageDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Settings updated successfully',
  })
  message: string;
}
