import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class TagTranslationDto {
  @IsString()
  languageId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  slug?: string;
}
