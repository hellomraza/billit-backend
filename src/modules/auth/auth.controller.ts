import {
  Body,
  Controller,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import {
  AuthResponseDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshResponseDto,
  ResetPasswordDto,
  SignupDto,
  SuccessMessageDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * Sign up a new tenant account
   */
  @Post('signup')
  @ApiOperation({
    summary: 'Sign up new tenant',
    description: 'Create a new tenant account with email and password',
  })
  @ApiBody({ type: SignupDto })
  @ApiResponse({
    status: 201,
    description: 'Tenant created successfully',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input or password does not meet requirements',
  })
  @ApiResponse({
    status: 409,
    description: 'Email already registered',
  })
  async signup(@Body() signupDto: SignupDto) {
    const tenant = await this.authService.signup(signupDto);
    return {
      message: 'Signup successful. Please complete onboarding.',
      tenant,
    };
  }

  /**
   * Login with email and password
   */
  @Post('login')
  @ApiOperation({
    summary: 'Login tenant',
    description:
      'Authenticate with email and password, receive access + refresh tokens',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials',
  })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(loginDto);

    // Set refresh token as HttpOnly cookie
    response.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/auth/refresh',
    });

    return {
      accessToken: result.accessToken,
      tenant: result.tenant,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  @Post('refresh')
  @ApiOperation({
    summary: 'Refresh access token',
    description: 'Get a new access token using refresh token from cookie',
  })
  @ApiResponse({
    status: 200,
    description: 'New access token issued',
    type: RefreshResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired refresh token',
  })
  async refresh(
    @Req() request: any,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = request.cookies?.refreshToken;
    const result = await this.authService.refresh(refreshToken);

    // Re-issue refresh token cookie
    response.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/auth/refresh',
    });

    return result;
  }

  /**
   * Logout tenant
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Logout tenant',
    description: 'Revoke all refresh token sessions for this tenant',
  })
  @ApiResponse({
    status: 200,
    description: 'Logout successful',
    type: SuccessMessageDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async logout(
    @Req() request: any,
    @Res({ passthrough: true }) response: Response,
  ) {
    const tenantId = request.user?.sub;
    if (!tenantId) {
      throw new Error('Unauthorized');
    }

    await this.authService.logout(tenantId);

    // Clear refresh token cookie
    response.clearCookie('refreshToken', { path: '/auth/refresh' });

    return { message: 'Logout successful' };
  }

  /**
   * Request password reset
   */
  @Post('forgot-password')
  @ApiOperation({
    summary: 'Request password reset',
    description:
      'Send password reset link to email (requires email verification)',
  })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({
    status: 200,
    description:
      'If email exists, reset link sent (generic response for security)',
    type: SuccessMessageDto,
  })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    // Always return generic response for security (prevent email enumeration)
    await this.authService.forgotPassword(forgotPasswordDto);
    return { message: 'If email exists, password reset link has been sent' };
  }

  /**
   * Reset password with token
   */
  @Post('reset-password')
  @ApiOperation({
    summary: 'Reset password',
    description: 'Set new password using reset token from email',
  })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Password reset successful, all sessions revoked',
    type: SuccessMessageDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired reset token',
  })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    await this.authService.resetPassword(resetPasswordDto);
    return { message: 'Password reset successful. Please login again.' };
  }

  /**
   * Change password (requires current password)
   */
  @Patch('change-password')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Change password',
    description:
      'Change password for authenticated tenant (requires current password)',
  })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({
    status: 200,
    description:
      'Password changed successfully, all sessions revoked except current',
    type: SuccessMessageDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid current password or password does not meet requirements',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async changePassword(
    @Req() request: any,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    const tenantId = request.user?.sub;
    if (!tenantId) {
      throw new Error('Unauthorized');
    }

    await this.authService.changePassword(tenantId, changePasswordDto);
    return { message: 'Password changed successfully. Please login again.' };
  }
}
