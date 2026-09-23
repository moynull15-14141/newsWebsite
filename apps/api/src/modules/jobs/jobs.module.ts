import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobCategoriesController } from './job-categories.controller';
import { EmployersController } from './employers.controller';
import { PublicJobsController } from './public-jobs.controller';
import { JobApplicationsAdminController } from './job-applications-admin.controller';
import { JobsService } from './jobs.service';
import { PublicJobsService } from './public-jobs.service';
import { JobAuditLogService } from './services/job-audit-log.service';
import { EmployerAuditLogService } from './services/employer-audit-log.service';
import { JobScheduler } from './schedulers/job-scheduler.service';

@Module({
  controllers: [JobsController, JobCategoriesController, EmployersController, PublicJobsController, JobApplicationsAdminController],
  providers: [JobsService, PublicJobsService, JobAuditLogService, EmployerAuditLogService, JobScheduler],
  exports: [JobsService, PublicJobsService, JobAuditLogService, EmployerAuditLogService],
})
export class JobsModule {}
