import { IsString, IsOptional, IsEnum, MinLength, MaxLength, IsUrl, IsEmail } from 'class-validator';
import { EmployerStatus } from '@prisma/client';

export class CreateEmployerDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(220)
  slug?: string;

  @IsString()
  @IsOptional()
  logoMediaId?: string;

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

export class UpdateEmployerDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  logoMediaId?: string;

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
  locationId?: string;

  @IsEmail()
  @IsOptional()
  @MaxLength(320)
  contactEmail?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  contactPhone?: string;

  @IsEnum(EmployerStatus)
  @IsOptional()
  status?: EmployerStatus;
}
