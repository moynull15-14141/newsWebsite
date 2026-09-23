import { IsString, IsOptional, IsBoolean, IsInt, IsDateString, IsIn, MinLength, MaxLength, Min, ValidateIf } from 'class-validator';
import { IsHexColor, BACKGROUND_MODES, GRADIENT_DIRECTIONS, type BackgroundMode, type GradientDirection } from './breaking-news-color.validators';

export class UpdateBreakingNewsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  @IsOptional()
  headline?: string;

  /** `null` explicitly unlinks the article; `undefined` (omitted) leaves the current link untouched. */
  @ValidateIf((o) => o.articleId !== null)
  @IsString()
  @IsOptional()
  articleId?: string | null;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  priority?: number;

  @ValidateIf((o) => o.startAt !== null)
  @IsDateString()
  @IsOptional()
  startAt?: string | null;

  @ValidateIf((o) => o.endAt !== null)
  @IsDateString()
  @IsOptional()
  endAt?: string | null;

  @IsIn(BACKGROUND_MODES)
  @IsOptional()
  backgroundMode?: BackgroundMode;

  @IsHexColor()
  @IsOptional()
  backgroundColor?: string;

  @ValidateIf((o) => o.gradientStart !== null)
  @IsHexColor()
  @IsOptional()
  gradientStart?: string | null;

  @ValidateIf((o) => o.gradientEnd !== null)
  @IsHexColor()
  @IsOptional()
  gradientEnd?: string | null;

  @ValidateIf((o) => o.gradientDirection !== null)
  @IsIn(GRADIENT_DIRECTIONS)
  @IsOptional()
  gradientDirection?: GradientDirection | null;

  @IsHexColor()
  @IsOptional()
  textColor?: string;

  @IsHexColor()
  @IsOptional()
  badgeBackgroundColor?: string;

  @IsHexColor()
  @IsOptional()
  badgeTextColor?: string;

  @IsInt()
  @Min(2000)
  @IsOptional()
  animationSpeedMs?: number;
}
