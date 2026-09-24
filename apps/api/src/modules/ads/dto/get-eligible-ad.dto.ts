import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { AdPlacementKey, AdDeviceTarget, AdPageTarget } from '@prisma/client';

export class GetEligibleAdDto {
  @IsEnum(AdPlacementKey)
  placement!: AdPlacementKey;

  @IsEnum(AdPageTarget)
  @IsOptional()
  pageType?: AdPageTarget;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsString()
  @IsOptional()
  locationId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  lang?: string;

  @IsEnum(AdDeviceTarget)
  @IsOptional()
  device?: AdDeviceTarget;

  /** A short, non-identifying page reference (e.g. an article/category slug) stored on AdEvent.context
   * for future per-page analytics — never used for targeting/eligibility itself. */
  @IsString()
  @IsOptional()
  @MaxLength(200)
  context?: string;

  /** Comma-separated campaign ids the page has already shown in other placements this pageview (see
   * apps/web/src/lib/ad-session.ts) — best-effort de-duplication across a single page load, not a hard
   * guarantee (independent AdSlot fetches can race), hence "where practical" in the spec. */
  @IsString()
  @IsOptional()
  @MaxLength(4000)
  excludeCampaignIds?: string;
}

export class RecordAdEventDto {
  @IsEnum(AdPlacementKey)
  placement!: AdPlacementKey;

  @IsString()
  creativeId!: string;

  @IsString()
  @IsOptional()
  sessionId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  context?: string;

  @IsEnum(AdDeviceTarget)
  @IsOptional()
  device?: AdDeviceTarget;
}
