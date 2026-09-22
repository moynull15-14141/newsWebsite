import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateLanguageDto {
  /** Lowercase ISO 639-1-style code, e.g. "bn", "en". Kept short and predictable for URL prefixes. */
  @IsString()
  @Matches(/^[a-z]{2,8}$/, { message: 'code must be 2-8 lowercase letters (e.g. "bn", "en")' })
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  nativeName!: string;

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
