import { IsString, IsOptional, IsEnum, MinLength, MaxLength, IsInt } from 'class-validator';
import { JobCategoryStatus } from '@prisma/client';

export class CreateJobCategoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(150)
  slug?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsInt()
  @IsOptional()
  sortOrder?: number;
}

export class UpdateJobCategoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsInt()
  @IsOptional()
  sortOrder?: number;

  @IsEnum(JobCategoryStatus)
  @IsOptional()
  status?: JobCategoryStatus;
}
