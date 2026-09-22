import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEnum, IsLatitude, IsLongitude, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { LocationTranslationDto } from './location-translation.dto';

export class UpdateLocationDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  slug?: string;

  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsOptional()
  @IsEnum(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';

  @IsOptional()
  @IsString()
  @MaxLength(2)
  countryCode?: string | null;

  @IsOptional()
  @IsLatitude()
  latitude?: number | null;

  @IsOptional()
  @IsLongitude()
  longitude?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  timezone?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => LocationTranslationDto)
  translations?: LocationTranslationDto[];
}
