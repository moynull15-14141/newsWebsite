import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateMediaDto {
  @IsString()
  @IsOptional()
  @MaxLength(500)
  altText?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  caption?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  credit?: string;
}
