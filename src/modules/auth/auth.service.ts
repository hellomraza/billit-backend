import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { Model, Types } from 'mongoose';
import { PasswordResetToken } from '../password-reset/password-reset.schema';
import { Tenant } from '../tenant/tenant.schema';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  ResetPasswordDto,
  SignupDto,
} from './dto/auth.dto';
import { RefreshSession } from './refresh-session.schema';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(Tenant.name) private tenantModel: Model<Tenant>,
    @InjectModel(RefreshSession.name)
    private refreshSessionModel: Model<RefreshSession>,
    @InjectModel(PasswordResetToken.name)
    private passwordResetTokenModel: Model<PasswordResetToken>,
    private jwtService: JwtService,
  ) {}

  /**
   * Sign up a new tenant
   */
  async signup(signupDto: SignupDto) {
    const { email, password } = signupDto;

    // Check if email already exists
    const existingTenant = await this.tenantModel.findOne({ email });
    if (existingTenant) {
      throw new ConflictException('Email already registered');
    }

    // Validate password (min 8 chars, at least letter + number)
    if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(password)) {
      throw new BadRequestException(
        'Password must contain at least one letter and one number',
      );
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create tenant
    const newTenant = new this.tenantModel({
      email,
      passwordHash,
      gstEnabled: false,
      abbrLocked: false,
      onboardingComplete: false,
    });

    await newTenant.save();

    return {
      _id: newTenant._id?.toString(),
      email: newTenant.email,
      businessName: newTenant.businessName,
      businessAbbr: newTenant.businessAbbr,
      gstEnabled: newTenant.gstEnabled,
      onboardingComplete: newTenant.onboardingComplete,
    };
  }

  /**
   * Login tenant and issue tokens
   */
  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const tenant = await this.tenantModel.findOne({ email });
    if (!tenant) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(password, tenant.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Generate tokens
    const accessToken = this.generateAccessToken(tenant._id?.toString());
    const refreshToken = await this.generateAndStoreRefreshToken(
      tenant._id?.toString(),
    );

    return {
      accessToken,
      refreshToken,
      tenant,
    };
  }

  /**
   * Refresh access token using refresh token
   * ✅ Validates token against bcryptjs hash (not plaintext comparison)
   */
  async refresh(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token required');
    }

    // Find active sessions (not revoked, not expired)
    const activeSessions = await this.refreshSessionModel.find({
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    });

    // ✅ Validate token against stored hash using bcrypt.compare()
    let validSession: any = null;
    for (const session of activeSessions) {
      const isTokenValid = await bcrypt.compare(
        refreshToken,
        session.tokenHash,
      );
      if (isTokenValid) {
        validSession = session;
        break;
      }
    }

    if (!validSession) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const tenant = await this.tenantModel.findById(validSession.tenantId);
    if (!tenant) {
      throw new UnauthorizedException('Tenant not found');
    }

    // Generate new access token
    const newAccessToken = this.generateAccessToken(tenant._id?.toString());

    return {
      accessToken: newAccessToken,
    };
  }

  /**
   * Logout tenant by revoking refresh token(s)
   * ✅ Revokes all sessions if no token provided
   * ✅ Validates token using bcrypt.compare() before revoking
   */
  async logout(tenantId: string, refreshToken?: string) {
    const tenantObjectId = new Types.ObjectId(tenantId);

    if (refreshToken) {
      // Revoke specific session - find and verify token
      const sessions = await this.refreshSessionModel.find({
        tenantId: tenantObjectId,
        revokedAt: null,
      });

      let sessionToRevoke: any = null;
      for (const session of sessions) {
        const isTokenValid = await bcrypt.compare(
          refreshToken,
          session.tokenHash,
        );
        if (isTokenValid) {
          sessionToRevoke = session;
          break;
        }
      }

      if (sessionToRevoke) {
        await this.refreshSessionModel.updateOne(
          { _id: sessionToRevoke._id },
          { revokedAt: new Date() },
        );
      }
    } else {
      // ✅ Contract requirement (Section 7.2): Revoke all sessions for tenant
      // Revoke all active sessions
      await this.refreshSessionModel.updateMany(
        { tenantId: tenantObjectId, revokedAt: null },
        { revokedAt: new Date() },
      );
    }
  }

  /**
   * Forgot password - generate reset token
   */
  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;

    const tenant = await this.tenantModel.findOne({ email });

    if (tenant) {
      // Generate reset token
      const resetToken = this.generateResetToken();
      const tokenHash = await bcrypt.hash(resetToken, 10);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      const resetTokenDoc = new this.passwordResetTokenModel({
        tenantId: tenant._id,
        tokenHash,
        expiresAt,
        used: false,
      });

      await resetTokenDoc.save();

      // In production, send email with resetToken
      // For now, return token (DEV ONLY)
      return { token: resetToken, message: 'Password reset token generated' };
    } else {
      // Always return generic response for security
      return { message: 'If email exists, password reset link has been sent' };
    }
  }

  /**
   * Reset password using token
   */
  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { email, token, newPassword } = resetPasswordDto;

    // Find tenant by email
    const tenant = await this.tenantModel.findOne({ email });
    if (!tenant) {
      throw new UnauthorizedException('Tenant not found');
    }

    // Validate password rules
    if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(newPassword)) {
      throw new BadRequestException(
        'Password must contain at least one letter and one number',
      );
    }

    // Fetch all valid reset tokens for this specific tenant
    const validTokens = await this.passwordResetTokenModel.find({
      tenantId: tenant._id,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    // Find the token that matches the provided token
    let resetTokenDoc: any = null;
    for (const tokenDoc of validTokens) {
      const isTokenValid = await bcrypt.compare(token, tokenDoc.tokenHash);
      if (isTokenValid) {
        resetTokenDoc = tokenDoc;
        break;
      }
    }

    if (!resetTokenDoc) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update tenant password
    await this.tenantModel.findByIdAndUpdate(tenant._id, {
      passwordHash,
    });

    // Mark token as used
    await this.passwordResetTokenModel.findByIdAndUpdate(resetTokenDoc._id, {
      used: true,
    });

    // Revoke all refresh sessions for this tenant
    await this.refreshSessionModel.updateMany(
      { tenantId: tenant._id, revokedAt: null },
      { revokedAt: new Date() },
    );
  }

  /**
   * Change password (requires current password)
   */
  async changePassword(tenantId: string, changePasswordDto: ChangePasswordDto) {
    const { currentPassword, newPassword } = changePasswordDto;

    const tenant = await this.tenantModel.findById(tenantId);
    if (!tenant) {
      throw new UnauthorizedException('Tenant not found');
    }

    // Verify current password
    const isCurrentValid = await bcrypt.compare(
      currentPassword,
      tenant.passwordHash,
    );
    if (!isCurrentValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Validate new password rules
    if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(newPassword)) {
      throw new BadRequestException(
        'Password must contain at least one letter and one number',
      );
    }

    // Hash and update new password
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.tenantModel.findByIdAndUpdate(tenantId, { passwordHash });

    // Revoke all refresh sessions
    await this.refreshSessionModel.updateMany(
      { tenantId: new Types.ObjectId(tenantId), revokedAt: null },
      { revokedAt: new Date() },
    );
  }

  /**
   * Verify tenant exists
   */
  async getTenant(tenantId: string) {
    const tenant = await this.tenantModel.findById(tenantId);
    if (!tenant) {
      throw new UnauthorizedException('Tenant not found');
    }
    return tenant;
  }

  // ==================== Private Helpers ====================

  private generateAccessToken(tenantId: string): string {
    return this.jwtService.sign(
      { sub: tenantId },
      {
        expiresIn: '7d',
        secret: process.env.JWT_SECRET || 'dev-secret',
      },
    );
  }

  private async generateAndStoreRefreshToken(
    tenantId: string,
  ): Promise<string> {
    const refreshToken = this.generateRandomToken();
    const tokenHash = await bcrypt.hash(refreshToken, 10);

    const session = new this.refreshSessionModel({
      tenantId: new Types.ObjectId(tenantId),
      tokenHash,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });

    await session.save();
    return refreshToken;
  }

  private generateResetToken(): string {
    return this.generateRandomToken();
  }

  private generateRandomToken(): string {
    return require('crypto').randomBytes(32).toString('hex');
  }
}
