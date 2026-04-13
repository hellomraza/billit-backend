import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CreatePasswordResetTokenDto } from './dto/password-reset.dto';
import { PasswordResetService } from './password-reset.service';

@Controller('password-reset')
export class PasswordResetController {
  constructor(private readonly passwordResetService: PasswordResetService) {}

  @Post('send-reset-email')
  @HttpCode(HttpStatus.OK)
  async sendResetEmail(@Body() body: CreatePasswordResetTokenDto) {
    const token = await this.passwordResetService.generateToken(body.email);
    // In a real application, you would send this token via email
    // For now, we'll just return the token (in production, NEVER do this)
    return {
      message: 'Password reset token generated',
      token, // Remove this in production
    };
  }

  @Post('verify-token')
  @HttpCode(HttpStatus.OK)
  async verifyToken(@Body() body: { tenantId: string; token: string }) {
    const tokenRecord = await this.passwordResetService.verifyToken(
      body.tenantId,
      body.token,
    );
    return {
      message: 'Token is valid',
      expiresAt: tokenRecord.expiresAt,
    };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() body: { tenantId: string; token: string; newPassword: string },
  ) {
    const tokenRecord = await this.passwordResetService.verifyToken(
      body.tenantId,
      body.token,
    );
    await this.passwordResetService.markTokenAsUsed(tokenRecord._id.toString());

    return {
      message: 'Password has been reset successfully',
    };
  }

  @Post('cleanup-expired')
  @HttpCode(HttpStatus.OK)
  async cleanupExpiredTokens() {
    await this.passwordResetService.deleteExpiredTokens();
    return {
      message: 'Expired tokens cleaned up',
    };
  }
}
