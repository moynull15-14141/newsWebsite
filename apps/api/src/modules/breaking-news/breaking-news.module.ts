import { Module } from '@nestjs/common';
import { BreakingNewsController, PublicBreakingNewsController } from './breaking-news.controller';
import { BreakingNewsService } from './breaking-news.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BreakingNewsController, PublicBreakingNewsController],
  providers: [BreakingNewsService],
  exports: [BreakingNewsService],
})
export class BreakingNewsModule {}
