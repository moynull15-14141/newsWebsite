import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { HealthModule } from './modules/health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { LocationsModule } from './modules/locations/locations.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { TagsModule } from './modules/tags/tags.module';
import { ArticlesModule } from './modules/articles/articles.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { StorageModule } from './common/storage/storage.module';
import { MediaModule } from './modules/media/media.module';
import { PublicModule } from './modules/public/public.module';
import { CommentsModule } from './modules/comments/comments.module';
import { AdsModule } from './modules/ads/ads.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ReaderModule } from './modules/reader/reader.module';
import { CollectionsModule } from './modules/collections/collections.module';
import { HomepageModule } from './modules/homepage/homepage.module';
import { EditorialModule } from './modules/editorial/editorial.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { RateLimitGuard } from './common/rate-limit/rate-limit.guard';
import { SeoModule } from './modules/seo/seo.module';
import { LanguagesModule } from './modules/languages/languages.module';
import { BreakingNewsModule } from './modules/breaking-news/breaking-news.module';
import { JobsModule } from './modules/jobs/jobs.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    HealthModule,
    LocationsModule,
    CategoriesModule,
    TagsModule,
    ArticlesModule,
    UsersModule,
    StorageModule,
    MediaModule,
    PublicModule,
    CommentsModule,
    AdsModule,
    AnalyticsModule,
    ReaderModule,
    CollectionsModule,
    HomepageModule,
    EditorialModule,
    SeoModule,
    LanguagesModule,
    BreakingNewsModule,
    JobsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // Runs last, so only requests already authenticated and authorized reach it — throttling, not access control.
    { provide: APP_GUARD, useClass: RateLimitGuard },
  ],
})
export class AppModule {}
