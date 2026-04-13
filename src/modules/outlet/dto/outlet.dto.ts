import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateOutletDto {
  @IsString()
  @IsNotEmpty()
  outletName: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(6)
  outletAbbr: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateOutletDto {
  @IsOptional()
  @IsString()
  outletName?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(6)
  outletAbbr?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class OutletResponseDto {
  _id: string;
  tenantId: string;
  outletName: string;
  outletAbbr: string;
  isDefault: boolean;
  abbrLocked: boolean;
  createdAt: Date;
  updatedAt: Date;
}
