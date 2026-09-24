import { IsString, IsOptional, IsEnum, IsUUID, MinLength, MaxLength, IsInt, Min, IsDateString, IsUrl } from 'class-validator';
import { AdDeviceTarget, AdPageTarget } from '@prisma/client';

export class UpdateCampaignDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @IsOptional()
  name?: string;

  @IsUUID()
  @IsOptional()
  advertiserId?: string;

  @IsDateString()
  @IsOptional()
  startAt?: string;

  @IsDateString()
  @IsOptional()
  endAt?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  priority?: number;

  @IsUrl({ require_protocol: true })
  @IsOptional()
  @MaxLength(2000)
  targetUrl?: string;

  @IsUUID()
  @IsOptional()
  languageId?: string;

  @IsEnum(AdDeviceTarget)
  @IsOptional()
  deviceTarget?: AdDeviceTarget;

  @IsEnum(AdPageTarget)
  @IsOptional()
  pageTarget?: AdPageTarget;

  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @IsString()
  @IsOptional()
  locationId?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  frequencyCapPerDay?: number;

  @IsString()
  @IsOptional()
  @MaxLength(4000)
  notes?: string;

  /** Optimistic-concurrency check, same pattern as UpdateJobDto.expectedUpdatedAt. */
  @IsDateString()
  @IsOptional()
  expectedUpdatedAt?: string;
}
