import { IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class AssignArticleDto {
  /** `null` clears the assignment. */
  @ValidateIf((o) => o.assigneeId !== null)
  @IsString()
  assigneeId!: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  note?: string;
}
