import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PublishingService } from '../services/publishing.service';
import { BreakingNewsService } from '../services/breaking-news.service';

@Injectable()
export class ScheduledPublishingScheduler {
  private readonly logger = new Logger(ScheduledPublishingScheduler.name);

  constructor(
    private readonly publishingService: PublishingService,
    private readonly breakingNewsService: BreakingNewsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledPublishing() {
    try {
      const published = await this.publishingService.executeScheduledPublications();
      if (published.length > 0) {
        this.logger.log(`Published ${published.length} scheduled articles`);
      }
    } catch (error) {
      this.logger.error('Failed to execute scheduled publishing', error);
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleBreakingNewsExpiration() {
    try {
      const cleared = await this.breakingNewsService.clearExpiredBreaking();
      if (cleared.length > 0) {
        this.logger.log(`Cleared ${cleared.length} expired breaking news items`);
      }
    } catch (error) {
      this.logger.error('Failed to clear expired breaking news', error);
    }
  }
}
