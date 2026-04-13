import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcryptjs from 'bcryptjs';
import * as crypto from 'crypto';
import { Model, Types } from 'mongoose';
import { PasswordResetToken } from './password-reset.schema';

@Injectable()
export class PasswordResetService {
  constructor(
    @InjectModel(PasswordResetToken.name)
    private tokenModel: Model<PasswordResetToken>,
  ) {}

  async generateToken(tenantId: string): Promise<string> {
    // Generate a random token
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = await bcryptjs.hash(token, 10);

    // Calculate expiry (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const tokenRecord = new this.tokenModel({
      tenantId: new Types.ObjectId(tenantId),
      tokenHash,
      expiresAt,
      used: false,
    });

    await tokenRecord.save();
    return token; // Return the raw token to send to user
  }

  async verifyToken(
    tenantId: string,
    token: string,
  ): Promise<PasswordResetToken> {
    const tokenRecords = await this.tokenModel.find({
      tenantId: new Types.ObjectId(tenantId),
      used: false,
      expiresAt: { $gt: new Date() },
    });

    for (const record of tokenRecords) {
      const isValid = await bcryptjs.compare(token, record.tokenHash);
      if (isValid) {
        return record;
      }
    }

    throw new BadRequestException('Invalid or expired token');
  }

  async markTokenAsUsed(tokenId: string): Promise<PasswordResetToken> {
    const token = await this.tokenModel.findByIdAndUpdate(
      tokenId,
      { used: true },
      { new: true },
    );

    if (!token) {
      throw new NotFoundException('Token not found');
    }

    return token;
  }

  async deleteExpiredTokens(): Promise<void> {
    await this.tokenModel.deleteMany({
      expiresAt: { $lt: new Date() },
    });
  }
}
