import { IsString } from 'class-validator';

export class CreateTranslationDto {
  @IsString()
  languageId!: string;
}
