import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AdCampaignsService } from './services/ad-campaigns.service';
import { AdCreativesService } from './services/ad-creatives.service';
import { AdEventsService } from './services/ad-events.service';
import { AdAuditLogService } from './services/ad-audit-log.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { QueryCampaignsDto } from './dto/query-campaigns.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { parsePage, parsePositiveInt, MAX_LIMIT } from '../../common/pagination/parse-pagination';

@Controller('ad-campaigns')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdCampaignsController {
  constructor(
    private readonly campaigns: AdCampaignsService,
    private readonly creatives: AdCreativesService,
    private readonly events: AdEventsService,
    private readonly auditLog: AdAuditLogService,
  ) {}

  @Get('overview')
  @RequirePermissions('ads.view')
  overview() {
    return this.campaigns.getOverview();
  }

  /** Platform-wide audit feed for the Admin > Ads > Audit Log page — every campaign's history plus
   * placement-registry-level entries, across all campaigns. Declared before `:id` so it is never
   * swallowed by that param route (two path segments here vs. one for `:id` anyway, but explicit). */
  @Get('audit-log/all')
  @RequirePermissions('ads.view')
  fullAuditLog(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.auditLog.listAll(parsePage(page), parsePositiveInt(limit, 50, MAX_LIMIT));
  }

  @Post()
  @RequirePermissions('ads.create')
  create(@Body() dto: CreateCampaignDto, @CurrentUser('userId') userId: string) {
    return this.campaigns.create(dto, userId);
  }

  @Get()
  @RequirePermissions('ads.view')
  findAll(@Query() query: QueryCampaignsDto) {
    return this.campaigns.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('ads.view')
  findOne(@Param('id') id: string) {
    return this.campaigns.findOne(id);
  }

  @Get(':id/creatives')
  @RequirePermissions('ads.view')
  creativesForCampaign(@Param('id') id: string) {
    return this.creatives.findAllForCampaign(id);
  }

  @Get(':id/stats')
  @RequirePermissions('ads.analytics.view')
  stats(@Param('id') id: string, @Query('days') days?: string) {
    return this.events.getCampaignStats(id, days ? parseInt(days, 10) : 30);
  }

  @Get(':id/audit-log')
  @RequirePermissions('ads.view')
  campaignAuditLog(@Param('id') id: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.campaigns.getAuditLog(id, parsePage(page), parsePositiveInt(limit, 50, MAX_LIMIT));
  }

  @Patch(':id')
  @RequirePermissions('ads.update')
  update(@Param('id') id: string, @Body() dto: UpdateCampaignDto, @CurrentUser('userId') userId: string) {
    return this.campaigns.update(id, dto, userId);
  }

  @Delete(':id')
  @RequirePermissions('ads.delete')
  remove(@Param('id') id: string) {
    return this.campaigns.remove(id);
  }

  @Post(':id/submit-review')
  @RequirePermissions('ads.create')
  submitForReview(@Param('id') id: string, @CurrentUser('userId') userId: string, @Req() req: any) {
    return this.campaigns.submitForReview(id, userId, req.user?.permissions || []);
  }

  @Post(':id/approve')
  @RequirePermissions('ads.approve')
  approve(@Param('id') id: string, @CurrentUser('userId') userId: string, @Req() req: any) {
    return this.campaigns.approve(id, userId, req.user?.permissions || []);
  }

  @Post(':id/reject')
  @RequirePermissions('ads.approve')
  reject(@Param('id') id: string, @CurrentUser('userId') userId: string, @Body('reason') reason?: string) {
    return this.campaigns.reject(id, userId, reason);
  }

  @Post(':id/schedule')
  @RequirePermissions('ads.publish')
  schedule(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.campaigns.schedule(id, userId);
  }

  @Post(':id/cancel-schedule')
  @RequirePermissions('ads.publish')
  cancelSchedule(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.campaigns.cancelSchedule(id, userId);
  }

  @Post(':id/activate')
  @RequirePermissions('ads.publish')
  activate(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.campaigns.activate(id, userId);
  }

  @Post(':id/pause')
  @RequirePermissions('ads.publish')
  pause(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.campaigns.pause(id, userId);
  }

  @Post(':id/resume')
  @RequirePermissions('ads.publish')
  resume(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.campaigns.resume(id, userId);
  }

  @Post(':id/archive')
  @RequirePermissions('ads.publish')
  archive(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.campaigns.archive(id, userId);
  }
}
