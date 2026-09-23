import { IsDateString, IsOptional, ValidateIf } from 'class-validator';

export class ScheduleBreakingNewsDto {
  @ValidateIf((value) => value.startAt !== null)
  @IsDateString()
  @IsOptional()
  startAt?: string | null;

  @ValidateIf((value) => value.endAt !== null)
  @IsDateString()
  @IsOptional()
  endAt?: string | null;
}
