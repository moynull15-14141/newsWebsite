import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AdsService } from './ads.service';
import { CreateAdDto } from './dto/create-ad.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { parsePage, parsePositiveInt, DEFAULT_LIMIT, MAX_LIMIT } from '../../common/pagination/parse-pagination';

@Controller('ads')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdsController {
  constructor(private readonly adsService: AdsService) {}


  @Post()
  @RequirePermissions('ad.manage')
  create(@Body() dto: CreateAdDto, @CurrentUser('userId') userId: string) {
    return this.adsService.create(dto, userId);
  }

  @Get()
  @RequirePermissions('ad.manage')
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('slot') slot?: string,
  ) {
    return this.adsService.findAll(
      parsePage(page),
      parsePositiveInt(limit, DEFAULT_LIMIT, MAX_LIMIT),
      status as any,
      slot,
    );
  }

  @Get(':id')
  @RequirePermissions('ad.manage')
  findOne(@Param('id') id: string) {
    return this.adsService.findOne(id);
  }

  @Get(':id/stats')
  @RequirePermissions('ad.manage')
  getStats(@Param('id') id: string, @Query('days') days?: string) {
    return this.adsService.getAdStats(id, days ? parseInt(days) : 30);
  }

  @Patch(':id')
  @RequirePermissions('ad.manage')
  update(@Param('id') id: string, @Body() dto: Partial<CreateAdDto>) {
    return this.adsService.update(id, dto);
  }

  @Patch(':id/activate')
  @RequirePermissions('ad.manage')
  activate(@Param('id') id: string) {
    return this.adsService.activate(id);
  }

  @Patch(':id/pause')
  @RequirePermissions('ad.manage')
  pause(@Param('id') id: string) {
    return this.adsService.pause(id);
  }

  @Delete(':id')
  @RequirePermissions('ad.manage')
  remove(@Param('id') id: string) {
    return this.adsService.remove(id);
  }
}
