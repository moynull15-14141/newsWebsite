import { IsString, IsOptional } from 'class-validator';

export class ModerateCommentDto {
  @IsString()
  @IsOptional()
  reason?: string;
}
