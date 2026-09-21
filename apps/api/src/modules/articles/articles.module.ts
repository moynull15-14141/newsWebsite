import { Module } from '@nestjs/common';
import { ArticlesController } from './articles.controller';
import { ArticlesService } from './articles.service';
import { ServicesModule } from './services/services.module';
import { SchedulersModule } from './schedulers/schedulers.module';

@Module({
  imports: [ServicesModule, SchedulersModule],
  controllers: [ArticlesController],
  providers: [ArticlesService],
  exports: [ArticlesService, ServicesModule],
})
export class ArticlesModule {}
