import { IsString, IsOptional, IsEnum, IsArray, IsUUID, MinLength, MaxLength, IsBoolean, IsNumber, IsDateString } from 'class-validator';

export class UpdateArticleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  slug?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  excerpt?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  seoTitle?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  seoDescription?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  seoKeywords?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  canonicalUrl?: string;

  @IsBoolean()
  @IsOptional()
  noIndex?: boolean;

  @IsOptional()
  content?: any;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsString()
  @IsOptional()
  locationId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tagIds?: string[];

  @IsString()
  @IsOptional()
  featuredImageId?: string;

  @IsBoolean()
  @IsOptional()
  isBreaking?: boolean;

  @IsNumber()
  @IsOptional()
  breakingPriority?: number;

  @IsDateString()
  @IsOptional()
  breakingEndsAt?: string;

  @IsDateString()
  @IsOptional()
  scheduledAt?: string;

  /** Reassigning language is rare (fixing a mistaken creation) but not blocked. */
  @IsString()
  @IsOptional()
  languageId?: string;

  /** The `updatedAt` the editor last loaded, for optimistic-concurrency checking (Phase 2H). When
   * provided and it no longer matches the persisted row, the update is rejected with 409 rather than
   * silently overwriting whatever another editor saved in the meantime. Omitted entirely by callers
   * that don't care about staleness (e.g. workflow actions that patch a single field). */
  @IsDateString()
  @IsOptional()
  expectedUpdatedAt?: string;
}
