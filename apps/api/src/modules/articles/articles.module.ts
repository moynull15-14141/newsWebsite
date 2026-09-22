import { Module } from '@nestjs/common';
import { ArticlesController } from './articles.controller';
import { ArticlesService } from './articles.service';
import { ServicesModule } from './services/services.module';
import { SchedulersModule } from './schedulers/schedulers.module';
import { LanguagesModule } from '../languages/languages.module';
import { SeoModule } from '../seo/seo.module';

@Module({
  imports: [ServicesModule, SchedulersModule, LanguagesModule, SeoModule],
  controllers: [ArticlesController],
  providers: [ArticlesService],
  exports: [ArticlesService, ServicesModule],
})
export class ArticlesModule {}
