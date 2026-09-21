import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { EditorialService } from './editorial.service';

class TextDto { @IsString() @MinLength(2) @MaxLength(5000) content!: string; }
@Controller('editorial')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EditorialController {
  constructor(private readonly service: EditorialService) {}
  @Get('articles/:articleId/notes') @RequirePermissions('article.read') notes(@Param('articleId') articleId: string) { return this.service.getNotes(articleId); }
  @Post('articles/:articleId/notes') @RequirePermissions('article.edit') note(@Param('articleId') articleId: string, @CurrentUser('userId') userId: string, @Body() dto: TextDto) { return this.service.addNote(articleId, userId, dto.content); }
  @Post('articles/:articleId/corrections') @RequirePermissions('article.edit') correction(@Param('articleId') articleId: string, @CurrentUser('userId') userId: string, @Body() dto: TextDto) { return this.service.addCorrection(articleId, userId, dto.content); }
  @Get('settings') @RequirePermissions('settings.manage') settings() { return this.service.getSettings(); }
  @Patch('settings') @RequirePermissions('settings.manage') updateSettings(@CurrentUser('userId') userId: string, @Body() values: Record<string, unknown>) { return this.service.updateSettings(values, userId); }
}
@Controller('public/settings')
export class PublicSettingsController {
  constructor(private readonly service: EditorialService) {}
  @Public() @Get() settings() { return this.service.getSettings(); }
}
