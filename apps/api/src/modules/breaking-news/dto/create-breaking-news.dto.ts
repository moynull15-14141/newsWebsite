import { IsString, IsOptional, IsBoolean, IsInt, IsDateString, IsIn, MinLength, MaxLength, Min } from 'class-validator';
import { IsHexColor, BACKGROUND_MODES, GRADIENT_DIRECTIONS, type BackgroundMode, type GradientDirection } from './breaking-news-color.validators';

export class CreateBreakingNewsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  headline!: string;

  @IsString()
  @IsOptional()
  articleId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  priority?: number;

  @IsDateString()
  @IsOptional()
  startAt?: string;

  @IsDateString()
  @IsOptional()
  endAt?: string;

  @IsIn(BACKGROUND_MODES)
  @IsOptional()
  backgroundMode?: BackgroundMode;

  @IsHexColor()
  @IsOptional()
  backgroundColor?: string;

  @IsHexColor()
  @IsOptional()
  gradientStart?: string;

  @IsHexColor()
  @IsOptional()
  gradientEnd?: string;

  @IsIn(GRADIENT_DIRECTIONS)
  @IsOptional()
  gradientDirection?: GradientDirection;

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
