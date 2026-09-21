import { IsString, IsOptional, IsEnum, IsInt, IsDateString, MaxLength, MinLength } from 'class-validator';

export class CreateAdDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsEnum(['BANNER', 'IMAGE', 'HTML'])
  type!: string;

  @IsString()
  @IsOptional()
  mediaId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  targetUrl?: string;

  @IsString()
  @IsOptional()
  htmlContent?: string;

  @IsString()
  slot!: string;

  @IsInt()
  @IsOptional()
  priority?: number;

  @IsDateString()
  @IsOptional()
  startAt?: string;

  @IsDateString()
  @IsOptional()
  endAt?: string;

  @IsString()
  @IsOptional()
  deviceTarget?: string;

  @IsString()
  @IsOptional()
  pageTarget?: string;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsString()
  @IsOptional()
  locationId?: string;
}
