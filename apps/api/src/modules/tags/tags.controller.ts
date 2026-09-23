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
import { TagsService } from './tags.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { parsePage, parsePositiveInt, DEFAULT_LIMIT, MAX_LIMIT } from '../../common/pagination/parse-pagination';

@Controller('tags')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  @Public()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('all') all?: string,
  ) {
    return this.tagsService.findAll({
      page: page ? parsePage(page) : undefined,
      limit: limit ? parsePositiveInt(limit, DEFAULT_LIMIT, MAX_LIMIT) : undefined,
      search,
      all: all === 'true',
    });
  }

  @Get('id/:id')
  @RequirePermissions('article.edit')
  findById(@Param('id') id: string) {
    return this.tagsService.findById(id);
  }

  @Get(':slug')
  @Public()
  findBySlug(@Param('slug') slug: string) {
    return this.tagsService.findBySlug(slug);
  }

  @Post()
  @RequirePermissions('article.edit')
  create(@Body() dto: CreateTagDto) {
    return this.tagsService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('article.edit')
  update(@Param('id') id: string, @Body() dto: UpdateTagDto) {
    return this.tagsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('article.edit')
  remove(@Param('id') id: string) {
    return this.tagsService.remove(id);
  }
}
