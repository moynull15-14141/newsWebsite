import { Controller, Get, Param, Query, Post, Body } from '@nestjs/common';
import { PublicService } from './public.service';
import { PublicArticleQueryDto } from './dto/public-query.dto';
import { Public } from '../../common/decorators/public.decorator';

@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Public()
  @Get('articles')
  getArticles(@Query() query: PublicArticleQueryDto) {
    return this.publicService.getArticles(query);
  }

  @Public()
  @Get('articles/:slug')
  getArticleBySlug(@Param('slug') slug: string) {
    return this.publicService.getArticleBySlug(slug);
  }

  @Public()
  @Get('categories/:slug/articles')
  getArticlesByCategory(@Param('slug') slug: string, @Query() query: PublicArticleQueryDto) {
    return this.publicService.getArticlesByCategory(slug, query);
  }

  @Public()
  @Get('tags/:slug/articles')
  getArticlesByTag(@Param('slug') slug: string, @Query() query: PublicArticleQueryDto) {
    return this.publicService.getArticlesByTag(slug, query);
  }

  @Public()
  @Get('tags/:slug')
  getTag(@Param('slug') slug: string) {
    return this.publicService.getTag(slug);
  }

  @Public()
  @Get('authors/:id')
  getAuthorProfile(@Param('id') id: string) {
    return this.publicService.getAuthorProfile(id);
  }

  @Public()
  @Get('authors/:id/articles')
  getArticlesByAuthor(@Param('id') id: string, @Query() query: PublicArticleQueryDto) {
    return this.publicService.getArticlesByAuthor(id, query);
  }

  @Public()
  @Get('locations')
  getLocations() {
    return this.publicService.getLocations();
  }

  @Public()
  @Get('locations/:slug/articles')
  getArticlesByLocation(@Param('slug') slug: string, @Query() query: PublicArticleQueryDto) {
    return this.publicService.getArticlesByLocation(slug, query, query.locationType);
  }

  @Public()
  @Get('locations/:slug')
  getLocation(@Param('slug') slug: string, @Query('locationType') locationType?: string) {
    return this.publicService.getLocation(slug, locationType);
  }

  @Public()
  @Get('search')
  search(@Query() query: PublicArticleQueryDto) {
    return this.publicService.search(query);
  }

  @Public()
  @Get('homepage')
  getHomepage(@Query('lang') lang?: string) {
    return this.publicService.getHomepageData(lang);
  }

  @Public()
  @Get('breaking-news')
  getBreakingNews(@Query('limit') limit?: string, @Query('lang') lang?: string) {
    return this.publicService.getBreakingNews(limit ? parseInt(limit, 10) : 5, lang);
  }

  @Public()
  @Get('articles/:slug/related')
  async getRelatedArticles(@Param('slug') slug: string) {
    const article = await this.publicService.getArticleBySlug(slug);
    const tagIds = (article as any).articleTags?.map((t: any) => t.tag.id) || [];
    return this.publicService.getRelatedArticles(
      article.id,
      (article as any).category?.id,
      tagIds,
      (article as any).location?.id,
      (article as any).language?.id ?? null,
    );
  }

  @Public()
  @Post('articles/:slug/view')
  trackView(
    @Param('slug') slug: string,
    @Body('fingerprint') fingerprint?: string,
  ) {
    return this.publicService.trackView(slug, fingerprint);
  }

  @Public()
  @Get('most-read')
  getMostRead(
    @Query('window') window?: 'today' | '24h' | '7d',
    @Query('limit') limit?: string,
    @Query('lang') lang?: string,
  ) {
    return this.publicService.getMostRead({
      window: window || '24h',
      limit: limit ? parseInt(limit, 10) : 10,
      lang,
    });
  }

  @Public()
  @Get('trending')
  getTrending(
    @Query('location') location?: string,
    @Query('limit') limit?: string,
    @Query('lang') lang?: string,
  ) {
    return this.publicService.getTrending({
      locationSlug: location,
      limit: limit ? parseInt(limit, 10) : 10,
      lang,
    });
  }
}
