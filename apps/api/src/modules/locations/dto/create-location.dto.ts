import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateLocationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  slug!: string;

  @IsEnum(['COUNTRY', 'DIVISION', 'DISTRICT', 'UPAZILA'])
  type!: 'COUNTRY' | 'DIVISION' | 'DISTRICT' | 'UPAZILA';

  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsOptional()
  @IsEnum(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';
}

