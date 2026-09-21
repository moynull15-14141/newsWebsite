import { Controller, Get, Query, UseGuards, Post, Body } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

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
    return this.analyticsService.getOverview(days ? parseInt(days) : 30);
  }

  @Get('top-content')
  @RequirePermissions('analytics.view')
  getTopContent(@Query('days') days?: string, @Query('limit') limit?: string) {
    return this.analyticsService.getTopContent(
      days ? parseInt(days) : 30,
      limit ? parseInt(limit) : 10,
    );
  }

  @Get('top-categories')
  @RequirePermissions('analytics.view')
  getTopCategories(@Query('limit') limit?: string) {
    return this.analyticsService.getTopCategories(limit ? parseInt(limit) : 10);
  }

  @Get('top-locations')
  @RequirePermissions('analytics.view')
  getTopLocations(@Query('limit') limit?: string) {
    return this.analyticsService.getTopLocations(limit ? parseInt(limit) : 10);
  }
}
