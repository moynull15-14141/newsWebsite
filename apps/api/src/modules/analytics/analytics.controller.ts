import { Controller, Get, Query, UseGuards, Post, Body } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { parsePositiveInt } from '../../common/pagination/parse-pagination';

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

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}


  @Get('overview')
  @RequirePermissions('analytics.view')
  getOverview(@Query('days') days?: string) {
    return this.analyticsService.getOverview(parsePositiveInt(days, 30, 365));
  }

  @Get('top-content')
  @RequirePermissions('analytics.view')
  getTopContent(@Query('days') days?: string, @Query('limit') limit?: string) {
    return this.analyticsService.getTopContent(
      parsePositiveInt(days, 30, 365),
      parsePositiveInt(limit, 10, 100),
    );
  }

  @Get('top-categories')
  @RequirePermissions('analytics.view')
  getTopCategories(@Query('limit') limit?: string) {
    return this.analyticsService.getTopCategories(parsePositiveInt(limit, 10, 100));
  }

  @Get('top-locations')
  @RequirePermissions('analytics.view')
  getTopLocations(@Query('limit') limit?: string) {
    return this.analyticsService.getTopLocations(parsePositiveInt(limit, 10, 100));
  }
}
