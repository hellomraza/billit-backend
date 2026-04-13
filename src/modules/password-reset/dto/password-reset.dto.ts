import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreatePasswordResetTokenDto {
  @ApiProperty({
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
    description: 'Password reset token',
    example: 'token_abc123def456',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
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
    description: 'Token record ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  _id: string;

  @ApiProperty({
    description: 'Tenant ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  tenantId: string;

  @ApiProperty({
    description: 'Token expiration timestamp',
    example: '2026-04-13T12:30:00.000Z',
  })
  expiresAt: Date;

  @ApiProperty({
    description: 'Whether the token has been used',
    example: false,
  })
  used: boolean;

  @ApiProperty({
    description: 'Token creation timestamp',
    example: '2026-04-13T10:30:00.000Z',
  })
  createdAt: Date;
}
