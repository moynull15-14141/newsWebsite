import { Body, Controller, Delete, Get, Header, Param, ParseIntPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  CreateHomepageSectionDto,
  PublishHomepageDto,
  ReorderHomepageSectionsDto,
  SetHomepagePlacementsDto,
  UpdateHomepageSectionDto,
} from './dto/homepage.dto';
import { HomepageService } from './homepage.service';

/**
 * Admin homepage curation. Every route requires a valid JWT AND the `homepage.manage` permission
 * (class-level guards: a route added later is protected by default). All mutations target the DRAFT
 * configuration; only POST /homepage/publish changes what the public site shows.
 * Draft data must never be cached by shared caches, hence no-store on reads.
 */
@Controller('homepage')
@UseGuards(JwtAuthGuard, RolesGuard)
@RequirePermissions('homepage.manage')
export class HomepageController {
  constructor(private readonly service: HomepageService) {}

  @Get('active')
  @Header('Cache-Control', 'no-store')
  active() {
    return this.service.getActive();
  }

  @Get('draft')
  @Header('Cache-Control', 'no-store')
  draft() {
    return this.service.getDraft();
  }

  /** `?lang=` lets an editor preview the draft in a specific language; defaults to the platform default. */
  @Get('draft/preview')
  @Header('Cache-Control', 'no-store')
  preview(@Query('lang') lang?: string) {
    return this.service.previewDraft(lang);
  }

  @Post('draft/sections')
  createSection(@Body() dto: CreateHomepageSectionDto) {
    return this.service.createSection(dto);
  }

  // Declared before the ':id' routes so "order" is never captured as a section id.
  @Put('draft/sections/order')
  reorder(@Body() dto: ReorderHomepageSectionsDto) {
    return this.service.reorderSections(dto);
  }

  @Patch('draft/sections/:id')
  updateSection(@Param('id') id: string, @Body() dto: UpdateHomepageSectionDto) {
    return this.service.updateSection(id, dto);
  }

  @Delete('draft/sections/:id')
  deleteSection(@Param('id') id: string, @Query('expectedVersion', ParseIntPipe) expectedVersion: number) {
    return this.service.deleteSection(id, expectedVersion);
  }

  @Put('draft/sections/:id/placements')
  placements(@Param('id') id: string, @Body() dto: SetHomepagePlacementsDto) {
    return this.service.setPlacements(id, dto);
  }

  @Post('publish')
  publish(@Body() dto: PublishHomepageDto) {
    return this.service.publish(dto.expectedVersion);
  }
}
