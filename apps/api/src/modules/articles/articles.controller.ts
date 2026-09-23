import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req,
} from '@nestjs/common';
import { ArticlesService } from './articles.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { QueryArticlesDto } from './dto/query-articles.dto';
import { CreateTranslationDto } from './dto/create-translation.dto';
import { AssignArticleDto } from './dto/assign-article.dto';
import { UpdateRelatedArticlesDto } from './dto/update-related-articles.dto';
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions('article.read')
  findAll(@Query() query: QueryArticlesDto) {
    return this.articlesService.findAll(query);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions('analytics.view')
  getStats(@CurrentUser('userId') userId: string) {
    return this.articlesService.getStats(userId);
  }

  // Admin-only lookups by id/slug — regardless of status. The public site never calls these; it goes
  // through PublicController/PublicService, which only ever returns PUBLISHED articles (Phase 2I: these
  // previously required no permission at all, just any authenticated session — a viewer with zero
  // article permissions could still read every draft in the system).
  @Get('slug/:slug')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions('article.read')
  findBySlug(@Param('slug') slug: string) {
    return this.articlesService.findBySlug(slug);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions('article.read')
  findOne(@Param('id') id: string) {
    return this.articlesService.findOne(id);
  }

  @Get(':id/revisions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions('article.read')
  getRevisions(@Param('id') id: string, @CurrentUser('userId') userId: string, @Req() req: any) {
    return this.articlesService.getRevisions(id, userId, req.user?.permissions || []);
  }

  @Get(':id/audit-log')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions('article.read')
  getAuditLog(@Param('id') id: string, @CurrentUser('userId') userId: string, @Req() req: any) {
    return this.articlesService.getAuditLog(id, userId, req.user?.permissions || []);
  }

  @Get(':id/readiness')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions('article.read')
  getReadiness(@Param('id') id: string) {
    return this.articlesService.getReadiness(id);
  }

  @Get(':id/related')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions('article.read')
  getManualRelated(@Param('id') id: string) {
    return this.articlesService.getRelatedManagement(id);
  }

  @Patch(':id/related')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions('article.review')
  updateManualRelated(
    @Param('id') id: string,
    @Body() dto: UpdateRelatedArticlesDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.articlesService.updateManualRelated(id, dto.relatedArticleIds, userId);
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
  submitReview(@Param('id') id: string, @CurrentUser('userId') userId: string, @Req() req: any) {
    return this.articlesService.submitReview(id, userId, req.user?.permissions || []);
  }

  @Post(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions('article.review')
  approve(@Param('id') id: string, @CurrentUser('userId') userId: string, @Req() req: any) {
    return this.articlesService.approve(id, userId, req.user?.permissions || []);
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
  archive(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.articlesService.archive(id, userId);
  }

  @Post(':id/unpublish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions('article.publish')
  unpublish(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.articlesService.unpublish(id, userId);
  }

  @Post(':id/restore')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions('article.publish')
  restore(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.articlesService.restore(id, userId);
  }

  @Post(':id/return-to-draft')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions('article.review')
  returnToDraft(@Param('id') id: string, @CurrentUser('userId') userId: string, @Body('reason') reason?: string) {
    return this.articlesService.returnToDraft(id, userId, reason);
  }

  @Post(':id/assign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions('article.review')
  assign(@Param('id') id: string, @Body() dto: AssignArticleDto, @CurrentUser('userId') userId: string) {
    return this.articlesService.assign(id, dto.assigneeId, dto.note, userId);
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
