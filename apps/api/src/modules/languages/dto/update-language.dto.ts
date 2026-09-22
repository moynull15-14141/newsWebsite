import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

/** Code is immutable after creation — it is baked into URL prefixes and translation rows. */
export class UpdateLanguageDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  nativeName?: string;

  @IsOptional()
  @IsIn(['ltr', 'rtl'])
  direction?: 'ltr' | 'rtl';

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  sortOrder?: number;
}
