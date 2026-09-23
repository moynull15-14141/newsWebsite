import { ArrayMaxSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class UpdateRelatedArticlesDto {
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  relatedArticleIds!: string[];
}
