import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { QueryJobsDto } from './dto/query-jobs.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { parsePage, parsePositiveInt, DEFAULT_LIMIT, MAX_LIMIT } from '../../common/pagination/parse-pagination';

@Controller('jobs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  @RequirePermissions('job.create')
  create(@Body() dto: CreateJobDto, @CurrentUser('userId') userId: string) {
    return this.jobsService.create(dto, userId);
  }

  @Get()
  @RequirePermissions('job.read')
  findAll(@Query() query: QueryJobsDto) {
    return this.jobsService.findAll(query);
  }

  @Get('dashboard')
  @RequirePermissions('job.read')
  getDashboard() {
    return this.jobsService.getDashboardStats();
  }

  @Get('slug/:slug')
  @RequirePermissions('job.read')
  findBySlug(@Param('slug') slug: string) {
    return this.jobsService.findBySlug(slug);
  }

  @Get(':id')
  @RequirePermissions('job.read')
  findOne(@Param('id') id: string) {
    return this.jobsService.findOne(id);
  }

  @Get(':id/audit-log')
  @RequirePermissions('job.read')
  getAuditLog(@Param('id') id: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.jobsService.getAuditLog(id, parsePage(page), parsePositiveInt(limit, DEFAULT_LIMIT, MAX_LIMIT));
  }

  @Patch(':id')
  @RequirePermissions('job.edit')
  update(@Param('id') id: string, @Body() dto: UpdateJobDto, @CurrentUser('userId') userId: string) {
    return this.jobsService.update(id, dto, userId);
  }

  @Delete(':id')
  @RequirePermissions('job.delete')
  remove(@Param('id') id: string) {
    return this.jobsService.remove(id);
  }

  @Post(':id/submit-review')
  submitReview(@Param('id') id: string, @CurrentUser('userId') userId: string, @Req() req: any) {
    return this.jobsService.submitReview(id, userId, req.user?.permissions || []);
  }

  @Post(':id/approve')
  @RequirePermissions('job.review')
  approve(@Param('id') id: string, @CurrentUser('userId') userId: string, @Req() req: any) {
    return this.jobsService.approve(id, userId, req.user?.permissions || []);
  }

  @Post(':id/return-to-draft')
  @RequirePermissions('job.review')
  returnToDraft(@Param('id') id: string, @CurrentUser('userId') userId: string, @Body('reason') reason?: string) {
    return this.jobsService.returnToDraft(id, userId, reason);
  }

  @Post(':id/publish')
  @RequirePermissions('job.publish')
  publish(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.jobsService.publish(id, userId);
  }

  @Post(':id/schedule')
  @RequirePermissions('job.publish')
  schedule(@Param('id') id: string, @Body('scheduledAt') scheduledAt: string, @CurrentUser('userId') userId: string) {
    return this.jobsService.schedule(id, scheduledAt, userId);
  }

  @Post(':id/cancel-schedule')
  @RequirePermissions('job.publish')
  cancelSchedule(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.jobsService.cancelSchedule(id, userId);
  }

  @Post(':id/archive')
  @RequirePermissions('job.publish')
  archive(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.jobsService.archive(id, userId);
  }

  @Post(':id/featured')
  @RequirePermissions('job.publish')
  setFeatured(@Param('id') id: string, @Body('featured') featured: boolean, @CurrentUser('userId') userId: string) {
    return this.jobsService.setFeatured(id, !!featured, userId);
  }
}
