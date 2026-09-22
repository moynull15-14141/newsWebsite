import { Controller, Get, Header, Param, UseGuards } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SeoService } from './seo.service';

@Controller('seo')
export class SeoController {
  constructor(private readonly seoService: SeoService) {}
  @Public() @Get('robots.txt') @Header('Content-Type', 'text/plain; charset=utf-8') robots() { return this.seoService.getRobots(); }
  @Public() @Get('sitemap.xml') @Header('Content-Type', 'application/xml; charset=utf-8') sitemap() { return this.seoService.getSitemapIndex(); }
  @Public() @Get('page-sitemap.xml') @Header('Content-Type', 'application/xml; charset=utf-8') pages() { return this.seoService.getPageSitemap(); }
  @Public() @Get('article-sitemap.xml') @Header('Content-Type', 'application/xml; charset=utf-8') articles() { return this.seoService.getArticleSitemap(); }
  @Public() @Get('category-sitemap.xml') @Header('Content-Type', 'application/xml; charset=utf-8') categories() { return this.seoService.getCategorySitemap(); }
  @Public() @Get('tag-sitemap.xml') @Header('Content-Type', 'application/xml; charset=utf-8') tags() { return this.seoService.getTagSitemap(); }
  @Public() @Get('author-sitemap.xml') @Header('Content-Type', 'application/xml; charset=utf-8') authors() { return this.seoService.getAuthorSitemap(); }
  @Public() @Get('location-sitemap.xml') @Header('Content-Type', 'application/xml; charset=utf-8') locations() { return this.seoService.getLocationSitemap(); }
  @Public() @Get('news-sitemap.xml') @Header('Content-Type', 'application/xml; charset=utf-8') news() { return this.seoService.getNewsSitemap(); }
  @Get('health') @UseGuards(JwtAuthGuard, RolesGuard) @RequirePermissions('analytics.view') health() { return this.seoService.getSiteHealth(); }
  @Get('articles/:id') @UseGuards(JwtAuthGuard, RolesGuard) @RequirePermissions('article.read') analyze(@Param('id') id: string) { return this.seoService.analyzeArticle(id); }
}
