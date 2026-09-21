import { Controller, Get, Header } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { SeoService } from './seo.service';

@Controller('seo')
export class SeoController {
  constructor(private readonly seoService: SeoService) {}

  @Public()
  @Get('robots.txt')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  robots() {
    return this.seoService.getRobots();
  }

  @Public()
  @Get('sitemap.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  sitemap() {
    return this.seoService.getSitemap();
  }

  @Public()
  @Get('news-sitemap.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  newsSitemap() {
    return this.seoService.getNewsSitemap();
  }
}
