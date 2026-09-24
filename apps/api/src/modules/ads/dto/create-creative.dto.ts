import { IsString, IsOptional, IsEnum, IsUUID, MaxLength, IsBoolean, IsInt, Min, IsUrl } from 'class-validator';
import { AdCreativeType } from '@prisma/client';

export class CreateCreativeDto {
  @IsUUID()
  campaignId!: string;

  @IsEnum(AdCreativeType)
  type!: AdCreativeType;

  @IsUUID()
  @IsOptional()
  desktopMediaId?: string;

  @IsUUID()
  @IsOptional()
  mobileMediaId?: string;

  @IsUrl({ require_protocol: true })
  @IsOptional()
  @MaxLength(2000)
  targetUrl?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  ctaText?: string;

  @IsString()
  @IsOptional()
  @MaxLength(300)
  altText?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  nativeHeadline?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  nativeBody?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  nativeSponsorLabel?: string;

  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @IsInt()
  @Min(1)
  @IsOptional()
  rotationWeight?: number;
}
