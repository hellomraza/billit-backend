import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

export class RefreshTokenDto {
  refreshToken?: string; // optional, can come from cookie
}

export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  resetToken: string;

  @IsString()
  @MinLength(8)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*_\-+=\[\]{}|;:'",.<>?/])/,
    {
      message:
        'Password must contain uppercase, lowercase, number, and special character',
    },
  )
  newPassword: string;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*_\-+=\[\]{}|;:'",.<>?/])/,
    {
      message:
        'Password must contain uppercase, lowercase, number, and special character',
    },
  )
  newPassword: string;
}
