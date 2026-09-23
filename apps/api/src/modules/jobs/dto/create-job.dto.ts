import {
  IsString, IsOptional, IsEnum, IsUUID, MinLength, MaxLength, IsBoolean, IsInt, IsDateString, Min, IsIn, IsUrl, IsEmail,
} from 'class-validator';
import { EmploymentType, WorkplaceType, ApplicationMethod } from '@prisma/client';

export class CreateJobDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title!: string;

  @IsString()
  @IsOptional()
  @MaxLength(320)
  slug?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  summary?: string;

  @IsOptional()
  description?: any;

  @IsOptional()
  responsibilities?: any;

  @IsOptional()
  requirements?: any;

  @IsOptional()
  qualifications?: any;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  experience?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  salaryMin?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  salaryMax?: number;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  salaryCurrency?: string;

  @IsBoolean()
  @IsOptional()
  salaryNegotiable?: boolean;

  @IsEnum(EmploymentType)
  employmentType!: EmploymentType;

  @IsEnum(WorkplaceType)
  @IsOptional()
  workplaceType?: WorkplaceType;

  @IsInt()
  @Min(1)
  @IsOptional()
  vacancies?: number;

  @IsUUID()
  categoryId!: string;

  @IsUUID()
  employerId!: string;

  @IsString()
  @IsOptional()
  locationId?: string;

  @IsEnum(ApplicationMethod)
  @IsOptional()
  applicationMethod?: ApplicationMethod;

  @IsUrl({ require_protocol: true })
  @IsOptional()
  @MaxLength(1000)
  externalApplyUrl?: string;

  @IsEmail()
  @IsOptional()
  @MaxLength(320)
  applicationEmail?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  applicationInstructions?: string;

  @IsBoolean()
  @IsOptional()
  featured?: boolean;

  @IsDateString()
  @IsOptional()
  deadline?: string;

  @IsDateString()
  @IsOptional()
  scheduledAt?: string;
}
