import { IsString, IsOptional, MinLength, MaxLength, IsEmail, IsBoolean } from 'class-validator';

export class CreateAdvertiserDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  contactName?: string;

  @IsEmail()
  @IsOptional()
  @MaxLength(320)
  contactEmail?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  contactPhone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(4000)
  notes?: string;

  @IsBoolean()
  @IsOptional()
  active?: boolean;
}
