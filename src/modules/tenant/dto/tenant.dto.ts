import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateTenantDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @IsString()
  @IsNotEmpty()
  businessName: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(6)
  @Matches(/^[A-Z0-9]+$/)
  businessAbbr: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9]{1}$/)
  gstNumber?: string;

  @IsOptional()
  @IsBoolean()
  gstEnabled?: boolean;
}

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  businessName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9]{1}$/)
  gstNumber?: string;

  @IsOptional()
  @IsBoolean()
  gstEnabled?: boolean;
}

export class TenantResponseDto {
  _id: string;
  email: string;
  businessName: string;
  businessAbbr: string;
  gstNumber?: string;
  gstEnabled: boolean;
  abbrLocked: boolean;
  createdAt: Date;
  updatedAt: Date;
}
