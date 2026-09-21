import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { LocationsService } from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('locations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  @Public()
  findAll(@Query('type') type?: string, @Query('all') all?: string, @Query('parentId') parentId?: string) {
    return this.locationsService.findAll(type, all === 'true', parentId);
  }

  @Get('tree')
  @Public()
  findTree() {
    return this.locationsService.findTree();
  }

  @Get('id/:id')
  @RequirePermissions('settings.manage')
  findById(@Param('id') id: string) {
    return this.locationsService.findById(id);
  }

  @Get(':slug')
  @Public()
  findBySlug(@Param('slug') slug: string, @Query('type') type?: string) {
    return this.locationsService.findBySlug(slug, type);
  }

  @Post()
  @RequirePermissions('settings.manage')
  create(@Body() dto: CreateLocationDto) {
    return this.locationsService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('settings.manage')
  update(@Param('id') id: string, @Body() dto: UpdateLocationDto) {
    return this.locationsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('settings.manage')
  remove(@Param('id') id: string) {
    return this.locationsService.remove(id);
  }
}
