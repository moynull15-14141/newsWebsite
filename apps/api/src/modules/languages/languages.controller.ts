import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { LanguagesService } from './languages.service';
import { CreateLanguageDto } from './dto/create-language.dto';
import { UpdateLanguageDto } from './dto/update-language.dto';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('languages')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LanguagesController {
  constructor(private readonly languagesService: LanguagesService) {}

  /** Public: the language switcher and every `?lang=` consumer read only the active set. */
  @Get()
  @Public()
  findActive() {
    return this.languagesService.findActive();
  }

  /** Admin: every language including disabled ones, for the Languages settings page. */
  @Get('admin/list')
  @RequirePermissions('settings.manage')
  findAll() {
    return this.languagesService.findAll();
  }

  @Post()
  @RequirePermissions('settings.manage')
  create(@Body() dto: CreateLanguageDto) {
    return this.languagesService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('settings.manage')
  update(@Param('id') id: string, @Body() dto: UpdateLanguageDto) {
    return this.languagesService.update(id, dto);
  }
}
