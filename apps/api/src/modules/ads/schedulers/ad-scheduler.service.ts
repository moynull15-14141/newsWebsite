import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AdCampaignsService } from '../services/ad-campaigns.service';

/** Mirrors JobScheduler (jobs module) — see that file for the pattern this copies. Runs in Asia/Dhaka
 * server time implicitly (the process's own TZ); campaign startAt/endAt are stored as absolute UTC
 * instants regardless, so no explicit timezone conversion is needed here. */
@Injectable()
export class AdScheduler {
  private readonly logger = new Logger(AdScheduler.name);

  constructor(private readonly campaigns: AdCampaignsService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledActivations() {
    try {
      const activated = await this.campaigns.executeScheduledActivations();
      if (activated.length > 0) this.logger.log(`Activated ${activated.length} scheduled ad campaign(s)`);
    } catch (error) {
      this.logger.error('Failed to execute scheduled ad campaign activations', error as Error);
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleExpiration() {
    try {
      const expired = await this.campaigns.expireDueCampaigns();
      if (expired.length > 0) this.logger.log(`Expired ${expired.length} ad campaign(s) past their end date`);
    } catch (error) {
      this.logger.error('Failed to expire due ad campaigns', error as Error);
    }
  }
}
