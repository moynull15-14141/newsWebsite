import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AdCreativesService } from './services/ad-creatives.service';
import { CreateCreativeDto } from './dto/create-creative.dto';
import { UpdateCreativeDto } from './dto/update-creative.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { parsePage, parsePositiveInt, DEFAULT_LIMIT, MAX_LIMIT } from '../../common/pagination/parse-pagination';

@Controller('ad-creatives')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdCreativesController {
  constructor(private readonly creatives: AdCreativesService) {}

  @Post()
  @RequirePermissions('ads.create')
  create(@Body() dto: CreateCreativeDto, @CurrentUser('userId') userId: string) {
    return this.creatives.create(dto, userId);
  }

  @Get()
  @RequirePermissions('ads.view')
  findAll(@Query('page') page?: string, @Query('limit') limit?: string, @Query('campaignId') campaignId?: string) {
    return this.creatives.findAll(parsePage(page), parsePositiveInt(limit, DEFAULT_LIMIT, MAX_LIMIT), campaignId);
  }

  @Get(':id')
  @RequirePermissions('ads.view')
  findOne(@Param('id') id: string) {
    return this.creatives.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('ads.update')
  update(@Param('id') id: string, @Body() dto: UpdateCreativeDto, @CurrentUser('userId') userId: string) {
    return this.creatives.update(id, dto, userId);
  }

  @Delete(':id')
  @RequirePermissions('ads.delete')
  remove(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.creatives.remove(id, userId);
  }
}
