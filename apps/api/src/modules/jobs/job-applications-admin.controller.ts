import { Controller, Get, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { JobsService } from './jobs.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { parsePage, parsePositiveInt, DEFAULT_LIMIT, MAX_LIMIT } from '../../common/pagination/parse-pagination';

class UpdateApplicationStatusDto {
  @IsIn(['SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'REJECTED', 'ACCEPTED'])
  status!: string;

  /** Staff-only internal note — never returned to the applicant (see ReaderService.getMyApplication's
   * select, which omits this field entirely). */
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
}

@Controller('job-applications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class JobApplicationsAdminController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  @RequirePermissions('job_application.view')
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('jobId') jobId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.jobsService.listApplications({
      page: parsePage(page), limit: parsePositiveInt(limit, DEFAULT_LIMIT, MAX_LIMIT), jobId, status, search,
    });
  }

  @Get(':id')
  @RequirePermissions('job_application.view')
  findOne(@Param('id') id: string) {
    return this.jobsService.getApplication(id);
  }

  @Patch(':id/status')
  @RequirePermissions('job_application.manage')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateApplicationStatusDto, @CurrentUser('userId') userId: string) {
    return this.jobsService.updateApplicationStatus(id, dto.status, dto.note, userId);
  }
}
