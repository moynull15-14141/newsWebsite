import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEnum, IsLatitude, IsLongitude, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { LOCATION_TYPES, LocationTypeValue } from '../location-types';
import { LocationTranslationDto } from './location-translation.dto';

export class CreateLocationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  slug!: string;

  @IsEnum(LOCATION_TYPES)
  type!: LocationTypeValue;

  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsOptional()
  @IsEnum(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';

  /** ISO 3166-1 alpha-2, relevant for COUNTRY (and useful on CONTINENT/STATE) rows. */
  @IsOptional()
  @IsString()
  @MaxLength(2)
  countryCode?: string;

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  timezone?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => LocationTranslationDto)
  translations?: LocationTranslationDto[];
}
