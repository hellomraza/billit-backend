import { IsNotEmpty, IsString } from 'class-validator';

export class CreatePasswordResetTokenDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsNotEmpty()
  newPassword: string;
}

export class PasswordResetResponseDto {
  _id: string;
  tenantId: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

import { IsEmail } from 'class-validator';
