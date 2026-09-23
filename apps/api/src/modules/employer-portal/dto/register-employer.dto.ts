import { IsString, IsOptional, MinLength, MaxLength, IsUrl, IsEmail, IsInt, Min, Max } from 'class-validator';

export class RegisterEmployerDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(220)
  slug?: string;

  @IsUrl({ require_protocol: true })
  @IsOptional()
  @MaxLength(1000)
  website?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(150)
  industry?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  companySize?: string;

  @IsInt()
  @Min(1800)
  @Max(2100)
  @IsOptional()
  foundedYear?: number;

  @IsString()
  @IsOptional()
  locationId?: string;

  @IsEmail()
  @IsOptional()
  @MaxLength(320)
  contactEmail?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  contactPhone?: string;
}
