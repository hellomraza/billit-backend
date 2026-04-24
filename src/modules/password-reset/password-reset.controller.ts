import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import * as bcryptjs from 'bcryptjs';
import { Model, Types } from 'mongoose';
import { RefreshSession } from '../auth/refresh-session.schema';
import { Tenant } from '../tenant/tenant.schema';
import { CreatePasswordResetTokenDto } from './dto/password-reset.dto';
import { PasswordResetService } from './password-reset.service';

@ApiTags('Password Reset')
@Controller('password-reset')
export class PasswordResetController {
  constructor(
    private readonly passwordResetService: PasswordResetService,
    @InjectModel(Tenant.name) private tenantModel: Model<Tenant>,
    @InjectModel(RefreshSession.name)
    private refreshSessionModel: Model<RefreshSession>,
  ) {}

  @ApiOperation({ summary: 'Send password reset email and generate token' })
  @ApiBody({ type: CreatePasswordResetTokenDto })
  @ApiResponse({
    status: 200,
    description:
      'Password reset token generated (token returned for development only)',
    schema: {
      properties: {
        message: { type: 'string', example: 'Password reset token generated' },
        token: { type: 'string', example: 'hashed_token_value' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid email address' })
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

  @ApiOperation({ summary: 'Verify password reset token' })
  @ApiBody({
    schema: {
      properties: {
        tenantId: {
          type: 'string',
          example: '507f1f77bcf86cd799439011',
          description: 'Tenant ID (MongoDB ObjectId)',
        },
        token: {
          type: 'string',
          example: 'reset_token_value',
          description: 'Password reset token',
        },
      },
      required: ['tenantId', 'token'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Token is valid',
    schema: {
      properties: {
        message: { type: 'string', example: 'Token is valid' },
        expiresAt: { type: 'string', example: '2026-04-13T12:30:00.000Z' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Token is invalid or expired' })
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

  @ApiOperation({ summary: 'Reset password using token' })
  @ApiBody({
    schema: {
      properties: {
        tenantId: {
          type: 'string',
          example: '507f1f77bcf86cd799439011',
          description: 'Tenant ID (MongoDB ObjectId)',
        },
        token: {
          type: 'string',
          example: 'reset_token_value',
          description: 'Password reset token',
        },
        newPassword: {
          type: 'string',
          example: 'newPassword123',
          description: 'New password (minimum 8 characters)',
        },
      },
      required: ['tenantId', 'token', 'newPassword'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Password has been reset successfully',
    schema: {
      properties: {
        message: {
          type: 'string',
          example: 'Password has been reset successfully',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Token is invalid, expired, or already used',
  })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() body: { tenantId: string; token: string; newPassword: string },
  ) {
    // ✅ Validate password rules
    if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(body.newPassword)) {
      throw new BadRequestException(
        'Password must contain at least one letter and one number',
      );
    }

    // ✅ Verify token (checks: not used, not expired, valid for tenantId)
    const tokenRecord = await this.passwordResetService.verifyToken(
      body.tenantId,
      body.token,
    );

    // ✅ Hash new password
    const passwordHash = await bcryptjs.hash(body.newPassword, 10);

    // ✅ Update tenant password
    await this.tenantModel.findByIdAndUpdate(
      new Types.ObjectId(body.tenantId),
      { passwordHash },
    );

    // ✅ Mark token as used (prevent reuse)
    await this.passwordResetService.markTokenAsUsed(tokenRecord._id.toString());

    // ✅ Revoke all refresh sessions for this tenant
    await this.refreshSessionModel.updateMany(
      { tenantId: new Types.ObjectId(body.tenantId), revokedAt: null },
      { revokedAt: new Date() },
    );

    return {
      message: 'Password has been reset successfully. Please login again.',
    };
  }

  @ApiOperation({
    summary: 'Clean up expired password reset tokens (Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Expired tokens cleaned up',
    schema: {
      properties: {
        message: { type: 'string', example: 'Expired tokens cleaned up' },
      },
    },
  })
  @Post('cleanup-expired')
  @HttpCode(HttpStatus.OK)
  async cleanupExpiredTokens() {
    await this.passwordResetService.deleteExpiredTokens();
    return {
      message: 'Expired tokens cleaned up',
    };
  }
}
