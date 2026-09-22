import { Module } from '@nestjs/common';
import { PublishingService } from './publishing.service';
import { BreakingNewsService } from './breaking-news.service';
import { ArticleViewService } from './article-view.service';
import { TrendingService } from './trending.service';
import { MostReadService } from './most-read.service';
import { AuditLogService } from './audit-log.service';

@Module({
  providers: [
    PublishingService,
    BreakingNewsService,
    ArticleViewService,
    TrendingService,
    MostReadService,
    AuditLogService,
  ],
  exports: [
    PublishingService,
    BreakingNewsService,
    ArticleViewService,
    TrendingService,
    MostReadService,
    AuditLogService,
  ],
})
export class ServicesModule {}
