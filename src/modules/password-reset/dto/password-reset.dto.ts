import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreatePasswordResetTokenDto {
  @ApiProperty({
    type: String,
    description: 'Email address of the tenant',
    example: 'user@example.com',
    format: 'email',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    type: String,
    description: 'Password reset token',
    example: 'token_abc123def456',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    type: String,
    description: 'New password (minimum 8 characters)',
    example: 'newSecurePassword123',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  newPassword: string;
}

export class PasswordResetResponseDto {
  @ApiProperty({
    type: String,
    description: 'Token record ID (MongoDB ObjectId)',
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
    type: Date,
    description: 'Token expiration timestamp',
    example: '2026-04-13T12:30:00.000Z',
  })
  expiresAt: Date;

  @ApiProperty({
    type: Boolean,
    description: 'Whether the token has been used',
    example: false,
  })
  used: boolean;

  @ApiProperty({
    type: Date,
    description: 'Token creation timestamp',
    example: '2026-04-13T10:30:00.000Z',
  })
  createdAt: Date;
}
