import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { IsIn, IsInt, IsOptional, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { BreakingNewsService, TICKER_STYLES, TICKER_DIRECTIONS, type TickerStyle, type TickerDirection } from './breaking-news.service';
import { CreateBreakingNewsDto } from './dto/create-breaking-news.dto';
import { UpdateBreakingNewsDto } from './dto/update-breaking-news.dto';
import { ReorderBreakingNewsDto } from './dto/reorder-breaking-news.dto';
import { ScheduleBreakingNewsDto } from './dto/schedule-breaking-news.dto';
import { IsHexColor, BACKGROUND_MODES, GRADIENT_DIRECTIONS, type BackgroundMode, type GradientDirection } from './dto/breaking-news-color.validators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

// Mirrors CreateBreakingNewsDto's own color fields exactly — this is the same "one bar, one color set"
// shape, just not tied to a single BreakingNews row (see BreakingNewsService's TICKER_SETTINGS comment).
class TickerColorsDto {
  @IsIn(BACKGROUND_MODES) backgroundMode!: BackgroundMode;
  @IsHexColor() backgroundColor!: string;
  @IsOptional() @IsHexColor() gradientStart?: string | null;
  @IsOptional() @IsHexColor() gradientEnd?: string | null;
  @IsOptional() @IsIn(GRADIENT_DIRECTIONS) gradientDirection?: GradientDirection | null;
  @IsHexColor() textColor!: string;
  @IsHexColor() badgeBackgroundColor!: string;
  @IsHexColor() badgeTextColor!: string;
}

// Marquee-only: which way the headline crawls, and how long one full pass takes (see
// BreakingNewsService's MarqueeSettings comment for why speedMs isn't derived from any item's own
// animationSpeedMs).
class MarqueeSettingsDto extends TickerColorsDto {
  @IsIn(TICKER_DIRECTIONS) direction!: TickerDirection;
  @IsInt() @Min(3000) @Max(60000) speedMs!: number;
}

// Rotator-only: how long each headline holds before fading to the next (see BreakingNewsService's
// RotatorSettings comment for why this isn't derived from any item's own animationSpeedMs).
class RotatorSettingsDto extends TickerColorsDto {
  @IsInt() @Min(1000) @Max(30000) holdMs!: number;
}

class UpdateTickerSettingsDto {
  @IsOptional() @IsIn(TICKER_STYLES) style?: TickerStyle;
  @IsOptional() @ValidateNested() @Type(() => MarqueeSettingsDto) marquee?: MarqueeSettingsDto;
  @IsOptional() @ValidateNested() @Type(() => RotatorSettingsDto) rotator?: RotatorSettingsDto;
}

@Controller('breaking-news')
@UseGuards(JwtAuthGuard, RolesGuard)
@RequirePermissions('breaking_news.manage')
export class BreakingNewsController {
  constructor(private readonly service: BreakingNewsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  // Ticker-wide presentation choice (chips/marquee/rotator) — a fixed route ahead of the ':id' routes
  // below so "settings" is never swallowed as an id param.
  @Get('settings')
  getSettings() {
    return this.service.getTickerSettings();
  }

  @Patch('settings')
  updateSettings(@Body() dto: UpdateTickerSettingsDto, @CurrentUser('userId') userId: string) {
    const normalizeGradients = <T extends TickerColorsDto>(colors: T) => ({
      ...colors,
      gradientStart: colors.gradientStart ?? null,
      gradientEnd: colors.gradientEnd ?? null,
      gradientDirection: colors.gradientDirection ?? null,
    });
    return this.service.updateTickerSettings(
      {
        style: dto.style,
        marquee: dto.marquee ? normalizeGradients(dto.marquee) : undefined,
        rotator: dto.rotator ? normalizeGradients(dto.rotator) : undefined,
      },
      userId,
    );
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

  @Public()
  @Get('settings')
  getTickerSettings() {
    return this.service.getTickerSettings();
  }
}
