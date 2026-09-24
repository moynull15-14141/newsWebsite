import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AdCampaignsService } from './services/ad-campaigns.service';
import { AdEventsService } from './services/ad-events.service';
import { GetEligibleAdDto, RecordAdEventDto } from './dto/get-eligible-ad.dto';
import { Public } from '../../common/decorators/public.decorator';

/** Deliberately separate routes from the legacy PublicAdsController's `public/ads/*` (see that file) —
 * this is the new placement-registry-backed serving path; the old flat-Ad path is left untouched. */
@Controller('public')
export class PublicAdServingController {
  constructor(
    private readonly campaigns: AdCampaignsService,
    private readonly events: AdEventsService,
  ) {}

  @Public()
  @Get('ad-placements/eligible')
  getEligible(@Query() query: GetEligibleAdDto) {
    return this.campaigns.getEligibleForPlacement(query);
  }

  @Public()
  @Post('ad-events/impression')
  impression(@Body() dto: RecordAdEventDto) {
    return this.events.recordImpression(dto);
  }

  @Public()
  @Post('ad-events/click')
  click(@Body() dto: RecordAdEventDto) {
    return this.events.recordClick(dto);
  }
}
