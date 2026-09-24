import { IsString, IsEnum, IsInt, Min, MaxLength, IsOptional } from 'class-validator';
import { MediaUploadPurpose } from '../media-limits';

export class CreatePresignedUploadDto {
  @IsString()
  @MaxLength(300)
  filename!: string;

  @IsString()
  contentType!: string;

  @IsInt()
  @Min(1)
  size!: number;

  @IsEnum(MediaUploadPurpose)
  @IsOptional()
  purpose?: MediaUploadPurpose;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  altText?: string;
}
