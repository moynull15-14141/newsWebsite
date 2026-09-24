import { Module } from '@nestjs/common';
import { AdsController } from './ads.controller';
import { AdsService } from './ads.service';
import { PublicAdsController } from './public-ads.controller';

import { AdvertisersController } from './advertisers.controller';
import { AdCampaignsController } from './ad-campaigns.controller';
import { AdCreativesController } from './ad-creatives.controller';
import { AdPlacementsController } from './ad-placements.controller';
import { PublicAdServingController } from './public-ad-serving.controller';

import { AdvertisersService } from './services/advertisers.service';
import { AdCampaignsService } from './services/ad-campaigns.service';
import { AdCreativesService } from './services/ad-creatives.service';
import { AdPlacementsService } from './services/ad-placements.service';
import { AdEventsService } from './services/ad-events.service';
import { AdAuditLogService } from './services/ad-audit-log.service';
import { AdScheduler } from './schedulers/ad-scheduler.service';

@Module({
  controllers: [
    // Legacy flat-Ad model (Phase 2K-era) — left untouched, zero rows in any real environment, superseded
    // by the Advertiser/Campaign/Creative/Placement stack below (see schema.prisma's own comment).
    AdsController,
    PublicAdsController,
    // Advertisement platform (Phase 2Q)
    AdvertisersController,
    AdCampaignsController,
    AdCreativesController,
    AdPlacementsController,
    PublicAdServingController,
  ],
  providers: [
    AdsService,
    AdvertisersService,
    AdCampaignsService,
    AdCreativesService,
    AdPlacementsService,
    AdEventsService,
    AdAuditLogService,
    AdScheduler,
  ],
  exports: [AdsService, AdCampaignsService, AdEventsService, AdAuditLogService],
})
export class AdsModule {}
