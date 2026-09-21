import { Test, TestingModule } from '@nestjs/testing';
import { ServicesModule } from './services.module';
import { PublishingService } from './publishing.service';
import { BreakingNewsService } from './breaking-news.service';
import { ArticleViewService } from './article-view.service';
import { TrendingService } from './trending.service';
import { MostReadService } from './most-read.service';
import { ArticleRevisionService } from './article-revision.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaModule } from '../../../prisma/prisma.module';

describe('ServicesModule', () => {
  let module: TestingModule;

  const mockPrisma = {
    article: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
    articleView: { create: jest.fn(), findFirst: jest.fn(), count: jest.fn() },
    articleRevision: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    location: { findUnique: jest.fn(), findMany: jest.fn() },
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [ServicesModule, PrismaModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .compile();
  });

  it('should export PublishingService', () => {
    const service = module.get<PublishingService>(PublishingService);
    expect(service).toBeInstanceOf(PublishingService);
  });

  it('should export BreakingNewsService', () => {
    const service = module.get<BreakingNewsService>(BreakingNewsService);
    expect(service).toBeInstanceOf(BreakingNewsService);
  });

  it('should export ArticleViewService', () => {
    const service = module.get<ArticleViewService>(ArticleViewService);
    expect(service).toBeInstanceOf(ArticleViewService);
  });

  it('should export TrendingService', () => {
    const service = module.get<TrendingService>(TrendingService);
    expect(service).toBeInstanceOf(TrendingService);
  });

  it('should export MostReadService', () => {
    const service = module.get<MostReadService>(MostReadService);
    expect(service).toBeInstanceOf(MostReadService);
  });

  it('should export ArticleRevisionService', () => {
    const service = module.get<ArticleRevisionService>(ArticleRevisionService);
    expect(service).toBeInstanceOf(ArticleRevisionService);
  });
});
