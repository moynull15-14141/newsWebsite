import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { JobsService } from '../jobs.service';

/** Mirrors ScheduledPublishingScheduler (articles) — see that file for the pattern this copies. */
@Injectable()
export class JobScheduler {
  private readonly logger = new Logger(JobScheduler.name);

  constructor(private readonly jobsService: JobsService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledPublishing() {
    try {
      const published = await this.jobsService.executeScheduledPublications();
      if (published.length > 0) this.logger.log(`Published ${published.length} scheduled job postings`);
    } catch (error) {
      this.logger.error('Failed to execute scheduled job publishing', error);
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleExpiration() {
    try {
      const expired = await this.jobsService.expireDueJobs();
      if (expired.length > 0) this.logger.log(`Expired ${expired.length} job postings past their deadline`);
    } catch (error) {
      this.logger.error('Failed to expire due job postings', error);
    }
  }
}
