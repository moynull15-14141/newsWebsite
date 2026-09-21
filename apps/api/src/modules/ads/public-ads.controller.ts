import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AdsService } from './ads.service';
import { Public } from '../../common/decorators/public.decorator';

@Controller('public')
export class PublicAdsController {
  constructor(private readonly adsService: AdsService) {}

  @Public()
  @Get('ads/slot')
  getSlot(
    @Query('slot') slot: string,
    @Query('pageType') pageType?: string,
    @Query('categoryId') categoryId?: string,
    @Query('locationId') locationId?: string,
    @Query('device') device?: string,
  ) {
    return this.adsService.getActiveForSlot(slot, pageType, categoryId, locationId, device);
  }

  @Public()
  @Post('ads/:id/impression')
  impression(@Param('id') id: string, @Body('slot') slot: string, @Body('sessionId') sessionId?: string) {
    return this.adsService.recordImpression(id, slot, sessionId);
  }

  @Public()
  @Post('ads/:id/click')
  click(@Param('id') id: string, @Body('slot') slot: string, @Body('sessionId') sessionId?: string) {
    return this.adsService.recordClick(id, slot, sessionId);
  }
}
