import { Body, Controller, Post } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { AnalyticsService } from './analytics.service';
import { Public } from '../../common/decorators/public.decorator';

class TrackAnalyticsEventDto {
  @IsIn(['ARTICLE_SHARE', 'SEARCH', 'CATEGORY_VIEW', 'LOCATION_VIEW'])
  eventType!: string;

  @IsOptional()
  @IsString()
  articleId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  locationId?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  searchTerm?: string;
}

@Controller('public')
export class PublicAnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Public()
  @Post('analytics/events')
  trackEvent(@Body() dto: TrackAnalyticsEventDto) {
    const { eventType, searchTerm, ...links } = dto;
    return this.analyticsService.trackEvent(eventType, {
      ...links,
      metadata: searchTerm ? { searchTerm } : undefined,
    });
  }
}
