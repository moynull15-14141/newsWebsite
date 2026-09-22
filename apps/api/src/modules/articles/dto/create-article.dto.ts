import { IsString, IsOptional, IsEnum, IsArray, IsUUID, MinLength, MaxLength, IsBoolean, IsNumber, IsDateString } from 'class-validator';

export class CreateArticleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title!: string;

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

  /** Defaults to the platform's default language when omitted. */
  @IsString()
  @IsOptional()
  languageId?: string;
}
