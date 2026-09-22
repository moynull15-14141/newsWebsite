import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req,
} from '@nestjs/common';
import { ArticlesService } from './articles.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { QueryArticlesDto } from './dto/query-articles.dto';
import { CreateTranslationDto } from './dto/create-translation.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions('article.create')
  create(@Body() dto: CreateArticleDto, @CurrentUser('userId') userId: string) {
    return this.articlesService.create(dto, userId);
  }

  @Get()
  findAll(@Query() query: QueryArticlesDto) {
    return this.articlesService.findAll(query);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions('analytics.view')
  getStats() {
    return this.articlesService.getStats();
  }

  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.articlesService.findBySlug(slug);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.articlesService.findOne(id);
  }

  @Get(':id/revisions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions('article.read')
  getRevisions(@Param('id') id: string, @CurrentUser('userId') userId: string, @Req() req: any) {
    return this.articlesService.getRevisions(id, userId, req.user?.permissions || []);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions('article.edit')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateArticleDto,
    @CurrentUser('userId') userId: string,
    @Req() req: any,
  ) {
    const permissions = req.user?.permissions || [];
    return this.articlesService.update(id, dto, userId, permissions);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions('article.delete')
  remove(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
    @Req() req: any,
  ) {
    const permissions = req.user?.permissions || [];
    return this.articlesService.remove(id, userId, permissions);
  }

  @Post(':id/submit-review')
  @UseGuards(JwtAuthGuard)
  submitReview(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.articlesService.submitReview(id, userId);
  }

  @Post(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions('article.review')
  approve(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.articlesService.approve(id, userId);
  }

  @Post(':id/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions('article.publish')
  publish(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.articlesService.publish(id, userId);
  }

  @Post(':id/archive')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions('article.publish')
  archive(@Param('id') id: string) {
    return this.articlesService.archive(id);
  }

  @Post(':id/return-to-draft')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions('article.review')
  returnToDraft(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.articlesService.returnToDraft(id, userId);
  }

  @Post(':id/revisions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions('article.edit')
  saveRevision(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
    @Body('changeReason') changeReason?: string,
    @Req() req?: any,
  ) {
    return this.articlesService.saveRevision(id, userId, changeReason, req?.user?.permissions || []);
  }

  @Post(':id/revisions/:revisionId/restore')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions('article.edit')
  restoreRevision(
    @Param('id') id: string,
    @Param('revisionId') revisionId: string,
    @CurrentUser('userId') userId: string,
    @Req() req: any,
  ) {
    return this.articlesService.restoreRevision(id, revisionId, userId, req.user?.permissions || []);
  }

  @Post(':id/schedule')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions('article.edit')
  scheduleArticle(
    @Param('id') id: string,
    @Body('scheduledAt') scheduledAt: string,
    @CurrentUser('userId') userId: string,
    @Req() req: any,
  ) {
    return this.articlesService.scheduleArticle(id, scheduledAt, userId, req.user?.permissions || []);
  }

  @Post(':id/cancel-schedule')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions('article.edit')
  cancelSchedule(@Param('id') id: string, @CurrentUser('userId') userId: string, @Req() req: any) {
    return this.articlesService.cancelSchedule(id, userId, req.user?.permissions || []);
  }

  @Post(':id/translations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions('article.create')
  createTranslation(@Param('id') id: string, @Body() dto: CreateTranslationDto, @CurrentUser('userId') userId: string) {
    return this.articlesService.createTranslation(id, dto.languageId, userId);
  }

  @Get(':id/translations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions('article.read')
  getTranslations(@Param('id') id: string) {
    return this.articlesService.getTranslations(id);
  }
}
