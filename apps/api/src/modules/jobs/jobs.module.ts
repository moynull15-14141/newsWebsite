import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobCategoriesController } from './job-categories.controller';
import { EmployersController } from './employers.controller';
import { PublicJobsController } from './public-jobs.controller';
import { JobApplicationsAdminController } from './job-applications-admin.controller';
import { JobsService } from './jobs.service';
import { PublicJobsService } from './public-jobs.service';
import { JobAuditLogService } from './services/job-audit-log.service';
import { JobScheduler } from './schedulers/job-scheduler.service';

@Module({
  controllers: [JobsController, JobCategoriesController, EmployersController, PublicJobsController, JobApplicationsAdminController],
  providers: [JobsService, PublicJobsService, JobAuditLogService, JobScheduler],
  exports: [JobsService, PublicJobsService],
})
export class JobsModule {}
