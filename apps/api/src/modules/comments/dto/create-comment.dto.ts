import { IsString, IsOptional, MaxLength, MinLength } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  guestName?: string;

  @IsString()
  @IsOptional()
  parentId?: string;
}
