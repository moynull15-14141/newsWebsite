import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class ReorderBreakingNewsDto {
  /** Every breaking-news id in the desired display order (top to bottom / first to cycle). */
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  orderedIds!: string[];
}
