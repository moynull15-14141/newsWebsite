import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AdvertisersService } from './services/advertisers.service';
import { CreateAdvertiserDto } from './dto/create-advertiser.dto';
import { UpdateAdvertiserDto } from './dto/update-advertiser.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { parsePage, parsePositiveInt, DEFAULT_LIMIT, MAX_LIMIT } from '../../common/pagination/parse-pagination';

@Controller('advertisers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdvertisersController {
  constructor(private readonly advertisers: AdvertisersService) {}

  @Post()
  @RequirePermissions('ads.create')
  create(@Body() dto: CreateAdvertiserDto, @CurrentUser('userId') userId: string) {
    return this.advertisers.create(dto, userId);
  }

  @Get()
  @RequirePermissions('ads.view')
  findAll(@Query('page') page?: string, @Query('limit') limit?: string, @Query('search') search?: string) {
    return this.advertisers.findAll(parsePage(page), parsePositiveInt(limit, DEFAULT_LIMIT, MAX_LIMIT), search);
  }

  @Get(':id')
  @RequirePermissions('ads.view')
  findOne(@Param('id') id: string) {
    return this.advertisers.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('ads.update')
  update(@Param('id') id: string, @Body() dto: UpdateAdvertiserDto) {
    return this.advertisers.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('ads.delete')
  remove(@Param('id') id: string) {
    return this.advertisers.remove(id);
  }
}
