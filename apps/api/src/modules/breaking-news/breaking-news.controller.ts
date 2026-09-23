import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { BreakingNewsService } from './breaking-news.service';
import { CreateBreakingNewsDto } from './dto/create-breaking-news.dto';
import { UpdateBreakingNewsDto } from './dto/update-breaking-news.dto';
import { ReorderBreakingNewsDto } from './dto/reorder-breaking-news.dto';
import { ScheduleBreakingNewsDto } from './dto/schedule-breaking-news.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@Controller('breaking-news')
@UseGuards(JwtAuthGuard, RolesGuard)
@RequirePermissions('breaking_news.manage')
export class BreakingNewsController {
  constructor(private readonly service: BreakingNewsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateBreakingNewsDto, @CurrentUser('userId') userId: string) {
    return this.service.create(dto, userId);
  }

  @Patch('reorder')
  reorder(@Body() dto: ReorderBreakingNewsDto, @CurrentUser('userId') userId: string) {
    return this.service.reorder(dto.orderedIds, userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBreakingNewsDto, @CurrentUser('userId') userId: string) {
    return this.service.update(id, dto, userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.service.remove(id, userId);
  }

  @Post(':id/activate')
  activate(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.service.setActive(id, true, userId);
  }

  @Post(':id/deactivate')
  deactivate(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.service.setActive(id, false, userId);
  }

  @Post(':id/publish-now')
  publishNow(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.service.publishNow(id, userId);
  }

  @Post(':id/stop')
  stop(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.service.stop(id, userId);
  }

  @Post(':id/schedule')
  schedule(
    @Param('id') id: string,
    @Body() dto: ScheduleBreakingNewsDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.service.schedule(id, dto.startAt ?? null, dto.endAt ?? null, userId);
  }
}

/** Separate, unguarded controller for the public ticker itself — same split as
 * AdsController/PublicAdsController and ArticlesController/PublicController elsewhere in this API. */
@Controller('public/breaking-news-ticker')
export class PublicBreakingNewsController {
  constructor(private readonly service: BreakingNewsService) {}

  @Public()
  @Get()
  getActive() {
    return this.service.getActiveTicker();
  }
}
